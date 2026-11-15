import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { X, Trash2, AlertTriangle, Loader2, ShieldCheck, CheckCircle2, DollarSign, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

interface CancelTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onUpdated?: () => void;
}

export const CancelTaskModal: React.FC<CancelTaskModalProps> = ({
  isOpen,
  onClose,
  job,
  onUpdated
}) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('Accidental duplicate entry');
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [paymentsOnJob, setPaymentsOnJob] = useState<any[]>([]);
  const [paymentAction, setPaymentAction] = useState<'void' | 'refund'>('void');

  const isAdmin = profile?.role === 'admin' || (profile as any)?.is_manager === true;

  // Fetch any payments attached to this job
  useEffect(() => {
    if (!isOpen || !job?.id) return;
    const fetchPayments = async () => {
      const { data } = await supabase
        .from('job_payments')
        .select('id, amount, payment_method, status')
        .eq('job_id', job.id);
      if (data) setPaymentsOnJob(data);
    };
    fetchPayments();
  }, [isOpen, job?.id]);

  if (!isOpen || !job) return null;

  const totalPaid = paymentsOnJob.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const handleCancelOrDelete = async () => {
    if (!reason.trim()) {
      toast.error('Please specify a reason');
      return;
    }

    setLoading(true);
    try {
      if (permanentDelete && isAdmin) {
        // Permanent Hard Delete (Admins only for pure test/mistake entries)
        await supabase.from('job_service_documents').delete().eq('job_id', job.id);
        await supabase.from('job_service_steps').delete().eq('job_id', job.id);
        await supabase.from('job_sub_tasks').delete().eq('job_id', job.id);
        await supabase.from('job_service_timeline').delete().eq('job_id', job.id);
        await supabase.from('job_expenses').delete().eq('job_id', job.id);
        await supabase.from('job_payments').delete().eq('job_id', job.id);
        await supabase.from('job_additional_charges').delete().eq('job_id', job.id);
        await supabase.from('invoices').delete().eq('job_id', job.id);
        await supabase.from('job_services').delete().eq('job_id', job.id);
        
        // Also remove from walkin_sales if linked
        await supabase
          .from('walkin_sales')
          .delete()
          .or(`notes.ilike.%${job.id}%,notes.ilike.%${job.job_code}%`);

        // Delete master job
        const { error: delErr } = await supabase.from('jobs').delete().eq('id', job.id);
        if (delErr) throw delErr;

        toast.success(`Task ${job.job_code} permanently purged from system`);
      } else {
        // Safe Business Cancellation (Soft Delete)
        const auditNote = `\n[CANCELLED on ${new Date().toLocaleDateString()} by ${profile?.full_name || 'Staff'}]: Reason: ${reason.trim()}`;

        // 1. Update master job status and zero out balances
        const { error: jobErr } = await supabase
          .from('jobs')
          .update({
            status: 'cancelled',
            advance_amount: 0,
            remaining_amount: 0,
            advance_paid: false,
            remaining_paid: false,
            notes: (job.notes || '') + auditNote
          })
          .eq('id', job.id);

        if (jobErr) throw jobErr;

        // 2. Void or refund any payments attached to this job so finance totals are reduced
        if (paymentsOnJob.length > 0) {
          const newPaymentStatus = paymentAction === 'refund' ? 'refunded' : 'cancelled';
          await supabase
            .from('job_payments')
            .update({
              status: newPaymentStatus,
              notes: `[PAYMENT_${paymentAction.toUpperCase()} on task cancellation by ${profile?.full_name || 'Staff'}]: ${reason.trim()}`
            })
            .eq('job_id', job.id);
        }

        // 3. Cancel matching walkin_sales record if exists
        await supabase
          .from('walkin_sales')
          .update({ status: 'cancelled' })
          .or(`notes.ilike.%${job.id}%,notes.ilike.%${job.job_code}%`);

        // 4. Update job_services
        await supabase
          .from('job_services')
          .update({ status: 'cancelled' })
          .eq('job_id', job.id);

        // 5. Update invoices
        await supabase
          .from('invoices')
          .update({ status: 'cancelled' })
          .eq('job_id', job.id);

        // 6. Cancel pending sub-tasks
        await supabase
          .from('job_sub_tasks')
          .update({ status: 'rejected' })
          .eq('job_id', job.id)
          .neq('status', 'approved');

        // 7. Add audit event to timeline
        try {
          await supabase.from('job_service_timeline').insert({
            job_id: job.id,
            action: 'cancelled_task',
            notes: `Task cancelled by ${profile?.full_name || 'Staff'}. Reason: ${reason.trim()}. Payment handling: ${paymentAction}`,
            changed_by: profile?.id
          } as any);
        } catch (tErr) {
          console.warn('Could not record cancellation timeline:', tErr);
        }

        toast.success(`Task ${job.job_code} cancelled and payments reversed from finance`);
      }

      // Invalidate queries so employee reports & admin finance refresh immediately
      queryClient.invalidateQueries({ queryKey: ['employee', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['walkin_sales'] });
      queryClient.invalidateQueries({ queryKey: ['admin_finance'] });
      queryClient.invalidateQueries({ queryKey: ['sales_team_reports'] });

      onClose();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error('Error cancelling task:', err);
      toast.error(err.message || 'Failed to cancel task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-card border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Cancel / Void Task</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {job.job_code}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {job.service_name || job.custom_name} - {job.client_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-foreground/90 leading-relaxed">
              Cancelling will mark this task as <strong>Cancelled</strong>, release it from the Ops workflow queue, void any linked invoices, and automatically exclude it from active revenue counts.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Reason for Cancellation *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-muted/30 border border-border focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all"
            >
              <option value="Accidental duplicate entry">Accidental duplicate entry (إدخال مكرر بالخطأ)</option>
              <option value="Wrong client or service logged">Wrong client or service logged (بيانات غير صحيحة)</option>
              <option value="Client cancelled request before start">Client cancelled request before start (العميل ألغى المعاملة)</option>
              <option value="Test entry created during training">Test entry created during training (معاملة تجريبية)</option>
              <option value="Other">Other (سبب آخر)</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Specify Reason
              </label>
              <input
                type="text"
                placeholder="Enter details..."
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-muted/30 border border-border focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all"
              />
            </div>
          )}

          {/* Active Payment Handling & Finance Deduction */}
          {totalPaid > 0 && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-rose-400" />
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                    Active Payment Found: {totalPaid.toFixed(3)} OMR
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {paymentsOnJob.length} transaction(s)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This task has recorded payments. To ensure sales reports and finance calculations remain accurate, choose how to treat this money:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentAction('void')}
                  className={`p-3 rounded-xl border text-xs text-left transition-all ${
                    paymentAction === 'void'
                      ? 'bg-rose-500/20 border-rose-500 text-foreground font-bold shadow-sm'
                      : 'bg-background/80 border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-400">
                    <Ban size={14} />
                    <span>Void & Reverse Payment</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-normal">
                    Deducts {totalPaid.toFixed(3)} OMR from sales reports and center revenue.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentAction('refund')}
                  className={`p-3 rounded-xl border text-xs text-left transition-all ${
                    paymentAction === 'refund'
                      ? 'bg-amber-500/20 border-amber-500 text-foreground font-bold shadow-sm'
                      : 'bg-background/80 border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-400">
                    <DollarSign size={14} />
                    <span>Mark as Client Refund</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-normal">
                    Money was collected and returned to client. Records refund voucher.
                  </span>
                </button>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="pt-2 border-t border-border/60">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permanentDelete}
                  onChange={(e) => setPermanentDelete(e.target.checked)}
                  className="rounded border-border text-rose-500 focus:ring-rose-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-rose-400 block">
                    Permanently delete row (Hard purge)
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Completely removes the record and associated data from the database. Use only for accidental test entries.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={handleCancelOrDelete}
            disabled={loading || !reason.trim()}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/20"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            <span>{permanentDelete ? 'Permanently Delete' : 'Confirm Cancellation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
