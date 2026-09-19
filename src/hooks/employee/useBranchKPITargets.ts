import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { startOfMonth, endOfMonth, getDaysInMonth, getDate, format } from 'date-fns';

export interface BranchTargetData {
  id?: string;
  branch_id: string;
  target_month: string;
  revenue_target: number;
  deals_target: number;
  leads_target: number;
  notes: string | null;
  actual_revenue: number;
  actual_deals: number;
  actual_leads: number;
  converted_leads: number;
  revenue_progress_pct: number;
  deals_progress_pct: number;
  leads_conversion_pct: number;
  projected_revenue: number;
  is_pacing_ahead: boolean;
  revenue_shortfall: number;
  days_in_month: number;
  days_elapsed: number;
  days_remaining: number;
}

export const useBranchMonthlyTarget = (branchId?: string | null, targetMonthDate?: Date) => {
  const activeDate = targetMonthDate || new Date();
  const monthStart = startOfMonth(activeDate);
  const monthEnd = endOfMonth(activeDate);
  const targetMonthStr = format(monthStart, 'yyyy-MM-01');

  return useQuery({
    queryKey: ['branch_monthly_target', branchId, targetMonthStr],
    enabled: !!branchId,
    queryFn: async (): Promise<BranchTargetData> => {
      const startIso = monthStart.toISOString();
      const endIso = monthEnd.toISOString();

      // 1. Fetch saved target from DB
      const { data: targetRecord } = await supabase
        .from('branch_monthly_targets')
        .select('*')
        .eq('branch_id', branchId!)
        .eq('target_month', targetMonthStr)
        .maybeSingle();

      const revenueTarget = targetRecord?.revenue_target ?? 10000;
      const dealsTarget = targetRecord?.deals_target ?? 30;
      const leadsTarget = targetRecord?.leads_target ?? 50;

      // 2. Fetch completed jobs for this branch in this month
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, status, total_fee, completed_at, updated_at, created_at')
        .eq('branch_id', branchId!)
        .gte('updated_at', startIso)
        .lte('updated_at', endIso);

      const completedJobs = (jobs || []).filter(j => j.status === 'completed');
      const actualDeals = completedJobs.length;

      // 3. Fetch paid payments/invoices for this branch in this month
      const { data: payments } = await supabase
        .from('job_payments')
        .select(`
          amount,
          created_at,
          job:jobs!job_id(branch_id)
        `)
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      const branchPayments = (payments || []).filter((p: any) => p.job?.branch_id === branchId || !branchId);
      const actualRevenue = branchPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // 4. Fetch leads for this branch in this month
      const { data: leads } = await supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('branch_id', branchId!)
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      const actualLeads = leads?.length || 0;
      const convertedLeads = (leads || []).filter(l => l.status === 'converted').length;
      const leadsConversionPct = actualLeads > 0 ? (convertedLeads / actualLeads) * 100 : 0;

      // 5. Pace & Calculations
      const daysInMonth = getDaysInMonth(activeDate);
      const now = new Date();
      const isCurrentMonth = now.getMonth() === activeDate.getMonth() && now.getFullYear() === activeDate.getFullYear();
      const daysElapsed = isCurrentMonth ? getDate(now) : daysInMonth;
      const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

      const revenueProgressPct = revenueTarget > 0 ? (actualRevenue / revenueTarget) * 100 : 0;
      const dealsProgressPct = dealsTarget > 0 ? (actualDeals / dealsTarget) * 100 : 0;

      const dailyRunRate = actualRevenue / Math.max(1, daysElapsed);
      const projectedRevenue = dailyRunRate * daysInMonth;
      const isPacingAhead = projectedRevenue >= revenueTarget;
      const revenueShortfall = Math.max(0, revenueTarget - actualRevenue);

      return {
        id: targetRecord?.id,
        branch_id: branchId!,
        target_month: targetMonthStr,
        revenue_target: revenueTarget,
        deals_target: dealsTarget,
        leads_target: leadsTarget,
        notes: targetRecord?.notes || null,
        actual_revenue: actualRevenue,
        actual_deals: actualDeals,
        actual_leads: actualLeads,
        converted_leads: convertedLeads,
        revenue_progress_pct: Number(revenueProgressPct.toFixed(1)),
        deals_progress_pct: Number(dealsProgressPct.toFixed(1)),
        leads_conversion_pct: Number(leadsConversionPct.toFixed(1)),
        projected_revenue: Number(projectedRevenue.toFixed(3)),
        is_pacing_ahead: isPacingAhead,
        revenue_shortfall: Number(revenueShortfall.toFixed(3)),
        days_in_month: daysInMonth,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
      };
    },
  });
};

export const useSetBranchMonthlyTarget = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      branch_id: string;
      target_month: string;
      revenue_target: number;
      deals_target: number;
      leads_target?: number;
      notes?: string;
    }) => {
      const record = {
        branch_id: payload.branch_id,
        target_month: payload.target_month,
        revenue_target: payload.revenue_target,
        deals_target: payload.deals_target,
        leads_target: payload.leads_target ?? 50,
        notes: payload.notes || null,
        created_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('branch_monthly_targets')
        .upsert(record as any, { onConflict: 'branch_id,target_month' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['branch_monthly_target'] });
      queryClient.invalidateQueries({ queryKey: ['branch_command_center'] });
    },
  });
};
