import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceOrderRequest {
  marketId: string;
  side: 'yes' | 'no';
  orderType: 'market' | 'limit';
  quantity: number;
  price?: number;
}

// Pool exposure tracking - orders created by pool fills that are waiting for counterparty
interface PoolExposure {
  orderId: string;
  marketId: string;
  side: string;
  quantity: number;
  price: number;
  createdAt: Date;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const pathAction = url.pathname.split('/').pop();
    
    const body = req.method === 'POST' ? await req.json() : {};
    const action = body.action || pathAction;

    if (action === 'place' && req.method === 'POST') {
      // Rate limiting for order placement (10 orders per minute per user)
      const { data: rateCheck, error: rateError } = await supabase.rpc('check_rate_limit_fast', {
        _user_id: user.id,
        _operation_type: 'order_placement',
        _max_attempts: 10,
        _window_minutes: 1
      });

      if (rateError) {
        console.error('Rate limit check error:', rateError);
      } else if (rateCheck && !rateCheck.allowed) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Too many orders. Please wait ${rateCheck.retry_after_seconds} seconds.`,
          retry_after: rateCheck.retry_after_seconds,
          attempts_used: rateCheck.attempts_used
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retry_after_seconds || 60)
          },
        });
      }

      return await placeOrder(supabase, user.id, body);
    } else if (action === 'cancel' && req.method === 'POST') {
      return await cancelOrder(supabase, user.id, body);
    } else if (action === 'depth' && req.method === 'GET') {
      const marketId = url.searchParams.get('marketId');
      return await getMarketDepth(supabase, marketId);
    } else if (action === 'position' && req.method === 'GET') {
      const marketId = url.searchParams.get('marketId');
      return await getUserPosition(supabase, user.id, marketId);
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Order book error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function placeOrder(supabase: any, userId: string, request: PlaceOrderRequest) {
  const { marketId, side, orderType, quantity, price } = request;

  if (!marketId || !side || !orderType || !quantity || quantity <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid order parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (orderType === 'limit' && (!price || price <= 0 || price >= 1)) {
    return new Response(JSON.stringify({ error: 'Limit orders require price between 0.01 and 0.99' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get user balance
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'User profile not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const maxCost = orderType === 'limit' ? quantity * price! : quantity * 0.99;
  
  if (profile.balance < maxCost) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      market_id: marketId,
      user_id: userId,
      side,
      order_type: orderType,
      price: orderType === 'limit' ? price : null,
      quantity,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) {
    console.error('Order creation error:', orderError);
    return new Response(JSON.stringify({ error: 'Failed to create order' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Order created: ${order.id} - ${side} ${quantity} @ ${price || 'market'}`);

  // Try to match the order
  const matchResult = await matchOrder(supabase, order);

  // Update market best prices based on order book + pool
  await updateMarketPrices(supabase, marketId);

  // Calculate position details for response
  const fillPrice = matchResult.avgFillPrice || (side === 'yes' ? 0.5 : 0.5);
  const maxWin = matchResult.filledQuantity > 0 ? matchResult.filledQuantity * (1 - fillPrice) : 0;
  const risk = matchResult.filledQuantity > 0 ? matchResult.filledQuantity * fillPrice : 0;

