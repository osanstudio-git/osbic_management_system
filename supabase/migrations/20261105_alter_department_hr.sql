-- 20261105_alter_department_hr.sql
-- 1. Update allowed departments to include 'hr' (HR & Administration)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_check 
  CHECK (department IN ('sales', 'operations', 'pro', 'accounts', 'marketing', 'hr'));

-- 2. Add branch transfer tracking columns (supports automated date-wise attribution)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS previous_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_transferred_at TIMESTAMPTZ;

COMMENT ON CONSTRAINT profiles_department_check ON public.profiles IS 'Allowed departments: sales, operations, pro, accounts, marketing, hr';
COMMENT ON COLUMN public.profiles.previous_branch_id IS 'Previous branch prior to most recent transfer';
COMMENT ON COLUMN public.profiles.branch_transferred_at IS 'Timestamp of the most recent branch transfer';
