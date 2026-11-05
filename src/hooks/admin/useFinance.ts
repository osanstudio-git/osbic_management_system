import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';

export interface FinanceDealItem {
  id: string;
  job_code: string;
  custom_name: string | null;
  client_id: string;
  client_name: string;
  client_company: string | null;
  client_phone: string | null;
  sales_rep_id: string | null;
  sales_rep_name: string;
  sales_rep_code: string | null;
  sales_rep_avatar: string | null;
  ops_rep_id: string | null;
  ops_rep_name: string;
  service_id: string | null;
  service_name: string;
  service_category: string;
  branch_id: string | null;
  branch_name: string;
  status: string;
  created_at: string;
  total_fee: number;
  work_fee: number;      // Net Company Profit
  ministry_fee: number;  // Government Fee
  advance_amount: number;
  advance_paid: boolean;
  remaining_amount: number;
  remaining_paid: boolean;
  collected_amount: number;
  pending_amount: number;
}

export interface DailySalesSummary {
  date: string;          // 'YYYY-MM-DD'
  formattedDate: string; // e.g. '05 Nov 2026'
  isToday: boolean;
  dealsCount: number;
  totalSales: number;
  govtFees: number;
  netProfit: number;
  collectedAmount: number;
  pendingAmount: number;
  deals: FinanceDealItem[];
}

export interface SalesRepPerformance {
  employeeId: string;
  fullName: string;
  employeeCode: string | null;
  avatarUrl: string | null;
  department: string | null;
  branchName: string;
  dealsWonCount: number;
  totalSales: number;
  govtFees: number;
  netProfit: number;
  collectedAmount: number;
  pendingAmount: number;
  avgDealSize: number;
  deals: FinanceDealItem[];
}

export interface GovtFeeDateItem {
  date: string;
  formattedDate: string;
  jobsCount: number;
  govtFeeTotal: number;
  totalSales: number;
  govtFeePercentage: number;
  deals: FinanceDealItem[];
}

export interface GovtFeeEmployeeItem {
  employeeId: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  roleType: 'sales' | 'operations';
  jobsCount: number;
  govtFeeTotal: number;
  totalSales: number;
  netProfit: number;
  deals: FinanceDealItem[];
}

export interface FinanceMetrics {
  // Classic summary metrics
  totalRevenue: number;
  monthlyRevenue: number;
  netProfit: number;
  ministryHeld: number;
  advancesUnpaid: number;
  remainingUnpaid: number;
  profitabilityByService: { name: string; value: number; govtFee: number; profit: number; count: number }[];
  employeePerformance: { name: string; completed: number; revenue: number }[];

  // Enhanced Daily & Live Metrics
  todaySales: number;
  todayDealsCount: number;
  todayGovtFees: number;
  todayNetProfit: number;
  todayCollected: number;
  
  // Total aggregations
  totalGovtFees: number;
  totalCollected: number;
  totalPending: number;

  // Breakdown Collections
  dailySales: DailySalesSummary[];
  salesRepPerformance: SalesRepPerformance[];
  govtFeesDateWise: GovtFeeDateItem[];
  govtFeesEmployeeWise: GovtFeeEmployeeItem[];
  allDeals: FinanceDealItem[];
  employeesList: { id: string; fullName: string; employeeCode: string | null; department: string | null }[];
}

