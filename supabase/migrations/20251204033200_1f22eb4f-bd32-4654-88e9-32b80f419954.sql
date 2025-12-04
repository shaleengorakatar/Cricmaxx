-- Drop the existing policy that only allows authenticated users
DROP POLICY IF EXISTS "Anyone can view approved/open markets" ON public.markets;

-- Create a new policy that allows everyone (including anonymous) to view approved/open markets
CREATE POLICY "Public can view approved/open markets" 
ON public.markets 
FOR SELECT 
TO public
USING (status IN ('approved', 'open', 'closed', 'resolved'));