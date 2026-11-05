import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, 
  CreditCard, PieChart, BarChart3, ArrowUpRight, 
  ArrowDownRight, RefreshCw, Loader2, Users, Calendar,
  Filter, Search, Download, ChevronDown, ChevronRight,
  X, Check, ShieldCheck, AlertCircle, FileText, UserCheck,
  Award, Sparkles, Building2, Eye, ArrowRight
} from 'lucide-react';
import { useFinanceMetrics, type FinanceDealItem, type SalesRepPerformance } from '../../hooks/admin/useFinance';
import { useBranch } from '../../contexts/BranchContext';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

type TimePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'all' | 'custom';
type TabType = 'daily' | 'sales_reps' | 'govt_fees' | 'services' | 'all_deals';

export default function Finance() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const { selectedBranchId, branches } = useBranch();
  const { data: metrics, isLoading, refetch, isRefetching } = useFinanceMetrics(selectedBranchId);

  // Filters State
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [timePreset, setTimePreset] = useState<TimePreset>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [govFeeSubTab, setGovFeeSubTab] = useState<'date' | 'employee'>('date');

  // Modals / Drawer State
  const [selectedRepDetails, setSelectedRepDetails] = useState<SalesRepPerformance | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Currency Formatter
  const formatOMR = (amount: number) => {
    return `OMR ${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  };

  // Filter deals based on active filters
  const filteredDeals = useMemo(() => {
    if (!metrics?.allDeals) return [];

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (timePreset === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (timePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    } else if (timePreset === 'week') {
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
    } else if (timePreset === 'month') {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (timePreset === 'last_month') {
      const prev = subMonths(now, 1);
      startDate = startOfMonth(prev);
      endDate = endOfMonth(prev);
    } else if (timePreset === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59');
    }

    return metrics.allDeals.filter(deal => {
      // Date Filter
      if (startDate && endDate) {
        const dealDate = new Date(deal.created_at);
        if (dealDate < startDate || dealDate > endDate) return false;
      }

      // Sales Rep Filter
      if (selectedRepId !== 'all') {
        if (deal.sales_rep_id !== selectedRepId) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = deal.job_code?.toLowerCase().includes(q);
        const matchClient = deal.client_name?.toLowerCase().includes(q) || (deal.client_company && deal.client_company.toLowerCase().includes(q));
        const matchService = deal.service_name?.toLowerCase().includes(q);
        const matchRep = deal.sales_rep_name?.toLowerCase().includes(q);
        if (!matchCode && !matchClient && !matchService && !matchRep) return false;
      }

      return true;
    });
  }, [metrics?.allDeals, timePreset, customStart, customEnd, selectedRepId, searchQuery]);

  // Aggregate stats from filteredDeals
  const currentStats = useMemo(() => {
    let sales = 0;
    let profit = 0;
    let govt = 0;
    let collected = 0;
    let pending = 0;

    filteredDeals.forEach(d => {
      sales += d.total_fee;
      profit += d.work_fee;
      govt += d.ministry_fee;
      collected += d.collected_amount;
      pending += d.pending_amount;
    });

    const profitMargin = sales > 0 ? (profit / sales) * 100 : 0;
    const govtPercentage = sales > 0 ? (govt / sales) * 100 : 0;

    return { sales, profit, govt, collected, pending, profitMargin, govtPercentage, count: filteredDeals.length };
  }, [filteredDeals]);

  // Re-aggregate Daily Sales based on filteredDeals
  const filteredDailySales = useMemo(() => {
    const map = new Map<string, {
      date: string;
      formattedDate: string;
      isToday: boolean;
      dealsCount: number;
      totalSales: number;
      govtFees: number;
      netProfit: number;
      collectedAmount: number;
      pendingAmount: number;
      deals: FinanceDealItem[];
    }>();

    filteredDeals.forEach(d => {
      const dt = new Date(d.created_at);
      const key = format(dt, 'yyyy-MM-dd');
      const formatted = format(dt, 'dd MMM yyyy');
      const todayFlag = isToday(dt);

      if (!map.has(key)) {
        map.set(key, {
          date: key,
          formattedDate: formatted,
          isToday: todayFlag,
          dealsCount: 0,
          totalSales: 0,
          govtFees: 0,
          netProfit: 0,
          collectedAmount: 0,
          pendingAmount: 0,
          deals: [],
        });
      }

      const item = map.get(key)!;
      item.dealsCount += 1;
      item.totalSales += d.total_fee;
      item.govtFees += d.ministry_fee;
      item.netProfit += d.work_fee;
      item.collectedAmount += d.collected_amount;
      item.pendingAmount += d.pending_amount;
      item.deals.push(d);
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredDeals]);

  // Re-aggregate Sales Rep Performance from filteredDeals
  const filteredSalesReps = useMemo(() => {
    const map = new Map<string, SalesRepPerformance>();

    filteredDeals.forEach(d => {
      const key = d.sales_rep_id || 'unassigned';
      if (!map.has(key)) {
        map.set(key, {
          employeeId: key,
          fullName: d.sales_rep_name,
          employeeCode: d.sales_rep_code,
          avatarUrl: d.sales_rep_avatar,
          department: 'sales',
          branchName: d.branch_name,
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

      const rep = map.get(key)!;
      rep.dealsWonCount += 1;
      rep.totalSales += d.total_fee;
      rep.govtFees += d.ministry_fee;
      rep.netProfit += d.work_fee;
      rep.collectedAmount += d.collected_amount;
      rep.pendingAmount += d.pending_amount;
      rep.deals.push(d);
    });

    map.forEach(rep => {
      rep.avgDealSize = rep.dealsWonCount > 0 ? rep.totalSales / rep.dealsWonCount : 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredDeals]);

  // Re-aggregate Government Fees Date-Wise & Employee-Wise from filteredDeals
  const filteredGovtDateWise = useMemo(() => {
    const map = new Map<string, {
      date: string;
      formattedDate: string;
      jobsCount: number;
      govtFeeTotal: number;
      totalSales: number;
      govtFeePercentage: number;
      deals: FinanceDealItem[];
    }>();

    filteredDeals.forEach(d => {
      if (d.ministry_fee > 0 || d.total_fee > 0) {
        const dt = new Date(d.created_at);
        const key = format(dt, 'yyyy-MM-dd');
        const formatted = format(dt, 'dd MMM yyyy');

        if (!map.has(key)) {
          map.set(key, {
            date: key,
            formattedDate: formatted,
            jobsCount: 0,
            govtFeeTotal: 0,
            totalSales: 0,
            govtFeePercentage: 0,
            deals: [],
          });
        }
        const item = map.get(key)!;
        item.jobsCount += 1;
        item.govtFeeTotal += d.ministry_fee;
        item.totalSales += d.total_fee;
        item.deals.push(d);
      }
    });

    map.forEach(item => {
      item.govtFeePercentage = item.totalSales > 0 ? (item.govtFeeTotal / item.totalSales) * 100 : 0;
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredDeals]);

  const filteredGovtEmployeeWise = useMemo(() => {
    const map = new Map<string, {
      employeeId: string;
      fullName: string;
      employeeCode: string | null;
      department: string | null;
      jobsCount: number;
      govtFeeTotal: number;
      totalSales: number;
      netProfit: number;
      deals: FinanceDealItem[];
    }>();

    filteredDeals.forEach(d => {
      const key = d.sales_rep_id || 'unassigned';
      if (!map.has(key)) {
        map.set(key, {
          employeeId: key,
          fullName: d.sales_rep_name,
          employeeCode: d.sales_rep_code,
          department: 'sales',
          jobsCount: 0,
          govtFeeTotal: 0,
          totalSales: 0,
          netProfit: 0,
          deals: [],
        });
      }
      const item = map.get(key)!;
      item.jobsCount += 1;
      item.govtFeeTotal += d.ministry_fee;
      item.totalSales += d.total_fee;
      item.netProfit += d.work_fee;
      item.deals.push(d);
    });

    return Array.from(map.values()).sort((a, b) => b.govtFeeTotal - a.govtFeeTotal);
  }, [filteredDeals]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredDeals.length === 0) {
      toast.error('No deals to export');
      return;
    }

    const headers = [
      'Job Code',
      'Date',
      'Deal Name',
      'Client Name',
      'Client Company',
      'Client Phone',
      'Sales Rep',
      'Ops Rep',
      'Service',
      'Branch',
      'Status',
      'Total Deal (OMR)',
      'Government Fee (OMR)',
      'Company Profit (OMR)',
      'Collected (OMR)',
      'Pending (OMR)',
      'Advance Paid',
      'Remaining Paid'
    ];

    const rows = filteredDeals.map(d => [
      `"${d.job_code}"`,
      `"${d.created_at ? format(new Date(d.created_at), 'yyyy-MM-dd HH:mm') : ''}"`,
      `"${(d.custom_name || '').replace(/"/g, '""')}"`,
      `"${d.client_name.replace(/"/g, '""')}"`,
      `"${(d.client_company || '').replace(/"/g, '""')}"`,
      `"${d.client_phone || ''}"`,
      `"${d.sales_rep_name.replace(/"/g, '""')}"`,
      `"${d.ops_rep_name.replace(/"/g, '""')}"`,
      `"${d.service_name.replace(/"/g, '""')}"`,
      `"${d.branch_name.replace(/"/g, '""')}"`,
      `"${d.status}"`,
      d.total_fee.toFixed(3),
      d.ministry_fee.toFixed(3),
      d.work_fee.toFixed(3),
      d.collected_amount.toFixed(3),
      d.pending_amount.toFixed(3),
      d.advance_paid ? 'Yes' : 'No',
      d.remaining_paid ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Finance_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isRtl ? 'تم تصدير التقرير المالي بنجاح' : 'Finance report exported successfully');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <Loader2 className="animate-spin text-primary" size={36} />
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
          {isRtl ? 'جاري تحميل وتدقيق البيانات المالية...' : 'Reconciling Sales Ledger & Gov Fees...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground">
              {isRtl ? 'المركز المالي والمبيعات' : 'Financial & Sales Hub'}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRtl
              ? 'متابعة حية للمبيعات اليومية، إيرادات صفقات الموظفين، وسجل الرسوم الحكومية المباشر'
              : 'Live tracking of daily sales, sales rep won deals, and exact government fee allocations'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl bg-card border border-border/80 hover:bg-muted text-foreground transition-all shadow-sm"
            title={isRtl ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin text-primary' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all shrink-0"
          >
            <Download size={14} />
            <span>{isRtl ? 'تصدير التقرير (.CSV)' : 'Export Report (.CSV)'}</span>
          </button>
        </div>
      </div>

      {/* ─── Control Bar: Date Range, Employee Filter, & Search ────────────── */}
      <div className="bg-card border border-border/70 rounded-3xl p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Date Range Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar size={12} className="text-primary" />
              {isRtl ? 'الفترة:' : 'Period:'}
            </span>
            {(['today', 'yesterday', 'week', 'month', 'last_month', 'all', 'custom'] as TimePreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => setTimePreset(preset)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs ${
                  timePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {preset === 'today' && (isRtl ? 'اليوم (يومي)' : 'Today (Daily)')}
                {preset === 'yesterday' && (isRtl ? 'أمس' : 'Yesterday')}
                {preset === 'week' && (isRtl ? 'هذا الأسبوع' : 'This Week')}
                {preset === 'month' && (isRtl ? 'هذا الشهر' : 'This Month')}
                {preset === 'last_month' && (isRtl ? 'الشهر الماضي' : 'Last Month')}
                {preset === 'all' && (isRtl ? 'كل الوقت' : 'All Time')}
                {preset === 'custom' && (isRtl ? 'تاريخ مخصص' : 'Custom Range')}
              </button>
            ))}
          </div>

          {/* Quick Indicator of current filter count */}
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
            <span>{isRtl ? 'المعاملات المطابقة:' : 'Matching Deals:'} </span>
            <strong className="text-primary font-mono">{filteredDeals.length}</strong>
          </div>
        </div>

        {/* Custom Date Pickers (if custom selected) */}
        {timePreset === 'custom' && (
          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground">{isRtl ? 'من:' : 'From:'}</span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-muted/30 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground">{isRtl ? 'إلى:' : 'To:'}</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-muted/30 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Search & Sales Employee Dropdown */}
        <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث برقم المعاملة، اسم العميل، مسؤول المبيعات، أو نوع الخدمة...' : 'Search by job code, client, sales rep, or service...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted/20 border border-border/60 rounded-xl text-xs text-foreground outline-none focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Employee Filter */}
          <div className="w-full sm:w-64 shrink-0">
            <select
              value={selectedRepId}
              onChange={e => setSelectedRepId(e.target.value)}
              className="w-full bg-muted/20 border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">{isRtl ? 'جميع مسؤولي المبيعات' : 'All Sales Team Members'}</option>
              {metrics?.employeesList.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(timePreset !== 'month' || selectedRepId !== 'all' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setTimePreset('month');
                setSelectedRepId('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground text-xs font-bold transition-all whitespace-nowrap"
            >
              {isRtl ? 'إعادة ضبط' : 'Reset'}
            </button>
          )}
        </div>
      </div>

      {/* ─── Primary KPI Cards (Simple & Understandable Keywords) ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign size={14} className="text-blue-400" />
              {isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {currentStats.count} {isRtl ? 'صفقة' : 'deals'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-foreground tracking-tight">
            {formatOMR(currentStats.sales)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? 'إجمالي قيمة جميع الصفقات والمشاريع التي تم إطلاقها' : 'Total deal value of all started projects in this period'}
          </p>
        </div>

        {/* Card 2: Today's Daily Sales (Spotlight) */}
        <div className="bg-primary/5 border border-primary/30 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles size={14} />
              {isRtl ? 'مبيعات اليوم (Daily Sales)' : "Today's Daily Sales"}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 animate-pulse">
              {metrics?.todayDealsCount || 0} {isRtl ? 'صفقات اليوم' : 'closed today'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-primary tracking-tight">
            {formatOMR(metrics?.todaySales || 0)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? `صافي أرباح اليوم: ${formatOMR(metrics?.todayNetProfit || 0)}` : `Today's Net Profit: ${formatOMR(metrics?.todayNetProfit || 0)}`}
          </p>
        </div>

        {/* Card 3: Our Actual Profit */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-400" />
              {isRtl ? 'أرباح المركز الصافية' : 'Center Net Profit'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {currentStats.profitMargin.toFixed(1)}% {isRtl ? 'هامش ربح' : 'margin'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-emerald-400 tracking-tight">
            {formatOMR(currentStats.profit)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? 'المبالغ الفعلية التي يحتفظ بها المركز بعد خصم الرسوم الحكومية' : 'The actual service fee OSBIC keeps after government fees'}
          </p>
        </div>

        {/* Card 4: Government Fees */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet size={14} className="text-amber-400" />
              {isRtl ? 'الرسوم الحكومية' : 'Government Fees'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {currentStats.govtPercentage.toFixed(1)}% {isRtl ? 'من المبيعات' : 'of sales'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-amber-400 tracking-tight">
            {formatOMR(currentStats.govt)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? 'المبالغ المخصصة للوزارات، السجلات، وتراخيص العمل' : 'Official fees allocated for ministries and registrations'}
          </p>
        </div>

        {/* Card 5: Money Collected */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Check size={14} className="text-teal-400" />
              {isRtl ? 'المبالغ المستلمة (محصلة)' : 'Money Collected'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              {((currentStats.collected / (currentStats.sales || 1)) * 100).toFixed(1)}% {isRtl ? 'تم تحصيله' : 'collected'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-foreground tracking-tight">
            {formatOMR(currentStats.collected)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? 'الدفعات المقدمة والمبالغ المستلمة فعلياً من العملاء' : 'Advance deposits and payments received from clients'}
          </p>
        </div>

        {/* Card 6: Pending to Collect */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard size={14} className="text-rose-400" />
              {isRtl ? 'مبالغ متبقية للتحصيل' : 'Pending to Collect'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {isRtl ? 'مستحقة' : 'Owed'}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-syne text-rose-400 tracking-tight">
            {formatOMR(currentStats.pending)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isRtl ? 'المبالغ المتبقية في ذمة العملاء قيد التحصيل' : 'Remaining balances owed by clients upon job completion'}
          </p>
        </div>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto pb-2 custom-scrollbar">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'daily'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Calendar size={15} />
          <span>{isRtl ? 'المبيعات اليومية والجدول الزمني' : 'Daily Sales & Timeline'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
            {filteredDailySales.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sales_reps')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'sales_reps'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Award size={15} />
          <span>{isRtl ? 'تقرير صفقات الموظفين (Won Deals)' : 'Sales Rep Won Deals'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
            {filteredSalesReps.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('govt_fees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'govt_fees'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Wallet size={15} />
          <span>{isRtl ? 'سجل الرسوم الحكومية (بالتاريخ والموظف)' : 'Government Fees Hub'}</span>
        </button>

        <button
          onClick={() => setActiveTab('all_deals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
            activeTab === 'all_deals'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <FileText size={15} />
          <span>{isRtl ? 'سجل جميع الصفقات' : 'All Deals Ledger'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
            {filteredDeals.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: DAILY SALES & TIMELINE ────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-syne text-foreground">
                {isRtl ? 'سجل المبيعات اليومية المفصل' : 'Daily Sales Breakdown'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'عرض المبيعات والرسوم والأرباح يوماً بيوم، انقر على أي يوم لاستعراض صفقاته' : 'Day-by-day sales, government fees, and profits. Click any date to view its deals.'}
              </p>
            </div>
          </div>

          {filteredDailySales.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border/50 rounded-3xl p-8 space-y-2">
              <Calendar size={32} className="mx-auto text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">{isRtl ? 'لا توجد مبيعات في الفترة المحددة' : 'No sales found in this period'}</p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'جرب تغيير فلاتر التاريخ أو الموظف بأعلى الصفحة' : 'Try adjusting the date range or employee filter above'}</p>
            </div>
          ) : (
            <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3.5 px-5">{isRtl ? 'التاريخ' : 'Date'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'الصفقات المكتملة' : 'Deals Won'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'إجمالي المبيعات' : 'Total Sales'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'الرسوم الحكومية' : 'Gov Fees'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'أرباح المركز' : 'Net Profit'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'المستلم / المتبقي' : 'Collected / Pending'}</th>
                      <th className="py-3.5 px-5 text-right">{isRtl ? 'التفاصيل' : 'Deals'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredDailySales.map(day => {
                      const isExpanded = expandedDate === day.date;

                      return (
                        <React.Fragment key={day.date}>
                          <tr
                            onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                            className={`hover:bg-muted/20 transition-colors cursor-pointer ${day.isToday ? 'bg-primary/5' : ''}`}
                          >
                            <td className="py-3.5 px-5 font-bold text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{day.formattedDate}</span>
                                {day.isToday && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/20 text-primary uppercase">
                                    Today
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-xs border border-blue-500/20">
                                {day.dealsCount} {day.dealsCount === 1 ? 'deal' : 'deals'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                              {formatOMR(day.totalSales)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                              {formatOMR(day.govtFees)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {formatOMR(day.netProfit)}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                <span className="text-foreground">{formatOMR(day.collectedAmount)}</span>
                                <span className="text-border">/</span>
                                <span className="text-rose-400">{formatOMR(day.pendingAmount)}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setExpandedDate(isExpanded ? null : day.date);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-muted text-[11px] font-bold text-foreground transition-all flex items-center gap-1 ml-auto"
                              >
                                <span>{isExpanded ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'عرض الصفقات' : 'View Deals')}</span>
                                <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Deals for this Day */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-4 bg-muted/15 border-y border-border/40">
                                <div className="space-y-2">
                                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                                    {day.formattedDate} — {day.deals.length} {isRtl ? 'صفقات تم إغلاقها' : 'Deals Closed'}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {day.deals.map(deal => (
                                      <div
                                        key={deal.id}
                                        className="p-3 rounded-2xl bg-card border border-border/60 space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono text-[10px] font-bold text-primary">{deal.job_code}</span>
                                          <span className="text-[10px] font-bold text-muted-foreground">{deal.branch_name}</span>
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-foreground truncate">{deal.client_name}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{deal.service_name}</p>
                                        </div>
                                        <div className="pt-1.5 border-t border-border/30 flex items-center justify-between text-[11px]">
                                          <div>
                                            <span className="text-[10px] text-muted-foreground block">{isRtl ? 'المبيعات' : 'Sales'}</span>
                                            <strong className="font-mono text-foreground">{formatOMR(deal.total_fee)}</strong>
                                          </div>
                                          <div>
                                            <span className="text-[10px] text-muted-foreground block">{isRtl ? 'الرسوم' : 'Gov Fee'}</span>
                                            <strong className="font-mono text-amber-400">{formatOMR(deal.ministry_fee)}</strong>
                                          </div>
                                          <div>
                                            <span className="text-[10px] text-muted-foreground block">{isRtl ? 'الربح' : 'Profit'}</span>
                                            <strong className="font-mono text-emerald-400">{formatOMR(deal.work_fee)}</strong>
                                          </div>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1">
                                          <span>{isRtl ? 'مسؤول البيع:' : 'Sales Rep:'} <strong>{deal.sales_rep_name}</strong></span>
                                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                            deal.advance_paid && deal.remaining_paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                          }`}>
                                            {deal.advance_paid && deal.remaining_paid ? 'Fully Paid' : 'Pending'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SALES TEAM WON DEALS ──────────────────────────────────────── */}
      {activeTab === 'sales_reps' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-syne text-foreground">
                {isRtl ? 'تقرير إيرادات صفقات الموظفين' : 'Sales Team Deal Revenue'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'المبالغ المحققة من كل موظف مبيعات عند إغلاق الصفقات، رسومها الحكومية، وصافي أرباحها' : 'Total money brought in by each sales employee from won deals, including exact gov fees and net profit'}
              </p>
            </div>
          </div>

          {filteredSalesReps.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border/50 rounded-3xl p-8 space-y-2">
              <Users size={32} className="mx-auto text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">{isRtl ? 'لا توجد بيانات موظفين في هذه الفترة' : 'No sales performance records found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSalesReps.map((rep, idx) => (
                <div
                  key={rep.employeeId}
                  className="bg-card border border-border/80 hover:border-primary/40 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all"
                >
                  {/* Top: Avatar & Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shrink-0">
                        {rep.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground truncate">{rep.fullName}</h4>
                          {idx === 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Award size={9} /> Top Rep
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {rep.employeeCode || 'REP'} • {rep.branchName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {rep.dealsWonCount} {isRtl ? 'صفقة رابحة' : 'Deals Won'}
                      </span>
                    </div>
                  </div>

                  {/* Revenue Numbers Strip */}
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{isRtl ? 'إجمالي المبيعات:' : 'Total Deal Value:'}</span>
                      <strong className="text-base font-bold font-syne text-foreground">{formatOMR(rep.totalSales)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{isRtl ? 'الرسوم الحكومية:' : 'Gov Fees:'}</span>
                      <span className="font-mono font-bold text-amber-400">{formatOMR(rep.govtFees)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{isRtl ? 'أرباح المركز الصافية:' : 'Net Center Profit:'}</span>
                      <span className="font-mono font-bold text-emerald-400">{formatOMR(rep.netProfit)}</span>
                    </div>
                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{isRtl ? 'المستلم فعلياً:' : 'Collected:'}</span>
                      <span className="font-mono text-foreground font-bold">{formatOMR(rep.collectedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{isRtl ? 'المتبقي في ذمة العملاء:' : 'Pending Owed:'}</span>
                      <span className="font-mono text-rose-400 font-bold">{formatOMR(rep.pendingAmount)}</span>
                    </div>
                  </div>

                  {/* Action to view all won deals by this rep */}
                  <button
                    onClick={() => setSelectedRepDetails(rep)}
                    className="w-full py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Eye size={13} />
                    <span>{isRtl ? 'استعراض جميع صفقات الموظف' : 'View Won Deals'} ({rep.deals.length})</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: GOVERNMENT FEES HUB (DATE-WISE & EMPLOYEE-WISE) ──────────── */}
      {activeTab === 'govt_fees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-syne text-foreground">
                {isRtl ? 'سجل الرسوم الحكومية المباشر' : 'Government Fees Hub'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'المبالغ الدقيقة المحصلة والمخصصة للرسوم الحكومية بحسب التاريخ وبحسب الموظف' : 'Exact amounts used for official government fees date-wise and employee-wise'}
              </p>
            </div>

            {/* Sub-tab toggle: Date-wise vs Employee-wise */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-bold">
              <button
                onClick={() => setGovFeeSubTab('date')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  govFeeSubTab === 'date' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'حسب التاريخ (Date-wise)' : 'Date-Wise Breakdown'}
              </button>
              <button
                onClick={() => setGovFeeSubTab('employee')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  govFeeSubTab === 'employee' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'حسب الموظف (Employee-wise)' : 'Employee-Wise Breakdown'}
              </button>
            </div>
          </div>

          {/* SubTab A: Date-wise Govt Fees */}
          {govFeeSubTab === 'date' && (
            <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3.5 px-5">{isRtl ? 'التاريخ' : 'Date'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'عدد المعاملات' : 'Jobs with Gov Fees'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'مبلغ الرسوم الحكومية' : 'Gov Fee Amount'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'إجمالي مبيعات اليوم' : "Day's Total Sales"}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'نسبة الرسوم' : 'Gov Fee Share'}</th>
                      <th className="py-3.5 px-5 text-right">{isRtl ? 'الخدمات' : 'Services'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredGovtDateWise.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          {isRtl ? 'لا توجد رسوم حكومية في هذه الفترة' : 'No government fees recorded in this timeframe'}
                        </td>
                      </tr>
                    ) : (
                      filteredGovtDateWise.map(item => (
                        <tr key={item.date} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-foreground whitespace-nowrap">
                            {item.formattedDate}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                              {item.jobsCount} {item.jobsCount === 1 ? 'job' : 'jobs'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {formatOMR(item.govtFeeTotal)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                            {formatOMR(item.totalSales)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {item.govtFeePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px] inline-block">
                              {item.deals.map(d => d.service_name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(', ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab B: Employee-wise Govt Fees */}
          {govFeeSubTab === 'employee' && (
            <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3.5 px-5">{isRtl ? 'الموظف' : 'Employee'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'عدد المعاملات' : 'Deals Handled'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'إجمالي الرسوم الحكومية' : 'Gov Fees Handled'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'إجمالي المبيعات' : 'Total Deal Volume'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'أرباح المركز المحققة' : 'Net Profit Generated'}</th>
                      <th className="py-3.5 px-5 text-right">{isRtl ? 'نسبة الرسوم' : 'Gov Share'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredGovtEmployeeWise.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          {isRtl ? 'لا توجد بيانات موظفين' : 'No employee records found'}
                        </td>
                      </tr>
                    ) : (
                      filteredGovtEmployeeWise.map(emp => {
                        const ratio = emp.totalSales > 0 ? (emp.govtFeeTotal / emp.totalSales) * 100 : 0;

                        return (
                          <tr key={emp.employeeId} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-foreground whitespace-nowrap">
                              <div>
                                <p className="font-bold text-xs text-foreground">{emp.fullName}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{emp.employeeCode || 'REP'}</p>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                                {emp.jobsCount} {emp.jobsCount === 1 ? 'deal' : 'deals'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                              {formatOMR(emp.govtFeeTotal)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                              {formatOMR(emp.totalSales)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {formatOMR(emp.netProfit)}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <span className="text-[11px] font-bold text-muted-foreground">
                                {ratio.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: ALL DEALS LEDGER ─────────────────────────────────────────── */}
      {activeTab === 'all_deals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-syne text-foreground">
                {isRtl ? 'سجل جميع المعاملات والصفقات' : 'All Deals Ledger'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'قائمة كاملة بكل الصفقات متضمنة العميل، مسؤول البيع، الرسوم الحكومية، والربح' : 'Complete financial transaction list with full payment status and breakdown'}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3.5 px-4">{isRtl ? 'رمز المعاملة' : 'Job Code'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'العميل' : 'Client'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'مسؤول البيع' : 'Sales Rep'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'نوع الخدمة' : 'Service'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'إجمالي الصفقة' : 'Total Fee'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'الرسوم الحكومية' : 'Gov Fee'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'أرباح المركز' : 'Profit'}</th>
                    <th className="py-3.5 px-4">{isRtl ? 'المستلم / المتبقي' : 'Paid / Owed'}</th>
                    <th className="py-3.5 px-4 text-right">{isRtl ? 'حالة السداد' : 'Payment Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        {isRtl ? 'لا توجد معاملات مطابقة للفلاتر المحددة' : 'No deals match your filter criteria'}
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map(deal => (
                      <tr key={deal.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                          {deal.job_code}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div>
                            <p className="font-bold text-xs text-foreground truncate max-w-[150px]">{deal.client_name}</p>
                            {deal.client_company && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{deal.client_company}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-foreground">{deal.sales_rep_name}</span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">{deal.service_name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                          {formatOMR(deal.total_fee)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {formatOMR(deal.ministry_fee)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatOMR(deal.work_fee)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          <span className="text-foreground">{formatOMR(deal.collected_amount)}</span>
                          <span className="text-border mx-1">/</span>
                          <span className="text-rose-400">{formatOMR(deal.pending_amount)}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            deal.advance_paid && deal.remaining_paid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : deal.advance_paid
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {deal.advance_paid && deal.remaining_paid
                              ? (isRtl ? 'مسدد بالكامل' : 'Fully Paid')
                              : deal.advance_paid
                                ? (isRtl ? 'المقدم فقط' : 'Deposit Paid')
                                : (isRtl ? 'غير مسدد' : 'Unpaid')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SALES REP WON DEALS DRAWER / MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {selectedRepDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-border/40 flex items-center justify-between bg-muted/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {selectedRepDetails.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-syne text-base font-bold text-foreground">
                      {isRtl ? `تقرير صفقات: ${selectedRepDetails.fullName}` : `Won Deals: ${selectedRepDetails.fullName}`}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {selectedRepDetails.employeeCode || 'REP'} • {selectedRepDetails.deals.length} {isRtl ? 'صفقات رابحة' : 'won deals recorded'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRepDetails(null)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Summary Banner */}
              <div className="p-4 bg-muted/10 border-b border-border/30 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-center">
                <div className="p-2.5 rounded-xl bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">{isRtl ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
                  <strong className="text-sm font-bold font-syne text-foreground">{formatOMR(selectedRepDetails.totalSales)}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">{isRtl ? 'الرسوم الحكومية' : 'Gov Fees'}</span>
                  <strong className="text-sm font-bold font-syne text-amber-400">{formatOMR(selectedRepDetails.govtFees)}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">{isRtl ? 'صافي الأرباح' : 'Net Profit'}</span>
                  <strong className="text-sm font-bold font-syne text-emerald-400">{formatOMR(selectedRepDetails.netProfit)}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">{isRtl ? 'المحصل' : 'Collected'}</span>
                  <strong className="text-sm font-bold font-syne text-blue-400">{formatOMR(selectedRepDetails.collectedAmount)}</strong>
                </div>
              </div>

              {/* Deals List */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                {selectedRepDetails.deals.map(deal => (
                  <div
                    key={deal.id}
                    className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">{deal.job_code}</span>
                      <span className="text-[10px] text-muted-foreground">{deal.created_at ? format(new Date(deal.created_at), 'dd MMM yyyy') : ''}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-xs text-foreground">{deal.client_name}</p>
                        <p className="text-[11px] text-muted-foreground">{deal.service_name}</p>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-[9px] text-muted-foreground block">{isRtl ? 'المبلغ' : 'Total'}</span>
                          <span className="font-mono font-bold text-foreground">{formatOMR(deal.total_fee)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block">{isRtl ? 'الرسوم' : 'Gov'}</span>
                          <span className="font-mono font-bold text-amber-400">{formatOMR(deal.ministry_fee)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block">{isRtl ? 'الربح' : 'Profit'}</span>
                          <span className="font-mono font-bold text-emerald-400">{formatOMR(deal.work_fee)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border/40 bg-muted/20 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedRepDetails(null)}
                  className="px-5 py-2 bg-muted hover:bg-muted/70 text-foreground font-bold text-xs rounded-xl transition-all"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
