-- Add resolution tracking fields to markets table
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS resolution_window_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS resolution_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Create market resolution audit log for tracking all resolution attempts
CREATE TABLE IF NOT EXISTS public.market_resolution_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'attempted', 'succeeded', 'failed', 'manual_override'
  performed_by uuid REFERENCES auth.users(id),
  source text NOT NULL, -- 'oracle', 'admin_manual', 'system_fallback'
  outcome text, -- 'yes', 'no', 'void', null if failed
  api_response jsonb,
  error_message text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_resolution_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for resolution log
CREATE POLICY "Anyone can view resolution logs for public markets"
ON public.market_resolution_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM markets 
    WHERE markets.id = market_resolution_log.market_id 
    AND markets.status IN ('open', 'closed', 'resolved')
  )
);

CREATE POLICY "Only admins can insert resolution logs"
ON public.market_resolution_log
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create resolution notifications table
CREATE TABLE IF NOT EXISTS public.resolution_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  notification_type text NOT NULL, -- 'resolution', 'payout', 'void'
  title text NOT NULL,
  message text NOT NULL,
  outcome text, -- 'yes', 'no', 'void'
  payout_amount numeric,
  read boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  push_sent boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resolution_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own notifications"
ON public.resolution_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.resolution_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
ON public.resolution_notifications
FOR INSERT
WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_resolution_log_market ON public.market_resolution_log(market_id);
CREATE INDEX IF NOT EXISTS idx_resolution_log_created ON public.market_resolution_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resolution_notifications_user ON public.resolution_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_resolution_notifications_market ON public.resolution_notifications(market_id);

-- Function to get resolution history for a market
CREATE OR REPLACE FUNCTION public.get_market_resolution_history(market_uuid uuid)
RETURNS TABLE (
  id uuid,
  action text,
  source text,
  outcome text,
  notes text,
  error_message text,
  performed_by_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    mrl.id,
    mrl.action,
    mrl.source,
    mrl.outcome,
    mrl.notes,
    mrl.error_message,
    COALESCE(p.name, 'System') as performed_by_name,
    mrl.created_at
  FROM market_resolution_log mrl
  LEFT JOIN profiles p ON p.id = mrl.performed_by
  WHERE mrl.market_id = market_uuid
  ORDER BY mrl.created_at DESC
  LIMIT 50;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_market_resolution_history(uuid) TO authenticated;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.resolution_notifications;