import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Search, Filter, Download, DollarSign, 
  Building2, Calendar, FileText, ArrowUpRight, ArrowDownRight,
  RefreshCw, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useBranch } from '../../../contexts/BranchContext';
import { AccountsNavHeader } from '../../../components/employee/accounts/AccountsNavHeader';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Link } from 'react-router-dom';

export default function JobIncomeExpenses() {
  const { branches } = useBranch();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [timePreset, setTimePreset] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [marginFilter, setMarginFilter] = useState<'all' | 'high' | 'low'>('all');

  const { data: jobsReport = [], isLoading, refetch } = useQuery({
    queryKey: ['accounts_job_income_expenses', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('jobs')
        .select(`
          id, job_code, created_at, started_at, total_fee, work_fee, ministry_fee,
          client_pays_ministry_fee, advance_amount, remaining_amount, remaining_paid,
          status, branch_id,
          branch:branches!branch_id(name),
          client:profiles!client_id(full_name, company_name, phone, client_code),
          service:services!service_id(name_en, name_ar),
          job_services:job_services(
            id, service_name, work_fee, ministry_fee, gov_fee_actual_paid, gov_payment_status
          )
        `)
        .order('created_at', { ascending: false })
        .limit(300);

      if (selectedBranchId) {
        q = q.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await q;
      if (error) {
        console.warn('Could not fetch jobs for income expenses:', error);
        return [];
      }
      return data || [];
    }
  });

  // Calculate profitability metrics per job
  const processedJobs = useMemo(() => {
    return jobsReport.map((job: any) => {
      const clientPaysMin = job.client_pays_ministry_fee === true;
      const totalBilled = Number(job.total_fee) || (Number(job.work_fee || 0) + Number(job.ministry_fee || 0));
      const estGovFee = Number(job.ministry_fee) || 0;
      const workFee = Number(job.work_fee) || Math.max(0, totalBilled - estGovFee);

      // Sum actual gov fees paid across job_services if recorded, else use estGovFee if marked paid
      const actualGovPaid = (job.job_services || []).reduce((sum: number, js: any) => {
        return sum + (Number(js.gov_fee_actual_paid) || 0);
      }, 0);

      const finalGovCost = actualGovPaid > 0 ? actualGovPaid : (clientPaysMin ? 0 : estGovFee);
      const netProfit = clientPaysMin ? workFee : Math.max(0, totalBilled - finalGovCost);
      const marginPct = totalBilled > 0 ? (netProfit / totalBilled) * 100 : 0;

      const dateStr = (job.created_at || '').split('T')[0] || format(new Date(), 'yyyy-MM-dd');

      return {
        ...job,
        dateStr,
        totalBilled,
        estGovFee,
        workFee,
        actualGovPaid,
        netProfit,
        marginPct,
        clientPaysMin
      };
    });
  }, [jobsReport]);

  // Filtered List
  const filteredJobs = useMemo(() => {
    const now = new Date();
    return processedJobs.filter(job => {
      // Branch filter
      if (selectedBranchId && job.branch_id !== selectedBranchId) return false;

      // Time preset
      if (timePreset === 'today') {
        const todayStr = format(now, 'yyyy-MM-dd');
        if (job.dateStr !== todayStr) return false;
      } else if (timePreset === 'week') {
        const start = startOfWeek(now, { weekStartsOn: 6 });
        const end = endOfWeek(now, { weekStartsOn: 6 });
        try {
          if (!isWithinInterval(parseISO(job.dateStr), { start, end })) return false;
        } catch { /* ignore */ }
      } else if (timePreset === 'month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        try {
          if (!isWithinInterval(parseISO(job.dateStr), { start, end })) return false;
        } catch { /* ignore */ }
      }

      // Margin filter
      if (marginFilter === 'high' && job.marginPct < 50) return false;
      if (marginFilter === 'low' && job.marginPct >= 50) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (job.client?.full_name || '').toLowerCase();
        const clientComp = (job.client?.company_name || '').toLowerCase();
        const code = (job.job_code || '').toLowerCase();
        const service = (job.service?.name_en || '').toLowerCase();
        if (!clientName.includes(q) && !clientComp.includes(q) && !code.includes(q) && !service.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [processedJobs, selectedBranchId, timePreset, marginFilter, searchQuery]);

  // Executive KPI Rollup
  const kpis = useMemo(() => {
    const totalBilled = filteredJobs.reduce((s, j) => s + j.totalBilled, 0);
    const totalGovEst = filteredJobs.reduce((s, j) => s + (j.clientPaysMin ? 0 : j.estGovFee), 0);
    const totalWorkRevenue = filteredJobs.reduce((s, j) => s + j.workFee, 0);
    const totalNetProfit = filteredJobs.reduce((s, j) => s + j.netProfit, 0);
    const avgMargin = totalBilled > 0 ? (totalNetProfit / totalBilled) * 100 : 0;

    return { totalBilled, totalGovEst, totalWorkRevenue, totalNetProfit, avgMargin };
  }, [filteredJobs]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Job Code', 'Client', 'Service', 'Total Billed (OMR)', 'Est Gov Fee', 'Office Work Fee', 'Net Profit', 'Margin %', 'Branch'];
    const rows = filteredJobs.map(j => [
      j.dateStr,
      j.job_code,
      `"${(j.client?.full_name || j.client?.company_name || 'Client').replace(/"/g, '""')}"`,
      `"${(j.service?.name_en || 'Service').replace(/"/g, '""')}"`,
      j.totalBilled.toFixed(3),
      j.estGovFee.toFixed(3),
      j.workFee.toFixed(3),
      j.netProfit.toFixed(3),
      j.marginPct.toFixed(1) + '%',
      `"${j.branch?.name || 'All'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `OSBIC_Job_Income_Expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Shared Nav Header */}
      <AccountsNavHeader
        title="Job-Level Income & Expenses"
        description="Detailed service-by-service profit analysis showing gross billing, ministry fees, office retainers, and net margins per client contract."
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      >
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all border border-border flex items-center gap-1.5"
        >
          <Download size={14} />
          <span>Export Report</span>
        </button>
      </AccountsNavHeader>

      {/* ─── Executive KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Value Billed</span>
            <DollarSign size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-mono font-black text-foreground">
            {kpis.totalBilled.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Across {filteredJobs.length} client jobs</p>
        </div>

        <div className="bg-card border border-blue-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-blue-500/[0.02]">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Gov & Ministry Outflows</span>
            <Building2 size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-blue-400">
            {kpis.totalGovEst.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Ministry card debits (MOCIIP, ROP, etc.)</p>
        </div>

        <div className="bg-card border border-emerald-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Net Office Profit</span>
            <TrendingUp size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-emerald-400">
            {kpis.totalNetProfit.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Retained office service income</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Average Job Margin</span>
            <span className="text-xs font-bold text-emerald-400">Target &gt; 50%</span>
          </div>
          <p className="text-3xl font-mono font-black text-foreground">
            {kpis.avgMargin.toFixed(1)} <span className="text-xs font-normal opacity-50">%</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Net profit as % of billed revenue</p>
        </div>
      </div>

      {/* ─── Filters & Search ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border/70 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Presets */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border text-xs">
            {(['today', 'week', 'month', 'all'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => setTimePreset(preset)}
                className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                  timePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Margin Filter */}
          <select
            value={marginFilter}
            onChange={e => setMarginFilter(e.target.value as any)}
            className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Profit Margins</option>
            <option value="high">High Margin (&ge; 50%)</option>
            <option value="low">Low Margin (&lt; 50%)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search job code, client, service..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* ─── Jobs Income Table ─── */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Service & Job Code</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total Billed</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Est Gov Fee</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Work Fee</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Net Profit</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Margin %</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Calculating job income and expenses...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    No jobs matching criteria for this timeframe.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-muted-foreground whitespace-nowrap">
                      {job.dateStr}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground text-sm">
                        {job.client?.full_name || 'Individual'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {job.client?.company_name || 'Private Client'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">
                        {job.service?.name_en || 'Service Delivery'}
                      </div>
                      <div className="font-mono text-primary text-[10px] font-bold flex items-center gap-1.5 mt-0.5">
                        <span>{job.job_code}</span>
                        {job.clientPaysMin && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Client Card Direct
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                      {job.totalBilled.toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                      {job.clientPaysMin ? (
                        <span className="line-through text-muted-foreground/50">{job.estGovFee.toFixed(3)}</span>
                      ) : (
                        job.estGovFee.toFixed(3)
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-primary font-bold">
                      {job.workFee.toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-400">
                      +{job.netProfit.toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black border ${
                        job.marginPct >= 60
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : job.marginPct >= 30
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {job.marginPct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Link
                        to={`/employee/tasks?jobId=${job.id}`}
                        className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px] font-bold"
                        title="Open Job File"
                      >
                        <ExternalLink size={12} />
                        <span>Ledger</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
