-- -------------------------------------------------------------------
-- OSBIC: Walk-in Daily Sales Table
-- Run this in Supabase SQL Editor
-- -------------------------------------------------------------------

-- 1. Create the walkin_sales table
CREATE TABLE IF NOT EXISTS public.walkin_sales (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id           UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name         TEXT NOT NULL,
  client_phone        TEXT,
  work_type           TEXT NOT NULL,
  work_description    TEXT,
  payment_mode        TEXT NOT NULL DEFAULT 'cash'
                        CHECK (payment_mode IN ('cash', 'card', 'bank_transfer')),
  total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  government_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit              NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes               TEXT,
  client_receipt_url  TEXT,
  gov_fee_receipt_url TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_walkin_sales_employee_id ON public.walkin_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_walkin_sales_branch_id   ON public.walkin_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_walkin_sales_date        ON public.walkin_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_walkin_sales_status      ON public.walkin_sales(status);

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_walkin_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_walkin_sales_updated_at ON public.walkin_sales;
CREATE TRIGGER trg_walkin_sales_updated_at
  BEFORE UPDATE ON public.walkin_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_walkin_sales_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.walkin_sales ENABLE ROW LEVEL SECURITY;

-- Employees: own records only
CREATE POLICY "employees_own_sales" ON public.walkin_sales
  FOR ALL
  USING (auth.uid() = employee_id)
  WITH CHECK (auth.uid() = employee_id);

-- Branch Managers: see entire branch
CREATE POLICY "managers_see_branch_sales" ON public.walkin_sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_manager = TRUE
        AND p.branch_id = walkin_sales.branch_id
    )
  );

-- Admins: full access
CREATE POLICY "admins_full_access_sales" ON public.walkin_sales
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 5. Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.walkin_sales TO authenticated;

SELECT 'walkin_sales table created successfully' AS result;