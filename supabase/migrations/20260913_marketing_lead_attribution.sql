-- 20260913_marketing_lead_attribution.sql
-- Add Marketing & Ad Campaign Attribution columns to leads table

DO $$
BEGIN
    -- Add utm_source
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_source') THEN
        ALTER TABLE public.leads ADD COLUMN utm_source TEXT;
    END IF;

    -- Add utm_medium
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_medium') THEN
        ALTER TABLE public.leads ADD COLUMN utm_medium TEXT;
    END IF;

    -- Add utm_campaign
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_campaign') THEN
        ALTER TABLE public.leads ADD COLUMN utm_campaign TEXT;
    END IF;

    -- Add utm_term
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_term') THEN
        ALTER TABLE public.leads ADD COLUMN utm_term TEXT;
    END IF;

    -- Add utm_content
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_content') THEN
        ALTER TABLE public.leads ADD COLUMN utm_content TEXT;
    END IF;

    -- Add gclid (Google Click ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'gclid') THEN
        ALTER TABLE public.leads ADD COLUMN gclid TEXT;
    END IF;

    -- Add fbclid (Facebook Click ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'fbclid') THEN
        ALTER TABLE public.leads ADD COLUMN fbclid TEXT;
    END IF;

    -- Add leadgen_id (Meta Lead ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'leadgen_id') THEN
        ALTER TABLE public.leads ADD COLUMN leadgen_id TEXT;
    END IF;

    -- Add landing_page_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'landing_page_url') THEN
        ALTER TABLE public.leads ADD COLUMN landing_page_url TEXT;
    END IF;

    -- Add form_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'form_id') THEN
        ALTER TABLE public.leads ADD COLUMN form_id TEXT;
    END IF;

    -- Add ip_country
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ip_country') THEN
        ALTER TABLE public.leads ADD COLUMN ip_country TEXT;
    END IF;

    -- Add can_do_marketing to profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'can_do_marketing') THEN
        ALTER TABLE public.profiles ADD COLUMN can_do_marketing BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure default lead sources exist
INSERT INTO public.lead_sources (id, name, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Google Ads', true),
    ('c2222222-2222-2222-2222-222222222222', 'Meta Ads (FB/IG)', true),
    ('c3333333-3333-3333-3333-333333333333', 'Website (setup.osbic.net)', true),
    ('c4444444-4444-4444-4444-444444444444', 'WhatsApp Direct', true),
    ('c5555555-5555-5555-5555-555555555555', 'Referral', true),
    ('c6666666-6666-6666-6666-666666666666', 'Walk-in', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;
