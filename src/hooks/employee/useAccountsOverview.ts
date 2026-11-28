import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AccountsJobOverview {
  id: string;
  job_code: string;
  branch_id?: string | null;
  branch?: { id: string; name: string; code: string } | null;
  status: string;
  total_fee: number;
  advance_amount: number;
  remaining_amount: number;
  created_at: string;
  client: { full_name: string; phone: string | null; company_name: string | null; } | null;
  sales: { full_name: string } | null;
  ops: { full_name: string } | null;
  total_spent: number;
  migrate_category?: 'golden_visa' | 'global_visa' | null;
  golden_route?: string | null;
  visa_category?: string | null;
  destination_country?: string | null;
  lead_source_type?: string | null;
}

export const useAccountsOverview = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['accounts_overview', branchId || 'all'],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          id,
          job_code,
          branch_id,
          branch:branches(id, name, code),
          status,
          total_fee,
          advance_amount,
          remaining_amount,
          created_at,
          migrate_category,
          golden_route,
          visa_category,
          destination_country,
          lead_source_type,
          client:profiles!client_id(full_name, phone, company_name),
          sales:profiles!sales_employee_id(full_name),
          ops:profiles!ops_employee_id(full_name),
          expenses:job_expenses(amount, status),
          payments:job_payments(amount, status, payment_method, created_at, reference_number, notes),
          services:job_services(service_name, quantity, total_fee, ministry_fee, work_fee)
        `)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to calculate total_spent and total_paid from related tables
      return (data || []).map((job: any) => {
        const approvedExpenses = job.expenses?.filter((e: any) => e.status === 'approved') || [];
        const totalSpent = approvedExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);
        
        const verifiedPayments = job.payments?.filter((p: any) => p.status === 'verified') || [];
        const totalPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        
        return {
          id: job.id,
          job_code: job.job_code,
          branch_id: job.branch_id,
          branch: job.branch,
          status: job.status,
          total_fee: Number(job.total_fee) || 0,
          advance_amount: totalPaid > 0 ? totalPaid : (Number(job.advance_amount) || 0),
          remaining_amount: (Number(job.total_fee) || 0) - (totalPaid > 0 ? totalPaid : (Number(job.advance_amount) || 0)),
          created_at: job.created_at,
          client: job.client,
          sales: job.sales,
          ops: job.ops,
          total_spent: totalSpent,
          migrate_category: job.migrate_category,
          golden_route: job.golden_route,
          visa_category: job.visa_category,
          destination_country: job.destination_country,
          lead_source_type: job.lead_source_type,
          payments: job.payments || [],
          services: job.services || []
        } as AccountsJobOverview & { payments: any[], services: any[] };
      });
    }
  });
};
