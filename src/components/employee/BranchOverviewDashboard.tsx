import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Briefcase, DollarSign, Clock,
  CheckCircle2, AlertCircle, ArrowUpRight, UserCheck,
  ChevronRight, ArrowRight, ShieldCheck, FileCheck,
  Sparkles, Zap, PhoneCall, RefreshCw
} from 'lucide-react';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminJobs } from '../../hooks/shared/useJobs';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { useAdminLeads } from '../../hooks/shared/useLeads';
import { useInvoices } from '../../hooks/employee/useInvoices';
import { WorkloadAllocationModal } from './WorkloadAllocationModal';
import { QuickTaskModal } from './QuickTaskModal';
import { DailyReconciliationModal } from './DailyReconciliationModal';
import { DocumentVaultModal } from './DocumentVaultModal';
import { RoundRobinDistributionModal } from './RoundRobinDistributionModal';
import { ClientEscalationsModal } from './ClientEscalationsModal';
import { BranchTargetProgressWidget } from './BranchTargetProgressWidget';
import { useDailyRegister } from '../../hooks/employee/useBranchReconciliation';
import { useBranchVaultDocuments } from '../../hooks/employee/useDocumentVault';
import { useBranchEscalations } from '../../hooks/employee/useBranchEscalations';
import { Landmark, CreditCard, Receipt, Lock, Stamp, ShieldAlert, AlertTriangle } from 'lucide-react';

