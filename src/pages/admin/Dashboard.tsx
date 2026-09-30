import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown,
  Briefcase, UserCheck, AlertCircle,
  ChevronRight, Trophy,
  Wallet, Zap, Globe, Building2, Handshake, FileText
} from 'lucide-react';
import {
  useAdminDashboardStats,
  useRevenueChart,
  useRecentJobs,
  useTopEmployees,
  useJobDistribution,
  useSalesLeaderboard,
  useAdminB2BStats
} from '../../hooks/admin/useAdminDashboard';
import { useAdminLeads } from '../../hooks/shared/useLeads';
import Skeleton from '../../components/ui/Skeleton';
import ExpiryAlerts from '../../components/admin/analytics/ExpiryAlerts';
import ApprovalHub from '../../components/admin/ApprovalHub';
import PulseFeed from '../../components/admin/PulseFeed';
import FinanceHealthMatrix from '../../components/admin/analytics/FinanceHealthMatrix';
import { useTranslation } from 'react-i18next';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useBranch } from '../../contexts/BranchContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DASHBOARD_COLORS = ['#D4AF37', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active: 'text-blue-600 dark:text-blue-400 ring-blue-500/20 bg-blue-500/10',
    completed: 'text-emerald-600 dark:text-emerald-400 ring-emerald-500/20 bg-emerald-500/10',
    on_hold: 'text-amber-600 dark:text-amber-400 ring-amber-500/20 bg-amber-500/10',
    cancelled: 'text-red-600 dark:text-red-400 ring-red-500/20 bg-red-500/10',
  };
  return (
    <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase ring-1 ring-inset', map[status] ?? 'text-slate-400 ring-slate-400/30 bg-slate-400/10')}>
      {status.replace('_', ' ')}
    </span>
  );
};

