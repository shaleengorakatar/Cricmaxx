-- Drop the problematic "Deny anonymous" policies that are blocking access
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous insert to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous update to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous delete to profiles" ON public.profiles;

-- The existing policies should handle access properly:
-- - "Users can view own profile" for SELECT (auth.uid() = id)
-- - "Users can update own profile" for UPDATE (auth.uid() = id)
-- - "Admins can view all profiles" for admin SELECT
-- - etc.
-- 
-- RLS on profiles is already enabled, and these PERMISSIVE policies 
-- will deny anonymous access by default since auth.uid() returns NULL for anonymous users