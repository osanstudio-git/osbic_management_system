import React, { useState, useMemo } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { DailySalesSheetModal } from '../../components/employee/DailySalesSheetModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { format, subDays, startOfWeek, startOfMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export default function EmployeeReports() {
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
            job_code,
            total_fee,
            ministry_fee,
            work_fee,
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

  // 2. Fetch Jobs Data
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['employee', 'reports', 'jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name),
          service:services!service_id(name_en, name_ar)
        `)
        .or(`sales_employee_id.eq.${user.id},employee_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).filter((j: any) => {
        if (j.sales_employee_id) {
          return j.sales_employee_id === user.id;
        }
        return j.employee_id === user.id;
      });
    },
    enabled: !!user?.id
  });

  // 3. Fetch Leads Data for Sales Report
  const { data: leads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['employee', 'reports', 'leads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name)')
        .eq('assigned_to', user.id)
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
      // Time filter
      const itemDate = new Date(item[dateField]);
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
          item.job?.service?.name_en?.toLowerCase().includes(searchLower) ||
          item.reference_number?.toLowerCase().includes(searchLower);
      } else if (reportType === 'jobs') {
        matchesSearch = 
          item.job_code?.toLowerCase().includes(searchLower) ||
          item.client?.full_name?.toLowerCase().includes(searchLower) ||
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
  const filteredJobs = useMemo(() => getFilteredData(jobs || [], 'created_at'), [jobs, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);

  const filteredLeads = useMemo(() => {
    if (reportType !== 'sales') return [];
    return getFilteredData(leads || [], 'created_at');
  }, [leads, timeFilter, searchTerm, customStartDate, customEndDate, reportType]);

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

  // Calculations for Payments
  const totalCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const uniqueJobsFromPaymentsSet = new Set(filteredPayments.map(p => p.job_id));
  
  // Calculate realized profit proportionally from payments
  const realizedProfit = filteredPayments.reduce((sum: number, p: any) => {
    const paymentAmount = Number(p.amount || 0);
    const jobTotal = Number(p.job?.total_fee || 0);
    const jobProfit = Number(p.job?.work_fee || 0);
    
    if (jobTotal > 0) {
      return sum + (paymentAmount / jobTotal) * jobProfit;
    }
    return sum;
  }, 0);

  // Calculations for Jobs
  const totalJobProfits = filteredJobs.reduce((sum, j) => sum + Number(j.work_fee || 0), 0);
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
        'Job Total Fee (OMR)',
        'Service Fee / Work Fee (OMR)',
        'Ministry Fee (OMR)',
        'Job Status'
      ];
      csvData = filteredPayments.map(p => [
        format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
        p.job?.job_code || 'N/A',
        p.job?.client?.full_name || 'N/A',
        p.job?.service?.name_en || 'N/A',
        p.payment_method?.toUpperCase() || 'N/A',
        p.reference_number || 'N/A',
        p.amount?.toFixed(3) || '0.000',
        p.job?.total_fee?.toFixed(3) || '0.000',
        p.job?.work_fee?.toFixed(3) || '0.000',
        p.job?.ministry_fee?.toFixed(3) || '0.000',
        p.job?.status?.toUpperCase() || 'N/A'
      ]);
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
        j.service?.name_en || 'N/A',
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
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">{isRtl ? `الفرص النشطة (${filteredLeads.length})` : `Active Opportunities (${filteredLeads.length})`}</h3>
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
                          <td className="p-4 whitespace-nowrap text-xs font-bold text-foreground">{lead.contact_name}</td>
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
                      <h3 className="text-3xl font-syne font-bold text-foreground">
                        {filteredPayments.length}
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
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="relative w-full max-w-sm">
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
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border text-start text-right">{isRtl ? 'ربح الوظيفة' : 'Job Profit'}</th>
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
                  ) : (reportType === 'payments' ? filteredPayments.length === 0 : filteredJobs.length === 0) ? (
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
                  ) : (
                    (reportType === 'payments' ? filteredPayments : filteredJobs).map((item: any) => (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={item.id} 
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors group text-start"
                      >
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
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
                              {reportType === 'payments' 
                                ? (isRtl ? (item.job?.service?.name_ar || item.job?.service?.name_en) : item.job?.service?.name_en) 
                                : (isRtl ? (item.service?.name_ar || item.service?.name_en) : item.service?.name_en)}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {reportType === 'payments' ? item.job?.job_code : item.job_code}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-foreground">
                            {reportType === 'payments' ? (item.job?.client?.full_name) : (item.client?.full_name)}
                          </span>
                        </td>
                        
                        {reportType === 'payments' ? (
                          <>
                            <td className="p-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-amber-500">
                                  {item.job?.work_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {isRtl ? 'الحد الأدنى للرسوم:' : 'Min Fee:'} {item.job?.ministry_fee?.toFixed(3) || '0.000'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-emerald-500">
                                  {item.amount?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}
                                </span>
                                <span className="text-[9px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1">
                                  {item.payment_method === 'online' ? (isRtl ? 'إلكتروني' : 'online') : item.payment_method === 'bank_transfer' ? (isRtl ? 'تحويل بنكي' : 'bank_transfer') : item.payment_method}
                                </span>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                        
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            getStatusStyle(reportType === 'payments' ? item.job?.status : item.status)
                          }`}>
                            {getStatusIcon(reportType === 'payments' ? item.job?.status : item.status)}
                            {reportType === 'payments' 
                              ? (item.job?.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : item.job?.status === 'active' || item.job?.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : item.job?.status))
                              : (item.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : item.status === 'active' || item.status === 'in_progress' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'ملغي' : item.status))}
                          </span>
                        </td>
                      </motion.tr>
                    ))
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
                ) : (reportType === 'payments' ? filteredPayments.length === 0 : filteredJobs.length === 0) ? (
                  <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle size={24} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm">{isRtl ? 'لم يتم العثور على سجلات لهذه الفترة.' : 'No records found for this period.'}</p>
                  </div>
                ) : (
                  (reportType === 'payments' ? filteredPayments : filteredJobs).map((item: any) => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3 text-start">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {reportType === 'payments' 
                              ? (isRtl ? (item.job?.service?.name_ar || item.job?.service?.name_en) : item.job?.service?.name_en) 
                              : (isRtl ? (item.service?.name_ar || item.service?.name_en) : item.service?.name_en)}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-mono truncate">
                            {reportType === 'payments' ? item.job?.job_code : item.job_code}
                          </div>
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
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'ربح الوظيفة' : 'Job Profit'}</div>
                              <div className="text-xs font-bold text-amber-500">{item.job?.work_fee?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">{isRtl ? 'الأدنى:' : 'Min:'} {item.job?.ministry_fee?.toFixed(3) || '0.000'}</div>
                            </div>
                            <div className={isRtl ? 'text-left' : 'text-right'}>
                              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{isRtl ? 'الدفعة' : 'Payment'}</div>
                              <div className="text-xs font-bold text-emerald-500">{item.amount?.toFixed(3) || '0.000'} {isRtl ? 'ر.ع.' : 'OMR'}</div>
                              <div className="inline-block text-[8px] uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5">
                                {item.payment_method === 'online' ? (isRtl ? 'إلكتروني' : 'online') : item.payment_method === 'bank_transfer' ? (isRtl ? 'تحويل بنكي' : 'bank_transfer') : item.payment_method}
                              </div>
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
                  ))
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
    </div>
  );
}
