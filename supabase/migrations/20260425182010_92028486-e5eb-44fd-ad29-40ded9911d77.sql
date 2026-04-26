-- Allow anonymous (and authenticated) users to add themselves as attendees via the public join flow
CREATE POLICY "Public can self-join as attendee"
ON public.attendees
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = attendees.event_id)
);