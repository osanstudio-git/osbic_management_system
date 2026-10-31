import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export interface OpsCommandService {
  id: string;
  job_id: string;
  service_id: string;
  service_name: string;
  display_order: number;
  item_number: number;
  quantity: number;
  applicant_name: string | null;
  status: string;
  deadline: string | null;
  ops_employee_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  assignment_model?: 'direct' | 'pool';
  pool_posted_at?: string | null;
  pool_claimed_at?: string | null;
  pool_claimed_by?: string | null;
  pro_id: string | null;
  total_fee: number;
  work_fee: number;
  ministry_fee: number;
  created_at: string;
  job: {
    id: string;
    job_code: string;
    status: string;
    branch_id: string | null;
    created_at: string;
    custom_name: string | null;
    client: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      nationality: string | null;
      company_name: string | null;
    } | null;
    package: {
      name_en: string;
      name_ar: string;
    } | null;
  } | null;
  ops_employee: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    employee_code: string | null;
  } | null;
  pro_agent: {
    id: string;
    full_name: string;
  } | null;
  steps: {
    id: string;
    step_name: string;
    status: string;
    assigned_to: string | null;
  }[];
}

export interface OpsEmployeeRoster {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  is_ops_head: boolean;
  is_pro: boolean;
  can_do_ops: boolean;
  branch_id: string | null;
  active_tasks_count: number;
  completed_tasks_count: number;
}

