-- Add explicit deny policy for anonymous users on creator_applications table
CREATE POLICY "Deny anonymous access to creator applications"
ON public.creator_applications FOR SELECT
TO anon
USING (false);

-- Add explicit deny for anonymous INSERT
CREATE POLICY "Deny anonymous insert to creator applications"
ON public.creator_applications FOR INSERT
TO anon
WITH CHECK (false);

-- Add explicit deny for anonymous UPDATE
CREATE POLICY "Deny anonymous update to creator applications"
ON public.creator_applications FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

-- Add explicit deny for anonymous DELETE
CREATE POLICY "Deny anonymous delete to creator applications"
ON public.creator_applications FOR DELETE
TO anon
USING (false);