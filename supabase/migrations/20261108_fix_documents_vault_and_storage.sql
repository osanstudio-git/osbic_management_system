-- =============================================================================
-- Migration: Fix Documents RLS and Supabase Storage Bucket Configuration
-- Run this in your Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Ensure the 'documents' storage bucket exists and is publicly accessible
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Objects: Allow authenticated staff to upload, read, update, delete
DROP POLICY IF EXISTS "Give authenticated users full access to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload to documents bucket" ON storage.objects;

CREATE POLICY "Give authenticated users full access to documents bucket"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 3. Storage Objects: Allow reading files from documents bucket
DROP POLICY IF EXISTS "Give public read access to documents bucket" ON storage.objects;

CREATE POLICY "Give public read access to documents bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- 4. Fix Database RLS on public.documents table:
-- Drop overly restrictive legacy policies that only allowed the primary job officer
DROP POLICY IF EXISTS "Employees access docs for assigned jobs" ON public.documents;
DROP POLICY IF EXISTS "Employees have full access to documents" ON public.documents;

-- Create policy allowing all company staff (employees, managers, admins, ops) to view & manage documents
CREATE POLICY "Employees have full access to documents"
ON public.documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'employee', 'pro') OR can_do_ops = true OR can_do_sales = true OR is_manager = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'employee', 'pro') OR can_do_ops = true OR can_do_sales = true OR is_manager = true)
  )
);
