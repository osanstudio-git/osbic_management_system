import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Clock, CheckCircle2, XCircle, 
  AlertCircle, DollarSign, Briefcase, User, 
  Calendar, FileText, ChevronRight, Check, X, Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useAdminJobs, useOperationalRequests, useResolveOperationalRequest } from '../../hooks/shared/useJobs';
import { useInvoices } from '../../hooks/employee/useInvoices';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const BranchApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const [activeTab, setActiveTab] = useState<'milestones' | 'payments' | 'sla'>('milestones');

  const { data: allJobs = [], isLoading: loadingJobs, refetch: refetchJobs } = useAdminJobs(branchId);
  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useInvoices();
  const { data: slaRequests = [], isLoading: loadingSLA } = useOperationalRequests();
  const { mutate: resolveSlaRequest, isPending: isResolvingSla } = useResolveOperationalRequest();

  // 1. Pending Milestone Approvals: Jobs in progress with steps pending verification
  const pendingMilestoneJobs = allJobs.filter(j => 
    j.status !== 'completed' && j.status !== 'cancelled'
  );

  // 2. Custom Payment Schedule Approvals: Quotations with custom payment schedules
  const customPaymentQuotations = invoices.filter(inv => 
    inv.type === 'quotation' && 
    inv.metadata?.paymentScheduleType === 'custom' &&
    inv.status === 'draft'
  );

  // 3. Branch SLA Requests
  const branchSlaRequests = (slaRequests || []).filter((req: any) => {
    if (!branchId) return true;
    const matchingJob = allJobs.find(j => j.id === req.job_id);
    return !!matchingJob;
  });

  const handleApproveMilestone = async (jobId: string, stepName?: string) => {
    try {
      // Advance job workflow
      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'in_progress', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', jobId);

      if (error) throw error;
      toast.success(`Milestone approved for job`);
      refetchJobs();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to approve milestone');
    }
  };

  const handleApproveCustomPayment = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          metadata: {
            ...invoices.find(i => i.id === invoiceId)?.metadata,
            managerApproved: true,
            approvedBy: profile?.full_name,
            approvedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;
      toast.success('Custom payment schedule approved!');
      refetchInvoices();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to approve custom payment schedule');
    }
  };

  const handleSlaAction = (request: any, action: 'approved' | 'rejected') => {
    resolveSlaRequest({
      requestId: request.id,
      action,
      type: request.type,
      jobId: request.job_id,
      metadata: request.metadata
    }, {
      onSuccess: () => {
        toast.success(`SLA Request ${action} successfully`);
      },
      onError: (err: any) => {
        toast.error(`Error resolving request: ${err.message}`);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
            <Building2 size={14} />
            <span>{selectedBranch?.name || 'Branch'} Approvals & Governance</span>
          </div>
          <h1 className="text-3xl font-syne font-bold text-foreground">
            Operational Approvals Control Room
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review job milestones, sign off on custom payment terms, and resolve operational SLA extensions.
          </p>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex bg-card border border-border p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'milestones'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle2 size={14} />
          Milestones & Stage Progression
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign size={14} />
          Custom Payment Terms
          {customPaymentQuotations.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('sla')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'sla'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock size={14} />
          SLA Extensions & Exceptions
          {branchSlaRequests.filter((r: any) => r.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* ─── TAB 1: Milestones & Progression ─── */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Active Jobs Requiring Milestone Review</h3>
            <span className="text-xs text-muted-foreground">{pendingMilestoneJobs.length} active jobs in branch</span>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
            {pendingMilestoneJobs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 opacity-60" />
                <p>No jobs pending milestone approvals at this time.</p>
              </div>
            ) : (
              pendingMilestoneJobs.slice(0, 15).map(job => (
                <div key={job.id} className="p-5 hover:bg-muted/15 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{job.job_code}</span>
                      <span className="text-[10px] uppercase font-bold bg-muted px-2 py-0.5 rounded-md border border-border">
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground">{job.client_name} - {job.service_name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Handler: <span className="text-foreground font-medium">{job.employee_name}</span> • Progress: {job.completed_steps} / {job.total_steps || 1} steps
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => navigate(`/employee/tasks?jobId=${job.id}`)}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-xl text-xs font-bold text-foreground transition-all"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApproveMilestone(job.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      Approve & Advance
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Custom Payment Terms Approvals ─── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Quotations with Custom Payment Milestones</h3>
            <span className="text-xs text-muted-foreground">{customPaymentQuotations.length} quotations awaiting review</span>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
            {customPaymentQuotations.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 opacity-60" />
                <p>No custom payment schedules awaiting approval.</p>
              </div>
            ) : (
              customPaymentQuotations.map(inv => (
                <div key={inv.id} className="p-5 hover:bg-muted/15 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{inv.invoice_number || 'DRAFT'}</span>
                      <span className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Custom Schedule
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground">{inv.client?.full_name || inv.lead?.contact_name || 'Client'}</h4>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                      <span>Total: <strong className="text-foreground font-mono">OMR {inv.total_amount.toFixed(3)}</strong></span>
                      <span>Advance: <strong className="text-foreground">{inv.metadata?.advanceMilestone || 'On Signing'}</strong></span>
                      <span>Balance: <strong className="text-foreground">{inv.metadata?.balanceMilestone || 'On Completion'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => navigate(`/employee/quotations/${inv.id}`)}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-xl text-xs font-bold text-foreground transition-all"
                    >
                      Inspect Quote
                    </button>
                    <button
                      onClick={() => handleApproveCustomPayment(inv.id!)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      Approve Payment Terms
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: SLA & Extensions Approvals ─── */}
      {activeTab === 'sla' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">SLA Deadline Extensions & Deletions</h3>
            <span className="text-xs text-muted-foreground">{branchSlaRequests.length} requests</span>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
            {branchSlaRequests.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 opacity-60" />
                <p>No operational SLA extension requests at this time.</p>
              </div>
            ) : (
              branchSlaRequests.map((req: any) => (
                <div key={req.id} className="p-5 hover:bg-muted/15 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                        req.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {req.status}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{req.type?.replace('_', ' ')}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      Requested by: {req.requester?.full_name || 'Staff Member'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Reason: <span className="text-foreground italic">{req.reason || 'No specific notes'}</span>
                    </p>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleSlaAction(req, 'rejected')}
                        disabled={isResolvingSla}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold transition-all"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleSlaAction(req, 'approved')}
                        disabled={isResolvingSla}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        Approve Extension
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default BranchApprovals;
