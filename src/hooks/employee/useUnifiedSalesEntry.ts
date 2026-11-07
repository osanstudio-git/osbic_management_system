import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export interface ClientOrLeadOption {
  id: string;
  type: 'client' | 'lead';
  name: string;
  phone?: string | null;
  companyName?: string | null;
  email?: string | null;
}

export interface CandidateOpsJob {
  id: string;
  job_code: string;
  custom_name: string | null;
  status: string;
  created_at: string;
  started_at: string;
  total_fee: number;
  work_fee: number;
  ministry_fee: number;
  advance_amount: number | null;
  advance_paid: boolean;
  remaining_amount: number | null;
  remaining_paid: boolean;
  ops_employee?: { full_name: string; employee_code?: string | null } | null;
  sales_employee?: { full_name: string } | null;
  service?: { name_en: string; name_ar?: string } | null;
  total_expenses_spent?: number;
}

export interface RecordNewSalePayload {
  transactionDate: string; // e.g. '2026-10-31'
  clientId?: string | null;
  leadId?: string | null;
  clientName: string;
  clientPhone?: string;
  companyName?: string;
  workType: string;
  workDescription?: string;
  totalDealAmount: number;
  governmentFeeEstimate: number;
  paymentMode: 'cash' | 'card' | 'bank_transfer';
  paymentType: 'advance' | 'full' | 'custom';
  amountReceived: number;
  referenceNumber?: string;
  notes?: string;
  receiptFile?: File | null;
  linkToExistingJobId?: string | null;
  assignToOpsId?: string | null;
  quotationId?: string | null;
}

export interface RecordRestPaymentPayload {
  jobId: string;
  paymentDate: string;
  amount: number;
  paymentMode: 'cash' | 'card' | 'bank_transfer';
  referenceNumber?: string;
  notes?: string;
  receiptFile?: File | null;
}

/**
 * Upload receipt helper
 */