  return new Response(JSON.stringify({
    success: true,
    order: {
      id: order.id,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      status: matchResult.finalStatus,
      filledQuantity: matchResult.filledQuantity,
      avgFillPrice: matchResult.avgFillPrice,
      trades: matchResult.trades,
      // Position info for UI
      position: {
        side,
        shares: matchResult.filledQuantity,
        entryPrice: matchResult.avgFillPrice,
        maxWin: maxWin,
        risk: risk,
        potentialPayout: matchResult.filledQuantity // $1 per share if correct
      }
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function matchOrder(supabase: any, order: any) {
  const { id, market_id, user_id, side, order_type, price, quantity } = order;
  
  // Get market info
  const { data: market } = await supabase
    .from('markets')
    .select('created_by, platform_fee_percent, creator_fee_percent, pool_yes_shares, pool_no_shares, liquidity_pool, pool_enabled, yes_price, no_price')
    .eq('id', market_id)
    .single();

  if (!market) {
    console.error('Market not found:', market_id);
    return { filledQuantity: 0, avgFillPrice: null, trades: [], finalStatus: 'cancelled' };
  }

  const platformFeePercent = market?.platform_fee_percent || 3;
  const creatorFeePercent = market?.creator_fee_percent || 0;
  const creatorId = market?.created_by;

  let creatorIsAdmin = false;
  if (creatorId) {
    const { data: creatorRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', creatorId);
    creatorIsAdmin = creatorRoles?.some((r: any) => r.role === 'admin') || false;
  }

  const effectivePlatformFee = creatorIsAdmin ? platformFeePercent : 1;
  const effectiveCreatorFee = creatorIsAdmin ? 0 : Math.min(creatorFeePercent, 2);
  
  const oppositeSide = side === 'yes' ? 'no' : 'yes';
  
  // First, look for matching orders (prioritize real counterparty orders)
  let matchQuery = supabase
    .from('orders')
    .select('*')
    .eq('market_id', market_id)
    .eq('side', oppositeSide)
    .in('status', ['pending', 'partial'])
    .neq('user_id', user_id);

  if (order_type === 'limit') {
    const minOppositePrice = 1 - price;
    matchQuery = matchQuery.gte('price', minOppositePrice);
  }

  matchQuery = matchQuery.order('price', { ascending: false }).order('created_at', { ascending: true });

  const { data: matchingOrders, error: matchError } = await matchQuery;

  if (matchError) {
    console.error('Match query error:', matchError);
  }

  let remainingQuantity = quantity;
  let totalFillValue = 0;
  let filledQuantity = 0;
  const trades: any[] = [];

  // Match with existing orders first (includes pool-backed limit orders from other users)
  for (const matchOrder of matchingOrders || []) {
    if (remainingQuantity <= 0) break;

    const availableQuantity = matchOrder.quantity - matchOrder.filled_quantity;
    const fillQuantity = Math.min(remainingQuantity, availableQuantity);
    
    const tradePrice = order_type === 'market' 
      ? matchOrder.price 
      : (price + (1 - matchOrder.price)) / 2;

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        market_id,
        buy_order_id: side === 'yes' ? id : matchOrder.id,
        sell_order_id: side === 'yes' ? matchOrder.id : id,
        price: tradePrice,
        quantity: fillQuantity,
        buyer_id: side === 'yes' ? user_id : matchOrder.user_id,
        seller_id: side === 'yes' ? matchOrder.user_id : user_id,
        buyer_side: 'yes'
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Trade creation error:', tradeError);
      continue;
    }

    trades.push(trade);

    const newMatchedFilled = matchOrder.filled_quantity + fillQuantity;
    const matchedStatus = newMatchedFilled >= matchOrder.quantity ? 'filled' : 'partial';
    
    await supabase
      .from('orders')
      .update({ 
        filled_quantity: newMatchedFilled, 
        status: matchedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchOrder.id);

    // Create positions for both parties
    await createPosition(supabase, user_id, market_id, side, fillQuantity, tradePrice);
    await createPosition(supabase, matchOrder.user_id, market_id, oppositeSide, fillQuantity, 1 - tradePrice);

    // Process payments
    const userCost = fillQuantity * tradePrice;
    const matchUserCost = fillQuantity * (1 - tradePrice);
    const tradeValue = fillQuantity;
    
    const platformFeeAmount = (tradeValue * effectivePlatformFee) / 100;
    const creatorFeeAmount = (tradeValue * effectiveCreatorFee) / 100;
    
    const userFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;
    const matchUserFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;

    await supabase.rpc('process_wallet_operation', {
      _user_id: user_id,
      _operation: 'withdrawal',
      _amount: userCost + userFeeShare,
      _metadata: { type: 'trade', order_id: id, trade_id: trade.id, fee_paid: userFeeShare }
    });

    await supabase.rpc('process_wallet_operation', {
      _user_id: matchOrder.user_id,
      _operation: 'withdrawal',
      _amount: matchUserCost + matchUserFeeShare,
      _metadata: { type: 'trade', order_id: matchOrder.id, trade_id: trade.id, fee_paid: matchUserFeeShare }
    });

    if (creatorFeeAmount > 0 && creatorId && !creatorIsAdmin) {
      await supabase.rpc('process_wallet_operation', {
        _user_id: creatorId,
        _operation: 'deposit',
        _amount: creatorFeeAmount,
        _metadata: { type: 'creator_fee', market_id, trade_id: trade.id }
      });
    }

    // Update volume
    const { data: currentMarket } = await supabase
      .from('markets')
      .select('volume')
      .eq('id', market_id)
      .single();
    
    await supabase
      .from('markets')
      .update({ 
        volume: (currentMarket?.volume || 0) + fillQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', market_id);

    remainingQuantity -= fillQuantity;
    filledQuantity += fillQuantity;
    totalFillValue += fillQuantity * tradePrice;
    
    console.log(`Matched with real order: ${fillQuantity} shares @ ${tradePrice.toFixed(4)}`);
  }

  // If remaining and pool enabled, use hybrid pool fill
  if (remainingQuantity > 0 && market.liquidity_pool > 0 && market.pool_enabled === true) {
    console.log(`Filling ${remainingQuantity} from pool. Pool: YES=${market.pool_yes_shares}, NO=${market.pool_no_shares}`);
    
    const poolResult = await fillFromPoolHybrid(
      supabase, 
      market_id, 
      user_id, 
      id, 
      side, 
      remainingQuantity, 
      market,
      effectivePlatformFee,
      effectiveCreatorFee,
      creatorId,
      creatorIsAdmin
    );
    
    if (poolResult.filled > 0) {
      filledQuantity += poolResult.filled;
      totalFillValue += poolResult.filled * poolResult.avgPrice;
      remainingQuantity -= poolResult.filled;
      
      if (poolResult.trade) {
        trades.push(poolResult.trade);
      }
    }
  }

  // Update order status
  let finalStatus: string;
  if (filledQuantity >= quantity) {
    finalStatus = 'filled';
  } else if (filledQuantity > 0) {
    finalStatus = 'partial';
  } else if (order_type === 'limit') {
    finalStatus = 'pending';
  } else {
    finalStatus = 'cancelled';
  }

  await supabase
    .from('orders')
    .update({ 
      filled_quantity: filledQuantity,
      avg_fill_price: filledQuantity > 0 ? totalFillValue / filledQuantity : null,
      status: finalStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  return {
    filledQuantity,
    avgFillPrice: filledQuantity > 0 ? totalFillValue / filledQuantity : null,
    trades,
    finalStatus
  };
}

/**
 * Hybrid Pool Fill with Order Book Integration
 * 
 * 1. Instantly fills user's order from pool at current price
 * 2. Creates a limit order on opposite side for counterparty matching
 * 3. When someone takes opposite side, they match with this order
 * 4. Pool exposure tracked until matched
 */
async function fillFromPoolHybrid(
  supabase: any,
  marketId: string,
  userId: string,
  orderId: string,
  side: 'yes' | 'no',
  quantity: number,
  market: any,
  platformFeePercent: number,
  creatorFeePercent: number,
  creatorId: string | null,
  creatorIsAdmin: boolean
) {
  // Use current market price for instant fill
  const currentPrice = side === 'yes' ? Number(market.yes_price) : Number(market.no_price);
  const oppositeSide = side === 'yes' ? 'no' : 'yes';
  
  // Calculate cost
  const cost = quantity * currentPrice;
  const avgPrice = currentPrice;
  
  console.log(`Hybrid pool fill: ${side} ${quantity} @ ${avgPrice.toFixed(4)}`);
  
  // Calculate fees
  const totalFeePercent = platformFeePercent + creatorFeePercent;
  const feeAmount = (cost * totalFeePercent) / 100;
  const totalCost = cost + feeAmount;
  
  // Deduct from user
  const { error: walletError } = await supabase.rpc('process_wallet_operation', {
    _user_id: userId,
    _operation: 'withdrawal',
    _amount: Math.round(totalCost * 100) / 100,
    _metadata: { 
      type: 'pool_trade', 
      order_id: orderId, 
      side,
      shares: quantity,
      price: avgPrice,
      fee: feeAmount,
      pool_backed: true
    }
  });
  
  if (walletError) {
    console.error('Wallet error:', walletError);
    return { filled: 0, avgPrice: 0, trade: null };
  }
  
  // Creator fee
  if (creatorFeePercent > 0 && creatorId && !creatorIsAdmin) {
    const creatorFee = (cost * creatorFeePercent) / 100;
    await supabase.rpc('process_wallet_operation', {
      _user_id: creatorId,
      _operation: 'deposit',
      _amount: Math.round(creatorFee * 100) / 100,
      _metadata: { type: 'creator_fee', market_id: marketId }
    });
  }
  
  // Update pool with CPMM
  let poolYes = Number(market.pool_yes_shares);
  let poolNo = Number(market.pool_no_shares);
  const k = poolYes * poolNo;
  
  let newPoolYes: number;
  let newPoolNo: number;
  
  if (side === 'yes') {
    const maxSharesOut = poolYes * 0.9;
    const sharesOut = Math.min(quantity, maxSharesOut);
    newPoolYes = poolYes - sharesOut;
    newPoolNo = k / newPoolYes;
  } else {
    const maxSharesOut = poolNo * 0.9;
    const sharesOut = Math.min(quantity, maxSharesOut);
    newPoolNo = poolNo - sharesOut;
    newPoolYes = k / newPoolNo;
  }
  
  // New prices from pool ratio
  const newYesPrice = newPoolNo / (newPoolYes + newPoolNo);
  const newNoPrice = newPoolYes / (newPoolYes + newPoolNo);
  
  const { data: currentMarket } = await supabase
    .from('markets')
    .select('volume')
    .eq('id', marketId)
    .single();
  
  await supabase
    .from('markets')
    .update({
      pool_yes_shares: newPoolYes,
      pool_no_shares: newPoolNo,
      yes_price: Math.max(0.01, Math.min(0.99, newYesPrice)),
      no_price: Math.max(0.01, Math.min(0.99, newNoPrice)),
      volume: (currentMarket?.volume || 0) + quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', marketId);
  
  // Create position for user
  await createPosition(supabase, userId, marketId, side, quantity, avgPrice);
  
  // Create trade record
  const { data: trade } = await supabase
    .from('trades')
    .insert({
      market_id: marketId,
      buy_order_id: orderId,
      sell_order_id: orderId,
      price: avgPrice,
      quantity: quantity,
      buyer_id: userId,
      seller_id: userId,
      buyer_side: side
    })
    .select()
    .single();
  
  // KEY: Create opposite limit order for counterparty matching
  // This order sits in book waiting for someone to take opposite side
  const oppositePrice = Math.round((1 - avgPrice) * 100) / 100;
  
  const { data: poolBackedOrder, error: poolOrderError } = await supabase
    .from('orders')
    .insert({
      market_id: marketId,
      user_id: userId,
      side: oppositeSide,
      order_type: 'limit',
      price: oppositePrice,
      quantity: quantity,
      status: 'pending'
    })
    .select()
    .single();
  
  if (poolOrderError) {
    console.error('Pool-backed order error:', poolOrderError);
  } else {
    console.log(`Pool-backed order created: ${oppositeSide} ${quantity} @ ${oppositePrice} (ID: ${poolBackedOrder.id})`);
  }
  
  console.log(`Pool fill done. New prices: YES=${newYesPrice.toFixed(4)}, NO=${newNoPrice.toFixed(4)}`);
  
  return { filled: quantity, avgPrice, trade };
}

async function createPosition(supabase: any, userId: string, marketId: string, side: string, size: number, entryPrice: number) {
  const { data: existing } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .eq('market_id', marketId)
    .eq('side', side)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    const newSize = existing.size + size;
    const newAvgPrice = (existing.size * existing.entry_price + size * entryPrice) / newSize;
    
    await supabase
      .from('positions')
      .update({ 
        size: newSize, 
        entry_price: newAvgPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('positions')
      .insert({
        user_id: userId,
        market_id: marketId,
        side,
        size,
        entry_price: entryPrice,
        status: 'open'
      });
  }
}

async function updateMarketPrices(supabase: any, marketId: string) {
  const { data: market } = await supabase
    .from('markets')
    .select('pool_yes_shares, pool_no_shares')
    .eq('id', marketId)
    .single();

  if (market) {
    const poolYes = Number(market.pool_yes_shares);
    const poolNo = Number(market.pool_no_shares);
    const total = poolYes + poolNo;
    
    const yesPrice = poolNo / total;
    const noPrice = poolYes / total;
    
    await supabase
      .from('markets')
      .update({
        yes_price: Math.max(0.01, Math.min(0.99, yesPrice)),
        no_price: Math.max(0.01, Math.min(0.99, noPrice)),
        updated_at: new Date().toISOString()
      })
      .eq('id', marketId);
  }
}

async function cancelOrder(supabase: any, userId: string, request: { orderId: string }) {
  const { orderId } = request;

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !order) {
    return new Response(JSON.stringify({ error: 'Order not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (order.status === 'filled' || order.status === 'cancelled') {
    return new Response(JSON.stringify({ error: 'Order already completed or cancelled' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  await updateMarketPrices(supabase, order.market_id);

  return new Response(JSON.stringify({ success: true, orderId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getUserPosition(supabase: any, userId: string, marketId: string | null) {
  if (!marketId) {
    return new Response(JSON.stringify({ error: 'Market ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .eq('market_id', marketId)
    .eq('status', 'open');

  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('market_id', marketId)
    .in('status', ['pending', 'partial']);

  return new Response(JSON.stringify({
    positions: positions || [],
    pendingOrders: pendingOrders || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getMarketDepth(supabase: any, marketId: string | null) {
  if (!marketId) {
    return new Response(JSON.stringify({ error: 'Market ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: yesOrders } = await supabase
    .from('orders')
    .select('price, quantity, filled_quantity')
    .eq('market_id', marketId)
    .eq('side', 'yes')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false });

  const { data: noOrders } = await supabase
    .from('orders')
    .select('price, quantity, filled_quantity')
    .eq('market_id', marketId)
    .eq('side', 'no')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false });

  const aggregateOrders = (orders: any[]) => {
    const levels: Record<number, number> = {};
    for (const order of orders || []) {
      const remaining = order.quantity - order.filled_quantity;
      if (remaining > 0 && order.price) {
        levels[order.price] = (levels[order.price] || 0) + remaining;
      }
    }
    return Object.entries(levels)
      .map(([price, quantity]) => ({ price: parseFloat(price), quantity }))
      .sort((a, b) => b.price - a.price);
  };

  const { data: market } = await supabase
    .from('markets')
    .select('pool_yes_shares, pool_no_shares, yes_price, no_price')
    .eq('id', marketId)
    .single();

  // Calculate total pool exposure (unmatched pool-backed orders)
  const yesDepth = aggregateOrders(yesOrders);
  const noDepth = aggregateOrders(noOrders);
  const totalYesLiquidity = yesDepth.reduce((sum, l) => sum + l.quantity, 0);
  const totalNoLiquidity = noDepth.reduce((sum, l) => sum + l.quantity, 0);

  return new Response(JSON.stringify({
    yes: yesDepth,
    no: noDepth,
    pool: market ? {
      yesShares: market.pool_yes_shares,
      noShares: market.pool_no_shares,
      yesPrice: market.yes_price,
      noPrice: market.no_price
    } : null,
    liquidity: {
      yes: totalYesLiquidity,
      no: totalNoLiquidity
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
