-- 20261121_alter_department_migrate.sql
-- Allow 'migrate' department in profiles_department_check constraint

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_check 
  CHECK (department IN ('sales', 'operations', 'pro', 'accounts', 'marketing', 'hr', 'migrate'));

COMMENT ON CONSTRAINT profiles_department_check ON public.profiles IS 'Allowed departments: sales, operations, pro, accounts, marketing, hr, migrate';
