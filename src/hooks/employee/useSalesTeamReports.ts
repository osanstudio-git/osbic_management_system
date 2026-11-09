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
  selfAddedCount: number; // added directly by this consultant from portal
  assignedToMeCount: number; // assigned to this consultant by Sales Head / manager
  assignedLeadsCount: number; // total leads handled
  assignedByMeCount: number; // count of leads distributed out to team by this consultant/sales head
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
  // Operations Work & Delegation Metrics
  assignedJobsCount: number; // total jobs created/assigned out to ops
  assignedJobsTotalFee: number; // total OMR volume of assigned work
  assignedJobsWorkFee: number; // profit/work fee part
  assignedJobsCompletedCount: number; // jobs completed
  assignedJobsInProgressCount: number; // jobs in progress with ops
  assignedJobsPoolCount: number; // jobs in Open Pool waiting for ops claim
  // Raw items for deep-dive
  leads: any[];
  distributedLeads: any[];
  quotations: any[];
  sales: any[];
  assignedJobs: any[];
}

export interface BranchTransactionItem {
  id: string;
  source: 'walkin' | 'lead' | 'invoice';
  clientName: string;
  clientPhone?: string | null;
  workTypeOrService: string;
  amount: number;
  govtFee: number;
  profit: number;
  date: string;
  createdAt: string;
  status: string;
  paymentMode?: string | null;
  receiptUrl?: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode?: string | null;
  employeeAvatar?: string | null;
  employeeDepartment?: string | null;
  isOpsCounterSale?: boolean;
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
  totalAssignedJobs: number;
  totalAssignedJobsFee: number;
  topPerformerByRevenue: RepPerformanceData | null;
  topPerformerByConversion: RepPerformanceData | null;
  consultantRevenue?: number;
  opsWalkinRevenue?: number;
  opsWalkinCount?: number;
  totalTransactionsCount?: number;
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
    queryFn: async (): Promise<{ reps: RepPerformanceData[]; summary: SalesTeamSummary; branchTransactions: BranchTransactionItem[]; dateLabel: string }> => {
      // 1. Fetch Branch Employees (both sales and all branch staff)
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

      const allBranchEmpIds = (rawEmployees || []).map(e => e.id);

      // Filter employees who have sales duties or are sales heads
      const salesEmployees = (rawEmployees || []).filter(
        e => e.can_do_sales || e.department === 'sales' || e.is_sales_head || e.is_manager
      );

      const salesEmpIds = salesEmployees.map(e => e.id);

      // 2. Query Leads for these sales employees
      let leadsQuery = salesEmpIds.length > 0 ? supabase
        .from('leads')
        .select(`
          id, lead_code, contact_name, contact_phone, company_name,
          assigned_to, assigned_by, status, quoted_amount, expected_govt_fee, expected_profit,
          total_amount, govt_fee, profit, conversion_date, created_at,
          lead_sources:source_id(name), call_status
        `) : Promise.resolve({ data: [] as any[] });

      if (salesEmpIds.length > 0 && dateRange.startIso && dateRange.endIso) {
        leadsQuery = (leadsQuery as any)
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      // 3. Query Invoices/Quotations
      let quotesQuery = salesEmpIds.length > 0 ? supabase
        .from('invoices')
        .select(`
          id, invoice_number, employee_id, type, status, total_amount, subtotal,
          created_at, issue_date, client:profiles!client_id(full_name, company_name),
          lead:leads!lead_id(contact_name, lead_code)
        `)
        .in('employee_id', salesEmpIds) : Promise.resolve({ data: [] as any[] });

      if (salesEmpIds.length > 0 && dateRange.startIso && dateRange.endIso) {
        quotesQuery = (quotesQuery as any)
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      // 4. Query Walk-in Sales for the entire branch (including Operations front-desk staff like Summayya)
      let walkinQuery = supabase
        .from('walkin_sales')
        .select(`
          id, client_name, client_phone, work_type, work_description, total_amount, government_fee, profit,
          payment_mode, status, date, employee_id, created_at, client_receipt_url, gov_fee_receipt_url,
          employee:profiles!walkin_sales_employee_id_fkey(id, full_name, employee_code, avatar_url, department)
        `);

      if (allBranchEmpIds.length > 0) {
        walkinQuery = walkinQuery.in('employee_id', allBranchEmpIds);
      }

      if (dateRange.startIso && dateRange.endIso) {
        const startDay = dateRange.startIso.split('T')[0];
        const endDay = dateRange.endIso.split('T')[0];
        walkinQuery = walkinQuery.gte('date', startDay).lte('date', endDay);
      }

      // 5. Query Jobs created/assigned by these sales employees to Operations
      let assignedJobsQuery = salesEmpIds.length > 0 ? supabase
        .from('jobs')
        .select(`
          id, job_code, custom_name, client_id, service_id, status, total_fee, work_fee, ministry_fee,
          sales_employee_id, assigned_by, ops_employee_id, employee_id, created_at,
          client:profiles!client_id(full_name, company_name, phone),
          service:services!service_id(name_en, name_ar),
          ops_specialist:profiles!jobs_ops_employee_id_fkey(full_name, employee_code, email),
          services:job_services(id, service_name, ops_employee_id, status)
        `)
        .or(`sales_employee_id.in.(${salesEmpIds.join(',')}),assigned_by.in.(${salesEmpIds.join(',')})`) : Promise.resolve({ data: [] as any[] });

      if (salesEmpIds.length > 0 && dateRange.startIso && dateRange.endIso) {
        assignedJobsQuery = (assignedJobsQuery as any)
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      const [leadsRes, quotesRes, walkinRes, jobsRes] = await Promise.all([
        leadsQuery,
        quotesQuery,
        walkinQuery,
        assignedJobsQuery,
      ]);

      const leadsData = leadsRes.data || [];
      const invoicesData = quotesRes.data || [];
      const walkinData = walkinRes.data || [];
      const jobsData = jobsRes.data || [];

      // 6. Aggregate metrics per employee
      const reps: RepPerformanceData[] = salesEmployees.map(emp => {
        const empLeads = leadsData.filter(l => l.assigned_to === emp.id).map(l => {
          const isSelfAdded = !l.assigned_by || l.assigned_by === emp.id;
          const assigner = !isSelfAdded ? rawEmployees?.find(e => e.id === l.assigned_by) : null;
          return {
            ...l,
            isSelfAdded,
            assignedByName: assigner?.full_name || null,
          };
        });
        const selfAddedCount = empLeads.filter(l => l.isSelfAdded).length;
        const assignedToMeCount = empLeads.filter(l => !l.isSelfAdded).length;
        const empInvoices = invoicesData.filter(inv => inv.employee_id === emp.id);
        const empWalkin = walkinData.filter(ws => ws.employee_id === emp.id);

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
            createdAt: l.created_at,
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
            createdAt: ws.created_at,
            status: ws.status,
          })),
        ];

        // Distributed leads (leads assigned out to OTHER team members by this employee/sales head)
        const empDistributedRaw = leadsData.filter(l => l.assigned_by === emp.id && l.assigned_to && l.assigned_to !== emp.id);
        const empDistributedLeads = empDistributedRaw.map(l => {
          const assignee = rawEmployees?.find(e => e.id === l.assigned_to);
          return {
            ...l,
            assignedToName: assignee?.full_name || 'Unassigned',
            assignedToCode: assignee?.employee_code || '',
            assignedToAvatar: assignee?.avatar_url || null,
            assignedToPhone: assignee?.phone || null,
          };
        });

        // Assigned Jobs to Operations (delegated work)
        const empAssignedJobsRaw = jobsData.filter(j => j.sales_employee_id === emp.id || j.assigned_by === emp.id);
        const empAssignedJobs = empAssignedJobsRaw.map(j => {
          const svcList = ((j as any).services as any[]) || [];
          const hasPoolTask = svcList.some(s => !s.ops_employee_id);
          const isAllCompleted = j.status === 'completed' || (svcList.length > 0 && svcList.every(s => s.status === 'completed'));
          const isInProgress = !isAllCompleted && (svcList.some(s => !!s.ops_employee_id) || !!j.ops_employee_id);

          return {
            id: j.id,
            jobCode: j.job_code || 'JOB',
            clientName: (j.client as any)?.full_name || 'Client',
            companyName: (j.client as any)?.company_name || null,
            serviceName: (j.service as any)?.name_en || j.custom_name || 'Standard Service',
            status: j.status,
            totalFee: Number(j.total_fee) || 0,
            workFee: Number(j.work_fee) || 0,
            ministryFee: Number(j.ministry_fee) || 0,
            createdAt: j.created_at,
            opsSpecialistName: (j.ops_specialist as any)?.full_name || null,
            opsSpecialistCode: (j.ops_specialist as any)?.employee_code || null,
            hasPoolTask,
            isAllCompleted,
            isInProgress,
            servicesCount: svcList.length,
          };
        });

        const assignedJobsCount = empAssignedJobs.length;
        const assignedJobsTotalFee = Number(empAssignedJobs.reduce((sum, j) => sum + j.totalFee, 0).toFixed(3));
        const assignedJobsWorkFee = Number(empAssignedJobs.reduce((sum, j) => sum + j.workFee, 0).toFixed(3));
        const assignedJobsCompletedCount = empAssignedJobs.filter(j => j.isAllCompleted).length;
        const assignedJobsPoolCount = empAssignedJobs.filter(j => j.hasPoolTask && !j.isAllCompleted).length;
        const assignedJobsInProgressCount = assignedJobsCount - assignedJobsCompletedCount - assignedJobsPoolCount;

        return {
          employeeId: emp.id,
          fullName: emp.full_name || 'Unnamed Employee',
          employeeCode: emp.employee_code,
          email: emp.email || '',
          phone: emp.phone,
          avatarUrl: emp.avatar_url,
          isSalesHead: Boolean(emp.is_sales_head),
          canAssignLeads: Boolean(emp.can_assign_leads),
          branchName: (emp.branches as any)?.name || 'Head Office',
          totalLeads,
          selfAddedCount,
          assignedToMeCount,
          assignedLeadsCount: totalLeads,
          assignedByMeCount: empDistributedLeads.length,
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
          // Delegation & Operations Work
          assignedJobsCount,
          assignedJobsTotalFee,
          assignedJobsWorkFee,
          assignedJobsCompletedCount,
          assignedJobsInProgressCount,
          assignedJobsPoolCount,
          leads: empLeads,
          distributedLeads: empDistributedLeads,
          quotations: empQuotes,
          sales: combinedSales,
          assignedJobs: empAssignedJobs,
        };
      });

