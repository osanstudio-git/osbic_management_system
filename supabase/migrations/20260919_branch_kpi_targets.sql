-- 20260919_branch_kpi_targets.sql
-- Monthly Revenue and Volume KPI Targets for Branches

CREATE TABLE IF NOT EXISTS public.branch_monthly_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    target_month DATE NOT NULL,
    revenue_target NUMERIC(12, 3) NOT NULL DEFAULT 10000.000,
    deals_target INTEGER NOT NULL DEFAULT 30,
    leads_target INTEGER DEFAULT 50,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_branch_target_month UNIQUE (branch_id, target_month)
);

-- Enable RLS
ALTER TABLE public.branch_monthly_targets ENABLE ROW LEVEL SECURITY;

-- Policies for branch_monthly_targets
DROP POLICY IF EXISTS "Authenticated users can read branch_monthly_targets" ON public.branch_monthly_targets;
CREATE POLICY "Authenticated users can read branch_monthly_targets"
ON public.branch_monthly_targets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert branch_monthly_targets" ON public.branch_monthly_targets;
CREATE POLICY "Authenticated users can insert branch_monthly_targets"
ON public.branch_monthly_targets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update branch_monthly_targets" ON public.branch_monthly_targets;
CREATE POLICY "Authenticated users can update branch_monthly_targets"
ON public.branch_monthly_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete branch_monthly_targets" ON public.branch_monthly_targets;
CREATE POLICY "Authenticated users can delete branch_monthly_targets"
ON public.branch_monthly_targets FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
