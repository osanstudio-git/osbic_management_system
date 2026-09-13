-- 20260913_fix_employee_marketing_and_auth.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure all role columns exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_do_marketing BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_do_sales BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_do_ops BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_do_accounts BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 2. Update department check constraint to include 'marketing'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_check 
  CHECK (department IN ('sales', 'operations', 'pro', 'accounts', 'marketing'));

-- 3. Function to permanently delete an employee identity from auth.users and public.profiles
CREATE OR REPLACE FUNCTION public.delete_user_identity(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Function to cleanup user by email if orphaned or stuck
CREATE OR REPLACE FUNCTION public.delete_user_by_email(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(trim(target_email));
  IF uid IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
  ELSE
    DELETE FROM public.profiles WHERE lower(email) = lower(trim(target_email));
  END IF;
END;
$$;

-- 4. Atomic RPC to create/link an employee in auth.users and public.profiles simultaneously
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT 'operations',
  p_branch_id UUID DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_is_manager BOOLEAN DEFAULT false,
  p_can_do_sales BOOLEAN DEFAULT false,
  p_can_do_ops BOOLEAN DEFAULT true,
  p_can_do_accounts BOOLEAN DEFAULT false,
  p_can_do_marketing BOOLEAN DEFAULT false,
  p_is_pro BOOLEAN DEFAULT false,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  existing_id UUID;
  result_profile RECORD;
  clean_email TEXT;
BEGIN
  clean_email := lower(trim(p_email));

  -- Check if user already exists in auth.users
  SELECT id INTO existing_id FROM auth.users WHERE lower(email) = clean_email;

  IF existing_id IS NOT NULL THEN
    -- If user exists in auth.users (e.g. from previous failed attempt), update password and confirm
    new_user_id := existing_id;
    UPDATE auth.users
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', 'employee'),
      updated_at = now()
    WHERE id = new_user_id;
  ELSE
    -- Create new user in auth.users
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      clean_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'employee'),
      now(),
      now()
    );
  END IF;

  -- Upsert Profile atomically
  INSERT INTO public.profiles (
    id, full_name, email, phone, role, department, 
    is_active, is_manager, can_do_sales, can_do_ops, 
    can_do_accounts, can_do_marketing, is_pro, 
    branch_id, company_name, avatar_url, updated_at
  ) VALUES (
    new_user_id,
    p_full_name,
    clean_email,
    p_phone,
    'employee',
    p_department,
    true,
    COALESCE(p_is_manager, false),
    COALESCE(p_can_do_sales, false),
    COALESCE(p_can_do_ops, true),
    COALESCE(p_can_do_accounts, false),
    COALESCE(p_can_do_marketing, false),
    COALESCE(p_is_pro, false),
    p_branch_id,
    p_company_name,
    p_avatar_url,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = 'employee',
    department = EXCLUDED.department,
    is_active = true,
    is_manager = EXCLUDED.is_manager,
    can_do_sales = EXCLUDED.can_do_sales,
    can_do_ops = EXCLUDED.can_do_ops,
    can_do_accounts = EXCLUDED.can_do_accounts,
    can_do_marketing = EXCLUDED.can_do_marketing,
    is_pro = EXCLUDED.is_pro,
    branch_id = EXCLUDED.branch_id,
    company_name = EXCLUDED.company_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now()
  RETURNING * INTO result_profile;

  RETURN to_jsonb(result_profile);
END;
$$;
