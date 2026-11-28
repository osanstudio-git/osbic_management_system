-- ==============================================================================
-- Migration: Branch Income & Offline Satellite Revenue Tracking
-- Allows Accounts to log single transactions or daily summaries from offline branches (e.g., Ruwi)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.branch_income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_mode TEXT NOT NULL DEFAULT 'single' CHECK (entry_mode IN ('single', 'daily_summary')),
  amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'card', 'bank_transfer')),
  client_name TEXT,
  client_phone TEXT,
  service_category TEXT NOT NULL DEFAULT 'sanad_typing',
  work_description TEXT,
  ministry_fee NUMERIC(10,3) NOT NULL DEFAULT 0,
  net_profit NUMERIC(10,3) NOT NULL DEFAULT 0,
  receipt_number TEXT,
  deals_count INTEGER NOT NULL DEFAULT 1,
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'pending_audit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.branch_income_entries ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff (Admin, Accounts, Managers, HR) can read entries
DROP POLICY IF EXISTS "branch_income_select_policy" ON public.branch_income_entries;
CREATE POLICY "branch_income_select_policy" ON public.branch_income_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_manager = true OR p.can_do_accounts = true OR p.department = 'accounts' OR p.department = 'hr')
    )
    OR branch_id IN (
      SELECT branch_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Insert/Update/Delete policy: Admin, Accounts, and Managers
DROP POLICY IF EXISTS "branch_income_manage_policy" ON public.branch_income_entries;
CREATE POLICY "branch_income_manage_policy" ON public.branch_income_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_manager = true OR p.can_do_accounts = true OR p.department = 'accounts')
    )
  );

-- Indexes for lightning-fast aggregation by branch and date
CREATE INDEX IF NOT EXISTS idx_branch_income_branch_date ON public.branch_income_entries (branch_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_branch_income_date ON public.branch_income_entries (entry_date);
