
-- Drop the duplicate/old resolve_poll functions, keep only the one with correct parameter order
DROP FUNCTION IF EXISTS public.resolve_poll(_poll_id uuid, _winning_option_id uuid, _admin_id uuid);
DROP FUNCTION IF EXISTS public.resolve_poll(_poll_id uuid, _admin_id uuid, _winning_option_ids uuid[]);
