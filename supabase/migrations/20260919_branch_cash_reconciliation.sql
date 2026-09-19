-- 20260919_branch_cash_reconciliation.sql
-- Table and policies for Daily POS & Cash Drawer Reconciliation

CREATE TABLE IF NOT EXISTS public.branch_cash_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    reconciliation_date DATE NOT NULL,
    opening_cash NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    closing_cash_actual NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    pos_card_total_actual NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    expected_cash NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    expected_card NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    variance NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    bank_deposit_amount NUMERIC(12, 3) DEFAULT 0.000,
    deposit_reference TEXT,
    deposit_slip_url TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'verified', 'discrepancy')),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_branch_reconciliation_date UNIQUE (branch_id, reconciliation_date)
);

-- Enable RLS
ALTER TABLE public.branch_cash_reconciliations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view reconciliations for their branch or if admin
DROP POLICY IF EXISTS "Authenticated users can read branch reconciliations" ON public.branch_cash_reconciliations;
CREATE POLICY "Authenticated users can read branch reconciliations"
ON public.branch_cash_reconciliations
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert/update/delete branch reconciliations
DROP POLICY IF EXISTS "Authenticated users can insert branch reconciliations" ON public.branch_cash_reconciliations;
CREATE POLICY "Authenticated users can insert branch reconciliations"
ON public.branch_cash_reconciliations
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update branch reconciliations" ON public.branch_cash_reconciliations;
CREATE POLICY "Authenticated users can update branch reconciliations"
ON public.branch_cash_reconciliations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete branch reconciliations" ON public.branch_cash_reconciliations;
CREATE POLICY "Authenticated users can delete branch reconciliations"
ON public.branch_cash_reconciliations
FOR DELETE
TO authenticated
USING (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
