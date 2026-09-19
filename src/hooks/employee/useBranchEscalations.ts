import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export type EscalationCategory = 
  | 'sla_breach' 
  | 'milestone_delay' 
  | 'quality_complaint' 
  | 'fee_dispute' 
  | 'unresponsive_staff' 
  | 'general';

export type EscalationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type EscalationStatus = 'open' | 'investigating' | 'resolved' | 'escalated_to_hq';

export type FeedbackChannel = 'walk_in' | 'whatsapp' | 'phone_call' | 'portal_review' | 'manager_flag';

export interface BranchEscalationItem {
  id: string;
  branch_id: string;
  job_id: string | null;
  lead_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  assigned_staff_id: string | null;
  logged_by: string;
  category: EscalationCategory;
  severity: EscalationSeverity;
  status: EscalationStatus;
  title: string;
  description: string;
  feedback_channel: FeedbackChannel;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  staff?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  resolver?: {
    id: string;
    full_name: string | null;
  } | null;
  creator?: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface CreateEscalationInput {
  branch_id: string;
  job_id?: string | null;
  lead_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  assigned_staff_id?: string | null;
  category: EscalationCategory;
  severity: EscalationSeverity;
  title: string;
  description: string;
  feedback_channel: FeedbackChannel;
  rating?: number | null;
}

export interface ResolveEscalationInput {
  id: string;
  status: EscalationStatus;
  resolution_notes: string;
}

/**
 * Hook to retrieve all escalations and quality flags for a branch
 */
export const useBranchEscalations = (branchId: string | null | undefined) => {
  return useQuery({
    queryKey: ['branch_client_escalations', branchId],
    queryFn: async (): Promise<BranchEscalationItem[]> => {
      if (!branchId) return [];

      let query = supabase
        .from('branch_client_escalations')
        .select(`
          *,
          staff:assigned_staff_id (id, full_name, email, avatar_url),
          resolver:resolved_by (id, full_name),
          creator:logged_by (id, full_name)
        `)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching branch escalations:', error);
        throw error;
      }

      return (data as any) || [];
    },
    enabled: !!branchId,
  });
};

/**
 * Hook to create a new client escalation
 */
export const useCreateEscalation = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateEscalationInput) => {
      if (!profile?.id) throw new Error('You must be logged in to log an escalation');

      const { data, error } = await supabase
        .from('branch_client_escalations')
        .insert({
          branch_id: input.branch_id,
          job_id: input.job_id || null,
          lead_id: input.lead_id || null,
          client_name: input.client_name,
          client_phone: input.client_phone || null,
          client_email: input.client_email || null,
          assigned_staff_id: input.assigned_staff_id || null,
          logged_by: profile.id,
          category: input.category,
          severity: input.severity,
          status: 'open',
          title: input.title,
          description: input.description,
          feedback_channel: input.feedback_channel,
          rating: input.rating || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branch_client_escalations', variables.branch_id] });
      toast.success('Escalation ticket logged successfully');
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || 'Failed to log escalation');
    },
  });
};

/**
 * Hook to update and resolve an escalation
 */
export const useResolveEscalation = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: ResolveEscalationInput) => {
      if (!profile?.id) throw new Error('User not authenticated');

      const isResolved = input.status === 'resolved';

      const { data, error } = await supabase
        .from('branch_client_escalations')
        .update({
          status: input.status,
          resolution_notes: input.resolution_notes,
          resolved_by: isResolved ? profile.id : null,
          resolved_at: isResolved ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['branch_client_escalations'] });
      toast.success(`Escalation updated to ${data.status.replace('_', ' ')}`);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || 'Failed to update escalation');
    },
  });
};

/**
 * Hook to delete an escalation record
 */
export const useDeleteEscalation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('branch_client_escalations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_client_escalations'] });
      toast.success('Escalation deleted');
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || 'Failed to delete escalation');
    },
  });
};
