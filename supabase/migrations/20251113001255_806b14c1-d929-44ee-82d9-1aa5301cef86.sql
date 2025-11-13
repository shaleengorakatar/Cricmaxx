-- Fix fraud_alerts INSERT policy to only allow service role
DROP POLICY IF EXISTS "System can create fraud alerts" ON public.fraud_alerts;

CREATE POLICY "Only service role can create fraud alerts"
  ON public.fraud_alerts
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');