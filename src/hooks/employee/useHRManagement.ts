import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity' | 'paternity';
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  attachment_url?: string | null;
  branch_id?: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    department?: string | null;
    job_title?: string | null;
    leave_balance?: number | null;
    branch_id?: string | null;
  };
  reviewer?: {
    id: string;
    full_name: string;
  };
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'on_leave' | 'remote';
  notes?: string | null;
  branch_id?: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    department?: string | null;
    job_title?: string | null;
    avatar_url?: string | null;
  };
}

// ─── Fetch Leave Requests ────────────────────────────────────────────────────
export const useLeaveRequests = (filters?: {
  employeeId?: string;
  branchId?: string | null;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['leave_requests', filters],
    queryFn: async (): Promise<LeaveRequest[]> => {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employee:profiles!employee_id(id, full_name, email, avatar_url, department, job_title, leave_balance, branch_id),
          reviewer:profiles!reviewed_by(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }
      if (filters?.branchId) {
        query = query.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching leave requests:', error);
        return [];
      }
      return (data as any) || [];
    }
  });
};

// ─── Submit Leave Request ────────────────────────────────────────────────────
export const useSubmitLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity' | 'paternity';
      start_date: string;
      end_date: string;
      days_count: number;
      reason?: string;
      branch_id?: string | null;
      attachment_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          ...payload,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
      toast.success('Leave request submitted successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit leave request');
    }
  });
};

// ─── Review Leave Request (Approve / Reject) ─────────────────────────────────
export const useReviewLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewerId,
      rejectionReason,
      employeeId,
      daysCount,
      leaveType
    }: {
      id: string;
      status: 'approved' | 'rejected';
      reviewerId: string;
      rejectionReason?: string;
      employeeId?: string;
      daysCount?: number;
      leaveType?: string;
    }) => {
      // 1. Update request status
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: status === 'rejected' ? rejectionReason : null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 2. If approved and it's annual leave, decrement the employee's leave balance
      if (status === 'approved' && employeeId && daysCount && leaveType === 'annual') {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('leave_balance')
            .eq('id', employeeId)
            .single();

          const currentBalance = Number(profile?.leave_balance) || 30;
          const newBalance = Math.max(0, currentBalance - daysCount);

          await supabase
            .from('profiles')
            .update({ leave_balance: newBalance })
            .eq('id', employeeId);
        } catch (balErr) {
          console.warn('Could not update leave balance:', balErr);
        }
      }

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      toast.success(vars.status === 'approved' ? 'Leave request approved' : 'Leave request rejected');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to review leave request');
    }
  });
};

// ─── Attendance Logs ─────────────────────────────────────────────────────────
export const useAttendanceLogs = (filters?: {
  date?: string;
  employeeId?: string;
  branchId?: string | null;
}) => {
  return useQuery({
    queryKey: ['attendance_logs', filters],
    queryFn: async (): Promise<AttendanceLog[]> => {
      let query = supabase
        .from('attendance_logs')
        .select(`
          *,
          employee:profiles!employee_id(id, full_name, department, job_title, avatar_url)
        `)
        .order('date', { ascending: false });

      if (filters?.date) {
        query = query.eq('date', filters.date);
      }
      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }
      if (filters?.branchId) {
        query = query.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching attendance logs:', error);
        return [];
      }
      return (data as any) || [];
    }
  });
};

// ─── Log Attendance (Check-in / Check-out) ────────────────────────────────────
export const useLogAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      date: string;
      check_in?: string | null;
      check_out?: string | null;
      status?: 'present' | 'late' | 'absent' | 'half_day' | 'on_leave' | 'remote';
      notes?: string;
      branch_id?: string | null;
    }) => {
      const { data, error } = await (supabase.from('attendance_logs') as any)
        .upsert(payload, { onConflict: 'employee_id,date' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
      toast.success('Attendance recorded');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record attendance');
    }
  });
};

// ─── Monthly Attendance Summaries (Payroll Integration) ──────────────────────
export interface MonthlyAttendanceSummary {
  id: string;
  employee_id: string;
  month_year: string;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  approved_leave_days: number;
  total_work_hours: number;
  total_late_minutes: number;
  total_early_minutes: number;
  total_overtime_hours: number;
  missing_punches_count: number;
  net_payable_days: number;
  status: 'draft' | 'reviewed' | 'approved_for_payroll';
  notes?: string | null;
  uploaded_by?: string | null;
  branch_id?: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code?: string | null;
    department?: string | null;
    job_title?: string | null;
    avatar_url?: string | null;
  };
}

