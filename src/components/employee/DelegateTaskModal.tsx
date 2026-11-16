import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, User, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOpsCoworkers, useDelegateTask } from '../../hooks/employee/useTimeline';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface DelegateTaskModalProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DelegateTaskModal: React.FC<DelegateTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const { data: coworkers = [], isLoading: isLoadingCoworkers } = useOpsCoworkers();
  const delegateMutation = useDelegateTask();

  const [selectedCoworkerId, setSelectedCoworkerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !task) return null;

  // Filter out the current user and the current ops employee
  const eligibleCoworkers = coworkers.filter(
    (c) => c.id !== profile?.id && c.id !== task.ops_employee_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoworkerId) {
      toast.error(isRtl ? 'يرجى اختيار الزميل المراد تفويضه' : 'Please select a coworker');
      return;
    }

    const targetCoworker = coworkers.find((c) => c.id === selectedCoworkerId);
    const targetName = targetCoworker?.full_name || 'Coworker';

    setIsSubmitting(true);
    const toastId = toast.loading(isRtl ? 'جاري تفويض المهمة...' : 'Delegating task...');

    try {
      await delegateMutation.mutateAsync({
        jobServiceId: task.id,
        jobId: task.job_id,
        toEmployeeId: selectedCoworkerId,
        toEmployeeName: targetName,
        reason: reason.trim() || undefined,
        serviceName: task.service_name || task.service?.name_en || 'Service',
        currentStatus: task.status,
      });

      toast.success(
        isRtl
          ? `تم تفويض المهمة بنجاح إلى ${targetName}`
          : `Task successfully delegated to ${targetName}`,
        { id: toastId }
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error delegating task:', err);
      toast.error(err.message || 'Failed to delegate task', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientName = task.applicant_name || task.job?.client?.full_name || 'Client';
  const taskName = task.service_name || task.service?.name_en || 'Task';
  const jobCode = task.job?.job_code || '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border/80 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isRtl ? 'تفويض المهمة إلى زميل' : 'Delegate Task to Coworker'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? 'نقل المسؤولية المباشرة للمهمة إلى زميل مع الاحتفاظ بسجل التسليم'
                    : 'Transfer task execution responsibility while maintaining full audit trail'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Task Snapshot Card */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {jobCode}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {task.status?.toUpperCase()}
                </span>
              </div>
              <h4 className="text-sm font-bold text-foreground">{taskName}</h4>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'العميل / مقدم الطلب:' : 'Client / Applicant:'}{' '}
                <strong className="text-foreground">{clientName}</strong>
              </p>
            </div>

            {/* Select Coworker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>{isRtl ? 'اختر الزميل *' : 'Select Coworker *'}</span>
                {isLoadingCoworkers && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> {isRtl ? 'تحميل...' : 'Loading...'}
                  </span>
                )}
              </label>
              <div className="relative">
                <select
                  value={selectedCoworkerId}
                  onChange={(e) => setSelectedCoworkerId(e.target.value)}
                  disabled={isSubmitting || isLoadingCoworkers}
                  required
                  className="w-full bg-background border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="">
                    {isRtl ? '-- حدد الزميل من فريق العمل --' : '-- Choose a coworker from ops team --'}
                  </option>
                  {eligibleCoworkers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.employee_code ? `(${c.employee_code})` : ''} {c.department ? `· ${c.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {eligibleCoworkers.length === 0 && !isLoadingCoworkers && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  {isRtl
                    ? 'لم يتم العثور على زملاء متاحين حالياً.'
                    : 'No other active coworkers found.'}
                </p>
              )}
            </div>

            {/* Handover Note / Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {isRtl ? 'سبب التفويض / ملاحظة التسليم (اختياري)' : 'Handover Note / Reason (Optional)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                placeholder={
                  isRtl
                    ? 'مثال: مشغول في مراجعة الوزارة اليوم، يرجى استكمال المعاملة...'
                    : 'e.g., Busy with ministry appointments today, please follow up with the submission...'
                }
                rows={3}
                className="w-full bg-background border border-border/80 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-primary transition-all resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                {isRtl
                  ? 'ستظهر هذه الملاحظة في ملف المعاملة وسجل التسليم للزميل المستلم.'
                  : 'This note will appear in the job dossier and activity log for the receiving coworker.'}
              </p>
            </div>

            {/* Explanatory Banner */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] leading-relaxed flex items-start gap-2">
              <Shield size={14} className="shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? 'بمجرد التأكيد، ستنتقل هذه المهمة مباشرة إلى قائمة عمل الزميل وستُزال من قائمة عملك الجارية، مع الاحتفاظ ببيانات مسؤولي المبيعات وسجل المعاملة بالكامل.'
                  : 'Once confirmed, this task will move directly to your coworker’s active work queue and be cleared from your active queue, while keeping sales attribution and history intact.'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground text-xs font-bold transition-all disabled:opacity-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedCoworkerId}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowRightLeft size={13} />
                )}
                <span>{isRtl ? 'تأكيد التفويض' : 'Confirm Delegation'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

