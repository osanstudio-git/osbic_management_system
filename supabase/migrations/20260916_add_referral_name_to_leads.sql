-- 20260916_add_referral_name_to_leads.sql
-- Adds a referral_name column to the leads table.
-- When a lead's source is "Referral", this field stores the name
-- of the person who referred them (e.g. existing client, partner, employee).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referral_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.leads.referral_name IS
  'The name of the person who referred this lead (only populated when source is Referral).';
