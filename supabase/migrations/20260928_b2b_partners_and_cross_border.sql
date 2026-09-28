-- Migration: Add B2B Partners table and cross-border tracking to leads & invoices

CREATE TABLE IF NOT EXISTS b2b_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'KSA', -- 'KSA' | 'OMN' | 'OTHER'
  partner_type TEXT NOT NULL DEFAULT 'execution', -- 'execution' | 'sales_referral' | 'hybrid'
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 0, -- percentage share or fixed rate
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE b2b_partners IS 'Stores Saudi & International B2B partner firms for subcontracting & lead referrals';

-- Add B2B cross-border columns to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS b2b_partner_id UUID REFERENCES b2b_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS b2b_flow_type TEXT DEFAULT NULL, -- 'outbound_saudi_exec' | 'inbound_oman_exec'
  ADD COLUMN IF NOT EXISTS partner_cost NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_notes TEXT;

-- Add B2B cross-border columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS b2b_partner_id UUID REFERENCES b2b_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS b2b_flow_type TEXT DEFAULT NULL, -- 'outbound_saudi_exec' | 'inbound_oman_exec'
  ADD COLUMN IF NOT EXISTS partner_cost NUMERIC(12,3) DEFAULT 0;

-- RLS policies for b2b_partners
ALTER TABLE b2b_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read b2b_partners"
  ON b2b_partners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert b2b_partners"
  ON b2b_partners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update b2b_partners"
  ON b2b_partners FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete b2b_partners"
  ON b2b_partners FOR DELETE
  TO authenticated
  USING (true);
