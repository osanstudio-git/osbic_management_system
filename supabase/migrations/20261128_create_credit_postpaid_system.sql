-- ==============================================================================
-- Migration: Credit & Post-Paid (Pay on Completion) Workflow for OSBIC System
-- Allows Ops team to execute and update work status on credit/postpaid deals
-- ==============================================================================

-- 1. Extend 'jobs' table with credit and payment terms fields
ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'prepaid', -- 'prepaid', 'post_paid', 'on_completion', 'credit_30', '50_50', 'full'
  ADD COLUMN IF NOT EXISTS is_credit_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_due_date DATE,
  ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- 2. Extend 'job_services' table with credit authorization tracking
ALTER TABLE IF EXISTS public.job_services
  ADD COLUMN IF NOT EXISTS is_credit_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- 3. Extend 'profiles' / client profiles with trusted client & credit limit flags
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- 4. Create indexes for quick filtering on credit and postpaid jobs
CREATE INDEX IF NOT EXISTS idx_jobs_payment_terms ON public.jobs (payment_terms);
CREATE INDEX IF NOT EXISTS idx_jobs_is_credit_approved ON public.jobs (is_credit_approved);
CREATE INDEX IF NOT EXISTS idx_job_services_is_credit ON public.job_services (is_credit_approved);

-- 5. Safe function/trigger or view support:
-- Any job with payment_terms in ('post_paid', 'credit', 'on_completion', 'corporate_credit')
-- or is_credit_approved = true automatically permits Ops workflow execution.
COMMENT ON COLUMN public.jobs.payment_terms IS 'Payment terms: prepaid, post_paid (pay on completion), credit_30 (corporate 30 days), 50_50, full';
COMMENT ON COLUMN public.jobs.is_credit_approved IS 'If true, Ops team can execute all service steps without waiting for upfront payment';