export const useFinanceMetrics = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['admin', 'finance_metrics_v2', branchId],
    refetchInterval: 60000, // Auto-refresh every 60s
    queryFn: async (): Promise<FinanceMetrics> => {
      // 1. Fetch profiles for employee & client lookup
      const { data: profiles = [], error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, employee_code, email, phone, role, department, avatar_url, branch_id, company_name, can_do_sales');
      if (profilesError) throw profilesError;

      const profileMap = new Map<string, any>();
      profiles.forEach(p => profileMap.set(p.id, p));

      // 2. Fetch services for category and name lookup
      const { data: services = [] } = await supabase
        .from('services')
        .select('id, name_en, name_ar, category, work_fee, ministry_fee');
      const serviceMap = new Map<string, any>();
      services.forEach(s => serviceMap.set(s.id, s));

      // 3. Fetch branches for branch name lookup
      const { data: branches = [] } = await supabase
        .from('branches')
        .select('id, name, code');
      const branchMap = new Map<string, any>();
      branches.forEach(b => branchMap.set(b.id, b));

      // 4. Fetch jobs
      let query = supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: jobs = [], error: jobsError } = await query;
      if (jobsError) throw jobsError;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalRevenue = 0;
      let monthlyRevenue = 0;
      let netProfit = 0;
      let totalGovtFees = 0;
      let advancesUnpaid = 0;
      let remainingUnpaid = 0;
      let totalCollected = 0;
      let totalPending = 0;

      let todaySales = 0;
      let todayDealsCount = 0;
      let todayGovtFees = 0;
      let todayNetProfit = 0;
      let todayCollected = 0;

      const serviceAggMap: Record<string, { value: number; govtFee: number; profit: number; count: number }> = {};
      const salesRepMap = new Map<string, SalesRepPerformance>();
      const dailySalesMap = new Map<string, DailySalesSummary>();
      const govtFeeDateMap = new Map<string, GovtFeeDateItem>();
      const govtFeeEmpMap = new Map<string, GovtFeeEmployeeItem>();
      const allDeals: FinanceDealItem[] = [];

      jobs.forEach((job: any) => {
        const jobCreatedDate = new Date(job.created_at);
        const dateKey = format(jobCreatedDate, 'yyyy-MM-dd');
        const formattedDate = format(jobCreatedDate, 'dd MMM yyyy');
        const isJobToday = isToday(jobCreatedDate);

        // Fees calculation
        const totalFee = Number(job.total_fee) || 0;
        const ministryFee = Number(job.ministry_fee) || 0;
        let workFee = Number(job.work_fee) || 0;
        if (!workFee && totalFee > 0) {
          workFee = Math.max(0, totalFee - ministryFee);
        }

        // Advance & Remaining calculation
        let advanceAmt = Number(job.advance_amount);
        if (isNaN(advanceAmt) || advanceAmt <= 0) {
          advanceAmt = totalFee * (Number(job.advance_percentage) || 50) / 100;
        }
        let remainingAmt = Number(job.remaining_amount);
        if (isNaN(remainingAmt) || remainingAmt <= 0) {
          remainingAmt = Math.max(0, totalFee - advanceAmt);
        }

        const advancePaid = Boolean(job.advance_paid);
        const remainingPaid = Boolean(job.remaining_paid);

        const collectedAmount = (advancePaid ? advanceAmt : 0) + (remainingPaid ? remainingAmt : 0);
        const pendingAmount = Math.max(0, totalFee - collectedAmount);

        // Global Totals
        totalRevenue += totalFee;
        netProfit += workFee;
        totalGovtFees += ministryFee;
        totalCollected += collectedAmount;
        totalPending += pendingAmount;

        if (jobCreatedDate >= firstDayOfMonth) {
          monthlyRevenue += totalFee;
        }

        if (isJobToday) {
          todaySales += totalFee;
          todayDealsCount += 1;
          todayGovtFees += ministryFee;
          todayNetProfit += workFee;
          todayCollected += collectedAmount;
        }

        if (!advancePaid) advancesUnpaid += advanceAmt;
        if (!remainingPaid) remainingUnpaid += remainingAmt;

        // Resolve Entities
        const clientProfile = profileMap.get(job.client_id);
        const clientName = clientProfile?.full_name || 'Client';
        const clientCompany = clientProfile?.company_name || null;
        const clientPhone = clientProfile?.phone || null;

        // Identify Sales Rep (won the deal)
        const salesRepId = job.sales_employee_id || job.assigned_by || job.employee_id;
        const salesProfile = profileMap.get(salesRepId);
        const salesRepName = salesProfile?.full_name || 'Direct / Center';
        const salesRepCode = salesProfile?.employee_code || null;
        const salesRepAvatar = salesProfile?.avatar_url || null;

        // Ops Rep
        const opsRepId = job.ops_employee_id || job.employee_id;
        const opsProfile = profileMap.get(opsRepId);
        const opsRepName = opsProfile?.full_name || 'Unassigned Ops';

        // Service & Branch
        const serviceObj = serviceMap.get(job.service_id);
        const serviceName = serviceObj?.name_en || job.custom_name || 'Consulting Service';
        const serviceCategory = serviceObj?.category || 'general';

        const branchObj = branchMap.get(job.branch_id);
        const branchName = branchObj?.name || 'Main HQ';

        const dealItem: FinanceDealItem = {
          id: job.id,
          job_code: job.job_code || `JOB-${job.id.slice(0, 6)}`,
          custom_name: job.custom_name,
          client_id: job.client_id,
          client_name: clientName,
          client_company: clientCompany,
          client_phone: clientPhone,
          sales_rep_id: salesRepId,
          sales_rep_name: salesRepName,
          sales_rep_code: salesRepCode,
          sales_rep_avatar: salesRepAvatar,
          ops_rep_id: opsRepId,
          ops_rep_name: opsRepName,
          service_id: job.service_id,
          service_name: serviceName,
          service_category: serviceCategory,
          branch_id: job.branch_id,
          branch_name: branchName,
          status: job.status,
          created_at: job.created_at,
          total_fee: totalFee,
          work_fee: workFee,
          ministry_fee: ministryFee,
          advance_amount: advanceAmt,
          advance_paid: advancePaid,
          remaining_amount: remainingAmt,
          remaining_paid: remainingPaid,
          collected_amount: collectedAmount,
          pending_amount: pendingAmount,
        };

        allDeals.push(dealItem);

        // 1. Group by Daily Sales
        if (!dailySalesMap.has(dateKey)) {
          dailySalesMap.set(dateKey, {
            date: dateKey,
            formattedDate,
            isToday: isJobToday,
            dealsCount: 0,
            totalSales: 0,
            govtFees: 0,
            netProfit: 0,
            collectedAmount: 0,
            pendingAmount: 0,
            deals: [],
          });
        }
        const dayStat = dailySalesMap.get(dateKey)!;
        dayStat.dealsCount += 1;
        dayStat.totalSales += totalFee;
        dayStat.govtFees += ministryFee;
        dayStat.netProfit += workFee;
        dayStat.collectedAmount += collectedAmount;
        dayStat.pendingAmount += pendingAmount;
        dayStat.deals.push(dealItem);

        // 2. Group by Sales Rep Performance (Won Deals & Revenue)
        const salesKey = salesRepId || 'unassigned_sales';
        if (!salesRepMap.has(salesKey)) {
          salesRepMap.set(salesKey, {
            employeeId: salesKey,
            fullName: salesRepName,
            employeeCode: salesRepCode,
            avatarUrl: salesRepAvatar,
            department: salesProfile?.department || 'sales',
            branchName: branchObj?.name || 'All',
            dealsWonCount: 0,
            totalSales: 0,
            govtFees: 0,
            netProfit: 0,
            collectedAmount: 0,
            pendingAmount: 0,
            avgDealSize: 0,
            deals: [],
          });
        }
        const repStat = salesRepMap.get(salesKey)!;
        repStat.dealsWonCount += 1;
        repStat.totalSales += totalFee;
        repStat.govtFees += ministryFee;
        repStat.netProfit += workFee;
        repStat.collectedAmount += collectedAmount;
        repStat.pendingAmount += pendingAmount;
        repStat.deals.push(dealItem);

        // 3. Government Fee Date-wise
        if (ministryFee > 0 || totalFee > 0) {
          if (!govtFeeDateMap.has(dateKey)) {
            govtFeeDateMap.set(dateKey, {
              date: dateKey,
              formattedDate,
              jobsCount: 0,
              govtFeeTotal: 0,
              totalSales: 0,
              govtFeePercentage: 0,
              deals: [],
            });
          }
          const gDate = govtFeeDateMap.get(dateKey)!;
          gDate.jobsCount += 1;
          gDate.govtFeeTotal += ministryFee;
          gDate.totalSales += totalFee;
          gDate.deals.push(dealItem);
        }

        // 4. Government Fee Employee-wise (Both Sales Rep who closed it & Ops who handled it)
        const empKey = salesRepId || opsRepId || 'unassigned';
        const empProfile = profileMap.get(empKey);
        if (!govtFeeEmpMap.has(empKey)) {
          govtFeeEmpMap.set(empKey, {
            employeeId: empKey,
            fullName: empProfile?.full_name || salesRepName,
            employeeCode: empProfile?.employee_code || null,
            department: empProfile?.department || 'sales',
            roleType: empProfile?.department === 'operations' ? 'operations' : 'sales',
            jobsCount: 0,
            govtFeeTotal: 0,
            totalSales: 0,
            netProfit: 0,
            deals: [],
          });
        }
        const gEmp = govtFeeEmpMap.get(empKey)!;
        gEmp.jobsCount += 1;
        gEmp.govtFeeTotal += ministryFee;
        gEmp.totalSales += totalFee;
        gEmp.netProfit += workFee;
        gEmp.deals.push(dealItem);

        // 5. Service Aggregation
        if (!serviceAggMap[serviceName]) {
          serviceAggMap[serviceName] = { value: 0, govtFee: 0, profit: 0, count: 0 };
        }
        serviceAggMap[serviceName].value += totalFee;
        serviceAggMap[serviceName].govtFee += ministryFee;
        serviceAggMap[serviceName].profit += workFee;
        serviceAggMap[serviceName].count += 1;
      });

      // Calculate avg deal sizes
      salesRepMap.forEach(rep => {
        rep.avgDealSize = rep.dealsWonCount > 0 ? rep.totalSales / rep.dealsWonCount : 0;
      });

      // Calculate govt fee percentages
      govtFeeDateMap.forEach(g => {
        g.govtFeePercentage = g.totalSales > 0 ? (g.govtFeeTotal / g.totalSales) * 100 : 0;
      });

      // Sort collections
      const sortedDailySales = Array.from(dailySalesMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const sortedSalesReps = Array.from(salesRepMap.values()).sort(
        (a, b) => b.totalSales - a.totalSales
      );

      const sortedGovtFeeDates = Array.from(govtFeeDateMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const sortedGovtFeeEmps = Array.from(govtFeeEmpMap.values()).sort(
        (a, b) => b.govtFeeTotal - a.govtFeeTotal
      );

      const sortedServices = Object.entries(serviceAggMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.value - a.value);

      // Employees list for filter dropdown
      const employeesList = profiles
        .filter(p => p.role === 'employee' || p.role === 'admin')
        .map(p => ({
          id: p.id,
          fullName: p.full_name || 'Staff',
          employeeCode: p.employee_code,
          department: p.department,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      return {
        totalRevenue,
        monthlyRevenue,
        netProfit,
        ministryHeld: totalGovtFees,
        advancesUnpaid,
        remainingUnpaid,
        profitabilityByService: sortedServices,
        employeePerformance: sortedSalesReps.map(r => ({
          name: r.fullName,
          completed: r.dealsWonCount,
          revenue: r.totalSales,
        })),

        // Live & Daily
        todaySales,
        todayDealsCount,
        todayGovtFees,
        todayNetProfit,
        todayCollected,

        // Totals
        totalGovtFees,
        totalCollected,
        totalPending,

        // Detailed breakdowns
        dailySales: sortedDailySales,
        salesRepPerformance: sortedSalesReps,
        govtFeesDateWise: sortedGovtFeeDates,
        govtFeesEmployeeWise: sortedGovtFeeEmps,
        allDeals,
        employeesList,
      };
    },
  });
};
