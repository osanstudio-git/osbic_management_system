-- ==============================================================================
-- Migration: 20260919_fix_client_and_service_deletion.sql
-- Description: Fix RLS policies and provide atomic RPC functions for safe client
--              and service deletions with foreign key dependency resolution.
-- ==============================================================================

-- ─── 1. Fix RLS on Services & Catalog Sub-tables ──────────────────────────────
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read services" ON public.services;
CREATE POLICY "Allow authenticated read services" ON public.services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert services" ON public.services;
CREATE POLICY "Allow authenticated insert services" ON public.services
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update services" ON public.services;
CREATE POLICY "Allow authenticated update services" ON public.services
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete services" ON public.services;
CREATE POLICY "Allow authenticated delete services" ON public.services
  FOR DELETE TO authenticated USING (true);

-- Workflow Steps RLS
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated all workflow_steps" ON public.workflow_steps;
CREATE POLICY "Allow authenticated all workflow_steps" ON public.workflow_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service Document Requirements RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_document_requirements') THEN
    EXECUTE 'ALTER TABLE public.service_document_requirements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated all service_document_requirements" ON public.service_document_requirements';
    EXECUTE 'CREATE POLICY "Allow authenticated all service_document_requirements" ON public.service_document_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Package Services RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'package_services') THEN
    EXECUTE 'ALTER TABLE public.package_services ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated all package_services" ON public.package_services';
    EXECUTE 'CREATE POLICY "Allow authenticated all package_services" ON public.package_services FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Service Interests RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_interests') THEN
    EXECUTE 'ALTER TABLE public.service_interests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated all service_interests" ON public.service_interests';
    EXECUTE 'CREATE POLICY "Allow authenticated all service_interests" ON public.service_interests FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── 2. Profiles Delete RLS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated delete profiles" ON public.profiles;
CREATE POLICY "Allow authenticated delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (true);


-- ─── 3. Atomic RPC to Safely Delete a Service ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_service_safely(p_service_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_jobs_count INT := 0;
  v_job_services_count INT := 0;
BEGIN
  -- Check if linked to active or historical jobs
  SELECT COUNT(*) INTO v_active_jobs_count
  FROM public.jobs
  WHERE service_id = p_service_id;

  SELECT COUNT(*) INTO v_job_services_count
  FROM public.job_services
  WHERE service_id = p_service_id;

  IF (v_active_jobs_count > 0 OR v_job_services_count > 0) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete service because it is linked to ' || (v_active_jobs_count + v_job_services_count) || ' existing job(s). Please deactivate it instead.'
    );
  END IF;

  -- 1. Clean up document requirements
  DELETE FROM public.service_document_requirements WHERE service_id = p_service_id;
  
  -- 2. Clean up workflow steps
  DELETE FROM public.workflow_steps WHERE service_id = p_service_id;
  
  -- 3. Clean up package linkages
  DELETE FROM public.package_services WHERE service_id = p_service_id;
  
  -- 4. Clean up lead interest linkages
  DELETE FROM public.service_interests WHERE service_id = p_service_id;

  -- 5. Delete service record
  DELETE FROM public.services WHERE id = p_service_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ─── 4. Atomic RPC to Safely Delete a Client Profile ──────────────────────────
CREATE OR REPLACE FUNCTION public.delete_client_safely(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_jobs_count INT := 0;
  v_paid_invoices_count INT := 0;
BEGIN
  -- Check if client has active jobs in progress
  SELECT COUNT(*) INTO v_active_jobs_count
  FROM public.jobs
  WHERE client_id = p_client_id 
    AND status NOT IN ('cancelled', 'draft');

  IF v_active_jobs_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete client because they have ' || v_active_jobs_count || ' active job(s) in progress. Please complete or cancel the jobs first.'
    );
  END IF;

  -- Check if client has paid invoices
  SELECT COUNT(*) INTO v_paid_invoices_count
  FROM public.invoices
  WHERE client_id = p_client_id
    AND status IN ('paid', 'partially_paid');

  IF v_paid_invoices_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete client because they have ' || v_paid_invoices_count || ' paid/recorded financial invoice(s). Please archive the client instead.'
    );
  END IF;

  -- 1. Unlink or clean up leads
  UPDATE public.leads SET client_id = NULL WHERE client_id = p_client_id;

  -- 2. Delete client requests & tickets
  DELETE FROM public.client_requests WHERE client_id = p_client_id;

  -- 3. Delete client package allocations
  DELETE FROM public.client_packages WHERE client_id = p_client_id;

  -- 4. Delete client feedback/reviews
  DELETE FROM public.client_feedbacks WHERE client_id = p_client_id;

  -- 5. Delete draft/cancelled invoices
  DELETE FROM public.invoices WHERE client_id = p_client_id;

  -- 6. Clean up cancelled/draft jobs & job documents
  DELETE FROM public.job_service_documents 
  WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = p_client_id);

  DELETE FROM public.job_service_steps 
  WHERE job_service_id IN (
    SELECT js.id FROM public.job_services js 
    JOIN public.jobs j ON js.job_id = j.id 
    WHERE j.client_id = p_client_id
  );

  DELETE FROM public.job_services 
  WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = p_client_id);

  DELETE FROM public.jobs WHERE client_id = p_client_id;

  -- 7. Delete custody vault items
  DELETE FROM public.branch_document_vault WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = p_client_id);

  -- 8. Delete escalations linked to client
  DELETE FROM public.branch_client_escalations WHERE client_name = (SELECT full_name FROM public.profiles WHERE id = p_client_id);

  -- 9. Delete client profile
  DELETE FROM public.profiles WHERE id = p_client_id;

  -- 10. Attempt to delete auth user if exists
  BEGIN
    DELETE FROM auth.users WHERE id = p_client_id;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if caller lacks auth.users table permissions
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
