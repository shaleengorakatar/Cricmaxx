-- Add explicit deny policy for anonymous users on profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles FOR SELECT
TO anon
USING (false);

-- Add explicit deny for anonymous INSERT
CREATE POLICY "Deny anonymous insert to profiles"
ON public.profiles FOR INSERT
TO anon
WITH CHECK (false);

-- Add explicit deny for anonymous UPDATE
CREATE POLICY "Deny anonymous update to profiles"
ON public.profiles FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

-- Add explicit deny for anonymous DELETE
CREATE POLICY "Deny anonymous delete to profiles"
ON public.profiles FOR DELETE
TO anon
USING (false);