async function uploadReceiptFile(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const filePath = `documents/${folder}/receipt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
  if (error) throw error;
  return filePath;
}

export const useUnifiedSalesEntry = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // 1. Fetch Clients & Leads for Autocomplete
  const { data: clientOptions = [], isLoading: isLoadingClients } = useQuery<ClientOrLeadOption[]>({
    queryKey: ['unified_sales_client_options'],
    queryFn: async () => {
      const [clientsRes, leadsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone, company_name, email')
          .eq('role', 'client')
          .order('full_name', { ascending: true })
          .limit(300),
        supabase
          .from('leads')
          .select('id, contact_name, contact_phone, company_name, contact_email, status')
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      const clients: ClientOrLeadOption[] = (clientsRes.data || []).map(c => ({
        id: c.id,
        type: 'client',
        name: c.company_name ? `${c.full_name} (${c.company_name})` : c.full_name,
        phone: c.phone,
        companyName: c.company_name,
        email: c.email,
      }));

      const leads: ClientOrLeadOption[] = (leadsRes.data || []).map(l => ({
        id: l.id,
        type: 'lead',
        name: l.company_name ? `${l.contact_name} [Lead: ${l.company_name}]` : `${l.contact_name} [Lead]`,
        phone: l.contact_phone,
        companyName: l.company_name,
        email: l.contact_email,
      }));

      return [...clients, ...leads];
    },
    staleTime: 60 * 1000,
  });

  // 2. Fetch Active Quotations for selected client/lead
  const fetchClientQuotations = async (clientId?: string | null, leadId?: string | null) => {
    if (!clientId && !leadId) return [];
    let q = supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, subtotal, status, created_at, items')
      .eq('type', 'quotation');

    if (clientId) q = q.eq('client_id', clientId);
    else if (leadId) q = q.eq('lead_id', leadId);

    const { data } = await q.order('created_at', { ascending: false }).limit(10);
    return data || [];
  };

  // 3. Search Candidate Existing Ops Jobs for this client (for smart auto-alignment)
  const fetchCandidateOpsJobs = async (clientId?: string | null, clientPhone?: string | null): Promise<CandidateOpsJob[]> => {
    if (!clientId && !clientPhone) return [];

    let q = supabase
      .from('jobs')
      .select(`
        id, job_code, custom_name, status, created_at, started_at,
        total_fee, work_fee, ministry_fee, advance_amount, advance_paid, remaining_amount, remaining_paid,
        ops_employee:profiles!ops_employee_id(full_name, employee_code),
        sales_employee:profiles!sales_employee_id(full_name),
        service:services!service_id(name_en, name_ar),
        expenses:job_expenses(amount, status)
      `)
      .in('status', ['draft', 'active', 'on_hold']);

    if (clientId) {
      q = q.eq('client_id', clientId);
    }

    const { data, error } = await q.order('created_at', { ascending: false }).limit(10);
    if (error || !data) return [];

    return data.map((job: any) => {
      const expenses = job.expenses || [];
      const totalSpent = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      return {
        ...job,
        total_expenses_spent: totalSpent,
      };
    });
  };

  // 4. Fetch All Active Jobs with Balance Due (for Rest Payment tab)
  const { data: jobsWithBalance = [], isLoading: isLoadingJobsWithBalance, refetch: refetchJobsWithBalance } = useQuery({
    queryKey: ['jobs_with_balance_due'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id, job_code, custom_name, status, created_at, started_at,
          total_fee, work_fee, ministry_fee, advance_amount, advance_paid, remaining_amount, remaining_paid,
          client:profiles!client_id(full_name, company_name, phone),
          ops_employee:profiles!ops_employee_id(full_name),
          sales_employee:profiles!sales_employee_id(full_name)
        `)
        .in('status', ['active', 'on_hold', 'completed'])
        .or('remaining_paid.eq.false,remaining_amount.gt.0')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  // ─── Mutation: Record New Sale (Backlog / Real-time) ──────────────────────
  const recordNewSaleMutation = useMutation({
    mutationFn: async (payload: RecordNewSalePayload) => {
      let resolvedClientId = payload.clientId;

      // If client is a lead or quick-add, ensure a valid client_id exists
      if (!resolvedClientId && payload.leadId) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('*')
          .eq('id', payload.leadId)
          .single();

        if (leadData) {
          // Check if profile already exists with this phone
          if (leadData.contact_phone) {
            const { data: existingProf } = await supabase
              .from('profiles')
              .select('id')
              .eq('phone', leadData.contact_phone)
              .maybeSingle();

            if (existingProf) {
              resolvedClientId = existingProf.id;
            }
          }

          // If still no client profile, create client profile from lead
          if (!resolvedClientId) {
            const { data: newProf, error: profErr } = await supabase
              .from('profiles')
              .insert({
                role: 'client',
                full_name: leadData.contact_name || payload.clientName,
                phone: leadData.contact_phone || payload.clientPhone || null,
                company_name: leadData.company_name || payload.companyName || null,
                email: leadData.contact_email || null,
              })
              .select('id')
              .single();

            if (!profErr && newProf) {
              resolvedClientId = newProf.id;
            }
          }
        }
      }

      // If still no client_id (pure walk-in new customer), create profile
      if (!resolvedClientId && payload.clientName.trim()) {
        const { data: newProf, error: profErr } = await supabase
          .from('profiles')
          .insert({
            role: 'client',
            full_name: payload.clientName.trim(),
            phone: payload.clientPhone?.trim() || null,
            company_name: payload.companyName?.trim() || null,
          })
          .select('id')
          .single();

        if (!profErr && newProf) {
          resolvedClientId = newProf.id;
        }
      }

      // Upload proof if present
      let proofPath: string | null = null;
      if (payload.receiptFile) {
        proofPath = await uploadReceiptFile(payload.receiptFile, 'sales-receipts');
      }

      let activeJobId = payload.linkToExistingJobId;

      // If Linking to an Existing Ops Job:
      if (activeJobId) {
        // Fetch existing job numbers
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id, total_fee, advance_amount, advance_paid')
          .eq('id', activeJobId)
          .single();

        const currentAdvance = Number(existingJob?.advance_amount || 0);
        const newTotalAdvance = currentAdvance + payload.amountReceived;
        const totalFee = Number(existingJob?.total_fee || payload.totalDealAmount);
        const remaining = Math.max(0, totalFee - newTotalAdvance);
        const isAdvancePaid = newTotalAdvance >= totalFee * 0.5;
        const isRemainingPaid = remaining <= 0;

        await supabase
          .from('jobs')
          .update({
            sales_employee_id: profile?.id,
            advance_amount: newTotalAdvance,
            advance_paid: isAdvancePaid,
            advance_paid_at: isAdvancePaid ? payload.transactionDate : null,
            remaining_amount: remaining,
            remaining_paid: isRemainingPaid,
            remaining_paid_at: isRemainingPaid ? payload.transactionDate : null,
            notes: payload.notes
              ? `[Linked Sale by ${profile?.full_name || 'Sales'}: ${payload.notes}]`
              : undefined,
          })
          .eq('id', activeJobId);
      } else {
        // Create Brand New Job for Ops
        const randomJobSuffix = Date.now().toString().slice(-6);
        const jobCode = `JOB-${format(new Date(payload.transactionDate), 'yyyy')}-${randomJobSuffix}`;
        const totalFee = payload.totalDealAmount;
        const workFee = Math.max(0, totalFee - payload.governmentFeeEstimate);
        const remaining = Math.max(0, totalFee - payload.amountReceived);
        const isAdvancePaid = payload.amountReceived >= totalFee * 0.5;
        const isRemainingPaid = remaining <= 0;

        // Fetch a default service if none provided
        const { data: defaultService } = await supabase.from('services').select('id').limit(1).maybeSingle();

        const { data: createdJob, error: jobErr } = await supabase
          .from('jobs')
          .insert({
            job_code: jobCode,
            client_id: resolvedClientId as string,
            employee_id: payload.assignToOpsId || (profile?.id as string),
            sales_employee_id: profile?.id,
            ops_employee_id: payload.assignToOpsId || null,
            assigned_by: profile?.id,
            service_id: defaultService?.id || '',
            custom_name: `${payload.workType}${payload.workDescription ? ' - ' + payload.workDescription : ''}`,
            status: 'active',
            total_fee: totalFee,
            work_fee: workFee,
            ministry_fee: payload.governmentFeeEstimate,
            advance_amount: payload.amountReceived,
            advance_paid: isAdvancePaid,
            advance_paid_at: isAdvancePaid ? payload.transactionDate : null,
            remaining_amount: remaining,
            remaining_paid: isRemainingPaid,
            remaining_paid_at: isRemainingPaid ? payload.transactionDate : null,
            started_at: payload.transactionDate,
            entry_type: payload.leadId ? 'lead' : 'walkin',
            notes: payload.notes || null,
            branch_id: profile?.branch_id || null,
          })
          .select('id')
          .single();

        if (jobErr) throw jobErr;
        activeJobId = createdJob?.id;
      }

      // Record Payment in job_payments with Safe Fallback for Columns
      if (activeJobId && payload.amountReceived > 0) {
        const auditTag = `[TRANSACTION_DATE:${payload.transactionDate}] [LOGGED_BY:${profile?.full_name || 'Sales'}]`;
        const combinedNotes = payload.notes ? `${payload.notes}\n${auditTag}` : auditTag;

        const basePayment: any = {
          job_id: activeJobId,
          amount: payload.amountReceived,
          payment_method: payload.paymentMode,
          reference_number: payload.referenceNumber || null,
          notes: combinedNotes,
          recorded_by: profile?.id,
          status: 'verified', // Sales payments logged are verified upon receipt
          verified_by: profile?.id,
          verified_at: new Date().toISOString(),
        };

        // Try insert with optional fields (payment_date, proof_url, payment_type)
        let insertRes = await supabase.from('job_payments').insert({
          ...basePayment,
          payment_date: payload.transactionDate,
          payment_type: payload.paymentType,
          sales_employee_id: profile?.id,
          ...(proofPath ? { proof_url: proofPath } : {}),
        } as any);

        // Fallback if payment_date or custom columns do not exist in schema cache
        if (insertRes.error && (insertRes.error.code === 'PGRST204' || insertRes.error.message?.includes('column'))) {
          insertRes = await supabase.from('job_payments').insert(basePayment);
        }

        if (insertRes.error) {
          console.warn('Warning inserting job_payment:', insertRes.error);
        }
      }

      // Also record in walkin_sales table for Daily Sales reporting consistency
      const profit = Math.max(0, payload.totalDealAmount - payload.governmentFeeEstimate);
      await supabase.from('walkin_sales').insert({
        employee_id: profile?.id,
        branch_id: profile?.branch_id ?? null,
        date: payload.transactionDate,
        client_name: payload.clientName,
        client_phone: payload.clientPhone || null,
        work_type: payload.workType,
        work_description: payload.workDescription || null,
        payment_mode: payload.paymentMode,
        total_amount: payload.totalDealAmount,
        government_fee: payload.governmentFeeEstimate,
        profit,
        status: 'in_progress',
        notes: `[Auto-aligned to Job: ${activeJobId}] ${payload.notes || ''}`,
        client_receipt_url: proofPath,
      });

      // If linked to lead, mark lead won
      if (payload.leadId) {
        await supabase
          .from('leads')
          .update({
            status: 'won',
            conversion_date: payload.transactionDate,
            quoted_amount: payload.totalDealAmount,
          })
          .eq('id', payload.leadId);
      }

      // If linked to quotation, update invoice status
      if (payload.quotationId) {
        await supabase
          .from('invoices')
          .update({
            status: payload.amountReceived >= payload.totalDealAmount ? 'paid' : 'partially_paid',
          })
          .eq('id', payload.quotationId);
      }

      return { success: true, jobId: activeJobId };
    },
    onSuccess: () => {
      toast.success('Sale and payment successfully recorded!');
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs_with_balance_due'] });
      queryClient.invalidateQueries({ queryKey: ['sales_team_reports'] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || 'Failed to record sale');
    },
  });

  // ─── Mutation: Record Rest Payment (Milestone / Second Payment) ───────────
  const recordRestPaymentMutation = useMutation({
    mutationFn: async (payload: RecordRestPaymentPayload) => {
      // 1. Fetch current job
      const { data: job, error: jobFetchErr } = await supabase
        .from('jobs')
        .select('id, total_fee, advance_amount, remaining_amount, client_id, custom_name, sales_employee_id')
        .eq('id', payload.jobId)
        .single();

      if (jobFetchErr || !job) throw new Error('Job not found');

      // Upload proof if present
      let proofPath: string | null = null;
      if (payload.receiptFile) {
        proofPath = await uploadReceiptFile(payload.receiptFile, 'rest-payments');
      }

      const totalFee = Number(job.total_fee || 0);
      const previousPaid = Number(job.advance_amount || 0);
      const newTotalPaid = previousPaid + payload.amount;
      const newRemaining = Math.max(0, totalFee - newTotalPaid);
      const isFullyPaid = newRemaining <= 0;

      // 2. Insert into job_payments
      const auditTag = `[REST_PAYMENT] [TRANSACTION_DATE:${payload.paymentDate}] [LOGGED_BY:${profile?.full_name || 'Sales'}]`;
      const combinedNotes = payload.notes ? `${payload.notes}\n${auditTag}` : auditTag;

      const basePayment: any = {
        job_id: job.id,
        amount: payload.amount,
        payment_method: payload.paymentMode,
        reference_number: payload.referenceNumber || null,
        notes: combinedNotes,
        recorded_by: profile?.id,
        status: 'verified',
        verified_by: profile?.id,
        verified_at: new Date().toISOString(),
      };

      let insertRes = await supabase.from('job_payments').insert({
        ...basePayment,
        payment_date: payload.paymentDate,
        payment_type: 'remaining',
        sales_employee_id: profile?.id,
        ...(proofPath ? { proof_url: proofPath } : {}),
      } as any);

      if (insertRes.error && (insertRes.error.code === 'PGRST204' || insertRes.error.message?.includes('column'))) {
        insertRes = await supabase.from('job_payments').insert(basePayment);
      }

      // 3. Update Job
      await supabase
        .from('jobs')
        .update({
          advance_amount: newTotalPaid,
          remaining_amount: newRemaining,
          remaining_paid: isFullyPaid,
          remaining_paid_at: isFullyPaid ? payload.paymentDate : null,
        })
        .eq('id', job.id);

      // 4. Record entry in walkin_sales for today/transaction date so daily cash flow reconciles
      await supabase.from('walkin_sales').insert({
        employee_id: profile?.id,
        branch_id: profile?.branch_id ?? null,
        date: payload.paymentDate,
        client_name: job.custom_name ? `Rest: ${job.custom_name}` : 'Rest Balance Payment',
        work_type: 'Rest Payment / Balance',
        work_description: `Remaining balance collected for Job #${job.id.slice(0, 8)}`,
        payment_mode: payload.paymentMode,
        total_amount: payload.amount,
        government_fee: 0,
        profit: payload.amount,
        status: 'completed',
        notes: `[REST_PAYMENT for Job: ${job.id}] ${payload.notes || ''}`,
        client_receipt_url: proofPath,
      });

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Rest payment recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['jobs_with_balance_due'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales_team_reports'] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || 'Failed to record rest payment');
    },
  });

  return {
    clientOptions,
    isLoadingClients,
    fetchClientQuotations,
    fetchCandidateOpsJobs,
    jobsWithBalance,
    isLoadingJobsWithBalance,
    refetchJobsWithBalance,
    recordNewSale: recordNewSaleMutation.mutateAsync,
    isRecordingSale: recordNewSaleMutation.isPending,
    recordRestPayment: recordRestPaymentMutation.mutateAsync,
    isRecordingRestPayment: recordRestPaymentMutation.isPending,
  };
};
