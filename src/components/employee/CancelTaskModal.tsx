import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Trash2, AlertTriangle, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('Accidental duplicate entry');
  const [permanentDelete, setPermanentDelete] = useState(false);

  const isAdmin = profile?.role === 'admin' || (profile as any)?.is_manager === true;

  if (!isOpen || !job) return null;

  const handleCancelOrDelete = async () => {
    if (!reason.trim()) {
      toast.error('Please specify a reason');
      return;
    }

    setLoading(true);
    try {
      if (permanentDelete && isAdmin) {
        // Permanent Hard Delete (Admins only for pure test/mistake entries)
        // 1. Delete associated documents and records
        await supabase.from('job_service_documents').delete().eq('job_id', job.id);
        await supabase.from('job_service_steps').delete().eq('job_id', job.id);
        await supabase.from('job_sub_tasks').delete().eq('job_id', job.id);
        await supabase.from('job_service_timeline').delete().eq('job_id', job.id);
        await supabase.from('job_expenses').delete().eq('job_id', job.id);
        await supabase.from('invoices').delete().eq('job_id', job.id);
        await supabase.from('job_services').delete().eq('job_id', job.id);
        
        // 2. Delete master job
        const { error: delErr } = await supabase.from('jobs').delete().eq('id', job.id);
        if (delErr) throw delErr;

        toast.success(`Task ${job.job_code} permanently purged from system`);
      } else {
        // Safe Business Cancellation (Soft Delete)
        const auditNote = `\n[CANCELLED on ${new Date().toLocaleDateString()} by ${profile?.full_name || 'Staff'}]: Reason: ${reason.trim()}`;

        // 1. Update jobs table
        const { error: jobErr } = await supabase
          .from('jobs')
          .update({
            status: 'cancelled',
            notes: (job.notes || '') + auditNote
          })
          .eq('id', job.id);

        if (jobErr) throw jobErr;

        // 2. Update job_services
        await supabase
          .from('job_services')
          .update({ status: 'cancelled' })
          .eq('job_id', job.id);

        // 3. Update invoices
        await supabase
          .from('invoices')
          .update({ status: 'cancelled' })
          .eq('job_id', job.id);

        // 4. Cancel pending sub-tasks
        await supabase
          .from('job_sub_tasks')
          .update({ status: 'rejected' })
          .eq('job_id', job.id)
          .neq('status', 'approved');

        // 5. Add audit event to timeline
        try {
          await supabase.from('job_service_timeline').insert({
            job_id: job.id,
            action: 'cancelled_task',
            notes: `Task cancelled by ${profile?.full_name || 'Staff'}. Reason: ${reason.trim()}`,
            changed_by: profile?.id
          } as any);
        } catch (tErr) {
          console.warn('Could not record cancellation timeline:', tErr);
        }

        toast.success(`Task ${job.job_code} has been cancelled and excluded from active reports`);
      }

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
