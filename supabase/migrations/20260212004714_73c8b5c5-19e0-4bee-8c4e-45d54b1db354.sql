-- Allow admins to update existing poll options
CREATE POLICY "Admins can update poll options"
ON public.poll_options
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert new poll options
CREATE POLICY "Admins can insert poll options"
ON public.poll_options
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));