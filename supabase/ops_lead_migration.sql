-- =====================================================================
-- OSBIC: Ops Lead / Operations Head Role & Visibility Migration
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- =====================================================================

-- 1. Profiles Table: Add Operations Head (Ops Lead) Flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ops_head BOOLEAN DEFAULT FALSE;

-- 2. Index for high-performance role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_ops_head ON public.profiles(is_ops_head);

-- 3. RLS Policies: Allow Ops Head to Oversee All Operations Workload & PRO Steps
DO $$
BEGIN
  -- Allow Operations Head & Managers to read all jobs across team
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'ops_head_view_all_jobs'
  ) THEN
    CREATE POLICY "ops_head_view_all_jobs" ON public.jobs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_ops_head = TRUE OR p.is_manager = TRUE OR p.role = 'admin')
        )
      );
  END IF;

  -- Allow Operations Head & Managers to read all job steps / PRO tasks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'job_steps' AND policyname = 'ops_head_view_all_steps'
  ) THEN
    CREATE POLICY "ops_head_view_all_steps" ON public.job_steps
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_ops_head = TRUE OR p.is_manager = TRUE OR p.role = 'admin')
        )
      );
  -- Allow Operations Head & Managers to read walk-in daily sales across ops team
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'walkin_sales' AND policyname = 'ops_head_view_walkin_sales'
  ) THEN
    CREATE POLICY "ops_head_view_walkin_sales" ON public.walkin_sales
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_ops_head = TRUE OR p.is_manager = TRUE OR p.role = 'admin')
        )
      );
  END IF;

  -- Allow Operations Head & Managers to read client enquiries / leads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' AND policyname = 'ops_head_view_leads'
  ) THEN
    CREATE POLICY "ops_head_view_leads" ON public.leads
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_ops_head = TRUE OR p.is_manager = TRUE OR p.role = 'admin')
        )
      );
  END IF;
END $$;
