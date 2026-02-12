
-- Prevent duplicate votes: one vote per user per poll
ALTER TABLE public.poll_votes 
ADD CONSTRAINT poll_votes_user_poll_unique UNIQUE (poll_id, user_id);
