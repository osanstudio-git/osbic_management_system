import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Globe, Hotel, Calendar, CheckCircle2, Clock, AlertCircle,
  FileText, DollarSign, Shield, MapPin, ExternalLink, RefreshCw,
  Building, Check, X, AlertTriangle, ArrowRight, UserCheck, Ticket,
  MessageSquare, Phone, Plus, Search, Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { AddMigrateJobModal } from '../../components/employee/AddMigrateJobModal';
import { GlobalVisaCommandCenter } from '../../components/employee/GlobalVisaCommandCenter';

export default function GlobalVisaDesk() {
  const [timePreset, setTimePreset] = useState<'all' | 'month' | 'week' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inspectedJob, setInspectedJob] = useState<any | null>(null);

  // Fetch Global Visa files
  const { data: globalJobs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['global_visa_desk_jobs'],
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
        .or('migrate_category.eq.global_visa,visa_category.not.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fallback fetching global jobs:', error);
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
          j.migrate_category === 'global_visa' ||
          j.visa_category ||
          (j.service?.name_en || '').toLowerCase().includes('tourist') ||
          (j.service?.name_en || '').toLowerCase().includes('schengen')
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

    const message = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from OSBIC Global Visa Logistics Desk.`);
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
    return globalJobs.filter((job: any) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (job.client?.full_name || '').toLowerCase();
        const jobCode = (job.job_code || '').toLowerCase();
        const country = (job.destination_country || '').toLowerCase();
        const category = (job.visa_category || '').toLowerCase();
        if (!clientName.includes(query) && !jobCode.includes(query) && !country.includes(query) && !category.includes(query)) {
          return false;
        }
      }

      // Stage filter
      if (stageFilter === 'stage1' && job.embassy_outcome && job.embassy_outcome !== 'pending') return false;
      if (stageFilter === 'stage2' && (!job.has_dummy_ticket || !job.has_dummy_hotel)) return false;
      if (stageFilter === 'stage3' && job.embassy_outcome !== 'approved') return false;
      if (stageFilter === 'stage4' && job.embassy_outcome !== 'rejected') return false;

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
  }, [globalJobs, timePreset, searchQuery, stageFilter]);

  // High-level KPIs
  const totalBilled = filteredJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);
  const totalCollected = filteredJobs.reduce((sum, j) => sum + (Number(j.advance_amount) || 0), 0);
  const approvedCount = filteredJobs.filter(j => j.embassy_outcome === 'approved').length;
  const rejectedCount = filteredJobs.filter(j => j.embassy_outcome === 'rejected').length;
  const dummyReadyCount = filteredJobs.filter(j => j.has_dummy_ticket && j.has_dummy_hotel).length;
  const decidedCount = approvedCount + rejectedCount;
  const approvalRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 100;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-950 via-slate-900 to-slate-950 p-6 sm:p-8 border border-sky-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xl border border-sky-500/40 shadow-lg shrink-0">
              <Plane size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  SCHENGEN, UK & GLOBAL VISA LOGISTICS
                </span>
                <span className="text-xs text-muted-foreground">International Consular Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-syne font-bold text-white mt-1">
                Global Tourist & Business Visas Desk
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Fast-track European Schengen (29 countries), USA, UK, Canada, and GCC visit visa document logistics and appointment booking.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg hover:shadow-sky-500/25 transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>+ New Visa Application</span>
            </button>

            <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl flex items-center gap-1 text-xs border border-white/10">
              {(['all', 'month', 'week', 'today'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => setTimePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all font-semibold ${
                    timePreset === preset
                      ? 'bg-sky-500 text-white font-bold shadow-sm'
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

        {/* 4 Visa KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-sky-500/20">
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Visa Volume</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-sky-400 mt-0.5 block">
              {totalBilled.toFixed(3)} <span className="text-xs font-normal opacity-60">OMR</span>
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Collected: {totalCollected.toFixed(3)} OMR
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Applications</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-white mt-0.5 block">
              {filteredJobs.length} Files
            </span>
            <span className="text-[10px] text-sky-300 font-semibold mt-1 block">
              {dummyReadyCount} Flight/Hotel Ready
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stamped Visas (Approved)</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 mt-0.5 block">
              {approvedCount} Visas
            </span>
            <span className="text-[10px] text-emerald-300 font-semibold mt-1 block">
              Passport Stamped
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Embassy Approval Rate</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 mt-0.5 block">
              {approvalRate}%
            </span>
            <span className="text-[10px] text-slate-300 mt-1 block">
              {rejectedCount} Refusals / Appeals
            </span>
          </div>
        </div>
      </div>

      {/* 4-Stage Travel Logistics Pipeline */}
      <div className="bg-card border border-sky-500/30 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400">
            <Plane size={18} />
            <h2 className="font-syne font-bold text-foreground text-sm uppercase tracking-wider">
              Travel Logistics Milestones
            </h2>
          </div>
          {stageFilter && (
            <button
              onClick={() => setStageFilter(null)}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <X size={12} /> Clear Stage Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'stage1',
              title: 'Stage 1: Eligibility & Bank Statement',
              subtitle: 'Pre-audit for sufficient funds',
              count: globalJobs.filter((j: any) => !j.embassy_outcome || j.embassy_outcome === 'pending').length,
              color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
            },
            {
              id: 'stage2',
              title: 'Stage 2: Dummy Flight & Hotel Attached',
              subtitle: 'Mandatory reservation vouchers',
              count: globalJobs.filter((j: any) => j.has_dummy_ticket && j.has_dummy_hotel).length,
              color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
            },
            {
              id: 'stage3',
              title: 'Stage 3: Visa Stamped & Approved',
              subtitle: 'Passport ready for collection',
              count: globalJobs.filter((j: any) => j.embassy_outcome === 'approved').length,
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            },
            {
              id: 'stage4',
              title: 'Stage 4: Embassy Refusal (Appeal Queue)',
              subtitle: 'Appeals & re-applications',
              count: globalJobs.filter((j: any) => j.embassy_outcome === 'rejected').length,
              color: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
            }
          ].map(stage => (
            <button
              key={stage.id}
              onClick={() => setStageFilter(stageFilter === stage.id ? null : stage.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                stageFilter === stage.id
                  ? 'border-sky-400 bg-sky-500/15 shadow-md'
                  : 'bg-background border-border hover:border-sky-500/40'
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

      {/* Applications Master Register Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">
              Visa Applications Register ({filteredJobs.length} Files)
            </h3>
            {stageFilter && (
              <span className="text-[10px] bg-sky-500/20 text-sky-400 font-bold px-2 py-0.5 rounded border border-sky-500/30 uppercase">
                Filtered by {stageFilter.toUpperCase()}
              </span>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search applicant, country, code, category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-sky-400 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-5 py-4">Job Code</th>
                <th className="px-5 py-4">Applicant / Contact</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Destination</th>
                <th className="px-5 py-4">Fee Mode</th>
                <th className="px-5 py-4">Dummy Bookings</th>
                <th className="px-5 py-4">Travel Date</th>
                <th className="px-5 py-4">Outcome</th>
                <th className="px-5 py-4 text-right">Fee (OMR)</th>
                <th className="px-5 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground">
                    No Global Visa applications found. Click <strong>"+ New Visa Application"</strong> to log an applicant.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job: any) => (
                  <tr key={job.id} className="hover:bg-muted/15 transition-colors group">
                    <td className="px-5 py-4 font-mono font-bold text-sky-400">
                      {job.job_code}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground">{job.client?.full_name || 'Applicant'}</div>
                      <div className="text-[10px] text-muted-foreground">{job.client?.nationality || 'Traveler'}</div>
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
                              title="Call Applicant"
                            >
                              <Phone size={11} />
                            </a>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 uppercase font-semibold text-foreground">
                      {job.visa_category ? job.visa_category.replace(/_/g, ' ') : 'Tourist'}
                    </td>

                    <td className="px-5 py-4 font-semibold text-foreground">
                      {job.destination_country || 'Schengen / Europe'}
                    </td>

                    <td className="px-5 py-4 capitalize text-muted-foreground">
                      {job.embassy_fee_mode ? job.embassy_fee_mode.replace(/_/g, ' ') : 'Paid to OSBIC'}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateJobField(job.id, { has_dummy_ticket: !job.has_dummy_ticket })}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            job.has_dummy_ticket
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-muted/40 text-muted-foreground/50 border-border hover:text-foreground'
                          }`}
                          title="Click to toggle Flight Voucher"
                        >
                          Flight
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateJobField(job.id, { has_dummy_hotel: !job.has_dummy_hotel })}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            job.has_dummy_hotel
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-muted/40 text-muted-foreground/50 border-border hover:text-foreground'
                          }`}
                          title="Click to toggle Hotel Voucher"
                        >
                          Hotel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateJobField(job.id, { has_insurance: !job.has_insurance })}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            job.has_insurance
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-muted/40 text-muted-foreground/50 border-border hover:text-foreground'
                          }`}
                          title="Click to toggle Insurance"
                        >
                          Insur
                        </button>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono text-[11px] text-muted-foreground">
                      {job.travel_date ? format(new Date(job.travel_date), 'dd MMM yyyy') : 'Not Set'}
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={job.embassy_outcome || 'pending'}
                        onChange={e => handleUpdateJobField(job.id, { embassy_outcome: e.target.value })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border ${
                          job.embassy_outcome === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : job.embassy_outcome === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <option value="pending" className="bg-card text-foreground">Pending</option>
                        <option value="approved" className="bg-card text-foreground">Approved & Stamped</option>
                        <option value="rejected" className="bg-card text-foreground">Refused / Appeals</option>
                      </select>
                    </td>

                    <td className="px-5 py-4 text-right font-mono font-bold text-sky-400">
                      {Number(job.total_fee || 0).toFixed(3)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectedJob(job)}
                        className="px-3 py-1 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 font-bold text-xs transition-all active:scale-95"
                      >
                        Inspect Application
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Application Inspector Slide-over */}
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
                  <Plane size={18} className="text-sky-400" />
                  <span className="font-bold text-sm text-foreground">
                    Visa Application Inspector: {inspectedJob.job_code}
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
                <GlobalVisaCommandCenter
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

      {/* Add Visa Modal */}
      <AddMigrateJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => refetch()}
        defaultCategory="global_visa"
      />
    </div>
  );
}
