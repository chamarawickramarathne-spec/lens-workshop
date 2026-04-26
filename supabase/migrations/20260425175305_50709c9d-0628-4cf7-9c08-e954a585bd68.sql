
-- Join requests table: students submit via public join page
CREATE TABLE public.join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  payment_slip_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (public) can submit a join request
CREATE POLICY "Anyone can submit join request"
ON public.join_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Event owners can view requests for their events
CREATE POLICY "Owners view join requests"
ON public.join_requests
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = join_requests.event_id AND e.user_id = auth.uid()));

-- Event owners can update (approve/reject)
CREATE POLICY "Owners update join requests"
ON public.join_requests
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = join_requests.event_id AND e.user_id = auth.uid()));

-- Event owners can delete
CREATE POLICY "Owners delete join requests"
ON public.join_requests
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = join_requests.event_id AND e.user_id = auth.uid()));

CREATE TRIGGER update_join_requests_updated_at
BEFORE UPDATE ON public.join_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_join_requests_event_id ON public.join_requests(event_id);

-- Public read policy for events (limited fields needed for join page)
-- We allow anyone to view event basic details so they can see what they're joining
CREATE POLICY "Public can view events for join page"
ON public.events
FOR SELECT
TO anon, authenticated
USING (true);

-- Storage bucket for payment slips (public so owners can view via URL easily)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public upload to payment-slips bucket (students aren't logged in)
CREATE POLICY "Anyone can upload payment slips"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-slips');

CREATE POLICY "Payment slips publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'payment-slips');
