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
    } else if (action === 'sell' && req.method === 'POST') {
      return await sellPosition(supabase, user.id, body);
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

  // CRITICAL: Reserve funds upfront for limit orders
  // This prevents users from placing more orders than they can afford
  if (orderType === 'limit') {
    const reserveAmount = quantity * price!;
    const { error: reserveError } = await supabase.rpc('process_wallet_operation', {
      _user_id: userId,
      _operation: 'withdrawal',
      _amount: reserveAmount,
      _metadata: { 
        type: 'order_reserve', 
        order_type: 'limit',
        side,
        quantity,
        price,
        reserved: true
      }
    });

    if (reserveError) {
      console.error('Failed to reserve funds:', reserveError);
      return new Response(JSON.stringify({ error: 'Failed to reserve funds' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`Reserved $${reserveAmount.toFixed(2)} for limit order`);
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
    // If order creation fails after reserving, refund the reserved amount
    if (orderType === 'limit') {
      await supabase.rpc('process_wallet_operation', {
        _user_id: userId,
        _operation: 'deposit',
        _amount: quantity * price!,
        _metadata: { type: 'order_reserve_refund', reason: 'order_creation_failed' }
      });
    }
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
  
  // Kalshi-style matching: 
  // A YES order at price X can match with:
  //   1. NO orders at price >= (1-X) - they want NO, you provide it by taking YES
  //   2. YES orders at price <= (1-X) from the opposite perspective - complementary matching
  // 
  // Key insight: In prediction markets, YES at X = offering NO at (1-X)
  // So a YES bid at $0.20 matches with NO bids at $0.80+ 
  // (because NO bid at $0.80 = willing to pay $0.80 for NO = implies YES at $0.20)
  
  // Look for matching orders on OPPOSITE side (traditional matching)
  let oppositeMatchQuery = supabase
    .from('orders')
    .select('*')
    .eq('market_id', market_id)
    .eq('side', oppositeSide)
    .in('status', ['pending', 'partial'])
    .neq('user_id', user_id);

  if (order_type === 'limit') {
    // For a YES order at price X, match NO orders where their price >= (1-X)
    // Because NO order at P means they're willing to pay P for NO
    // Which means they're offering YES at (1-P)
    // We want YES at X, so we need (1-P) <= X, meaning P >= (1-X)
    const minOppositePrice = 1 - price;
    oppositeMatchQuery = oppositeMatchQuery.gte('price', minOppositePrice);
  }

  oppositeMatchQuery = oppositeMatchQuery.order('price', { ascending: false }).order('created_at', { ascending: true });

  const { data: oppositeOrders, error: oppositeError } = await oppositeMatchQuery;

  if (oppositeError) {
    console.error('Opposite match query error:', oppositeError);
  }
  
  // Combine all matching orders
  // Transform opposite-side orders to have a virtual "from_opposite_side" flag
  const matchingOrders = (oppositeOrders || []).map((o: any) => ({
    ...o,
    from_opposite_side: true,
    // The effective YES price this order represents
    effective_yes_price: o.side === 'no' ? (1 - o.price) : o.price
  }));
  
  // Sort by best price for the current order (lowest effective price for YES buyer)
  matchingOrders.sort((a: any, b: any) => {
    // For a YES buyer, we want lowest effective_yes_price first
    // For a NO buyer, we want highest effective_yes_price first (which = lowest NO price)
    if (side === 'yes') {
      return a.effective_yes_price - b.effective_yes_price;
    } else {
      return b.effective_yes_price - a.effective_yes_price;
    }
  });

  console.log(`Found ${matchingOrders.length} matching orders for ${side} @ ${price || 'market'}`);
  matchingOrders.forEach((o: any) => {
    console.log(`  - ${o.side} order @ ${o.price} (effective YES: ${o.effective_yes_price})`);
  });

  let remainingQuantity = quantity;
  let totalFillValue = 0;
  let filledQuantity = 0;
  const trades: any[] = [];

  // Match with existing orders (now includes complementary matching)
  for (const matchOrder of matchingOrders || []) {
    if (remainingQuantity <= 0) break;

    const availableQuantity = matchOrder.quantity - matchOrder.filled_quantity;
    const fillQuantity = Math.min(remainingQuantity, availableQuantity);
    
    // Calculate trade price (always from YES perspective for consistency)
    // The effective_yes_price tells us what YES price this order represents
    let tradePrice: number;
    if (order_type === 'market') {
      // Market order takes whatever price is available
      tradePrice = matchOrder.effective_yes_price;
    } else {
      // Limit order: trade at the match order's effective price (price improvement for taker)
      // In Kalshi, the resting order's price is honored
      tradePrice = matchOrder.effective_yes_price;
    }
    
    // Determine who is buying YES and who is buying NO
    // Current user: buying 'side'
    // Match user: originally placed order for matchOrder.side
    const currentUserBuysYes = side === 'yes';
    const matchUserBuysYes = matchOrder.side === 'yes';
    
    // In a complementary match, both might have placed YES orders (or both NO)
    // One becomes the YES holder, one becomes the NO holder
    const yesBuyerId = currentUserBuysYes ? user_id : matchOrder.user_id;
    const noBuyerId = currentUserBuysYes ? matchOrder.user_id : user_id;

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        market_id,
        buy_order_id: currentUserBuysYes ? id : matchOrder.id,
        sell_order_id: currentUserBuysYes ? matchOrder.id : id,
        price: tradePrice,
        quantity: fillQuantity,
        buyer_id: yesBuyerId,
        seller_id: noBuyerId,
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

    // Create positions for both parties based on what they're actually getting
    // Current user gets 'side', match user gets opposite of what current user gets
    const matchUserActualSide = side === 'yes' ? 'no' : 'yes';
    const currentUserPrice = side === 'yes' ? tradePrice : (1 - tradePrice);
    const matchUserPrice = side === 'yes' ? (1 - tradePrice) : tradePrice;
    
    await createPosition(supabase, user_id, market_id, side, fillQuantity, currentUserPrice);
    await createPosition(supabase, matchOrder.user_id, market_id, matchUserActualSide, fillQuantity, matchUserPrice);
    
    console.log(`Trade executed: ${side} ${fillQuantity} @ ${tradePrice.toFixed(4)} (YES price)`);

    // Process payments
    // For limit orders: funds are already reserved at order.price, so we only charge fees
    // and refund/charge any difference between reserved price and actual trade price
    const userCost = fillQuantity * tradePrice;
    const matchUserCost = fillQuantity * (1 - tradePrice);
    const tradeValue = fillQuantity;
    
    const platformFeeAmount = (tradeValue * effectivePlatformFee) / 100;
    const creatorFeeAmount = (tradeValue * effectiveCreatorFee) / 100;
    
    const userFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;
    const matchUserFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;

    // Current order: if limit order, funds already reserved at 'price'
    // Only charge the fee (cost was already reserved)
    if (order_type === 'limit' && price) {
      const reservedAmount = fillQuantity * price;
      const actualNeeded = userCost + userFeeShare;
      const difference = actualNeeded - reservedAmount;
      
      if (difference > 0) {
        // Need to charge more (trade happened at worse price)
        await supabase.rpc('process_wallet_operation', {
          _user_id: user_id,
          _operation: 'withdrawal',
          _amount: difference,
          _metadata: { type: 'trade_adjustment', order_id: id, trade_id: trade.id, fee_paid: userFeeShare }
        });
      } else if (difference < 0) {
        // Refund excess (trade happened at better price)
        await supabase.rpc('process_wallet_operation', {
          _user_id: user_id,
          _operation: 'deposit',
          _amount: Math.abs(difference),
          _metadata: { type: 'trade_refund', order_id: id, trade_id: trade.id, better_price: true }
        });
      }
      // If difference === 0, no additional action needed
    } else {
      // Market order: charge full amount
      await supabase.rpc('process_wallet_operation', {
        _user_id: user_id,
        _operation: 'withdrawal',
        _amount: userCost + userFeeShare,
        _metadata: { type: 'trade', order_id: id, trade_id: trade.id, fee_paid: userFeeShare }
      });
    }

    // Matched order: also has funds reserved (it's always a limit order in the book)
    if (matchOrder.price) {
      const matchReservedAmount = fillQuantity * matchOrder.price;
      const matchActualNeeded = matchUserCost + matchUserFeeShare;
      const matchDifference = matchActualNeeded - matchReservedAmount;
      
      if (matchDifference > 0) {
        await supabase.rpc('process_wallet_operation', {
          _user_id: matchOrder.user_id,
          _operation: 'withdrawal',
          _amount: matchDifference,
          _metadata: { type: 'trade_adjustment', order_id: matchOrder.id, trade_id: trade.id, fee_paid: matchUserFeeShare }
        });
      } else if (matchDifference < 0) {
        await supabase.rpc('process_wallet_operation', {
          _user_id: matchOrder.user_id,
          _operation: 'deposit',
          _amount: Math.abs(matchDifference),
          _metadata: { type: 'trade_refund', order_id: matchOrder.id, trade_id: trade.id, better_price: true }
        });
      }
    } else {
      // Fallback for any market orders in the book (shouldn't happen)
      await supabase.rpc('process_wallet_operation', {
        _user_id: matchOrder.user_id,
        _operation: 'withdrawal',
        _amount: matchUserCost + matchUserFeeShare,
        _metadata: { type: 'trade', order_id: matchOrder.id, trade_id: trade.id, fee_paid: matchUserFeeShare }
      });
    }

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
  // Kalshi-style pricing: use last trade price, or best bid/ask midpoint as fallback
  
  // 1. Try to get the last trade price
  const { data: lastTrade } = await supabase
    .from('trades')
    .select('price, buyer_side')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let yesPrice: number | null = null;
  let noPrice: number | null = null;

  if (lastTrade) {
    // Last trade determines the price
    // If buyer_side is 'yes', the trade price IS the yes price
    // If buyer_side is 'no', we need to interpret differently
    // In our system, price is always from YES perspective
    yesPrice = Number(lastTrade.price);
    noPrice = 1 - yesPrice;
    console.log(`Price from last trade: YES=${yesPrice}, NO=${noPrice}`);
  } else {
    // 2. No trades yet - use best bid/ask midpoint
    const { data: bestYesBid } = await supabase
      .from('orders')
      .select('price')
      .eq('market_id', marketId)
      .eq('side', 'yes')
      .in('status', ['pending', 'partial'])
      .order('price', { ascending: false })
      .limit(1)
      .single();

    const { data: bestNoBid } = await supabase
      .from('orders')
      .select('price')
      .eq('market_id', marketId)
      .eq('side', 'no')
      .in('status', ['pending', 'partial'])
      .order('price', { ascending: false })
      .limit(1)
      .single();

    if (bestYesBid && bestNoBid) {
      // Midpoint between best YES bid and implied YES ask (1 - best NO bid)
      const bestYesBidPrice = Number(bestYesBid.price);
      const impliedYesAsk = 1 - Number(bestNoBid.price);
      yesPrice = (bestYesBidPrice + impliedYesAsk) / 2;
      noPrice = 1 - yesPrice;
      console.log(`Price from bid/ask midpoint: YES=${yesPrice}, NO=${noPrice}`);
    } else if (bestYesBid) {
      // Only YES bids exist
      yesPrice = Number(bestYesBid.price);
      noPrice = 1 - yesPrice;
      console.log(`Price from YES bid only: YES=${yesPrice}, NO=${noPrice}`);
    } else if (bestNoBid) {
      // Only NO bids exist
      noPrice = Number(bestNoBid.price);
      yesPrice = 1 - noPrice;
      console.log(`Price from NO bid only: YES=${yesPrice}, NO=${noPrice}`);
    } else {
      // 3. No trades, no orders - keep current price or default to 0.50
      console.log('No trades or orders - keeping current price');
      return; // Don't update if no market activity
    }
  }

  if (yesPrice !== null && noPrice !== null) {
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

  // Refund reserved funds for unfilled portion of limit orders
  if (order.order_type === 'limit' && order.price) {
    const unfilledQuantity = order.quantity - order.filled_quantity;
    if (unfilledQuantity > 0) {
      const refundAmount = unfilledQuantity * order.price;
      await supabase.rpc('process_wallet_operation', {
        _user_id: userId,
        _operation: 'deposit',
        _amount: refundAmount,
        _metadata: { 
          type: 'order_cancel_refund', 
          order_id: orderId,
          unfilled_quantity: unfilledQuantity,
          price: order.price
        }
      });
      console.log(`Refunded $${refundAmount.toFixed(2)} for cancelled order`);
    }
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

// Sell position - close out an existing position by selling contracts
async function sellPosition(supabase: any, userId: string, request: { marketId: string; side: 'yes' | 'no'; quantity: number; minPrice?: number }) {
  const { marketId, side, quantity, minPrice } = request;

  if (!marketId || !side || !quantity || quantity <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid sell parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get user's position in this market
  const { data: positions, error: posError } = await supabase
    .from('positions')
    .select('*')
    .eq('market_id', marketId)
    .eq('user_id', userId)
    .eq('side', side)
    .eq('status', 'open');

  if (posError) {
    console.error('Position fetch error:', posError);
    return new Response(JSON.stringify({ error: 'Failed to fetch position' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const totalPositionSize = positions?.reduce((sum: number, p: any) => sum + p.size, 0) || 0;

  if (totalPositionSize < quantity) {
    return new Response(JSON.stringify({ 
      error: `Insufficient position. You have ${totalPositionSize} ${side.toUpperCase()} contracts, tried to sell ${quantity}` 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // To sell YES contracts, we need to find buyers for YES (i.e., NO orders that imply YES buying)
  // In Kalshi-style: NO order at price P = willing to buy NO at P = willing to sell YES at (1-P)
  // So to sell YES, look for NO orders where (1-P) >= minPrice (if specified)
  const oppositeSide = side === 'yes' ? 'no' : 'yes';
  
  let matchQuery = supabase
    .from('orders')
    .select('*')
    .eq('market_id', marketId)
    .eq('side', oppositeSide)
    .in('status', ['pending', 'partial'])
    .neq('user_id', userId);

  if (minPrice) {
    // For selling YES at minPrice, we need NO orders at (1 - minPrice) or higher
    // Because NO at P means they'll buy YES at (1-P)
    // We want (1-P) >= minPrice, so P <= (1 - minPrice)
    const maxOppositePrice = 1 - minPrice;
    matchQuery = matchQuery.lte('price', maxOppositePrice);
  }

  matchQuery = matchQuery.order('price', { ascending: true }).order('created_at', { ascending: true });

  const { data: matchingOrders, error: matchError } = await matchQuery;

  if (matchError) {
    console.error('Match query error:', matchError);
    return new Response(JSON.stringify({ error: 'Failed to find matching orders' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!matchingOrders || matchingOrders.length === 0) {
    return new Response(JSON.stringify({ 
      error: 'No buyers available at this price. Try placing a limit sell order instead.' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let remainingToSell = quantity;
  let totalProceeds = 0;
  let soldQuantity = 0;
  const trades: any[] = [];

  // Get market fees
  const { data: market } = await supabase
    .from('markets')
    .select('platform_fee_percent, creator_fee_percent, created_by')
    .eq('id', marketId)
    .single();

  const platformFeePercent = market?.platform_fee_percent || 3;
  const creatorFeePercent = market?.creator_fee_percent || 0;

  // Process matches
  for (const matchOrder of matchingOrders) {
    if (remainingToSell <= 0) break;

    const availableQuantity = matchOrder.quantity - matchOrder.filled_quantity;
    const fillQuantity = Math.min(remainingToSell, availableQuantity);
    
    // Calculate sale price (from the seller's perspective)
    // matchOrder.side is opposite (e.g., 'no' if we're selling 'yes')
    // NO order at price P means buyer gets YES at (1-P)
    const salePrice = 1 - matchOrder.price;

    // Create trade record
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        market_id: marketId,
        buy_order_id: matchOrder.id,
        sell_order_id: matchOrder.id, // Using same order for both since this is a direct sale
        price: salePrice,
        quantity: fillQuantity,
        buyer_id: matchOrder.user_id, // The order placer is now buying our contracts
        seller_id: userId, // We're the seller
        buyer_side: side // The buyer is getting our side
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Trade creation error:', tradeError);
      continue;
    }

    trades.push(trade);

    // Update matched order
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

    // The buyer gets the position
    await createPosition(supabase, matchOrder.user_id, marketId, side, fillQuantity, salePrice);

    // Calculate fees
    const grossProceeds = fillQuantity * salePrice;
    const feePercent = (platformFeePercent + creatorFeePercent) / 100;
    const fees = grossProceeds * feePercent;
    const netProceeds = grossProceeds - fees;

    // Pay the seller
    await supabase.rpc('process_wallet_operation', {
      _user_id: userId,
      _operation: 'deposit',
      _amount: netProceeds,
      _metadata: { 
        type: 'position_sale', 
        side, 
        quantity: fillQuantity, 
        price: salePrice,
        gross: grossProceeds,
        fees,
        trade_id: trade.id
      }
    });

    // The matched order already had funds reserved, just charge fees
    // The difference is handled by the order reserve system
    
    totalProceeds += netProceeds;
    soldQuantity += fillQuantity;
    remainingToSell -= fillQuantity;

    console.log(`Sold ${fillQuantity} ${side.toUpperCase()} @ ${salePrice.toFixed(4)} = $${netProceeds.toFixed(2)} net`);
  }

  // Reduce user's position
  let remainingToReduce = soldQuantity;
  for (const position of positions || []) {
    if (remainingToReduce <= 0) break;
    
    const reduceAmount = Math.min(remainingToReduce, position.size);
    const newSize = position.size - reduceAmount;
    
    if (newSize <= 0) {
      // Close the position entirely
      await supabase
        .from('positions')
        .update({ 
          size: 0, 
          status: 'closed',
          closed_at: new Date().toISOString(),
          pnl: totalProceeds - (position.entry_price * reduceAmount)
        })
        .eq('id', position.id);
    } else {
      // Reduce the position
      await supabase
        .from('positions')
        .update({ size: newSize })
        .eq('id', position.id);
    }
    
    remainingToReduce -= reduceAmount;
  }

  // Update market prices
  await updateMarketPrices(supabase, marketId);

  return new Response(JSON.stringify({
    success: true,
    sold: soldQuantity,
    totalProceeds,
    avgPrice: soldQuantity > 0 ? totalProceeds / soldQuantity : 0,
    remaining: quantity - soldQuantity,
    trades
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
