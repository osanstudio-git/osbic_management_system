-- =============================================================================
-- Migration: General Journal & P&L System
-- Tracks accounting journal entries (Sales & Payments/Expenses) per branch
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.general_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  particular TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sales', 'payment')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  receipt_url TEXT,
  reference_id TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_general_journal_date ON public.general_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_general_journal_type ON public.general_journal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_general_journal_branch ON public.general_journal_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_general_journal_category ON public.general_journal_entries(category);

-- Enable RLS
ALTER TABLE public.general_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged staff can view journal entries"
  ON public.general_journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.can_do_accounts = true OR
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "Privileged staff can insert journal entries"
  ON public.general_journal_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.can_do_accounts = true OR
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "Privileged staff can update journal entries"
  ON public.general_journal_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.can_do_accounts = true OR
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "Admins can delete journal entries"
  ON public.general_journal_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
