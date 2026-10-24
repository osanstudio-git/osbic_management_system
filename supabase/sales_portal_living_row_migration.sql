-- =====================================================================
-- OSBIC: Sales Employee Portal - Living Deal Row & Role Hierarchy Migration
-- Run this in Supabase SQL Editor
-- =====================================================================

-- 1. Profiles Table: Add Sales Head & Lead Coordinator (Reassignment) Roles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sales_head BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_assign_leads BOOLEAN DEFAULT FALSE;

-- 2. Leads Table: Add Single Living Row Deal Columns
-- Phase 1 & Outreach
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS service_required TEXT,
  ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS first_call_notes TEXT,
  ADD COLUMN IF NOT EXISTS second_followup_status TEXT,
  ADD COLUMN IF NOT EXISTS note_2nd TEXT,
  ADD COLUMN IF NOT EXISTS final_notes TEXT;

-- Phase 2: Pipeline / Forecast
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS quote_date DATE,
  ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_govt_fee NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_profit NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Phase 3: Closed Sale & Net Profit
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS conversion_date DATE,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS govt_fee NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit NUMERIC(12,3) DEFAULT 0;

-- Lead Reassignment Tracking (Sandra / Lead Coordinator Role)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reassigned_from_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_reassigned TIMESTAMPTZ;

-- 3. Automatic Calculation Trigger for Net Profit & Expected Profit
CREATE OR REPLACE FUNCTION public.calculate_lead_profits()
RETURNS TRIGGER AS $$
BEGIN
  -- Net Profit = Total Sale Amount - Govt Fee
  NEW.profit := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.govt_fee, 0);
  
  -- Pipeline Expected Profit = Quoted Amount - Expected Govt Fee
  NEW.expected_profit := COALESCE(NEW.quoted_amount, 0) - COALESCE(NEW.expected_govt_fee, 0);

  -- Auto-mark status as converted if conversion_date or total_amount > 0 and status is not yet converted
  IF (NEW.conversion_date IS NOT NULL OR (NEW.total_amount > 0 AND NEW.payment_mode IS NOT NULL)) 
     AND NEW.status != 'converted' THEN
    NEW.status := 'converted';
    IF NEW.converted_at IS NULL THEN
      NEW.converted_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_lead_profits ON public.leads;
CREATE TRIGGER trg_calculate_lead_profits
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_lead_profits();

-- 4. Indexes for fast filtering and reporting
CREATE INDEX IF NOT EXISTS idx_leads_call_status ON public.leads(call_status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_is_reassigned ON public.leads(is_reassigned);
CREATE INDEX IF NOT EXISTS idx_leads_conversion_date ON public.leads(conversion_date DESC);
CREATE INDEX IF NOT EXISTS idx_leads_quote_date ON public.leads(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_sales_head ON public.profiles(is_sales_head);
CREATE INDEX IF NOT EXISTS idx_profiles_can_assign_leads ON public.profiles(can_assign_leads);

-- 5. RLS Policies: Allow Sales Head to view all leads, and Lead Coordinator to reassign leads
DO $$
BEGIN
  -- Allow Sales Head full visibility on leads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' AND policyname = 'sales_head_all_leads'
  ) THEN
    CREATE POLICY "sales_head_all_leads" ON public.leads
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_sales_head = TRUE OR p.role = 'admin')
        )
      );
  END IF;

  -- Allow Lead Coordinator (can_assign_leads) to view all leads to coordinate distribution
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' AND policyname = 'coordinator_view_leads'
  ) THEN
    CREATE POLICY "coordinator_view_leads" ON public.leads
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.can_assign_leads = TRUE
        )
      );
  END IF;
END $$;