      // Sort reps by wonRevenue descending
      reps.sort((a, b) => b.wonRevenue - a.wonRevenue || b.wonSalesCount - a.wonSalesCount);

      // 6. Summary metrics
      const totalReps = reps.length;
      const totalLeads = reps.reduce((sum, r) => sum + r.totalLeads, 0);
      const totalAssignedLeads = totalLeads;
      const totalUnassignedLeads = leadsData.filter(l => !l.assigned_to && l.status !== 'converted' && (l.status as string) !== 'cancelled' && l.status !== 'lost').length;
      const salesHeadAssignedCount = leadsData.filter(l => {
        const assigner = salesEmployees.find(e => e.id === l.assigned_by);
        return (assigner?.is_sales_head || assigner?.can_assign_leads) && l.assigned_to && l.assigned_to !== l.assigned_by;
      }).length;
      const totalNewLeads = reps.reduce((sum, r) => sum + r.newLeads, 0);
      const totalQuotedLeads = reps.reduce((sum, r) => sum + r.quotedLeads, 0);
      const totalWonLeads = reps.reduce((sum, r) => sum + r.wonLeads, 0);
      const totalLostLeads = reps.reduce((sum, r) => sum + r.lostLeads, 0);
      const overallConversionRate = totalLeads > 0 ? Number(((totalWonLeads / totalLeads) * 100).toFixed(1)) : 0;
      const totalQuotesCount = reps.reduce((sum, r) => sum + r.quotesCount, 0);
      const totalQuotedAmount = Number(reps.reduce((sum, r) => sum + r.totalQuotedAmount, 0).toFixed(3));
      
