-- ==============================================================================
-- Migration: Add Saudi B2B & Cross-Border Execution Enhancements
-- Adds B2B partner linking to profiles & jobs, and tracking for Saudi/Oman flows
-- ==============================================================================

-- 1. Profiles: Link client to originating B2B Partner / Agent
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS b2b_partner_id UUID REFERENCES public.b2b_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_saudi_client BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saudi_city TEXT;

COMMENT ON COLUMN public.profiles.b2b_partner_id IS 'B2B Partner or agent who introduced this client';
COMMENT ON COLUMN public.profiles.is_saudi_client IS 'Flag for clients originating from or operating in Saudi Arabia';

-- 2. Jobs: Support cross-border execution, B2B partner link, currency & Gov Fee tracking
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS b2b_partner_id UUID REFERENCES public.b2b_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS b2b_flow_type TEXT CHECK (b2b_flow_type IN ('inbound_oman_exec', 'outbound_saudi_exec')),
  ADD COLUMN IF NOT EXISTS partner_cost NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS osbic_profit_share NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saudi_partner_status TEXT DEFAULT 'pending' CHECK (saudi_partner_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'OMR',
  ADD COLUMN IF NOT EXISTS currency_rate NUMERIC(10,4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS quoted_sar_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oman_gov_fee_omr NUMERIC(12,3) DEFAULT 0;

COMMENT ON COLUMN public.jobs.b2b_flow_type IS 'inbound_oman_exec = Saudi to Oman (Oman Ops executes) | outbound_saudi_exec = Oman to Saudi (KSA ground team executes)';
COMMENT ON COLUMN public.jobs.saudi_partner_status IS 'Status of KSA ground execution for outbound jobs';
COMMENT ON COLUMN public.jobs.oman_gov_fee_omr IS 'Oman Ministry government fees calculated in OMR';

-- 3. Invoices: Ensure currency & SAR amount support
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'OMR',
  ADD COLUMN IF NOT EXISTS currency_rate NUMERIC(10,4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS quoted_sar_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oman_gov_fee_omr NUMERIC(12,3) DEFAULT 0;

-- 4. Create Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_profiles_b2b_partner ON public.profiles(b2b_partner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_b2b_partner ON public.jobs(b2b_partner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_b2b_flow_type ON public.jobs(b2b_flow_type);
