-- =============================================================================
-- Migration: Add Employee 360 Dossier & Extended HR Architecture
-- Enhances profiles with identity, WPS payroll, contract, and employee documents
-- =============================================================================

-- 1. Profiles Table: Add Extended Personal, WPS, and Contract Fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS residence_address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS probation_end_date DATE,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS labor_card_number TEXT,
  ADD COLUMN IF NOT EXISTS labor_card_expiry DATE,
  ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

COMMENT ON COLUMN public.profiles.nationality IS 'Employee nationality / citizenship';
COMMENT ON COLUMN public.profiles.blood_group IS 'Emergency medical blood group';
COMMENT ON COLUMN public.profiles.contract_type IS 'Employment contract type: full_time, probation, part_time, remote';
COMMENT ON COLUMN public.profiles.bank_iban IS 'International Bank Account Number for WPS compliance in Oman';

-- 2. Employee Documents Table (Official Employee Vault)
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('civil_id', 'passport', 'visa', 'labor_contract', 'academic_cert', 'driving_license', 'other')),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_docs_type ON public.employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_docs_expiry ON public.employee_documents(expiry_date);

-- Enable RLS on employee_documents
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own docs or HR/Admin read all docs"
  ON public.employee_documents FOR SELECT
  USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "HR and Admins can insert employee docs"
  ON public.employee_documents FOR INSERT
  WITH CHECK (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "HR and Admins can update employee docs"
  ON public.employee_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.department = 'hr'
      )
    )
  );

CREATE POLICY "HR and Admins can delete employee docs"
  ON public.employee_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.role = 'admin' OR 
        p.is_manager = true OR 
        p.department = 'hr'
      )
    )
  );
