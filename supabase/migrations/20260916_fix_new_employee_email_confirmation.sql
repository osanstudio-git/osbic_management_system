-- 20260916_fix_new_employee_email_confirmation.sql
-- 
-- ROOT CAUSE: When guestClient.auth.signUp() creates a new employee,
-- Supabase sets email_confirmed_at = NULL (email confirmation pending).
-- GoTrue then rejects login attempts with HTTP 500.
-- This script confirms all outstanding unconfirmed accounts.
--
-- Going forward, the application code always calls admin_create_employee RPC
-- after signUp, which sets email_confirmed_at = now() immediately.

-- 1. Confirm all unconfirmed auth.users that have a profile (employees/clients)
UPDATE auth.users u
SET
  email_confirmed_at = now(),
  aud = 'authenticated',
  role = 'authenticated',
  raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
  updated_at = now()
WHERE u.email_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

-- 2. Insert missing auth.identities for all users linked to a profile
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id, u.id,
  jsonb_build_object(
    'sub', u.id::text, 'email', lower(u.email),
    'email_verified', true, 'phone_verified', false
  ),
  'email', u.id::text, now(), now(), now()
FROM auth.users u
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  )
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = jsonb_build_object(
    'sub', EXCLUDED.user_id::text,
    'email', lower(EXCLUDED.identity_data->>'email'),
    'email_verified', true, 'phone_verified', false
  ),
  updated_at = now();

-- 3. Patch existing identities missing email_verified = true
UPDATE auth.identities
SET
  identity_data = identity_data
    || jsonb_build_object('email_verified', true, 'phone_verified', false),
  updated_at = now()
WHERE provider = 'email'
  AND (
    identity_data->>'email_verified' IS DISTINCT FROM 'true'
    OR identity_data->>'phone_verified' IS NULL
  )
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id);
