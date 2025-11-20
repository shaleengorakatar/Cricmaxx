-- Fix profiles table RLS policies: Convert RESTRICTIVE to PERMISSIVE
-- This allows users to access their own profiles OR admins to access all profiles

-- Drop existing RESTRICTIVE policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;

-- Recreate as PERMISSIVE policies (default)
-- SELECT policies: Users can view their own profile OR admins can view all
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- UPDATE policies: Users can update their own profile OR admins can update all
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- DELETE policy: Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT policy: Users can create their own profile during registration
CREATE POLICY "Users can create own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);