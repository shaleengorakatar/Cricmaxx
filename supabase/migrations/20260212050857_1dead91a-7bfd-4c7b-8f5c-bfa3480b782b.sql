
-- Allow admins to delete poll options
CREATE POLICY "Admins can delete poll options"
ON public.poll_options
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
