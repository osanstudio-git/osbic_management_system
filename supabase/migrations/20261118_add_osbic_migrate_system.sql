-- ==============================================================================
-- Migration: OSBIC MIGRATE Division Foundations (Golden Visa & Global Tourist Visa)
-- ==============================================================================

-- 1. Profiles: Support 'migrate' department and migrate specialization
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_migrate_specialist BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migrate_specialty TEXT CHECK (migrate_specialty IN ('golden_visa', 'global_visa', 'both'));

COMMENT ON COLUMN public.profiles.is_migrate_specialist IS 'Flag identifying employees belonging to OSBIC MIGRATE division';
COMMENT ON COLUMN public.profiles.migrate_specialty IS 'Specialization: golden_visa, global_visa, or both';

-- 2. Jobs: Specialized fields for Golden Visa & Global Tourist Visa pipelines
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS migrate_category TEXT CHECK (migrate_category IN ('golden_visa', 'global_visa')),
  ADD COLUMN IF NOT EXISTS golden_route TEXT CHECK (golden_route IN ('fixed_deposit', 'itc_property', 'omani_employees_50', 'company_assets')),
  ADD COLUMN IF NOT EXISTS audit_report_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '50_50' CHECK (payment_terms IN ('50_50', 'full')),
  ADD COLUMN IF NOT EXISTS golden_approval_status TEXT DEFAULT 'pending' CHECK (golden_approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS golden_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_card_status TEXT DEFAULT 'pending' CHECK (id_card_status IN ('pending', 'issued')),
  ADD COLUMN IF NOT EXISTS id_card_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visa_category TEXT CHECK (visa_category IN ('schengen_29', 'usa_uk', 'gcc_visit', 'oman_family')),
  ADD COLUMN IF NOT EXISTS destination_country TEXT,
  ADD COLUMN IF NOT EXISTS embassy_fee_mode TEXT CHECK (embassy_fee_mode IN ('paid_to_osbic', 'client_direct', 'at_embassy')),
  ADD COLUMN IF NOT EXISTS has_dummy_ticket BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_dummy_hotel BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS travel_date DATE,
  ADD COLUMN IF NOT EXISTS embassy_outcome TEXT CHECK (embassy_outcome IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS embassy_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS lead_source_type TEXT DEFAULT 'social_ads' CHECK (lead_source_type IN ('social_ads', 'reference', 'branch_walkin', 'direct'));

-- 3. Leads: Support lead source attribution and migrate interest
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS migrate_category TEXT CHECK (migrate_category IN ('golden_visa', 'global_visa')),
  ADD COLUMN IF NOT EXISTS lead_source_type TEXT DEFAULT 'social_ads' CHECK (lead_source_type IN ('social_ads', 'reference', 'branch_walkin', 'direct'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_migrate ON public.profiles(is_migrate_specialist, migrate_specialty);
CREATE INDEX IF NOT EXISTS idx_jobs_migrate_category ON public.jobs(migrate_category);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_source_type ON public.jobs(lead_source_type);

