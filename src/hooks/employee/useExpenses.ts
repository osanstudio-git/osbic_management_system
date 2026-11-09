import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useExpenses = (jobServiceId?: string) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Fetch expenses for a specific service
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['job_expenses', jobServiceId],
    queryFn: async () => {
      if (!jobServiceId) return [];
      const { data, error } = await supabase
        .from('job_expenses')
        .select(`*, creator:profiles!job_expenses_created_by_fkey(full_name)`)
        .eq('job_service_id', jobServiceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobServiceId,
  });

  // Fetch all pending expenses for Accounts Dashboard / HR Admin
  const canAccessAccounts = Boolean(profile?.can_do_accounts || profile?.department === 'hr' || profile?.is_manager || profile?.role === 'admin');
  const { data: pendingExpenses, isLoading: loadingPending } = useQuery({
    queryKey: ['pending_expenses'],
    queryFn: async () => {
      if (!canAccessAccounts) return [];
      const { data, error } = await supabase
        .from('job_expenses')
        .select(`
          *,
          job:jobs(job_code),
          service:job_services(service_name),
          creator:profiles!job_expenses_created_by_fkey(full_name)
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: canAccessAccounts,
  });

  const logExpense = useMutation({
    mutationFn: async ({ 
      jobId, 
      jobServiceId, 
      amount, 
      expenseType, 
      receiptFile, 
      notes 
    }: { 
      jobId: string, 
      jobServiceId: string, 
      amount: number, 
      expenseType: string, 
      receiptFile: File, 
      notes?: string 
    }) => {
      // Upload receipt
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${jobId}/expense_${Date.now()}.${fileExt}`;
      const filePath = `expenses/${fileName}`;
      
      const { error: storageError } = await supabase.storage.from('documents').upload(filePath, receiptFile);
      if (storageError) throw storageError;

      // Insert expense record
      const { error } = await supabase.from('job_expenses').insert({
        job_id: jobId,
        job_service_id: jobServiceId,
        amount,
        expense_type: expenseType,
        receipt_url: filePath,
        notes,
        created_by: profile?.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense logged successfully. Waiting for Accounts approval.');
      queryClient.invalidateQueries({ queryKey: ['job_expenses', jobServiceId] });
      queryClient.invalidateQueries({ queryKey: ['pending_expenses'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to log expense');
    }
  });

  const updateExpenseStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('job_expenses')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense status updated');
      queryClient.invalidateQueries({ queryKey: ['pending_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['job_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
      queryClient.invalidateQueries({ queryKey: ['job_expenses_timeline'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update expense');
    }
  });

  return {
    expenses,
    isLoading,
    pendingExpenses,
    loadingPending,
    logExpense,
    updateExpenseStatus
  };
};
