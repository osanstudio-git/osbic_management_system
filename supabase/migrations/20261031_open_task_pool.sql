-- Migration: Open Task Pool & Atomic Claim System
-- Date: 2026-10-31

-- 1. Add assignment_model, pool timestamps and claiming tracking to job_services
ALTER TABLE public.job_services
ADD COLUMN IF NOT EXISTS assignment_model TEXT DEFAULT 'direct' 
  CHECK (assignment_model IN ('direct', 'pool')),
ADD COLUMN IF NOT EXISTS pool_posted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pool_claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pool_claimed_by UUID REFERENCES public.profiles(id);

-- 2. PostgreSQL Atomic RPC Function to claim pool tasks (Race-condition proof)
-- If two employees click "Claim Task" at the exact same split-second,
-- row-level locking (FOR UPDATE) guarantees that only ONE gets it,
-- while the second receives an 'already_claimed' response gracefully.
CREATE OR REPLACE FUNCTION public.claim_pool_task(
  p_job_service_id UUID,
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service public.job_services%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_employee public.profiles%ROWTYPE;
BEGIN
  -- 1. Lock the row for update to prevent concurrent race condition
  SELECT * INTO v_service
  FROM public.job_services
  WHERE id = p_job_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_not_found');
  END IF;

  -- 2. Check if already claimed
  IF v_service.ops_employee_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'already_claimed',
      'claimed_by', v_service.ops_employee_id
    );
  END IF;

  -- 3. Fetch employee info
  SELECT * INTO v_employee
  FROM public.profiles
  WHERE id = p_employee_id;

  -- 4. Atomically assign and switch to direct model
  UPDATE public.job_services
  SET 
    ops_employee_id = p_employee_id,
    assignment_model = 'direct',
    pool_claimed_by = p_employee_id,
    pool_claimed_at = NOW(),
    assigned_at = NOW(),
    status = 'in_progress',
    updated_at = NOW()
  WHERE id = p_job_service_id;

  -- 5. Log audit trail to job_service_timeline
  INSERT INTO public.job_service_timeline (
    job_service_id,
    job_id,
    from_status,
    to_status,
    changed_by,
    changed_by_name,
    changed_by_role,
    changed_at,
    reason
  ) VALUES (
    p_job_service_id,
    v_service.job_id,
    'pending',
    'assigned',
    p_employee_id,
    v_employee.full_name,
    'ops',
    NOW(),
    'Claimed by specialist from Open Task Marketplace (Uber-style pool)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_service_id', p_job_service_id,
    'claimed_by', p_employee_id,
    'claimed_at', NOW()
  );
END;
$$;
