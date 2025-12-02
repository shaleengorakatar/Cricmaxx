-- Create creator applications table
CREATE TABLE public.creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  follower_count INTEGER NOT NULL,
  social_media_platform TEXT NOT NULL,
  social_media_handle TEXT NOT NULL,
  previous_experience TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Users can create their own application
CREATE POLICY "Users can create own application"
ON public.creator_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own application
CREATE POLICY "Users can view own application"
ON public.creator_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.creator_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.creator_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add index for efficient queries
CREATE INDEX idx_creator_applications_status ON public.creator_applications(status);
CREATE INDEX idx_creator_applications_user_id ON public.creator_applications(user_id);