import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Download, 
  Calendar as CalendarIcon,
  Wallet,
  Briefcase,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  DollarSign,
  Compass,
  TrendingUp,
  User,
  FileSpreadsheet,
  X,
  CreditCard,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DailySalesSheetModal } from '../../components/employee/DailySalesSheetModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { format, subDays, startOfWeek, startOfMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export default function EmployeeReports() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  
  // States
  const [reportType, setReportType] = useState<'payments' | 'jobs' | 'sales'>('payments');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDailySheetOpen, setIsDailySheetOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [jobScope, setJobScope] = useState<'all' | 'handled' | 'assigned'>('all');
  const [leadScope, setLeadScope] = useState<'all' | 'handled' | 'distributed'>('all');
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const toggleExpandJob = (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  // 1. Fetch Payments Data
  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['employee', 'reports', 'payments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('job_payments')
        .select(`
          *,
          job:jobs!job_id(
            id,
            job_code,
            custom_name,
            total_fee,
            ministry_fee,
            work_fee,
            advance_amount,
            remaining_amount,
            advance_paid,
            remaining_paid,
            employee_id,
            sales_employee_id,
            status,
            client:profiles!client_id(full_name),
            service:services!service_id(name_en, name_ar)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data as any[]) || []).filter(p => {
        const j = p.job;
        if (!j) return false;
        if (j.sales_employee_id) {
          return j.sales_employee_id === user.id;
        }
        return j.employee_id === user.id;
      });
    },
    enabled: !!user?.id
  });

  // 2. Fetch Jobs Data (both handled directly and assigned out to Ops)
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['employee', 'reports', 'jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name),
          service:services!service_id(name_en, name_ar),
          ops_specialist:profiles!jobs_ops_employee_id_fkey(full_name, employee_code)
        `)
        .or(`sales_employee_id.eq.${user.id},employee_id.eq.${user.id},assigned_by.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).filter((j: any) => {
        return j.sales_employee_id === user.id || j.employee_id === user.id || j.assigned_by === user.id;
      });
    },
    enabled: !!user?.id
  });

  // 3. Fetch Leads Data for Sales Report (both assigned to me and distributed by me)
  const { data: leads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['employee', 'reports', 'leads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name), assigned_to_profile:profiles!assigned_to(full_name, employee_code)')
        .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!profile?.can_do_sales
  });

  // 4. Fetch Invoices/Quotations for Pipeline Valuation
  const { data: quotations, isLoading: isLoadingQuotations } = useQuery({
    queryKey: ['employee', 'reports', 'quotations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lead:leads!lead_id(*), client:profiles!client_id(full_name)')
        .eq('employee_id', user.id)
        .eq('type', 'quotation')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!profile?.can_do_sales
  });

  const isLoading = reportType === 'payments' 
    ? isLoadingPayments 
    : reportType === 'jobs' 
      ? isLoadingJobs 
      : (isLoadingLeads || isLoadingQuotations);

  // Filter Logic
  const getFilteredData = (dataArray: any[], dateField: string) => {
    if (!dataArray) return [];
    
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (timeFilter === 'today') startDate = startOfDay(now);
    if (timeFilter === 'week') startDate = startOfWeek(now);
    if (timeFilter === 'month') startDate = startOfMonth(now);
    if (timeFilter === 'custom') {
      if (customStartDate) startDate = startOfDay(new Date(customStartDate));
      if (customEndDate) endDate = endOfDay(new Date(customEndDate));
    }

    return dataArray.filter(item => {
      // Time filter (prefer payment_date for payments)
      const rawDate = (reportType === 'payments' && item.payment_date) ? item.payment_date : item[dateField];
      const itemDate = new Date(rawDate);
      const matchesStart = startDate ? isAfter(itemDate, startDate) || itemDate.getTime() === startDate.getTime() : true;
      const matchesEnd = endDate ? isBefore(itemDate, endDate) || itemDate.getTime() === endDate.getTime() : true;
      const matchesTime = matchesStart && matchesEnd;
      
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      let matchesSearch = false;
      
      if (reportType === 'payments') {
        matchesSearch = 
          item.job?.job_code?.toLowerCase().includes(searchLower) ||
          item.job?.client?.full_name?.toLowerCase().includes(searchLower) ||
          item.job?.custom_name?.toLowerCase().includes(searchLower) ||
          item.job?.service?.name_en?.toLowerCase().includes(searchLower) ||
          item.reference_number?.toLowerCase().includes(searchLower);
      } else if (reportType === 'jobs') {
        matchesSearch = 
          item.job_code?.toLowerCase().includes(searchLower) ||
          item.client?.full_name?.toLowerCase().includes(searchLower) ||
          item.custom_name?.toLowerCase().includes(searchLower) ||
          item.service?.name_en?.toLowerCase().includes(searchLower);
      } else {
        // Sales report type filtering (works for both Lead and Quotation models)
        matchesSearch = 
          (item.contact_name || '').toLowerCase().includes(searchLower) ||
          (item.company_name || '').toLowerCase().includes(searchLower) ||
          (item.invoice_number || '').toLowerCase().includes(searchLower) ||
          (item.lead?.contact_name || '').toLowerCase().includes(searchLower) ||
          (item.client?.full_name || '').toLowerCase().includes(searchLower);
      }

      return matchesTime && matchesSearch;
    });
  };

  const filteredPayments = useMemo(() => getFilteredData(payments || [], 'created_at'), [payments, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);
  
  const rawFilteredJobs = useMemo(() => getFilteredData(jobs || [], 'created_at'), [jobs, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);

  const filteredJobs = useMemo(() => {
    if (jobScope === 'handled') {
      return rawFilteredJobs.filter(j => j.employee_id === user?.id || j.ops_employee_id === user?.id);
    }
    if (jobScope === 'assigned') {
      return rawFilteredJobs.filter(j => (j.sales_employee_id === user?.id || j.assigned_by === user?.id) && j.ops_employee_id !== user?.id && j.employee_id !== user?.id);
    }
    return rawFilteredJobs;
  }, [rawFilteredJobs, jobScope, user?.id]);

  const rawFilteredLeads = useMemo(() => {
    if (reportType !== 'sales') return [];
    return getFilteredData(leads || [], 'created_at');
  }, [leads, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);

  const filteredLeads = useMemo(() => {
    if (leadScope === 'handled') {
      return rawFilteredLeads.filter(l => l.assigned_to === user?.id);
    }
    if (leadScope === 'distributed') {
      return rawFilteredLeads.filter(l => l.assigned_by === user?.id && l.assigned_to !== user?.id);
    }
    return rawFilteredLeads;
  }, [rawFilteredLeads, leadScope, user?.id]);

  // Counts for scope filter pills
  const jobsHandledCount = useMemo(() => (jobs || []).filter((j: any) => j.employee_id === user?.id || j.ops_employee_id === user?.id).length, [jobs, user?.id]);
  const jobsAssignedCount = useMemo(() => (jobs || []).filter((j: any) => (j.sales_employee_id === user?.id || j.assigned_by === user?.id) && j.ops_employee_id !== user?.id && j.employee_id !== user?.id).length, [jobs, user?.id]);

  const leadsHandledCount = useMemo(() => (leads || []).filter((l: any) => l.assigned_to === user?.id).length, [leads, user?.id]);
  const leadsDistributedCount = useMemo(() => (leads || []).filter((l: any) => l.assigned_by === user?.id && l.assigned_to !== user?.id).length, [leads, user?.id]);

  const filteredQuotations = useMemo(() => {
    if (reportType !== 'sales') return [];
    return getFilteredData(quotations || [], 'created_at');
  }, [quotations, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);

  // Calculations for Sales Tab
  const salesStats = useMemo(() => {
    if (reportType !== 'sales') {
      return {
        totalLeadsCount: 0,
        convertedLeadsCount: 0,
        conversionRate: 0,
        pipelineValue: 0,
        avgQuotationValue: 0,
        leadsByStatus: {} as Record<string, number>,
        leadsBySource: {} as Record<string, number>
      };
    }

    const totalLeadsCount = filteredLeads.length;
    const convertedLeadsCount = filteredLeads.filter(l => l.status === 'converted').length;
    const conversionRate = totalLeadsCount > 0 ? (convertedLeadsCount / totalLeadsCount) * 100 : 0;

    const pipelineValue = filteredQuotations.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const avgQuotationValue = filteredQuotations.length > 0 ? pipelineValue / filteredQuotations.length : 0;

    // Leads by status counts
    const leadsByStatus: Record<string, number> = {
      new: 0, contacted: 0, interested: 0, qualified: 0, quoted: 0, negotiating: 0, converted: 0, lost: 0, on_hold: 0
    };
    filteredLeads.forEach(l => {
      if (leadsByStatus[l.status] !== undefined) {
        leadsByStatus[l.status]++;
      }
    });

    // Leads by source counts
    const leadsBySource: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const sourceName = l.lead_sources?.name || 'Direct / Unknown';
      leadsBySource[sourceName] = (leadsBySource[sourceName] || 0) + 1;
    });

    return {
      totalLeadsCount,
      convertedLeadsCount,
      conversionRate,
      pipelineValue,
      avgQuotationValue,
      leadsByStatus,
      leadsBySource
    };
  }, [filteredLeads, filteredQuotations, reportType]);

  // Filter active (non-cancelled) payments so cancelled files do not inflate finance figures
  const activePayments = useMemo(() => {
    return filteredPayments.filter(p => {
      const isJobCancelled = p.job?.status === 'cancelled';
      const isPaymentCancelled = p.status === 'cancelled' || p.status === 'voided' || p.status === 'refunded';
      return !isJobCancelled && !isPaymentCancelled;
    });
  }, [filteredPayments]);

  // Group payments by Job/Client for cleaner reporting UI and zero-duplication view
  const groupedJobPayments = useMemo(() => {
    if (reportType !== 'payments') return [];

    const groupsMap = new Map<string, {
      jobId: string;
      job: any;
      client: any;
      payments: any[];
      totalPaid: number;
      dealTotalFee: number;
      dealWorkFee: number;
      dealMinistryFee: number;
      realizedProfit: number;
      latestDate: string;
      latestPaymentDate: string;
      isAllCancelled: boolean;
      status: string;
    }>();

    filteredPayments.forEach(p => {
      const groupKey = p.job_id || p.job?.id || p.id;
      const pAmount = Number(p.amount || 0);
      const isCancelled = p.job?.status === 'cancelled' || p.status === 'cancelled' || p.status === 'voided' || p.status === 'refunded';
      
      const jobTotalFee = Number(p.job?.total_fee || 0);
      const jobWorkFee = Number(p.job?.work_fee || 0);
      const jobMinistryFee = Number(p.job?.ministry_fee || 0);
      const paymentProfit = (!isCancelled && jobTotalFee > 0) ? (pAmount / jobTotalFee) * jobWorkFee : (isCancelled ? 0 : jobWorkFee);
      const dateToUse = (p.payment_date || p.created_at);

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          jobId: groupKey,
          job: p.job,
          client: p.job?.client || p.client,
          payments: [p],
          totalPaid: isCancelled ? 0 : pAmount,
          dealTotalFee: jobTotalFee,
          dealWorkFee: jobWorkFee,
          dealMinistryFee: jobMinistryFee,
          realizedProfit: paymentProfit,
          latestDate: p.created_at,
          latestPaymentDate: dateToUse,
          isAllCancelled: isCancelled,
          status: p.job?.status || 'active',
        });
      } else {
        const existing = groupsMap.get(groupKey)!;
        existing.payments.push(p);
        if (!isCancelled) {
          existing.totalPaid += pAmount;
          existing.realizedProfit += paymentProfit;
        }
        if (new Date(p.created_at) > new Date(existing.latestDate)) {
          existing.latestDate = p.created_at;
        }
        if (new Date(dateToUse) > new Date(existing.latestPaymentDate)) {
          existing.latestPaymentDate = dateToUse;
        }
        if (!isCancelled) {
          existing.isAllCancelled = false;
        }
      }
    });

    return Array.from(groupsMap.values()).sort((a, b) => new Date(b.latestPaymentDate).getTime() - new Date(a.latestPaymentDate).getTime());
  }, [filteredPayments, reportType]);

  // Calculations for Payments (strictly based on active payments)
  const totalCollected = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const uniqueJobsFromPaymentsSet = new Set(activePayments.map(p => p.job_id));
  const totalTransactionsCount = activePayments.length;
  const cancelledPaymentsCount = filteredPayments.length - activePayments.length;
  
  // Calculate realized profit proportionally from active payments only
  const realizedProfit = activePayments.reduce((sum: number, p: any) => {
    const paymentAmount = Number(p.amount || 0);
    const jobTotal = Number(p.job?.total_fee || 0);
    const jobProfit = Number(p.job?.work_fee || 0);
    
    if (jobTotal > 0) {
      return sum + (paymentAmount / jobTotal) * jobProfit;
    }
    return sum;
  }, 0);

  // Calculations for Jobs (exclude cancelled jobs from expected center profit)
  const activeJobs = useMemo(() => filteredJobs.filter(j => j.status !== 'cancelled'), [filteredJobs]);
  const totalJobProfits = activeJobs.reduce((sum, j) => sum + Number(j.work_fee || 0), 0);
  const completedJobsCount = filteredJobs.filter(j => j.status === 'completed').length;

  // Incentive Calculation (Always based on realized profit from payments)
  const applicableProfit = realizedProfit;
  const incentiveAmount = applicableProfit > 1200 ? (applicableProfit - 1200) * 0.12 : 0;

  const exportToCSV = () => {
    let headers: string[] = [];
    let csvData: any[][] = [];
    let filename = '';

    if (reportType === 'payments') {
      if (!filteredPayments.length) return;
      headers = [
        'Transaction Date',
        'Job Code',
        'Client Name',
        'Service',
        'Payment Method',
        'Reference',
        'Payment Amount (OMR)',
        'Effective Counted (OMR)',
        'Accounting Status',
        'Job Total Fee (OMR)',
        'Service Fee / Work Fee (OMR)',
        'Ministry Fee (OMR)',
        'Job Status'
      ];
      csvData = filteredPayments.map(p => {
        const isCancelled = p.job?.status === 'cancelled' || p.status === 'cancelled' || p.status === 'voided' || p.status === 'refunded';
        return [
          format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
          p.job?.job_code || 'N/A',
          p.job?.client?.full_name || 'N/A',
          p.job?.custom_name || p.job?.service?.name_en || 'N/A',
          p.payment_method?.toUpperCase() || 'N/A',
          p.reference_number || 'N/A',
          p.amount?.toFixed(3) || '0.000',
          isCancelled ? '0.000' : (p.amount?.toFixed(3) || '0.000'),
          isCancelled ? 'CANCELLED (EXCLUDED)' : 'ACTIVE',
          p.job?.total_fee?.toFixed(3) || '0.000',
          p.job?.work_fee?.toFixed(3) || '0.000',
          p.job?.ministry_fee?.toFixed(3) || '0.000',
          p.job?.status?.toUpperCase() || 'N/A'
        ];
      });
      filename = `Payments_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    } else if (reportType === 'sales') {
      if (!filteredLeads.length) return;
      headers = [
        'Lead Code',
        'Contact Name',
        'Phone Number',
        'Email Address',
        'Company Name',
        'Lead Source',
        'Status',
        'Interested Services',
        'Quotes Count',
        'Total Quotations (OMR)',
        'Next Follow-up',
        'Created Date'
      ];
      csvData = filteredLeads.map(lead => {
        const leadQuotes = (filteredQuotations || []).filter(q => q.lead_id === lead.id);
        const quotesTotal = leadQuotes.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
        const interestedServices = (lead.interested_services || [])
          .map((s: any) => s.name || s.name_en || s)
          .join('; ') || 'N/A';

        return [
          lead.lead_code || 'N/A',
          lead.contact_name || 'N/A',
          lead.contact_phone || 'N/A',
          lead.contact_email || 'N/A',
          lead.company_name || 'N/A',
          lead.lead_sources?.name || 'Direct / Unknown',
          lead.status?.toUpperCase() || 'N/A',
          interestedServices,
          leadQuotes.length.toString(),
          quotesTotal.toFixed(3),
          lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), 'yyyy-MM-dd') : 'N/A',
          format(new Date(lead.created_at), 'yyyy-MM-dd HH:mm')
        ];
      });
      filename = `Leads_Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    } else {
      if (!filteredJobs.length) return;
      headers = [
        'Created Date',
        'Started Date',
        'Job Code',
        'Client Name',
        'Service',
        'Total Fee (OMR)',
        'Service Fee / Work Fee (OMR)',
        'Ministry Fee (OMR)',
        'Status',
        'Payment Status'
      ];
      csvData = filteredJobs.map(j => [
        format(new Date(j.created_at), 'yyyy-MM-dd HH:mm'),
        j.started_at ? format(new Date(j.started_at), 'yyyy-MM-dd HH:mm') : 'N/A',
        j.job_code || 'N/A',
        j.client?.full_name || 'N/A',
        j.custom_name || j.service?.name_en || 'N/A',
        j.total_fee?.toFixed(3) || '0.000',
        j.work_fee?.toFixed(3) || '0.000',
        j.ministry_fee?.toFixed(3) || '0.000',
        j.status?.toUpperCase() || 'N/A',
        j.remaining_paid ? 'Fully Paid' : (j.advance_paid ? 'Advance Paid' : 'Unpaid')
      ]);
      filename = `All_Jobs_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    }

    const csvContent = [
      headers.join(','),
      ...csvData.map((row: any[]) => row.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={12} />;
      case 'active': return <Clock size={12} />;
      case 'cancelled': return <Ban size={12} />;
      default: return null;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'active': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 font-sans">
        <div>
          <h1 className="text-2xl font-syne font-bold text-foreground">{isRtl ? 'تقارير الموظف' : 'Employee Reports'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{isRtl ? 'مراقبة أعمالك المدفوعة، السلفيات، والمهام المسندة.' : 'Monitor your paid works, advances, and overall job assignments.'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto flex-1 justify-end">
          {/* Report Type Toggle */}
          <div className="flex bg-muted/30 border border-border rounded-xl p-1 shrink-0">
            <button
              onClick={() => setReportType('payments')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${reportType === 'payments' ? 'bg-background shadow-sm text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Wallet size={14} /> {isRtl ? 'تقرير المدفوعات' : 'Paid Report'}
            </button>
            <button
              onClick={() => setReportType('jobs')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${reportType === 'jobs' ? 'bg-background shadow-sm text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Briefcase size={14} /> {isRtl ? 'جميع الوظائف' : 'All Jobs'}
            </button>
            {profile?.can_do_sales && (
              <button
                onClick={() => setReportType('sales')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${reportType === 'sales' ? 'bg-background shadow-sm text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Compass size={14} /> {isRtl ? 'تقرير المبيعات' : 'Sales Report'}
              </button>
            )}
          </div>

          {/* Time Filters */}
          <div className="flex bg-muted/30 border border-border rounded-xl p-1 shrink-0">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeFilter === 'today' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'اليوم' : 'Today'}
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeFilter === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'الأسبوع' : 'Week'}
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeFilter === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'الشهر' : 'Month'}
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'الكل' : 'All'}
            </button>
            <button
              onClick={() => setTimeFilter('custom')}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeFilter === 'custom' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'مخصص' : 'Custom'}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {reportType === 'sales' && (
              <button
                onClick={() => setIsDailySheetOpen(true)}
                className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all shadow-sm active:scale-95 shrink-0"
              >
                <FileSpreadsheet size={16} />
                <span>{isRtl ? 'ورقة المبيعات اليومية' : 'Daily Sales Sheet (DSR)'}</span>
              </button>
            )}

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 shrink-0"
            >
              <Download size={16} />
              {reportType === 'sales'
                ? (isRtl ? 'تصدير العملاء المحتملين (CSV)' : 'Export Leads CSV')
                : reportType === 'payments'
                  ? (isRtl ? 'تصدير المدفوعات (CSV)' : 'Export Payments CSV')
                  : (isRtl ? 'تصدير الوظائف (CSV)' : 'Export Jobs CSV')
              }
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Picker row */}
      {timeFilter === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-4 bg-card border border-border p-4 rounded-xl font-sans"
        >
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'من:' : 'From:'}</span>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'إلى:' : 'To:'}</span>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </motion.div>
      )}

      {reportType === 'sales' ? (
        <div className="space-y-6 font-sans">
          {/* Sales Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total Leads */}
            <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'إجمالي العملاء المحتملين' : 'Total Leads Managed'}</p>
                  <h3 className="text-3xl font-syne font-bold text-foreground">
                    {salesStats.totalLeadsCount}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Compass size={20} />
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'معدل التحويل' : 'Conversion Rate'}</p>
                  <h3 className="text-3xl font-syne font-bold text-foreground">
                    {salesStats.conversionRate.toFixed(1)}%
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            </div>

            {/* Pipeline Value */}
            <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'قيمة خط الأنابيب' : 'Pipeline Value'}</p>
                  <h3 className="text-3xl font-syne font-bold text-foreground">
                    <span className="text-blue-500 text-lg mr-1">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                    {salesStats.pipelineValue.toFixed(3)}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Wallet size={20} />
                </div>
              </div>
            </div>

            {/* Avg Quotation Value */}
            <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition-colors">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'متوسط قيمة العرض' : 'Avg Quotation Value'}</p>
                  <h3 className="text-3xl font-syne font-bold text-foreground">
                    <span className="text-amber-500 text-lg mr-1">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                    {salesStats.avgQuotationValue.toFixed(3)}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Funnel */}
            <div className="bg-card border border-border p-6 rounded-2xl space-y-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" /> {isRtl ? 'توزيع قمع المبيعات' : 'Pipeline Funnel Distribution'}
              </h3>
              <div className="space-y-3.5 pt-2">
                {Object.entries(salesStats.leadsByStatus).map(([statusKey, count]) => {
                  const percentage = salesStats.totalLeadsCount > 0 ? (count / salesStats.totalLeadsCount) * 100 : 0;
                  
                  const getStatusLabelAr = (k: string) => {
                    switch (k) {
                      case 'new': return 'جديد';
                      case 'contacted': return 'تم التواصل';
                      case 'interested': return 'مهتم';
                      case 'qualified': return 'مؤهل';
                      case 'quoted': return 'تم تقديم عرض';
                      case 'negotiating:': return 'تفاوض';
                      case 'converted': return 'متحول';
                      case 'lost': return 'خسارة';
                      case 'on_hold': return 'قيد الانتظار';
                      default: return k;
                    }
                  };

                  return (
                    <div key={statusKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-muted-foreground">
                          {isRtl ? getStatusLabelAr(statusKey) : statusKey.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-foreground">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden border border-border/40">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            statusKey === 'converted' ? 'bg-emerald-500' :
                            statusKey === 'lost' ? 'bg-rose-500' :
                            statusKey === 'quoted' ? 'bg-amber-500' :
                            statusKey === 'contacted' ? 'bg-blue-500' : 'bg-primary'
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead Sources breakdown */}
            <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                {isRtl ? 'قنوات جذب العملاء' : 'Lead Capture Channels'}
              </h3>
              <div className="space-y-3 pt-2">
                {Object.keys(salesStats.leadsBySource).length > 0 ? (
                  Object.entries(salesStats.leadsBySource).map(([sourceName, count]) => {
                    const percentage = salesStats.totalLeadsCount > 0 ? (count / salesStats.totalLeadsCount) * 100 : 0;
                    return (
                      <div key={sourceName} className="flex items-center justify-between p-3 bg-muted/20 border border-border/40 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-foreground">{sourceName}</p>
                          <p className="text-[10px] text-muted-foreground">{isRtl ? 'مصدر القناة' : 'Channel source'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-primary">{count} {isRtl ? 'عميل' : 'leads'}</p>
                          <p className="text-[9px] text-muted-foreground">{percentage.toFixed(1)}% {isRtl ? 'نسبة المشاركة' : 'share'}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-muted-foreground">{isRtl ? 'لم يتم تسجيل قنوات.' : 'No channels recorded.'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Opportunities Detail Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">{isRtl ? `الفرص (${filteredLeads.length})` : `Opportunities (${filteredLeads.length})`}</h3>
                <div className="flex bg-muted/40 border border-border rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setLeadScope('all')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      leadScope === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? 'الكل' : 'All'} ({(leads || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadScope('handled')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      leadScope === 'handled' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? 'معالج بواسطتي' : 'Handling (Self)'} ({leadsHandledCount})
                  </button>
                  {leadsDistributedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setLeadScope('distributed')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        leadScope === 'distributed' ? 'bg-amber-500 text-black shadow-sm' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      {isRtl ? 'موزع للفريق' : 'Distributed to Team'} ({leadsDistributedCount})
                    </button>
                  )}
                </div>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} size={16} />
                <input
                  type="text"
                  placeholder={isRtl ? 'البحث عن الفرص...' : 'Search Opportunities...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full bg-muted/50 border border-border rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar">
              <table className="w-full border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="bg-muted/10 border-b border-border text-right">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'رمز العميل المحتمل' : 'Lead Code'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'جهة الاتصال' : 'Contact'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'الشركة' : 'Company'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'تاريخ الإضافة' : 'Date Added'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'المصدر' : 'Source'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className={`p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${isRtl ? 'text-left' : 'text-right'}`}>{isRtl ? 'إجمالي العروض' : 'Quotes Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map(lead => {
                      const leadQuotes = filteredQuotations.filter(q => q.lead_id === lead.id);
                      const leadQuotesTotal = leadQuotes.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
                      const isDistributed = lead.assigned_by === user?.id && lead.assigned_to && lead.assigned_to !== user?.id;
                      
                      const getStatusLabelAr = (k: string) => {
                        switch (k) {
                          case 'new': return 'جديد';
                          case 'contacted': return 'تم التواصل';
                          case 'interested': return 'مهتم';
                          case 'qualified': return 'مؤهل';
                          case 'quoted': return 'تم تقديم عرض';
                          case 'negotiating:': return 'تفاوض';
                          case 'converted': return 'متحول';
                          case 'lost': return 'خسارة';
                          case 'on_hold': return 'قيد الانتظار';
                          default: return k;
                        }
                      };

                      return (
                        <tr key={lead.id} className="hover:bg-white/5 transition-colors text-start">
                          <td className="p-4 whitespace-nowrap text-xs font-mono font-bold text-muted-foreground">{lead.lead_code || '-'}</td>
                          <td className="p-4 whitespace-nowrap text-xs">
                            <div className="font-bold text-foreground">{lead.contact_name}</div>
                            {isDistributed && lead.assigned_to_profile?.full_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold mt-0.5">
                                <span>↗</span>
                                <span>{isRtl ? 'مسند إلى:' : 'Assigned to:'} {lead.assigned_to_profile.full_name}</span>
                              </span>
                            )}
                          </td>
                          <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">{lead.company_name || '-'}</td>
                          <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">{format(new Date(lead.created_at), isRtl ? 'yyyy/MM/dd' : 'MMM dd, yyyy')}</td>
                          <td className="p-4 whitespace-nowrap text-xs">
                            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold">{lead.lead_sources?.name || (isRtl ? 'مباشر' : 'Direct')}</span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-muted/20 text-muted-foreground">
                              {isRtl ? getStatusLabelAr(lead.status) : lead.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`p-4 whitespace-nowrap text-xs font-bold text-primary ${isRtl ? 'text-left' : 'text-right'}`}>
                            {leadQuotesTotal > 0 ? (isRtl ? `${leadQuotesTotal.toFixed(3)} ر.ع.` : `${leadQuotesTotal.toFixed(3)} OMR`) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">{isRtl ? 'لم يتم العثور على فرص في الفترة الزمنية النشطة.' : 'No opportunities found in the active timeframe.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={cn(
            "grid grid-cols-1 gap-4 md:gap-6",
            reportType === 'payments' ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
          )}>
            {reportType === 'payments' ? (
              <>
                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'المدفوعات المحصلة' : 'Payments Collected'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        <span className="text-emerald-500 text-lg mr-1">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                        {totalCollected.toFixed(3)}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Wallet size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'الوظائف المعنية' : 'Jobs Involved'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        {uniqueJobsFromPaymentsSet.size}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Briefcase size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'إجمالي المعاملات' : 'Total Transactions'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground flex items-baseline gap-2">
                        <span>{totalTransactionsCount}</span>
                        {cancelledPaymentsCount > 0 && (
                          <span className="text-xs font-sans text-rose-400 font-semibold">
                            ({cancelledPaymentsCount} {isRtl ? 'ملغي' : 'cancelled'})
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'إجمالي الوظائف المسندة' : 'Total Jobs Assigned'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        {filteredJobs.length}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Briefcase size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'الوظائف المكتملة بالكامل' : 'Fully Completed Jobs'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        {completedJobsCount}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{isRtl ? 'إجمالي الربح المتوقع' : 'Total Expected Profit'}</p>
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        <span className="text-amber-500 text-lg mr-1">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                        {totalJobProfits.toFixed(3)}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Incentive Card (Only in Payments) */}
            {reportType === 'payments' && (
              <div className="bg-card border border-border p-6 rounded-2xl relative overflow-hidden group">
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      {isRtl ? 'الحافز (الهدف ١٢٠٠)' : 'INC (Target 1200)'}
                    </p>
                    <h3 className="text-3xl font-syne font-bold text-foreground">
                      <span className="text-emerald-500 text-lg mr-1">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                      {incentiveAmount > 0 ? incentiveAmount.toFixed(3) : '0.000'}
                    </h3>
                    <p className="text-[9px] text-muted-foreground mt-2">
                      {isRtl ? 'قاعدة الربح: ' : 'Profit Base: '} {applicableProfit.toFixed(3)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {reportType === 'jobs' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'النطاق:' : 'Scope:'}</span>
                  <div className="flex bg-muted/40 border border-border rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setJobScope('all')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        jobScope === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isRtl ? 'جميع الحالات' : 'All Cases'} ({(jobs || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobScope('handled')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        jobScope === 'handled' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isRtl ? 'معالج بواسطتي' : 'Handling (Self)'} ({jobsHandledCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobScope('assigned')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        jobScope === 'assigned' ? 'bg-cyan-500 text-black shadow-sm' : 'text-cyan-400 hover:text-cyan-300'
                      }`}
                    >
                      {isRtl ? 'مسند للعمليات' : 'Assigned to Ops'} ({jobsAssignedCount})
                    </button>
                  </div>
                </div>
              )}
              <div className="relative w-full max-w-sm ml-auto">
                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} size={16} />
                <input
                  type="text"
                  placeholder={isRtl ? 'البحث عن العميل، رمز الوظيفة، الخدمة...' : 'Search Client, Job Code, Service...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full bg-muted/50 border border-border rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar">
              <table className="w-full border-collapse hidden md:table" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead className="sticky top-0 bg-card z-10 shadow-sm">
                  <tr className="text-right">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border w-[140px] text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border min-w-[200px] text-start">{isRtl ? 'تفاصيل الخدمة' : 'Service Details'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start">{isRtl ? 'العميل' : 'Client'}</th>
                    
                    {reportType === 'payments' ? (
                      <>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start text-right">{isRtl ? 'الأرقام المالية للصفقة' : 'Deal Financials'}</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start text-right">{isRtl ? 'مبلغ الدفعة' : 'Payment Amount'}</th>
                      </>
                    ) : (
                      <>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start text-right">{isRtl ? 'رسوم الخدمة' : 'Service Fee'}</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start text-right">{isRtl ? 'الرسوم الحكومية' : 'Ministry Fee'}</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-center">{isRtl ? 'حالة الدفع' : 'Payment Status'}</th>
                      </>
                    )}
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-center">{isRtl ? 'حالة الوظيفة' : 'Job Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          {isRtl ? 'جاري تحميل التقرير...' : 'Loading report...'}
                        </div>
                      </td>
                    </tr>
                  ) : (reportType === 'payments' ? groupedJobPayments.length === 0 : filteredJobs.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle size={24} className="text-muted-foreground/50" />
                          </div>
                          <p>{isRtl ? 'لم يتم العثور على سجلات لهذه الفترة.' : 'No records found for this period.'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : reportType === 'payments' ? (
                    groupedJobPayments.map((group) => {
                      const isExpanded = !!expandedJobs[group.jobId];
                      const hasMultiple = group.payments.length > 1;
                      const mainJob = group.job;
                      const isItemCancelled = group.isAllCancelled;
                      const totalPaid = group.totalPaid;
                      const dealTotalFee = group.dealTotalFee || totalPaid;
                      const dealWorkFee = group.dealWorkFee;
                      const dealMinistryFee = group.dealMinistryFee;
                      const isFullySettled = mainJob?.remaining_paid || (dealTotalFee > 0 && totalPaid >= dealTotalFee);

                      return (
                        <React.Fragment key={group.jobId}>
                          <motion.tr 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => {
                              if (hasMultiple) {
                                toggleExpandJob(group.jobId);
                              } else {
                                setSelectedDetailItem(group.payments[0]);
                              }
                            }}
                            className={cn(
                              "border-b border-border/50 transition-colors group text-start cursor-pointer",
                              isItemCancelled ? "opacity-60 bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-primary/5",
                              isExpanded && "bg-primary/[0.04]"
                            )}
                          >
                            {/* Date Column */}
                            <td className="p-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {hasMultiple && (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpandJob(group.jobId, e)}
                                      className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0"
                                      title={isExpanded ? 'Collapse' : 'Expand payments'}
                                    >
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                  )}
                                  <span className="text-sm font-bold text-foreground">
                                    {format(new Date(group.latestPaymentDate), isRtl ? 'dd LLL yyyy' : 'dd MMM yyyy')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                                    {format(new Date(group.latestDate), 'HH:mm')}
                                  </span>
                                  {hasMultiple && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                                      {group.payments.length} {isRtl ? 'دفعات' : 'payments'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Service Details */}
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground">
                                  {mainJob?.custom_name || (isRtl ? (mainJob?.service?.name_ar || mainJob?.service?.name_en) : mainJob?.service?.name_en) || 'Service'}
                                </span>
                                {mainJob?.custom_name && mainJob?.service?.name_en && mainJob.custom_name !== mainJob.service.name_en && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    {mainJob.service.name_en}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                  {mainJob?.job_code || 'JOB'}
                                </span>
                              </div>
                            </td>

                            {/* Client */}
                            <td className="p-4">
                              <span className="text-sm font-medium text-foreground">
                                {group.client?.full_name || 'Client'}
                              </span>
                            </td>

                            {/* Deal Financials / Profit */}
                            <td className="p-4 text-right">
                              <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                    {isRtl ? 'ربح المعاملة:' : 'Job Profit:'}
                                  </span>
                                  <span className={cn(
                                    "text-sm font-bold font-mono",
                                    isItemCancelled ? "line-through text-muted-foreground/60" : "text-emerald-400"
                                  )}>
                                    +{dealWorkFee.toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                  {dealMinistryFee > 0 && (
                                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-medium">
                                      {isRtl ? 'رسوم حكومية:' : 'Gov Fee:'} {dealMinistryFee.toFixed(3)}
                                    </span>
                                  )}
                                  <span className="bg-muted/40 text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono font-medium">
                                    {isRtl ? 'إجمالي الصفقة:' : 'Total:'} {dealTotalFee.toFixed(3)} OMR
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Payment Amount */}
                            <td className="p-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={cn(
                                  "text-sm font-bold font-mono",
                                  isItemCancelled ? "line-through text-muted-foreground" : "text-foreground"
                                )}>
                                  {totalPaid.toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
                                </span>
                                {isItemCancelled ? (
                                  <span className="text-[9px] uppercase tracking-wider text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full mt-1 font-bold">
                                    {isRtl ? 'ملغي • مستبعد' : 'Cancelled • Excluded'}
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-1 mt-1">
                                    {isFullySettled ? (
                                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        {isRtl ? 'مسدد بالكامل 100%' : '100% Fully Settled'}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                        {isRtl ? 'عربون / سلفة' : 'Advance Payment'}
                                      </span>
                                    )}
                                    {hasMultiple && (
                                      <span className="text-[9px] text-primary font-bold cursor-pointer hover:underline">
                                        {isExpanded ? (isRtl ? '▲ إخفاء الدفعات' : '▲ Hide Installments') : (isRtl ? '▼ عرض الدفعتين' : `▼ View ${group.payments.length} Payments`)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Job Status */}
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                getStatusStyle(group.status)
                              }`}>
                                {getStatusIcon(group.status)}
                                {group.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : group.status === 'active' || group.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : group.status)}
                              </span>
                            </td>
                          </motion.tr>

                          {/* Expanded Nested Sub-Rows for multiple installments */}
                          {hasMultiple && isExpanded && (
                            <tr className="bg-primary/[0.02] border-b border-border/80">
                              <td colSpan={6} className="p-3 pl-8 sm:pl-12">
                                <div className="p-3.5 rounded-xl bg-card border border-primary/20 space-y-2.5 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                                      <CreditCard size={13} />
                                      <span>{isRtl ? `تفاصيل دفعات (${mainJob?.job_code || ''}) المجمعة لهذا العميل:` : `Breakdown of ${group.payments.length} Payments for ${group.client?.full_name || 'Client'}:`}</span>
                                    </p>
                                    <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                                      {isRtl ? 'المجموع:' : 'Sum:'} {totalPaid.toFixed(3)} OMR
                                    </span>
                                  </div>
                                  <div className="divide-y divide-border/50">
                                    {group.payments.map((p: any, idx: number) => {
                                      const pAmt = Number(p.amount || 0);
                                      const isPCancelled = p.status === 'cancelled' || p.status === 'voided' || p.status === 'refunded';
                                      return (
                                        <div 
                                          key={p.id}
                                          onClick={() => setSelectedDetailItem(p)}
                                          className="py-2.5 px-2 flex items-center justify-between text-xs hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">
                                              #{idx + 1}
                                            </span>
                                            <div>
                                              <span className="font-bold text-foreground">
                                                {format(new Date(p.payment_date || p.created_at), 'dd MMM yyyy • HH:mm')}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground block capitalize font-mono">
                                                {p.payment_method?.replace('_', ' ') || 'Payment'}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3">
                                            <span className={cn(
                                              "font-mono font-bold text-sm",
                                              isPCancelled ? "line-through text-muted-foreground" : "text-emerald-400"
                                            )}>
                                              +{pAmt.toFixed(3)} OMR
                                            </span>
                                            <button
                                              type="button"
                                              className="text-[10px] text-primary hover:underline font-bold"
                                            >
                                              {isRtl ? 'التفاصيل' : 'Details'} →
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    filteredJobs.map((item: any) => {
                      const isItemCancelled = item.status === 'cancelled';

                      return (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={item.id} 
                        onClick={() => setSelectedDetailItem(item)}
                        className={cn(
                          "border-b border-border/50 transition-colors group text-start cursor-pointer",
                          isItemCancelled ? "opacity-60 bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-primary/5"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              {format(new Date(item.created_at), isRtl ? 'dd LLL yyyy' : 'dd MMM yyyy')}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                              {format(new Date(item.created_at), 'HH:mm')}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">
                              {item.custom_name || (isRtl ? (item.service?.name_ar || item.service?.name_en) : item.service?.name_en) || 'Service'}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.job_code}
                              </span>
                              {item.employee_id === user?.id || item.ops_employee_id === user?.id ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {isRtl ? 'أقوم بتنفيذه' : 'Handling (Self)'}
                                </span>
                              ) : item.ops_specialist?.full_name ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                                  <Briefcase size={10} />
                                  <span>{isRtl ? 'مسند إلى:' : 'Assigned to Ops:'} {item.ops_specialist.full_name}</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  {isRtl ? 'في مجمع المهام المفتوح' : 'In Open Task Pool'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-foreground">
                            {item.client?.full_name}
                          </span>
                        </td>
                        
                        {/* Service Fee */}
                        <td className="p-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-amber-500">
                              {item.work_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">{isRtl ? 'رسوم الخدمة' : 'Service Fee'}</span>
                          </div>
                        </td>
                        {/* Ministry Fee */}
                        <td className="p-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-blue-400">
                              {item.ministry_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">{isRtl ? 'حكومية' : 'Ministry'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {item.remaining_paid ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{isRtl ? 'مدفوع بالكامل' : 'Fully Paid'}</span>
                          ) : item.advance_paid ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">{isRtl ? 'مدفوع مقدماً' : 'Advance Paid'}</span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">{isRtl ? 'غير مدفوع' : 'Unpaid'}</span>
                          )}
                        </td>
                        
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            getStatusStyle(item.status)
                          }`}>
                            {getStatusIcon(item.status)}
                            {item.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : item.status === 'active' || item.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : item.status)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
                </tbody>
              </table>

              {/* Mobile Cards (Hidden on md+) */}
              <div className="md:hidden p-4 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">{isRtl ? 'جاري تحميل التقرير...' : 'Loading report...'}</span>
                  </div>
                ) : (reportType === 'payments' ? groupedJobPayments.length === 0 : filteredJobs.length === 0) ? (
                  <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle size={24} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm">{isRtl ? 'لم يتم العثور على سجلات لهذه الفترة.' : 'No records found for this period.'}</p>
                  </div>
                ) : reportType === 'payments' ? (
                  groupedJobPayments.map((group) => {
                    const isExpanded = !!expandedJobs[group.jobId];
                    const hasMultiple = group.payments.length > 1;
                    const mainJob = group.job;
                    const isItemCancelled = group.isAllCancelled;
                    const totalPaid = group.totalPaid;
                    const dealTotalFee = group.dealTotalFee || totalPaid;
                    const dealWorkFee = group.dealWorkFee;
                    const isFullySettled = mainJob?.remaining_paid || (dealTotalFee > 0 && totalPaid >= dealTotalFee);

                    return (
                      <div 
                        key={group.jobId}
                        className={cn(
                          "bg-card border rounded-2xl p-4 shadow-sm flex flex-col gap-3 text-start transition-all", 
                          isItemCancelled ? "border-rose-500/30 opacity-70 bg-rose-500/5" : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground truncate">
                              {mainJob?.custom_name || (isRtl ? (mainJob?.service?.name_ar || mainJob?.service?.name_en) : mainJob?.service?.name_en) || 'Service'}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-mono truncate">
                              {mainJob?.job_code || 'JOB'}
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                            getStatusStyle(group.status)
                          }`}>
                            {getStatusIcon(group.status)}
                            {group.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : group.status === 'active' || group.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : group.status)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-foreground bg-muted/30 px-3 py-2 rounded-xl border border-border/50">
                          <User size={13} className="text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {group.client?.full_name || 'Client'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                          <div>
                            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'ربح المعاملة' : 'Job Profit'}</div>
                            <div className={cn("text-sm font-bold font-mono", isItemCancelled ? "line-through text-muted-foreground/60" : "text-emerald-400")}>
                              +{dealWorkFee.toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
                            </div>
                            <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                              {isRtl ? 'إجمالي الصفقة:' : 'Deal Total:'} {dealTotalFee.toFixed(3)} OMR
                            </div>
                          </div>
                          <div className={isRtl ? 'text-left' : 'text-right'}>
                            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'إجمالي المقبوض' : 'Total Collected'}</div>
                            <div className={cn("text-sm font-bold font-mono", isItemCancelled ? "line-through text-muted-foreground" : "text-foreground")}>
                              {totalPaid.toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
                            </div>
                            <div className="flex flex-col items-end gap-1 mt-1">
                              {isFullySettled ? (
                                <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  {isRtl ? 'مسدد 100%' : '100% Settled'}
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                  {isRtl ? 'عربون / سلفة' : 'Advance'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Multiple installments breakdown on mobile */}
                        {hasMultiple ? (
                          <div className="pt-2 border-t border-border/40 space-y-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandJob(group.jobId)}
                              className="w-full flex items-center justify-between text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors"
                            >
                              <span>{isRtl ? `عرض تفاصيل (${group.payments.length}) دفعات` : `View ${group.payments.length} Payments Breakdown`}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 space-y-2 divide-y divide-border/40">
                                {group.payments.map((p: any, idx: number) => (
                                  <div 
                                    key={p.id}
                                    onClick={() => setSelectedDetailItem(p)}
                                    className="pt-2 first:pt-0 flex items-center justify-between text-xs cursor-pointer"
                                  >
                                    <div>
                                      <div className="font-bold text-foreground">
                                        #{idx + 1} • {format(new Date(p.payment_date || p.created_at), 'dd MMM yyyy')}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {format(new Date(p.created_at), 'HH:mm')} • {p.payment_method?.replace('_', ' ') || 'Payment'}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-mono font-bold text-emerald-400">
                                        +{Number(p.amount || 0).toFixed(3)} OMR
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-border/40 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(group.payments[0])}
                              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                              <span>{isRtl ? 'تفاصيل المعاملة' : 'View Financial Dossier'}</span>
                              <span>→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  filteredJobs.map((item: any) => {
                    const isItemCancelled = item.status === 'cancelled';

                    return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedDetailItem(item)}
                      className={cn(
                        "bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3 text-start cursor-pointer transition-all hover:border-primary/40", 
                        isItemCancelled ? "border-rose-500/30 opacity-70 bg-rose-500/5" : "border-border"
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {reportType === 'payments' 
                              ? (item.job?.custom_name || (isRtl ? (item.job?.service?.name_ar || item.job?.service?.name_en) : item.job?.service?.name_en) || 'Service') 
                              : (item.custom_name || (isRtl ? (item.service?.name_ar || item.service?.name_en) : item.service?.name_en) || 'Service')}
                          </div>
                          {reportType === 'payments' && item.job?.custom_name && item.job?.service?.name_en && item.job.custom_name !== item.job.service.name_en && (
                            <div className="text-[10px] text-muted-foreground/70 truncate">
                              {item.job.service.name_en}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-mono truncate">
                            {reportType === 'payments' ? item.job?.job_code : item.job_code}
                          </div>
                          {reportType === 'jobs' && (
                            <div className="mt-1">
                              {item.employee_id === user?.id || item.ops_employee_id === user?.id ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {isRtl ? 'أقوم بتنفيذه' : 'Handling (Self)'}
                                </span>
                              ) : item.ops_specialist?.full_name ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1 w-fit">
                                  <Briefcase size={10} />
                                  <span>{isRtl ? 'مسند إلى:' : 'Assigned to Ops:'} {item.ops_specialist.full_name}</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  {isRtl ? 'في مجمع المهام المفتوح' : 'In Open Task Pool'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                          getStatusStyle(reportType === 'payments' ? item.job?.status : item.status)
                        }`}>
                          {getStatusIcon(reportType === 'payments' ? item.job?.status : item.status)}
                          {reportType === 'payments' 
                            ? (item.job?.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : item.job?.status === 'active' || item.job?.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : item.job?.status))
                            : (item.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : item.status === 'active' || item.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : item.status))}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-foreground bg-muted/30 px-3 py-2.5 rounded-lg border border-border/50">
                        <User size={14} className="text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {reportType === 'payments' ? (item.job?.client?.full_name) : (item.client?.full_name)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                        {reportType === 'payments' ? (
                          <>
                            <div>
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'ربح الدفعة' : 'Payment Profit'}</div>
                              {(() => {
                                const jobTotalFee = Number(item.job?.total_fee || 0);
                                const jobWorkFee = Number(item.job?.work_fee || 0);
                                const pAmount = Number(item.amount || 0);
                                const proportionalProfit = jobTotalFee > 0 ? (pAmount / jobTotalFee) * jobWorkFee : jobWorkFee;
                                return (
                                  <div className={cn("text-xs font-bold font-mono", isItemCancelled ? "line-through text-muted-foreground/60" : "text-emerald-400")}>
                                    +{proportionalProfit.toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
                                  </div>
                                );
                              })()}
                              <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                                {isRtl ? 'ربح الصفقة:' : 'Deal Profit:'} {item.job?.work_fee?.toFixed(3) || '0.000'}
                              </div>
                              <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                                {isRtl ? 'رسوم حكومية:' : 'Gov Fee:'} {item.job?.ministry_fee?.toFixed(3) || '0.000'}
                              </div>
                            </div>
                            <div className={isRtl ? 'text-left' : 'text-right'}>
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'مبلغ الدفعة' : 'Payment Amount'}</div>
                              <div className={cn("text-xs font-bold font-mono", isItemCancelled ? "line-through text-muted-foreground" : "text-foreground")}>
                                {item.amount?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}
                              </div>
                              {isItemCancelled ? (
                                <div className="inline-block text-[8px] uppercase tracking-wider text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded mt-0.5 font-bold">
                                  {isRtl ? 'ملغي • مستبعد' : 'Cancelled • Excluded'}
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-1 mt-1">
                                  {item.job?.remaining_paid ? (
                                    <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                      {isRtl ? 'مسدد 100%' : '100% Settled'}
                                    </span>
                                  ) : item.job?.advance_paid ? (
                                    <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                      {isRtl ? 'عربون' : 'Advance'}
                                    </span>
                                  ) : null}
                                  <div className="inline-block text-[8px] uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {item.payment_method === 'online' ? (isRtl ? 'إلكتروني' : 'online') : item.payment_method === 'bank_transfer' ? (isRtl ? 'تحويل بنكي' : 'bank_transfer') : item.payment_method}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'رسوم الخدمة' : 'Service Fee'}</div>
                              <div className="text-xs font-bold text-amber-500">{item.work_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}</div>
                            </div>
                            <div className={isRtl ? 'text-left' : 'text-right'}>
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'الرسوم الحكومية' : 'Ministry Fee'}</div>
                              <div className="text-xs font-bold text-blue-400">{item.ministry_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}</div>
                            </div>
                            <div className="col-span-2 flex justify-between items-center pt-2 mt-1 border-t border-border/30">
                              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{isRtl ? 'الدفعة' : 'Payment'}</span>
                              {item.remaining_paid ? (
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{isRtl ? 'مدفوع بالكامل' : 'Fully Paid'}</span>
                              ) : item.advance_paid ? (
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">{isRtl ? 'مدفوع مقدماً' : 'Advance Paid'}</span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">{isRtl ? 'غير مدفوع' : 'Unpaid'}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1 justify-end">
                        <Clock size={10} />
                        {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm')}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Daily Sales Sheet Modal */}
      <DailySalesSheetModal
        isOpen={isDailySheetOpen}
        onClose={() => setIsDailySheetOpen(false)}
      />

      {/* Deal Financial Breakdown Modal */}
      {selectedDetailItem && (() => {
        const isPayment = reportType === 'payments';
        const job = isPayment ? selectedDetailItem.job : selectedDetailItem;
        const jobCode = job?.job_code || 'JOB';
        const clientName = job?.client?.full_name || 'Client';
        const serviceTitle = job?.custom_name || job?.service?.name_en || 'Service';
        const totalFee = Number(job?.total_fee || 0);
        const ministryFee = Number(job?.ministry_fee || 0);
        const workFee = Number(job?.work_fee || 0);
        const totalPaid = Number(job?.advance_amount || 0);
        const balanceDue = Math.max(0, totalFee - totalPaid);
        const isCancelled = job?.status === 'cancelled' || selectedDetailItem.status === 'cancelled';
        const proportionalProfit = isPayment && totalFee > 0 ? (Number(selectedDetailItem.amount || 0) / totalFee) * workFee : workFee;

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {jobCode}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      isCancelled ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      job?.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}>
                      {job?.status || 'Active'}
                    </span>
                  </div>
                  <h2 className="text-lg font-syne font-bold text-foreground mt-2">
                    {serviceTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <User size={13} className="shrink-0" />
                    <span>{isRtl ? 'العميل:' : 'Client:'} {clientName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Deal Totals Summary */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {isRtl ? 'الأرقام المالية الإجمالية للصفقة' : 'Overall Deal Financial Breakdown'}
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block truncate">
                      {isRtl ? 'إجمالي الصفقة' : 'Deal Total'}
                    </span>
                    <span className="text-base font-black font-mono text-foreground mt-1 block">
                      {totalFee.toFixed(3)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">OMR</span>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-blue-400 block truncate">
                      {isRtl ? 'رسوم حكومية' : 'Gov Fee'}
                    </span>
                    <span className="text-base font-black font-mono text-blue-400 mt-1 block">
                      {ministryFee.toFixed(3)}
                    </span>
                    <span className="text-[9px] text-blue-400/80">OMR</span>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-amber-400 block truncate">
                      {isRtl ? 'ربح الشركة' : 'Net Profit'}
                    </span>
                    <span className="text-base font-black font-mono text-amber-400 mt-1 block">
                      {workFee.toFixed(3)}
                    </span>
                    <span className="text-[9px] text-amber-400/80">OMR</span>
                  </div>
                </div>
              </div>

              {/* Payment Progress */}
              <div className="bg-muted/20 border border-border/50 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-muted-foreground">
                    {isRtl ? 'حالة السداد والتحصيل' : 'Settlement Status'}
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {totalPaid.toFixed(3)} / {totalFee.toFixed(3)} OMR
                  </span>
                </div>
                <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden border border-border/40">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      balanceDue <= 0 ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${totalFee > 0 ? Math.min(100, (totalPaid / totalFee) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                  <span className={balanceDue <= 0 ? "text-emerald-400 font-bold" : ""}>
                    {balanceDue <= 0 ? (isRtl ? 'مسدد بالكامل 100%' : '100% Fully Settled') : (isRtl ? `المتبقي: ${balanceDue.toFixed(3)} OMR` : `Remaining: ${balanceDue.toFixed(3)} OMR`)}
                  </span>
                  <span>
                    {totalFee > 0 ? `${((totalPaid / totalFee) * 100).toFixed(0)}% Collected` : ''}
                  </span>
                </div>
              </div>

              {/* Specific Payment Section if viewed from Paid Report */}
              {isPayment && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <CreditCard size={13} />
                      {isRtl ? 'تفاصيل هذه الدفعة المحددة' : 'Selected Payment Installment'}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      +{proportionalProfit.toFixed(3)} OMR Profit Share
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isRtl ? 'المبلغ المستلم:' : 'Amount Received:'}</span>
                      <span className="font-mono font-black text-foreground text-sm">{Number(selectedDetailItem.amount || 0).toFixed(3)} OMR</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isRtl ? 'طريقة الدفع:' : 'Payment Mode:'}</span>
                      <span className="font-semibold uppercase text-foreground">{selectedDetailItem.payment_method?.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isRtl ? 'تاريخ السداد الفعلي:' : 'Payment Received Date:'}</span>
                      <span className="font-medium text-foreground">{selectedDetailItem.payment_date ? format(new Date(selectedDetailItem.payment_date), 'dd MMM yyyy') : format(new Date(selectedDetailItem.created_at), 'dd MMM yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{isRtl ? 'الرقم المرجعي:' : 'Reference / Cheque:'}</span>
                      <span className="font-mono text-foreground">{selectedDetailItem.reference_number || (isRtl ? 'لا يوجد' : 'None')}</span>
                    </div>
                  </div>
                  {selectedDetailItem.notes && (
                    <div className="text-[11px] text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/40">
                      <span className="font-bold text-foreground block mb-0.5">{isRtl ? 'الملاحظات:' : 'Notes:'}</span>
                      {selectedDetailItem.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                {job?.id && (
                  <button
                    onClick={() => {
                      setSelectedDetailItem(null);
                      navigate(`/employee/tasks?jobId=${job.id}`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all"
                  >
                    <ExternalLink size={14} />
                    <span>{isRtl ? 'فتح المعاملة في مساحة العمل' : 'Open in Workspace'}</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors ml-auto"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
