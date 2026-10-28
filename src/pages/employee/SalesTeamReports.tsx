import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, BarChart3, TrendingUp, DollarSign, FileText, CheckCircle2,
  Calendar, Search, Download, Printer, RefreshCw, X, ArrowUpRight,
  Shield, Award, Send, Phone, Mail, ExternalLink, Filter, Sparkles,
  ChevronRight, ArrowRight, Building2, HelpCircle, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useSalesTeamReports,
  type TimeframePreset,
  type RepPerformanceData
} from '../../hooks/employee/useSalesTeamReports';
import { useReactToPrint } from 'react-to-print';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function SalesTeamReports() {
  const { profile, role } = useAuth();
  const isSalesHead = Boolean(profile?.is_sales_head || profile?.is_manager || role === 'admin');

  // Filters
  const [timeframe, setTimeframe] = useState<TimeframePreset>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRep, setSelectedRep] = useState<RepPerformanceData | null>(null);
  const [activeRepTab, setActiveRepTab] = useState<'leads' | 'quotes' | 'sales'>('leads');

  // Fetch performance data
  const { data, isLoading, refetch, isRefetching } = useSalesTeamReports(
    timeframe,
    customStart,
    customEnd,
    profile?.branch_id
  );

  const reps = data?.reps || [];
  const summary = data?.summary;
  const dateLabel = data?.dateLabel || 'Selected Period';

  // Filtered reps by search
  const filteredReps = useMemo(() => {
    if (!searchQuery.trim()) return reps;
    const q = searchQuery.toLowerCase();
    return reps.filter(r =>
      r.fullName.toLowerCase().includes(q) ||
      (r.employeeCode && r.employeeCode.toLowerCase().includes(q)) ||
      r.email.toLowerCase().includes(q)
    );
  }, [reps, searchQuery]);

  // Printable document ref
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `OSBIC_SALES_TEAM_REPORT_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredReps.length) {
      toast.error('No data available to export');
      return;
    }

    const headers = [
      'Employee Code',
      'Representative Name',
      'Role',
      'Branch',
      'Total Leads',
      'New Leads',
      'Quoted Leads',
      'Won Leads',
      'Lost Leads',
      'Conversion Rate (%)',
      'Quotes Count',
      'Total Quoted Amount (OMR)',
      'Won Sales Count',
      'Won Revenue (OMR)',
      'Govt Fees (OMR)',
      'Net Profit (OMR)',
      'Profit Margin (%)'
    ];

    const rows = filteredReps.map(r => [
      r.employeeCode || '',
      `"${r.fullName}"`,
      r.isSalesHead ? 'Sales Head' : r.canAssignLeads ? 'Coordinator' : 'Sales Representative',
      `"${r.branchName}"`,
      r.totalLeads,
      r.newLeads,
      r.quotedLeads,
      r.wonLeads,
      r.lostLeads,
      `${r.conversionRate}%`,
      r.quotesCount,
      r.totalQuotedAmount.toFixed(3),
      r.wonSalesCount,
      r.wonRevenue.toFixed(3),
      r.govtFeesTotal.toFixed(3),
      r.netProfit.toFixed(3),
      `${r.profitMargin}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Sales_Team_Performance_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales report exported to CSV successfully');
  };

  // WhatsApp link generator with Oman +968 formatting
  const getWhatsAppUrl = (phone?: string | null, name?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 8 && (clean.startsWith('9') || clean.startsWith('7'))) {
      clean = '968' + clean;
    }
    const msg = encodeURIComponent(`Hello ${name || 'there'}, following up from OSBIC International regarding your business inquiry.`);
    return `https://api.whatsapp.com/send?phone=${clean}&text=${msg}`;
  };

  // Access Guard for Non-Sales Head
  if (!isSalesHead) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground">Sales Leadership Access Required</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          This comprehensive team analytics page is reserved for employees with the <strong>Sales Head</strong> role or branch management privileges.
        </p>
        <Link
          to="/employee/leads"
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <span>Return to My Leads & Sales</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* ── 1. HEADER SECTION ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shadow-sm">
              <Award size={13} />
              <span>Sales Head Intelligence</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium">OSBIC International</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-2 flex items-center gap-3">
            <span>Sales Team Performance & Reports</span>
            <span className="text-sm font-normal text-muted-foreground hidden sm:inline">
              ({filteredReps.length} Sales Consultants)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Live executive analytics tracking each sales consultant's leads pipeline, quotation conversions, won sales revenue, and net profit contribution.
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 text-xs font-medium"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={isRefetching ? 'animate-spin text-primary' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <Download size={15} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>

          <Link
            to="/employee/leads"
            className="px-3.5 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <span>Active Pipeline</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── 2. TIMEFRAME & CONTROLS RIBBON ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm">
        {/* Preset Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
          {(['today', 'week', 'month', 'quarter', 'year', 'all', 'custom'] as TimeframePreset[]).map(t => {
            const labels: Record<TimeframePreset, string> = {
              today: 'Today',
              week: 'This Week',
              month: 'This Month',
              quarter: 'Quarter',
              year: 'This Year',
              all: 'All Time',
              custom: 'Custom Range',
            };
            const isActive = timeframe === t;
            return (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Custom Date Pickers (if custom chosen) */}
        {timeframe === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-muted/50 border border-border text-foreground text-xs rounded-xl px-3 py-1.5 outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-muted/50 border border-border text-foreground text-xs rounded-xl px-3 py-1.5 outline-none focus:border-primary"
            />
          </div>
        )}

        {/* Search Rep */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search consultant name or code..."
            className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* ── 3. EXECUTIVE KPI METRICS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Leads */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Leads Handled</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {isLoading ? '...' : (summary?.totalLeads || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="text-emerald-400 font-bold">{summary?.totalWonLeads || 0} won</span>
              <span>•</span>
              <span className="text-amber-400">{summary?.totalNewLeads || 0} new</span>
            </div>
          </div>
        </div>

        {/* Quoted Pipeline */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quoted Pipeline</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {isLoading ? '...' : `${(summary?.totalQuotedAmount || 0).toFixed(3)}`}
              <span className="text-xs font-semibold text-muted-foreground ml-1">OMR</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="text-blue-400 font-bold">{summary?.totalQuotesCount || 0} quotes</span>
              <span>issued across team</span>
            </div>
          </div>
        </div>

        {/* Won Gross Revenue */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Closed Won Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {isLoading ? '...' : `${(summary?.totalWonRevenue || 0).toFixed(3)}`}
              <span className="text-xs font-semibold text-muted-foreground ml-1">OMR</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span>Gov fees:</span>
              <span className="font-semibold text-foreground">{(summary?.totalGovtFees || 0).toFixed(3)} OMR</span>
            </div>
          </div>
        </div>

        {/* Net Profit Margin */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net Profit</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {isLoading ? '...' : `${(summary?.totalNetProfit || 0).toFixed(3)}`}
              <span className="text-xs font-semibold text-muted-foreground ml-1">OMR</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="text-purple-400 font-bold">{summary?.overallProfitMargin || 0}%</span>
              <span>net profit margin</span>
            </div>
          </div>
        </div>

        {/* Team Conversion Rate */}
        <div className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {isLoading ? '...' : `${summary?.overallConversionRate || 0}%`}
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(summary?.overallConversionRate || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. TEAM LEADERBOARD & COMPARATIVE MATRIX ──────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span>Sales Consultants Matrix</span>
              <span className="text-xs font-normal text-muted-foreground">({dateLabel})</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparative breakdown showing every consultant's lead pipeline, quoting activity, sales closed, and profitability.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Click any consultant row to view full deal history & quotations
          </span>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-bold text-[10px] border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Sales Consultant</th>
                <th className="py-3.5 px-4 text-center">Leads Pipeline</th>
                <th className="py-3.5 px-4 text-center">Conversion</th>
                <th className="py-3.5 px-4 text-right">Quotes Issued</th>
                <th className="py-3.5 px-4 text-right">Won Revenue</th>
                <th className="py-3.5 px-4 text-right">Gov Fees</th>
                <th className="py-3.5 px-4 text-right">Net Profit</th>
                <th className="py-3.5 px-4 text-right">Margin</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RefreshCw size={24} className="animate-spin text-primary mx-auto mb-2" />
                    <span>Analyzing sales team records...</span>
                  </td>
                </tr>
              ) : filteredReps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    No sales consultant records found for this period.
                  </td>
                </tr>
              ) : (
                filteredReps.map((rep, idx) => {
                  const isTopRevenue = idx === 0 && rep.wonRevenue > 0;
                  const isRepSalesHead = rep.isSalesHead;

                  return (
                    <tr
                      key={rep.employeeId}
                      onClick={() => setSelectedRep(rep)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      {/* Consultant Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {rep.avatarUrl ? (
                              <img
                                src={rep.avatarUrl}
                                alt={rep.fullName}
                                className="w-9 h-9 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                                {rep.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            {isTopRevenue && (
                              <span className="absolute -top-1 -right-1 text-[10px]" title="Top Revenue Performer">
                                👑
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <span>{rep.fullName}</span>
                              {isRepSalesHead && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Head
                                </span>
                              )}
                              {rep.canAssignLeads && !isRepSalesHead && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Coordinator
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{rep.employeeCode || 'REP'}</span>
                              <span>•</span>
                              <span>{rep.branchName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leads Pipeline Breakdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-lg border border-border">
                          <span className="font-extrabold text-foreground">{rep.totalLeads}</span>
                          <span className="text-[10px] text-muted-foreground">total</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="font-semibold text-emerald-400">{rep.wonLeads} won</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="font-semibold text-amber-400">{rep.quotedLeads} quoted</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="font-semibold text-rose-400">{rep.lostLeads} lost</span>
                        </div>
                      </td>

                      {/* Conversion Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-md ${
                              rep.conversionRate >= 25
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : rep.conversionRate >= 10
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-muted/50 text-muted-foreground border border-border'
                            }`}
                          >
                            {rep.conversionRate}%
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {rep.wonSalesCount} closed deals
                          </span>
                        </div>
                      </td>

                      {/* Quotes Issued */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-foreground">
                          {rep.totalQuotedAmount.toFixed(3)}{' '}
                          <span className="text-[10px] font-normal text-muted-foreground">OMR</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {rep.quotesCount} quote{rep.quotesCount === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* Won Revenue */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-extrabold text-emerald-400 text-sm">
                          {rep.wonRevenue.toFixed(3)}{' '}
                          <span className="text-[10px] font-normal text-muted-foreground">OMR</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Avg: {rep.avgDealSize.toFixed(3)} OMR
                        </div>
                      </td>

                      {/* Gov Fees */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-muted-foreground font-medium">
                          {rep.govtFeesTotal.toFixed(3)}{' '}
                          <span className="text-[10px]">OMR</span>
                        </span>
                      </td>

                      {/* Net Profit */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-foreground">
                          {rep.netProfit.toFixed(3)}{' '}
                          <span className="text-[10px] font-normal text-muted-foreground">OMR</span>
                        </div>
                      </td>

                      {/* Profit Margin */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-purple-400">
                          {rep.profitMargin}%
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedRep(rep)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all flex items-center gap-1 mx-auto"
                        >
                          <span>Deep-Dive</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. REVENUE CONTRIBUTION & VISUAL COMPARISON ────────────────────── */}
      {filteredReps.length > 0 && summary && summary.totalWonRevenue > 0 && (
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              <span>Team Revenue Share & Conversion Distribution</span>
            </h3>
            <span className="text-xs text-muted-foreground">
              Total Won: <strong>{summary.totalWonRevenue.toFixed(3)} OMR</strong>
            </span>
          </div>

          {/* Stacked contribution bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/50 border border-border">
            {filteredReps
              .filter(r => r.wonRevenue > 0)
              .map((r, i) => {
                const colors = [
                  'bg-emerald-500',
                  'bg-blue-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-cyan-500',
                  'bg-rose-500',
                ];
                const pct = (r.wonRevenue / summary.totalWonRevenue) * 100;
                return (
                  <div
                    key={r.employeeId}
                    style={{ width: `${pct}%` }}
                    className={`${colors[i % colors.length]} h-full transition-all`}
                    title={`${r.fullName}: ${r.wonRevenue.toFixed(3)} OMR (${pct.toFixed(1)}%)`}
                  />
                );
              })}
          </div>

          {/* Consultant Share Legend */}
          <div className="flex flex-wrap gap-3 pt-1">
            {filteredReps
              .filter(r => r.wonRevenue > 0)
              .map((r, i) => {
                const dotColors = [
                  'bg-emerald-500',
                  'bg-blue-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-cyan-500',
                  'bg-rose-500',
                ];
                const pct = ((r.wonRevenue / summary.totalWonRevenue) * 100).toFixed(1);
                return (
                  <div key={r.employeeId} className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                    <span className="font-medium text-foreground">{r.fullName}:</span>
                    <span className="text-muted-foreground">{r.wonRevenue.toFixed(3)} OMR ({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── 6. REP DEEP-DIVE SLIDE-OVER DRAWER ──────────────────────────────── */}
      <AnimatePresence>
        {selectedRep && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRep(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {selectedRep.avatarUrl ? (
                      <img
                        src={selectedRep.avatarUrl}
                        alt={selectedRep.fullName}
                        className="w-12 h-12 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                        {selectedRep.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-foreground">{selectedRep.fullName}</h3>
                        {selectedRep.isSalesHead && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            👑 Sales Head
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{selectedRep.employeeCode || 'REP'}</span>
                        <span>•</span>
                        <span>{selectedRep.branchName}</span>
                        <span>•</span>
                        <span>{selectedRep.email}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedRep(null)}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Consultant KPI Pills */}
                <div className="grid grid-cols-3 gap-2.5 mt-5">
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Leads Won</span>
                    <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                      {selectedRep.wonLeads} / {selectedRep.totalLeads} ({selectedRep.conversionRate}%)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Won Revenue</span>
                    <p className="text-base font-extrabold text-foreground mt-0.5">
                      {selectedRep.wonRevenue.toFixed(3)} <span className="text-[10px]">OMR</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Net Margin</span>
                    <p className="text-base font-extrabold text-purple-400 mt-0.5">
                      {selectedRep.netProfit.toFixed(3)} <span className="text-[10px]">OMR</span>
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs */}
                <div className="flex items-center gap-2 mt-5 border-b border-border/50">
                  <button
                    onClick={() => setActiveRepTab('leads')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                      activeRepTab === 'leads'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Assigned Leads ({selectedRep.leads.length})
                  </button>
                  <button
                    onClick={() => setActiveRepTab('quotes')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                      activeRepTab === 'quotes'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Quotations ({selectedRep.quotations.length})
                  </button>
                  <button
                    onClick={() => setActiveRepTab('sales')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                      activeRepTab === 'sales'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Closed Sales ({selectedRep.sales.length})
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {/* 1. Leads List */}
                {activeRepTab === 'leads' && (
                  <div className="space-y-3">
                    {selectedRep.leads.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No leads assigned to this consultant during {dateLabel}.
                      </p>
                    ) : (
                      selectedRep.leads.map((l: any) => {
                        const isWon = l.status === 'converted' || Number(l.total_amount) > 0;
                        const quoted = Number(l.quoted_amount) || 0;

                        return (
                          <div
                            key={l.id}
                            className="p-3.5 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">{l.contact_name}</span>
                                {l.company_name && (
                                  <span className="text-[11px] text-muted-foreground">({l.company_name})</span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isWon
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      : l.status === 'new'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-muted text-muted-foreground border border-border'
                                  }`}
                                >
                                  {l.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{l.lead_sources?.name || 'Direct'}</span>
                                <span>•</span>
                                <span>{format(parseISO(l.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {quoted > 0 && (
                                <div className="text-right">
                                  <span className="text-[10px] text-muted-foreground block">Quoted</span>
                                  <span className="font-bold text-foreground">{quoted.toFixed(3)} OMR</span>
                                </div>
                              )}
                              {l.contact_phone && (
                                <a
                                  href={getWhatsAppUrl(l.contact_phone, l.contact_name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1 text-[11px] font-bold"
                                  title="Chat via WhatsApp"
                                >
                                  <Send size={12} />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. Quotations List */}
                {activeRepTab === 'quotes' && (
                  <div className="space-y-3">
                    {selectedRep.quotations.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No formal quotations issued during {dateLabel}.
                      </p>
                    ) : (
                      selectedRep.quotations.map((q: any) => (
                        <div
                          key={q.id}
                          className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{q.invoice_number || 'QUOTATION'}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {q.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Client: {q.client?.full_name || q.lead?.contact_name || 'Walk-in / Inquirer'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(parseISO(q.created_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-foreground text-sm">
                              {Number(q.total_amount || 0).toFixed(3)} OMR
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Sales List */}
                {activeRepTab === 'sales' && (
                  <div className="space-y-3">
                    {selectedRep.sales.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No closed sales recorded during {dateLabel}.
                      </p>
                    ) : (
                      selectedRep.sales.map((s: any, sIdx: number) => (
                        <div
                          key={s.id || sIdx}
                          className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{s.clientName}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Closed Sale
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {s.workType ? `Work: ${s.workType}` : s.companyName ? `Company: ${s.companyName}` : 'Service Sale'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(parseISO(s.date), 'dd MMM yyyy')}
                            </p>
                          </div>

                          <div className="text-right space-y-0.5">
                            <span className="font-extrabold text-emerald-400 text-sm block">
                              {s.amount.toFixed(3)} OMR
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              Profit: <strong className="text-foreground">{s.profit.toFixed(3)} OMR</strong>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 7. HIDDEN PRINTABLE TEMPLATE (For Executive Meetings) ─────────── */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-8 font-sans text-black bg-white" style={{ minWidth: '800px' }}>
          {/* Header */}
          <div className="border-b-2 border-amber-500 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-wider text-black">OSBIC INTERNATIONAL</h1>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                Executive Sales Team Performance Report • 👑 Sales Head
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Period: <strong>{dateLabel}</strong> • Generated on {format(new Date(), 'dd MMMM yyyy, hh:mm a')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded">
                Official OSBIC Intelligence
              </span>
            </div>
          </div>

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-4 gap-4 my-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Leads</p>
              <p className="text-xl font-black text-black">{summary?.totalLeads || 0}</p>
              <p className="text-[10px] text-gray-500">{summary?.totalWonLeads || 0} converted</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Quoted Pipeline</p>
              <p className="text-xl font-black text-black">{(summary?.totalQuotedAmount || 0).toFixed(3)} OMR</p>
              <p className="text-[10px] text-gray-500">{summary?.totalQuotesCount || 0} quotations</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Closed Sales Revenue</p>
              <p className="text-xl font-black text-emerald-700">{(summary?.totalWonRevenue || 0).toFixed(3)} OMR</p>
              <p className="text-[10px] text-gray-500">Gov Fees: {(summary?.totalGovtFees || 0).toFixed(3)} OMR</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Net Profit Margin</p>
              <p className="text-xl font-black text-purple-700">{(summary?.totalNetProfit || 0).toFixed(3)} OMR</p>
              <p className="text-[10px] text-gray-500">{summary?.overallProfitMargin || 0}% margin</p>
            </div>
          </div>

          {/* Leaderboard Table */}
          <table className="w-full text-left text-xs border border-gray-300">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
              <tr>
                <th className="p-2 border-r border-gray-300">Sales Consultant</th>
                <th className="p-2 text-center border-r border-gray-300">Leads (Won / Total)</th>
                <th className="p-2 text-center border-r border-gray-300">Conversion</th>
                <th className="p-2 text-right border-r border-gray-300">Quoted Amount</th>
                <th className="p-2 text-right border-r border-gray-300">Won Revenue</th>
                <th className="p-2 text-right border-r border-gray-300">Gov Fees</th>
                <th className="p-2 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReps.map(r => (
                <tr key={r.employeeId}>
                  <td className="p-2 font-bold border-r border-gray-300">
                    {r.fullName} ({r.employeeCode || 'REP'})
                  </td>
                  <td className="p-2 text-center border-r border-gray-300">
                    {r.wonLeads} / {r.totalLeads}
                  </td>
                  <td className="p-2 text-center font-bold border-r border-gray-300">
                    {r.conversionRate}%
                  </td>
                  <td className="p-2 text-right border-r border-gray-300">
                    {r.totalQuotedAmount.toFixed(3)} OMR
                  </td>
                  <td className="p-2 text-right font-bold text-emerald-800 border-r border-gray-300">
                    {r.wonRevenue.toFixed(3)} OMR
                  </td>
                  <td className="p-2 text-right border-r border-gray-300">
                    {r.govtFeesTotal.toFixed(3)} OMR
                  </td>
                  <td className="p-2 text-right font-bold">
                    {r.netProfit.toFixed(3)} OMR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500">
            <span>OSBIC INTERNATIONAL MANAGEMENT SYSTEM • CONFIDENTIAL SALES REPORT</span>
            <span>www.osbic.net</span>
          </div>
        </div>
      </div>
    </div>
  );
}
