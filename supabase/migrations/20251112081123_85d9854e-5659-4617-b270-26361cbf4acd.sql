-- Drop all existing policies on profiles
DO $$
DECLARE p record;
BEGIN
  FOR p IN 
    SELECT pol.polname
    FROM pg_policy pol
    WHERE pol.polrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.polname);
  END LOOP;
END$$;

-- Create PERMISSIVE policies (default type when not specified)
-- Multiple permissive policies use OR logic

-- SELECT policies
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

-- UPDATE policies
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

-- DELETE policy
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));