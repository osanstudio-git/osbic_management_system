-- 20260914_admin_update_employee_email.sql
-- Atomic RPC function to update employee profile & sync auth.users / auth.identities login email

CREATE OR REPLACE FUNCTION public.admin_update_employee(
  target_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_is_manager BOOLEAN DEFAULT NULL,
  p_can_do_sales BOOLEAN DEFAULT NULL,
  p_can_do_ops BOOLEAN DEFAULT NULL,
  p_can_do_accounts BOOLEAN DEFAULT NULL,
  p_can_do_marketing BOOLEAN DEFAULT NULL,
  p_is_pro BOOLEAN DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_email TEXT;
  existing_user_id UUID;
  result_profile RECORD;
BEGIN
  -- 1. Handle Email Sync if provided
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    clean_email := lower(trim(p_email));
    
    -- Check if new email is already in use by ANOTHER user in auth.users
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE lower(email) = clean_email AND id <> target_user_id;

    IF existing_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'This email address (%) is already registered to another user.', clean_email;
    END IF;

    -- Update auth.users email and confirm it
    UPDATE auth.users
    SET 
      email = clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', COALESCE(p_full_name, raw_user_meta_data->>'full_name')),
      updated_at = now()
    WHERE id = target_user_id;

    -- Update or Insert auth.identities to keep GoTrue synced
    IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = target_user_id AND provider = 'email') THEN
      UPDATE auth.identities
      SET 
        identity_data = jsonb_build_object('sub', target_user_id::text, 'email', clean_email),
        updated_at = now()
      WHERE user_id = target_user_id AND provider = 'email';
    ELSE
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
        gen_random_uuid(),
        target_user_id,
        jsonb_build_object('sub', target_user_id::text, 'email', clean_email),
        'email',
        target_user_id::text,
        now(),
        now(),
        now()
      );
    END IF;
  END IF;

  -- 2. Update public.profiles
  UPDATE public.profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(clean_email, email),
    phone = COALESCE(p_phone, phone),
    department = COALESCE(p_department, department),
    branch_id = COALESCE(p_branch_id, branch_id),
    company_name = COALESCE(p_company_name, company_name),
    is_manager = COALESCE(p_is_manager, is_manager),
    can_do_sales = COALESCE(p_can_do_sales, can_do_sales),
    can_do_ops = COALESCE(p_can_do_ops, can_do_ops),
    can_do_accounts = COALESCE(p_can_do_accounts, can_do_accounts),
    can_do_marketing = COALESCE(p_can_do_marketing, can_do_marketing),
    is_pro = COALESCE(p_is_pro, is_pro),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = target_user_id
  RETURNING * INTO result_profile;

  RETURN to_jsonb(result_profile);
END;
$$;
