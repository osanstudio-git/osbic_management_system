-- Migration: Ensure 'cancelled' is permitted in leads.status
-- Drops any strict check constraint and allows both 'cancelled' and 'lost'

DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_status_check'
  ) THEN
    ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
  END IF;

  -- Re-add check constraint supporting 'cancelled'
  ALTER TABLE public.leads 
    ADD CONSTRAINT leads_status_check 
    CHECK (status IN (
      'new', 'contacted', 'interested', 'on_progress', 
      'qualified', 'quoted', 'negotiating', 'converted', 
      'cancelled', 'lost', 'on_hold'
    ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Handled constraint update: %', SQLERRM;
END $$;
