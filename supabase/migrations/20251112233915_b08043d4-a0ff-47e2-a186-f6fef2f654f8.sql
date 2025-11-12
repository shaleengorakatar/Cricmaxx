-- Drop all existing policies on kyc_submissions
DO $$
DECLARE p record;
BEGIN
  FOR p IN 
    SELECT pol.polname
    FROM pg_policy pol
    WHERE pol.polrelid = 'public.kyc_submissions'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON public.kyc_submissions', p.polname);
  END LOOP;
END$$;

-- Create PERMISSIVE policies for kyc_submissions
-- Users can view their own KYC submissions
CREATE POLICY "Users can view own KYC"
ON public.kyc_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own KYC submissions
CREATE POLICY "Users can create own KYC"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all KYC submissions
CREATE POLICY "Admins can view all KYC"
ON public.kyc_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update KYC submissions (for review/approval)
CREATE POLICY "Admins can update KYC"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));