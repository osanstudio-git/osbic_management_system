-- 20260913_alter_department_marketing.sql
-- Add 'marketing' to allowed department values in profiles table

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_check CHECK (department IN ('sales', 'operations', 'pro', 'accounts', 'marketing'));
