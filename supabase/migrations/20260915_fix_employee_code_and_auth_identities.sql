-- 20260915_fix_employee_code_and_auth_identities.sql

-- 1. FIX EMPLOYEE CODE GENERATOR TRIGGER
-- Ensures employee codes increment monotonically across all legacy/new branch prefixes (EMP-GHAL-027, etc.)
CREATE OR REPLACE FUNCTION public.generate_profile_code()
RETURNS TRIGGER AS $$
DECLARE
    b_code TEXT;
    seq_number INT;
BEGIN
    -- For Employees: EMP-[BRANCH]-[000] starting at 011
    IF NEW.role = 'employee' AND (NEW.employee_code IS NULL OR NEW.employee_code = '' OR NEW.employee_code = 'EMP-NEW') THEN
        -- Get branch code
        SELECT COALESCE(code, 'GHAL') INTO b_code FROM public.branches WHERE id = NEW.branch_id;
        IF b_code IS NULL THEN b_code := 'GHAL'; END IF;
        
        -- Lock to prevent race condition
        PERFORM pg_advisory_xact_lock(hashtext('profile_emp_' || b_code));
        
        -- Get next sequence across ALL employees regardless of GHAL / GHL variation
        SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '^EMP-[A-Za-z]+-', ''), '')::INT), 10) + 1 INTO seq_number
        FROM public.profiles
        WHERE role = 'employee' 
          AND employee_code SIMILAR TO 'EMP-[A-Za-z]+-[0-9]+';
        
        NEW.employee_code := 'EMP-' || b_code || '-' || lpad(seq_number::TEXT, 3, '0');
        
    -- For Clients: CLT-[BRANCH]-[0000]
    ELSIF NEW.role = 'client' AND (NEW.client_code IS NULL OR NEW.client_code = '') THEN
        -- Resolve branch_id from creator profile if null
        IF NEW.branch_id IS NULL AND NEW.created_by IS NOT NULL THEN
            SELECT branch_id INTO NEW.branch_id FROM public.profiles WHERE id = NEW.created_by;
        END IF;

        -- Get branch code
        SELECT COALESCE(code, 'GHAL') INTO b_code FROM public.branches WHERE id = NEW.branch_id;
        IF b_code IS NULL THEN b_code := 'GHAL'; END IF;
        
        -- Lock to prevent race condition
        PERFORM pg_advisory_xact_lock(hashtext('profile_clt_' || b_code));
        
        -- Get next sequence across all clients matching CLT prefix
        SELECT COALESCE(MAX(NULLIF(regexp_replace(client_code, '^CLT-[A-Za-z]+-', ''), '')::INT), 0) + 1 INTO seq_number
        FROM public.profiles
        WHERE role = 'client' 
          AND client_code SIMILAR TO 'CLT-[A-Za-z]+-[0-9]+';
        
        NEW.client_code := 'CLT-' || b_code || '-' || lpad(seq_number::TEXT, 4, '0');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. REPAIR ALL AUTH USERS & IDENTITIES FOR GOTRUE COMPLIANCE
-- Fixes GoTrue 500 Internal Server Error on /auth/v1/token and /auth/v1/recover

-- Ensure email_confirmed_at is set for all users
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  aud = 'authenticated',
  role = 'authenticated',
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb
WHERE email_confirmed_at IS NULL OR role IS NULL OR role <> 'authenticated';

-- Re-sync auth.identities records with correct GoTrue format (id = user_id)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', lower(u.email),
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = jsonb_build_object(
    'sub', EXCLUDED.user_id::text,
    'email', lower(EXCLUDED.identity_data->>'email'),
    'email_verified', true,
    'phone_verified', false
  ),
  updated_at = now();


-- 3. UPDATED ADMIN CREATE EMPLOYEE RPC
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
    new_user_id := existing_id;
    UPDATE auth.users
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', 'employee'),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      aud = 'authenticated',
      role = 'authenticated',
      updated_at = now()
    WHERE id = new_user_id;
  ELSE
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
      crypt(p_password, gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'employee'),
      now(),
      now()
    );
  END IF;

  -- Ensure auth.identities exists with user_id as id and email_verified=true
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = new_user_id AND provider = 'email') THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', true, 'phone_verified', false),
      'email',
      new_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.identities
    SET 
      identity_data = jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', true, 'phone_verified', false),
      updated_at = now()
    WHERE user_id = new_user_id AND provider = 'email';
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


-- 4. UPDATED ADMIN PASSWORD RESET RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_password(target_user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_email TEXT;
BEGIN
  -- Fetch user email
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    SELECT email INTO target_email FROM public.profiles WHERE id = target_user_id;
  END IF;

  -- 1. Update encrypted password and ensure confirmation in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    aud = 'authenticated',
    role = 'authenticated',
    updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  -- 2. Ensure auth.identities exists and is GoTrue compliant
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = target_user_id AND provider = 'email') THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      target_user_id,
      jsonb_build_object('sub', target_user_id::text, 'email', target_email, 'email_verified', true, 'phone_verified', false),
      'email',
      target_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.identities
    SET 
      identity_data = jsonb_build_object('sub', target_user_id::text, 'email', target_email, 'email_verified', true, 'phone_verified', false),
      updated_at = now()
    WHERE user_id = target_user_id AND provider = 'email';
  END IF;
END;
$$;
