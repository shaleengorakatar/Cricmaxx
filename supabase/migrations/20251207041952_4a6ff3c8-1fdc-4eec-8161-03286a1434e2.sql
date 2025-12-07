-- Add pool_enabled column to markets table (default OFF)
ALTER TABLE public.markets 
ADD COLUMN pool_enabled boolean NOT NULL DEFAULT false;