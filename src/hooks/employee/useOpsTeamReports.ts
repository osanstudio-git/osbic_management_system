import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isBefore,
  parseISO
} from 'date-fns';

export type OpsTimeframePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export interface OpsMemberPerformance {
  employeeId: string;
  fullName: string;
  employeeCode?: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isOpsHead: boolean;
  isPro: boolean;
  branchName: string;
  // Job metrics
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  blockedJobs: number;
  overdueJobs: number;
  completionRate: number; // percentage (0 - 100)
  // Step metrics
  totalSteps: number;
  completedSteps: number;
  pendingSteps: number;
  stepCompletionRate: number;
  // Financials
  govtFeesTotal: number;
  totalServiceRevenue: number;
  // Sales employee attribution
  salesAssignedJobsCount: number;
  directOpsJobsCount: number;
  // Direct walk-in & enquiries from ops
  walkinSalesCount: number;
  walkinTotalAmount: number;
  walkinGovtFees: number;
  enquiriesCount: number;
  // Delegated out to other PROs/specialists
  distributedCount: number;
  // Workload capacity
  capacityStatus: 'optimal' | 'busy' | 'overloaded';
  // Raw items for deep-dive
  jobs: any[];
  steps: any[];
  distributedJobs: any[];
  walkinSales: any[];
  enquiries: any[];
}

export interface OpsTeamSummary {
  totalMembers: number;
  totalJobs: number;
  totalActiveJobs: number;
  totalCompletedJobs: number;
  totalBlockedJobs: number;
  totalOverdueJobs: number;
  totalPendingSteps: number;
  totalGovtFees: number;
  totalRevenue: number;
  totalSalesAssignedJobs: number;
  totalWalkinSales: number;
  totalEnquiries: number;
  overallCompletionRate: number;
  opsHeadDelegatedCount: number;
  busiestMember: OpsMemberPerformance | null;
  topPerformerByCompletion: OpsMemberPerformance | null;
}

export function getOpsDateRange(
  timeframe: OpsTimeframePreset,
  customStart?: string,
  customEnd?: string
): { startIso: string | null; endIso: string | null; label: string } {
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
      return { startIso: null, endIso: null, label: 'All Operations' };
  }
}

