-- =============================================================================
-- Migration: HR & Administration Portal Foundation
-- Adds HR employee fields, leave management, attendance tracking, and gov supplier tracking
-- =============================================================================

-- 1. Profiles Table: Add HR and Compliance Fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS date_of_joining DATE,
  ADD COLUMN IF NOT EXISTS leave_balance NUMERIC DEFAULT 30,
  ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visa_expiry DATE,
  ADD COLUMN IF NOT EXISTS civil_id_expiry DATE,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

COMMENT ON COLUMN public.profiles.job_title IS 'Employee designation / job role (e.g. Sales Consultant, PRO Officer, Accountant)';
COMMENT ON COLUMN public.profiles.leave_balance IS 'Annual leave days balance remaining';
COMMENT ON COLUMN public.profiles.visa_expiry IS 'Resident / work visa expiry date for automated compliance alerts';
COMMENT ON COLUMN public.profiles.civil_id_expiry IS 'National / Resident Civil ID expiry date';

-- 2. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'emergency', 'unpaid', 'maternity', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  attachment_url TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- Enable RLS on leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own leave requests or HR/Admins read all"
  ON public.leave_requests FOR SELECT
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

CREATE POLICY "Employees can submit leave requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "HR, Managers and Admins can update leave requests"
  ON public.leave_requests FOR UPDATE
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

-- 3. Attendance Logs Table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'half_day', 'on_leave', 'remote')),
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_logs(date);

-- Enable RLS on attendance_logs
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance or HR/Admin view all"
  ON public.attendance_logs FOR SELECT
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

CREATE POLICY "Employees or HR can log attendance"
  ON public.attendance_logs FOR INSERT
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

CREATE POLICY "HR and Admins can update attendance"
  ON public.attendance_logs FOR UPDATE
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

-- 4. Job Services: Government & Supplier Outflow Tracking
ALTER TABLE public.job_services
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS gov_fee_actual_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gov_payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS gov_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gov_paid_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS gov_receipt_url TEXT;

COMMENT ON COLUMN public.job_services.supplier_name IS 'Target government or supplier entity (e.g. MOCIIP, ROP, MOL, OCCI, Sanad)';
COMMENT ON COLUMN public.job_services.gov_fee_actual_paid IS 'Actual amount paid to government or supplier for this service';
COMMENT ON COLUMN public.job_services.gov_receipt_url IS 'Direct link to the uploaded official payment voucher or bank debit receipt';
