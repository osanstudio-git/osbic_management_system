-- Migration: Add date_of_birth, gender, and show_birthday_to_team to profiles table

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS show_birthday_to_team BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.date_of_birth IS 'Employee date of birth for celebrations and milestone recognition';
COMMENT ON COLUMN profiles.gender IS 'Employee gender (male or female) for customized respectful greetings';
COMMENT ON COLUMN profiles.show_birthday_to_team IS 'Privacy preference whether to broadcast birthday (month and day only) to colleagues';