export const useOpsTeamReports = (
  timeframe: OpsTimeframePreset = 'month',
  customStart?: string,
  customEnd?: string,
  branchIdFilter?: string | null
) => {
  const { profile } = useAuth();
  const dateRange = getOpsDateRange(timeframe, customStart, customEnd);

  return useQuery({
    queryKey: ['ops-team-reports', timeframe, customStart, customEnd, branchIdFilter, profile?.branch_id],
    queryFn: async (): Promise<{ members: OpsMemberPerformance[]; summary: OpsTeamSummary; dateLabel: string }> => {
      // 1. Fetch Operations Team Members (PROs, document coordinators, ops specialists, ops leads)
      const targetBranchId = branchIdFilter || profile?.branch_id;
      let empQuery = supabase
        .from('profiles')
        .select('id, full_name, employee_code, email, phone, avatar_url, role, department, can_do_ops, is_pro, is_ops_head, is_manager, is_active, branch_id, branches:branch_id(name)')
        .eq('role', 'employee')
        .eq('is_active', true);

      if (targetBranchId && targetBranchId !== 'all') {
        empQuery = empQuery.eq('branch_id', targetBranchId);
      }

      let { data: rawEmployees, error: empError } = await empQuery;
      // Resilient fallback if is_ops_head column not yet created in Supabase
      if (empError && (empError.message?.includes('is_ops_head') || empError.code === '42703')) {
        let fallbackQuery = supabase
          .from('profiles')
          .select('id, full_name, employee_code, email, phone, avatar_url, role, department, can_do_ops, is_pro, is_manager, is_active, branch_id, branches:branch_id(name)')
          .eq('role', 'employee')
          .eq('is_active', true);
        if (targetBranchId && targetBranchId !== 'all') {
          fallbackQuery = fallbackQuery.eq('branch_id', targetBranchId);
        }
        const fallbackRes = await fallbackQuery;
        rawEmployees = fallbackRes.data;
        empError = fallbackRes.error;
      }
      if (empError) throw empError;

      // Filter employees who do ops work or lead ops
      const opsEmployees = (rawEmployees || []).filter(
        e => e.can_do_ops || e.department === 'operations' || e.is_pro || (e as any).is_ops_head || e.is_manager
      );

      const opsEmpIds = opsEmployees.map(e => e.id);

      if (opsEmpIds.length === 0) {
        return {
          members: [],
          summary: {
            totalMembers: 0,
            totalJobs: 0,
            totalActiveJobs: 0,
            totalCompletedJobs: 0,
            totalBlockedJobs: 0,
            totalOverdueJobs: 0,
            totalPendingSteps: 0,
            totalGovtFees: 0,
            totalRevenue: 0,
            overallCompletionRate: 0,
            opsHeadDelegatedCount: 0,
            busiestMember: null,
            topPerformerByCompletion: null,
          },
          dateLabel: dateRange.label,
        };
      }

      // 2. Fetch Jobs
      let jobsQuery = supabase
        .from('jobs')
        .select(`
          id, job_code, custom_name, employee_id, ops_employee_id, sales_employee_id, assigned_by, status,
          total_fee, work_fee, ministry_fee, created_at, updated_at,
          client:profiles!client_id(full_name, company_name, phone),
          sales_rep:profiles!sales_employee_id(full_name, email, phone),
          assigned_by_user:profiles!assigned_by(full_name, email, phone),
          service:services!service_id(name_en, name_ar),
          branches:branch_id(name),
          job_steps(id, custom_name, status, actual_gov_fee, assigned_to, deadline),
          job_services(id, ministry_fee, work_fee, total_fee)
        `);

      if (dateRange.startIso && dateRange.endIso) {
        jobsQuery = jobsQuery.or(`and(created_at.gte.${dateRange.startIso},created_at.lte.${dateRange.endIso}),status.in.(pending,in_progress,review,blocked)`);
      }

      // 3. Fetch Job Steps (Workflow & PRO tasks)
      let stepsQuery = supabase
        .from('job_steps')
        .select(`
          id, job_id, custom_name, assigned_to, assigned_by, status,
          deadline, started_at, completed_at, notes, rejection_reason, created_at, actual_gov_fee,
          job:jobs!job_id(job_code, custom_name, status, sales_employee_id, client:profiles!client_id(full_name, company_name, phone), sales_rep:profiles!sales_employee_id(full_name))
        `);

      if (dateRange.startIso && dateRange.endIso) {
        stepsQuery = stepsQuery.or(`and(created_at.gte.${dateRange.startIso},created_at.lte.${dateRange.endIso}),status.in.(pending,in_progress)`);
      }

      // 4. Fetch Walk-in Sales (Daily Sales logged by Ops Specialists)
      let walkinQuery = supabase
        .from('walkin_sales')
        .select('id, client_name, client_phone, work_type, work_description, total_amount, government_fee, profit, payment_mode, status, date, employee_id, created_at')
        .in('employee_id', opsEmpIds);

      if (dateRange.startIso && dateRange.endIso) {
        const startDay = dateRange.startIso.split('T')[0];
        const endDay = dateRange.endIso.split('T')[0];
        walkinQuery = walkinQuery.gte('date', startDay).lte('date', endDay);
      }

      // 5. Fetch Client Enquiries (Leads handled or recorded by Ops Specialists)
      let leadsQuery = supabase
        .from('leads')
        .select(`
          id, lead_code, contact_name, contact_phone, company_name, service_required,
          assigned_to, assigned_by, status, quoted_amount, expected_govt_fee, total_amount,
          created_at, call_status
        `)
        .or(`assigned_to.in.(${opsEmpIds.join(',')}),assigned_by.in.(${opsEmpIds.join(',')})`);

      if (dateRange.startIso && dateRange.endIso) {
        leadsQuery = leadsQuery
          .gte('created_at', dateRange.startIso)
          .lte('created_at', dateRange.endIso);
      }

      const [jobsRes, stepsRes, walkinRes, leadsRes] = await Promise.all([
        jobsQuery,
        stepsQuery,
        walkinQuery,
        leadsQuery,
      ]);
      if (jobsRes.error) {
        console.error('OpsTeamReports jobsQuery error:', jobsRes.error);
      }
      if (stepsRes.error) {
        console.error('OpsTeamReports stepsQuery error:', stepsRes.error);
      }
      const allJobs = jobsRes.data || [];
      const allSteps = stepsRes.data || [];
      const allWalkin = walkinRes.data || [];
      const allLeads = leadsRes.data || [];

      const now = new Date();

      // 4. Map metrics per operations specialist
      const members: OpsMemberPerformance[] = opsEmployees.map(emp => {
        // Jobs assigned to this specialist (as main assignee or ops specialist)
        const rawEmpJobs = allJobs.filter(j => j.employee_id === emp.id || j.ops_employee_id === emp.id);
        const empJobs = rawEmpJobs.map(j => {
          const salesRepName = j.sales_rep?.full_name || (j.assigned_by_user && j.assigned_by !== j.employee_id ? j.assigned_by_user.full_name : null);
          const isSalesAssigned = Boolean(j.sales_employee_id || (salesRepName && salesRepName !== 'Direct'));
          const servicesGovFee = (j.job_services || []).reduce((sum: number, s: any) => sum + (Number(s.ministry_fee) || 0), 0);
          const stepsGovFee = (j.job_steps || []).reduce((sum: number, s: any) => sum + (Number(s.actual_gov_fee) || 0), 0);
          const govFee = Number(j.ministry_fee) || servicesGovFee || stepsGovFee || (Number(j.work_fee) ? 0 : Number(j.total_fee)) || 0;
          const serviceFee = Number(j.work_fee) || Number(j.total_fee) || 0;

          return {
            ...j,
            salesRepName: salesRepName || 'Direct / Walk-in',
            isSalesAssigned,
            govFee,
            serviceFee,
          };
        });

        // Steps assigned to this specialist (e.g. PRO tasks)
        const empSteps = allSteps.filter(s => s.assigned_to === emp.id);

        // Walk-in Sales & Enquiries handled by this specialist
        const empWalkin = allWalkin.filter(w => w.employee_id === emp.id);
        const empEnquiries = allLeads.filter(l => l.assigned_to === emp.id || l.assigned_by === emp.id);

        const walkinSalesCount = empWalkin.length;
        const walkinTotalAmount = Number(empWalkin.reduce((sum, w) => sum + (Number(w.total_amount) || 0), 0).toFixed(3));
        const walkinGovtFees = Number(empWalkin.reduce((sum, w) => sum + (Number(w.government_fee) || 0), 0).toFixed(3));
        const enquiriesCount = empEnquiries.length;

        // Sales assigners breakdown
        const salesJobs = empJobs.filter(j => j.isSalesAssigned);
        const salesAssignedJobsCount = salesJobs.length;
        const directOpsJobsCount = empJobs.length - salesAssignedJobsCount;

        // Find top sales assigner for this specialist
        const assignerCounts: Record<string, number> = {};
        salesJobs.forEach(j => {
          const name = j.salesRepName;
          if (name && name !== 'Direct / Walk-in') {
            assignerCounts[name] = (assignerCounts[name] || 0) + 1;
          }
        });
        const sortedAssigners = Object.entries(assignerCounts).sort((a, b) => b[1] - a[1]);
        const topSalesAssigner = sortedAssigners.length > 0 ? `${sortedAssigners[0][0]} (${sortedAssigners[0][1]} works)` : null;

        // Distributed out to OTHER team members by this employee/lead
        const empDistributedRaw = allJobs.filter(
          j => j.assigned_by === emp.id && j.employee_id && j.employee_id !== emp.id
        );
        const empDistributedJobs = empDistributedRaw.map(j => {
          const assignee = rawEmployees?.find(e => e.id === j.employee_id);
          return {
            ...j,
            assignedToName: assignee?.full_name || 'Unassigned',
            assignedToCode: assignee?.employee_code || '',
            assignedToAvatar: assignee?.avatar_url || null,
          };
        });

        // Job calculations
        const totalJobs = empJobs.length;
        const activeJobs = empJobs.filter(j => ['active', 'in_progress', 'pending', 'awaiting_govt', 'on_hold', 'review', 'draft'].includes(j.status)).length;
        const completedJobs = empJobs.filter(j => j.status === 'completed').length;
        const blockedJobs = empJobs.filter(j => ['blocked', 'rejected', 'cancelled'].includes(j.status)).length;
        
        // Overdue jobs
        const overdueJobs = empJobs.filter(j => {
          if (['completed', 'cancelled'].includes(j.status)) return false;
          // Check step deadlines or if active > 14 days
          const overdueStep = (j.job_steps || []).some((st: any) => st.deadline && isBefore(parseISO(st.deadline), now) && st.status !== 'completed');
          if (overdueStep) return true;
          try {
            return isBefore(parseISO(j.created_at), new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
          } catch {
            return false;
          }
        }).length;

        const completionRate = totalJobs > 0 ? Number(((completedJobs / totalJobs) * 100).toFixed(1)) : 0;

        // Step calculations
        const totalSteps = empSteps.length;
        const completedSteps = empSteps.filter(s => s.status === 'completed').length;
        const pendingSteps = empSteps.filter(s => ['pending', 'in_progress'].includes(s.status)).length;
        const stepCompletionRate = totalSteps > 0 ? Number(((completedSteps / totalSteps) * 100).toFixed(1)) : 0;

        // Financial totals
        const govtFeesTotal = Number(
          empJobs.reduce((sum, j) => sum + (Number(j.govFee) || 0), 0).toFixed(3)
        );
        const totalServiceRevenue = Number(
          empJobs.reduce((sum, j) => sum + (Number(j.serviceFee) || 0), 0).toFixed(3)
        );

        // Capacity status
        let capacityStatus: 'optimal' | 'busy' | 'overloaded' = 'optimal';
        if (activeJobs >= 8 || pendingSteps >= 12) {
          capacityStatus = 'overloaded';
        } else if (activeJobs >= 4 || pendingSteps >= 6) {
          capacityStatus = 'busy';
        }

        return {
          employeeId: emp.id,
          fullName: emp.full_name || 'Unnamed Operations Specialist',
          employeeCode: emp.employee_code,
          email: emp.email || '',
          phone: emp.phone,
          avatarUrl: emp.avatar_url,
          isOpsHead: Boolean((emp as any).is_ops_head),
          isPro: Boolean(emp.is_pro),
          branchName: (emp.branches as any)?.name || 'Head Office',
          totalJobs,
          activeJobs,
          completedJobs,
          blockedJobs,
          overdueJobs,
          completionRate,
          totalSteps,
          completedSteps,
          pendingSteps,
          stepCompletionRate,
          govtFeesTotal,
          totalServiceRevenue,
          salesAssignedJobsCount,
          directOpsJobsCount,
          topSalesAssigner,
          walkinSalesCount,
          walkinTotalAmount,
          walkinGovtFees,
          enquiriesCount,
          distributedCount: empDistributedJobs.length,
          capacityStatus,
          jobs: empJobs,
          steps: empSteps,
          distributedJobs: empDistributedJobs,
          walkinSales: empWalkin,
          enquiries: empEnquiries,
        };
      });

      // Sort members: by activeJobs descending, then totalJobs descending
      members.sort((a, b) => b.activeJobs - a.activeJobs || b.totalJobs - a.totalJobs);

      // 5. Team Summary
      const totalMembers = members.length;
      const totalJobs = members.reduce((sum, m) => sum + m.totalJobs, 0);
      const totalActiveJobs = members.reduce((sum, m) => sum + m.activeJobs, 0);
      const totalCompletedJobs = members.reduce((sum, m) => sum + m.completedJobs, 0);
      const totalBlockedJobs = members.reduce((sum, m) => sum + m.blockedJobs, 0);
      const totalOverdueJobs = members.reduce((sum, m) => sum + m.overdueJobs, 0);
      const totalPendingSteps = members.reduce((sum, m) => sum + m.pendingSteps, 0);
      const totalGovtFees = Number(members.reduce((sum, m) => sum + m.govtFeesTotal, 0).toFixed(3));
      const totalRevenue = Number(members.reduce((sum, m) => sum + m.totalServiceRevenue, 0).toFixed(3));
      const totalSalesAssignedJobs = members.reduce((sum, m) => sum + m.salesAssignedJobsCount, 0);
      const totalWalkinSales = members.reduce((sum, m) => sum + m.walkinSalesCount, 0);
      const totalEnquiries = members.reduce((sum, m) => sum + m.enquiriesCount, 0);
      const overallCompletionRate = totalJobs > 0 ? Number(((totalCompletedJobs / totalJobs) * 100).toFixed(1)) : 0;
      const opsHeadDelegatedCount = allJobs.filter(j => {
        const assigner = opsEmployees.find(e => e.id === j.assigned_by);
        return (assigner as any)?.is_ops_head && j.employee_id && j.employee_id !== j.assigned_by;
      }).length;

      const busiestMember = members.length > 0 && members[0].activeJobs > 0 ? members[0] : null;
      
      const eligibleForSpeed = members.filter(m => m.totalJobs >= 2);
      const topPerformerByCompletion = eligibleForSpeed.length > 0
        ? [...eligibleForSpeed].sort((a, b) => b.completionRate - a.completionRate)[0]
        : null;

      return {
        members,
        summary: {
          totalMembers,
          totalJobs,
          totalActiveJobs,
          totalCompletedJobs,
          totalBlockedJobs,
          totalOverdueJobs,
          totalPendingSteps,
          totalGovtFees,
          totalRevenue,
          totalSalesAssignedJobs,
          totalWalkinSales,
          totalEnquiries,
          overallCompletionRate,
          opsHeadDelegatedCount,
          busiestMember,
          topPerformerByCompletion,
        },
        dateLabel: dateRange.label,
      };
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
};