      // Calculate Ops staff walk-in sales (front-desk counter sales not performed by sales consultants)
      const opsWalkinData = walkinData.filter(ws => !salesEmpIds.includes(ws.employee_id) && ws.status !== 'cancelled');
      const opsWalkinRevenue = opsWalkinData.reduce((sum, ws) => sum + (Number(ws.total_amount) || 0), 0);
      const opsWalkinGovt = opsWalkinData.reduce((sum, ws) => sum + (Number(ws.government_fee) || 0), 0);
      const opsWalkinProfit = opsWalkinData.reduce((sum, ws) => {
        const tot = Number(ws.total_amount) || 0;
        const gf = Number(ws.government_fee) || 0;
        return sum + (ws.profit != null ? Number(ws.profit) : tot - gf);
      }, 0);

      // Consultant deals revenue
      const consultantRevenue = Number(reps.reduce((sum, r) => sum + r.wonRevenue, 0).toFixed(3));
      const consultantGovt = Number(reps.reduce((sum, r) => sum + r.govtFeesTotal, 0).toFixed(3));
      const consultantProfit = Number(reps.reduce((sum, r) => sum + r.netProfit, 0).toFixed(3));

      // TRUE Branch totals (combining both Consultant Pipeline Won Deals AND Front-Desk Walk-in Sales)
      const totalWonRevenue = Number((consultantRevenue + opsWalkinRevenue).toFixed(3));
      const totalGovtFees = Number((consultantGovt + opsWalkinGovt).toFixed(3));
      const totalNetProfit = Number((consultantProfit + opsWalkinProfit).toFixed(3));
      const overallProfitMargin = totalWonRevenue > 0 ? Number(((totalNetProfit / totalWonRevenue) * 100).toFixed(1)) : 0;
      const totalAssignedJobs = reps.reduce((sum, r) => sum + r.assignedJobsCount, 0);
      const totalAssignedJobsFee = Number(reps.reduce((sum, r) => sum + r.assignedJobsTotalFee, 0).toFixed(3));

