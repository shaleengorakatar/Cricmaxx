import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueProcessorRequest {
  action: 'process' | 'enqueue' | 'status' | 'cleanup';
  batchSize?: number;
  orderData?: {
    marketId: string;
    orderType: string;
    side: string;
    price: number;
    quantity: number;
    priority?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check for auth (optional for scheduled jobs)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { action, batchSize = 10, orderData }: QueueProcessorRequest = await req.json();

    switch (action) {
      case 'enqueue': {
        if (!userId) {
          throw new Error('Authentication required to enqueue orders');
        }
        
        if (!orderData) {
          throw new Error('orderData required for enqueue action');
        }

        // Insert order into queue
        const { data: queuedOrder, error } = await supabaseAdmin
          .from('order_queue')
          .insert({
            user_id: userId,
            market_id: orderData.marketId,
            order_type: orderData.orderType,
            side: orderData.side,
            price: orderData.price,
            quantity: orderData.quantity,
            priority: orderData.priority || 0,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`Order queued: ${queuedOrder.id}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Order queued for processing',
            queueId: queuedOrder.id,
            estimatedProcessingTime: '< 1 second'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process': {
        // Call the database function to process queue
        const { data: result, error } = await supabaseAdmin
          .rpc('process_order_queue', { batch_size: batchSize });

        if (error) throw error;

        console.log(`Queue processed: ${JSON.stringify(result)}`);

        return new Response(
          JSON.stringify({
            success: true,
            ...result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        // Get queue status
        const { data: pendingCount } = await supabaseAdmin
          .from('order_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { data: processingCount } = await supabaseAdmin
          .from('order_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'processing');

        const { data: recentFailed } = await supabaseAdmin
          .from('order_queue')
          .select('id, error_message, created_at')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(5);

        return new Response(
          JSON.stringify({
            success: true,
            status: {
              pending: pendingCount || 0,
              processing: processingCount || 0,
              recentFailures: recentFailed || []
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cleanup': {
        // Call cleanup function
        const { data: result, error } = await supabaseAdmin
          .rpc('cleanup_expired_records');

        if (error) throw error;

        // Also clean old completed/failed queue items (older than 24 hours)
        const { error: queueCleanupError } = await supabaseAdmin
          .from('order_queue')
          .delete()
          .in('status', ['completed', 'failed'])
          .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (queueCleanupError) {
          console.error('Queue cleanup error:', queueCleanupError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            ...result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Queue processor error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
