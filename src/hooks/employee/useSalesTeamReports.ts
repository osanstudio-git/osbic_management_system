import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type TimeframePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | 'all';

export interface RepPerformanceData {
  employeeId: string;
  fullName: string;
  employeeCode: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isSalesHead: boolean;
  canAssignLeads: boolean;
  branchName: string;
  // Leads Metrics
  totalLeads: number;
  assignedLeadsCount: number; // count of leads assigned to this consultant
  assignedByMeCount: number; // count of leads assigned out to team by this consultant/sales head
  newLeads: number;
  inProgressLeads: number;
  quotedLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number; // percentage (0 - 100)
  // Quotations Metrics
  quotesCount: number;
  totalQuotedAmount: number;
  avgQuoteAmount: number;
  // Sales & Revenue Metrics
  wonSalesCount: number;
  wonRevenue: number;
  govtFeesTotal: number;
  netProfit: number;
  profitMargin: number; // percentage (0 - 100)
  avgDealSize: number;
  // Raw items for deep-dive
  leads: any[];
  quotations: any[];
  sales: any[];
}

export interface SalesTeamSummary {
  totalReps: number;
  totalLeads: number;
  totalAssignedLeads: number;
  totalUnassignedLeads: number;
  salesHeadAssignedCount: number;
  totalNewLeads: number;
  totalQuotedLeads: number;
  totalWonLeads: number;
  totalLostLeads: number;
  overallConversionRate: number;
  totalQuotesCount: number;
  totalQuotedAmount: number;
  totalWonRevenue: number;
  totalGovtFees: number;
  totalNetProfit: number;
  overallProfitMargin: number;
  topPerformerByRevenue: RepPerformanceData | null;
  topPerformerByConversion: RepPerformanceData | null;
}

export function getDateRange(timeframe: TimeframePreset, customStart?: string, customEnd?: string): { startIso: string | null; endIso: string | null; label: string } {
  const now = new Date();

  switch (timeframe) {
    case 'today': {
      const s = startOfDay(now);
      const e = endOfDay(now);
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: 'Today' };
    }
    case 'week': {
      const s = startOfWeek(now, { weekStartsOn: 1 });
      const e = endOfWeek(now, { weekStartsOn: 1 });
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: 'This Week' };
    }
    case 'month': {
      const s = startOfMonth(now);
      const e = endOfMonth(now);
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: 'This Month' };
    }
    case 'quarter': {
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const s = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0);
      const e = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: 'This Quarter' };
    }
    case 'year': {
      const s = startOfYear(now);
      const e = endOfYear(now);
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: 'This Year' };
    }
    case 'custom': {
      if (!customStart) return { startIso: null, endIso: null, label: 'Custom Range' };
      const s = startOfDay(new Date(customStart));
      const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(new Date(customStart));
      return { startIso: s.toISOString(), endIso: e.toISOString(), label: `${customStart} to ${customEnd || customStart}` };
    }
    case 'all':
    default:
      return { startIso: null, endIso: null, label: 'All Time' };
  }
}

