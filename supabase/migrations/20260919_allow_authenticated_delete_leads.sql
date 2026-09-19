-- 20260919_allow_authenticated_delete_leads.sql
-- Allow authenticated users (employees & admins) to delete leads and their related logs

-- 1. DELETE policy on public.leads
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;
CREATE POLICY "Authenticated users can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (true);

-- 2. ALL/DELETE policy on public.lead_interactions
ALTER TABLE IF EXISTS public.lead_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage lead_interactions" ON public.lead_interactions;
CREATE POLICY "Authenticated users can manage lead_interactions"
ON public.lead_interactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. ALL/DELETE policy on public.lead_services
ALTER TABLE IF EXISTS public.lead_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage lead_services" ON public.lead_services;
CREATE POLICY "Authenticated users can manage lead_services"
ON public.lead_services
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
