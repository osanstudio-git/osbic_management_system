import { Clock, Shield, DollarSign, AlertCircle, Eye, Download, CheckCircle2, FileText, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useJobTimeline } from '../../hooks/employee/useTimeline';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import WorkflowProgressTab from './WorkflowProgressTab';
import toast from 'react-hot-toast';

interface Props {
  jobId: string;
  job?: any;
  steps?: any[];
  isEmployee?: boolean;
  isAdmin?: boolean;
  onSwitchTab?: (tab: any) => void;
}

export const JobTimelinePanel = ({ 
  jobId, 
  job, 
  steps = [], 
  isEmployee = false, 
  isAdmin = false, 
  onSwitchTab 
}: Props) => {
  const { data: timeline = [], isLoading: isTimelineLoading } = useJobTimeline(jobId);

  // Query payments for the job
  const { data: payments = [], isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['job_payments', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_payments')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Query custom invoices for the job
  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['job_invoices', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Query expenses for the job
  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['job_expenses_timeline', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_expenses')
        .select(`
          *,
          service:job_services(service_name),
          creator:profiles!job_expenses_created_by_fkey(full_name)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = isTimelineLoading || isPaymentsLoading || isInvoicesLoading || isExpensesLoading;

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12 animate-pulse text-sm">Loading timeline...</div>;
  }

  // 1. Convert timeline entries to a unified format
  const unifiedEntries: any[] = timeline.map((entry: any) => ({
    id: entry.id,
    type: 'timeline',
    timestamp: new Date(entry.changed_at),
    data: entry
  }));

  // 1.5. Add recorded expenses (from job_expenses table)
  expenses.forEach((expense: any) => {
    unifiedEntries.push({
      id: `expense-rec-${expense.id}`,
      type: 'expense_recorded',
      timestamp: new Date(expense.created_at),
      data: {
        title: `Expense Logged: ${expense.service?.service_name || 'Ministry Fee'}`,
        description: `${expense.creator?.full_name || 'An employee'} logged a government fee expense of ${Number(expense.amount).toFixed(3)} OMR. Notes: ${expense.notes || 'None'}. Status: ${expense.status === 'pending_approval' ? 'PENDING APPROVAL' : expense.status.toUpperCase()}`,
        status: expense.status,
        amount: expense.amount,
        receiptUrl: expense.receipt_url
      }
    });
  });

  // 2. Add advance payment event if paid (legacy fallback check)
  if (job?.advance_paid && job?.advance_paid_at) {
    const hasVerification = payments.some(p => p.status === 'verified' && Math.abs(Number(p.amount) - Number(job.advance_due_amount)) < 0.01);
    if (!hasVerification) {
      unifiedEntries.push({
        id: `advance-payment-${job.id}`,
        type: 'financial',
        timestamp: new Date(job.advance_paid_at),
        data: {
          title: 'Advance Payment Confirmed',
          description: `Advance deposit of ${Number(job.advance_due_amount || 0).toFixed(3)} OMR confirmed successfully.`,
          amount: job.advance_due_amount
        }
      });
    }
  }

  // 3. Add remaining balance payment event if paid (legacy fallback check)
  if (job?.remaining_paid && job?.remaining_paid_at) {
    const hasVerification = payments.some(p => p.status === 'verified' && Math.abs(Number(p.amount) - Number(job.remaining_due_amount)) < 0.01);
    if (!hasVerification) {
      unifiedEntries.push({
        id: `remaining-payment-${job.id}`,
        type: 'financial',
        timestamp: new Date(job.remaining_paid_at),
        data: {
          title: 'Final Payment Confirmed',
          description: `Final balance of ${Number(job.remaining_due_amount || 0).toFixed(3)} OMR confirmed successfully.`,
          amount: job.remaining_due_amount
        }
      });
    }
  }

  // 4. Add recorded payments (from job_payments table)
  payments.forEach((payment: any) => {
    const methodText = payment.payment_method?.replace('_', ' ').toUpperCase() || 'BANK TRANSFER';
    
    // Add "Payment Recorded" (pending or verified status)
    unifiedEntries.push({
      id: `payment-rec-${payment.id}`,
      type: 'payment_recorded',
      timestamp: new Date(payment.created_at),
      data: {
        title: `Payment Recorded (${methodText})`,
        description: `A payment of ${Number(payment.amount).toFixed(3)} OMR has been submitted and recorded. Reference: ${payment.reference_number || 'N/A'}. Status: ${payment.status.toUpperCase()}`,
        status: payment.status,
        amount: payment.amount
      }
    });

    // If verified, add "Receipt Generated & Payment Verified"
    if (payment.status === 'verified') {
      const verifiedAt = payment.updated_at ? new Date(payment.updated_at) : new Date(payment.created_at);
      unifiedEntries.push({
        id: `payment-ver-${payment.id}`,
        type: 'receipt_generated',
        timestamp: verifiedAt,
        data: {
          title: 'Receipt Generated & Payment Verified',
          description: `Official Receipt reference ${payment.reference_number || 'REC-AUTO'} has been generated. Payment of ${Number(payment.amount).toFixed(3)} OMR is verified by Accounts.`,
          amount: payment.amount
        }
      });
    }
  });

  // 5. Add custom invoices/quotations (from invoices table)
  invoices.forEach((inv: any) => {
    const typeLabel = inv.type === 'quotation' ? 'Quotation' : 'Invoice';
    unifiedEntries.push({
      id: `invoice-gen-${inv.id}`,
      type: 'invoice_generated',
      timestamp: new Date(inv.created_at),
      data: {
        title: `${typeLabel} Generated`,
        description: `${typeLabel} ${inv.invoice_number} generated for this project with total amount of ${Number(inv.total_amount).toFixed(3)} OMR. Status: ${inv.status.toUpperCase()}`,
        status: inv.status,
        invoiceNumber: inv.invoice_number,
        type: inv.type
      }
    });

    if (inv.status === 'paid' && inv.paid_date) {
      unifiedEntries.push({
        id: `invoice-paid-${inv.id}`,
        type: 'invoice_paid',
        timestamp: new Date(inv.paid_date),
        data: {
          title: `${typeLabel} Settled (PAID)`,
          description: `${typeLabel} ${inv.invoice_number} has been fully settled and paid.`,
          invoiceNumber: inv.invoice_number
        }
      });
    }
  });

  // 6. Sort all entries chronologically (oldest first)
  const sortedEntries = unifiedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Render Timeline Checklist & Log List
  const renderTimelineLogs = () => {
    if (sortedEntries.length === 0) {
      return (
        <div className="text-center border-2 border-dashed border-border rounded-3xl p-12 bg-card/20">
          <Clock size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">No timeline events yet</p>
          <p className="text-xs text-muted-foreground">Status updates, invoices, and payments will appear here.</p>
        </div>
      );
    }

    return (
      <div className="relative pl-6 border-l border-border/60 space-y-8">
        {sortedEntries.map((entry) => {
          if (entry.type === 'expense_recorded') {
            const isApproved = entry.data.status === 'approved';
            const isRejected = entry.data.status === 'rejected';
            
            const handleDownloadReceipt = async () => {
              if (!entry.data.receiptUrl) return;
              try {
                const { data, error } = await supabase.storage.from('documents').createSignedUrl(entry.data.receiptUrl, 3600);
                if (error) throw error;
                if (data?.signedUrl) {
                  window.open(data.signedUrl, '_blank');
                }
              } catch (err) {
                toast.error('Could not open receipt document.');
              }
            };

            return (
              <div key={entry.id} className="relative group">
                <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all ${
                  isApproved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                  isRejected ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                }`} />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className={`text-[8px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5 ${
                      isApproved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      isRejected ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <Wallet size={8} /> Expense Logged
                    </span>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${
                      isApproved ? 'text-emerald-400' :
                      isRejected ? 'text-rose-400' : 'text-amber-400'
                    }`}>{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                    {entry.data.receiptUrl && (
                      <button
                        onClick={handleDownloadReceipt}
                        className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors border border-primary/25"
                      >
                        <Eye size={10} /> View Receipt Document
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Legacy financial events
          if (entry.type === 'financial') {
            return (
              <div key={entry.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                      <DollarSign size={8} /> Deposit
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Payment recorded
          if (entry.type === 'payment_recorded') {
            const isVerified = entry.data.status === 'verified';
            const isRejected = entry.data.status === 'rejected';
            return (
              <div key={entry.id} className="relative group">
                <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all ${
                  isVerified ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                  isRejected ? 'bg-rose-500' : 'bg-amber-400'
                }`} />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className={`text-[8px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5 ${
                      isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      isRejected ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <DollarSign size={8} /> Payment Logged
                    </span>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${
                      isVerified ? 'text-emerald-400' :
                      isRejected ? 'text-rose-400' : 'text-amber-400'
                    }`}>{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Receipt generated
          if (entry.type === 'receipt_generated') {
            return (
              <div key={entry.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                      <CheckCircle2 size={8} /> Receipt
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Invoice generated
          if (entry.type === 'invoice_generated') {
            const isPaid = entry.data.status === 'paid';
            const isQuotation = entry.data.type === 'quotation';
            return (
              <div key={entry.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all bg-[#3b98d3] shadow-[0_0_8px_rgba(59,152,211,0.4)]" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className="text-[8px] bg-[#3b98d3]/10 text-[#3b98d3] border border-[#3b98d3]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                      <FileText size={8} /> {isQuotation ? 'Quotation' : 'Invoice'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#3b98d3]">{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Invoice paid
          if (entry.type === 'invoice_paid') {
            return (
              <div key={entry.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                      <CheckCircle2 size={8} /> Settled
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">{entry.data.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.data.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Standard timeline status updates
          const tEntry = entry.data;
          const isDelay = tEntry.is_delay_event || tEntry.to_status === 'on_hold';
          const isApprove = tEntry.to_status === 'gov_approved' || tEntry.to_status === 'completed';
          const isReject = tEntry.to_status === 'gov_rejected' || tEntry.to_status === 'cancelled';

          // Format status label for human reading
          const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          // Format days in previous stage as a clear label
          const formatDaysLabel = (days: number) => {
            if (days < 1) {
              const hours = Math.round(days * 24);
              return hours <= 1 ? 'Less than 1 hour in previous stage' : `${hours} hours in previous stage`;
            }
            return `${days} day${days !== 1 ? 's' : ''} in previous stage`;
          };

          return (
            <div key={entry.id} className="relative group">
              <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background transition-all ${
                isDelay ? 'bg-yellow-400' :
                isApprove ? 'bg-emerald-500' :
                isReject ? 'bg-red-500' : 'bg-primary'
              }`} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {format(entry.timestamp, 'MMM d, yyyy · h:mm a')}
                  </span>
                  {tEntry.days_in_previous_stage !== null && tEntry.days_in_previous_stage > 0 && (
                    <span
                      className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded"
                      title="How long this task sat in the previous status before this change was made"
                    >
                      ⏱ {formatDaysLabel(tEntry.days_in_previous_stage)}
                    </span>
                  )}
                </div>

                <div>
                  {/* Service name badge */}
                  {tEntry.service_name && (
                    <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                      {tEntry.service_name}
                    </p>
                  )}
                  <p className="text-sm font-bold text-foreground">
                    Status changed to <span className={
                      isDelay ? 'text-yellow-400' :
                      isApprove ? 'text-emerald-500' :
                      isReject ? 'text-red-500' : 'text-primary'
                    }>{formatStatus(tEntry.to_status)}</span>
                    {tEntry.from_status && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        (was: {formatStatus(tEntry.from_status)})
                      </span>
                    )}
                  </p>
                  {tEntry.changed_by_name && (
                    <p className="text-xs text-muted-foreground font-semibold">
                      by {tEntry.changed_by_name} ({tEntry.changed_by_role})
                    </p>
                  )}
                </div>

                {tEntry.reason && (
                  <div className={`text-xs p-3 rounded-xl border ${
                    isDelay ? 'bg-yellow-400/5 border-yellow-400/20 text-yellow-400/95' :
                    isReject ? 'bg-red-500/5 border-red-500/20 text-red-400/95' :
                    'bg-muted/10 border-border text-muted-foreground'
                  }`}>
                    {isDelay && <p className="font-bold text-[9px] uppercase tracking-widest mb-0.5">Delay Reason</p>}
                    {isReject && <p className="font-bold text-[9px] uppercase tracking-widest mb-0.5">Rejection/Cancellation Reason</p>}
                    {tEntry.reason}
                    {tEntry.is_client_caused && (
                      <span className="ml-2 bg-red-400/10 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Client Caused</span>
                    )}
                  </div>
                )}

                {tEntry.government_ref && (
                  <p className="text-xs text-cyan-400 font-mono">
                    Gov Ref: {tEntry.government_ref}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hasSteps = steps && steps.length > 0;
  
  const overdueStep = steps?.find((s: any) => {
    if (s.status !== 'in_progress' && s.status !== 'pending') return false;
    if (!s.deadline) return false;
    return new Date(s.deadline).getTime() < Date.now();
  });

  if (hasSteps) {
    return (
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column: Milestones sequence checklist */}
        <div className="flex-1 min-w-0 w-full">
          <WorkflowProgressTab job={job} steps={steps} isEmployee={isEmployee} isAdmin={isAdmin} onSwitchTab={onSwitchTab} />
        </div>

        {/* Right Column: Execution Timeline history log */}
        <div className="w-full lg:w-[420px] shrink-0 bg-card border border-border rounded-[32px] p-6 md:p-8 shadow-2xl h-fit">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1 font-syne">Execution Timeline</h3>
            <p className="text-xs text-muted-foreground">Historical trail of status changes, reassignments, invoices, and payments</p>
          </div>
          {overdueStep && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-bold">Execution Delayed</p>
                <p className="opacity-80 mt-0.5">Milestone step "{overdueStep.name_en}" has exceeded its expected deadline.</p>
              </div>
            </div>
          )}
          {renderTimelineLogs()}
        </div>
      </div>
    );
  }

  // Full width fallback when there are no roadmap steps
  return (
    <div className="bg-card border border-border rounded-[32px] p-6 md:p-8 shadow-2xl max-w-3xl">
      <div className="mb-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1 font-syne">Execution Timeline</h3>
        <p className="text-xs text-muted-foreground">Historical trail of status changes, reassignments, invoices, and payments</p>
      </div>
      {renderTimelineLogs()}
    </div>
  );
};
export default JobTimelinePanel;
