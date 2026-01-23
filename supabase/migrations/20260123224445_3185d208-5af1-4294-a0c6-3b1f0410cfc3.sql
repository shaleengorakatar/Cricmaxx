-- Add prediction count and price history to markets
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS prediction_count integer DEFAULT 0;
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS price_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Create onboarding status tracking
CREATE TABLE IF NOT EXISTS public.onboarding_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  completed_at TIMESTAMP WITH TIME ZONE,
  skipped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for onboarding
CREATE POLICY "Users can view their own onboarding status" 
ON public.onboarding_status 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding status" 
ON public.onboarding_status 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding status" 
ON public.onboarding_status 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create email notifications log
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Only allow reading own notifications
CREATE POLICY "Users can view their own email notifications" 
ON public.email_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Function to update prediction count on new position
CREATE OR REPLACE FUNCTION public.update_market_prediction_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.markets 
  SET prediction_count = prediction_count + 1
  WHERE id = NEW.market_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for updating prediction count
DROP TRIGGER IF EXISTS trigger_update_prediction_count ON public.positions;
CREATE TRIGGER trigger_update_prediction_count
AFTER INSERT ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.update_market_prediction_count();

-- Function to append price to history (called by cron or on trade)
CREATE OR REPLACE FUNCTION public.append_price_history(
  p_market_id UUID,
  p_yes_price NUMERIC,
  p_no_price NUMERIC
)
RETURNS void AS $$
DECLARE
  current_history jsonb;
  new_entry jsonb;
BEGIN
  SELECT COALESCE(price_history, '[]'::jsonb) INTO current_history FROM markets WHERE id = p_market_id;
  
  new_entry := jsonb_build_object(
    't', extract(epoch from now())::integer,
    'y', p_yes_price,
    'n', p_no_price
  );
  
  -- Keep only last 24 entries (hourly for a day)
  IF jsonb_array_length(current_history) >= 24 THEN
    current_history := current_history - 0;
  END IF;
  
  UPDATE markets 
  SET price_history = current_history || new_entry
  WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;