export const useSalesTeamReports = (
  timeframe: TimeframePreset = 'month',
  customStart?: string,
  customEnd?: string,
  branchIdFilter?: string | null
) => {
  const { profile } = useAuth();
  const dateRange = getDateRange(timeframe, customStart, customEnd);

  return useQuery({
    queryKey: ['sales-team-reports', timeframe, customStart, customEnd, branchIdFilter, profile?.branch_id],
    queryFn: async (): Promise<{ reps: RepPerformanceData[]; summary: SalesTeamSummary; dateLabel: string }> => {
      // 1. Fetch Sales Employees (reps, heads, managers)
      let empQuery = supabase
        .from('profiles')
        .select('id, full_name, employee_code, email, phone, avatar_url, role, department, can_do_sales, is_sales_head, can_assign_leads, is_manager, is_active, branch_id, branches:branch_id(name)')
        .eq('role', 'employee')
        .eq('is_active', true);

      // Branch filter: if provided or if sales head has branch assigned
      const targetBranchId = branchIdFilter || profile?.branch_id;
      if (targetBranchId && targetBranchId !== 'all') {
        empQuery = empQuery.eq('branch_id', targetBranchId);
      }

      const { data: rawEmployees, error: empError } = await empQuery;
      if (empError) throw empError;

      // Filter employees who have sales duties or are sales heads
      const salesEmployees = (rawEmployees || []).filter(
        e => e.can_do_sales || e.department === 'sales' || e.is_sales_head || e.is_manager
      );

      const salesEmpIds = salesEmployees.map(e => e.id);

      // If no sales employees exist, return empty
      if (salesEmpIds.length === 0) {
        return {
          reps: [],
          summary: {
            totalReps: 0,
            totalLeads: 0,
            totalNewLeads: 0,
            totalQuotedLeads: 0,
            totalWonLeads: 0,
            totalLostLeads: 0,
            overallConversionRate: 0,
            totalQuotesCount: 0,
            totalQuotedAmount: 0,
            totalWonRevenue: 0,
            totalGovtFees: 0,
            totalNetProfit: 0,
            overallProfitMargin: 0,
            topPerformerByRevenue: null,
            topPerformerByConversion: null,
          },
          dateLabel: dateRange.label,
        };
      }

      // 2. Query Leads for these employees
      let leadsQuery = supabase
        .from('leads')
        .select(`
          id, lead_code, contact_name, contact_phone, company_name,
          assigned_to, assigned_by, status, quoted_amount, expected_govt_fee, expected_profit,
          total_amount, govt_fee, profit, conversion_date, created_at,
          lead_sources:source_id(name), call_status
        `);

      if (dateRange.startIso && dateRange.endIso) {
        leadsQuery = leadsQuery
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      // 3. Query Invoices/Quotations
      let quotesQuery = supabase
        .from('invoices')
        .select(`
          id, invoice_number, employee_id, type, status, total_amount, subtotal,
          created_at, issue_date, client:profiles!client_id(full_name, company_name),
          lead:leads!lead_id(contact_name, lead_code)
        `)
        .in('employee_id', salesEmpIds);

      if (dateRange.startIso && dateRange.endIso) {
        quotesQuery = quotesQuery
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      // 4. Query Walk-in Sales (if applicable)
      let walkinQuery = supabase
        .from('walkin_sales')
        .select('id, client_name, client_phone, work_type, total_amount, government_fee, profit, status, date, created_by, created_at')
        .in('created_by', salesEmpIds);

      if (dateRange.startIso && dateRange.endIso) {
        const startDay = dateRange.startIso.split('T')[0];
        const endDay = dateRange.endIso.split('T')[0];
        walkinQuery = walkinQuery.gte('date', startDay).lte('date', endDay);
      }

      const [leadsRes, quotesRes, walkinRes] = await Promise.all([
        leadsQuery,
        quotesQuery,
        walkinQuery,
      ]);

      const leadsData = leadsRes.data || [];
      const invoicesData = quotesRes.data || [];
      const walkinData = walkinRes.data || [];

      // 5. Aggregate metrics per employee
      const reps: RepPerformanceData[] = salesEmployees.map(emp => {
        const empLeads = leadsData.filter(l => l.assigned_to === emp.id);
        const empInvoices = invoicesData.filter(inv => inv.employee_id === emp.id);
        const empWalkin = walkinData.filter(ws => ws.created_by === emp.id);

        // Separate quotations vs invoices
        const empQuotes = empInvoices.filter(i => i.type === 'quotation');
        const empWonInvoices = empInvoices.filter(i => i.type === 'invoice' && ['paid', 'partially_paid', 'accepted'].includes(i.status));

        // Leads metrics
        const totalLeads = empLeads.length;
        const newLeads = empLeads.filter(l => l.status === 'new').length;
        const wonLeads = empLeads.filter(l => l.status === 'converted' || Number(l.total_amount) > 0).length;
        const lostLeads = empLeads.filter(l => ['lost', 'cancelled'].includes(l.status)).length;
        const quotedLeads = empLeads.filter(l => ['quoted', 'negotiating'].includes(l.status) || Number(l.quoted_amount) > 0).length;
        const inProgressLeads = totalLeads - newLeads - wonLeads - lostLeads;

        const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;

        // Quotes metrics (both from leads.quoted_amount and invoices table quotations)
        const quotesCount = empQuotes.length;
        const quotesFromInvoices = empQuotes.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);
        const quotesFromLeads = empLeads.reduce((sum, l) => sum + (Number(l.quoted_amount) || 0), 0);
        // Take the larger or combined quotes amount cleanly
        const totalQuotedAmount = Math.max(quotesFromInvoices, quotesFromLeads);
        const avgQuoteAmount = quotesCount > 0 ? Number((totalQuotedAmount / quotesCount).toFixed(3)) : 0;

        // Sales & Revenue metrics
        // Combine converted leads sales + walk-in sales + won invoices
        let leadRevenue = 0;
        let leadGovt = 0;
        let leadProfit = 0;
        let wonLeadsCount = 0;

        empLeads.forEach(l => {
          const tot = Number(l.total_amount) || 0;
          const gf = Number(l.govt_fee) || 0;
          const p = l.profit != null ? Number(l.profit) : tot - gf;
          if (l.status === 'converted' || tot > 0) {
            wonLeadsCount++;
            leadRevenue += tot;
            leadGovt += gf;
            leadProfit += p;
          }
        });

        let walkinRevenue = 0;
        let walkinGovt = 0;
        let walkinProfit = 0;
        let walkinCount = 0;

        empWalkin.forEach(ws => {
          if (ws.status !== 'cancelled') {
            walkinCount++;
            const tot = Number(ws.total_amount) || 0;
            const gf = Number(ws.government_fee) || 0;
            const p = Number(ws.profit) || (tot - gf);
            walkinRevenue += tot;
            walkinGovt += gf;
            walkinProfit += p;
          }
        });

        let invoiceRevenue = 0;
        empWonInvoices.forEach(inv => {
          invoiceRevenue += Number(inv.total_amount) || 0;
        });

        // Combined won sales
        const wonSalesCount = wonLeadsCount + walkinCount;
        const wonRevenue = Number((leadRevenue + walkinRevenue + (invoiceRevenue > leadRevenue ? invoiceRevenue - leadRevenue : 0)).toFixed(3));
        const govtFeesTotal = Number((leadGovt + walkinGovt).toFixed(3));
        const netProfit = Number((leadProfit + walkinProfit).toFixed(3));
        const profitMargin = wonRevenue > 0 ? Number(((netProfit / wonRevenue) * 100).toFixed(1)) : 0;
        const avgDealSize = wonSalesCount > 0 ? Number((wonRevenue / wonSalesCount).toFixed(3)) : 0;

        // Combined sales list for deep dive
        const combinedSales = [
          ...empLeads.filter(l => l.status === 'converted' || Number(l.total_amount) > 0).map(l => ({
            id: l.id,
            source: 'lead',
            clientName: l.contact_name,
            companyName: l.company_name,
            amount: Number(l.total_amount) || 0,
            govtFee: Number(l.govt_fee) || 0,
            profit: Number(l.profit) || 0,
            date: l.conversion_date || l.created_at,
            status: l.status,
          })),
          ...empWalkin.filter(ws => ws.status !== 'cancelled').map(ws => ({
            id: ws.id,
            source: 'walkin',
            clientName: ws.client_name,
            workType: ws.work_type,
            amount: Number(ws.total_amount) || 0,
            govtFee: Number(ws.government_fee) || 0,
            profit: Number(ws.profit) || 0,
            date: ws.date || ws.created_at,
            status: ws.status,
          })),
        ];

        return {
          employeeId: emp.id,
          fullName: emp.full_name,
          employeeCode: emp.employee_code,
          email: emp.email,
          phone: emp.phone,
          avatarUrl: emp.avatar_url,
          isSalesHead: Boolean(emp.is_sales_head),
          canAssignLeads: Boolean(emp.can_assign_leads),
          branchName: (emp.branches as any)?.name || 'Head Office',
          totalLeads,
          assignedLeadsCount: totalLeads,
          assignedByMeCount: leadsData.filter(l => l.assigned_by === emp.id).length,
          newLeads,
          inProgressLeads,
          quotedLeads,
          wonLeads,
          lostLeads,
          conversionRate,
          quotesCount,
          totalQuotedAmount,
          avgQuoteAmount,
          wonSalesCount,
          wonRevenue,
          govtFeesTotal,
          netProfit,
          profitMargin,
          avgDealSize,
          leads: empLeads,
          quotations: empQuotes,
          sales: combinedSales,
        };
      });

      // Sort reps by wonRevenue descending
      reps.sort((a, b) => b.wonRevenue - a.wonRevenue || b.wonSalesCount - a.wonSalesCount);

      // 6. Summary metrics
      const totalReps = reps.length;
      const totalLeads = reps.reduce((sum, r) => sum + r.totalLeads, 0);
      const totalAssignedLeads = totalLeads;
      const totalUnassignedLeads = leadsData.filter(l => !l.assigned_to).length;
      const salesHeadAssignedCount = leadsData.filter(l => {
        const assigner = salesEmployees.find(e => e.id === l.assigned_by);
        return assigner?.is_sales_head || assigner?.can_assign_leads;
      }).length;
      const totalNewLeads = reps.reduce((sum, r) => sum + r.newLeads, 0);
      const totalQuotedLeads = reps.reduce((sum, r) => sum + r.quotedLeads, 0);
      const totalWonLeads = reps.reduce((sum, r) => sum + r.wonLeads, 0);
      const totalLostLeads = reps.reduce((sum, r) => sum + r.lostLeads, 0);
      const overallConversionRate = totalLeads > 0 ? Number(((totalWonLeads / totalLeads) * 100).toFixed(1)) : 0;
      const totalQuotesCount = reps.reduce((sum, r) => sum + r.quotesCount, 0);
      const totalQuotedAmount = Number(reps.reduce((sum, r) => sum + r.totalQuotedAmount, 0).toFixed(3));
      const totalWonRevenue = Number(reps.reduce((sum, r) => sum + r.wonRevenue, 0).toFixed(3));
      const totalGovtFees = Number(reps.reduce((sum, r) => sum + r.govtFeesTotal, 0).toFixed(3));
      const totalNetProfit = Number(reps.reduce((sum, r) => sum + r.netProfit, 0).toFixed(3));
      const overallProfitMargin = totalWonRevenue > 0 ? Number(((totalNetProfit / totalWonRevenue) * 100).toFixed(1)) : 0;

      const topPerformerByRevenue = reps.length > 0 && reps[0].wonRevenue > 0 ? reps[0] : null;
      const repsWithLeads = reps.filter(r => r.totalLeads >= 3);
      const topPerformerByConversion = repsWithLeads.length > 0
        ? [...repsWithLeads].sort((a, b) => b.conversionRate - a.conversionRate)[0]
        : null;

      return {
        reps,
        summary: {
          totalReps,
          totalLeads,
          totalAssignedLeads,
          totalUnassignedLeads,
          salesHeadAssignedCount,
          totalNewLeads,
          totalQuotedLeads,
          totalWonLeads,
          totalLostLeads,
          overallConversionRate,
          totalQuotesCount,
          totalQuotedAmount,
          totalWonRevenue,
          totalGovtFees,
          totalNetProfit,
          overallProfitMargin,
          topPerformerByRevenue,
          topPerformerByConversion,
        },
        dateLabel: dateRange.label,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};
