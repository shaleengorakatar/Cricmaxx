-- Drop the foreign key constraint on rate_limits to allow load testing with simulated users
-- Rate limits table is operational and doesn't need strict referential integrity
ALTER TABLE public.rate_limits DROP CONSTRAINT IF EXISTS rate_limits_user_id_fkey;

-- Also ensure we can clean up test data after load tests
CREATE INDEX IF NOT EXISTS idx_rate_limits_operation_type ON public.rate_limits(operation_type);