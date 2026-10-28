import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, CheckCircle2, Clock, AlertTriangle, Layers,
  Search, Download, Printer, RefreshCw, X, ArrowUpRight,
  Shield, Send, Filter, ChevronRight, Building2, UserCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useOpsTeamReports,
  type OpsTimeframePreset,
  type OpsMemberPerformance
} from '../../hooks/employee/useOpsTeamReports';
import { useReactToPrint } from 'react-to-print';
import {
  format,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function OpsTeamReports() {
  const { profile, role } = useAuth();
  const isOpsHead = Boolean(
    (profile as any)?.is_ops_head ||
    profile?.is_manager ||
    profile?.role === 'admin' ||
    role === 'admin'
  );

  // Filters
  const [timeframe, setTimeframe] = useState<OpsTimeframePreset>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<OpsMemberPerformance | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'steps' | 'distributed' | 'completed'>('jobs');
  const [drawerDateFilter, setDrawerDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Fetch ops team data
  const { data, isLoading, refetch, isRefetching } = useOpsTeamReports(
    timeframe,
    customStart,
    customEnd,
    profile?.branch_id
  );

  const members = data?.members || [];
  const summary = data?.summary;
  const dateLabel = data?.dateLabel || 'Selected Period';

  // Filtered members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      m.fullName.toLowerCase().includes(q) ||
      (m.employeeCode && m.employeeCode.toLowerCase().includes(q)) ||
      m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  // Keep selected member synced with latest data
  const currentSelectedMember = useMemo(() => {
    if (!selectedMember) return null;
    return members.find(m => m.employeeId === selectedMember.employeeId) || selectedMember;
  }, [members, selectedMember]);

  // Date filter helper for drawer items
  const isDateInFilter = (dateStr?: string | null, filter: 'all' | 'today' | 'week' | 'month' = 'all') => {
    if (!dateStr || filter === 'all') return true;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const now = new Date();
      if (filter === 'today') {
        return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
      }
      if (filter === 'week') {
        return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
      }
      if (filter === 'month') {
        return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
      }
      return true;
    } catch {
      return true;
    }
  };

  // Drawer filtered lists
  const filteredActiveJobs = useMemo(() => {
    if (!currentSelectedMember) return [];
    return (currentSelectedMember.jobs || [])
      .filter(j => ['active', 'in_progress', 'pending', 'awaiting_govt', 'on_hold', 'review', 'draft'].includes(j.status))
      .filter(j => isDateInFilter(j.created_at, drawerDateFilter));
  }, [currentSelectedMember, drawerDateFilter]);

  const filteredSteps = useMemo(() => {
    if (!currentSelectedMember) return [];
    return (currentSelectedMember.steps || []).filter(s => isDateInFilter(s.created_at, drawerDateFilter));
  }, [currentSelectedMember, drawerDateFilter]);

  const filteredDistributedJobs = useMemo(() => {
    if (!currentSelectedMember) return [];
    return (currentSelectedMember.distributedJobs || []).filter(j => isDateInFilter(j.created_at, drawerDateFilter));
  }, [currentSelectedMember, drawerDateFilter]);

  const filteredCompletedJobs = useMemo(() => {
    if (!currentSelectedMember) return [];
    return (currentSelectedMember.jobs || [])
      .filter(j => j.status === 'completed')
      .filter(j => isDateInFilter(j.updated_at || j.created_at, drawerDateFilter));
  }, [currentSelectedMember, drawerDateFilter]);

  // Printable document ref
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `OSBIC_OPS_TEAM_REPORT_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredMembers.length) {
      toast.error('No operations data available to export');
      return;
    }

    const headers = [
      'Employee Code',
      'Name',
      'Branch',
      'Role',
      'Active Jobs',
      'Completed Jobs',
      'Blocked Jobs',
      'Overdue Jobs',
      'Completion Rate (%)',
      'Pending PRO Steps',
      'Govt Fees Disbursed (OMR)',
      'Service Volume (OMR)',
      'Capacity Status'
    ];

    const rows = filteredMembers.map(m => [
      m.employeeCode || '',
      `"${m.fullName}"`,
      `"${m.branchName}"`,
      m.isOpsHead ? 'Operations Head' : m.isPro ? 'PRO Agent' : 'Operations Specialist',
      m.activeJobs,
      m.completedJobs,
      m.blockedJobs,
      m.overdueJobs,
      `${m.completionRate}%`,
      m.pendingSteps,
      m.govtFeesTotal.toFixed(3),
      m.totalServiceRevenue.toFixed(3),
      m.capacityStatus
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Operations_Team_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Operations report exported to CSV successfully');
  };

  // WhatsApp link generator with Oman +968 formatting
  const getWhatsAppUrl = (phone?: string | null, name?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 8 && (clean.startsWith('9') || clean.startsWith('7'))) {
      clean = '968' + clean;
    }
    const msg = encodeURIComponent(`Hello ${name || 'there'}, following up from OSBIC International regarding your business application.`);
    return `https://api.whatsapp.com/send?phone=${clean}&text=${msg}`;
  };

  // Access Guard
  if (!isOpsHead) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground">Operations Leadership Access Required</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          This comprehensive operations hub is reserved for employees with the <strong>Operations Head (Ops Lead)</strong> role or branch management privileges.
        </p>
        <Link
          to="/employee"
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── 1. EXECUTIVE HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span>⚙️ Operations Head</span>
              <span>•</span>
              <span>{profile?.branch_id ? 'Branch Hub' : 'Executive Overview'}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Period: <strong className="text-foreground">{dateLabel}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-1">
            Operations Team Hub & Workload Analytics
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Real-time PRO tasks, client file statuses, workflow execution, and workload balance across branches.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin text-primary' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handlePrint()}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* ── 2. TIMEFRAME PRESET SELECTOR ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'quarter', label: 'This Quarter' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Operations' },
          ].map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setTimeframe(preset.id as OpsTimeframePreset);
                setCustomStart('');
                setCustomEnd('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                timeframe === preset.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search specialist or PRO..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* ── 3. OPS TEAM KPI SUMMARY CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Active Jobs */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Operations</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Briefcase size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {summary?.totalActiveJobs || 0}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              of {summary?.totalJobs || 0} total client jobs
            </span>
          </div>
        </div>

        {/* Completed Operations */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed Files</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {summary?.totalCompletedJobs || 0}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {summary?.overallCompletionRate || 0}% team completion
            </span>
          </div>
        </div>

        {/* Pending PRO Steps */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending PRO Steps</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-amber-400">
              {summary?.totalPendingSteps || 0}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              ministry & embassy tasks
            </span>
          </div>
        </div>

        {/* Works Assigned by Sales */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">From Sales Team</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-purple-400">
              {summary?.totalSalesAssignedJobs || 0}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              deals handed off by sales
            </span>
          </div>
        </div>

        {/* Govt Fees Handled */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Govt Fees Handled</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-foreground">
                {(summary?.totalGovtFees || 0).toFixed(3)}
              </span>
              <span className="text-xs font-bold text-muted-foreground">OMR</span>
            </div>
            <span className="text-xs text-muted-foreground block mt-0.5">
              disbursed via operations
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. OPERATIONS TEAM WORKLOAD TABLE ──────────────────────────────── */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <span>Operations Specialists & PRO Roster</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare active workload, PRO task queue, and turnaround speeds across team members.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Click any specialist row to view active jobs & steps
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-bold text-[10px] border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Specialist / PRO</th>
                <th className="py-3.5 px-4 text-center">Workload & Assignment Pipeline</th>
                <th className="py-3.5 px-4 text-center">Completion Rate</th>
                <th className="py-3.5 px-4 text-center">PRO Steps</th>
                <th className="py-3.5 px-4 text-right">Govt Fees Disbursed</th>
                <th className="py-3.5 px-4 text-center">Capacity</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw size={24} className="animate-spin text-primary mx-auto mb-2" />
                    <span>Analyzing operations team workload...</span>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No operations team records found for this period.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  return (
                    <tr
                      key={m.employeeId}
                      onClick={() => {
                        setSelectedMember(m);
                        setDrawerDateFilter('all');
                        setActiveTab('jobs');
                      }}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      {/* Specialist Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {m.avatarUrl ? (
                              <img
                                src={m.avatarUrl}
                                alt={m.fullName}
                                className="w-9 h-9 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                                {m.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <span>{m.fullName}</span>
                              {m.isOpsHead && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  ⚙️ Ops Head
                                </span>
                              )}
                              {m.isPro && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  PRO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>{m.employeeCode || 'OPS'}</span>
                              <span>•</span>
                              <span>{m.branchName}</span>
                              {m.distributedCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-400 font-semibold" title="Jobs delegated to teammates">
                                    ↗ {m.distributedCount} delegated
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Merged Workload Pipeline & Sources */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Active / Done / Blocked Pills */}
                          <div className="inline-flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border">
                            <span className="font-extrabold text-blue-400">{m.activeJobs} active</span>
                            <span className="text-muted-foreground/40">|</span>
                            <span className="font-semibold text-emerald-400">{m.completedJobs} done</span>
                            {m.blockedJobs > 0 && (
                              <>
                                <span className="text-muted-foreground/40">|</span>
                                <span className="font-semibold text-rose-400">{m.blockedJobs} blocked</span>
                              </>
                            )}
                            {m.overdueJobs > 0 && (
                              <>
                                <span className="text-muted-foreground/40">|</span>
                                <span className="font-bold text-rose-400 animate-pulse">{m.overdueJobs} overdue</span>
                              </>
                            )}
                          </div>

                          {/* Source Breakdown (Only counts, no sales person names) */}
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Assigned by sales team">
                              🎯 {m.salesAssignedJobsCount} from Sales
                            </span>
                            <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border" title="Direct walk-in / enquiry intake">
                              🏢 {m.directOpsJobsCount} Direct
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Completion Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-md ${
                              m.completionRate >= 75
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : m.completionRate >= 40
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-muted/50 text-muted-foreground border border-border'
                            }`}
                          >
                            {m.completionRate}%
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {m.completedJobs} of {m.totalJobs} jobs
                          </span>
                        </div>
                      </td>

                      {/* PRO Steps */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-foreground">
                          {m.pendingSteps} pending
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.completedSteps} cleared
                        </div>
                      </td>

                      {/* Govt Fees Disbursed */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-extrabold text-foreground text-sm">
                          {m.govtFeesTotal.toFixed(3)}{' '}
                          <span className="text-[10px] font-normal text-muted-foreground">OMR</span>
                        </div>
                      </td>

                      {/* Capacity Status */}
                      <td className="py-3.5 px-4 text-center">
                        {m.capacityStatus === 'optimal' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Optimal
                          </span>
                        )}
                        {m.capacityStatus === 'busy' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Busy
                          </span>
                        )}
                        {m.capacityStatus === 'overloaded' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Overloaded
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setDrawerDateFilter('all');
                            setActiveTab('jobs');
                          }}
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

      {/* ── 5. MEMBER DEEP-DIVE SLIDE-OVER DRAWER ─────────────────────────── */}
      <AnimatePresence>
        {currentSelectedMember && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-border bg-gradient-to-r from-emerald-500/5 to-transparent shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {currentSelectedMember.avatarUrl ? (
                      <img
                        src={currentSelectedMember.avatarUrl}
                        alt={currentSelectedMember.fullName}
                        className="w-12 h-12 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm">
                        {currentSelectedMember.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-foreground">{currentSelectedMember.fullName}</h3>
                        {currentSelectedMember.isOpsHead && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ⚙️ Ops Head
                          </span>
                        )}
                        {currentSelectedMember.isPro && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PRO
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{currentSelectedMember.employeeCode || 'OPS'}</span>
                        <span>•</span>
                        <span>{currentSelectedMember.branchName}</span>
                        <span>•</span>
                        <span>{currentSelectedMember.email}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* KPI Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Active Jobs</span>
                    <p className="text-base font-extrabold text-blue-400 mt-0.5">
                      {currentSelectedMember.activeJobs}
                    </p>
                    {currentSelectedMember.overdueJobs > 0 && (
                      <span className="text-[9px] text-rose-400 font-bold block mt-0.5">
                        {currentSelectedMember.overdueJobs} overdue
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Completed</span>
                    <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                      {currentSelectedMember.completedJobs} ({currentSelectedMember.completionRate}%)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">PRO Steps</span>
                    <p className="text-base font-extrabold text-amber-400 mt-0.5">
                      {currentSelectedMember.pendingSteps} pending
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Govt Fees</span>
                    <p className="text-base font-extrabold text-purple-400 mt-0.5">
                      {currentSelectedMember.govtFeesTotal.toFixed(3)} <span className="text-[10px]">OMR</span>
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs */}
                <div className="flex items-center gap-2 mt-5 border-b border-border/50 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setActiveTab('jobs')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                      activeTab === 'jobs'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Active Jobs ({filteredActiveJobs.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('steps')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                      activeTab === 'steps'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Workflow Steps ({filteredSteps.length})
                  </button>

                  {currentSelectedMember.distributedCount > 0 && (
                    <button
                      onClick={() => setActiveTab('distributed')}
                      className={`pb-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'distributed'
                          ? 'border-emerald-400 text-emerald-400'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>Delegated Jobs</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300">
                        {filteredDistributedJobs.length}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`pb-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                      activeTab === 'completed'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Completed ({filteredCompletedJobs.length})
                  </button>
                </div>

                {/* Quick Date Filters */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 mr-1">
                      <Filter size={11} className="text-muted-foreground" />
                      <span>Filter:</span>
                    </span>
                    {[
                      { id: 'all', label: 'All Period' },
                      { id: 'today', label: 'Today' },
                      { id: 'week', label: 'This Week' },
                      { id: 'month', label: 'This Month' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDrawerDateFilter(p.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          drawerDateFilter === p.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                    Showing {activeTab === 'jobs' ? filteredActiveJobs.length : activeTab === 'steps' ? filteredSteps.length : activeTab === 'distributed' ? filteredDistributedJobs.length : filteredCompletedJobs.length} {activeTab}
                  </span>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {/* 1. Active Jobs */}
                {activeTab === 'jobs' && (
                  <div className="space-y-3">
                    {filteredActiveJobs.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          No active jobs on desk for this period.
                        </p>
                      </div>
                    ) : (
                      filteredActiveJobs.map((j: any) => (
                        <div
                          key={j.id}
                          className="p-3.5 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-foreground text-sm">
                                {j.custom_name || j.service?.name_en || j.job_code || 'Service Job'}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                {j.job_code}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                j.status === 'in_progress'
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                  : j.status === 'review'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}>
                                {j.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>Client: <strong className="text-foreground">{j.client?.full_name || 'Walk-in'}</strong></span>
                              <span>•</span>
                              <span>{format(parseISO(j.created_at), 'dd MMM yyyy')}</span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                                <span>👤 Sales:</span>
                                <strong className="text-foreground">{j.salesRepName || 'Direct / Ops'}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {Number(j.govFee || j.actual_gov_fee) > 0 && (
                              <div className="text-right mr-1">
                                <span className="text-[10px] text-muted-foreground block">Gov Fee</span>
                                <span className="font-bold text-foreground">{Number(j.govFee || j.actual_gov_fee).toFixed(3)} OMR</span>
                              </div>
                            )}
                            {Number(j.serviceFee || j.total_fee) > 0 && (
                              <div className="text-right mr-1">
                                <span className="text-[10px] text-muted-foreground block">Service Fee</span>
                                <span className="font-bold text-emerald-400">{Number(j.serviceFee || j.total_fee).toFixed(3)} OMR</span>
                              </div>
                            )}
                            {j.client?.phone && (
                              <a
                                href={getWhatsAppUrl(j.client.phone, j.client.full_name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Send size={12} />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 2. Workflow Steps */}
                {activeTab === 'steps' && (
                  <div className="space-y-3">
                    {filteredSteps.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <Clock className="w-8 h-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          No workflow steps assigned during this timeframe.
                        </p>
                      </div>
                    ) : (
                      filteredSteps.map((s: any) => (
                        <div
                          key={s.id}
                          className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{s.custom_name || 'Workflow Task'}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}>
                                {s.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              File: {s.job?.custom_name || s.job?.job_code} • Client: {s.job?.client?.full_name || 'Client'}
                            </p>
                          </div>
                          {s.deadline && (
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground block">Deadline</span>
                              <span className="font-bold text-foreground">{format(parseISO(s.deadline), 'dd MMM yyyy')}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Delegated Jobs */}
                {activeTab === 'distributed' && (
                  <div className="space-y-3">
                    {filteredDistributedJobs.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <UserCheck className="w-8 h-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          No operations delegated to other team members.
                        </p>
                      </div>
                    ) : (
                      filteredDistributedJobs.map((j: any) => (
                        <div
                          key={j.id}
                          className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">{j.custom_name || j.service?.name_en || j.job_code}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                              {j.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                            <span className="text-muted-foreground">
                              Assigned to: <strong className="text-foreground">{j.assignedToName}</strong> {j.assignedToCode && `(${j.assignedToCode})`}
                            </span>
                            <span>{format(parseISO(j.created_at), 'dd MMM yyyy')}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. Completed History */}
                {activeTab === 'completed' && (
                  <div className="space-y-3">
                    {filteredCompletedJobs.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          No completed operations during this period.
                        </p>
                      </div>
                    ) : (
                      filteredCompletedJobs.map((j: any) => (
                        <div
                          key={j.id}
                          className="p-3.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-foreground">{j.custom_name || j.service?.name_en || j.job_code}</span>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>Client: <strong className="text-foreground">{j.client?.full_name || 'Client'}</strong></span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-purple-400 font-semibold">
                                <span>👤 Sales:</span>
                                <strong className="text-foreground">{j.salesRepName || 'Direct / Ops'}</strong>
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Completed
                          </span>
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

      {/* ── 6. HIDDEN PRINTABLE TEMPLATE (For Executive Ops Meetings) ───────── */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-8 font-sans text-black bg-white" style={{ minWidth: '800px' }}>
          <div className="border-b-2 border-emerald-500 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-wider text-black">OSBIC INTERNATIONAL</h1>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                Executive Operations & Workload Report • ⚙️ Ops Lead
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Period: <strong>{dateLabel}</strong> • Generated on {format(new Date(), 'dd MMMM yyyy, hh:mm a')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded">
                Official Operations Intelligence
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 my-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Active Files</p>
              <p className="text-xl font-black text-black">{summary?.totalActiveJobs || 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Completed Operations</p>
              <p className="text-xl font-black text-emerald-700">{summary?.totalCompletedJobs || 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Pending Steps</p>
              <p className="text-xl font-black text-amber-700">{summary?.totalPendingSteps || 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Govt Fees Cleared</p>
              <p className="text-xl font-black text-purple-700">{(summary?.totalGovtFees || 0).toFixed(3)} OMR</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border border-gray-300">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
              <tr>
                <th className="p-2 border-r border-gray-300">Specialist</th>
                <th className="p-2 text-center border-r border-gray-300">Active Workload</th>
                <th className="p-2 text-center border-r border-gray-300">Completion %</th>
                <th className="p-2 text-center border-r border-gray-300">Pending Steps</th>
                <th className="p-2 text-right">Govt Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMembers.map(m => (
                <tr key={m.employeeId}>
                  <td className="p-2 border-r border-gray-200 font-bold">{m.fullName} ({m.employeeCode})</td>
                  <td className="p-2 text-center border-r border-gray-200">{m.activeJobs} active / {m.completedJobs} done</td>
                  <td className="p-2 text-center border-r border-gray-200 font-bold">{m.completionRate}%</td>
                  <td className="p-2 text-center border-r border-gray-200">{m.pendingSteps}</td>
                  <td className="p-2 text-right font-bold">{m.govtFeesTotal.toFixed(3)} OMR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
