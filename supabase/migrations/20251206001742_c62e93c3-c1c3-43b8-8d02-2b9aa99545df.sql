-- Strengthen KYC submissions security
-- Ensure only authenticated users can access their own data, admins can review

-- Drop and recreate policies as explicit PERMISSIVE with TO authenticated
DROP POLICY IF EXISTS "Admins can update KYC" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users can create own KYC" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users can view own KYC" ON public.kyc_submissions;

-- Users can only view their own KYC submission
CREATE POLICY "Users can view own KYC"
ON public.kyc_submissions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only create their own KYC submission
CREATE POLICY "Users can create own KYC"
ON public.kyc_submissions
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only admins can view all KYC submissions for review
CREATE POLICY "Admins can view all KYC"
ON public.kyc_submissions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update KYC status (for approval/rejection)
CREATE POLICY "Admins can update KYC"
ON public.kyc_submissions
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Completely revoke access from anonymous users
REVOKE ALL ON public.kyc_submissions FROM anon;
REVOKE ALL ON public.kyc_submissions FROM public;

-- Create audit log table for KYC access
CREATE TABLE IF NOT EXISTS public.kyc_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_submission_id uuid REFERENCES public.kyc_submissions(id),
    accessed_by uuid NOT NULL,
    access_type text NOT NULL, -- 'view', 'update', 'create'
    accessed_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text
);

-- Enable RLS on audit log
ALTER TABLE public.kyc_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view KYC access logs"
ON public.kyc_access_log
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs (via service role or triggers)
CREATE POLICY "Service role can insert audit logs"
ON public.kyc_access_log
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Revoke anon access from audit log
REVOKE ALL ON public.kyc_access_log FROM anon;
REVOKE ALL ON public.kyc_access_log FROM public;