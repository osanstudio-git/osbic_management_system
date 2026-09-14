-- 20260914_update_activity_license_gov_fee.sql
-- Update Activity License Government Fee from 78.050 to 78.500 OMR

UPDATE public.services
SET 
  default_ministry_fee = 78.500,
  ministry_fee = 78.500,
  updated_at = now()
WHERE id = 'b28c89de-0e0e-473d-9d41-9a74288b8e04'
   OR lower(name_en) = 'activity license';
