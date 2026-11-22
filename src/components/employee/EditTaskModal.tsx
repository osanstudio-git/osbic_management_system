import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, Calendar, Coins, User, UserCheck, FileText, 
  CheckCircle2, AlertCircle, Loader2, Edit3, ShieldAlert, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onUpdated?: () => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  job,
  onUpdated
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // Editable Form Fields
  const [clientId, setClientId] = useState('');
  const [salesEmployeeId, setSalesEmployeeId] = useState('');
  const [opsEmployeeId, setOpsEmployeeId] = useState('');
  const [customName, setCustomName] = useState('');
  const [startedDate, setStartedDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [workFee, setWorkFee] = useState<string>('0');
  const [govFee, setGovFee] = useState<string>('0');
  const [clientPaysGovFee, setClientPaysGovFee] = useState(false);
  const [syncPaidStatus, setSyncPaidStatus] = useState(true);
  const [reason, setReason] = useState('');

  // Auto-calculated total fee
  const numWorkFee = parseFloat(workFee) || 0;
  const numGovFee = parseFloat(govFee) || 0;
  const calculatedTotal = numWorkFee + numGovFee;

  useEffect(() => {
    if (!isOpen || !job) return;

    // Initialize values from job
    setClientId(job.client_id || '');
    setSalesEmployeeId(job.sales_employee_id || job.assigned_by || '');
    setOpsEmployeeId(job.ops_employee_id || '');
    setCustomName(job.custom_name || job.service_name || '');
    
    // In case job.ops_employee_id is not populated on master job record, inspect job_services
    if (!job.ops_employee_id && job.id) {
      supabase
        .from('job_services')
        .select('ops_employee_id')
        .eq('job_id', job.id)
        .not('ops_employee_id', 'is', null)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0 && data[0]?.ops_employee_id) {
            setOpsEmployeeId(data[0].ops_employee_id);
          }
        });
    }
    
    const sDate = job.started_date || job.started_at || job.created_at;
    setStartedDate(sDate ? sDate.split('T')[0] : '');

    const cDate = job.completed_at || sDate;
    setCompletedDate(cDate ? cDate.split('T')[0] : '');

    setWorkFee(String(job.work_fee ?? 0));
    setGovFee(String(job.ministry_fee ?? 0));
    setClientPaysGovFee(Boolean(job.client_pays_ministry_fee));
    setSyncPaidStatus(Boolean(job.remaining_paid || job.advance_paid));
    setReason('');

    // Load clients and staff for dropdowns
    const loadReferences = async () => {
      try {
        const [{ data: clientList }, { data: staffList }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, phone, client_code').eq('role', 'client').order('full_name'),
          supabase.from('profiles').select('id, full_name, role, department').in('role', ['admin', 'employee']).order('full_name')
        ]);
        if (clientList) setClients(clientList);
        if (staffList) setStaff(staffList);
      } catch (err) {
        console.warn('Error loading references for EditTaskModal:', err);
      }
    };

    loadReferences();
  }, [isOpen, job]);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error('Please select a client');
      return;
    }
    if (!startedDate) {
      toast.error('Please select a start date');
      return;
    }

    setLoading(true);
    try {
      const startedIso = new Date(`${startedDate}T12:00:00Z`).toISOString();
      const completedIso = job.status === 'completed' && completedDate
        ? new Date(`${completedDate}T12:00:00Z`).toISOString()
        : job.completed_at;

      const billableGovFee = clientPaysGovFee ? 0 : numGovFee;
      const netTotalToCollect = numWorkFee + billableGovFee;

      const advanceAmt = syncPaidStatus && job.remaining_paid 
        ? netTotalToCollect 
        : Number(job.advance_amount || 0);

      const remainingAmt = syncPaidStatus && job.remaining_paid
        ? 0
        : Math.max(0, netTotalToCollect - advanceAmt);

      const isFullyPaid = (job.remaining_paid || remainingAmt <= 0);

      // 1. Update jobs table
      const jobUpdate: any = {
        client_id: clientId,
        sales_employee_id: salesEmployeeId || null,
        ops_employee_id: opsEmployeeId || null,
        assigned_by: salesEmployeeId || job.assigned_by || profile?.id,
        custom_name: customName.trim(),
        work_fee: numWorkFee,
        ministry_fee: numGovFee,
        total_fee: clientPaysGovFee ? numWorkFee : calculatedTotal,
        client_pays_ministry_fee: clientPaysGovFee,
        started_at: startedIso,
        created_at: startedIso,
        advance_amount: advanceAmt,
        remaining_amount: remainingAmt,
        remaining_paid: isFullyPaid
      };

      if (job.status === 'completed' && completedIso) {
        jobUpdate.completed_at = completedIso;
      }

      if (reason.trim()) {
        const auditLog = `\n[UPDATED on ${new Date().toLocaleDateString()} by ${profile?.full_name || 'Staff'}]: ${reason.trim()}`;
        jobUpdate.notes = (job.notes || '') + auditLog;
      }

      const { error: jobErr } = await supabase
        .from('jobs')
        .update(jobUpdate)
        .eq('id', job.id);

      if (jobErr) throw jobErr;

      // 2. Cascade update to job_services
      const serviceUpdate: any = {
        work_fee: numWorkFee,
        ministry_fee: numGovFee,
        total_fee: calculatedTotal,
        client_id: clientId,
        ops_employee_id: opsEmployeeId || null
      };
      if (job.status === 'completed' && completedIso) {
        serviceUpdate.completed_at = completedIso;
      }
      if (numGovFee > 0) {
        serviceUpdate.gov_fee_actual_paid = numGovFee;
      }

      await supabase
        .from('job_services')
        .update(serviceUpdate)
        .eq('job_id', job.id);

      // Notify ops employee if newly assigned or reassigned
      if (opsEmployeeId && opsEmployeeId !== job.ops_employee_id) {
        try {
          await supabase.from('notifications').insert({
            recipient_id: opsEmployeeId,
            sender_id: profile?.id || null,
            job_id: job.id,
            type: 'action_required',
            title_en: `Task Assigned to You: ${job.job_code || ''}`,
            title_ar: `تم تعيين معاملة إليك: ${job.job_code || ''}`,
            body_en: `${profile?.full_name || 'Staff'} assigned/reassigned task (${job.job_code || ''}) to you.`,
            body_ar: `قام ${profile?.full_name || 'أحد الموظفين'} بتحويل المعاملة (${job.job_code || ''}) إليك.`
          });
        } catch (notifErr) {
          console.warn('Could not send ops notification:', notifErr);
        }
      }

      // 3. Cascade update to invoices
      await supabase
        .from('invoices')
        .update({
          client_id: clientId,
          subtotal: numWorkFee,
          total_amount: calculatedTotal
        })
        .eq('job_id', job.id);

      // 4. Cascade update to job_expenses
      if (numGovFee > 0) {
        await supabase
          .from('job_expenses')
          .update({
            amount: numGovFee,
            created_at: startedIso
          })
          .eq('job_id', job.id);
      }

      // 5. Add timeline event
      try {
        await supabase.from('job_service_timeline').insert({
          job_id: job.id,
          action: 'edited_task_details',
          notes: `Updated task details & fees (Work: ${numWorkFee.toFixed(3)} OMR, Gov: ${numGovFee.toFixed(3)} OMR, Total: ${calculatedTotal.toFixed(3)} OMR). Reason: ${reason.trim() || 'Data correction'}`,
          changed_by: profile?.id
        } as any);
      } catch (tErr) {
        console.warn('Could not record timeline edit:', tErr);
      }

      toast.success('Task details, financials, and reports updated successfully');
      onClose();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error('Error updating task:', err);
      toast.error(err.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Edit3 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Edit Task Details & Financials</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {job.job_code}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Updates synchronize across jobs, invoices, expenses, and financial reports.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Section 1: Client & Team Assignment */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User size={13} className="text-primary" />
                <span>Client Name *</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all cursor-pointer"
              >
                <option value="">-- Select Client --</option>
                {clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.full_name} {cli.client_code ? `(${cli.client_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Sales Rep vs Operations Specialist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* 1. Sales Rep (Lead Generation / Commission) */}
              <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <UserCheck size={13} />
                    <span>Assigned Sales Rep</span>
                  </label>
                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    Sales Credit
                  </span>
                </div>
                <select
                  value={salesEmployeeId}
                  onChange={(e) => setSalesEmployeeId(e.target.value)}
                  className="w-full bg-background/60 border border-amber-500/30 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all cursor-pointer"
                >
                  <option value="">-- Unassigned / Direct --</option>
                  {staff.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.department ? `(${emp.department})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Credited with bringing the deal. Used for sales reports and commissions.
                </p>
              </div>

              {/* 2. Operations Specialist (Task Execution / Ministry Work) */}
              <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Briefcase size={13} />
                    <span>Assigned Ops Employee</span>
                  </label>
                  <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Work Execution
                  </span>
                </div>
                <select
                  value={opsEmployeeId}
                  onChange={(e) => setOpsEmployeeId(e.target.value)}
                  className="w-full bg-background/60 border border-blue-500/30 focus:border-blue-400 rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all cursor-pointer"
                >
                  <option value="">-- Unassigned (No Ops Specialist) --</option>
                  {staff.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.department ? `(${emp.department})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Ops/PRO employee doing the work. Reassign here if stuck under sales.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Service Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText size={13} className="text-primary" />
              <span>Service Name / Title</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Visa Processing, Commercial Registration"
              className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none transition-all"
            />
          </div>

          {/* Section 3: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Task Start / Registered Date *</span>
              </label>
              <input
                type="date"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                required
                className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none transition-all"
              />
            </div>

            {job.status === 'completed' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Completion Date (تاريخ الإنجاز)</span>
                </label>
                <input
                  type="date"
                  value={completedDate}
                  onChange={(e) => setCompletedDate(e.target.value)}
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Section 4: Financials & Fees */}
          <div className="p-4 bg-muted/15 border border-border/80 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Coins size={13} />
                <span>Financial Breakdown (الأتعاب والرسوم الحكومية)</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Currency: OMR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Work Fee (أتعاب المكتب)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={workFee}
                  onChange={(e) => setWorkFee(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Gov Fee (رسوم حكومية)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={govFee}
                  onChange={(e) => setGovFee(e.target.value)}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-primary block mb-1">
                  Total Fee (الإجمالي)
                </label>
                <div className="w-full bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 text-xs font-black text-primary flex items-center justify-between">
                  <span>{(clientPaysGovFee ? numWorkFee : calculatedTotal).toFixed(3)} OMR</span>
                  {clientPaysGovFee && (
                    <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">(Gov Fee Direct)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={clientPaysGovFee}
                  onChange={(e) => setClientPaysGovFee(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                />
                <span>Client pays ministry fee directly</span>
              </label>

              {job.remaining_paid && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-emerald-400 font-semibold">
                  <input
                    type="checkbox"
                    checked={syncPaidStatus}
                    onChange={(e) => setSyncPaidStatus(e.target.checked)}
                    className="rounded border-border text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Sync payment balance to new total</span>
                </label>
              )}
            </div>
          </div>

          {/* Section 5: Reason for modification (Audit Trail) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-amber-400" />
              <span>Reason for Modification (سبب التعديل - للتدقيق الداخلي)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Corrected typo in government fee, client changed"
              className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Save & Sync All Reports</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
