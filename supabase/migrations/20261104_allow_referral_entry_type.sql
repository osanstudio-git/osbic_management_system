-- 20261104_allow_referral_entry_type.sql
-- Expand jobs.entry_type check constraint to permit 'referral' and 'other', and add referral_name to jobs.

DO $$
BEGIN
  -- Drop old constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_entry_type_check'
  ) THEN
    ALTER TABLE public.jobs DROP CONSTRAINT jobs_entry_type_check;
  END IF;

  -- Add updated constraint with referral and other
  ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_entry_type_check 
    CHECK (entry_type IN ('direct', 'lead', 'walkin', 'renewal', 'referral', 'other'));

  -- Add referral_name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'referral_name'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN referral_name TEXT DEFAULT NULL;
  END IF;
END $$;
