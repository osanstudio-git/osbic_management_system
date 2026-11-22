import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, ShieldCheck, CheckCircle2, Clock, AlertTriangle, FileText,
  DollarSign, Building2, User, ArrowRight, Upload, ExternalLink,
  ChevronRight, Lock, Sparkles, AlertCircle, RefreshCw,
  Calendar, Search, Filter, MessageSquare, Phone, Plus, X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { AddMigrateJobModal } from '../../components/employee/AddMigrateJobModal';
import { GoldenVisaCommandCenter } from '../../components/employee/GoldenVisaCommandCenter';

export default function GoldenVisaDesk() {
  const [timePreset, setTimePreset] = useState<'all' | 'month' | 'week' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inspectedJob, setInspectedJob] = useState<any | null>(null);

  // Fetch Golden Visa files
  const { data: goldenJobs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['golden_visa_desk_jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name, company_name, phone, whatsapp, email, nationality),
          branch:branches!branch_id(name),
          sales_rep:profiles!sales_employee_id(full_name, branch_id, branches:branch_id(name)),
          ops_rep:profiles!ops_employee_id(full_name)
        `)
        .or('migrate_category.eq.golden_visa,golden_route.not.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fallback fetching golden jobs:', error);
        const { data: fallback } = await supabase
          .from('jobs')
          .select(`
            *,
            client:profiles!client_id(full_name, company_name, phone, whatsapp, email, nationality),
            service:services!service_id(name_en)
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        return (fallback || []).filter((j: any) =>
          j.migrate_category === 'golden_visa' ||
          j.golden_route ||
          (j.service?.name_en || '').toLowerCase().includes('golden')
        );
      }

      return data || [];
    }
  });

  const openWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('Invalid phone number');
      return;
    }
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length === 8) cleanPhone = '968' + cleanPhone;
    else if (cleanPhone.length === 9 && cleanPhone.startsWith('0')) cleanPhone = '968' + cleanPhone.slice(1);

    const message = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from OSBIC Golden Visa Private Wealth Desk.`);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleUpdateJobField = async (jobId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
      toast.success('Updated');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return goldenJobs.filter((job: any) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (job.client?.full_name || '').toLowerCase();
        const jobCode = (job.job_code || '').toLowerCase();
        const route = (job.golden_route || '').toLowerCase();
        const nationality = (job.client?.nationality || '').toLowerCase();
        if (!clientName.includes(query) && !jobCode.includes(query) && !route.includes(query) && !nationality.includes(query)) {
          return false;
        }
      }

      // Stage filter
      if (stageFilter === 'stage1' && job.golden_approval_status === 'approved') return false;
      if (stageFilter === 'stage2' && !job.advance_paid) return false;
      if (stageFilter === 'stage3' && job.golden_approval_status !== 'approved') return false;
      if (stageFilter === 'stage4' && job.id_card_status !== 'issued') return false;

      // Timeframe
      if (timePreset === 'all') return true;
      const created = new Date(job.created_at);
      const now = new Date();
      if (timePreset === 'today') return created.toDateString() === now.toDateString();
      if (timePreset === 'week') {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        return created >= start && created <= end;
      }
      if (timePreset === 'month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        return created >= start && created <= end;
      }
      return true;
    });
  }, [goldenJobs, timePreset, searchQuery, stageFilter]);

  // High-level KPIs
  const totalBilled = filteredJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);
  const totalCollected = filteredJobs.reduce((sum, j) => sum + (Number(j.advance_amount) || 0), 0);
  const totalOutstanding = filteredJobs.reduce((sum, j) => sum + Math.max(0, Number(j.remaining_amount) || 0), 0);
  const govApprovedCount = filteredJobs.filter(j => j.golden_approval_status === 'approved').length;
  const idCardsIssuedCount = filteredJobs.filter(j => j.id_card_status === 'issued').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 p-6 sm:p-8 border border-amber-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/40 shadow-lg shrink-0">
              <Crown size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  INVEST OMAN EXECUTIVE PROGRAM
                </span>
                <span className="text-xs text-muted-foreground">10-Year Investor Residency Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-syne font-bold text-white mt-1">
                Golden Visa Investor Desk
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                High-net-worth investor onboarding, qualifying asset audits, Invest Oman VIP submissions, and 10-year residency ID issuance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg hover:shadow-amber-400/25 transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>+ New Investor File</span>
            </button>

            <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl flex items-center gap-1 text-xs border border-white/10">
              {(['all', 'month', 'week', 'today'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => setTimePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all font-semibold ${
                    timePreset === preset
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {preset === 'all' ? 'All Time' : preset}
                </button>
              ))}
            </div>

            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 4 Golden KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-amber-500/20">
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Volume Billed</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-amber-400 mt-0.5 block">
              {totalBilled.toFixed(3)} <span className="text-xs font-normal opacity-60">OMR</span>
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Collected: {totalCollected.toFixed(3)} OMR
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Investor Cases</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-white mt-0.5 block">
              {filteredJobs.length}
            </span>
            <span className="text-[10px] text-amber-300 font-semibold mt-1 block">
              Due: {totalOutstanding.toFixed(3)} OMR
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Gov Approval (MOCIIP)</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 mt-0.5 block">
              {govApprovedCount} Files
            </span>
            <span className="text-[10px] text-emerald-300 font-semibold mt-1 block">
              Invest Oman Cleared
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">10-Yr ID Cards Issued</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-purple-300 mt-0.5 block">
              {idCardsIssuedCount} Investors
            </span>
            <span className="text-[10px] text-purple-300 font-semibold mt-1 block">
              Fully Resident
            </span>
          </div>
        </div>
      </div>

      {/* 4-Stage Investor Pipeline Funnel */}
      <div className="bg-card border border-amber-500/30 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Crown size={18} />
            <h2 className="font-syne font-bold text-foreground text-sm uppercase tracking-wider">
              Golden Visa 4-Stage Milestones
            </h2>
          </div>
          {stageFilter && (
            <button
              onClick={() => setStageFilter(null)}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <X size={12} /> Clear Stage Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'stage1',
              title: 'Stage 1: Intake & Assets Review',
              subtitle: 'Eligibility & Property/Capital audit',
              count: goldenJobs.filter((j: any) => !j.golden_approval_status || j.golden_approval_status === 'pending').length,
              color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
            },
            {
              id: 'stage2',
              title: 'Stage 2: 50% Upfront Deposit',
              subtitle: 'Retainer verified in accounts',
              count: goldenJobs.filter((j: any) => j.advance_paid).length,
              color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
            },
            {
              id: 'stage3',
              title: 'Stage 3: Invest Oman Approved',
              subtitle: 'Ministry review (1–3 days turnaround)',
              count: goldenJobs.filter((j: any) => j.golden_approval_status === 'approved').length,
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            },
            {
              id: 'stage4',
              title: 'Stage 4: 10-Yr Resident ID Issued',
              subtitle: 'Biometrics & Civil ID stamped',
              count: goldenJobs.filter((j: any) => j.id_card_status === 'issued').length,
              color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
            }
          ].map(stage => (
            <button
              key={stage.id}
              onClick={() => setStageFilter(stageFilter === stage.id ? null : stage.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                stageFilter === stage.id
                  ? 'border-amber-400 bg-amber-500/15 shadow-md'
                  : 'bg-background border-border hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">{stage.title}</span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${stage.color}`}>
                  {stage.count}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">{stage.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Investor Master Register Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">
              Investor Master Register ({filteredJobs.length} Files)
            </h3>
            {stageFilter && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                Filtered by {stageFilter.toUpperCase()}
              </span>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search investor, code, route, nationality..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-5 py-4">Job Code</th>
                <th className="px-5 py-4">Investor / Contact</th>
                <th className="px-5 py-4">Qualifying Route</th>
                <th className="px-5 py-4">Audit Status</th>
                <th className="px-5 py-4">Payment & Terms</th>
                <th className="px-5 py-4">Gov Review</th>
                <th className="px-5 py-4">10-Yr ID Card</th>
                <th className="px-5 py-4 text-right">Fee (OMR)</th>
                <th className="px-5 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                    No Golden Visa investor files found. Click <strong>"+ New Investor File"</strong> to onboard an investor.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job: any) => {
                  const isAuditExempt = job.golden_route && job.golden_route !== 'company_assets';

                  return (
                    <tr key={job.id} className="hover:bg-muted/15 transition-colors group">
                      <td className="px-5 py-4 font-mono font-bold text-amber-400">
                        {job.job_code}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">{job.client?.full_name || 'Investor'}</div>
                        <div className="text-[10px] text-muted-foreground">{job.client?.nationality || 'International'}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{job.client?.phone || '-'}</span>
                          {job.client?.phone && (
                            <>
                              <button
                                type="button"
                                onClick={() => openWhatsApp(job.client?.whatsapp || job.client?.phone, job.client?.full_name)}
                                className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                title="1-Click WhatsApp"
                              >
                                <MessageSquare size={11} />
                              </button>
                              <a
                                href={`tel:${job.client?.phone}`}
                                className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                title="Call Investor"
                              >
                                <Phone size={11} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="capitalize font-semibold text-foreground">
                          {job.golden_route ? job.golden_route.replace(/_/g, ' ') : 'Company Assets'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {isAuditExempt ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Exempt
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Audit Req (500k+)
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground uppercase">{job.payment_terms || '50/50'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {job.remaining_paid ? '✓ Fully Paid' : `Due: ${Number(job.remaining_amount || 0).toFixed(3)}`}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={job.golden_approval_status || 'pending'}
                          onChange={e => handleUpdateJobField(job.id, {
                            golden_approval_status: e.target.value,
                            ...(e.target.value === 'approved' ? { golden_approved_at: new Date().toISOString() } : {})
                          })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border ${
                            job.golden_approval_status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <option value="pending" className="bg-card text-foreground">Gov Pending</option>
                          <option value="approved" className="bg-card text-foreground">Gov Approved</option>
                          <option value="rejected" className="bg-card text-foreground">Gov Rejected</option>
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={job.id_card_status || 'pending'}
                          onChange={e => handleUpdateJobField(job.id, {
                            id_card_status: e.target.value,
                            ...(e.target.value === 'issued' ? { id_card_issued_at: new Date().toISOString() } : {})
                          })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border ${
                            job.id_card_status === 'issued'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          <option value="pending" className="bg-card text-foreground">Card Pending</option>
                          <option value="issued" className="bg-card text-foreground">10-Yr Card Issued</option>
                        </select>
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-amber-400">
                        {Number(job.total_fee || 0).toFixed(3)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectedJob(job)}
                          className="px-3 py-1 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 border border-amber-400/30 font-bold text-xs transition-all active:scale-95"
                        >
                          Inspect File
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

      {/* File Inspector Slide-over */}
      <AnimatePresence>
        {inspectedJob && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-4xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-y-auto"
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <Crown size={18} className="text-amber-400" />
                  <span className="font-bold text-sm text-foreground">
                    Investor File Inspector: {inspectedJob.job_code}
                  </span>
                </div>
                <button
                  onClick={() => setInspectedJob(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <GoldenVisaCommandCenter
                  job={inspectedJob}
                  onUpdated={() => {
                    refetch();
                  }}
                  canEdit={true}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Investor Modal */}
      <AddMigrateJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => refetch()}
        defaultCategory="golden_visa"
      />
    </div>
  );
}
