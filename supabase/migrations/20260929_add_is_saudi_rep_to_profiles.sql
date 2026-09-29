-- Migration: Add is_saudi_rep column to profiles table for Saudi & GCC Sales Representatives

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_saudi_rep BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_saudi_rep IS 'Flag indicating if the employee is a dedicated Saudi & GCC B2B Sales Representative';
