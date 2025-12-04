-- Enable full replica identity for realtime on markets table
ALTER TABLE public.markets REPLICA IDENTITY FULL;

-- Add markets table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.markets;