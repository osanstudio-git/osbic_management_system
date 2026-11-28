-- ==============================================================================
-- Migration: Biometric Punch Clock & Monthly Attendance Summary System
-- Supports OSBIC Biometric Punch sheet imports (.csv, .xls, .xlsx)
-- ==============================================================================

-- 1. Extend attendance_logs with biometric extraction fields
ALTER TABLE IF EXISTS public.attendance_logs
  ADD COLUMN IF NOT EXISTS duty_time TEXT,
  ADD COLUMN IF NOT EXISTS planned_hours TEXT,
  ADD COLUMN IF NOT EXISTS actual_hours TEXT,
  ADD COLUMN IF NOT EXISTS work_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_time TEXT,
  ADD COLUMN IF NOT EXISTS exception_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punch_in_raw TEXT,
  ADD COLUMN IF NOT EXISTS punch_out_raw TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS biometric_device_user_id TEXT,
  ADD COLUMN IF NOT EXISTS leave_type_detected TEXT;

-- 2. Create monthly_attendance_summaries for HR Payroll calculation
CREATE TABLE IF NOT EXISTS public.monthly_attendance_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- e.g. '2026-11'
  total_working_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  approved_leave_days INTEGER DEFAULT 0,
  total_work_hours NUMERIC(6,2) DEFAULT 0,
  total_late_minutes INTEGER DEFAULT 0,
  total_early_minutes INTEGER DEFAULT 0,
  total_overtime_hours NUMERIC(6,2) DEFAULT 0,
  missing_punches_count INTEGER DEFAULT 0,
  net_payable_days NUMERIC(4,1) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved_for_payroll')),
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_month UNIQUE (employee_id, month_year)
);

-- Enable RLS
ALTER TABLE public.monthly_attendance_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "monthly_summaries_read_policy" ON public.monthly_attendance_summaries;
CREATE POLICY "monthly_summaries_read_policy" ON public.monthly_attendance_summaries
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_manager = true OR p.department = 'hr' OR p.can_do_accounts = true)
    )
  );

DROP POLICY IF EXISTS "monthly_summaries_manage_policy" ON public.monthly_attendance_summaries;
CREATE POLICY "monthly_summaries_manage_policy" ON public.monthly_attendance_summaries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_manager = true OR p.department = 'hr')
    )
  );

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_date ON public.attendance_logs (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_month ON public.monthly_attendance_summaries (month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_emp_month ON public.monthly_attendance_summaries (employee_id, month_year);
