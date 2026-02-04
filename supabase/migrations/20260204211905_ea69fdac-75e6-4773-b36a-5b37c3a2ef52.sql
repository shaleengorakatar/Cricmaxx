-- Add INSERT policy for trades table to allow authenticated users to create trades
-- This is needed for the order-book edge function to record executed trades

CREATE POLICY "System can insert trades" 
ON public.trades 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Allow insert if user is either the buyer or seller
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- Also add a service role policy for edge functions
CREATE POLICY "Service role can insert trades"
ON public.trades
FOR INSERT
TO service_role
WITH CHECK (true);