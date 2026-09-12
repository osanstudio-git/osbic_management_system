import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';

// Isolate the employee registration client to avoid logging out the admin
const guestClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-employee-reg'
    }
  }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;


// ─── Types ──────────────────────────────────────────────────────────────────
export interface Employee {
  id: string;
  full_name: string;
  employee_code: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  department?: 'sales' | 'operations' | 'accounts' | 'pro' | null;
  is_active: boolean;
  created_at: string;
  // Computed stats from jobs table
  total_jobs: number;
  active_jobs: number;
  completed_month: number;
  avg_completion_days: number;
  // Associated data
  jobs?: any[];
  can_do_sales?: boolean;
  can_do_ops?: boolean;
  can_do_accounts?: boolean;
  is_pro?: boolean;
  is_manager?: boolean;
  branch_id?: string | null;
  company_name?: string | null;
}

// ─── List All Employees (with optional branch filter) ─────────────────────────
export const useAdminEmployees = (branchIdFilter?: string | null) => {
  return useQuery({
    queryKey: ['admin', 'employees', branchIdFilter],
    queryFn: async (): Promise<Employee[]> => {
      // 1. Fetch employee profiles
      let query = db
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .order('created_at', { ascending: false });

      if (branchIdFilter) {
        query = query.eq('branch_id', branchIdFilter);
      }

      const { data: profiles, error: pError } = await query;

      if (pError) throw pError;

      // 2. Fetch jobs to compute stats dynamically
      const { data: jobs, error: jError } = await db
        .from('jobs')
        .select('id, employee_id, sales_employee_id, ops_employee_id, status, completed_at, updated_at');

      if (jError) throw jError;

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      return (profiles ?? []).map((p: any) => {
        // Match jobs where employee is executor (operations/pro), creator (sales), or ops assignee
        const empJobs = (jobs ?? []).filter((j: any) => 
          j.employee_id === p.id || j.sales_employee_id === p.id || j.ops_employee_id === p.id
        );

        // Active jobs = anything not completed and not cancelled (covers pending, awaiting_govt, on_hold)
        const activeJobs = empJobs.filter((j: any) => 
          j.status !== 'completed' && j.status !== 'cancelled'
        ).length;

        // Completed jobs for this month (fallback to updated_at if completed_at is null)
        const completedMonth = empJobs.filter((j: any) => {
          if (j.status !== 'completed') return false;
          const completedDate = j.completed_at || j.updated_at;
          if (!completedDate) return false;
          const d = new Date(completedDate);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).length;

        return {
          ...p,
          full_name: p.full_name ?? 'Unknown',
          email: p.email ?? '',
          active_jobs: activeJobs,
          completed_month: completedMonth,
        };
      });
    },
  });
};

// ─── Single Employee + Performance Intelligence ─────────────────────────────
export const useAdminEmployee = (id?: string) => {
  return useQuery({
    queryKey: ['admin', 'employee', id],
    // Only enable if id is present and looks like a valid UUID
    enabled: !!id && id.length > 20, 
    queryFn: async (): Promise<Employee> => {
      // 1. Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .single();

      if (profileError) throw profileError;

      // 2. Fetch Associated Jobs (match executor, creator, or ops associate)
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*, client:profiles!jobs_client_id_fkey(full_name), service:services(name_en, name_ar)')
        .or(`employee_id.eq."${id}",sales_employee_id.eq."${id}",ops_employee_id.eq."${id}"`)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // 3. Fetch Associated Leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name)')
        .eq('assigned_to', id!)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // 4. Calculate Stats
      const totalJobs = jobs?.length || 0;
      const activeJobs = jobs?.filter((j: any) => j.status !== 'completed' && j.status !== 'cancelled').length || 0;
      
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const completedMonth = jobs?.filter((j: any) => {
        if (j.status !== 'completed') return false;
        const completedDate = j.completed_at || j.updated_at;
        if (!completedDate) return false;
        const d = new Date(completedDate);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length || 0;

      const completedJobs = jobs?.filter((j: any) => j.status === 'completed' && (j.completed_at || j.updated_at) && j.created_at) || [];
      const totalDays = completedJobs.reduce((acc: number, j: any) => {
        const start = new Date(j.created_at).getTime();
        const end = new Date(j.completed_at || j.updated_at).getTime();
        return acc + (end - start) / (1000 * 60 * 60 * 24);
      }, 0);
      const avgCompletionDays = completedJobs.length > 0 ? Math.round(totalDays / completedJobs.length) : 0;

      // Calculate Average Client Rating (CSAT Score)
      const ratedJobs = jobs?.filter((j: any) => j.client_rating !== null && j.client_rating !== undefined) || [];
      const avgRating = ratedJobs.length > 0 
        ? Number((ratedJobs.reduce((acc: number, j: any) => acc + Number(j.client_rating), 0) / ratedJobs.length).toFixed(1)) 
        : 0;

      return {
        ...profile,
        full_name: profile.full_name ?? 'Unknown',
        email: profile.email ?? '',
        department: profile.department ?? 'operations',
        total_jobs: totalJobs,
        active_jobs: activeJobs,
        completed_month: completedMonth,
        avg_completion_days: avgCompletionDays,
        avg_rating: avgRating,
        jobs: jobs || [],
        leads: leads || []
      };
    },
  });
};

// ─── Activity Log Hook ──────────────────────────────────────────────────────
export const useEmployeeActivity = (id?: string) => {
  return useQuery({
    queryKey: ['admin', 'employee-activity', id],
    enabled: !!id && id.length > 20,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('actor_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    }
  });
};

// ─── Create Employee ─────────────────────────────────────────────────────────
export const useCreateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newEmployee: {
      full_name: string;
      email: string;
      phone?: string;
      password: string;
      department?: 'sales' | 'operations' | 'accounts' | 'pro';
      avatar_file?: File | null;
      branch_id?: string | null;
      company_name?: string | null;
      is_manager?: boolean;
    }) => {
      // Step B: Create the auth user
      const { data: authData, error: authError } = await guestClient.auth.signUp({
        email: newEmployee.email,
        password: newEmployee.password,
        options: {
          data: {
            full_name: newEmployee.full_name,
            role: 'employee',
          }
        }
      });

      if (authError) {
        console.error('Supabase SignUp Error Details:', {
          code: authError.status,
          message: authError.message,
          error: authError
        });
        throw new Error(authError.message || 'Supabase authentication failed');
      }
      if (!authData.user) throw new Error('User creation failed');

      const userId = authData.user.id;
      let avatarUrl = null;

      // New Step: Upload avatar if provided
      if (newEmployee.avatar_file) {
        const fileExt = newEmployee.avatar_file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, newEmployee.avatar_file);
        
        if (uploadError) {
          console.error('Avatar Upload Failed:', uploadError);
          // We don't throw here to avoid failing the whole employee creation 
          // Just because a photo upload failed.
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // Step C: Insert the profile record using the main authenticated client (db)
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .upsert({
          id: userId,
          full_name: newEmployee.full_name,
          email: newEmployee.email,
          phone: newEmployee.phone ?? null,
          role: 'employee',
          department: newEmployee.department ?? 'operations',
          employee_code: null,
          avatar_url: avatarUrl,
          is_active: true,
          is_manager: newEmployee.is_manager ?? false,
          branch_id: newEmployee.branch_id || null,
          company_name: newEmployee.company_name || null,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }
      
      // Step D: Send the credentials via Edge Function (Resend)
      const { error: invokeError } = await supabase.functions.invoke('send-credentials', {
        body: {
          email: newEmployee.email,
          password: newEmployee.password,
          name: newEmployee.full_name,
          role: 'employee'
        }
      });
      
      if (invokeError) {
        console.error('Failed to send credentials email:', invokeError);
        // We do not throw here, because the user is already created in the DB.
        // We will just show a toast in onSuccess or let the UI know.
      }

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    },
  });
};

// ─── Update Employee ─────────────────────────────────────────────────────────
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Employee> }) => {
      const { data, error } = await db
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee', id] });
    },
  });
};

// ─── Toggle Employee Active Status ───────────────────────────────────────────
export const useToggleEmployeeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db
        .from('profiles')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    },
  });
};
// ─── Reset Employee Password ───────────────────────────────────────────────
export const useResetEmployeePassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password reset email sent successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send reset email');
    }
  });
};
// ─── Delete Employee ────────────────────────────────────────────────────────
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Call the Master Purge RPC to remove from both Profiles and Auth.users
      const { error } = await supabase.rpc('delete_user_identity', { target_user_id: id });

      if (error) {
        console.error('Purge error:', error);
        let userMessage = error.message;
        if (error.message?.includes('violates foreign key constraint') || error.message?.includes('jobs_employee_id_fkey')) {
          userMessage = 'This employee has historical job records and cannot be permanently deleted. Please deactivate their account instead.';
        }
        throw new Error(userMessage || 'Operation failed. Check permissions.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      toast.success('Employee successfully removed from the system');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove employee');
    }
  });
};