export const useMonthlyAttendanceSummaries = (monthYear?: string, branchId?: string | null) => {
  return useQuery({
    queryKey: ['monthly_attendance_summaries', monthYear, branchId],
    queryFn: async (): Promise<MonthlyAttendanceSummary[]> => {
      let query = supabase
        .from('monthly_attendance_summaries')
        .select(`
          *,
          employee:profiles!employee_id(id, full_name, employee_code, department, job_title, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (monthYear) {
        query = query.eq('month_year', monthYear);
      }
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching monthly summaries:', error);
        return [];
      }
      return (data as any) || [];
    }
  });
};

export const useSaveBiometricAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      summaries: any[];
      monthYear: string;
      uploadedBy?: string | null;
      branchId?: string | null;
    }) => {
      const { summaries, monthYear, uploadedBy, branchId } = payload;

      // 1. Prepare batch of attendance_logs
      const allDailyLogs: any[] = [];
      const summaryRecords: any[] = [];

      for (const emp of summaries) {
        if (!emp.matchedProfileId) continue;

        for (const day of emp.records) {
          allDailyLogs.push({
            employee_id: emp.matchedProfileId,
            date: day.date,
            check_in: day.punchIn ? `${day.date}T${convertTo24h(day.punchIn)}:00Z` : null,
            check_out: day.punchOut ? `${day.date}T${convertTo24h(day.punchOut)}:00Z` : null,
            status: day.status,
            notes: day.notes || null,
            duty_time: day.dutyTime || null,
            planned_hours: day.plannedHours || null,
            actual_hours: day.actualHoursStr || null,
            work_minutes: Math.round(day.actualHoursNum * 60),
            late_minutes: day.lateMinutes,
            early_minutes: day.earlyMinutes,
            overtime_hours: day.overtimeHours,
            exception_count: day.isMissingPunch ? 1 : 0,
            punch_in_raw: day.punchIn || null,
            punch_out_raw: day.punchOut || null,
            source: 'biometric_punch',
            biometric_device_user_id: emp.employeeBadge,
            leave_type_detected: day.leaveType || null,
            branch_id: branchId || null
          });
        }

        summaryRecords.push({
          employee_id: emp.matchedProfileId,
          month_year: monthYear,
          total_working_days: emp.totalDaysInSheet,
          present_days: emp.presentDays,
          absent_days: emp.absentDays,
          approved_leave_days: emp.approvedLeaveDays,
          total_work_hours: emp.totalWorkHours,
          total_late_minutes: emp.totalLateMinutes,
          total_early_minutes: emp.totalEarlyMinutes,
          total_overtime_hours: emp.totalOvertimeHours,
          missing_punches_count: emp.missingPunchesCount,
          net_payable_days: emp.netPayableDays,
          status: 'reviewed',
          uploaded_by: uploadedBy || null,
          branch_id: branchId || null,
          updated_at: new Date().toISOString()
        });
      }

      // Upsert daily logs in batches of 50 to avoid payload limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < allDailyLogs.length; i += BATCH_SIZE) {
        const batch = allDailyLogs.slice(i, i + BATCH_SIZE);
        const { error: logsError } = await (supabase.from('attendance_logs') as any)
          .upsert(batch, { onConflict: 'employee_id,date' });

        if (logsError) {
          console.warn('Batch logs upsert warning:', logsError);
        }
      }

      // Upsert monthly summaries
      if (summaryRecords.length > 0) {
        const { error: summaryError } = await (supabase.from('monthly_attendance_summaries') as any)
          .upsert(summaryRecords, { onConflict: 'employee_id,month_year' });

        if (summaryError) {
          console.warn('Summary upsert warning:', summaryError);
        }
      }

      return { processedEmployees: summaryRecords.length, totalDailyLogs: allDailyLogs.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_attendance_summaries'] });
      toast.success(`Successfully committed attendance for ${data.processedEmployees} employees!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save biometric attendance');
    }
  });
};

function convertTo24h(timeStr: string): string {
  try {
    const trimmed = timeStr.trim();
    const isPM = /pm/i.test(trimmed);
    const isAM = /am/i.test(trimmed);
    const cleanTime = trimmed.replace(/[^\d:]/g, '');
    const [rawH, rawM] = cleanTime.split(':');
    let h = parseInt(rawH, 10) || 0;
    const m = (rawM || '00').padStart(2, '0');
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  } catch {
    return '09:00';
  }
}
