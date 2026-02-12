-- Allow authenticated users to read basic profile info of other users (for contest leaderboards, etc.)
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
USING (auth.role() = 'authenticated');