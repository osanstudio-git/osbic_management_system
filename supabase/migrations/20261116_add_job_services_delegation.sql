-- Migration: Add delegation tracking columns to job_services
-- Date: 2026-11-16
-- Purpose: Track when an ops employee reassigns/delegates a task to a coworker

-- 1. Add delegation tracking columns to job_services
ALTER TABLE public.job_services 
  ADD COLUMN IF NOT EXISTS delegated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delegation_notes TEXT;

-- 2. Create index for fast lookups by delegator
CREATE INDEX IF NOT EXISTS idx_job_services_delegated_by 
  ON public.job_services(delegated_by);

-- 3. Update RLS policy so the current ops employee can delegate their assigned task
DROP POLICY IF EXISTS "Employees can update their job services" ON public.job_services;
CREATE POLICY "Employees can update their job services" ON public.job_services
  FOR UPDATE USING (
    ops_employee_id = auth.uid() 
    OR pro_id = auth.uid() 
    OR delegated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

COMMENT ON COLUMN public.job_services.delegated_by IS 'Profile ID of the coworker who originally held this task and handed it over';
COMMENT ON COLUMN public.job_services.delegated_at IS 'Timestamp of when the task was delegated to the current ops_employee_id';
COMMENT ON COLUMN public.job_services.delegation_notes IS 'Reason or handover note provided during delegation';

