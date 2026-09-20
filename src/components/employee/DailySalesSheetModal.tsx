import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, Download, Printer, RefreshCw, 
  FileText, TrendingUp, Phone, Users, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, Sparkles, Building2,
  Send, CalendarRange
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { useDailySalesSheetData, useWeeklySalesSheetData, useSubmitDailyReport, useCheckDailyReport } from '../../hooks/shared/useLeads';
import { DailySalesSheetDocument, WeeklySalesSheetDocument } from './DailySalesSheetDocument';
import { useReactToPrint } from 'react-to-print';
import { format, subDays, addDays, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export const DailySalesSheetModal: React.FC<Props> = ({ isOpen, onClose, defaultEmployeeId }) => {
  const { profile, role } = useAuth();
  const isManagerOrAdmin = role === 'admin' || profile?.is_manager;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(defaultEmployeeId || profile?.id || '');

  const getWeekStart = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const mon = startOfWeek(d, { weekStartsOn: 1 });
    return format(mon, 'yyyy-MM-dd');
  };
  const [weekStartDate, setWeekStartDate] = useState<string>(getWeekStart(todayStr));

  const { data: employees = [] } = useAdminEmployees(profile?.branch_id || undefined);
  const activeEmployees = employees.filter(e => e.is_active && (e.can_do_sales || e.department === 'sales' || isManagerOrAdmin));

  const printRef = useRef<HTMLDivElement>(null);

  const effectiveEmpId = selectedEmpId || profile?.id;

  const { data: salesSheetData, isLoading: isDailyLoading, refetch: refetchDaily, isRefetching: isDailyRefetching } = useDailySalesSheetData(
    viewMode === 'daily' ? effectiveEmpId : undefined,
    selectedDate
  );
  const { data: weeklySheetData, isLoading: isWeeklyLoading, refetch: refetchWeekly, isRefetching: isWeeklyRefetching } = useWeeklySalesSheetData(
    viewMode === 'weekly' ? effectiveEmpId : undefined,
    weekStartDate
  );

  const isLoading = viewMode === 'daily' ? isDailyLoading : isWeeklyLoading;
  const isRefetching = viewMode === 'daily' ? isDailyRefetching : isWeeklyRefetching;
  const refetch = viewMode === 'daily' ? refetchDaily : refetchWeekly;

  const submitReport = useSubmitDailyReport();
  const { data: submittedReport, refetch: refetchSubmitStatus } = useCheckDailyReport(effectiveEmpId, selectedDate);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: viewMode === 'daily'
      ? `Daily_Sales_Report_${salesSheetData?.employee.full_name?.replace(/\s+/g, '_')}_${selectedDate}`
      : `Weekly_Sales_Report_${weeklySheetData?.employee.full_name?.replace(/\s+/g, '_')}_${weekStartDate}`,
  });

  const exportToCSV = () => {
    // ── Weekly CSV ──
    if (viewMode === 'weekly') {
      if (!weeklySheetData) return;
      const lines: string[] = [];
      lines.push(`OSBIC INTERNATIONAL — WEEKLY SALES REPORT (WSR)`);
      lines.push(`Week,"${weeklySheetData.weekStart} to ${weeklySheetData.weekEnd}"`);
      lines.push(`Sales Executive,"${weeklySheetData.employee.full_name}"`);
      lines.push(`Branch,"${weeklySheetData.employee.branch_name || 'Main Branch'}"`);
      lines.push('');
      lines.push('WEEKLY TOTALS');
      lines.push('New Leads,Total Calls,Positive Calls,Negative Calls,Quotes,Quote Value (OMR),Deals Won,Deal Value (OMR)');
      const t = weeklySheetData.totals;
      lines.push(`${t.newLeadsCount},${t.interactionsCount},${t.positiveCallsCount},${t.negativeCallsCount},${t.quotesCount},${t.quotesTotalAmount.toFixed(3)},${t.convertedDealsCount},${t.convertedDealsAmount.toFixed(3)}`);
      lines.push('');
      lines.push('DAILY BREAKDOWN');
      lines.push('Date,Day,New Leads,Calls,Positive,Negative,Quotes,Quote Value (OMR),Deals,Deal Value (OMR)');
      weeklySheetData.days.forEach(day => {
        lines.push(`${day.date},${day.dayLabel},${day.newLeadsCount},${day.interactionsCount},${day.positiveCallsCount},${day.negativeCallsCount},${day.quotesCount},${day.quotesTotalAmount.toFixed(3)},${day.convertedDealsCount},${day.convertedDealsAmount.toFixed(3)}`);
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Weekly_Sales_Sheet_${weeklySheetData.employee.full_name?.replace(/\s+/g, '_')}_${weeklySheetData.weekStart}.csv`;
      link.click();
      toast.success('Weekly Sales Sheet exported to CSV!');
      return;
    }

    // ── Daily CSV ──

    const lines: string[] = [];
    lines.push(`OSBIC INTERNATIONAL — DAILY SALES REPORT (DSR)`);
    lines.push(`Date,"${salesSheetData.date}"`);
    lines.push(`Sales Executive,"${salesSheetData.employee.full_name}"`);
    lines.push(`Branch,"${salesSheetData.employee.branch_name || 'Main Branch'}"`);
    lines.push('');

    // Summary Metrics
    lines.push(`DAILY SUMMARY METRICS`);
    lines.push(`Metric,Count,Value (OMR)`);
    lines.push(`New Inquiries / Leads Received,${salesSheetData.metrics.newLeadsCount},-`);
    lines.push(`Touchpoints & Calls Made,${salesSheetData.metrics.interactionsCount},-`);
    lines.push(`Quotations Issued,${salesSheetData.metrics.quotesCount},${salesSheetData.metrics.quotesTotalAmount.toFixed(3)}`);
    lines.push(`Deals Won & Converted,${salesSheetData.metrics.convertedDealsCount},${salesSheetData.metrics.convertedDealsAmount.toFixed(3)}`);
    lines.push(`Next Day Scheduled Follow-ups,${salesSheetData.metrics.scheduledFollowUpsCount},-`);
    lines.push('');

    // 1. New Leads
    lines.push(`1. NEW LEADS & INQUIRIES`);
    lines.push(`Lead Code,Contact Name,Company,Phone,Source,Interested Services`);
    if (salesSheetData.newLeads.length > 0) {
      salesSheetData.newLeads.forEach(l => {
        const srv = (l.interested_services || []).map((s: any) => s.name || s.name_en || s).join('; ');
        lines.push(`"${l.lead_code || ''}","${l.contact_name}","${l.company_name || ''}","${l.contact_phone || ''}","${l.lead_sources?.name || 'Direct'}","${srv || 'Business Setup'}"`);
      });
    } else {
      lines.push(`No new inquiries recorded on this date.`);
    }
    lines.push('');

    // 2. Touchpoints & Interactions
    lines.push(`2. CLIENT INTERACTIONS & CALLS`);
    lines.push(`Type,Client/Company,Discussion Notes,Outcome / Next Action`);
    if (salesSheetData.interactions.length > 0) {
      salesSheetData.interactions.forEach(i => {
        const name = i.lead?.contact_name + (i.lead?.company_name ? ` (${i.lead.company_name})` : '');
        lines.push(`"${i.type.toUpperCase()}","${name}","${(i.notes || '').replace(/"/g, '""')}","${(i.outcome || i.next_action || '').replace(/"/g, '""')}"`);
      });
    } else {
      lines.push(`No touchpoints recorded on this date.`);
    }
    lines.push('');

    // 3. Quotations
    lines.push(`3. QUOTATIONS ISSUED`);
    lines.push(`Quote Number,Recipient,Activity/Scope,Total Amount (OMR)`);
    if (salesSheetData.quotations.length > 0) {
      salesSheetData.quotations.forEach(q => {
        const recipient = q.metadata?.company_name || q.client?.company_name || q.lead?.company_name || q.client?.full_name || q.lead?.contact_name || 'Client';
        lines.push(`"${q.invoice_number || 'DRAFT'}","${recipient}","${(q.notes || '').replace(/"/g, '""')}",${Number(q.total_amount || 0).toFixed(3)}`);
      });
    } else {
      lines.push(`No quotations issued on this date.`);
    }
    lines.push('');

    // 4. Won Deals
    lines.push(`4. DEALS WON & CONVERTED`);
    lines.push(`Job File Code,Client / Company,Service,Contract Total (OMR)`);
    if (salesSheetData.convertedDeals.length > 0) {
      salesSheetData.convertedDeals.forEach(d => {
        lines.push(`"${d.job_code}","${d.title}","${d.service_name}",${Number(d.amount || 0).toFixed(3)}`);
      });
    } else {
      lines.push(`No deals converted on this date.`);
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daily_Sales_Sheet_${salesSheetData.employee.full_name?.replace(/\s+/g, '_')}_${selectedDate}.csv`;
    link.click();
    toast.success('Daily Sales Sheet exported to CSV!');
  };

  const handleShiftDate = (days: number) => {
    if (viewMode === 'daily') {
      const current = new Date(selectedDate + 'T00:00:00');
      const shifted = days > 0 ? addDays(current, days) : subDays(current, Math.abs(days));
      setSelectedDate(format(shifted, 'yyyy-MM-dd'));
    } else {
      const current = new Date(weekStartDate + 'T00:00:00');
      const shifted = days > 0 ? addDays(current, 7) : subDays(current, 7);
      setWeekStartDate(format(shifted, 'yyyy-MM-dd'));
    }
  };

  const handleSubmitReport = async () => {
    if (!effectiveEmpId || !salesSheetData) return;
    try {
      await submitReport.mutateAsync({
        employee_id: effectiveEmpId,
        report_date: selectedDate,
        metrics: salesSheetData.metrics,
      });
      refetchSubmitStatus();
      toast.success('Daily report submitted to your Sales Lead! ✓');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('404')) {
        toast.error('Submit needs DB setup. Run the SQL migration in Supabase first.');
      } else {
        toast.error(msg || 'Failed to submit report');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative bg-card border border-border rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col z-10 overflow-hidden"
        >
          {/* ─── Top Control Bar ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-border bg-card/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-syne font-bold text-foreground flex items-center gap-2 flex-wrap">
                  {viewMode === 'daily' ? 'Daily Sales Sheet (DSR)' : 'Weekly Sales Sheet (WSR)'}
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    Live CRM
                  </span>
                  {submittedReport && viewMode === 'daily' && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono flex items-center gap-1">
                      <CheckCircle2 size={10} /> Submitted
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {viewMode === 'daily'
                    ? 'View and export daily inquiries, client touchpoints, quotes, and won deals.'
                    : 'Weekly summary — aggregated performance across 7 days.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-muted/40 border border-border rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText size={13} /> Daily
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarRange size={13} /> Weekly
                </button>
              </div>

              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border text-foreground transition-all disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={exportToCSV}
                disabled={isLoading || (!salesSheetData && !weeklySheetData)}
                className="px-3.5 py-2.5 bg-muted/60 hover:bg-muted border border-border text-foreground rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Download size={15} />
                <span>CSV</span>
              </button>

              <button
                onClick={() => handlePrint()}
                disabled={isLoading || (!salesSheetData && !weeklySheetData)}
                className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                <Printer size={15} />
                <span>Print / PDF</span>
              </button>

              {viewMode === 'daily' && !submittedReport && (
                <button
                  onClick={handleSubmitReport}
                  disabled={submitReport.isPending || isLoading || !salesSheetData}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {submitReport.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Submit to Lead</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2.5 rounded-xl hover:bg-muted/80 text-muted-foreground transition-colors ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ─── Filters & Selection Strip ─── */}
          <div className="p-4 sm:px-6 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Date Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleShiftDate(-1)}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title={viewMode === 'daily' ? 'Previous Day' : 'Previous Week'}
                >
                  <ChevronLeft size={14} />
                </button>
                {viewMode === 'daily' ? (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-foreground font-bold px-2 py-1 text-xs outline-none cursor-pointer"
                  />
                ) : (
                  <span className="px-2 py-1 text-foreground font-bold text-xs whitespace-nowrap">
                    {format(new Date(weekStartDate + 'T00:00:00'), 'dd MMM')} – {format(addDays(new Date(weekStartDate + 'T00:00:00'), 6), 'dd MMM yyyy')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleShiftDate(1)}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title={viewMode === 'daily' ? 'Next Day' : 'Next Week'}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1">
                {viewMode === 'daily' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                        selectedDate === todayStr
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                        selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Yesterday
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setWeekStartDate(getWeekStart(todayStr))}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                        weekStartDate === getWeekStart(todayStr)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStartDate(getWeekStart(format(subDays(new Date(), 7), 'yyyy-MM-dd')))}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                        weekStartDate === getWeekStart(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Last Week
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Staff Selector (For Managers/Admins) */}
            {isManagerOrAdmin && activeEmployees.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Executive:</span>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold outline-none focus:border-primary cursor-pointer shadow-sm"
                >
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.department || emp.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ─── Scrollable Sheet Preview ─── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-900/60 flex justify-center">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-xs font-medium">
                  {viewMode === 'daily' ? 'Generating Daily Sales Report...' : 'Aggregating Weekly Data...'}
                </p>
              </div>
            ) : viewMode === 'daily' && salesSheetData ? (
              <div className="w-full max-w-[794px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-border/40">
                <DailySalesSheetDocument ref={printRef} data={salesSheetData} />
              </div>
            ) : viewMode === 'weekly' && weeklySheetData ? (
              <div className="w-full max-w-[794px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-border/40">
                <WeeklySalesSheetDocument ref={printRef} data={weeklySheetData} />
              </div>
            ) : (
              <div className="py-24 text-center text-muted-foreground text-xs">
                No activity data available for the selected {viewMode === 'daily' ? 'date' : 'week'}.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
