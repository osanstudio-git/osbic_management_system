import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useMyOpsTasks, useUpdateServiceStatus, type StatusUpdatePayload } from '../../hooks/employee/useTimeline';
import { useUploadMultipleServiceDocuments, useDeleteJobServiceDocument } from '../../hooks/employee/useJobServices';
import {
  Clock, CheckCircle2, AlertCircle, Shield, ExternalLink,
  ChevronRight, ChevronDown, X, FileText, Phone, Building2, Calendar,
  Layers, Users, Info, Upload, Download, Eye, Trash2, Paperclip, Loader2,
  Check, Wallet, Sparkles, Search, Filter, LayoutGrid, List, MessageSquare,
  ArrowDownWideNarrow, ArrowUpNarrowWide
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  differenceInDays, format, parseISO, isToday, isYesterday,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { TaskAssignmentBriefing } from '../../components/employee/TaskAssignmentBriefing';
import { LogCompletedWorkModal } from '../../components/employee/LogCompletedWorkModal';

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'text-white/50', bg: 'bg-white/5 border-white/10' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  { value: 'applied', label: 'Applied', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20' },
  { value: 'assigned_to_pro', label: 'Assign to PRO', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  { value: 'gov_approved', label: 'Govt Approved', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  { value: 'gov_rejected', label: 'Govt Rejected', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { value: 'on_hold', label: 'On Hold', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
];

const getStatusConfig = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

// ─── Deadline Badge ────────────────────────────────────────────────────────────

const DeadlineBadge = ({ dateStr }: { dateStr: string | null }) => {
  if (!dateStr) return null;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days < 0) return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20 whitespace-nowrap shrink-0">
      <AlertCircle size={10} /> {Math.abs(days)}d overdue
    </span>
  );
  if (days <= 2) return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20 whitespace-nowrap shrink-0">
      <Clock size={10} /> {days}d left
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 bg-emerald-400/5 px-2 py-0.5 rounded-full border border-emerald-400/15 whitespace-nowrap shrink-0">
      <Calendar size={10} /> {format(parseISO(dateStr), 'MMM d')}
    </span>
  );
};

// ─── Status Update Bottom Sheet ───────────────────────────────────────────────

const StatusUpdateSheet = ({
  task,
  onClose,
  onSuccess,
  onOpenBriefing,
}: {
  task: any;
  onClose: () => void;
  onSuccess: () => void;
  onOpenBriefing?: (jobId: string, serviceId?: string) => void;
}) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [newStatus, setNewStatus] = useState(task.status);
  const [reason, setReason] = useState('');
  const [govRef, setGovRef] = useState('');
  const [applicantName, setApplicantName] = useState(
    task.applicant_name || task.job?.client?.full_name || ''
  );
  const [isClientCaused, setIsClientCaused] = useState(false);
  const [proId, setProId] = useState(task.pro_id || '');
  const [proNotes, setProNotes] = useState(task.pro_notes || '');
  const [pros, setPros] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [actualFee, setActualFee] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paidByClient, setPaidByClient] = useState(task.notes?.includes('[PAID BY CLIENT CARD]') || false);

  const { mutateAsync: updateStatus, isPending } = useUpdateServiceStatus();
  const uploadMutation = useUploadMultipleServiceDocuments();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [issueDate, setIssueDate] = useState(task.issue_date || '');
  const [expiryDate, setExpiryDate] = useState(task.expiry_date || '');
  const [completedDate, setCompletedDate] = useState<string>(() => {
    if (task.completed_at) {
      try {
        return format(parseISO(task.completed_at), 'yyyy-MM-dd');
      } catch {
        return format(new Date(), 'yyyy-MM-dd');
      }
    }
    return format(new Date(), 'yyyy-MM-dd');
  });

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_pro', true)
      .eq('is_active', true)
      .then(({ data }) => setPros(data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop() || 'pdf';
        const filePath = `${task.job_id || task.job?.id}/receipt_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, receiptFile);
        if (!uploadError) {
          receiptUrl = filePath;
        }
      }

      await updateStatus({
        jobServiceId: task.id,
        jobId: task.job_id || task.job?.id,
        fromStatus: task.status,
        toStatus: newStatus,
        serviceName: task.service_name || task.service?.name_en,
        reason: reason || undefined,
        governmentRef: govRef || undefined,
        applicantName: applicantName || undefined,
        isClientCaused,
        proId: newStatus === 'assigned_to_pro' ? proId : undefined,
        proNotes: newStatus === 'assigned_to_pro' ? proNotes : undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        completedDate: newStatus === 'completed' ? completedDate : undefined,
      });

      if (actualFee && Number(actualFee) > 0 && profile) {
        await supabase.from('job_expenses').insert({
          job_id: task.job_id,
          job_service_id: task.id,
          amount: Number(actualFee),
          expense_type: 'ministry_fee',
          receipt_url: receiptUrl,
          notes: paidByClient ? 'Paid with client card' : (reason ? `Logged via status update: ${reason}` : 'Ministry fee logged via status update'),
          created_by: profile.id,
          status: 'pending_approval'
        });
      }

      if (selectedFiles.length > 0 && profile) {
        const filesArray = selectedFiles.map(file => ({
          file,
          category: 'output' as const
        }));
        await uploadMutation.mutateAsync({
          jobServiceId: task.id,
          jobId: task.job_id,
          uploadedBy: profile.id,
          files: filesArray
        });
      }

      toast.success(isRtl ? 'تم تحديث حالة المهمة بنجاح' : 'Status updated successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4.5 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="font-syne text-base font-bold text-foreground">
              {isRtl ? 'تحديث حالة المهمة' : 'Update Task Status'}
            </h3>
            <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
              {task.service_name || task.service?.name_en}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              {isRtl ? 'الحالة الجديدة' : 'New Status'}
            </label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {newStatus === 'completed' && (
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={13} className="text-emerald-500" />
                {isRtl ? 'تاريخ إنجاز المهمة' : 'Date of Completion'}
              </label>
              <input
                type="date"
                value={completedDate}
                onChange={e => setCompletedDate(e.target.value)}
                className="w-full bg-card border border-emerald-500/30 rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-emerald-500 cursor-pointer font-medium"
              />
              <p className="text-[10px] text-muted-foreground">
                {isRtl ? 'حدد التاريخ الفعلي لإنجاز المهمة (الافتراضي هو اليوم)' : 'Set the date when this task was actually finished (defaults to today)'}
              </p>
            </div>
          )}

          {newStatus === 'assigned_to_pro' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">
                  {isRtl ? 'اختر المندوب (PRO)' : 'Select PRO Agent'}
                </label>
                <select
                  value={proId}
                  onChange={e => setProId(e.target.value)}
                  className="w-full bg-card border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-amber-500 cursor-pointer font-medium"
                >
                  <option value="">{isRtl ? '-- اختر المندوب --' : '-- Choose a PRO --'}</option>
                  {pros.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                  {isRtl ? 'تعليمات للمندوب' : 'Instructions for PRO'}
                </label>
                <input
                  type="text"
                  value={proNotes}
                  onChange={e => setProNotes(e.target.value)}
                  placeholder="e.g. Visit ministry counter, submit stamped form"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {(newStatus === 'gov_approved' || newStatus === 'completed') && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                  {isRtl ? 'تاريخ الإصدار (اختياري)' : 'Issue Date (Optional)'}
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                  {isRtl ? 'تاريخ الانتهاء (اختياري)' : 'Expiry Date (Optional)'}
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              {isRtl ? 'اسم صاحب المعاملة / مقدم الطلب' : 'Applicant / Target Person Name'}
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={e => setApplicantName(e.target.value)}
              placeholder="e.g. John Doe / Mohammed Al-Balushi"
              className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              {isRtl ? 'الرقم المرجعي الحكومي (اختياري)' : 'Government Application / Ref Number'}
            </label>
            <input
              type="text"
              value={govRef}
              onChange={e => setGovRef(e.target.value)}
              placeholder="e.g. ROP-2024-88412"
              className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              {isRtl ? 'ملاحظات وتفاصيل التحديث' : 'Status Notes / Next Steps'}
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Any details regarding submission, pending ministry action, etc..."
              className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span>Save Status</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Task Row ─────────────────────────────────────────────────────────────────

const TaskRow = ({
  task,
  onUpdate,
  onOpenBriefing,
}: {
  task: any;
  onUpdate: () => void;
  onOpenBriefing?: (jobId: string, serviceId?: string) => void;
}) => {
  const { profile } = useAuth();
  const [showDocs, setShowDocs] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const cfg = getStatusConfig(task.status);
  const uploadMutation = useUploadMultipleServiceDocuments();
  const deleteMutation = useDeleteJobServiceDocument();

  const isLocked = task.job?.status === 'on_hold' && task.job?.notes?.includes('[LOCKED_MINISTRY_FEE]');
  const assignedByName = task.assigner?.full_name || task.job?.assigned_by_profile?.full_name;

  const docs = task.documents || [];
  const inputs = docs.filter((d: any) => d.document_category === 'input');
  const outputs = docs.filter((d: any) => d.document_category === 'output');

  const handleUploadMultipleDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile) return;

    setIsUploading(true);
    try {
      const filesArray = Array.from(files).map(file => ({
        file,
        category: 'output' as const
      }));

      await uploadMutation.mutateAsync({
        jobServiceId: task.id,
        jobId: task.job_id,
        uploadedBy: profile.id,
        files: filesArray
      });

      toast.success(`Successfully uploaded ${files.length} document(s)`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast.error('Could not open document.');
    }
  };

  return (
    <div className="bg-card border border-border/70 rounded-2xl overflow-hidden hover:border-primary/40 transition-all shadow-sm">
      {/* Top Wide Task Header */}
      <div
        className="px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-all"
        onClick={() => setShowDocs(!showDocs)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {task.service?.requires_pro && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-400/20">
                <Shield size={10} /> PRO Required
              </span>
            )}
            {isLocked ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                <AlertCircle size={10} /> LOCKED
              </span>
            ) : (
              <DeadlineBadge dateStr={task.target_completion_date} />
            )}
          </div>

          <h4 className="text-xs sm:text-sm font-bold text-foreground">
            {task.service_name || task.service?.name_en}
            {task.quantity > 1 && (
              <span className="text-muted-foreground font-normal text-xs ml-1.5">· Item #{task.item_number} of {task.quantity}</span>
            )}
          </h4>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span>
              Applicant: <strong className="text-foreground/90 font-medium">{task.applicant_name || task.job?.client?.full_name || 'Client Direct'}</strong>
            </span>
            {assignedByName && (
              <span>
                · Sales Rep: <strong className="text-amber-400 font-semibold">{assignedByName}</strong>
              </span>
            )}
            {(task.work_fee > 0 || task.ministry_fee > 0) && (
              <span className="font-mono text-[11px] text-muted-foreground">
                · Value: {Number(task.total_fee || (task.work_fee + task.ministry_fee)).toFixed(3)} OMR
              </span>
            )}
            {task.government_ref && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                Ref: {task.government_ref}
              </span>
            )}
          </div>

          {/* Deliverables quick pills */}
          {outputs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {outputs.map((doc: any) => (
                <button
                  key={doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDoc(doc);
                  }}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg hover:bg-emerald-500/20 transition-all"
                  title="View Deliverable"
                >
                  <Check size={9} /> {doc.document_name || doc.file_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {onOpenBriefing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenBriefing(task.job_id, task.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all border border-amber-500/25"
              title="Open full job dossier & handoff notes"
            >
              <Sparkles size={12} />
              <span>Dossier</span>
            </button>
          )}

          {task.status !== 'completed' && task.status !== 'cancelled' && !isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSheet(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all border border-primary/25"
            >
              <span>Update</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDocs(!showDocs);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all border border-border/40"
          >
            <Paperclip size={12} />
            <span>Files ({docs.length})</span>
            <ChevronDown size={12} className={`transition-transform ${showDocs ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Collapsible Documents Section */}
      <AnimatePresence>
        {showDocs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 bg-muted/10 px-6 py-4 space-y-4 overflow-hidden"
          >
            {/* Input Documents */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                📥 Client Input Documents & Requirements
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {inputs.map((doc: any) => {
                  const hasFile = !!doc.file_path;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 bg-card border border-border/40 rounded-xl text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-foreground truncate">{doc.document_name}</p>
                        {hasFile ? (
                          <p className="text-[9px] text-emerald-400 font-bold truncate">✓ {doc.file_name}</p>
                        ) : (
                          <p className="text-[9px] text-muted-foreground/60 italic">Not Uploaded</p>
                        )}
                      </div>
                      {hasFile && (
                        <button onClick={() => handleViewDoc(doc)} className="p-1.5 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg transition-colors">
                          <Eye size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {inputs.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic col-span-full">No input document requirements set for this task.</p>
                )}
              </div>
            </div>

            {/* Deliverables Output */}
            <div className="space-y-2 pt-3 border-t border-border/30">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  📤 Final Deliverables & Output Proof
                </p>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleUploadMultipleDocs}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <button className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold transition-all">
                    {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                    <span>+ Upload Deliverable</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {outputs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-2.5 bg-card border border-border/40 rounded-xl text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground truncate">{doc.document_name || doc.file_name}</p>
                      <p className="text-[9px] text-emerald-400 font-bold">✓ Ready for client</p>
                    </div>
                    <button onClick={() => handleViewDoc(doc)} className="p-1.5 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg transition-colors">
                      <Eye size={12} />
                    </button>
                  </div>
                ))}
                {outputs.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic col-span-full">No output deliverables uploaded yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSheet && (
          <StatusUpdateSheet
            task={task}
            onClose={() => setShowSheet(false)}
            onSuccess={() => {
              setShowSheet(false);
              onUpdate();
            }}
            onOpenBriefing={onOpenBriefing}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Grouped Job Card (Wide, Spacious Layout) ─────────────────────────────────

const GroupedJobCard = ({
  group,
  onUpdate,
  onOpenBriefing
}: {
  group: any;
  onUpdate: () => void;
  onOpenBriefing?: (jobId: string, serviceId?: string) => void;
}) => {
  const navigate = useNavigate();

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!group.clientPhone) return;
    const cleaned = group.clientPhone.replace(/\D/g, '');
    const number = cleaned.startsWith('968') ? cleaned : `968${cleaned}`;
    window.open(`https://wa.me/${number}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/80 rounded-3xl overflow-hidden hover:border-primary/30 transition-all p-5 sm:p-6 space-y-4 shadow-sm"
    >
      {/* Group Header: Client & Job Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/40">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {group.clientName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground leading-tight">{group.clientName}</h3>
              <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {group.jobCode}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/40">
                {group.services.length} {group.services.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
              {group.assignedByName && (
                <span>
                  Assigned by: <strong className="text-amber-400 font-semibold">{group.assignedByName}</strong>
                </span>
              )}
              {group.clientPhone && (
                <span className="font-mono text-muted-foreground/80">
                  {group.clientPhone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {onOpenBriefing && (
            <button
              onClick={() => onOpenBriefing(group.jobId)}
              title="Open Full Case Dossier & Handoff Notes"
              className="h-8 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 flex items-center gap-1.5 text-amber-400 text-xs font-bold transition-all border border-amber-500/20 shadow-sm"
            >
              <Sparkles size={12} />
              <span>Case Dossier</span>
            </button>
          )}
          {group.clientPhone && (
            <button
              onClick={handleWhatsApp}
              title="WhatsApp Client"
              className="h-8 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-1.5 text-emerald-400 transition-all border border-emerald-500/20 text-xs font-bold"
            >
              <Phone size={13} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}
          <button
            onClick={() => navigate(`/employee/tasks?jobId=${group.jobId}`)}
            title="View Full Job Folder"
            className="h-8 w-8 rounded-xl bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all border border-border/50"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Services List inside the Job */}
      <div className="space-y-3">
        {group.services.map((task: any) => (
          <TaskRow
            key={task.id}
            task={task}
            onUpdate={onUpdate}
            onOpenBriefing={onOpenBriefing}
          />
        ))}
      </div>
    </motion.div>
  );
};

// ─── Main MyTasks Page ─────────────────────────────────────────────────────────

type FilterTab = 'all' | 'urgent' | 'on_hold' | 'completed';
type DoneDatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';

const MyTasks: React.FC = () => {
  const { profile } = useAuth();
  const { data: tasks = [], isLoading, refetch } = useMyOpsTasks(profile?.id || null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [briefingJobId, setBriefingJobId] = useState<string | null>(null);
  const [briefingServiceId, setBriefingServiceId] = useState<string | null>(null);
  const [isLogCompletedModalOpen, setIsLogCompletedModalOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  // Done Projects Filter State
  const [doneDatePreset, setDoneDatePreset] = useState<DoneDatePreset>('all');
  const [doneCustomStart, setDoneCustomStart] = useState('');
  const [doneCustomEnd, setDoneCustomEnd] = useState('');
  const [doneSearchQuery, setDoneSearchQuery] = useState('');
  const [doneViewMode, setDoneViewMode] = useState<'list' | 'cards'>('list');
  const [doneGroupByClient, setDoneGroupByClient] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const handleOpenBriefing = (jobId: string, serviceId?: string) => {
    setBriefingJobId(jobId);
    setBriefingServiceId(serviceId || null);
  };

  const now = new Date();
  const acceptedTasks: any[] = tasks;

  const urgent = acceptedTasks.filter((task: any) => {
    if (!task.target_completion_date) return false;
    const days = differenceInDays(parseISO(task.target_completion_date), now);
    return days <= 2 && task.status !== 'completed' && task.status !== 'cancelled';
  });

  const onHold = acceptedTasks.filter((task: any) => task.status === 'on_hold');
  const done = acceptedTasks.filter((task: any) => task.status === 'completed' || task.status === 'cancelled');
  const active = acceptedTasks.filter((task: any) => task.status !== 'completed' && task.status !== 'cancelled');

  // Filter Done Tasks by Date and Search
  const filteredDoneTasks = useMemo(() => {
    return done.filter(task => {
      // 1. Date Filter
      const dateStr = task.completed_at || task.updated_at || task.created_at;
      if (dateStr && doneDatePreset !== 'all') {
        const dt = parseISO(dateStr);
        if (!isNaN(dt.getTime())) {
          if (doneDatePreset === 'today') {
            if (!isToday(dt)) return false;
          } else if (doneDatePreset === 'yesterday') {
            if (!isYesterday(dt)) return false;
          } else if (doneDatePreset === 'week') {
            if (!isWithinInterval(dt, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) })) return false;
          } else if (doneDatePreset === 'month') {
            if (!isWithinInterval(dt, { start: startOfMonth(now), end: endOfMonth(now) })) return false;
          } else if (doneDatePreset === 'last_month') {
            const prev = subMonths(now, 1);
            if (!isWithinInterval(dt, { start: startOfMonth(prev), end: endOfMonth(prev) })) return false;
          } else if (doneDatePreset === 'custom' && doneCustomStart && doneCustomEnd) {
            const s = new Date(doneCustomStart + 'T00:00:00');
            const e = new Date(doneCustomEnd + 'T23:59:59');
            if (dt < s || dt > e) return false;
          }
        }
      }

      // 2. Search Query Filter
      if (doneSearchQuery.trim()) {
        const q = doneSearchQuery.toLowerCase();
        const mCode = task.job?.job_code?.toLowerCase().includes(q);
        const mClient = task.job?.client?.full_name?.toLowerCase().includes(q) || task.job?.client?.phone?.includes(q);
        const mService = task.service_name?.toLowerCase().includes(q) || task.service?.name_en?.toLowerCase().includes(q);
        const mApplicant = task.applicant_name?.toLowerCase().includes(q);
        const mAssigner = task.assigner?.full_name?.toLowerCase().includes(q) || task.job?.assigned_by_profile?.full_name?.toLowerCase().includes(q);
        if (!mCode && !mClient && !mService && !mApplicant && !mAssigner) return false;
      }

      return true;
    });
  }, [done, doneDatePreset, doneCustomStart, doneCustomEnd, doneSearchQuery]);

  // Group Completed Tasks by Client for Clean, Uncluttered Accordion View
  const clientGroups = useMemo(() => {
    const groups: Record<string, {
      clientId: string;
      clientName: string;
      clientPhone?: string;
      jobCodes: string[];
      salesReps: string[];
      services: any[];
      latestDate: Date | null;
      totalProofFiles: number;
    }> = {};

    filteredDoneTasks.forEach(task => {
      const clientId = task.job?.client_id || task.job?.client?.full_name || task.applicant_name || 'unknown';
      const clientName = task.job?.client?.full_name || task.applicant_name || 'Client';
      const clientPhone = task.job?.client?.phone;
      const jobCode = task.job?.job_code;
      const salesRep = task.assigner?.full_name || task.job?.assigned_by_profile?.full_name;

      if (!groups[clientId]) {
        groups[clientId] = {
          clientId,
          clientName,
          clientPhone,
          jobCodes: [],
          salesReps: [],
          services: [],
          latestDate: null,
          totalProofFiles: 0
        };
      }

      if (jobCode && !groups[clientId].jobCodes.includes(jobCode)) {
        groups[clientId].jobCodes.push(jobCode);
      }
      if (salesRep && !groups[clientId].salesReps.includes(salesRep)) {
        groups[clientId].salesReps.push(salesRep);
      }

      groups[clientId].services.push(task);

      const dStr = task.completed_at || task.updated_at || task.created_at;
      if (dStr) {
        const dt = parseISO(dStr);
        if (!groups[clientId].latestDate || dt > groups[clientId].latestDate!) {
          groups[clientId].latestDate = dt;
        }
      }

      const hasReceipt = Boolean(task.gov_receipt_url);
      const outputsCount = (task.documents || []).filter((d: any) =>
        d.document_category === 'output' ||
        d.document_category === 'gov_receipt' ||
        d.notes === 'gov_receipt' ||
        d.file_name?.toLowerCase().includes('gov_receipt')
      ).length;
      groups[clientId].totalProofFiles += outputsCount + (hasReceipt ? 1 : 0);
    });

    // Sort works inside each client group chronologically by date (newest first)
    Object.values(groups).forEach(g => {
      g.services.sort((a, b) => {
        const dateA = a.completed_at || a.updated_at || a.created_at || '';
        const dateB = b.completed_at || b.updated_at || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
    });

    // Sort client groups by their latest completed service date
    return Object.values(groups).sort((a, b) => {
      if (!a.latestDate) return 1;
      if (!b.latestDate) return -1;
      return b.latestDate.getTime() - a.latestDate.getTime();
    });
  }, [filteredDoneTasks]);

  // Done KPIs
  const doneCompletedToday = useMemo(() => {
    return done.filter((task: any) => {
      const d = task.completed_at || task.updated_at;
      return d && isToday(parseISO(d));
    }).length;
  }, [done]);

  const doneCompletedThisMonth = useMemo(() => {
    return done.filter((task: any) => {
      const d = task.completed_at || task.updated_at;
      return d && isWithinInterval(parseISO(d), { start: startOfMonth(now), end: endOfMonth(now) });
    }).length;
  }, [done]);

  const getDisplayTasks = () => {
    switch (filter) {
      case 'urgent': return urgent;
      case 'on_hold': return onHold;
      case 'completed': return filteredDoneTasks;
      default: return active;
    }
  };

  const displayTasks = getDisplayTasks();

  // Group active tasks by deadline urgency
  const overdue = active.filter((task: any) => {
    if (!task.target_completion_date) return false;
    return differenceInDays(parseISO(task.target_completion_date), now) < 0;
  });
  const soonDue = active.filter((task: any) => {
    if (!task.target_completion_date) return false;
    const days = differenceInDays(parseISO(task.target_completion_date), now);
    return days >= 0 && days <= 2;
  });
  const onTrack = active.filter((task: any) => {
    if (!task.target_completion_date) return true;
    return differenceInDays(parseISO(task.target_completion_date), now) > 2;
  });

  const groupTasksByJob = (taskList: any[]) => {
    const groups: Record<string, {
      jobId: string;
      jobCode: string;
      clientName: string;
      clientPhone?: string;
      assignedByName?: string;
      services: any[];
      latestDate?: string;
    }> = {};

    taskList.forEach(task => {
      const jobId = task.job_id;
      if (!groups[jobId]) {
        groups[jobId] = {
          jobId,
          jobCode: task.job?.job_code || '',
          clientName: task.job?.client?.full_name || 'Unknown Client',
          clientPhone: task.job?.client?.phone,
          assignedByName: task.assigner?.full_name || task.job?.assigned_by_profile?.full_name,
          services: [],
          latestDate: task.created_at || task.assigned_at || task.job?.created_at || ''
        };
      }
      groups[jobId].services.push(task);
      const tDate = task.created_at || task.assigned_at || task.job?.created_at || '';
      if (tDate > (groups[jobId].latestDate || '')) {
        groups[jobId].latestDate = tDate;
      }
    });

    Object.values(groups).forEach(g => {
      g.services.sort((a, b) => {
        const orderA = a.display_order ?? 1;
        const orderB = b.display_order ?? 1;
        if (orderA !== orderB) return orderA - orderB;
        return (a.item_number || 1) - (b.item_number || 1);
      });
    });

    // Sort grouped jobs descending (default) or ascending by Job Code / Date
    return Object.values(groups).sort((a, b) => {
      const codeA = a.jobCode || '';
      const codeB = b.jobCode || '';
      const comp = codeA.localeCompare(codeB, undefined, { numeric: true });
      if (comp !== 0) {
        return sortOrder === 'desc' ? -comp : comp;
      }
      return sortOrder === 'desc'
        ? (b.latestDate || '').localeCompare(a.latestDate || '')
        : (a.latestDate || '').localeCompare(b.latestDate || '');
    });
  };

  const FILTER_TABS: { key: FilterTab; label: string; count: number; color?: string }[] = [
    { key: 'all', label: isRtl ? 'عملي الجاري' : 'My Work', count: active.length },
    { key: 'urgent', label: isRtl ? 'عاجل' : 'Urgent', count: urgent.length, color: 'text-yellow-400' },
    { key: 'on_hold', label: isRtl ? 'متوقف مؤقتاً' : 'On Hold', count: onHold.length, color: 'text-red-400' },
    { key: 'completed', label: isRtl ? 'مكتمل' : 'Done', count: done.length },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-syne text-2xl sm:text-3xl font-bold text-foreground">
              {isRtl ? 'مهامي الجارية' : 'My Work'}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
              Ops Workspace
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRtl ? `لديك ${active.length} مهمة نشطة مسندة إليك` : `${active.length} active task${active.length !== 1 ? 's' : ''} assigned to you across projects`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsLogCompletedModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all shadow-sm"
            title={isRtl ? 'تسجيل عمل سابق مكتمل قبل تطبيق النظام' : 'Log completed past work done before system rollout'}
          >
            <CheckCircle2 size={14} />
            <span>{isRtl ? 'تسجيل عمل سابق' : 'Log Completed Work'}</span>
          </button>
          <button
            onClick={() => window.location.href = '/employee/task-pool'}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
          >
            <Sparkles size={14} />
            <span>{isRtl ? 'سوق المهام' : 'Open Pool'}</span>
          </button>
          {urgent.length > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-2 rounded-xl text-xs font-bold">
              <AlertCircle size={13} /> {urgent.length} {isRtl ? 'عاجل' : 'Urgent'}
            </div>
          )}
        </div>
      </div>

      {/* ─── Filter Tabs & Sort Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 bg-muted/30 p-1 rounded-2xl overflow-x-auto custom-scrollbar whitespace-nowrap border border-border/40 flex-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-none sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${filter === tab.key
                ? 'bg-card border border-border/80 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filter === tab.key ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted/60'
                  } ${tab.color || ''}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort Order Selector (Descending default / Ascending) */}
        {filter !== 'completed' && (
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border/40 shrink-0 self-start sm:self-center">
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${sortOrder === 'desc'
                ? 'bg-card border border-border/80 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Sort descending: newest / highest job code first"
            >
              <ArrowDownWideNarrow size={13} className={sortOrder === 'desc' ? 'text-primary' : ''} />
              <span>{isRtl ? 'تنازلي (الأحدث)' : 'Descending'}</span>
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${sortOrder === 'asc'
                ? 'bg-card border border-border/80 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Sort ascending: oldest / lowest job code first"
            >
              <ArrowUpNarrowWide size={13} className={sortOrder === 'asc' ? 'text-primary' : ''} />
              <span>{isRtl ? 'تصاعدي (الأقدم)' : 'Ascending'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Active Task Lists (All, Urgent, On Hold) ───────────────────────── */}
      {filter !== 'completed' && (
        <div className="space-y-6">
          {filter === 'all' ? (
            <>
              {/* Overdue Section */}
              {overdue.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle size={13} /> {isRtl ? 'متأخرة عن الموعد' : 'Overdue Tasks'} — {overdue.length}
                  </p>
                  <div className="space-y-4">
                    {groupTasksByJob(overdue).map(group => (
                      <GroupedJobCard
                        key={group.jobId}
                        group={group}
                        onUpdate={refetch}
                        onOpenBriefing={handleOpenBriefing}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Due Soon Section */}
              {soonDue.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={13} /> {isRtl ? 'مستحقة قريباً (خلال يومين)' : 'Due Soon (Within 48h)'} — {soonDue.length}
                  </p>
                  <div className="space-y-4">
                    {groupTasksByJob(soonDue).map(group => (
                      <GroupedJobCard
                        key={group.jobId}
                        group={group}
                        onUpdate={refetch}
                        onOpenBriefing={handleOpenBriefing}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* On Track Section */}
              {onTrack.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-primary" /> {isRtl ? 'قيد الإنجاز' : 'In Progress (On Track)'} — {onTrack.length}
                  </p>
                  <div className="space-y-4">
                    {groupTasksByJob(onTrack).map(group => (
                      <GroupedJobCard
                        key={group.jobId}
                        group={group}
                        onUpdate={refetch}
                        onOpenBriefing={handleOpenBriefing}
                      />
                    ))}
                  </div>
                </div>
              )}

              {active.length === 0 && (
                <div className="text-center border-2 border-dashed border-border/60 rounded-3xl py-20 p-8 space-y-3">
                  <Layers size={36} className="text-muted-foreground/40 mx-auto" />
                  <p className="font-bold text-base text-foreground">{isRtl ? 'لا توجد مهام نشطة حالياً' : 'No active tasks'}</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {isRtl ? 'المهام المسندة إليك من فريق المبيعات أو سوق المهام ستظهر هنا.' : 'Tasks assigned to you will appear here.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {displayTasks.length === 0 ? (
                <div className="text-center border-2 border-dashed border-border/60 rounded-3xl py-16 p-8">
                  <p className="text-xs font-bold text-muted-foreground">{isRtl ? 'لا توجد مهام في هذه الفئة' : 'No tasks in this category'}</p>
                </div>
              ) : (
                groupTasksByJob(displayTasks).map(group => (
                  <GroupedJobCard
                    key={group.jobId}
                    group={group}
                    onUpdate={refetch}
                    onOpenBriefing={handleOpenBriefing}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── DONE / COMPLETED SECTION (WITH LIST VIEW & DATE FILTER) ───────── */}
      {filter === 'completed' && (
        <div className="space-y-4">
          {/* Done Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">{isRtl ? 'إجمالي المهام المنجزة' : 'Total Completed Tasks'}</span>
                <span className="text-2xl font-bold font-syne text-foreground">{done.length}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/25 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">{isRtl ? 'منجز اليوم' : 'Completed Today'}</span>
                <span className="text-2xl font-bold font-syne text-primary">{doneCompletedToday}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">{isRtl ? 'منجز هذا الشهر' : 'Completed This Month'}</span>
                <span className="text-2xl font-bold font-syne text-foreground">{doneCompletedThisMonth}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                <Calendar size={20} />
              </div>
            </div>
          </div>

          {/* Date Filter & Search Control Bar */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Quick Date Range Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs w-full md:w-auto custom-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                <Calendar size={12} className="text-primary" />
                {isRtl ? 'التاريخ:' : 'Date:'}
              </span>
              {(['all', 'today', 'yesterday', 'week', 'month', 'last_month', 'custom'] as DoneDatePreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setDoneDatePreset(p)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs ${doneDatePreset === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  {p === 'all' && (isRtl ? 'كل الوقت' : 'All Time')}
                  {p === 'today' && (isRtl ? 'اليوم' : 'Today')}
                  {p === 'yesterday' && (isRtl ? 'أمس' : 'Yesterday')}
                  {p === 'week' && (isRtl ? 'هذا الأسبوع' : 'This Week')}
                  {p === 'month' && (isRtl ? 'هذا الشهر' : 'This Month')}
                  {p === 'last_month' && (isRtl ? 'الشهر الماضي' : 'Last Month')}
                  {p === 'custom' && (isRtl ? 'مخصص' : 'Custom')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={isRtl ? 'ابحث في المعاملات المنجزة...' : 'Search completed cases...'}
                  value={doneSearchQuery}
                  onChange={e => setDoneSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-card border border-border/60 rounded-xl text-xs text-foreground outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Group By Client Toggle */}
              <button
                onClick={() => setDoneGroupByClient(!doneGroupByClient)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${doneGroupByClient
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                  : 'bg-card text-muted-foreground border-border/60 hover:text-foreground'
                  }`}
                title={isRtl ? 'تجميع حسب العميل أو قائمة عادية' : 'Group by Client or Flat List'}
              >
                <Users size={13} />
                <span>{isRtl ? (doneGroupByClient ? 'مجمّع حسب العميل' : 'قائمة تفصيلية') : (doneGroupByClient ? 'Grouped by Client' : 'Flat List')}</span>
              </button>

              {/* View Mode Toggle: List vs Cards */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
                <button
                  onClick={() => setDoneViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${doneViewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  title="List View"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => setDoneViewMode('cards')}
                  className={`p-1.5 rounded-lg transition-all ${doneViewMode === 'cards' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Card View"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {doneDatePreset === 'custom' && (
            <div className="p-3 bg-muted/15 border border-border/40 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">{isRtl ? 'من:' : 'From:'}</span>
                <input
                  type="date"
                  value={doneCustomStart}
                  onChange={e => setDoneCustomStart(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">{isRtl ? 'إلى:' : 'To:'}</span>
                <input
                  type="date"
                  value={doneCustomEnd}
                  onChange={e => setDoneCustomEnd(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Done Items Display: List View or Card View */}
          {filteredDoneTasks.length === 0 ? (
            <div className="text-center border-2 border-dashed border-border/60 rounded-3xl py-16 p-8 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">
                {isRtl ? 'لا توجد معاملات منجزة في هذه الفترة' : 'No completed tasks found in this timeframe'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isRtl ? 'جرب تغيير فلتر التاريخ أو كلمة البحث' : 'Try adjusting the date filter or search query'}
              </p>
            </div>
          ) : doneViewMode === 'list' ? (
            /* LIST VIEW TABLE */
            <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3.5 px-5">{isRtl ? 'المعاملة والعميل' : 'Case & Client'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'الخدمة المنجزة' : 'Completed Service'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'تاريخ الإنجاز' : 'Completion Date'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'المسؤول المالي (المبيعات)' : 'Sales Rep'}</th>
                      <th className="py-3.5 px-4">{isRtl ? 'المخرجات والإثباتات' : 'Deliverables'}</th>
                      <th className="py-3.5 px-5 text-right">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {doneGroupByClient ? (
                      /* GROUPED BY CLIENT ACCORDION VIEW */
                      clientGroups.map(group => {
                        const isExpanded = Boolean(expandedClients[group.clientId]);
                        return (
                          <React.Fragment key={group.clientId}>
                            {/* Client Summary Accordion Row */}
                            <tr
                              onClick={() => toggleClient(group.clientId)}
                              className={`transition-colors cursor-pointer border-t border-border/40 group ${isExpanded ? 'bg-primary/5 hover:bg-primary/10' : 'bg-muted/15 hover:bg-muted/30'
                                }`}
                            >
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3">
                                  <div className={`p-1 rounded-lg bg-muted/60 text-muted-foreground group-hover:text-primary transition-all ${isExpanded ? 'rotate-90 text-primary bg-primary/10' : ''}`}>
                                    <ChevronRight size={14} />
                                  </div>
                                  <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                    {group.clientName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-foreground text-xs">{group.clientName}</span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                        {group.services.length} {group.services.length === 1 ? (isRtl ? 'خدمة منجزة' : 'work') : (isRtl ? 'خدمات منجزة' : 'works')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-normal">
                                      {group.clientPhone && <span>{group.clientPhone}</span>}
                                      {group.jobCodes.length > 0 && (
                                        <span>• {group.jobCodes.slice(0, 3).join(', ')}{group.jobCodes.length > 3 ? ` +${group.jobCodes.length - 3}` : ''}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="text-xs text-muted-foreground truncate max-w-xs">
                                  {group.services.slice(0, 2).map((s: any) => s.service_name || s.service?.name_en).join(', ')}
                                  {group.services.length > 2 && <span className="text-[10px] text-primary ml-1">+{group.services.length - 2} more</span>}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs text-foreground font-semibold">
                                    {group.latestDate ? format(group.latestDate, 'dd MMM yyyy') : '—'}
                                  </span>
                                  {group.latestDate && isToday(group.latestDate) && (
                                    <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                                      Today
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="text-xs text-muted-foreground font-medium">
                                  {group.salesReps.join(', ') || 'Sales Rep'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {group.totalProofFiles > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                                    {group.totalProofFiles} {group.totalProofFiles === 1 ? 'file' : 'files'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/60 italic">No output files</span>
                                )}
                              </td>

                              <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleClient(group.clientId);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{isExpanded ? (isRtl ? 'إخفاء' : 'Collapse') : (isRtl ? `عرض الأعمال (${group.services.length})` : `View Works (${group.services.length})`)}</span>
                                  <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Child Services (Sorted Chronologically by Date) */}
                            {isExpanded && group.services.map((task: any) => {
                              const completedDateStr = task.completed_at || task.updated_at || task.created_at;
                              const completedDate = completedDateStr ? parseISO(completedDateStr) : null;
                              const isTaskToday = completedDate && isToday(completedDate);
                              const outputs = (task.documents || []).filter((d: any) =>
                                d.document_category === 'output' ||
                                d.document_category === 'gov_receipt' ||
                                d.notes === 'gov_receipt' ||
                                d.file_name?.toLowerCase().includes('gov_receipt')
                              );
                              const hasDedicatedGovReceipt = Boolean(task.gov_receipt_url);
                              const totalProofFiles = outputs.length + (hasDedicatedGovReceipt && !outputs.some((d: any) => d.file_path === task.gov_receipt_url) ? 1 : 0);

                              return (
                                <tr
                                  key={task.id}
                                  className={`border-b border-border/20 transition-colors bg-card/60 hover:bg-muted/20 ${isRtl ? 'border-r-4 border-r-primary/40 pr-2' : 'border-l-4 border-l-primary/40 pl-2'}`}
                                >
                                  <td className="py-3 px-5 whitespace-nowrap">
                                    <div className="flex items-center gap-2.5 pl-5 sm:pl-7">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                                      <span className="font-mono text-primary font-bold text-[11px] bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                        {task.job?.job_code}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="py-3 px-4">
                                    <div>
                                      <p className="font-bold text-xs text-foreground">{task.service_name || task.service?.name_en}</p>
                                      {task.applicant_name && (
                                        <p className="text-[10px] text-muted-foreground">For: {task.applicant_name}</p>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs text-foreground">
                                        {completedDate ? format(completedDate, 'dd MMM yyyy') : '—'}
                                      </span>
                                      {isTaskToday && (
                                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                                          Today
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="text-xs text-muted-foreground font-medium">
                                      {task.assigner?.full_name || task.job?.assigned_by_profile?.full_name || 'Sales Rep'}
                                    </span>
                                  </td>

                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {totalProofFiles > 0 ? (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                                          {totalProofFiles} {totalProofFiles === 1 ? 'file' : 'files'}
                                        </span>
                                      </div>
                                    ) : (
                                      <a
                                        href={`/employee/tasks?jobId=${task.job_id}`}
                                        className="text-[10px] text-muted-foreground/60 hover:text-primary italic hover:underline inline-flex items-center gap-1 cursor-pointer"
                                        title="Open job folder to upload files or receipts"
                                      >
                                        <span>No output files</span>
                                        <span className="text-[9px] font-bold text-primary not-italic bg-primary/10 px-1 rounded border border-primary/20">+ Add</span>
                                      </a>
                                    )}
                                  </td>

                                  <td className="py-3 px-5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleOpenBriefing(task.job_id, task.id)}
                                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all border border-amber-500/20 flex items-center gap-1 cursor-pointer"
                                        title="Open Case Dossier"
                                      >
                                        <Sparkles size={11} />
                                        <span className="hidden sm:inline">Dossier</span>
                                      </button>
                                      <button
                                        onClick={() => window.location.href = `/employee/tasks?jobId=${task.job_id}`}
                                        className="p-1.5 rounded-xl bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                        title="Open Full Job Folder"
                                      >
                                        <ExternalLink size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      /* FLAT LIST VIEW (ORIGINAL FLAT ROWS) */
                      filteredDoneTasks.map(task => {
                        const completedDateStr = task.completed_at || task.updated_at || task.created_at;
                        const completedDate = completedDateStr ? parseISO(completedDateStr) : null;
                        const isTaskToday = completedDate && isToday(completedDate);
                        const outputs = (task.documents || []).filter((d: any) =>
                          d.document_category === 'output' ||
                          d.document_category === 'gov_receipt' ||
                          d.notes === 'gov_receipt' ||
                          d.file_name?.toLowerCase().includes('gov_receipt')
                        );
                        const hasDedicatedGovReceipt = Boolean(task.gov_receipt_url);
                        const totalProofFiles = outputs.length + (hasDedicatedGovReceipt && !outputs.some((d: any) => d.file_path === task.gov_receipt_url) ? 1 : 0);

                        return (
                          <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                            {/* Case & Client */}
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                                  <Check size={14} />
                                </div>
                                <div>
                                  <span className="font-bold text-foreground text-xs block">
                                    {task.job?.client?.full_name || 'Client'}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                    <span className="font-mono text-primary font-bold">{task.job?.job_code}</span>
                                    {task.job?.client?.phone && <span>• {task.job?.client?.phone}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Completed Service */}
                            <td className="py-3.5 px-4">
                              <div>
                                <p className="font-bold text-xs text-foreground">{task.service_name || task.service?.name_en}</p>
                                {task.applicant_name && (
                                  <p className="text-[10px] text-muted-foreground">For: {task.applicant_name}</p>
                                )}
                              </div>
                            </td>

                            {/* Completion Date */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-foreground">
                                  {completedDate ? format(completedDate, 'dd MMM yyyy') : '—'}
                                </span>
                                {isTaskToday && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                                    Today
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Sales Rep */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-xs text-muted-foreground font-medium">
                                {task.assigner?.full_name || task.job?.assigned_by_profile?.full_name || 'Sales Rep'}
                              </span>
                            </td>

                            {/* Deliverables / Proof files */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {totalProofFiles > 0 ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                                    {totalProofFiles} {totalProofFiles === 1 ? 'file' : 'files'}
                                  </span>
                                </div>
                              ) : (
                                <a
                                  href={`/employee/tasks?jobId=${task.job_id}`}
                                  className="text-[10px] text-muted-foreground/60 hover:text-primary italic hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  title="Open job folder to upload files or receipts"
                                >
                                  <span>No output files</span>
                                  <span className="text-[9px] font-bold text-primary not-italic bg-primary/10 px-1 rounded border border-primary/20">+ Add</span>
                                </a>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenBriefing(task.job_id, task.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all border border-amber-500/20 flex items-center gap-1 cursor-pointer"
                                  title="Open Case Dossier"
                                >
                                  <Sparkles size={11} />
                                  <span className="hidden sm:inline">Dossier</span>
                                </button>
                                <button
                                  onClick={() => window.location.href = `/employee/tasks?jobId=${task.job_id}`}
                                  className="p-1.5 rounded-xl bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                  title="Open Full Job Folder"
                                >
                                  <ExternalLink size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARD VIEW */
            <div className="space-y-4">
              {groupTasksByJob(filteredDoneTasks).map(group => (
                <GroupedJobCard
                  key={group.jobId}
                  group={group}
                  onUpdate={refetch}
                  onOpenBriefing={handleOpenBriefing}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Case Dossier & Handoff Briefing Modal */}
      <TaskAssignmentBriefing
        jobId={briefingJobId || ''}
        currentServiceId={briefingServiceId || undefined}
        isOpen={!!briefingJobId}
        onClose={() => {
          setBriefingJobId(null);
          setBriefingServiceId(null);
        }}
        onUpdated={refetch}
      />

      {/* Log Completed Historical Work Modal */}
      <LogCompletedWorkModal
        isOpen={isLogCompletedModalOpen}
        onClose={() => setIsLogCompletedModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
};

export default MyTasks;
