-- Migration: Step dependency locking & handoff notes
-- Date: 2026-10-31

-- 1. Step dependency fields on job_service_steps
ALTER TABLE public.job_service_steps 
ADD COLUMN IF NOT EXISTS requires_step_id UUID REFERENCES public.job_service_steps(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- 2. Create job_handoff_notes table for team handoffs
CREATE TABLE IF NOT EXISTS public.job_handoff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_service_id UUID REFERENCES public.job_services(id) ON DELETE CASCADE,
  job_service_step_id UUID REFERENCES public.job_service_steps(id) ON DELETE SET NULL,
  from_employee_id UUID REFERENCES public.profiles(id),
  to_employee_id UUID REFERENCES public.profiles(id),
  stage_name TEXT,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for job_handoff_notes
ALTER TABLE public.job_handoff_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read job_handoff_notes"
  ON public.job_handoff_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert job_handoff_notes"
  ON public.job_handoff_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Automatic function to unlock dependent steps when a prerequisite step is completed
CREATE OR REPLACE FUNCTION public.handle_unlock_dependent_steps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.job_service_steps
    SET is_locked = false
    WHERE requires_step_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_unlock_dependent_steps ON public.job_service_steps;
CREATE TRIGGER trg_unlock_dependent_steps
  AFTER UPDATE OF status ON public.job_service_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_unlock_dependent_steps();
