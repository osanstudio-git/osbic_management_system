import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Crown, Plane, DollarSign, Users, Building2, TrendingUp,
  ShieldCheck, FileText, CheckCircle2, AlertTriangle, AlertCircle,
  Calendar, Search, Filter, ArrowUpRight, Clock, MapPin, Ticket,
  Download, RefreshCw, ChevronRight, Eye, Briefcase, MessageSquare, Phone
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AddMigrateJobModal } from '../../components/employee/AddMigrateJobModal';

export default function MigrateReportDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'golden' | 'global' | 'attribution'>('overview');
  const [timePreset, setTimePreset] = useState<'all' | 'month' | 'week' | 'today'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<'golden_visa' | 'global_visa'>('golden_visa');

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

    const message = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from OSBIC MIGRATE (Golden & Global Visa Division). How can we assist you today?`);
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

  // Fetch all Migrate division jobs
  const { data: allJobs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin_migrate_reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name, company_name, phone, whatsapp, email),
          branch:branches!branch_id(name),
          sales_rep:profiles!sales_employee_id(full_name, branch_id, branches:branch_id(name)),
          ops_rep:profiles!ops_employee_id(full_name),
          service:services!service_id(name_en, name_ar)
        `)
        .or('migrate_category.in.(golden_visa,global_visa),golden_route.not.is.null,visa_category.not.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fallback fetching migrate jobs:', error);
        // Fallback search by service name if columns are still syncing
        const { data: fallbackData } = await supabase
          .from('jobs')
          .select(`
            *,
            client:profiles!client_id(full_name, company_name, phone, email),
            branch:branches!branch_id(name),
            sales_rep:profiles!sales_employee_id(full_name, branch_id, branches:branch_id(name)),
            service:services!service_id(name_en, name_ar)
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        return (fallbackData || []).filter((j: any) =>
          j.migrate_category ||
          (j.service?.name_en || '').toLowerCase().includes('golden') ||
          (j.service?.name_en || '').toLowerCase().includes('tourist') ||
          (j.service?.name_en || '').toLowerCase().includes('visa')
        );
      }

      return data || [];
    }
  });

  // Filter by Timeframe
  const filteredJobs = useMemo(() => {
    return allJobs.filter((job: any) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (job.client?.full_name || '').toLowerCase();
        const jobCode = (job.job_code || '').toLowerCase();
        const country = (job.destination_country || '').toLowerCase();
        if (!clientName.includes(query) && !jobCode.includes(query) && !country.includes(query)) {
          return false;
        }
      }

      if (timePreset === 'all') return true;

      const created = new Date(job.created_at);
      const now = new Date();

      if (timePreset === 'today') {
        return created.toDateString() === now.toDateString();
      }
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
  }, [allJobs, timePreset, searchQuery]);

  // Golden vs Global datasets
  const goldenJobs = useMemo(() => {
    return filteredJobs.filter((j: any) =>
      j.migrate_category === 'golden_visa' ||
      j.golden_route ||
      (j.service?.name_en || '').toLowerCase().includes('golden')
    );
  }, [filteredJobs]);

  const globalJobs = useMemo(() => {
    return filteredJobs.filter((j: any) =>
      j.migrate_category === 'global_visa' ||
      j.visa_category ||
      (!goldenJobs.includes(j) && (
        (j.service?.name_en || '').toLowerCase().includes('tourist') ||
        (j.service?.name_en || '').toLowerCase().includes('schengen')
      ))
    );
  }, [filteredJobs, goldenJobs]);

  // High-level KPI aggregations
  const totalBilled = filteredJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);
  const totalVerifiedPaid = filteredJobs.reduce((sum, j) => sum + (Number(j.advance_amount) || 0), 0);
  const totalOutstanding = filteredJobs.reduce((sum, j) => sum + Math.max(0, Number(j.remaining_amount) || 0), 0);

  const goldenRevenue = goldenJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);
  const globalRevenue = globalJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);

  // Lead Attribution & Branch Referral Aggregation
  const attributionData = useMemo(() => {
    const sources: Record<string, { count: number; revenue: number; jobs: any[] }> = {
      social_ads: { count: 0, revenue: 0, jobs: [] },
      reference: { count: 0, revenue: 0, jobs: [] },
      branch_walkin: { count: 0, revenue: 0, jobs: [] },
      direct: { count: 0, revenue: 0, jobs: [] }
    };

    const branchReferrals: Record<string, { branchName: string; count: number; revenue: number; staffNames: Set<string> }> = {};

    filteredJobs.forEach((j: any) => {
      const src = j.lead_source_type || 'social_ads';
      if (!sources[src]) {
        sources[src] = { count: 0, revenue: 0, jobs: [] };
      }
      sources[src].count += 1;
      sources[src].revenue += Number(j.total_fee) || 0;
      sources[src].jobs.push(j);

      // Track Referring Branch
      const bName = j.sales_rep?.branches?.name || j.branch?.name || 'Central Migrate Office';
      if (!branchReferrals[bName]) {
        branchReferrals[bName] = { branchName: bName, count: 0, revenue: 0, staffNames: new Set() };
      }
      branchReferrals[bName].count += 1;
      branchReferrals[bName].revenue += Number(j.total_fee) || 0;
      if (j.sales_rep?.full_name) {
        branchReferrals[bName].staffNames.add(j.sales_rep.full_name);
      }
    });

    return {
      sources,
      branchReferrals: Object.values(branchReferrals)
    };
  }, [filteredJobs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-sky-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/10 shrink-0">
            <Globe size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                EXECUTIVE DIVISION REPORT
              </span>
              <span className="text-xs text-muted-foreground">Centralized Operations Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground mt-0.5">
              OSBIC MIGRATE • Golden & Global Visas
            </h1>
          </div>
        </div>

        {/* Timeframe & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Buttons to Add Migrate Files */}
          <button
            type="button"
            onClick={() => {
              setAddModalCategory('golden_visa');
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Crown size={14} />
            <span>+ New Golden Visa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddModalCategory('global_visa');
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Plane size={14} />
            <span>+ New Global Visa</span>
          </button>

          <div className="bg-card border border-border p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
            {(['month', 'week', 'today', 'all'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setTimePreset(preset)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  timePreset === preset
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset === 'all' ? 'All Time' : preset}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Migrate Division Billed */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Migrate Billed</span>
            <DollarSign size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">
            {totalBilled.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Collected: {totalVerifiedPaid.toFixed(3)}</span>
            <span className="text-amber-400 font-semibold">Due: {totalOutstanding.toFixed(3)}</span>
          </div>
        </div>

        {/* Card 2: Golden Visa Revenue */}
        <div 
          onClick={() => navigate(`${window.location.pathname.startsWith('/admin') ? '/admin' : '/employee'}/golden-visa`)}
          className="bg-card border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-1 bg-amber-500/[0.02] cursor-pointer hover:border-amber-500/60 transition-all hover:bg-amber-500/[0.05] group"
        >
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Golden Visa (Invest Oman)</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-amber-400/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open Desk →</span>
              <Crown size={16} />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400">
            {goldenRevenue.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{goldenJobs.length} Investor Files</span>
            <span className="text-emerald-400 font-bold">10-Year Resident</span>
          </div>
        </div>

        {/* Card 3: Global Tourist Visa Revenue */}
        <div 
          onClick={() => navigate(`${window.location.pathname.startsWith('/admin') ? '/admin' : '/employee'}/global-visa`)}
          className="bg-card border border-sky-500/30 rounded-2xl p-5 shadow-sm space-y-1 bg-sky-500/[0.02] cursor-pointer hover:border-sky-500/60 transition-all hover:bg-sky-500/[0.05] group"
        >
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Global Tourist Visas</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-sky-400/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open Desk →</span>
              <Plane size={16} />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-sky-400">
            {globalRevenue.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{globalJobs.length} Travel Files</span>
            <span className="text-sky-300 font-bold">Schengen / US / UK</span>
          </div>
        </div>

        {/* Card 4: Centralized Execution Note */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm space-y-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Centralized Hub Policy</span>
            <Building2 size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">1 Central Execution Desk</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              Files are cleared centrally. Branch walk-ins are credited as originating referrals.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 sm:gap-4 shrink-0">
          {[
            { id: 'overview', label: 'Overview & Pipelines', icon: Globe },
            { id: 'golden', label: `Golden Visa (${goldenJobs.length})`, icon: Crown },
            { id: 'global', label: `Global Visas (${globalJobs.length})`, icon: Plane },
            { id: 'attribution', label: 'Lead & Branch Attribution', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px] mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search investor, code, country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* TAB 1: OVERVIEW & PIPELINE FUNNELS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Golden Visa Pipeline Funnel */}
            <div className="bg-card border border-amber-500/30 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown size={20} className="text-amber-400" />
                  <h3 className="font-syne font-bold text-foreground">Golden Visa Investor Pipeline</h3>
                </div>
                <span className="text-xs text-amber-400 font-mono font-bold">{goldenJobs.length} Total</span>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    stage: 'Stage 1: Mandatory Consultation & Intake',
                    count: goldenJobs.filter((j: any) => !j.golden_approval_status || j.golden_approval_status === 'pending').length,
                    color: 'text-amber-400 bg-amber-500/10'
                  },
                  {
                    stage: 'Stage 2: 50% Upfront Deposit Verified',
                    count: goldenJobs.filter((j: any) => j.advance_paid).length,
                    color: 'text-blue-400 bg-blue-500/10'
                  },
                  {
                    stage: 'Stage 3: Government Approved (1–3 Days)',
                    count: goldenJobs.filter((j: any) => j.golden_approval_status === 'approved').length,
                    color: 'text-emerald-400 bg-emerald-500/10'
                  },
                  {
                    stage: 'Stage 4: 10-Year Resident ID Card Issued',
                    count: goldenJobs.filter((j: any) => j.id_card_status === 'issued').length,
                    color: 'text-purple-400 bg-purple-500/10'
                  }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setActiveTab('golden')}
                    className="p-3 rounded-xl bg-background border border-border/60 flex items-center justify-between cursor-pointer hover:border-amber-400/40 hover:bg-amber-500/[0.03] transition-all"
                    title="Click to view Golden Visa Register"
                  >
                    <span className="text-xs font-semibold text-foreground">{item.stage}</span>
                    <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${item.color}`}>
                      {item.count} files
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Global Tourist Visa Pipeline Funnel */}
            <div className="bg-card border border-sky-500/30 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane size={20} className="text-sky-400" />
                  <h3 className="font-syne font-bold text-foreground">Global Tourist Visa Logistics</h3>
                </div>
                <span className="text-xs text-sky-400 font-mono font-bold">{globalJobs.length} Total</span>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    stage: 'Stage 1: Eligibility & Bank Statement Pre-Check',
                    count: globalJobs.filter((j: any) => !j.embassy_outcome || j.embassy_outcome === 'pending').length,
                    color: 'text-sky-400 bg-sky-500/10'
                  },
                  {
                    stage: 'Stage 2: Dummy Flight & Hotel Attached',
                    count: globalJobs.filter((j: any) => j.has_dummy_ticket && j.has_dummy_hotel).length,
                    color: 'text-blue-400 bg-blue-500/10'
                  },
                  {
                    stage: 'Stage 3: Visa Approved & Stamped',
                    count: globalJobs.filter((j: any) => j.embassy_outcome === 'approved').length,
                    color: 'text-emerald-400 bg-emerald-500/10'
                  },
                  {
                    stage: 'Stage 4: Embassy Rejected (Appeal Queue)',
                    count: globalJobs.filter((j: any) => j.embassy_outcome === 'rejected').length,
                    color: 'text-rose-400 bg-rose-500/10'
                  }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setActiveTab('global')}
                    className="p-3 rounded-xl bg-background border border-border/60 flex items-center justify-between cursor-pointer hover:border-sky-400/40 hover:bg-sky-500/[0.03] transition-all"
                    title="Click to view Global Visa Register"
                  >
                    <span className="text-xs font-semibold text-foreground">{item.stage}</span>
                    <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${item.color}`}>
                      {item.count} files
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOLDEN VISA MASTER REGISTER */}
      {activeTab === 'golden' && (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-5 py-4">Job Code</th>
                  <th className="px-5 py-4">Investor / Client</th>
                  <th className="px-5 py-4">Qualifying Route</th>
                  <th className="px-5 py-4">Audit Status</th>
                  <th className="px-5 py-4">Payment & Terms</th>
                  <th className="px-5 py-4">Gov Review</th>
                  <th className="px-5 py-4">ID Card</th>
                  <th className="px-5 py-4 text-right">Fee (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {goldenJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                      No Golden Visa investor files recorded in this timeframe.
                    </td>
                  </tr>
                ) : (
                  goldenJobs.map((job: any) => {
                    const isAuditExempt = job.golden_route && job.golden_route !== 'company_assets';
                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-muted/10 transition-colors group"
                      >
                        <td 
                          onClick={() => navigate(`/admin/jobs/${job.id}`)}
                          className="px-5 py-4 font-mono font-bold text-primary group-hover:underline cursor-pointer"
                        >
                          {job.job_code}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-foreground">{job.client?.full_name || 'Investor'}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{job.client?.phone || '-'}</span>
                            {job.client?.phone && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsApp(job.client?.whatsapp || job.client?.phone, job.client?.full_name);
                                  }}
                                  className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                  title="1-Click WhatsApp"
                                >
                                  <MessageSquare size={11} />
                                </button>
                                <a
                                  href={`tel:${job.client?.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                  title="Call Phone"
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
                              Audit Req (500+)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground uppercase">{job.payment_terms || '50/50'}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {job.remaining_paid ? '✓ Fully Paid' : `Due: ${Number(job.remaining_amount || 0).toFixed(3)}`}
                          </div>
                        </td>
                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
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
                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
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
                            <option value="issued" className="bg-card text-foreground">Card Issued (10-Yr)</option>
                          </select>
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                          {Number(job.total_fee || 0).toFixed(3)}
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

      {/* TAB 3: GLOBAL TOURIST VISA REGISTER */}
      {activeTab === 'global' && (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-5 py-4">Job Code</th>
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Destination</th>
                  <th className="px-5 py-4">Embassy Fee Mode</th>
                  <th className="px-5 py-4">Dummy Bookings</th>
                  <th className="px-5 py-4">Travel Date</th>
                  <th className="px-5 py-4">Outcome</th>
                  <th className="px-5 py-4 text-right">Fee (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {globalJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                      No Global Tourist Visa files recorded in this timeframe.
                    </td>
                  </tr>
                ) : (
                  globalJobs.map((job: any) => (
                    <tr
                      key={job.id}
                      className="hover:bg-muted/10 transition-colors group"
                    >
                      <td 
                        onClick={() => navigate(`/admin/jobs/${job.id}`)}
                        className="px-5 py-4 font-mono font-bold text-sky-400 group-hover:underline cursor-pointer"
                      >
                        {job.job_code}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">{job.client?.full_name || 'Applicant'}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{job.client?.phone || '-'}</span>
                          {job.client?.phone && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsApp(job.client?.whatsapp || job.client?.phone, job.client?.full_name);
                                }}
                                className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                title="1-Click WhatsApp"
                              >
                                <MessageSquare size={11} />
                              </button>
                              <a
                                href={`tel:${job.client?.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                title="Call Phone"
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
                        {job.destination_country || 'Europe / Schengen'}
                      </td>
                      <td className="px-5 py-4 capitalize text-muted-foreground">
                        {job.embassy_fee_mode ? job.embassy_fee_mode.replace(/_/g, ' ') : 'Paid to OSBIC'}
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateJobField(job.id, { has_dummy_ticket: !job.has_dummy_ticket })}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                              job.has_dummy_ticket
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-muted/40 text-muted-foreground/50 border-border hover:text-foreground'
                            }`}
                            title="Click to toggle Dummy Flight Ticket"
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
                            title="Click to toggle Travel Insurance"
                          >
                            Insur
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-muted-foreground">
                        {job.travel_date ? format(new Date(job.travel_date), 'dd MMM yyyy') : 'Not Set'}
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
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
                          <option value="approved" className="bg-card text-foreground">Approved</option>
                          <option value="rejected" className="bg-card text-foreground">Rejected</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-sky-400">
                        {Number(job.total_fee || 0).toFixed(3)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LEAD & BRANCH ATTRIBUTION */}
      {activeTab === 'attribution' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Sources Distribution */}
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" />
                <h3 className="font-syne font-bold text-foreground">Lead Source Channels</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Tracks where Golden Visa & Global Tourist clients originate.
              </p>

              <div className="space-y-3">
                {[
                  { key: 'social_ads', label: 'Meta & Social Media Ads', desc: 'Campaign acquisition' },
                  { key: 'reference', label: 'Direct Client References', desc: 'Word of mouth & VIP networks' },
                  { key: 'branch_walkin', label: 'Branch Walk-In Referrals', desc: 'Referred from physical branches' },
                  { key: 'direct', label: 'Direct Organic Inquiries', desc: 'Direct calls & website' }
                ].map((channel) => {
                  const data = attributionData.sources[channel.key] || { count: 0, revenue: 0 };
                  const percent = totalBilled > 0 ? ((data.revenue / totalBilled) * 100).toFixed(1) : '0';
                  return (
                    <div key={channel.key} className="p-3.5 rounded-xl bg-background border border-border/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">{channel.label}</p>
                        <p className="text-[10px] text-muted-foreground">{channel.desc}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-emerald-400 block">
                          {data.revenue.toFixed(3)} OMR
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {data.count} files ({percent}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Branch Referral Recognition Table */}
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-amber-400" />
                <h3 className="font-syne font-bold text-foreground">Branch Referral Credit</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Branches that referred walk-in clients to the central Migrate desk for execution.
              </p>

              <div className="space-y-3">
                {attributionData.branchReferrals.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    No branch referrals recorded yet.
                  </div>
                ) : (
                  attributionData.branchReferrals.map((br, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-background border border-border/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">{br.branchName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Referring staff: {Array.from(br.staffNames).join(', ') || 'Branch Staff'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-amber-400 block">
                          {br.revenue.toFixed(3)} OMR
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {br.count} referrals credited
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Migrate File Modal (Golden Visa & Global Tourist Visa) */}
      <AddMigrateJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => refetch()}
        defaultCategory={addModalCategory}
      />
    </div>
  );
}