export const BranchOverviewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();

  const branchId = profile?.branch_id || selectedBranchId;
  const { data: allJobs = [], isLoading: loadingJobs } = useAdminJobs(branchId);
  const { data: employees = [], isLoading: loadingEmployees } = useAdminEmployees(branchId);
  const { useAllLeadsList } = useAdminLeads(branchId);
  const { data: leads = [], isLoading: loadingLeads } = useAllLeadsList();
  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices();
  const { data: registerData } = useDailyRegister(branchId);
  const { data: vaultItems = [] } = useBranchVaultDocuments(branchId);
  const { data: escalations = [] } = useBranchEscalations(branchId);

  const [selectedEmployeeForDelegation, setSelectedEmployeeForDelegation] = useState<any>(null);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isRoundRobinOpen, setIsRoundRobinOpen] = useState(false);
  const [isEscalationsOpen, setIsEscalationsOpen] = useState(false);

  const activeJobs = allJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
  const completedJobsThisMonth = allJobs.filter(j => {
    if (j.status !== 'completed') return false;
    const date = new Date(j.expected_completion || j.started_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const unassignedLeads = leads.filter(l => !l.assigned_to && l.status !== 'converted' && l.status !== 'lost');
  const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost');

  // Vault stats
  const inVaultCount = vaultItems.filter(i => i.status === 'in_vault').length;
  const withProCount = vaultItems.filter(i => i.status === 'with_pro').length;

  // Walk-in count today
  const todayStr = new Date().toDateString();
  const todayWalkIns = allJobs.filter(j => {
    const d = new Date(j.started_date).toDateString();
    return d === todayStr && (j.service_name?.includes('POS') || (j as any).entry_type === 'walkin');
  });

  // Escalation stats
  const openEscalations = escalations.filter(e => e.status === 'open' || e.status === 'investigating');
  const criticalEscalations = escalations.filter(e => (e.status === 'open' || e.status === 'investigating') && (e.severity === 'critical' || e.severity === 'high'));

  // Revenue stats
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid' || inv.status === 'partially_paid')
    .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  // Jobs awaiting milestone / payment / SLA approval
  const pendingMilestoneJobs = allJobs.filter(j =>
    j.status === 'pending' ||
    j.status === 'awaiting_approval' ||
    (j.total_steps > 0 && j.completed_steps === 0) ||
    !j.advance_paid
  ).slice(0, 5);

  const isReconciledToday = !!registerData?.existingReconciliation;
  const reconciliationStatus = registerData?.existingReconciliation?.status || 'pending';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">

      {/* ─── Hero Header & Branch Identity ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/90 to-primary/10 border border-border p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold tracking-wider uppercase mb-3">
              <Building2 size={13} />
              <span>{selectedBranch?.name || 'Branch Operations Center'}</span>
            </div>
            <h1 className="text-2xl lg:text-4xl font-syne font-bold text-foreground tracking-tight">
              Branch Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Supervising <span className="text-foreground font-semibold">{employees.length} team members</span>, active customer workflows, and operational quality for {selectedBranch?.name || 'this branch'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsEscalationsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              <ShieldAlert size={14} />
              <span>Escalations ({openEscalations.length})</span>
              {criticalEscalations.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>
            <button
              onClick={() => setIsVaultOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Lock size={14} />
              Document Vault ({inVaultCount + withProCount})
            </button>
            <button
              onClick={() => setIsReconciliationOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Landmark size={14} />
              Reconcile Register
            </button>
            <button
              onClick={() => setIsQuickTaskOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:bg-muted/60 text-foreground text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Zap size={14} className="text-amber-500" />
              Quick Walk-in (POS)
            </button>
            <button
              onClick={() => navigate('/employee/team')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95"
            >
              <Users size={14} />
              Manage Team & Delegation
            </button>
          </div>
        </div>
      </div>

      {/* ─── Urgent Escalation Alert Banner (if critical complaints exist) ─── */}
      {criticalEscalations.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-red-500/10 border border-red-500/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 animate-pulse">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {criticalEscalations.length} High-Priority Client Escalation{criticalEscalations.length > 1 ? 's' : ''} Pending
                </h3>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                  URGENT INTERVENTION
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Client dissatisfaction or milestone SLA delays require immediate branch manager review to prevent customer churn.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEscalationsOpen(true)}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-500/25 flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <span>Review Escalations</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ─── Daily Register & Cash Drawer Status Banner ─── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Today's Cash Drawer & POS Register</h3>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${reconciliationStatus === 'verified' || reconciliationStatus === 'submitted'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : reconciliationStatus === 'discrepancy'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                {isReconciledToday ? reconciliationStatus : 'Pending Shift Closeout'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live tally: <strong className="text-foreground">OMR {(registerData?.expectedCash || 0).toFixed(3)} Cash</strong> in drawer • <strong className="text-foreground">OMR {(registerData?.expectedCard || 0).toFixed(3)} Card POS</strong> settlements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReconciliationOpen(true)}
            className="w-full md:w-auto px-4 py-2 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>{isReconciledToday ? 'Review / Edit Closeout' : 'Perform End-of-Day Closeout'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ─── Branch Monthly Target vs Actuals Progress Widget ─── */}
      <BranchTargetProgressWidget />

      {/* ─── Key Metrics Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Projects */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Jobs</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Briefcase size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-syne font-bold text-foreground">{activeJobs.length}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-500 font-bold">+{completedJobsThisMonth.length}</span> done this month
            </div>
          </div>
        </div>

        {/* Unassigned Leads & Auto-Distribute */}
        <div
          className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unassigned Leads</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <PhoneCall size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-syne font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                {unassignedLeads.length}
                {unassignedLeads.length > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    NEEDS ACTION
                  </span>
                )}
              </span>
              {unassignedLeads.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRoundRobinOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-all flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  Auto-Assign
                </button>
              )}
            </div>
            <div
              onClick={() => navigate('/employee/leads')}
              className="text-xs text-muted-foreground mt-2 flex items-center gap-1 cursor-pointer hover:text-foreground"
            >
              <span>{activeLeads.length} total active</span>
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Physical Document Vault */}
        <div
          onClick={() => setIsVaultOpen(true)}
          className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Custody Vault</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <Lock size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-syne font-bold text-foreground flex items-center gap-2">
              {inVaultCount + withProCount}
              {withProCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  {withProCount} WITH PRO
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{inVaultCount} in safe • {withProCount} in transit</span>
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Today's Walk-in Footfall */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Walk-ins</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Zap size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-syne font-bold text-foreground">{todayWalkIns.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Front desk visits today</div>
          </div>
        </div>

        {/* Branch Team Size */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Supervised Staff</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserCheck size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-syne font-bold text-foreground">{employees.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Active branch staff</div>
          </div>
        </div>
      </div>

      {/* ─── Main Section: Team Workload Radar & Milestone Approvals ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT (7 cols): Team Workload & Delegation Radar */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-syne font-bold text-foreground flex items-center gap-2">
                <Users size={18} className="text-primary" />
                Branch Team Workload Radar
              </h2>
              <p className="text-xs text-muted-foreground">Monitor real-time task loads and balance customer assignments</p>
            </div>
            <button
              onClick={() => navigate('/employee/team')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Full Staff Directory <ChevronRight size={14} />
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {employees.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No employees registered under this branch yet.
              </div>
            ) : (
              employees.map(emp => {
                const empActiveJobs = allJobs.filter(j =>
                  (j.employee_id === emp.id || j.ops_employee_id === emp.id) &&
                  j.status !== 'completed' && j.status !== 'cancelled'
                ).length;

                const isOverloaded = empActiveJobs >= 8;
                const isOptimal = empActiveJobs >= 3 && empActiveJobs < 8;

                return (
                  <div key={emp.id} className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                        {emp.full_name?.slice(0, 2).toUpperCase() || 'ST'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground truncate">{emp.full_name}</h4>
                          {emp.is_manager && (
                            <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.2 rounded font-bold uppercase">
                              Manager
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{emp.role} • {emp.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Workload Indicator */}
                      <div className="text-right">
                        <span className={`text-sm font-bold font-mono ${isOverloaded ? 'text-amber-500' : isOptimal ? 'text-emerald-500' : 'text-foreground'}`}>
                          {empActiveJobs} Active Jobs
                        </span>
                        <span className={`block text-[9px] font-bold uppercase ${emp.is_active ? 'text-emerald-400' : 'text-gray-400'
                          }`}>
                          {emp.is_active ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      {/* Quick Assign / Delegate Button */}
                      <button
                        onClick={() => {
                          setSelectedEmployeeForDelegation(emp);
                          setIsAllocationModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-muted border border-border hover:border-primary/40 rounded-lg text-xs font-bold text-foreground transition-all hover:bg-card"
                      >
                        Allocate
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT (5 cols): Milestone & Payment Approvals Queue */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-syne font-bold text-foreground flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                Operational Sign-Off Queue
              </h2>
              <p className="text-xs text-muted-foreground">Milestones & custom terms requiring manager approval</p>
            </div>
            <button
              onClick={() => navigate('/employee/approvals')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              All Approvals <ChevronRight size={14} />
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {pendingMilestoneJobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 opacity-60" />
                <p>All job milestones and payment terms are up to date!</p>
              </div>
            ) : (
              pendingMilestoneJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/employee/tasks?jobId=${job.id}`)}
                  className="p-3 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-primary">{job.job_code}</span>
                    <span className="text-[9px] uppercase font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {job.client_name} - {job.service_name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Handler: {job.employee_name}</span>
                    <span className="font-mono font-semibold text-foreground">OMR {job.total_fee.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Allocation Modal for quick lead/job transfer */}
      {isAllocationModalOpen && (
        <WorkloadAllocationModal
          isOpen={isAllocationModalOpen}
          onClose={() => setIsAllocationModalOpen(false)}
          activeJobs={allJobs}
          employees={employees}
          selectedEmployeeId={selectedEmployeeForDelegation?.id}
        />
      )}

      {/* Quick Task Modal */}
      {isQuickTaskOpen && (
        <QuickTaskModal
          isOpen={isQuickTaskOpen}
          onClose={() => setIsQuickTaskOpen(false)}
          onJobCreated={() => { }}
        />
      )}

      {/* Daily Cash Drawer & POS Reconciliation Modal */}
      {isReconciliationOpen && (
        <DailyReconciliationModal
          isOpen={isReconciliationOpen}
          onClose={() => setIsReconciliationOpen(false)}
        />
      )}

      {/* Physical Document & Asset Custody Vault Modal */}
      {isVaultOpen && (
        <DocumentVaultModal
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
        />
      )}

      {/* Smart Round-Robin Distribution Modal */}
      <RoundRobinDistributionModal
        isOpen={isRoundRobinOpen}
        onClose={() => setIsRoundRobinOpen(false)}
        unassignedLeads={unassignedLeads}
        employees={employees}
        allJobs={allJobs}
        allLeads={leads}
      />

      {/* Client Satisfaction & Escalations Modal */}
      <ClientEscalationsModal
        isOpen={isEscalationsOpen}
        onClose={() => setIsEscalationsOpen(false)}
      />

    </div>
  );
};

export default BranchOverviewDashboard;
