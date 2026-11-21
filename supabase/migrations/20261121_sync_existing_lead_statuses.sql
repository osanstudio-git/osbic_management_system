-- ==============================================================================
-- SYNC EXISTING LEAD STATUSES & CALL STATUSES
-- Ensures leads that were contacted via 1st Call or WhatsApp advance to 'contacted'
-- and invalid/not-interested leads advance to 'lost'.
-- ==============================================================================

-- 1. Advance leads that have been contacted to 'contacted'
UPDATE public.leads
SET status = 'contacted',
    updated_at = NOW()
WHERE (status IS NULL OR status = 'new')
  AND (
    call_status = '1st Call Done'
    OR call_status ILIKE '%whatsapp%'
    OR call_status ILIKE '%watsapp%'
  );

-- 2. Mark leads that are invalid or not interested as 'lost'
UPDATE public.leads
SET status = 'lost',
    second_followup_status = 'Lost',
    updated_at = NOW()
WHERE (status IS NULL OR status = 'new')
  AND call_status IN ('Not Interested', 'Invalid Number');

-- 3. If a lead already has status = 'contacted' but call_status is NULL or 'Pending', set default
UPDATE public.leads
SET call_status = '1st Call Done',
    updated_at = NOW()
WHERE status = 'contacted'
  AND (call_status IS NULL OR call_status = 'Pending');
