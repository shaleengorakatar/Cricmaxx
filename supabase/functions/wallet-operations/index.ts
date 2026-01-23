import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WalletOperationRequest {
  operation: 'deposit' | 'withdrawal';
  amount: number;
  idempotencyKey?: string;
  expectedVersion?: number;
}

// Generate idempotency key if not provided
function generateIdempotencyKey(userId: string, operation: string, amount: number): string {
  const timestamp = Math.floor(Date.now() / 1000); // 1-second window
  return `${userId}-${operation}-${amount}-${timestamp}`;
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
    const { operation, amount, idempotencyKey, expectedVersion }: WalletOperationRequest = await req.json();

    // Input validation
    if (!operation || !['deposit', 'withdrawal'].includes(operation)) {
      throw new Error('Invalid operation. Must be "deposit" or "withdrawal"');
    }

    if (!amount || typeof amount !== 'number') {
      throw new Error('Invalid amount. Must be a number');
    }

    // Prevent edge cases with special number values
    if (!Number.isFinite(amount) || Object.is(amount, -0)) {
      throw new Error('Invalid amount value');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // Minimum amount validation
    if (amount < 0.01) {
      throw new Error('Minimum amount is 0.01 credits');
    }

    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum limit of 1,000,000 credits');
    }

    // Validate decimal precision (max 2 decimal places)
    const amountString = amount.toString();
    const decimalMatch = amountString.match(/\.(\d+)/);
    if (decimalMatch && decimalMatch[1].length > 2) {
      throw new Error('Amount must have maximum 2 decimal places');
    }

    // Round to 2 decimal places to prevent floating point issues
    const sanitizedAmount = Math.round(amount * 100) / 100;

    // Generate or use provided idempotency key
    const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(user.id, operation, sanitizedAmount);

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

    // Process wallet operation atomically using NEW database function with optimistic locking
    const { data: result, error: operationError } = await supabaseAdmin
      .rpc('process_wallet_operation_v2', {
        _user_id: user.id,
        _operation: operation,
        _amount: sanitizedAmount,
        _expected_version: expectedVersion || null,
        _idempotency_key: finalIdempotencyKey,
        _metadata: {
          timestamp: new Date().toISOString(),
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        }
      });

    if (operationError) {
      console.error('Wallet operation error:', operationError);
      
      // Check for concurrent modification error
      if (operationError.message?.includes('Concurrent modification')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Transaction conflict detected. Please refresh and try again.',
            code: 'VERSION_CONFLICT',
            retryable: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }
      
      throw new Error(operationError.message || 'Failed to process wallet operation');
    }

    // Check if this was a cached (deduplicated) response
    const wasCached = result.cached === true;
    
    console.log(`${operation} completed successfully. Transaction ID: ${result.transaction_id}${wasCached ? ' (cached)' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        amount: sanitizedAmount,
        newBalance: result.balance_after,
        previousBalance: result.balance_before,
        transactionId: result.transaction_id,
        version: result.new_version,
        attemptsRemaining: rateLimitCheck.attempts_remaining,
        cached: wasCached,
        idempotencyKey: finalIdempotencyKey,
        message: `${operation === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${sanitizedAmount} credits successful${wasCached ? ' (duplicate request)' : ''}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Wallet operation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    let statusCode = 400;
    
    if (errorMessage === 'Unauthorized') {
      statusCode = 401;
    } else if (errorMessage.includes('Rate limit')) {
      statusCode = 429;
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        retryable: statusCode === 429
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});
