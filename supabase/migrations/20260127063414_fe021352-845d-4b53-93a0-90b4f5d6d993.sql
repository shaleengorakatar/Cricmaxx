-- Add stripe_account_id to profiles for Stripe Connect
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_account_id text,
ADD COLUMN IF NOT EXISTS stripe_account_status text DEFAULT 'not_connected';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id ON public.profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Add payout tracking to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS stripe_payout_id text,
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT NULL;