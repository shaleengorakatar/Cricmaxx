-- Strengthen RLS policies on transactions table
-- Ensure only authenticated users can access their own data

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

-- Recreate as explicit PERMISSIVE policies with TO authenticated clause
-- This ensures anonymous users cannot access any transaction data

-- Users can only view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all transactions for oversight
CREATE POLICY "Admins can view all transactions"
ON public.transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Revoke any direct table access from anon role
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.transactions FROM public;