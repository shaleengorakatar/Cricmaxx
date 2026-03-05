-- Allow users to update their own votes on open polls
CREATE POLICY "Users can update own votes on open polls"
ON public.poll_votes
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM prediction_polls
    WHERE prediction_polls.id = poll_votes.poll_id
    AND prediction_polls.status = 'open'
    AND prediction_polls.closes_at > now()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM prediction_polls
    WHERE prediction_polls.id = poll_votes.poll_id
    AND prediction_polls.status = 'open'
    AND prediction_polls.closes_at > now()
  )
);