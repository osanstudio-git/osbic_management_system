import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface PoolTask {
  id: string;
  job_id: string;
  service_id: string;
  service_name: string;
  display_order: number;
  quantity: number;
  item_number: number;
  applicant_name: string | null;
  applicant_details: Record<string, any> | null;
  ops_employee_id: string | null;
  assignment_model: 'direct' | 'pool';
  pool_posted_at: string | null;
  status: string;
  deadline: string | null;
  work_fee: number;
  total_fee: number;
  created_at: string;
  job?: {
    id: string;
    job_code: string;
    status: string;
    branch_id: string | null;
    custom_name: string | null;
    created_at: string;
    client?: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      nationality: string | null;
      company_name: string | null;
    } | null;
    package?: {
      name_en: string;
      name_ar: string;
    } | null;
  } | null;
  steps?: {
    id: string;
    step_name: string;
    status: string;
    display_order: number;
  }[];
}

export const useClaimPoolTask = (branchId?: string | null) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // 1. Fetch available pool tasks
  const poolQuery = useQuery({
    queryKey: ['pool_tasks', branchId],
    queryFn: async (): Promise<PoolTask[]> => {
      let query = supabase
        .from('job_services')
        .select(`
          id, job_id, service_id, service_name, display_order, quantity, item_number,
          applicant_name, applicant_details, ops_employee_id, assignment_model,
          pool_posted_at, status, deadline, work_fee, total_fee, created_at,
          job:jobs!job_services_job_id_fkey(
            id, job_code, status, branch_id, custom_name, created_at,
            client:clients(id, full_name, phone, email, nationality, company_name),
            package:packages(name_en, name_ar)
          ),
          steps:job_service_steps(id, step_name, status, display_order)
        `)
        .eq('assignment_model', 'pool')
        .is('ops_employee_id', null)
        .not('status', 'in', '("completed","cancelled")')
        .order('pool_posted_at', { ascending: false });

      const { data, error } = await (query as any);
      if (error) {
        // If assignment_model column doesn't exist yet, return empty list gracefully
        console.warn('Pool query issue:', error);
        return [];
      }

      let list = (data || []) as PoolTask[];
      if (branchId) {
        list = list.filter(t => !t.job?.branch_id || t.job.branch_id === branchId);
      }
      return list;
    },
    staleTime: 5000,
    refetchInterval: 15000, // Poll every 15s in addition to Realtime
  });

  // 2. Realtime listener for Instant updates
  useEffect(() => {
    const channel = supabase
      .channel('open_pool_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_services' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });
          queryClient.invalidateQueries({ queryKey: ['ops_command_services'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // 3. Atomic Claim Mutation (Race-Condition Free)
  const claimMutation = useMutation({
    mutationFn: async ({ jobServiceId }: { jobServiceId: string }) => {
      if (!profile?.id) throw new Error('You must be signed in to claim a task.');

      // Try calling PostgreSQL Atomic RPC function first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('claim_pool_task', {
        p_job_service_id: jobServiceId,
        p_employee_id: profile.id,
      });

      if (!rpcError && rpcResult) {
        if (!rpcResult.success) {
          if (rpcResult.error === 'already_claimed') {
            throw new Error('⚡ Another specialist just claimed this task a split-second ago!');
          }
          throw new Error(rpcResult.error || 'Failed to claim task.');
        }
        return rpcResult;
      }

      // Fallback: If RPC function is not yet created in the DB migration, use atomic conditional UPDATE
      const now = new Date().toISOString();
      const { data: updateData, error: updateError } = await supabase
        .from('job_services')
        .update({
          ops_employee_id: profile.id,
          assignment_model: 'direct',
          pool_claimed_by: profile.id,
          pool_claimed_at: now,
          assigned_at: now,
          status: 'in_progress',
          updated_at: now,
        })
        .eq('id', jobServiceId)
        .is('ops_employee_id', null)
        .select('id, ops_employee_id');

      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error('⚡ Another specialist just claimed this task!');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my_ops_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ops_command_services'] });
      toast.success('🎉 Task claimed successfully! Added to your My Tasks.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to claim task');
      queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });
    },
  });

  return {
    tasks: poolQuery.data || [],
    isLoading: poolQuery.isLoading,
    refetch: poolQuery.refetch,
    claimTask: claimMutation.mutateAsync,
    isClaiming: claimMutation.isPending,
  };
};