const Dashboard = () => {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const { selectedBranchId, selectedBranch } = useBranch();

  const { data: stats, isLoading: statsLoading } = useAdminDashboardStats(selectedBranchId);
  const { data: revenue } = useRevenueChart(selectedBranchId);
  const { data: distribution } = useJobDistribution(selectedBranchId);
  const { data: recentJobs, isLoading: jobsLoading } = useRecentJobs(selectedBranchId);
  const [thisMonthOnly, setThisMonthOnly] = useState(true);
  const { data: employees, isLoading: employeesLoading } = useTopEmployees(selectedBranchId, thisMonthOnly);
  const { data: salesLeaderboard } = useSalesLeaderboard(selectedBranchId);
  const { data: b2bStats } = useAdminB2BStats();
  
  const { useAllLeadsList } = useAdminLeads();
  const { data: leads } = useAllLeadsList();

  const branchLeads = (leads || []).filter(lead => {
    if (selectedBranchId) {
      return lead.assigned_to_profile?.branch_id === selectedBranchId || !lead.assigned_to;
    }
    return true;
  });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: stats ? `OMR ${stats.totalRevenue.toLocaleString()}` : '—',
      icon: Wallet,
      iconBg: 'bg-primary/10 border-primary/20 text-primary',
      change: stats?.revenueChange,
    },
    {
      label: 'Active Jobs',
      value: stats?.activeJobs ?? '—',
      icon: Briefcase,
      iconBg: 'bg-accent/10 border-accent/20 text-accent',
      change: stats?.jobsChange,
    },
    {
      label: 'Total Clients',
      value: stats?.totalClients ?? '—',
      icon: UserCheck,
      iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
      change: stats?.clientsChange,
    },
    {
      label: 'Pending Actions',
      value: stats?.pendingActions ?? '—',
      icon: AlertCircle,
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
      change: stats?.actionsChange,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-16"
    >
      {/* Branch filter banner */}
      {selectedBranch && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <span className="text-xs font-bold text-primary font-mono">{selectedBranch.code}</span>
          </div>
          <div>
            <p className="text-xs font-bold text-primary">Viewing Branch: {selectedBranch.name}</p>
            <p className="text-[10px] text-muted-foreground">All stats and data below are filtered to this branch only</p>
          </div>
        </div>
      )}

      {/* ── Row 1: KPI Cards ────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpiCards.map((card) => (
          <motion.div
            key={card.label}
            variants={item}
            whileHover={{ scale: 1.015 }}
            className="relative overflow-hidden bg-card border border-border rounded-2xl p-6 shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{card.label}</p>
                {statsLoading ? (
                  <Skeleton height={32} width={120} className="mt-2" />
                ) : (
                  <h3 className="text-2xl font-bold font-mono text-foreground">{card.value}</h3>
                )}
              </div>
              <div className={cn('p-3 rounded-xl border', card.iconBg)}>
                <card.icon size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {card.change !== undefined && !statsLoading && (
                <span className={cn('flex items-center text-xs font-bold', card.change >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {card.change >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                  {Math.abs(card.change)}%
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/50">vs last month</span>
            </div>
            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </motion.div>
        ))}
      </section>

      {/* ── Row 2: Charts ───────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Financial Intelligence - High Visibility Bar Chart */}
        <motion.div variants={item} className="xl:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-syne font-bold text-foreground">Financial Intelligence</h4>
              <p className="text-sm text-muted-foreground">Revenue Stream vs. Official Fees (Last 6 Months)</p>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={revenue ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.1)' }}
                  wrapperStyle={{ zIndex: 50, outline: 'none' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: '12px 18px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        minWidth: 180,
                      }}>
                        <p style={{ color: 'var(--foreground)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</p>
                        {payload.map((entry: any) => (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.fill, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}>{entry.name}:</span>
                            <span style={{ color: 'var(--foreground)', fontSize: 12, fontWeight: 700 }}>{entry.value?.toLocaleString()} OMR</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                <Bar dataKey="service" name="Agency Revenue" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="ministry" name="Ministry Fees" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Operational Breakdown - Donut Chart */}
        <motion.div variants={item} className="xl:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
          <h4 className="text-lg font-syne font-bold text-foreground mb-1">Operational Mix</h4>
          <p className="text-xs text-muted-foreground mb-6">Real-time Job Status Distribution</p>
          
          <div className="flex-1 w-full min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%" minWidth={0}>
               <PieChart>
                 <Pie
                   data={distribution ?? []}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={8}
                   dataKey="value"
                   stroke="none"
                 >
                   {distribution?.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: 12, border: 'none', color: '#fff' }}
                 />
                 <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }} />
               </PieChart>
             </ResponsiveContainer>
          </div>
        </motion.div>
      </section>

      {/* ── Row 3: Jobs Table & Health Matrix ───────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <motion.div variants={item} className="xl:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-syne font-bold text-foreground">In-Flight Operations</h4>
            <Link to="/admin/jobs" className="text-xs text-primary flex items-center gap-1 hover:underline">
              All Jobs <ChevronRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  {['Job Code', 'Client', 'Service', 'Employee', 'Progress', 'Status'].map((h) => (
                    <th key={h} className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobsLoading
                  ? [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td colSpan={6} className="py-4"><Skeleton height={24} /></td>
                    </tr>
                  ))
                  : (recentJobs as any[])?.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/admin/jobs/${job.id}`)}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-4 font-mono text-primary text-sm">{job.job_code}</td>
                      <td className="py-4 text-foreground text-sm font-medium">{(job.client as any)?.full_name}</td>
                      <td className="py-4 text-muted-foreground text-sm">{isRtl ? (job.service as any)?.name_ar : (job.service as any)?.name_en}</td>
                      <td className="py-4 text-muted-foreground text-sm">{(job.employee as any)?.full_name}</td>
                      <td className="py-4 pr-8">
                        <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden border border-border">
                          <div className="h-full bg-accent rounded-full" style={{ width: '65%' }} />
                        </div>
                      </td>
                      <td className="py-4"><StatusBadge status={job.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Finance Health Matrix */}
        <motion.div variants={item} className="xl:col-span-4">
          <FinanceHealthMatrix branchId={selectedBranchId} />
        </motion.div>
      </section>



      {/* ── Row 3.5: CRM & Sales Funnel Summary ──────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Funnel & Conversion Stats */}
        <motion.div variants={item} className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm flex flex-col justify-between gap-6 xl:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
            <div className="space-y-1">
              <h4 className="text-lg font-syne font-bold text-foreground">CRM Sales Pipeline & Funnel</h4>
              <p className="text-muted-foreground text-xs">
                Track client acquisition. Open leads represent potential business managed by sales.
              </p>
            </div>
            <Link 
              to="/admin/leads"
              className="px-4 py-2 rounded-xl bg-primary text-[#0A0F1E] font-bold text-[10px] uppercase tracking-wider hover:bg-primary/95 transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10"
            >
              <Zap size={12} />
              <span>Open Leads Manager</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-1 gap-4">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Total Leads</span>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{branchLeads.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40">
                  <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block">Converted</span>
                  <p className="text-2xl font-bold font-mono text-emerald-500 mt-0.5">
                    {branchLeads.filter(l => l.status === 'converted').length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-primary/5 border border-gold/20">
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Conv. Rate</span>
                  <p className="text-2xl font-bold font-mono text-primary mt-0.5">
                    {branchLeads.length > 0 
                      ? Math.round((branchLeads.filter(l => l.status === 'converted').length / branchLeads.length) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Recharts Conversion Funnel */}
            <div className="md:col-span-2 h-[200px] flex items-center justify-center">
              {(() => {
                const funnelData = [
                  { name: '1. New', value: branchLeads.filter(l => l.status === 'new').length, fill: '#818CF8' },
                  { name: '2. Contacted', value: branchLeads.filter(l => l.status === 'contacted').length, fill: '#60A5FA' },
                  { name: '3. Quoted', value: branchLeads.filter(l => ['quoted', 'negotiating'].includes(l.status)).length, fill: '#34D399' },
                  { name: '4. Converted', value: branchLeads.filter(l => l.status === 'converted').length, fill: '#059669' },
                ];
                
                return (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart layout="vertical" data={funnelData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={9} width={80} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: '#131824', borderColor: '#1E293B', borderRadius: '12px' }}
                        labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                        {funnelData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        </motion.div>

        {/* Lead Source Insights */}
        <motion.div variants={item} className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm flex flex-col justify-between gap-6">
          <div className="border-b border-border/40 pb-4">
            <h4 className="text-base font-syne font-bold text-foreground">Lead Source ROI</h4>
            <p className="text-muted-foreground text-[10px]">Attribution & conversion rates by channel</p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {(() => {
              const counts: Record<string, { total: number; converted: number }> = {};
              branchLeads.forEach((l: any) => {
                const source = l.lead_sources?.name || 'Other';
                if (!counts[source]) counts[source] = { total: 0, converted: 0 };
                counts[source].total += 1;
                if (l.status === 'converted') counts[source].converted += 1;
              });

              const colors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];
              const sourceData = Object.entries(counts).map(([name, data], idx) => ({
                name,
                value: data.total,
                rate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
                fill: colors[idx % colors.length]
              })).sort((a, b) => b.value - a.value).slice(0, 4);

              if (sourceData.length === 0) {
                return <p className="text-xs text-muted-foreground italic text-center">No source data available</p>;
              }

              return (
                <div className="flex items-center justify-between gap-4">
                  <div className="w-[120px] h-[120px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={sourceData} innerRadius={35} outerRadius={50} paddingAngle={3} dataKey="value">
                          {sourceData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-[#131824] border border-border p-2.5 rounded-xl text-[9px] space-y-0.5">
                                  <p className="font-bold text-foreground">{data.name}</p>
                                  <p className="text-muted-foreground">Leads: {data.value}</p>
                                  <p className="text-primary font-bold">Conv: {data.rate}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {sourceData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                          <span className="text-muted-foreground truncate">{item.name}</span>
                        </div>
                        <span className="font-bold font-mono text-foreground shrink-0">{item.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </motion.div>
      </section>

      {/* ── Row 3.8: Saudi Arabia & GCC B2B Operations Hub ─────── */}
      <section className="bg-card border border-emerald-500/20 rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-6 bg-gradient-to-r from-emerald-500/5 via-card to-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <Globe size={20} />
            </div>
            <div>
              <h4 className="text-lg font-syne font-bold text-foreground flex items-center gap-2">
                Saudi Arabia & GCC B2B Operations Hub
              </h4>
              <p className="text-xs text-muted-foreground">
                Cross-border B2B partner management, Saudi ground execution subcontracting, and inbound setup metrics.
              </p>
            </div>
          </div>
          <Link
            to="/employee/saudi-b2b"
            className="px-4 py-2 rounded-xl bg-emerald-500 text-emerald-950 font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Building2 size={13} />
            <span>Open B2B Workspace</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-background border border-border space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block flex items-center gap-1">
              <Handshake size={12} className="text-emerald-500" /> B2B Partner Firms
            </span>
            <p className="text-2xl font-bold font-mono text-foreground">{b2bStats?.totalPartnersCount ?? 0}</p>
            <span className="text-[10px] text-emerald-500 font-bold">Verified Subcontractors</span>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block flex items-center gap-1">
              <Globe size={12} className="text-blue-500" /> Cross-Border Deals
            </span>
            <p className="text-2xl font-bold font-mono text-foreground">{b2bStats?.totalCrossBorderLeads ?? 0}</p>
            <span className="text-[10px] text-muted-foreground">
              Outbound: {b2bStats?.outboundCount ?? 0} | Inbound: {b2bStats?.inboundCount ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block flex items-center gap-1">
              <FileText size={12} className="text-primary" /> Strategic Proposals
            </span>
            <p className="text-2xl font-bold font-mono text-foreground">{b2bStats?.b2bProposalsCount ?? 0}</p>
            <span className="text-[10px] text-primary font-bold">B2B Proposal Models</span>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block flex items-center gap-1">
              <Wallet size={12} className="text-emerald-500" /> Proposal Vol. (SAR)
            </span>
            <p className="text-2xl font-bold font-mono text-emerald-500">{(b2bStats?.totalProposalValueSAR ?? 0).toLocaleString()} SAR</p>
            <span className="text-[10px] text-muted-foreground">Saudi Riyals Quoted</span>
          </div>
        </div>

        {/* Active B2B Partner Firms List Preview */}
        {b2bStats?.partners && b2bStats.partners.length > 0 && (
          <div className="bg-background/50 border border-border rounded-2xl p-4 overflow-x-auto">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Verified B2B Subcontractor Partners</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {b2bStats.partners.slice(0, 3).map((partner: any) => (
                <div key={partner.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">{partner.firm_name}</p>
                    <p className="text-[10px] text-muted-foreground">{partner.contact_person} • {partner.country}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 uppercase">
                    {partner.service_scope}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Sales Revenue Leaderboard Panel ── */}
      <section className="grid grid-cols-1 gap-6">
        <motion.div variants={item} className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm flex flex-col gap-6">
          <div className="border-b border-border/40 pb-4">
            <h4 className="text-base font-syne font-bold text-foreground flex items-center gap-2">
              <Trophy className="text-amber-400" size={20} />
              Sales Leaderboard
            </h4>
            <p className="text-muted-foreground text-xs">Fulfillment rankings based on closed revenue values</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {salesLeaderboard && salesLeaderboard.length > 0 ? (
              salesLeaderboard.map((emp, idx) => (
                <div key={emp.id} className="p-4 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{emp.full_name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase font-mono">{emp.employee_code || 'SALES'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-emerald-500">{Number(emp.total_revenue).toFixed(3)} OMR</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Revenue</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-6 col-span-4">No sales performance data recorded yet.</p>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Row 4: Approval Hub, Expiry Monitor & Efficiency Leaders ──────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <motion.div variants={item} className="xl:col-span-4 h-[500px]">
           <ApprovalHub />
        </motion.div>
        
        <motion.div variants={item} className="xl:col-span-4 h-[500px]">
           <ExpiryAlerts />
        </motion.div>

        {/* Efficiency Leaders (Top Employees) */}
        <motion.div variants={item} className="xl:col-span-4 bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm flex flex-col h-[500px]">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base font-syne font-bold text-foreground flex items-center gap-2">
              <Trophy className="text-amber-400" size={20} />
              Efficiency Leaders
            </h4>
            <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-xl">
              <button
                onClick={() => setThisMonthOnly(true)}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors ${
                  thisMonthOnly ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setThisMonthOnly(false)}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors ${
                  !thisMonthOnly ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {employeesLoading
              ? [1, 2, 3].map((i) => <Skeleton key={i} height={56} rounded="xl" />)
              : (() => {
                  const ranked = (employees as any[])?.filter(e => e.completed_count > 0) || [];
                  const zeros  = (employees as any[])?.filter(e => e.completed_count === 0) || [];
                  const list   = [...ranked, ...zeros];

                  if (list.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
                        <Trophy className="text-muted-foreground/30" size={32} />
                        <p className="text-sm text-muted-foreground">No completed jobs yet</p>
                        <p className="text-[10px] text-muted-foreground/50">{thisMonthOnly ? 'Switch to All Time to see historical data' : ''}</p>
                      </div>
                    );
                  }

                  return list.map((emp, idx) => (
                    <div key={emp.id} className={`flex items-center gap-4 group ${
                      emp.completed_count === 0 ? 'opacity-40' : ''
                    }`}>
                      {/* Avatar with rank badge */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden">
                          {emp.avatar_url
                            ? <img src={emp.avatar_url} className="w-full h-full object-cover" alt={emp.full_name} />
                            : <span className="text-muted-foreground font-bold text-sm">{emp.full_name?.[0]}</span>}
                        </div>
                        {idx < 3 && emp.completed_count > 0 && (
                          <div className={cn(
                            'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center border border-card',
                            idx === 0 ? 'bg-primary text-[#0A0F1E]' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-orange-400 text-orange-950'
                          )}>
                            <Trophy size={8} />
                          </div>
                        )}
                      </div>

                      {/* Name & code */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{emp.full_name}</p>
                        <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">{emp.employee_code ?? 'EMP'}</p>
                      </div>

                      {/* Count */}
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono leading-none ${
                          emp.completed_count > 0 ? 'text-foreground' : 'text-muted-foreground/40'
                        }`}>
                          {emp.completed_count}
                        </p>
                        <p className="text-[9px] text-muted-foreground/60 uppercase">Jobs</p>
                      </div>
                    </div>
                  ));
                })()
            }
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
};

export default Dashboard;
