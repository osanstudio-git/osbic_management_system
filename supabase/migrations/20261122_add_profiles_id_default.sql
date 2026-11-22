-- Migration: Ensure public.profiles.id has a default gen_random_uuid()
-- This prevents "null value in column 'id' of relation 'profiles' violates not-null constraint"
-- if an insert omits an explicit ID.

ALTER TABLE public.profiles 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
