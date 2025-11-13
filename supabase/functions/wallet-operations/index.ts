import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WalletOperationRequest {
  operation: 'deposit' | 'withdrawal';
  amount: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for bypassing RLS
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log(`Processing wallet operation for user ${user.id}`);

    // Parse request body
    const { operation, amount }: WalletOperationRequest = await req.json();

    // Input validation
    if (!operation || !['deposit', 'withdrawal'].includes(operation)) {
      throw new Error('Invalid operation. Must be "deposit" or "withdrawal"');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount. Must be a positive number');
    }

    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum limit of 1,000,000 credits');
    }

    // Round to 2 decimal places to prevent floating point issues
    const sanitizedAmount = Math.round(amount * 100) / 100;

    // Check rate limit first (10 operations per hour)
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseAdmin
      .rpc('check_rate_limit', {
        _user_id: user.id,
        _operation_type: operation,
        _max_attempts: 10,
        _window_minutes: 60
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      throw new Error('Failed to check rate limit');
    }

    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      const resetTime = new Date(rateLimitCheck.reset_at).toLocaleTimeString();
      throw new Error(`Rate limit exceeded. You can make ${rateLimitCheck.attempts_remaining} more ${operation}s. Limit resets at ${resetTime}.`);
    }

    console.log(`Rate limit check passed. Attempts remaining: ${rateLimitCheck.attempts_remaining}`);

    // Process wallet operation atomically using database function
    const { data: result, error: operationError } = await supabaseAdmin
      .rpc('process_wallet_operation', {
        _user_id: user.id,
        _operation: operation,
        _amount: sanitizedAmount,
        _metadata: {
          timestamp: new Date().toISOString(),
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        }
      });

    if (operationError) {
      console.error('Wallet operation error:', operationError);
      throw new Error(operationError.message || 'Failed to process wallet operation');
    }

    console.log(`${operation} completed successfully. Transaction ID: ${result.transaction_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        amount: sanitizedAmount,
        newBalance: result.balance_after,
        previousBalance: result.balance_before,
        transactionId: result.transaction_id,
        attemptsRemaining: rateLimitCheck.attempts_remaining,
        message: `${operation === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${sanitizedAmount} credits successful`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Wallet operation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 400,
      }
    );
  }
});
