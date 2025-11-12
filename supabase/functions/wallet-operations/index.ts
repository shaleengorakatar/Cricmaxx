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

    // Get current user profile with balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    const currentBalance = Number(profile.balance) || 0;

    // Validate withdrawal doesn't exceed balance
    if (operation === 'withdrawal' && sanitizedAmount > currentBalance) {
      throw new Error(`Insufficient funds. Available balance: ${currentBalance} credits`);
    }

    // Calculate new balance
    const newBalance = operation === 'deposit' 
      ? currentBalance + sanitizedAmount 
      : currentBalance - sanitizedAmount;

    console.log(`Balance change: ${currentBalance} -> ${newBalance} (${operation} ${sanitizedAmount})`);

    // Start transaction: Update balance and create transaction record
    const { error: balanceError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', user.id);

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      throw new Error('Failed to update balance');
    }

    // Create transaction record for audit trail
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: operation,
        amount: operation === 'deposit' ? sanitizedAmount : -sanitizedAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        status: 'completed',
        metadata: {
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction record error:', transactionError);
      // Don't fail the operation, but log the error
      console.error('Failed to create transaction record, but balance was updated');
    }

    console.log(`${operation} completed successfully. Transaction ID: ${transaction?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        amount: sanitizedAmount,
        newBalance,
        transactionId: transaction?.id,
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
