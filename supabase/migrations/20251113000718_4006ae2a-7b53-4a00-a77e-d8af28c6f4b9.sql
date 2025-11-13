-- Create fraud alerts table
CREATE TABLE public.fraud_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'false_positive')),
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  threshold_value numeric,
  actual_value numeric,
  time_window_hours integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id),
  resolution_notes text
);

-- Create fraud detection thresholds configuration table
CREATE TABLE public.fraud_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type text NOT NULL UNIQUE,
  threshold_value numeric NOT NULL,
  time_window_hours integer NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  enabled boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fraud_alerts
CREATE POLICY "Admins can view all fraud alerts"
  ON public.fraud_alerts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fraud alerts"
  ON public.fraud_alerts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can create fraud alerts"
  ON public.fraud_alerts
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for fraud_thresholds
CREATE POLICY "Admins can manage thresholds"
  ON public.fraud_thresholds
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_fraud_alerts_user_id ON public.fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_created_at ON public.fraud_alerts(created_at DESC);
CREATE INDEX idx_fraud_alerts_severity ON public.fraud_alerts(severity);

-- Create trigger for updated_at
CREATE TRIGGER update_fraud_thresholds_updated_at
  BEFORE UPDATE ON public.fraud_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert industry-standard thresholds for CFTC-regulated financial platform
INSERT INTO public.fraud_thresholds (alert_type, threshold_value, time_window_hours, severity, description) VALUES
  ('high_volume_deposits', 10000, 24, 'high', 'Total deposits exceed $10,000 in 24 hours'),
  ('high_volume_withdrawals', 10000, 24, 'high', 'Total withdrawals exceed $10,000 in 24 hours'),
  ('rapid_transactions', 20, 1, 'medium', 'More than 20 transactions in 1 hour'),
  ('velocity_check', 10, 0.25, 'medium', 'More than 10 transactions in 15 minutes'),
  ('multiple_withdrawals', 5, 24, 'medium', 'More than 5 withdrawals in 24 hours'),
  ('large_single_transaction', 5000, 0, 'high', 'Single transaction exceeds $5,000'),
  ('suspicious_pattern_structuring', 9500, 24, 'critical', 'Multiple transactions just below $10,000 threshold (structuring)'),
  ('negative_balance_attempt', 0, 0, 'critical', 'Attempt to withdraw more than available balance'),
  ('round_trip_trading', 5, 1, 'medium', 'More than 5 deposit-withdrawal cycles in 1 hour');

-- Create function to detect fraud patterns
CREATE OR REPLACE FUNCTION public.detect_fraud_patterns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold_record RECORD;
  user_record RECORD;
  alert_exists boolean;
