-- Add DELETE policy to profiles table
-- Only admins can delete profiles (for compliance/moderation purposes)
-- Regular users cannot delete profiles to maintain data integrity and audit trail
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));