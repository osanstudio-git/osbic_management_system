import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Printer, FileText, TrendingUp, DollarSign, 
  Users, CheckCircle2, Calendar, Filter, Sparkles, Building2,
  PieChart, Award, Phone, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { format, isBefore, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { type Lead } from '../../hooks/shared/useLeads';
import { type Employee } from '../../hooks/admin/useAdminEmployees';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  salesReps: Employee[];
  leadSources: { id: string; name: string }[];
  currentUserId?: string;
  isSalesHead: boolean;
}

type ReportType = 'sales_head' | 'accounts' | 'marketing';

export const SalesExportCenterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  leads,
  salesReps,
  leadSources,
  currentUserId,
  isSalesHead,
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('sales_head');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `OSBIC_${activeReport.toUpperCase()}_REPORT_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  // Filter leads based on selected criteria
  const filteredData = useMemo(() => {
    return (leads || []).filter(lead => {
      // Rep filter
      if (selectedRepFilter !== 'all' && lead.assigned_to !== selectedRepFilter) {
        return false;
      }

      // Date filter on created_at or conversion_date
      const refDate = lead.conversion_date 
        ? new Date(lead.conversion_date) 
        : new Date(lead.created_at);

      const now = new Date();
      if (dateFilter === 'today') {
        return refDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const mon = startOfWeek(now, { weekStartsOn: 1 });
        return refDate >= mon;
      } else if (dateFilter === 'month') {
        const firstDay = startOfMonth(now);
        return refDate >= firstDay;
      } else if (dateFilter === 'year') {
        const firstDayYear = startOfYear(now);
        return refDate >= firstDayYear;
      } else if (dateFilter === 'custom') {
        if (customStart && refDate < new Date(customStart)) return false;
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (refDate > end) return false;
        }
      }

      return true;
    });
  }, [leads, selectedRepFilter, dateFilter, customStart, customEnd]);

  // Calculations for Reports
  const salesSummary = useMemo(() => {
    let totalInquiries = filteredData.length;
    let connectedCount = 0;
    let quotedCount = 0;
    let totalQuotedAmount = 0;
    let expectedProfitTotal = 0;
    let wonCount = 0;
    let totalWonSales = 0;
    let totalGovtFee = 0;
    let netProfitTotal = 0;

    // Payment mode breakdown
    const paymentModes: Record<string, { count: number; total: number; profit: number }> = {
      cash: { count: 0, total: 0, profit: 0 },
      bank_transfer: { count: 0, total: 0, profit: 0 },
      card: { count: 0, total: 0, profit: 0 },
      cheque: { count: 0, total: 0, profit: 0 },
      online: { count: 0, total: 0, profit: 0 },
      other: { count: 0, total: 0, profit: 0 },
    };

    // Source breakdown
    const sourceStats: Record<string, { name: string; inquiries: number; won: number; revenue: number; profit: number }> = {};

    filteredData.forEach(lead => {
      // Outreach & connection
      if (lead.call_status === '1st Call Done' || lead.call_status === 'Connected Through Watsapp') {
        connectedCount++;
      }

      // Quoted
      const q = Number(lead.quoted_amount) || 0;
      const egf = Number(lead.expected_govt_fee) || 0;
      if (q > 0) {
        quotedCount++;
        totalQuotedAmount += q;
        expectedProfitTotal += (lead.expected_profit != null ? Number(lead.expected_profit) : Math.max(0, q - egf));
      }

      // Won & Financials
      const tot = Number(lead.total_amount) || 0;
      const gf = Number(lead.govt_fee) || 0;
      const p = lead.profit != null ? Number(lead.profit) : (tot - gf);
      const isWon = lead.status === 'converted' || tot > 0;

      if (isWon) {
        wonCount++;
        totalWonSales += tot;
        totalGovtFee += gf;
        netProfitTotal += p;

        const mode = (lead.payment_mode || 'cash').toLowerCase();
        if (paymentModes[mode]) {
          paymentModes[mode].count++;
          paymentModes[mode].total += tot;
          paymentModes[mode].profit += p;
        } else {
          paymentModes.other.count++;
          paymentModes.other.total += tot;
          paymentModes.other.profit += p;
        }
      }

      // Source rollup
      const srcName = lead.lead_sources?.name || lead.utm_source || 'Direct / Other';
      if (!sourceStats[srcName]) {
        sourceStats[srcName] = { name: srcName, inquiries: 0, won: 0, revenue: 0, profit: 0 };
      }
      sourceStats[srcName].inquiries++;
      if (isWon) {
        sourceStats[srcName].won++;
        sourceStats[srcName].revenue += tot;
        sourceStats[srcName].profit += p;
      }
    });

    const conversionRate = totalInquiries > 0 ? ((wonCount / totalInquiries) * 100).toFixed(1) : '0.0';

    return {
      totalInquiries,
      connectedCount,
      quotedCount,
      totalQuotedAmount,
      expectedProfitTotal,
      wonCount,
      totalWonSales,
      totalGovtFee,
      netProfitTotal,
      conversionRate,
      paymentModes,
      sourceStats: Object.values(sourceStats).sort((a, b) => b.revenue - a.revenue),
    };
  }, [filteredData]);

  // CSV Export Generator
  const exportCSV = () => {
    let csvContent = '';
    const nowStr = format(new Date(), 'yyyy-MM-dd HH:mm');

    if (activeReport === 'sales_head') {
      csvContent += `OSBIC INTERNATIONAL - SALES HEAD & CONVERSION REPORT\nGenerated: ${nowStr}\n\n`;
      csvContent += `SUMMARY METRICS\n`;
      csvContent += `Total Inquiries,Connected Leads,Quotations Sent,Quoted Amount (OMR),Expected Profit (OMR),Won Deals,Won Sales (OMR),Net Profit (OMR),Conversion Rate\n`;
      csvContent += `${salesSummary.totalInquiries},${salesSummary.connectedCount},${salesSummary.quotedCount},${salesSummary.totalQuotedAmount.toFixed(3)},${salesSummary.expectedProfitTotal.toFixed(3)},${salesSummary.wonCount},${salesSummary.totalWonSales.toFixed(3)},${salesSummary.netProfitTotal.toFixed(3)},${salesSummary.conversionRate}%\n\n`;

      csvContent += `DEAL DETAILS\n`;
      csvContent += `Lead Code,Client Name,Phone,Assigned Rep,Source,Service,Call Status,Quote Date,Quoted (OMR),Exp. Profit (OMR),Won Date,Sale Amount (OMR),Net Profit (OMR),Status\n`;
      filteredData.forEach(l => {
        csvContent += `"${l.lead_code || ''}","${l.contact_name}","${l.contact_phone || ''}","${l.assigned_to_profile?.full_name || ''}","${l.lead_sources?.name || 'Direct'}","${l.service_required || ''}","${l.call_status || 'Pending'}","${l.quote_date || ''}",${Number(l.quoted_amount || 0).toFixed(3)},${Number(l.expected_profit || 0).toFixed(3)},"${l.conversion_date || ''}",${Number(l.total_amount || 0).toFixed(3)},${Number(l.profit || 0).toFixed(3)},"${l.status || ''}"\n`;
      });
    } else if (activeReport === 'accounts') {
      csvContent += `OSBIC INTERNATIONAL - ACCOUNTS RECONCILED SALES & PROFIT REPORT\nGenerated: ${nowStr}\n\n`;
      csvContent += `ACCOUNTS SUMMARY\n`;
      csvContent += `Total Deals Won,Total Sales (OMR),Total Govt Fees (OMR),Net Company Profit (OMR)\n`;
      csvContent += `${salesSummary.wonCount},${salesSummary.totalWonSales.toFixed(3)},${salesSummary.totalGovtFee.toFixed(3)},${salesSummary.netProfitTotal.toFixed(3)}\n\n`;

      csvContent += `PAYMENT MODE BREAKDOWN\n`;
      csvContent += `Mode,Deals Count,Total Collected (OMR),Net Profit (OMR)\n`;
      Object.entries(salesSummary.paymentModes).forEach(([mode, stats]) => {
        if (stats.count > 0) {
          csvContent += `"${mode.toUpperCase()}",${stats.count},${stats.total.toFixed(3)},${stats.profit.toFixed(3)}\n`;
        }
      });
      csvContent += `\nCONVERTED DEALS LEDGER\n`;
      csvContent += `Won Date,Lead Code,Client Name,Phone,Rep,Payment Mode,Total Sale (OMR),Govt Fee (OMR),Net Profit (OMR)\n`;
      filteredData.filter(l => l.status === 'converted' || (l.total_amount || 0) > 0).forEach(l => {
        csvContent += `"${l.conversion_date || ''}","${l.lead_code || ''}","${l.contact_name}","${l.contact_phone || ''}","${l.assigned_to_profile?.full_name || ''}","${(l.payment_mode || 'cash').toUpperCase()}",${Number(l.total_amount || 0).toFixed(3)},${Number(l.govt_fee || 0).toFixed(3)},${Number(l.profit || 0).toFixed(3)}\n`;
      });
    } else {
      csvContent += `OSBIC INTERNATIONAL - MARKETING LEAD SOURCE & CHANNEL ROI REPORT\nGenerated: ${nowStr}\n\n`;
      csvContent += `Source / Channel,Total Inquiries,Won Deals,Conversion Rate,Revenue Generated (OMR),Net Profit (OMR)\n`;
      salesSummary.sourceStats.forEach(s => {
        const rate = s.inquiries > 0 ? ((s.won / s.inquiries) * 100).toFixed(1) : '0.0';
        csvContent += `"${s.name}",${s.inquiries},${s.won},${rate}%,${s.revenue.toFixed(3)},${s.profit.toFixed(3)}\n`;
      });
    }

    // Include UTF-8 BOM so Excel opens it with proper encoding
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OSBIC_${activeReport.toUpperCase()}_REPORT_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('CSV Report downloaded successfully!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-card border border-border rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-xl font-syne font-bold text-foreground">1-Click Export Center</h2>
              <p className="text-xs text-muted-foreground">Tailored executive reports for Sales Head, Accounts, and Marketing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Report Selector Tabs */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-xl border border-border">
            <button
              onClick={() => setActiveReport('sales_head')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeReport === 'sales_head' 
                  ? "bg-primary text-[#0A0F1E] shadow-md shadow-gold/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Award size={14} />
              <span>👑 Sales Head Report</span>
            </button>

            <button
              onClick={() => setActiveReport('accounts')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeReport === 'accounts' 
                  ? "bg-primary text-[#0A0F1E] shadow-md shadow-gold/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <DollarSign size={14} />
              <span>💳 Accounts Profit Report</span>
            </button>

            <button
              onClick={() => setActiveReport('marketing')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeReport === 'marketing' 
                  ? "bg-primary text-[#0A0F1E] shadow-md shadow-gold/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PieChart size={14} />
              <span>🎯 Marketing Source ROI</span>
            </button>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-4 py-2 rounded-xl bg-muted/80 hover:bg-white/10 text-foreground border border-border font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Download size={14} />
              <span>Download Excel/CSV</span>
            </button>

            <button
              onClick={() => handlePrint()}
              className="px-4 py-2 rounded-xl bg-primary text-[#0A0F1E] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-gold/20 active:scale-95"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="px-6 py-3 border-b border-border/60 bg-muted/20 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted-foreground" />
            <span className="font-bold text-muted-foreground uppercase text-[10px]">Date Range:</span>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none cursor-pointer"
            >
              <option value="month">This Month</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none"
              />
            </div>
          )}

          {isSalesHead && (
            <div className="flex items-center gap-2 ml-auto">
              <Users size={14} className="text-muted-foreground" />
              <span className="font-bold text-muted-foreground uppercase text-[10px]">Filter Rep:</span>
              <select
                value={selectedRepFilter}
                onChange={e => setSelectedRepFilter(e.target.value)}
                className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none cursor-pointer font-bold"
              >
                <option value="all">All Team Reps</option>
                {salesReps.map(r => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Printable & Interactive Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div ref={printRef} className="bg-white text-zinc-900 p-8 rounded-2xl shadow-md border border-zinc-200 print:border-none print:shadow-none print:p-0">
            {/* Report Branded Header */}
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-5 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-black font-syne tracking-wider text-zinc-900">OSBIC</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">Management System</span>
                </div>
                <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-800">
                  {activeReport === 'sales_head' && '👑 Sales Head Leads & Conversion Report'}
                  {activeReport === 'accounts' && '💳 Accounts Reconciled Sales & Profit Report'}
                  {activeReport === 'marketing' && '🎯 Marketing Lead Source Quality & Channels Report'}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Scope: {selectedRepFilter === 'all' ? 'All Team Members' : salesReps.find(r => r.id === selectedRepFilter)?.full_name} • Period: {dateFilter.toUpperCase()}
                </p>
              </div>

              <div className="text-right text-xs text-zinc-500">
                <p className="font-bold text-zinc-800">Official Executive Report</p>
                <p>Generated: {format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
                <p className="text-[10px] text-zinc-400">Currency: OMR (Omani Rial)</p>
              </div>
            </div>

            {/* KPI Summary Cards on Document */}
            {activeReport === 'sales_head' && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total Inquiries</span>
                  <span className="text-2xl font-black text-zinc-900 font-mono">{salesSummary.totalInquiries}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Connected Calls</span>
                  <span className="text-2xl font-black text-blue-900 font-mono">{salesSummary.connectedCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">Quoted Pipeline</span>
                  <span className="text-xl font-black text-purple-900 font-mono">OMR {salesSummary.totalQuotedAmount.toFixed(3)}</span>
                  <span className="text-[10px] text-purple-600 font-bold block">{salesSummary.quotedCount} quotes sent</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Won Deals & Net Profit</span>
                  <span className="text-xl font-black text-emerald-900 font-mono">OMR {salesSummary.netProfitTotal.toFixed(3)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold block">{salesSummary.wonCount} won ({salesSummary.conversionRate}%)</span>
                </div>
              </div>
            )}

            {activeReport === 'accounts' && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total Deals Won</span>
                  <span className="text-2xl font-black text-zinc-900 font-mono">{salesSummary.wonCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total Gross Sales</span>
                  <span className="text-2xl font-black text-zinc-900 font-mono">OMR {salesSummary.totalWonSales.toFixed(3)}</span>
                  <span className="text-[10px] text-zinc-500 block">Govt Fees: OMR {salesSummary.totalGovtFee.toFixed(3)}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Net Reconciled Profit</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono">OMR {salesSummary.netProfitTotal.toFixed(3)}</span>
                </div>
              </div>
            )}

            {/* Table Presentation */}
            {activeReport === 'sales_head' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-zinc-200">
                  <thead className="bg-zinc-100 text-[10px] font-bold uppercase text-zinc-700 border-b border-zinc-200">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Client Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Rep</th>
                      <th className="p-2">Source</th>
                      <th className="p-2">1st Call</th>
                      <th className="p-2 text-right">Quoted (OMR)</th>
                      <th className="p-2 text-right">Exp. Profit</th>
                      <th className="p-2 text-right">Won Sale</th>
                      <th className="p-2 text-right font-black">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-[11px]">
                    {filteredData.slice(0, 50).map(lead => (
                      <tr key={lead.id} className="hover:bg-zinc-50">
                        <td className="p-2 font-mono text-zinc-500">{lead.lead_code || '—'}</td>
                        <td className="p-2 font-bold text-zinc-900">{lead.contact_name}</td>
                        <td className="p-2 font-mono text-zinc-600">{lead.contact_phone || '—'}</td>
                        <td className="p-2 text-zinc-700">{lead.assigned_to_profile?.full_name || '—'}</td>
                        <td className="p-2 text-zinc-600">{lead.lead_sources?.name || 'Direct'}</td>
                        <td className="p-2">{lead.call_status || 'Pending'}</td>
                        <td className="p-2 text-right font-mono">{Number(lead.quoted_amount || 0).toFixed(3)}</td>
                        <td className="p-2 text-right font-mono text-purple-700 font-bold">{Number(lead.expected_profit || 0).toFixed(3)}</td>
                        <td className="p-2 text-right font-mono">{Number(lead.total_amount || 0).toFixed(3)}</td>
                        <td className="p-2 text-right font-mono font-black text-emerald-800">{Number(lead.profit || 0).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeReport === 'accounts' && (
              <div className="space-y-6">
                {/* Payment Mode breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-zinc-600 tracking-wider mb-2">Collection by Payment Mode</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(salesSummary.paymentModes).map(([mode, s]) => {
                      if (s.count === 0) return null;
                      return (
                        <div key={mode} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase block">{mode}</span>
                          <span className="text-base font-black font-mono text-zinc-900">OMR {s.total.toFixed(3)}</span>
                          <span className="text-[10px] text-zinc-500 block">{s.count} transactions</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Won Deals Ledger */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-zinc-200">
                    <thead className="bg-zinc-100 text-[10px] font-bold uppercase text-zinc-700 border-b border-zinc-200">
                      <tr>
                        <th className="p-2">Won Date</th>
                        <th className="p-2">Client</th>
                        <th className="p-2">Rep</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2 text-right">Sale Amount (OMR)</th>
                        <th className="p-2 text-right">Govt Fee (OMR)</th>
                        <th className="p-2 text-right font-black">Net Profit (OMR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-[11px]">
                      {filteredData.filter(l => l.status === 'converted' || (l.total_amount || 0) > 0).map(l => (
                        <tr key={l.id} className="hover:bg-zinc-50">
                          <td className="p-2 text-zinc-600">{l.conversion_date || '—'}</td>
                          <td className="p-2 font-bold text-zinc-900">{l.contact_name}</td>
                          <td className="p-2 text-zinc-700">{l.assigned_to_profile?.full_name || '—'}</td>
                          <td className="p-2 font-bold uppercase text-zinc-700">{l.payment_mode || 'cash'}</td>
                          <td className="p-2 text-right font-mono font-bold">{Number(l.total_amount || 0).toFixed(3)}</td>
                          <td className="p-2 text-right font-mono text-zinc-500">{Number(l.govt_fee || 0).toFixed(3)}</td>
                          <td className="p-2 text-right font-mono font-black text-emerald-800">{Number(l.profit || 0).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'marketing' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-zinc-200">
                  <thead className="bg-zinc-100 text-[10px] font-bold uppercase text-zinc-700 border-b border-zinc-200">
                    <tr>
                      <th className="p-2.5">Acquisition Source / Channel</th>
                      <th className="p-2.5 text-center">Total Inquiries</th>
                      <th className="p-2.5 text-center">Won Deals</th>
                      <th className="p-2.5 text-center">Conversion Rate</th>
                      <th className="p-2.5 text-right">Revenue (OMR)</th>
                      <th className="p-2.5 text-right font-black">Net Profit (OMR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-[11px]">
                    {salesSummary.sourceStats.map(s => {
                      const rate = s.inquiries > 0 ? ((s.won / s.inquiries) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={s.name} className="hover:bg-zinc-50">
                          <td className="p-2.5 font-bold text-zinc-900">{s.name}</td>
                          <td className="p-2.5 text-center font-mono">{s.inquiries}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-800">{s.won}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{rate}%</td>
                          <td className="p-2.5 text-right font-mono font-bold">{s.revenue.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-mono font-black text-emerald-800">{s.profit.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Document Footer Sign-off */}
            <div className="mt-8 pt-6 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-zinc-500" />
                <span>Verified System Ledger • OSBIC Management Portal</span>
              </div>
              <div>
                <span>Page 1 of 1 • Internal Business Document</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