      const topPerformerByRevenue = reps.length > 0 && reps[0].wonRevenue > 0 ? reps[0] : null;
      const repsWithLeads = reps.filter(r => r.totalLeads >= 3);
      const topPerformerByConversion = repsWithLeads.length > 0
        ? [...repsWithLeads].sort((a, b) => b.conversionRate - a.conversionRate)[0]
        : null;

      // 7. Assemble Unified Branch Transactions (Walk-in counter sales + Won Lead deals)
      const branchTransactions: BranchTransactionItem[] = [
        ...walkinData.filter(ws => ws.status !== 'cancelled').map(ws => {
          const empInfo = (ws as any).employee || rawEmployees?.find(e => e.id === ws.employee_id);
          const tot = Number(ws.total_amount) || 0;
          const gf = Number(ws.government_fee) || 0;
          const pf = ws.profit != null ? Number(ws.profit) : tot - gf;
          return {
            id: ws.id,
            source: 'walkin' as const,
            clientName: ws.client_name,
            clientPhone: ws.client_phone,
            workTypeOrService: ws.work_type + (ws.work_description ? ` (${ws.work_description})` : ''),
            amount: tot,
            govtFee: gf,
            profit: pf,
            date: ws.date || ws.created_at,
            createdAt: ws.created_at,
            status: ws.status,
            paymentMode: ws.payment_mode,
            receiptUrl: ws.client_receipt_url || ws.gov_fee_receipt_url || null,
            employeeId: ws.employee_id,
            employeeName: empInfo?.full_name || 'Branch Staff',
            employeeCode: empInfo?.employee_code || null,
            employeeAvatar: empInfo?.avatar_url || null,
            employeeDepartment: empInfo?.department || (salesEmpIds.includes(ws.employee_id) ? 'sales' : 'operations'),
            isOpsCounterSale: !salesEmpIds.includes(ws.employee_id),
          };
        }),
        ...reps.flatMap(r =>
          r.sales.filter(s => s.source === 'lead').map(s => ({
            id: s.id,
            source: 'lead' as const,
            clientName: s.clientName || 'Lead Client',
            clientPhone: null,
            workTypeOrService: s.companyName ? `B2B Deal - ${s.companyName}` : 'B2B Deal',
            amount: s.amount,
            govtFee: s.govtFee,
            profit: s.profit,
            date: s.date,
            createdAt: s.createdAt,
            status: s.status,
            paymentMode: null,
            receiptUrl: null,
            employeeId: r.employeeId,
            employeeName: r.fullName,
            employeeCode: r.employeeCode,
            employeeAvatar: r.avatarUrl,
            employeeDepartment: 'sales',
            isOpsCounterSale: false,
          }))
        ),
      ];

      // Sort newest first
      branchTransactions.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

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
          totalAssignedJobs,
          totalAssignedJobsFee,
          topPerformerByRevenue,
          topPerformerByConversion,
          consultantRevenue,
          opsWalkinRevenue: Number(opsWalkinRevenue.toFixed(3)),
          opsWalkinCount: opsWalkinData.length,
          totalTransactionsCount: branchTransactions.length,
        },
        branchTransactions,
        dateLabel: dateRange.label,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};
