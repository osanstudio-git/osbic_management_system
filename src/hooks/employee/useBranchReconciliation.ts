import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface BranchReconciliationRecord {
  id: string;
  branch_id: string;
  reconciliation_date: string;
  opening_cash: number;
  closing_cash_actual: number;
  pos_card_total_actual: number;
  expected_cash: number;
  expected_card: number;
  variance: number;
  bank_deposit_amount: number | null;
  deposit_reference: string | null;
  deposit_slip_url: string | null;
  status: 'draft' | 'submitted' | 'verified' | 'discrepancy';
  notes: string | null;
  created_by: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string; avatar_url?: string } | null;
  verifier?: { full_name: string } | null;
}

export interface RegisterPaymentItem {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  job?: {
    id: string;
    job_code: string;
    custom_name: string | null;
    client?: { full_name: string } | null;
  } | null;
  recorder?: { full_name: string } | null;
}

export const useDailyRegister = (branchId?: string | null, targetDateStr?: string) => {
  const effectiveDate = targetDateStr || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['daily_register', branchId, effectiveDate],
    enabled: !!branchId,
    queryFn: async () => {
      // 1. Calculate day range in UTC/ISO
      const [year, month, day] = effectiveDate.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0).toISOString();
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();

      // 2. Fetch all job payments recorded for this branch on this date
      const { data: payments, error: paymentsErr } = await supabase
        .from('job_payments')
        .select(`
          id,
          amount,
          payment_method,
          reference_number,
          notes,
          status,
          created_at,
          recorder:profiles!job_payments_recorded_by_fkey(full_name),
          job:jobs!job_id(
            id,
            job_code,
            custom_name,
            branch_id,
            client:profiles!client_id(full_name)
          )
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (paymentsErr) throw paymentsErr;

      // Filter to this branch
      const branchPayments = (payments || []).filter((p: any) => {
        return p.job?.branch_id === branchId || !branchId;
      }) as unknown as RegisterPaymentItem[];

      const cashPayments = branchPayments.filter(p => p.payment_method === 'cash');
      const cardPayments = branchPayments.filter(p => p.payment_method === 'pos' || p.payment_method === 'card' || p.payment_method === 'online');
      const bankTransferPayments = branchPayments.filter(p => p.payment_method === 'bank_transfer');

      const expectedCash = cashPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expectedCard = cardPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expectedBank = bankTransferPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // 3. Fetch existing reconciliation if already saved/submitted
      const { data: existingRec, error: recErr } = await supabase
        .from('branch_cash_reconciliations')
        .select(`
          *,
          creator:profiles!branch_cash_reconciliations_created_by_fkey(full_name, avatar_url),
          verifier:profiles!branch_cash_reconciliations_verified_by_fkey(full_name)
        `)
        .eq('branch_id', branchId!)
        .eq('reconciliation_date', effectiveDate)
        .maybeSingle();

      if (recErr && recErr.code !== 'PGRST116') {
        console.warn('Error fetching reconciliation:', recErr);
      }

      return {
        date: effectiveDate,
        branchId,
        expectedCash,
        expectedCard,
        expectedBank,
        totalExpected: expectedCash + expectedCard,
        cashPayments,
        cardPayments,
        bankTransferPayments,
        allPayments: branchPayments,
        existingReconciliation: existingRec as BranchReconciliationRecord | null,
      };
    },
  });
};

export const useSaveReconciliation = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      branch_id: string;
      reconciliation_date: string;
      opening_cash: number;
      closing_cash_actual: number;
      pos_card_total_actual: number;
      expected_cash: number;
      expected_card: number;
      bank_deposit_amount?: number;
      deposit_reference?: string;
      deposit_slip_url?: string;
      notes?: string;
      status?: 'draft' | 'submitted' | 'verified' | 'discrepancy';
    }) => {
      const netExpected = payload.expected_cash + payload.pos_card_total_actual;
      const netActual = (payload.closing_cash_actual - payload.opening_cash) + payload.pos_card_total_actual;
      const variance = (payload.closing_cash_actual - payload.opening_cash) - payload.expected_cash;

      const autoStatus = payload.status || (Math.abs(variance) > 0.05 ? 'discrepancy' : 'submitted');

      const record = {
        branch_id: payload.branch_id,
        reconciliation_date: payload.reconciliation_date,
        opening_cash: payload.opening_cash,
        closing_cash_actual: payload.closing_cash_actual,
        pos_card_total_actual: payload.pos_card_total_actual,
        expected_cash: payload.expected_cash,
        expected_card: payload.expected_card,
        variance: Number(variance.toFixed(3)),
        bank_deposit_amount: payload.bank_deposit_amount ?? 0,
        deposit_reference: payload.deposit_reference || null,
        deposit_slip_url: payload.deposit_slip_url || null,
        status: autoStatus,
        notes: payload.notes || null,
        created_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('branch_cash_reconciliations')
        .upsert(record as any, { onConflict: 'branch_id,reconciliation_date' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily_register'] });
      queryClient.invalidateQueries({ queryKey: ['branch_reconciliation_history', data.branch_id] });
      queryClient.invalidateQueries({ queryKey: ['branch_command_center'] });
    },
  });
};

export const useBranchReconciliationHistory = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['branch_reconciliation_history', branchId],
    enabled: !!branchId,
    queryFn: async (): Promise<BranchReconciliationRecord[]> => {
      const { data, error } = await supabase
        .from('branch_cash_reconciliations')
        .select(`
          *,
          creator:profiles!branch_cash_reconciliations_created_by_fkey(full_name, avatar_url),
          verifier:profiles!branch_cash_reconciliations_verified_by_fkey(full_name)
        `)
        .eq('branch_id', branchId!)
        .order('reconciliation_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as unknown as BranchReconciliationRecord[];
    },
  });
};
