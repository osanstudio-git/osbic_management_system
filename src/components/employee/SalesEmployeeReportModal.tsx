import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Download, Printer, FileText, Calendar, Filter, Sparkles,
  Building2, CheckCircle2, ChevronRight, Layers, DollarSign,
  TrendingUp, Users, ArrowRight, ShieldCheck, Briefcase
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { RepPerformanceData } from '../../hooks/employee/useSalesTeamReports';
import { SalesEmployeeReportDocument, type ReportContentType } from './SalesEmployeeReportDocument';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rep: RepPerformanceData | null;
  allReps?: RepPerformanceData[];
  defaultTimeframe?: 'all' | 'today' | 'week' | 'month' | 'custom';
  branchName?: string;
}

export const SalesEmployeeReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  rep: initialRep,
  allReps = [],
  defaultTimeframe = 'month',
  branchName,
}) => {
  const [selectedRepId, setSelectedRepId] = useState<string>(initialRep?.employeeId || 'all');
  const [reportType, setReportType] = useState<ReportContentType>('both');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>(defaultTimeframe);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Sync selected rep if initialRep changes
  React.useEffect(() => {
    if (initialRep) {
      setSelectedRepId(initialRep.employeeId);
    }
  }, [initialRep]);

  // Determine active target rep
  const targetRep = useMemo(() => {
    if (initialRep && selectedRepId === initialRep.employeeId) return initialRep;
    if (selectedRepId === 'all') return null;
    return allReps.find(r => r.employeeId === selectedRepId) || initialRep;
  }, [initialRep, selectedRepId, allReps]);

  // Consolidated rep if "all" is selected
  const activeRepData: RepPerformanceData = useMemo(() => {
    if (targetRep) return targetRep;

    // Aggregate all reps into a single team rep object
    const allLeads = allReps.flatMap(r => r.leads || []);
    const allSales = allReps.flatMap(r => r.sales || []);
    const allQuotes = allReps.flatMap(r => r.quotations || []);
    const allAssignedJobs = allReps.flatMap(r => r.assignedJobs || []);

    return {
      employeeId: 'all-team',
      fullName: 'OSBIC Sales Team (Branch Total)',
      employeeCode: 'ALL-TEAM',
      email: '',
      phone: null,
      avatarUrl: null,
      isSalesHead: true,
      canAssignLeads: true,
      branchName: branchName || 'Main Branch',
      totalLeads: allLeads.length,
      selfAddedCount: allReps.reduce((s, r) => s + r.selfAddedCount, 0),
      assignedToMeCount: allReps.reduce((s, r) => s + r.assignedToMeCount, 0),
      assignedLeadsCount: allLeads.length,
      assignedByMeCount: allReps.reduce((s, r) => s + r.assignedByMeCount, 0),
      newLeads: allLeads.filter(l => l.status === 'new').length,
      inProgressLeads: allLeads.filter(l => !['new', 'converted', 'lost', 'cancelled'].includes(l.status)).length,
      quotedLeads: allLeads.filter(l => l.status === 'quoted').length,
      wonLeads: allLeads.filter(l => l.status === 'converted').length,
      lostLeads: allLeads.filter(l => l.status === 'lost').length,
      conversionRate: allLeads.length > 0 ? Number(((allLeads.filter(l => l.status === 'converted').length / allLeads.length) * 100).toFixed(1)) : 0,
      quotesCount: allQuotes.length,
      totalQuotedAmount: allReps.reduce((s, r) => s + r.totalQuotedAmount, 0),
      avgQuoteAmount: 0,
      wonSalesCount: allReps.reduce((s, r) => s + r.wonSalesCount, 0),
      wonRevenue: allReps.reduce((s, r) => s + r.wonRevenue, 0),
      govtFeesTotal: allReps.reduce((s, r) => s + r.govtFeesTotal, 0),
      netProfit: allReps.reduce((s, r) => s + r.netProfit, 0),
      profitMargin: 0,
      avgDealSize: 0,
      assignedJobsCount: allAssignedJobs.length,
      assignedJobsTotalFee: allAssignedJobs.reduce((s, j) => s + Number(j.totalFee || 0), 0),
      assignedJobsWorkFee: allAssignedJobs.reduce((s, j) => s + Number(j.workFee || 0), 0),
      assignedJobsCompletedCount: allAssignedJobs.filter(j => j.isAllCompleted).length,
      assignedJobsInProgressCount: allAssignedJobs.filter(j => j.isInProgress).length,
      assignedJobsPoolCount: allAssignedJobs.filter(j => j.hasPoolTask).length,
      leads: allLeads,
      distributedLeads: [],
      quotations: allQuotes,
      sales: allSales,
      assignedJobs: allAssignedJobs,
    };
  }, [targetRep, allReps, branchName]);

  // Date filtering helper
  const isInDateRange = (dateStr?: string | null) => {
    if (!dateStr || dateFilter === 'all') return true;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const now = new Date();

      if (dateFilter === 'today') {
        return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
      }
      if (dateFilter === 'week') {
        return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
      }
      if (dateFilter === 'month') {
        return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
      }
      if (dateFilter === 'custom') {
        if (customStart && customEnd) {
          const s = startOfDay(parseISO(customStart));
          const e = endOfDay(parseISO(customEnd));
          return isWithinInterval(d, { start: s, end: e });
        }
      }
      return true;
    } catch {
      return true;
    }
  };

  // Preview Counts
  const previewLeads = (activeRepData.leads || []).filter(l => isInDateRange(l.created_at || l.conversion_date));
  const previewSales = React.useMemo(() => {
    const list: any[] = [];
    const seenJobIds = new Set<string>();

    (activeRepData.assignedJobs || []).forEach(j => {
      if (j.status !== 'cancelled' && isInDateRange(j.createdAt)) {
        seenJobIds.add(j.id);
        list.push({
          id: j.id,
          date: j.createdAt,
          client: j.companyName || j.clientName || 'Client',
          service: j.serviceName || 'Corporate Service',
          amount: Number(j.totalFee) || 0,
          gov: Number(j.ministryFee) || 0,
          profit: Number(j.workFee) || 0,
          balance: Number(j.balance) || 0,
          modeOfPayment: j.paymentMode || 'bank_transfer',
          remark: j.jobCode ? `${j.jobCode}${j.notes ? ` - ${j.notes}` : ''}` : (j.notes || 'Job File'),
        });
      }
    });

    (activeRepData.sales || []).forEach(s => {
      if (s.status !== 'cancelled' && !seenJobIds.has(s.id) && isInDateRange(s.date || s.createdAt)) {
        list.push({
          id: s.id,
          date: s.date || s.createdAt,
          client: s.companyName || s.clientName || 'Client',
          service: s.serviceName || s.workType || 'Direct Sale',
          amount: Number(s.amount) || 0,
          gov: Number(s.govtFee) || 0,
          profit: Number(s.profit) || 0,
          balance: Number(s.balance) || 0,
          modeOfPayment: s.modeOfPayment || 'cash',
          remark: s.remarks || (s.source === 'walkin' ? 'Walk-in Sale' : 'Converted Lead'),
        });
      }
    });

    return list;
  }, [activeRepData, dateFilter, customStart, customEnd]);

  const previewTotalSales = previewSales.reduce((s, i) => s + i.amount, 0);
  const previewTotalProfit = previewSales.reduce((s, i) => s + i.profit, 0);

  // Print Setup (PDF Landscape)
  const printRef = useRef<HTMLDivElement>(null);
  const timeframeLabel = useMemo(() => {
    if (dateFilter === 'today') return 'Today (' + format(new Date(), 'dd MMM yyyy') + ')';
    if (dateFilter === 'week') return 'This Week';
    if (dateFilter === 'month') return format(new Date(), 'MMMM yyyy');
    if (dateFilter === 'custom' && customStart && customEnd) return `${customStart} to ${customEnd}`;
    return 'All Records';
  }, [dateFilter, customStart, customEnd]);

  // Smart date and period based file naming
  const getSmartFileName = (ext: 'pdf' | 'csv') => {
    const rawName = activeRepData.employeeId === 'all-team' ? 'Team' : (activeRepData.fullName || 'Employee');
    const nameStr = rawName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    let periodStr = '';
    if (dateFilter === 'today') {
      periodStr = format(new Date(), 'dd_MMM_yyyy');
    } else if (dateFilter === 'week') {
      periodStr = `This_Week_${format(new Date(), 'dd_MMM_yyyy')}`;
    } else if (dateFilter === 'month') {
      periodStr = format(new Date(), 'MMM_yyyy');
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      periodStr = `${customStart}_to_${customEnd}`;
    } else {
      periodStr = 'All_Records';
    }
    return `OSBIC_${nameStr}_Sales_Report_${periodStr}.${ext}`;
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: getSmartFileName('pdf').replace('.pdf', ''),
  });

  // Export to CSV / Excel (Exact Match to User's Format)
  const handleExportExcel = () => {
    const csvSections: string[] = [];

    // Header info
    csvSections.push(`"OSBIC INTERNATIONAL - SALES & PERFORMANCE REPORT"`);
    csvSections.push(`"Representative:","${activeRepData.fullName} (${activeRepData.employeeCode || 'ALL'})"`);
    csvSections.push(`"Period:","${timeframeLabel}"`);
    csvSections.push(`"Generated At:","${format(new Date(), 'dd/MM/yyyy HH:mm')}"`);
    csvSections.push(``);

    // SECTION 1: Closed Sales Table (User's Exact Model)
    if (reportType === 'both' || reportType === 'sales_revenue') {
      csvSections.push(`"--- SECTION: CLOSED SALES & REVENUE SHEET ---"`);
      // Exact column names from user's Excel model
      const salesHeaders = ['sl no', 'date', 'client', 'service', 'amount', 'gov', 'profit', 'balance', 'remark', 'mode of payment'];
      csvSections.push(salesHeaders.join(','));

      let sumAmount = 0;
      let sumGov = 0;
      let sumProfit = 0;
      let sumBalance = 0;

      previewSales.forEach((item, idx) => {
        sumAmount += item.amount;
        sumGov += item.gov;
        sumProfit += item.profit;
        sumBalance += item.balance;

        const row = [
          idx + 1,
          `"${item.date ? format(new Date(item.date), 'dd/MM/yyyy') : ''}"`,
          `"${(item.client || '').replace(/"/g, '""')}"`,
          `"${(item.service || '').replace(/"/g, '""')}"`,
          item.amount.toFixed(3),
          item.gov.toFixed(3),
          item.profit.toFixed(3),
          item.balance.toFixed(3),
          `"${(item.remark || '').replace(/"/g, '""')}"`,
          `"${(item.modeOfPayment || 'bank_transfer').replace(/_/g, ' ')}"`,
        ];
        csvSections.push(row.join(','));
      });

      // Total Row
      csvSections.push(`"TOTAL (OMR):","","","",${sumAmount.toFixed(3)},${sumGov.toFixed(3)},${sumProfit.toFixed(3)},${sumBalance.toFixed(3)},"",""`);
      csvSections.push(``);
    }

    // SECTION 2: Leads & Quotations Table
    if (reportType === 'both' || reportType === 'leads_quotes') {
      csvSections.push(`"--- SECTION: LEADS PIPELINE & QUOTATIONS ---"`);
      const leadsHeaders = ['sl no', 'date', 'client', 'company', 'source', 'acquisition', 'status', 'quoted amount', 'expected profit'];
      csvSections.push(leadsHeaders.join(','));

      let sumQuoted = 0;
      let sumExpProfit = 0;

      previewLeads.forEach((lead, idx) => {
        const qAmt = Number(lead.quoted_amount) || 0;
        const pAmt = Number(lead.expected_profit) || 0;
        sumQuoted += qAmt;
        sumExpProfit += pAmt;
        const isAssigned = Boolean(lead.assigned_by && lead.assigned_by !== activeRepData.employeeId);

        const row = [
          idx + 1,
          `"${lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : ''}"`,
          `"${(lead.contact_name || '').replace(/"/g, '""')}"`,
          `"${(lead.company_name || '').replace(/"/g, '""')}"`,
          `"${((lead.lead_sources as any)?.name || 'Direct').replace(/"/g, '""')}"`,
          `"${isAssigned ? 'Assigned' : 'Self-Added'}"`,
          `"${lead.status}"`,
          qAmt > 0 ? qAmt.toFixed(3) : '0.000',
          pAmt > 0 ? pAmt.toFixed(3) : '0.000',
        ];
        csvSections.push(row.join(','));
      });

      csvSections.push(`"TOTAL (OMR):","","","","","","",${sumQuoted.toFixed(3)},${sumExpProfit.toFixed(3)}`);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvSections.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', getSmartFileName('csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Excel / CSV report downloaded successfully');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                  <span>Sales & Performance Report</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    Export Center
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download personal or team performance records in Horizontal PDF or Excel model
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm">
            {/* Consultant Selection (if multiple options available) */}
            {allReps.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Target Consultant / Representative
                </label>
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {initialRep && (
                    <option value={initialRep.employeeId}>
                      {initialRep.fullName} ({initialRep.employeeCode || 'Consultant'})
                    </option>
                  )}
                  {allReps.filter(r => r.employeeId !== initialRep?.employeeId).map(r => (
                    <option key={r.employeeId} value={r.employeeId}>
                      {r.fullName} ({r.employeeCode || 'Consultant'})
                    </option>
                  ))}
                  <option value="all">★ Entire Branch Sales Team (Aggregated)</option>
                </select>
              </div>
            )}

            {/* Step 1: Report Content Breakdown */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                1. Select Report Content
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setReportType('both')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    reportType === 'both'
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-foreground">Both (Sales & Leads)</span>
                    <Layers size={14} className={reportType === 'both' ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Includes both Closed Sales table and Leads Pipeline
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('sales_revenue')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    reportType === 'sales_revenue'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-foreground">Sales & Revenue</span>
                    <DollarSign size={14} className={reportType === 'sales_revenue' ? 'text-emerald-500' : 'text-muted-foreground'} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Client, Service, Amount, Gov, Profit, Balance, Mode (Excel model)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('leads_quotes')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    reportType === 'leads_quotes'
                      ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-foreground">Leads & Quotes</span>
                    <TrendingUp size={14} className={reportType === 'leads_quotes' ? 'text-sky-500' : 'text-muted-foreground'} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Inquiries, quotation values, and statuses
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: Timeframe Filter */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                2. Select Date Period
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['today', 'week', 'month', 'all', 'custom'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setDateFilter(period)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      dateFilter === period
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                    }`}
                  >
                    {period === 'all' ? 'All Records' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period}
                  </button>
                ))}
              </div>

              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border rounded-xl">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Start Date</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">End Date</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Print Orientation */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                3. Print Orientation (PDF)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    orientation === 'landscape'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-sm">▤</span>
                  <span>Horizontal (Landscape)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    orientation === 'portrait'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-sm">▥</span>
                  <span>Vertical (Portrait)</span>
                </button>
              </div>
            </div>

            {/* Live Data Summary Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block">Matched Sales</span>
                <span className="text-sm font-black text-foreground">{previewSales.length} Deals</span>
                <span className="text-[10px] text-emerald-500 font-mono font-bold block">{previewTotalSales.toFixed(3)} OMR</span>
              </div>
              <div className="border-x border-border/60">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block">Net Profit</span>
                <span className="text-sm font-black text-emerald-600 font-mono">{previewTotalProfit.toFixed(3)}</span>
                <span className="text-[10px] text-muted-foreground block">OMR Margin</span>
              </div>
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block">Matched Leads</span>
                <span className="text-sm font-black text-foreground">{previewLeads.length} Leads</span>
                <span className="text-[10px] text-sky-500 block">
                  {previewLeads.filter(l => l.status === 'converted').length} Won
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              Period: <strong className="text-foreground">{timeframeLabel}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-bold text-xs transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Download size={14} />
                <span>Export Excel / CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint()}
                className="px-5 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
              >
                <Printer size={14} />
                <span>Download {orientation === 'landscape' ? 'Horizontal' : 'Vertical'} PDF</span>
              </button>
            </div>
          </div>

          {/* Hidden Print Document */}
          <div className="hidden">
            <SalesEmployeeReportDocument
              ref={printRef}
              rep={activeRepData}
              reportType={reportType}
              timeframeLabel={timeframeLabel}
              dateFilter={dateFilter}
              customStart={customStart}
              customEnd={customEnd}
              branchName={branchName}
              orientation={orientation}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

