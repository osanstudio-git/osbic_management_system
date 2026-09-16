-- 20260916_allow_authenticated_read_leads.sql
-- Allow authenticated employees and admins to view all inbound leads in Marketing Hub

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Authenticated users to view all leads
DROP POLICY IF EXISTS "Authenticated users can read all leads" ON public.leads;
CREATE POLICY "Authenticated users can read all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- 2. Policy for Authenticated users to insert/update leads
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
CREATE POLICY "Authenticated users can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
CREATE POLICY "Authenticated users can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