BEGIN
  -- Loop through all active users with transactions
  FOR user_record IN 
    SELECT DISTINCT user_id FROM transactions WHERE created_at > now() - interval '24 hours'
  LOOP
    -- Check each threshold
    FOR threshold_record IN 
      SELECT * FROM fraud_thresholds WHERE enabled = true
    LOOP
      -- High volume deposits
      IF threshold_record.alert_type = 'high_volume_deposits' THEN
        DECLARE
          total_deposits numeric;
        BEGIN
          SELECT COALESCE(SUM(amount), 0) INTO total_deposits
          FROM transactions
          WHERE user_id = user_record.user_id
            AND type = 'deposit'
            AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval;
          
          IF total_deposits > threshold_record.threshold_value THEN
            SELECT EXISTS(
              SELECT 1 FROM fraud_alerts
              WHERE user_id = user_record.user_id
                AND alert_type = threshold_record.alert_type
                AND status IN ('pending', 'reviewed')
                AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
              INSERT INTO fraud_alerts (user_id, alert_type, severity, description, threshold_value, actual_value, time_window_hours, metadata)
              VALUES (
                user_record.user_id,
                threshold_record.alert_type,
                threshold_record.severity,
                format('User deposited $%s in %s hours (threshold: $%s)', total_deposits, threshold_record.time_window_hours, threshold_record.threshold_value),
                threshold_record.threshold_value,
                total_deposits,
                threshold_record.time_window_hours,
                jsonb_build_object('detection_time', now(), 'transaction_count', (SELECT COUNT(*) FROM transactions WHERE user_id = user_record.user_id AND type = 'deposit' AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval))
              );
            END IF;
          END IF;
        END;
      END IF;

      -- High volume withdrawals
      IF threshold_record.alert_type = 'high_volume_withdrawals' THEN
        DECLARE
          total_withdrawals numeric;
        BEGIN
          SELECT COALESCE(SUM(ABS(amount)), 0) INTO total_withdrawals
          FROM transactions
          WHERE user_id = user_record.user_id
            AND type = 'withdrawal'
            AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval;
          
          IF total_withdrawals > threshold_record.threshold_value THEN
            SELECT EXISTS(
              SELECT 1 FROM fraud_alerts
              WHERE user_id = user_record.user_id
                AND alert_type = threshold_record.alert_type
                AND status IN ('pending', 'reviewed')
                AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
              INSERT INTO fraud_alerts (user_id, alert_type, severity, description, threshold_value, actual_value, time_window_hours, metadata)
              VALUES (
                user_record.user_id,
                threshold_record.alert_type,
                threshold_record.severity,
                format('User withdrew $%s in %s hours (threshold: $%s)', total_withdrawals, threshold_record.time_window_hours, threshold_record.threshold_value),
                threshold_record.threshold_value,
                total_withdrawals,
                threshold_record.time_window_hours,
                jsonb_build_object('detection_time', now(), 'withdrawal_count', (SELECT COUNT(*) FROM transactions WHERE user_id = user_record.user_id AND type = 'withdrawal' AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval))
              );
            END IF;
          END IF;
        END;
      END IF;

      -- Rapid transactions
      IF threshold_record.alert_type = 'rapid_transactions' THEN
        DECLARE
          transaction_count integer;
        BEGIN
          SELECT COUNT(*) INTO transaction_count
          FROM transactions
          WHERE user_id = user_record.user_id
            AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval;
          
          IF transaction_count > threshold_record.threshold_value THEN
            SELECT EXISTS(
              SELECT 1 FROM fraud_alerts
              WHERE user_id = user_record.user_id
                AND alert_type = threshold_record.alert_type
                AND status IN ('pending', 'reviewed')
                AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
              INSERT INTO fraud_alerts (user_id, alert_type, severity, description, threshold_value, actual_value, time_window_hours, metadata)
              VALUES (
                user_record.user_id,
                threshold_record.alert_type,
                threshold_record.severity,
                format('User executed %s transactions in %s hour(s) (threshold: %s)', transaction_count, threshold_record.time_window_hours, threshold_record.threshold_value),
                threshold_record.threshold_value,
                transaction_count,
                threshold_record.time_window_hours,
                jsonb_build_object('detection_time', now(), 'types', (SELECT jsonb_agg(DISTINCT type) FROM transactions WHERE user_id = user_record.user_id AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval))
              );
            END IF;
          END IF;
        END;
      END IF;

      -- Multiple withdrawals
      IF threshold_record.alert_type = 'multiple_withdrawals' THEN
        DECLARE
          withdrawal_count integer;
        BEGIN
          SELECT COUNT(*) INTO withdrawal_count
          FROM transactions
          WHERE user_id = user_record.user_id
            AND type = 'withdrawal'
            AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval;
          
          IF withdrawal_count > threshold_record.threshold_value THEN
            SELECT EXISTS(
              SELECT 1 FROM fraud_alerts
              WHERE user_id = user_record.user_id
                AND alert_type = threshold_record.alert_type
                AND status IN ('pending', 'reviewed')
                AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
              INSERT INTO fraud_alerts (user_id, alert_type, severity, description, threshold_value, actual_value, time_window_hours, metadata)
              VALUES (
                user_record.user_id,
                threshold_record.alert_type,
                threshold_record.severity,
                format('User made %s withdrawals in %s hours (threshold: %s)', withdrawal_count, threshold_record.time_window_hours, threshold_record.threshold_value),
                threshold_record.threshold_value,
                withdrawal_count,
                threshold_record.time_window_hours,
                jsonb_build_object('detection_time', now(), 'total_amount', (SELECT SUM(ABS(amount)) FROM transactions WHERE user_id = user_record.user_id AND type = 'withdrawal' AND created_at > now() - (threshold_record.time_window_hours || ' hours')::interval))
              );
            END IF;
          END IF;
        END;
      END IF;

    END LOOP;
  END LOOP;
END;
$$;