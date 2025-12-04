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
  price?: number; // Required for limit orders
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
    const action = url.pathname.split('/').pop();

    if (action === 'place' && req.method === 'POST') {
      return await placeOrder(supabase, user.id, await req.json());
    } else if (action === 'cancel' && req.method === 'POST') {
      return await cancelOrder(supabase, user.id, await req.json());
    } else if (action === 'depth' && req.method === 'GET') {
      const marketId = url.searchParams.get('marketId');
      return await getMarketDepth(supabase, marketId);
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

  // Validate inputs
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

  // Calculate max cost (for limit orders, use limit price; for market, estimate)
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

  // Update market best prices
  await updateMarketPrices(supabase, marketId);

  return new Response(JSON.stringify({
    success: true,
    order: {
      id: order.id,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      filledQuantity: matchResult.filledQuantity,
      avgFillPrice: matchResult.avgFillPrice,
      trades: matchResult.trades
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function matchOrder(supabase: any, order: any) {
  const { id, market_id, user_id, side, order_type, price, quantity } = order;
  
  // Get market info for fee calculation
  const { data: market } = await supabase
    .from('markets')
    .select('created_by, platform_fee_percent, creator_fee_percent')
    .eq('id', market_id)
    .single();

  const platformFeePercent = market?.platform_fee_percent || 3;
  const creatorFeePercent = market?.creator_fee_percent || 0;
  const creatorId = market?.created_by;

  // Check if creator is an admin (admins don't get creator fees)
  let creatorIsAdmin = false;
  if (creatorId) {
    const { data: creatorRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', creatorId);
    creatorIsAdmin = creatorRoles?.some((r: any) => r.role === 'admin') || false;
  }

  // Calculate effective fees
  // If creator is admin: all fees go to platform
  // If creator is regular creator: platform gets 1%, creator gets 2%
  const effectivePlatformFee = creatorIsAdmin ? platformFeePercent : 1;
  const effectiveCreatorFee = creatorIsAdmin ? 0 : Math.min(creatorFeePercent, 2);
  
  // Find matching orders on the opposite side
  // YES buy matches with NO buy (they complement each other to $1)
  const oppositeSide = side === 'yes' ? 'no' : 'yes';
  
  // For limit orders: match if opposite price >= (1 - our price)
  // For market orders: match any available
  let matchQuery = supabase
    .from('orders')
    .select('*')
    .eq('market_id', market_id)
    .eq('side', oppositeSide)
    .in('status', ['pending', 'partial'])
    .neq('user_id', user_id); // Can't match with self

  if (order_type === 'limit') {
    // Opposite side price must be >= (1 - our price) for a valid match
    const minOppositePrice = 1 - price;
    matchQuery = matchQuery.gte('price', minOppositePrice);
  }

  // Order by best price first (highest for opposite side), then by time
  matchQuery = matchQuery.order('price', { ascending: false }).order('created_at', { ascending: true });

  const { data: matchingOrders, error: matchError } = await matchQuery;

  if (matchError) {
    console.error('Match query error:', matchError);
    return { filledQuantity: 0, avgFillPrice: null, trades: [] };
  }

  let remainingQuantity = quantity;
  let totalFillValue = 0;
  let filledQuantity = 0;
  const trades: any[] = [];

  for (const matchOrder of matchingOrders || []) {
    if (remainingQuantity <= 0) break;

    const availableQuantity = matchOrder.quantity - matchOrder.filled_quantity;
    const fillQuantity = Math.min(remainingQuantity, availableQuantity);
    
    // Trade price is the average of both orders' prices (or match order's price for market orders)
    const tradePrice = order_type === 'market' 
      ? matchOrder.price 
      : (price + (1 - matchOrder.price)) / 2;

    // Execute the trade
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

    // Create positions for both parties
    await createPosition(supabase, user_id, market_id, side, fillQuantity, tradePrice);
    await createPosition(supabase, matchOrder.user_id, market_id, oppositeSide, fillQuantity, 1 - tradePrice);

    // Calculate costs and fees
    const userCost = fillQuantity * tradePrice;
    const matchUserCost = fillQuantity * (1 - tradePrice);
    const tradeValue = fillQuantity; // Total trade value for fee calculation
    
    // Calculate fees based on trade value
    const platformFeeAmount = (tradeValue * effectivePlatformFee) / 100;
    const creatorFeeAmount = (tradeValue * effectiveCreatorFee) / 100;
    
    console.log(`Trade fees - Platform: $${platformFeeAmount.toFixed(4)}, Creator: $${creatorFeeAmount.toFixed(4)}`);

    // Deduct costs from both users (including their share of fees)
    const userFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;
    const matchUserFeeShare = (platformFeeAmount + creatorFeeAmount) / 2;

    await supabase.rpc('process_wallet_operation', {
      _user_id: user_id,
      _operation: 'withdrawal',
      _amount: userCost + userFeeShare,
      _metadata: { 
        type: 'trade', 
        order_id: id, 
        trade_id: trade.id,
        fee_paid: userFeeShare
      }
    });

    await supabase.rpc('process_wallet_operation', {
      _user_id: matchOrder.user_id,
      _operation: 'withdrawal',
      _amount: matchUserCost + matchUserFeeShare,
      _metadata: { 
        type: 'trade', 
        order_id: matchOrder.id, 
        trade_id: trade.id,
        fee_paid: matchUserFeeShare
      }
    });

    // Credit creator fee to creator (if not admin)
    if (creatorFeeAmount > 0 && creatorId && !creatorIsAdmin) {
      await supabase.rpc('process_wallet_operation', {
        _user_id: creatorId,
        _operation: 'deposit',
        _amount: creatorFeeAmount,
        _metadata: { 
          type: 'creator_fee', 
          market_id, 
          trade_id: trade.id 
        }
      });
      console.log(`Credited $${creatorFeeAmount.toFixed(4)} creator fee to ${creatorId}`);
    }

    // Update market volume
    await supabase
      .from('markets')
      .update({ 
        volume: supabase.sql`volume + ${fillQuantity}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', market_id);

    remainingQuantity -= fillQuantity;
    filledQuantity += fillQuantity;
    totalFillValue += fillQuantity * tradePrice;
  }

  // Update original order status
  const newStatus = filledQuantity >= quantity ? 'filled' 
    : filledQuantity > 0 ? 'partial' 
    : order_type === 'limit' ? 'pending' : 'cancelled';

  await supabase
    .from('orders')
    .update({ 
      filled_quantity: filledQuantity,
      avg_fill_price: filledQuantity > 0 ? totalFillValue / filledQuantity : null,
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  // For market orders that didn't fully fill, cancel remaining
  if (order_type === 'market' && filledQuantity < quantity) {
    await supabase
      .from('orders')
      .update({ status: filledQuantity > 0 ? 'partial' : 'cancelled' })
      .eq('id', id);
  }

  return {
    filledQuantity,
    avgFillPrice: filledQuantity > 0 ? totalFillValue / filledQuantity : null,
    trades
  };
}

async function createPosition(supabase: any, userId: string, marketId: string, side: string, size: number, entryPrice: number) {
  // Check if user already has a position
  const { data: existing } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .eq('market_id', marketId)
    .eq('side', side)
    .eq('status', 'open')
    .single();

  if (existing) {
    // Update existing position with weighted average price
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
    // Create new position
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
  // Get best YES bid
  const { data: yesBids } = await supabase
    .from('orders')
    .select('price')
    .eq('market_id', marketId)
    .eq('side', 'yes')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false })
    .limit(1);

  // Get best NO bid  
  const { data: noBids } = await supabase
    .from('orders')
    .select('price')
    .eq('market_id', marketId)
    .eq('side', 'no')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false })
    .limit(1);

  const bestYesBid = yesBids?.[0]?.price || 0.5;
  const bestNoBid = noBids?.[0]?.price || 0.5;

  // Market price is midpoint of best bids converted to probability
  const yesPrice = bestYesBid > 0 ? bestYesBid : (1 - bestNoBid);

  await supabase
    .from('markets')
    .update({
      yes_price: Math.max(0.01, Math.min(0.99, yesPrice)),
      no_price: Math.max(0.01, Math.min(0.99, 1 - yesPrice)),
      updated_at: new Date().toISOString()
    })
    .eq('id', marketId);
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

  // Update market prices
  await updateMarketPrices(supabase, order.market_id);

  return new Response(JSON.stringify({ success: true, orderId }), {
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

  // Get YES orders
  const { data: yesOrders } = await supabase
    .from('orders')
    .select('price, quantity, filled_quantity')
    .eq('market_id', marketId)
    .eq('side', 'yes')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false });

  // Get NO orders
  const { data: noOrders } = await supabase
    .from('orders')
    .select('price, quantity, filled_quantity')
    .eq('market_id', marketId)
    .eq('side', 'no')
    .in('status', ['pending', 'partial'])
    .order('price', { ascending: false });

  // Aggregate by price level
  const aggregateOrders = (orders: any[]) => {
    const levels: Record<string, number> = {};
    for (const order of orders || []) {
      const remaining = order.quantity - order.filled_quantity;
      const priceKey = order.price.toFixed(2);
      levels[priceKey] = (levels[priceKey] || 0) + remaining;
    }
    return Object.entries(levels)
      .map(([price, quantity]) => ({ price: parseFloat(price), quantity }))
      .sort((a, b) => b.price - a.price);
  };

  return new Response(JSON.stringify({
    yes: aggregateOrders(yesOrders || []),
    no: aggregateOrders(noOrders || [])
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