export const useOpsCommandCenter = (branchId?: string | null) => {
  const queryClient = useQueryClient();

  // 1. Fetch all job_services for branch
  const servicesQuery = useQuery({
    queryKey: ['ops_command_services', branchId],
    queryFn: async (): Promise<OpsCommandService[]> => {
      let query = supabase
        .from('job_services')
        .select(`
          id, job_id, service_id, service_name, display_order, item_number, quantity,
          applicant_name, status, deadline, ops_employee_id, assigned_by, assigned_at,
          assignment_model, pool_posted_at, pool_claimed_at, pool_claimed_by,
          pro_id, total_fee, work_fee, ministry_fee, created_at,
          job:jobs!job_services_job_id_fkey(
            id, job_code, status, branch_id, created_at, custom_name,
            client:clients(id, full_name, phone, email, nationality, company_name),
            package:packages(name_en, name_ar)
          ),
          ops_employee:profiles!job_services_ops_employee_id_fkey(id, full_name, avatar_url, employee_code),
          pro_agent:profiles!job_services_pro_id_fkey(id, full_name),
          steps:job_service_steps(id, step_name, status, assigned_to)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await (query as any);
      if (error) throw error;

      let list = (data || []) as OpsCommandService[];
      if (branchId) {
        list = list.filter(item => item.job?.branch_id === branchId);
      }
      return list;
    },
    staleTime: 30000,
  });

  // 2. Fetch all ops employees with workload
  const employeesQuery = useQuery({
    queryKey: ['ops_command_employees', branchId],
    queryFn: async (): Promise<OpsEmployeeRoster[]> => {
      let q = supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, employee_code, is_ops_head, is_pro, can_do_ops, branch_id')
        .or('can_do_ops.eq.true,is_ops_head.eq.true,role.eq.employee');

      if (branchId) {
        q = q.eq('branch_id', branchId);
      }

      const { data: emps, error } = await q;
      if (error) throw error;

      const services = servicesQuery.data || [];

      return (emps || []).map((emp: any) => {
        const empServices = services.filter(s => s.ops_employee_id === emp.id);
        const active = empServices.filter(s => !['completed', 'cancelled'].includes(s.status)).length;
        const completed = empServices.filter(s => s.status === 'completed').length;

        return {
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email,
          phone: emp.phone,
          avatar_url: emp.avatar_url,
          employee_code: emp.employee_code,
          is_ops_head: Boolean(emp.is_ops_head),
          is_pro: Boolean(emp.is_pro),
          can_do_ops: Boolean(emp.can_do_ops),
          branch_id: emp.branch_id,
          active_tasks_count: active,
          completed_tasks_count: completed,
        };
      });
    },
    enabled: !!servicesQuery.data,
  });

  // 3. Assign / Reassign Mutation
  const assignMutation = useMutation({
    mutationFn: async ({
      jobServiceId,
      opsEmployeeId,
      headId,
      jobId,
      serviceName,
      clientName
    }: {
      jobServiceId: string;
      opsEmployeeId: string | null;
      headId: string;
      jobId: string;
      serviceName: string;
      clientName?: string;
    }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('job_services')
        .update({
          ops_employee_id: opsEmployeeId,
          assigned_by: headId,
          assigned_at: now,
          status: opsEmployeeId ? 'in_progress' : 'pending',
          updated_at: now,
        })
        .eq('id', jobServiceId);

      if (error) throw error;

      // Log to job_service_timeline
      await supabase.from('job_service_timeline').insert({
        job_service_id: jobServiceId,
        job_id: jobId,
        from_status: 'pending',
        to_status: opsEmployeeId ? 'assigned' : 'unassigned',
        changed_by: headId,
        changed_by_role: 'ops_head',
        changed_at: now,
        reason: opsEmployeeId ? `Assigned by Ops Head to specialist` : `Unassigned by Ops Head`,
      } as any);

      // Trigger notification if assigned
      if (opsEmployeeId && opsEmployeeId !== headId) {
        await supabase.from('notifications').insert({
          recipient_id: opsEmployeeId,
          sender_id: headId,
          job_id: jobId,
          type: 'action_required',
          title_en: `New Operation Assigned: ${serviceName}`,
          title_ar: `تم تعيين عملية جديدة: ${serviceName}`,
          body_en: `Ops Head assigned you ${serviceName}${clientName ? ` for ${clientName}` : ''}. Tap to review dossier.`,
          body_ar: `قام رئيس العمليات بتعيين ${serviceName} لك.`,
          action_url: `/employee/tasks?jobId=${jobId}`,
          is_read: false,
          action_required: true,
          created_at: now,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops_command_services'] });
      queryClient.invalidateQueries({ queryKey: ['ops_command_employees'] });
      queryClient.invalidateQueries({ queryKey: ['my_ops_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['job_services'] });
      toast.success('Assignment updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update assignment');
    }
  });

  // 4. Post Task to Open Pool
  const postToPoolMutation = useMutation({
    mutationFn: async ({
      jobServiceId,
      headId,
      jobId,
      serviceName,
    }: {
      jobServiceId: string;
      headId: string;
      jobId: string;
      serviceName: string;
    }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('job_services')
        .update({
          assignment_model: 'pool',
          ops_employee_id: null,
          pool_posted_at: now,
          status: 'pending',
          updated_at: now,
        })
        .eq('id', jobServiceId);

      if (error) throw error;

      await supabase.from('job_service_timeline').insert({
        job_service_id: jobServiceId,
        job_id: jobId,
        from_status: 'pending',
        to_status: 'pool_open',
        changed_by: headId,
        changed_by_role: 'ops_head',
        changed_at: now,
        reason: 'Posted to Open Task Pool (Marketplace) by Ops Head',
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops_command_services'] });
      queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });
      toast.success('Task released to Open Marketplace Pool!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to post to pool');
    }
  });

  return {
    services: servicesQuery.data || [],
    employees: employeesQuery.data || [],
    isLoading: servicesQuery.isLoading || employeesQuery.isLoading,
    refetch: () => {
      servicesQuery.refetch();
      employeesQuery.refetch();
    },
    assignTask: assignMutation.mutateAsync,
    isAssigning: assignMutation.isPending,
    postToPool: postToPoolMutation.mutateAsync,
    isPostingToPool: postToPoolMutation.isPending,
  };
};
