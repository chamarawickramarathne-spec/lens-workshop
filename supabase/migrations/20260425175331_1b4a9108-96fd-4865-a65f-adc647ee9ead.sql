
DROP POLICY IF EXISTS "Anyone can submit join request" ON public.join_requests;

CREATE POLICY "Anyone can submit join request"
ON public.join_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = join_requests.event_id));
