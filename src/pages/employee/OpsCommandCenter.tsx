import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, CheckCircle2, Clock, AlertTriangle, Layers,
  Search, Download, RefreshCw, X, ArrowUpRight, Shield, 
  Filter, ChevronRight, UserCheck, Users, Sparkles, UserPlus,
  ArrowRight, Phone, ExternalLink, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  useOpsCommandCenter, 
  type OpsCommandService, 
  type OpsEmployeeRoster 
} from '../../hooks/employee/useOpsCommandCenter';
import { OpsAssignmentPanel } from '../../components/employee/OpsAssignmentPanel';
import { TaskAssignmentBriefing } from '../../components/employee/TaskAssignmentBriefing';
import { format } from 'date-fns';

type CommandCenterTab = 'team' | 'jobs' | 'services' | 'unassigned';

export default function OpsCommandCenter() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const isOpsHead = Boolean(
    (profile as any)?.is_ops_head ||
    profile?.is_manager ||
    profile?.role === 'admin' ||
    role === 'admin'
  );

  const [activeTab, setActiveTab] = useState<CommandCenterTab>('unassigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedServiceForAssign, setSelectedServiceForAssign] = useState<OpsCommandService | null>(null);
  const [briefingJobId, setBriefingJobId] = useState<string | null>(null);
  const [briefingServiceId, setBriefingServiceId] = useState<string | null>(null);

  const {
    services,
    employees,
    isLoading,
    refetch,
    assignTask,
    isAssigning,
    postToPool,
    isPostingToPool
  } = useOpsCommandCenter(profile?.branch_id);

  // Access guard
  if (!isOpsHead) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground">Operations Leadership Access Required</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The Ops Command Center is strictly reserved for the <strong>Operations Head</strong> and branch managers.
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

  // Derived metrics
  const unassignedServices = services.filter(s => !s.ops_employee_id && s.status !== 'completed' && s.status !== 'cancelled');
  const activeServices = services.filter(s => ['in_progress', 'applied', 'assigned_to_pro'].includes(s.status));
  const completedServices = services.filter(s => s.status === 'completed');

  // Filtered services
  const filteredServices = services.filter(s => {
    const matchesSearch = 
      s.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.job?.client?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.applicant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ops_employee?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.job?.job_code || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'unassigned') {
      return !s.ops_employee_id && s.status !== 'completed' && s.status !== 'cancelled';
    }

    if (statusFilter !== 'all') {
      return s.status === statusFilter;
    }

    return true;
  });

  // Group by Jobs for Jobs View
  const groupedJobs: Record<string, { job: any; services: OpsCommandService[] }> = {};
  services.forEach(s => {
    if (!s.job) return;
    if (!groupedJobs[s.job_id]) {
      groupedJobs[s.job_id] = { job: s.job, services: [] };
    }
    groupedJobs[s.job_id].services.push(s);
  });

  const jobsList = Object.values(groupedJobs).filter(g => {
    if (!searchQuery) return true;
    return (
      (g.job?.client?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.job?.job_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.services.some(s => s.service_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleOpenBriefing = (jobId: string, serviceId?: string) => {
    setBriefingJobId(jobId);
    setBriefingServiceId(serviceId || null);
  };

  const handleAssignSubmit = async (serviceId: string, empId: string | null) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !profile) return;
    await assignTask({
      jobServiceId: serviceId,
      opsEmployeeId: empId,
      headId: profile.id,
      jobId: svc.job_id,
      serviceName: svc.service_name,
      clientName: svc.job?.client?.full_name
    });
  };

  const handlePostToPoolSubmit = async (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !profile) return;
    await postToPool({
      jobServiceId: serviceId,
      headId: profile.id,
      jobId: svc.job_id,
      serviceName: svc.service_name,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span>⚙️ Operations Command Center</span>
              <span>•</span>
              <span>{profile?.branch_id ? 'Branch Command' : 'HQ Command'}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-1">
            Task Orchestration & Work Allocation
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Dispatch services, eliminate unassigned bottlenecks, inspect living case dossiers, and balance team capacity.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
          <Link
            to="/employee/ops-team-reports"
            className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Briefcase size={14} />
            <span>Ops Analytics & Reports</span>
          </Link>
        </div>
      </div>

      {/* ── 2. TOP METRICS BAR ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Unassigned Bottleneck */}
        <div 
          onClick={() => setActiveTab('unassigned')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-2 ${
            activeTab === 'unassigned'
              ? 'bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/30'
              : 'bg-card border-border hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">⚠️ Unassigned Tasks</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertCircle size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-rose-400">
              {unassignedServices.length}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Requires Ops Head allocation
            </span>
          </div>
        </div>

        {/* In Progress */}
        <div 
          onClick={() => setActiveTab('services')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-2 ${
            activeTab === 'services'
              ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/30'
              : 'bg-card border-border hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">🔄 In Progress</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-blue-400">
              {activeServices.length}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Under specialist execution
            </span>
          </div>
        </div>

        {/* Active Client Jobs */}
        <div 
          onClick={() => setActiveTab('jobs')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-2 ${
            activeTab === 'jobs'
              ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/30'
              : 'bg-card border-border hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">📁 Active Jobs</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {jobsList.length}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Multi-service packages
            </span>
          </div>
        </div>

        {/* Team Capacity */}
        <div 
          onClick={() => setActiveTab('team')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-2 ${
            activeTab === 'team'
              ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30'
              : 'bg-card border-border hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">👥 Team Capacity</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {employees.length}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Specialists & PRO agents
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. NAVIGATION TABS & SEARCH ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'unassigned', label: `⚠️ Unassigned (${unassignedServices.length})` },
            { id: 'team', label: `👥 Team Workload (${employees.length})` },
            { id: 'jobs', label: `📁 Jobs View (${jobsList.length})` },
            { id: 'services', label: `📋 All Services (${services.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CommandCenterTab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search service, client, job code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* ── 4. CONTENT SECTIONS ────────────────────────────────────────────── */}

      {/* TAB: UNASSIGNED SERVICES */}
      {activeTab === 'unassigned' && (
        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <span>Unallocated Operations Queue</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {unassignedServices.length} waiting
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every client service here is waiting for an Ops Specialist to be assigned by the Ops Head.
              </p>
            </div>
          </div>

          {unassignedServices.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h3 className="font-bold text-foreground text-sm">All Clear! No Unassigned Tasks</h3>
              <p className="text-xs text-muted-foreground">Every incoming service is currently assigned to a specialist.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {unassignedServices.map(svc => (
                <div key={svc.id} className="p-4 sm:p-5 hover:bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Unassigned
                      </span>
                      {svc.job?.job_code && (
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">
                          #{svc.job.job_code}
                        </span>
                      )}
                      {svc.job?.package?.name_en && (
                        <span className="text-[10px] text-muted-foreground">
                          • {svc.job.package.name_en}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-foreground">
                      {svc.service_name}
                      {svc.applicant_name && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          (Applicant: <span className="font-semibold text-foreground">{svc.applicant_name}</span>)
                        </span>
                      )}
                    </h3>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 pt-0.5 flex-wrap">
                      <span>Client: <strong className="text-foreground">{svc.job?.client?.full_name || 'N/A'}</strong></span>
                      {svc.job?.client?.phone && <span>• {svc.job.client.phone}</span>}
                      <span>• Created: {format(new Date(svc.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenBriefing(svc.job_id, svc.id)}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Inspect full case dossier before assigning"
                    >
                      <Sparkles size={12} />
                      <span>Dossier</span>
                    </button>
                    <button
                      onClick={() => setSelectedServiceForAssign(svc)}
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
                    >
                      <UserPlus size={14} />
                      <span>Assign Specialist</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: TEAM WORKLOAD */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const empServices = services.filter(s => s.ops_employee_id === emp.id && s.status !== 'completed' && s.status !== 'cancelled');
            const isHeavy = emp.active_tasks_count >= 6;
            const isModerate = emp.active_tasks_count >= 3 && emp.active_tasks_count < 6;

            return (
              <div key={emp.id} className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      {emp.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        <span>{emp.full_name}</span>
                        {emp.is_ops_head && (
                          <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                            Head
                          </span>
                        )}
                        {emp.is_pro && (
                          <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                            PRO
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">{emp.email || emp.phone || 'Operations'}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    isHeavy
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : isModerate
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {emp.active_tasks_count} active tasks
                  </span>
                </div>

                {/* Services list for this employee */}
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Assigned Operations ({empServices.length}):
                  </span>
                  {empServices.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 italic py-2">Available for new assignments</p>
                  ) : (
                    <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                      {empServices.map(s => (
                        <div key={s.id} className="p-2 rounded-lg bg-muted/20 border border-border/40 text-xs flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground truncate">{s.service_name}</span>
                          <button
                            onClick={() => setSelectedServiceForAssign(s)}
                            className="text-[9px] text-primary hover:underline shrink-0"
                          >
                            Reassign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: JOBS VIEW */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {jobsList.map(item => {
            const hasUnassigned = item.services.some(s => !s.ops_employee_id && s.status !== 'completed' && s.status !== 'cancelled');

            return (
              <div key={item.job.id} className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground text-base">
                        {item.job.client?.full_name || 'Client Case'}
                      </h3>
                      {item.job.job_code && (
                        <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          #{item.job.job_code}
                        </span>
                      )}
                      {hasUnassigned && (
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          Contains Unassigned Services
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.job.package?.name_en || item.job.custom_name || 'Standard Package'} • {item.services.length} total operations
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenBriefing(item.job.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Sparkles size={12} />
                      <span>Case Dossier</span>
                    </button>
                    <button
                      onClick={() => navigate(`/employee/tasks?jobId=${item.job.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>Open Workspace</span>
                    </button>
                  </div>
                </div>

                {/* Sub-services breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {item.services.map(svc => (
                    <div key={svc.id} className="p-3 rounded-xl bg-muted/15 border border-border/60 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{svc.service_name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {svc.ops_employee ? `Ops: ${svc.ops_employee.full_name}` : <span className="text-rose-400 font-semibold">Unassigned</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedServiceForAssign(svc)}
                        className="text-[10px] font-bold text-primary hover:bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg transition-all shrink-0"
                      >
                        {svc.ops_employee ? 'Change' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: ALL SERVICES TABLE */}
      {activeTab === 'services' && (
        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-bold text-[10px] border-b border-border">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Specialist</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredServices.map(svc => (
                  <tr key={svc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-foreground">{svc.service_name}</p>
                      <p className="text-[10px] text-muted-foreground">#{svc.job?.job_code || ''}</p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {svc.job?.client?.full_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-muted text-muted-foreground">
                        {svc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {svc.ops_employee ? (
                        <span className="font-medium text-foreground">{svc.ops_employee.full_name}</span>
                      ) : (
                        <span className="text-rose-400 font-bold">⚠️ Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedServiceForAssign(svc)}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold transition-all"
                      >
                        {svc.ops_employee ? 'Reassign' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. SLIDE-OVERS & MODALS ────────────────────────────────────────── */}

      {/* Ops Assignment Panel */}
      <AnimatePresence>
        {selectedServiceForAssign && (
          <OpsAssignmentPanel
            service={selectedServiceForAssign}
            employees={employees}
            isOpen={!!selectedServiceForAssign}
            onClose={() => setSelectedServiceForAssign(null)}
            onAssign={handleAssignSubmit}
            isAssigning={isAssigning}
            onPostToPool={handlePostToPoolSubmit}
            isPostingToPool={isPostingToPool}
            onOpenBriefing={handleOpenBriefing}
          />
        )}
      </AnimatePresence>

      {/* Case Dossier Modal */}
      <TaskAssignmentBriefing
        jobId={briefingJobId || ''}
        currentServiceId={briefingServiceId || undefined}
        isOpen={!!briefingJobId}
        onClose={() => {
          setBriefingJobId(null);
          setBriefingServiceId(null);
        }}
      />
    </div>
  );
}
