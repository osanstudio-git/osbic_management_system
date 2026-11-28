import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export interface BranchIncomeEntry {
  id: string;
  branch_id: string;
  branch?: { id: string; name: string; code: string } | null;
  entry_date: string;
  entry_mode: 'single' | 'daily_summary';
  amount: number;
  payment_mode: 'cash' | 'card' | 'bank_transfer';
  client_name?: string | null;
  client_phone?: string | null;
  service_category: string;
  work_description?: string | null;
  ministry_fee: number;
  net_profit: number;
  receipt_number?: string | null;
  deals_count: number;
  receipt_url?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  recorder?: { full_name: string } | null;
  status: 'verified' | 'pending_audit';
  created_at: string;
  updated_at: string;
}

export const useBranchIncome = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['branch_income_entries', branchId || 'all'],
    queryFn: async (): Promise<BranchIncomeEntry[]> => {
      let query = supabase
        .from('branch_income_entries')
        .select(`
          *,
          branch:branches!branch_id(id, name, code),
          recorder:profiles!recorded_by(full_name)
        `)
        .order('entry_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching branch income entries:', error);
        return [];
      }
      return (data as any) || [];
    }
  });
};

export const useCreateBranchIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      branch_id: string;
      entry_date: string;
      entry_mode: 'single' | 'daily_summary';
      amount: number;
      payment_mode: 'cash' | 'card' | 'bank_transfer';
      client_name?: string | null;
      client_phone?: string | null;
      service_category: string;
      work_description?: string | null;
      ministry_fee?: number;
      net_profit?: number;
      receipt_number?: string | null;
      deals_count?: number;
      receiptFile?: File | null;
      notes?: string | null;
      recorded_by?: string | null;
    }) => {
      let receiptUrl: string | null = null;

      // 1. Upload receipt file if provided
      if (payload.receiptFile) {
        const fileExt = payload.receiptFile.name.split('.').pop();
        const fileName = `branch_income_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(filePath, payload.receiptFile, { upsert: true });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);
          receiptUrl = pubData?.publicUrl || filePath;
        } else {
          console.warn('Receipt upload failed, saving record without file:', uploadErr);
        }
      }

      const ministryFee = Number(payload.ministry_fee) || 0;
      const amount = Number(payload.amount) || 0;
      const netProfit = payload.net_profit !== undefined ? Number(payload.net_profit) : Math.max(0, amount - ministryFee);

      const recordToInsert = {
        branch_id: payload.branch_id,
        entry_date: payload.entry_date,
        entry_mode: payload.entry_mode,
        amount,
        payment_mode: payload.payment_mode,
        client_name: payload.client_name?.trim() || (payload.entry_mode === 'daily_summary' ? 'Daily Branch Summary' : 'Walk-in Client'),
        client_phone: payload.client_phone?.trim() || null,
        service_category: payload.service_category,
        work_description: payload.work_description?.trim() || null,
        ministry_fee: ministryFee,
        net_profit: netProfit,
        receipt_number: payload.receipt_number?.trim() || null,
        deals_count: payload.entry_mode === 'daily_summary' ? (Number(payload.deals_count) || 1) : 1,
        receipt_url: receiptUrl,
        notes: payload.notes?.trim() || null,
        recorded_by: payload.recorded_by || null,
        status: 'verified' as const
      };

      const { data, error } = await supabase
        .from('branch_income_entries')
        .insert(recordToInsert as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_income_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
      queryClient.invalidateQueries({ queryKey: ['all_jobs_report'] });
      toast.success('Branch income successfully recorded!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record branch income');
    }
  });
};

export const useDeleteBranchIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('branch_income_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch_income_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
      toast.success('Income entry deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete entry');
    }
  });
};
