-- Add creator_type column to creator_applications table
ALTER TABLE public.creator_applications 
ADD COLUMN IF NOT EXISTS creator_type text;

-- Add a comment describing the column
COMMENT ON COLUMN public.creator_applications.creator_type IS 'Type of content creator (e.g., cricket_analyst, sports_commentator, influencer)';