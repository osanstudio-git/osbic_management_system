-- 20261119_marketing_lead_quality_and_visa_radar.sql
-- Add lead quality classification and Oman visa compliance tracking columns

DO $$
BEGIN
    -- Add quality_status ('unreviewed', 'quality_lead', 'disqualified')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'quality_status') THEN
        ALTER TABLE public.leads ADD COLUMN quality_status TEXT DEFAULT 'unreviewed';
    END IF;

    -- Add disqualification_reason (e.g. 'oman_visa_ban', 'no_answer', 'wrong_number', etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'disqualification_reason') THEN
        ALTER TABLE public.leads ADD COLUMN disqualification_reason TEXT;
    END IF;

    -- Add disqualified_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'disqualified_at') THEN
        ALTER TABLE public.leads ADD COLUMN disqualified_at TIMESTAMPTZ;
    END IF;

    -- Add first_called_at (when first contact or call was placed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'first_called_at') THEN
        ALTER TABLE public.leads ADD COLUMN first_called_at TIMESTAMPTZ;
    END IF;

    -- Add speed_to_lead_mins (duration in minutes between created_at and first_called_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'speed_to_lead_mins') THEN
        ALTER TABLE public.leads ADD COLUMN speed_to_lead_mins INTEGER;
    END IF;
END $$;

