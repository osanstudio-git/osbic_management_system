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
