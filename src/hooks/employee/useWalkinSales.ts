import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────────────

export type WalkinStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentMode = 'cash' | 'card' | 'bank_transfer';

export interface WalkinSale {
  id: string;
  employee_id: string;
  branch_id: string | null;
  date: string;
  client_name: string;
  client_phone: string | null;
  work_type: string;
  work_description: string | null;
  payment_mode: PaymentMode;
  total_amount: number;
  government_fee: number;
  profit: number;
  status: WalkinStatus;
  notes: string | null;
  client_receipt_url: string | null;
  gov_fee_receipt_url: string | null;
  created_at: string;
  updated_at: string;
  employee?: { full_name: string; avatar_url: string | null; employee_code: string | null };
}

export interface WalkinSaleFormData {
  date: string;
  client_name: string;
  client_phone: string;
  work_type: string;
  work_description: string;
  payment_mode: PaymentMode;
  total_amount: number;
  government_fee: number;
  status: WalkinStatus;
  notes: string;
  client_receipt_file?: File | null;
  gov_fee_receipt_file?: File | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function uploadReceipt(file: File, saleId: string, type: 'client' | 'gov'): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `walkin-receipts/${saleId}/${type}_receipt_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export function calcProfit(total: number, govFee: number): number {
  return Math.max(0, (total || 0) - (govFee || 0));
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export const useWalkinSales = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: sales = [], isLoading } = useQuery<WalkinSale[]>({
    queryKey: ['walkin_sales', profile?.id, profile?.branch_id],
    queryFn: async () => {
      let q = supabase
        .from('walkin_sales')
        .select(`*, employee:profiles!walkin_sales_employee_id_fkey(full_name, avatar_url, employee_code)`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (profile?.role !== 'admin' && !profile?.is_manager) {
        q = q.eq('employee_id', profile?.id as string);
      } else if (profile?.is_manager && profile?.branch_id && profile?.role !== 'admin') {
        q = q.eq('branch_id', profile.branch_id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as WalkinSale[];
    },
    enabled: !!profile?.id,
  });

  const createSale = useMutation({
    mutationFn: async (formData: WalkinSaleFormData) => {
      const profit = calcProfit(formData.total_amount, formData.government_fee);

      const { data: inserted, error: insertErr } = await supabase
        .from('walkin_sales')
        .insert({
          employee_id: profile?.id,
          branch_id: profile?.branch_id ?? null,
          date: formData.date,
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          work_type: formData.work_type,
          work_description: formData.work_description || null,
          payment_mode: formData.payment_mode,
          total_amount: formData.total_amount,
          government_fee: formData.government_fee,
          profit,
          status: formData.status,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const updates: Record<string, string> = {};
      if (formData.client_receipt_file) {
        updates.client_receipt_url = await uploadReceipt(formData.client_receipt_file, inserted.id, 'client');
      }
      if (formData.gov_fee_receipt_file) {
        updates.gov_fee_receipt_url = await uploadReceipt(formData.gov_fee_receipt_file, inserted.id, 'gov');
      }

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase.from('walkin_sales').update(updates).eq('id', inserted.id);
        if (upErr) throw upErr;
      }

      return inserted;
    },
    onSuccess: () => {
      toast.success('Walk-in sale added successfully!');
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add sale'),
  });

  const updateSale = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: WalkinSaleFormData }) => {
      const profit = calcProfit(formData.total_amount, formData.government_fee);

      const payload: Record<string, any> = {
        date: formData.date,
        client_name: formData.client_name,
        client_phone: formData.client_phone || null,
        work_type: formData.work_type,
        work_description: formData.work_description || null,
        payment_mode: formData.payment_mode,
        total_amount: formData.total_amount,
        government_fee: formData.government_fee,
        profit,
        status: formData.status,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (formData.client_receipt_file) {
        payload.client_receipt_url = await uploadReceipt(formData.client_receipt_file, id, 'client');
      }
      if (formData.gov_fee_receipt_file) {
        payload.gov_fee_receipt_url = await uploadReceipt(formData.gov_fee_receipt_file, id, 'gov');
      }

      const { error } = await supabase.from('walkin_sales').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sale updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update sale'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WalkinStatus }) => {
      const { error } = await supabase
        .from('walkin_sales')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['walkin_sales'] }),
    onError: (err: any) => toast.error(err.message || 'Failed to update status'),
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('walkin_sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sale deleted');
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete sale'),
  });

  const getReceiptUrl = (path: string | null): string | null => {
    if (!path) return null;
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  return { sales, isLoading, createSale, updateSale, updateStatus, deleteSale, getReceiptUrl, calcProfit };
};
