-- Migration: Update jobs_entry_type_check to allow 'referral' and 'other' in jobs table
DO $$
BEGIN
  -- Drop existing constraint if present
  ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_entry_type_check;
  
  -- Add updated check constraint supporting all intake entry types
  ALTER TABLE public.jobs ADD CONSTRAINT jobs_entry_type_check 
    CHECK (entry_type IN ('direct', 'lead', 'walkin', 'renewal', 'referral', 'other'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or already applied: %', SQLERRM;
END $$;
