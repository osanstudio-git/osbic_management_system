import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMyOpsTasks, useUpdateServiceStatus } from '../../hooks/employee/useTimeline';
import { useUploadMultipleServiceDocuments } from '../../hooks/employee/useJobServices';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Search, X, Check, Loader2, Upload, ArrowLeft, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'applied', label: 'Applied' },
  { value: 'assigned_to_pro', label: 'Assign to PRO' },
  { value: 'gov_approved', label: 'Govt Approved' },
  { value: 'gov_rejected', label: 'Govt Rejected' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const QuickUpdateWidget = () => {
  const { profile } = useAuth();
  const { data: tasks = [], refetch } = useMyOpsTasks(profile?.id || null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  
  const [newStatus, setNewStatus] = useState('');
  const [govRef, setGovRef] = useState('');
  const [reason, setReason] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actualFee, setActualFee] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paidByClient, setPaidByClient] = useState(false);

  const [pros, setPros] = useState<any[]>([]);
  const [proId, setProId] = useState('');
  const [proNotes, setProNotes] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  
  const updateStatusMutation = useUpdateServiceStatus();
  const uploadDocumentsMutation = useUploadMultipleServiceDocuments();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const getStatusLabel = (val: string) => {
    if (isRtl) {
      switch(val) {
        case 'pending': return 'قيد الانتظار';
        case 'in_progress': return 'قيد التنفيذ';
        case 'applied': return 'تم التقديم';
        case 'assigned_to_pro': return 'مسند إلى المندوب';
        case 'gov_approved': return 'موافقة حكومية';
        case 'gov_rejected': return 'رفض حكومي';
        case 'on_hold': return 'متوقف مؤقتاً';
        case 'completed': return 'مكتمل';
        case 'cancelled': return 'ملغي';
        default: return val.replace('_', ' ');
      }
    }
    switch(val) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'applied': return 'Applied';
      case 'assigned_to_pro': return 'Assign to PRO';
      case 'gov_approved': return 'Govt Approved';
      case 'gov_rejected': return 'Govt Rejected';
      case 'on_hold': return 'On Hold';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return val.replace('_', ' ');
    }
  };

  // Close widget if clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Fetch PROs list
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role, is_pro')
      .eq('role', 'employee')
      .then(({ data }) => {
        if (data) {
          setPros(data.filter((e: any) => e.role === 'pro' || e.is_pro));
        }
      });
  }, []);

  // Set default values when task is selected
  useEffect(() => {
    if (selectedTask) {
      setNewStatus(selectedTask.status);
      setGovRef(selectedTask.government_ref || '');
      setReason('');
      setSelectedFiles([]);
      setProId(selectedTask.pro_id || '');
      setProNotes(selectedTask.pro_notes || '');
      setActualFee('');
      setReceiptFile(null);
      setPaidByClient(selectedTask.notes?.includes('[PAID BY CLIENT CARD]') || false);
    }
  }, [selectedTask]);

  // Filter accepted tasks matching search query
  const activeTasks = tasks.filter((t: any) => 
    t.acceptance_status === 'accepted' && 
    t.status !== 'completed' && 
    t.status !== 'cancelled'
  );

  const filteredTasks = activeTasks.filter((t: any) => {
    const query = searchQuery.toLowerCase();
    const serviceName = (t.service_name || t.service?.name_en || '').toLowerCase();
    const applicant = (t.applicant_name || '').toLowerCase();
    const jobCode = (t.job?.job_code || '').toLowerCase();
    return serviceName.includes(query) || applicant.includes(query) || jobCode.includes(query);
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const codeA = a.job?.job_code || '';
    const codeB = b.job?.job_code || '';
    if (codeA !== codeB) {
      return codeA.localeCompare(codeB);
    }
    const orderA = a.display_order ?? 1;
    const orderB = b.display_order ?? 1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.item_number || 1) - (b.item_number || 1);
  });

  const handleSave = async () => {
    if (!selectedTask || !profile) return;
    setIsUpdating(true);

    try {
      const feeAmount = parseFloat(actualFee) || 0;
      if (feeAmount > 0 && !receiptFile) {
        toast.error(isRtl ? 'يجب تحميل إيصال الدفع عند تسجيل الرسوم الحكومية.' : 'You must upload a payment receipt when recording government fees.');
        setIsUpdating(false);
        return;
      }

      // Upload receipt file if government fee is recorded (only if not paid by client card)
      let receiptUrl = '';
      if (receiptFile && !paidByClient) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${selectedTask.job_id}/${selectedTask.id}/${Date.now()}_receipt.${fileExt}`;
        const filePath = `documents/${fileName}`;
        
        const { error: storageError } = await supabase.storage.from('documents').upload(filePath, receiptFile);
        if (storageError) throw storageError;
        receiptUrl = filePath;
      }

      // Log expense in job_expenses table (ONLY if not paid by client card!)
      if (feeAmount > 0 && !paidByClient) {
        const { error: expenseError } = await supabase.from('job_expenses').insert({
          job_id: selectedTask.job_id,
          job_service_id: selectedTask.id,
          amount: feeAmount,
          expense_type: 'ministry_fee',
          receipt_url: receiptUrl || null,
          notes: isRtl ? `تم التسجيل أثناء التحديث السريع للحالة إلى ${getStatusLabel(newStatus)}` : `Recorded during quick status update to ${newStatus}`,
          status: 'pending_approval',
          created_by: profile?.id
        });
        if (expenseError) throw expenseError;
      }

      // 1. Upload files first if selected (and upload receipt here if paid by client card)
      const filesToUpload: { file: File, category: 'output' }[] = selectedFiles.map(file => ({
        file,
        category: 'output' as const
      }));

      if (paidByClient && receiptFile) {
        filesToUpload.push({
          file: receiptFile,
          category: 'output' as const
        });
      }

      if (filesToUpload.length > 0) {
        await uploadDocumentsMutation.mutateAsync({
          jobServiceId: selectedTask.id,
          jobId: selectedTask.job_id,
          uploadedBy: profile.id,
          files: filesToUpload
        });
      }

      // 2. Perform status update
      const isDelay = newStatus === 'on_hold';
      const clientPaidNote = paidByClient
        ? (isRtl 
           ? `[دفع بواسطة بطاقة العميل] الرسوم الحكومية: ${feeAmount.toFixed(3)} ريال عماني`
           : `[Paid by Client Card] Government fee: ${feeAmount.toFixed(3)} OMR`)
        : undefined;

      await updateStatusMutation.mutateAsync({
        jobServiceId: selectedTask.id,
        jobId: selectedTask.job_id,
        fromStatus: selectedTask.status,
        toStatus: newStatus,
        governmentRef: govRef || undefined,
        reason: clientPaidNote || ((newStatus === 'cancelled' || newStatus === 'gov_rejected' || newStatus === 'on_hold') ? reason : undefined),
        isDelayEvent: isDelay,
        holdReason: newStatus === 'on_hold' ? reason : undefined,
        rejectionReason: newStatus === 'gov_rejected' ? reason : undefined,
        proId: newStatus === 'assigned_to_pro' ? proId : undefined,
        proNotes: newStatus === 'assigned_to_pro' ? proNotes : undefined,
      });

      toast.success(isRtl ? 'تم حفظ التحديث بنجاح!' : 'Update saved successfully!');
      setSelectedTask(null);
      setIsOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || (isRtl ? 'فشل التحديث' : 'Update failed'));
    } finally {
      setIsUpdating(false);
    }
  };

  const needsGovRef = newStatus === 'gov_approved' || newStatus === 'gov_rejected';
  const needsReason = newStatus === 'on_hold' || newStatus === 'gov_rejected' || newStatus === 'cancelled';

  // Only operations employee sees this floating widget
  if (!profile?.can_do_ops) return null;

  return (
    <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-[99999]`} ref={containerRef} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Floating Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-gold to-[#B8860B] text-[#0A0F1E] flex items-center justify-center shadow-[0_4px_20px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all relative border border-gold/40 group"
      >
        <Zap size={24} className="group-hover:rotate-12 transition-transform" />
        
        {activeTasks.length > 0 && (
          <span className={`absolute -top-1 ${isRtl ? '-left-1' : '-right-1'} bg-red-500 text-white font-mono text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-lg border-2 border-background`}>
            {activeTasks.length}
          </span>
        )}
      </button>

      {/* Expanded Quick Update Popover Dashboard */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className={`absolute bottom-16 ${isRtl ? 'left-0' : 'right-0'} w-80 md:w-96 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[480px] font-sans`}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-widest">
                <Zap size={14} /> {isRtl ? 'تحديث سريع' : 'Quick Update'}
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            {/* Content Pane */}
            <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-4">
              {!selectedTask ? (
                <>
                  {/* Search bar */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-xl focus-within:border-primary transition-colors">
                    <Search size={16} className="text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder={isRtl ? 'البحث بالاسم أو اسم الخدمة...' : 'Search applicant or service name...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-full"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {sortedTasks.map((t: any) => {
                      const isTrusted = t.job?.client?.is_trusted;
                      const ministryFee = t.ministry_fee || 0;
                      const ministryAllocated = t.ministry_fee_allocated || 0;
                      const isMinistryFunded = ministryAllocated >= ministryFee;
                      const isLocked = !isTrusted && !isMinistryFunded && (ministryFee > 0);

                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            if (!isLocked) {
                              setSelectedTask(t);
                            } else {
                              toast.error(isRtl ? `"${t.service_name}" مغلق. مطلوب دفع الرسوم الوزارية أولاً.` : `"${t.service_name}" is locked. Ministry fee payment required.`);
                            }
                          }}
                          className={`p-3 border rounded-xl transition-all flex items-center justify-between text-start ${
                            isLocked 
                              ? 'bg-rose-500/5 border-rose-500/20 opacity-60 cursor-not-allowed'
                              : 'bg-muted/20 border-border/60 hover:bg-primary/10 hover:border-primary/40 cursor-pointer shadow-sm'
                          }`}
                        >
                          <div className="min-w-0 pr-3 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-foreground truncate">{t.service_name}</p>
                              {isLocked && <Lock size={10} className="text-rose-500 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {t.applicant_name || (isRtl ? 'بلا اسم' : 'No name')} · <span className="font-mono text-muted-foreground/80">{t.job?.job_code}</span>
                            </p>
                          </div>
                          {isLocked ? (
                            <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-rose-500/20 text-rose-500 bg-rose-500/10 shrink-0 ml-2">
                              {isRtl ? 'مغلق' : 'Locked'}
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-border text-muted-foreground bg-muted/40 shrink-0 ml-2">
                              {getStatusLabel(t.status)}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {filteredTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground font-medium italic text-center py-8">
                        {isRtl ? 'لم يتم العثور على مهام مطابقة.' : 'No matching tasks found.'}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 text-start">
                  {/* Selected Task Details Header */}
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="p-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors mt-0.5 border border-border"
                    >
                      <ArrowLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{selectedTask.service_name}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {selectedTask.applicant_name || (isRtl ? 'بلا اسم' : 'No Name')} · <span className="font-mono text-muted-foreground/80">{selectedTask.job?.job_code}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">{isRtl ? 'تحديث الحالة' : 'Update Status'}</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full bg-card border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all cursor-pointer font-medium"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-card text-foreground">{getStatusLabel(opt.value)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Conditional Gov Reference Code */}
                  {needsGovRef && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-primary uppercase tracking-widest block">{isRtl ? 'رقم المرجع الحكومي' : 'Gov Reference No.'}</label>
                      <input
                        type="text"
                        value={govRef}
                        onChange={(e) => setGovRef(e.target.value)}
                        placeholder={isRtl ? 'مثال: MOL/2026/12345' : 'e.g. MOL/2026/12345'}
                        className="w-full bg-card border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all font-mono"
                      />
                    </div>
                  )}

                  {/* Conditional Hold/Rejection/Cancellation Reason */}
                  {needsReason && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-red-500 uppercase tracking-widest block">
                        {newStatus === 'gov_rejected' ? (isRtl ? 'سبب الرفض' : 'Rejection Reason') : newStatus === 'cancelled' ? (isRtl ? 'سبب الإلغاء' : 'Cancellation Reason') : (isRtl ? 'سبب الإيقاف المؤقت' : 'Hold Reason')}
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder={newStatus === 'gov_rejected' ? (isRtl ? 'ما سبب الرفض؟' : 'Why was it rejected?') : newStatus === 'cancelled' ? (isRtl ? 'ما سبب الإلغاء؟' : 'Why is it cancelled?') : (isRtl ? 'ما سبب الإيقاف المؤقت؟' : 'Why is it on hold?')}
                        className="w-full bg-card border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all resize-none"
                      />
                    </div>
                  )}

                  {/* PRO assignment */}
                  {newStatus === 'assigned_to_pro' && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">{isRtl ? 'مندوب تخليص المعاملات *' : 'PRO Agent *'}</label>
                        <select
                          value={proId}
                          onChange={(e) => setProId(e.target.value)}
                          className="w-full bg-card border border-amber-500/40 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all cursor-pointer font-medium"
                        >
                          <option value="" className="bg-card text-foreground">{isRtl ? 'اختر المندوب...' : 'Select PRO Agent...'}</option>
                          {pros.map((e: any) => (
                            <option key={e.id} value={e.id} className="bg-card text-foreground">{e.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">{isRtl ? 'تعليمات المندوب' : 'PRO Instructions'}</label>
                        <textarea
                          value={proNotes}
                          onChange={(e) => setProNotes(e.target.value)}
                          rows={2}
                          placeholder={isRtl ? 'تعليمات خاصة لمندوب التخليص...' : 'Special instructions for PRO agent...'}
                          className="w-full bg-card border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Attachment Dropzone */}
                  {(newStatus === 'gov_approved' || newStatus === 'completed') && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                        <span>{isRtl ? '📎 المرفقات المسلمة' : '📎 Deliverable Attachments'}</span>
                        {selectedFiles.length > 0 && (
                          <span className="text-[8px] text-emerald-500 font-bold">{selectedFiles.length} {isRtl ? 'محدد' : 'selected'}</span>
                        )}
                      </label>

                      {selectedFiles.length > 0 && (
                        <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1">
                          {selectedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-muted/40 border border-border rounded-lg text-[9px] text-foreground font-mono">
                              <span className="truncate flex-1 pr-1 text-start">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-600 font-bold shrink-0 ml-2"
                              >
                                {isRtl ? 'إزالة' : 'Remove'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="relative border border-dashed border-border hover:border-primary/50 rounded-xl p-2.5 text-center transition-all bg-muted/20 hover:bg-muted/40 cursor-pointer">
                        <input
                          type="file"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              setSelectedFiles(prev => [...prev, ...Array.from(files)]);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Upload size={12} />
                          <span className="text-[9px] font-bold uppercase">{isRtl ? 'إضافة ملفات...' : 'Add files...'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Government Fee & Receipt */}
                  <AnimatePresence>
                    {(newStatus === 'gov_approved' || newStatus === 'completed') && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2 border-t border-border">
                        {/* Paid by Client Card Checkbox */}
                        <div className="flex items-center gap-2 py-1 bg-primary/5 px-2.5 py-1.5 rounded-xl border border-primary/20">
                          <input
                            type="checkbox"
                            id="quick_paid_by_client"
                            checked={paidByClient}
                            onChange={(e) => setPaidByClient(e.target.checked)}
                            className="w-4 h-4 rounded accent-primary bg-card border-border cursor-pointer"
                          />
                          <label htmlFor="quick_paid_by_client" className="text-[10px] font-bold text-foreground cursor-pointer select-none uppercase tracking-wider flex-1">
                            {isRtl ? 'العميل دفع ببطاقته (دفع مباشر)' : 'Paid by Client Card (Direct Pay)'}
                          </label>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-primary uppercase tracking-widest block">
                            {isRtl ? 'الرسوم الحكومية الفعلية المدفوعة (ريال عماني)' : 'Actual Government Fee Spent (OMR)'}
                          </label>
                          <input
                            type="text"
                            value={actualFee}
                            onChange={(e) => {
                              const text = e.target.value;
                              if (/^\d*\.?\d*$/.test(text)) {
                                  setActualFee(text);
                              }
                            }}
                            placeholder="0.000 OMR"
                            className="w-full bg-card border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all font-mono"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-primary uppercase tracking-widest block">
                            {isRtl ? 'إيصال الدفع الحكومي' : 'Government Receipt Document'}
                          </label>
                          <div className="relative">
                            <input
                              type="file"
                              id="quick_receipt_file_upload"
                              className="hidden"
                              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                              accept="image/*,.pdf"
                            />
                            <label 
                              htmlFor="quick_receipt_file_upload"
                              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border rounded-xl px-3 py-2 text-[10px] text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <Upload size={12} />
                              {receiptFile ? receiptFile.name : (isRtl ? 'تحميل إيصال الدفع' : 'Upload Payment Receipt')}
                            </label>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions Footer */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="flex-1 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-xl transition-all text-xs border border-border"
                      disabled={isUpdating}
                    >
                      {isRtl ? 'العودة' : 'Back'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1 shadow-md"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          {isRtl ? 'جاري الحفظ...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                          <Check size={12} />
                          {isRtl ? 'حفظ التحديث' : 'Save Update'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default QuickUpdateWidget;
