-- Drop ALL existing policies on public.profiles programmatically to remove any RESTRICTIVE policies
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

-- Recreate PERMISSIVE policies with clear OR logic
-- SELECT policies
CREATE POLICY "Users can view own profile"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- UPDATE policies
CREATE POLICY "Users can update own profile"
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- DELETE policy (admins only)
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));