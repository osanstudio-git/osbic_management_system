import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export type DocumentType = 
  | 'cr_certificate' 
  | 'company_stamp' 
  | 'passport' 
  | 'civil_id' 
  | 'tenancy_contract' 
  | 'pki_token' 
  | 'power_of_attorney' 
  | 'municipal_license' 
  | 'other';

export type VaultStatus = 'in_vault' | 'with_pro' | 'returned_to_client' | 'archived';

export interface VaultLog {
  id: string;
  vault_item_id: string;
  action: 'received_in_vault' | 'checked_out_to_pro' | 'returned_to_vault' | 'handed_over_to_client' | 'note_added';
  performed_by: string | null;
  recipient_holder_id: string | null;
  notes: string | null;
  created_at: string;
  actor?: { full_name: string } | null;
  recipient?: { full_name: string } | null;
}

export interface VaultItem {
  id: string;
  branch_id: string;
  client_id: string | null;
  job_id: string | null;
  document_type: DocumentType;
  document_name: string;
  document_identifier: string | null;
  client_name: string;
  contact_phone: string | null;
  locker_location: string | null;
  status: VaultStatus;
  current_holder_id: string | null;
  checkout_reason: string | null;
  checkout_time: string | null;
  expected_return_date: string | null;
  received_by: string | null;
  received_at: string;
  returned_to_client_at: string | null;
  returned_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  current_holder?: { full_name: string; avatar_url?: string; role?: string } | null;
  receiver?: { full_name: string } | null;
  returner?: { full_name: string } | null;
  job?: { id: string; job_code: string; custom_name: string | null } | null;
  logs?: VaultLog[];
}

export const useBranchVaultDocuments = (branchId?: string | null, statusFilter?: string) => {
  return useQuery({
    queryKey: ['branch_document_vault', branchId, statusFilter],
    enabled: !!branchId,
    retry: false,
    queryFn: async (): Promise<VaultItem[]> => {
      try {
        let query = supabase
          .from('branch_document_vault')
          .select(`
            *,
            current_holder:profiles!branch_document_vault_current_holder_id_fkey(full_name, avatar_url, role),
            receiver:profiles!branch_document_vault_received_by_fkey(full_name),
            returner:profiles!branch_document_vault_returned_by_fkey(full_name),
            job:jobs!job_id(id, job_code, custom_name),
            logs:branch_document_vault_logs(
              id, action, notes, created_at,
              actor:profiles!branch_document_vault_logs_performed_by_fkey(full_name),
              recipient:profiles!branch_document_vault_logs_recipient_holder_id_fkey(full_name)
            )
          `)
          .eq('branch_id', branchId!)
          .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return [];
          }
          console.warn('Branch vault query notice:', error.message);
          return [];
        }
        return (data || []) as unknown as VaultItem[];
      } catch {
        return [];
      }
    },
  });
};

export const useCreateVaultItem = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      branch_id: string;
      document_type: DocumentType;
      document_name: string;
      document_identifier?: string;
      client_name: string;
      contact_phone?: string;
      locker_location?: string;
      job_id?: string;
      client_id?: string;
      notes?: string;
    }) => {
      // 1. Insert item
      const { data: item, error: itemErr } = await supabase
        .from('branch_document_vault')
        .insert([{
          ...payload,
          status: 'in_vault',
          received_by: profile?.id || null,
          received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (itemErr) throw itemErr;

      // 2. Insert initial log
      await supabase.from('branch_document_vault_logs').insert([{
        vault_item_id: item.id,
        action: 'received_in_vault',
        performed_by: profile?.id || null,
        notes: `Received and securely stored in ${payload.locker_location || 'Branch Vault'}.`,
      }]);

      return item;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['branch_document_vault'] });
      queryClient.invalidateQueries({ queryKey: ['branch_command_center'] });
    },
  });
};

export const useCheckoutVaultItem = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      itemId: string;
      proEmployeeId: string;
      proEmployeeName: string;
      reason: string;
      expectedReturnDate?: string;
    }) => {
      const now = new Date().toISOString();

      // 1. Update item
      const { data, error } = await supabase
        .from('branch_document_vault')
        .update({
          status: 'with_pro',
          current_holder_id: payload.proEmployeeId,
          checkout_reason: payload.reason,
          checkout_time: now,
          expected_return_date: payload.expectedReturnDate || null,
          updated_at: now,
        })
        .eq('id', payload.itemId)
        .select()
        .single();

      if (error) throw error;

      // 2. Add log
      await supabase.from('branch_document_vault_logs').insert([{
        vault_item_id: payload.itemId,
        action: 'checked_out_to_pro',
        performed_by: profile?.id || null,
        recipient_holder_id: payload.proEmployeeId,
        notes: `Checked out to ${payload.proEmployeeName}: "${payload.reason}". Expected return: ${payload.expectedReturnDate || 'Today'}.`,
      }]);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_document_vault'] });
    },
  });
};

export const useReturnToVaultItem = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: { itemId: string; newLockerLocation?: string; notes?: string }) => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('branch_document_vault')
        .update({
          status: 'in_vault',
          current_holder_id: null,
          checkout_reason: null,
          checkout_time: null,
          expected_return_date: null,
          locker_location: payload.newLockerLocation || undefined,
          updated_at: now,
        })
        .eq('id', payload.itemId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('branch_document_vault_logs').insert([{
        vault_item_id: payload.itemId,
        action: 'returned_to_vault',
        performed_by: profile?.id || null,
        notes: payload.notes || 'Returned from PRO run back to branch vault safe.',
      }]);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_document_vault'] });
    },
  });
};

export const useHandoverToClient = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: { itemId: string; handoverNotes?: string }) => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('branch_document_vault')
        .update({
          status: 'returned_to_client',
          returned_to_client_at: now,
          returned_by: profile?.id || null,
          current_holder_id: null,
          updated_at: now,
        })
        .eq('id', payload.itemId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('branch_document_vault_logs').insert([{
        vault_item_id: payload.itemId,
        action: 'handed_over_to_client',
        performed_by: profile?.id || null,
        notes: payload.handoverNotes || 'Handed back directly to client upon service completion.',
      }]);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_document_vault'] });
    },
  });
};

export const useDeleteVaultItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      await supabase.from('branch_document_vault_logs').delete().eq('vault_item_id', itemId);
      const { error } = await supabase.from('branch_document_vault').delete().eq('id', itemId);
      if (error) throw error;
      return itemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_document_vault'] });
    },
  });
};
