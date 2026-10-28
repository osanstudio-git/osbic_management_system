-- =====================================================================
-- OSBIC: Ops Lead / Operations Head Role Migration
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- =====================================================================

-- 1. Profiles Table: Add Operations Head (Ops Lead) Flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ops_head BOOLEAN DEFAULT FALSE;

-- 2. Index for high performance queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_ops_head ON public.profiles(is_ops_head);
