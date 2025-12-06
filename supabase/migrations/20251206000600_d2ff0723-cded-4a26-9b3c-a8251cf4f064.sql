-- Drop the overly permissive policy that allows anyone to view tokens
DROP POLICY IF EXISTS "Anyone can view valid unexpired tokens" ON public.friend_invite_tokens;

-- Add policy for authenticated users to view tokens they're validating (for the invite flow)
-- This allows the invite page to check if a token exists and is valid
CREATE POLICY "Authenticated users can view valid tokens for validation"
ON public.friend_invite_tokens
FOR SELECT
TO authenticated
USING (
  (expires_at > now()) AND (used_at IS NULL)
);

-- Note: The existing "Users can view their own invite tokens" policy already 
-- allows token creators to see their own tokens