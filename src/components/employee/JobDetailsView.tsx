import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ChevronDown, ChevronUp, Plus, Calendar, MessageSquare, 
  CheckCircle2, AlertCircle, Clock, User, X, Coins,
  Upload, FileText, Eye, Download, Loader2, Layers,
  Shield, Phone, Activity, ChevronRight, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobLedger } from './JobLedger';
import { format, differenceInDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import MessagesTab from '../jobs/MessagesTab';
import DocumentsTab from '../jobs/DocumentsTab';
import { 
  useJobServices, 
  useUpdateJobServiceStep, 
  useAddJobServiceStep, 
  type JobService, 
  type JobServiceStatus, 
  type JobServiceStep 
} from '../../hooks/employee/useJobServices';
import { useJobTimeline } from '../../hooks/employee/useTimeline';
import { JobTimelinePanel } from '../jobs/JobTimelinePanel';

const CustomSelect = ({ value, options, onChange, className = '' }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentOption = options.find((o: any) => o.value === value) || options[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 outline-none ${className}`}
      >
        <span>{currentOption?.label || value}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 min-w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 flex flex-col py-1"
            >
              {options.map((opt: any) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`text-left px-4 py-2.5 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    value === opt.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ApplicantCard = ({ 
  js, 
  employees, 
  job, 
  onUpdated,
  onOpenStatusSheet
}: { 
  js: any; 
  employees: any[]; 
  job: any; 
  onUpdated: () => void;
  onOpenStatusSheet: (js: any) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const { profile } = useAuth();
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const isClientTrusted = job?.client?.is_trusted === true;
  const clientPaysMinistryFee = job?.client_pays_ministry_fee === true;
  const currentMinistryAllocated = js.ministry_fee_allocated || 0;
  const reqMinistryFee = js.ministry_fee || 0;
  // Auto-unlock if: client is trusted, OR client pays ministry fee directly, OR funds have been allocated
  const isAutoUnlocked = isClientTrusted 
    || clientPaysMinistryFee 
    || (reqMinistryFee > 0 && currentMinistryAllocated >= reqMinistryFee);
  const isLocked = !js.is_funded && !isAutoUnlocked && (Number(js.total_fee) > 0);


  const documentsList = js.documents || [];
  const inputs = documentsList.filter((d: any) => d.document_category !== 'output');
  const outputs = documentsList.filter((d: any) => d.document_category === 'output');

  const updateStepMutation = useUpdateJobServiceStep();
  const addStepMutation = useAddJobServiceStep();

  const handleToggleStep = async (stepId: string, currentStatus: string) => {
    if (isLocked) {
      toast.error('This service is locked until funds are allocated by Sales.');
      return;
    }
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        jobId: job.id,
        updates: { 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        }
      });
      toast.success('Step status updated');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update step');
    }
  };

  const handleUpdateStepAssignee = async (stepId: string, empId: string) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        jobId: job.id,
        updates: { assigned_to: empId || null }
      });
      
      // Dispatch notification if assigned to another team member
      if (empId && empId !== profile?.id) {
        const stepObj = js.steps?.find((s: any) => s.id === stepId);
        const stepTitle = stepObj?.step_name || 'Workflow Step';
        await supabase.from('notifications').insert({
          recipient_id: empId,
          sender_id: profile?.id || null,
          job_id: job.id,
          type: 'action_required',
          title_en: `New Step Assigned: ${stepTitle}`,
          title_ar: `تم تعيين خطوة جديدة: ${stepTitle}`,
          body_en: `${profile?.full_name || 'A team member'} assigned you a step in job ${job.job_code || ''} (${js.service_name || 'Service'}).`,
          body_ar: `قام ${profile?.full_name || 'عضو الفريق'} بتعيين خطوة لك في المعاملة ${job.job_code || ''}.`,
          action_url: `/employee/jobs/${job.id}`,
          is_read: false,
          action_required: true,
          created_at: new Date().toISOString()
        } as any);
      }

      toast.success('Step assignee updated');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign step');
    }
  };

  const handleAddCustomStep = async () => {
    if (isLocked) {
      toast.error('This service is locked until funds are allocated by Sales.');
      return;
    }
    if (!newStepName.trim()) return;
    setIsAddingStep(true);
    try {
      await addStepMutation.mutateAsync({
        jobServiceId: js.id,
        jobId: job.id,
        stepName: newStepName.trim(),
        displayOrder: (js.steps?.length || 0) + 1
      });
      toast.success('Custom step added');
      setNewStepName('');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add step');
    } finally {
      setIsAddingStep(false);
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (isLocked) {
      toast.error('This service is locked until funds are allocated by Sales.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsUploadingDoc(docId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${job.id}/${js.id}/${Date.now()}_${docId}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: storageError } = await supabase.storage.from('documents').upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('job_service_documents')
        .update({
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: profile.id,
          status: 'approved',
          created_at: new Date().toISOString()
        } as any)
        .eq('id', docId);

      if (dbError) throw dbError;
      toast.success('Document uploaded successfully!');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const [isUploadingMultiple, setIsUploadingMultiple] = useState(false);

  const handleDeleteDoc = async (docId: string, category?: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      if (category === 'output') {
        const { error } = await supabase
          .from('job_service_documents')
          .delete()
          .eq('id', docId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('job_service_documents')
          .update({
            file_name: null,
            file_path: null,
            file_size: null,
            file_type: null,
            uploaded_by: null,
            status: 'pending'
          } as any)
          .eq('id', docId);
        if (error) throw error;
      }
      toast.success('Document removed');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove document');
    }
  };

  const handleUploadMultipleDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile) return;

    setIsUploadingMultiple(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${job.id}/${js.id}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: storageError } = await supabase.storage.from('documents').upload(filePath, file);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase
          .from('job_service_documents')
          .insert({
            job_service_id: js.id,
            job_id: job.id,
            document_name: file.name.replace(/\.[^/.]+$/, ""),
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile.id,
            upload_source: 'ops',
            document_category: 'output',
            status: 'approved',
            is_client_visible: true,
            created_at: new Date().toISOString()
          } as any);

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);
      toast.success(`Successfully uploaded ${files.length} output document(s)!`);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploadingMultiple(false);
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const handleViewDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast.error('Could not generate view link');
    }
  };

  return (
    <div className={`border border-border/80 rounded-xl overflow-hidden transition-all ${isExpanded ? 'bg-muted/10 ring-1 ring-primary/20' : 'bg-card hover:bg-muted/5'}`}>
      {/* Row Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left px-5 py-4 cursor-pointer flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            #{js.item_number}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {js.applicant_name || `Applicant ${js.item_number}`}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <StatusBadge status={js.status} />
              <DeadlineBadge dateStr={js.deadline} status={js.status} />
              {js.ops_employee && (
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">· Ops: {(js.ops_employee as any).full_name}</span>
              )}
              {js.pro_agent && (
                <span className="text-[9px] text-amber-400 whitespace-nowrap">· PRO: {(js.pro_agent as any).full_name}</span>
              )}
              {js.government_ref && (
                <span className="text-[9px] text-cyan-400 whitespace-nowrap">· Ref: {js.government_ref}</span>
              )}
              {isLocked && (
                <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20 flex items-center gap-1 whitespace-nowrap shrink-0">
                  🔒 LOCKED (FUNDS REQUIRED)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-muted-foreground">
            {js.total_fee > 0 ? `${js.total_fee.toFixed(3)} OMR` : ''}
          </span>
          {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`border-t border-border px-5 py-5 bg-card/50 space-y-5 relative ${isLocked ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isLocked && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[1px]">
                <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                  🔒 Locked Awaiting Sales Allocation
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Side: Steps Checklist */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Workflow checklist
                </h4>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {js.steps?.map((step: any) => (
                    <div key={step.id} className="flex items-start justify-between gap-3 p-3 bg-muted/20 border border-border/40 rounded-xl">
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={step.status === 'completed'}
                          onChange={() => handleToggleStep(step.id, step.status)}
                          className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background outline-none cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className={`text-xs font-bold leading-tight ${step.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {step.step_name}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                            Status: {step.status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      {/* Step Assignee Selector */}
                      <select
                        value={step.assigned_to || ''}
                        onChange={(e) => handleUpdateStepAssignee(step.id, e.target.value)}
                        className="bg-muted/40 border border-border/60 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:border-primary/40 focus:border-primary cursor-pointer outline-none shrink-0"
                      >
                        <option value="">Unassigned</option>
                        {employees.filter(e => e.can_do_ops || e.role === 'employee').map(e => (
                          <option key={e.id} value={e.id}>{e.full_name}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {(!js.steps || js.steps.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No checklist steps initialized for this applicant.</p>
                  )}
                </div>

                {/* Add Inline Custom Step */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    placeholder="Add custom step..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomStep()}
                    className="flex-1 bg-muted/20 border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddCustomStep}
                    disabled={isAddingStep || !newStepName.trim()}
                    className="px-3 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
                  >
                    {isAddingStep ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Right Side: Documents */}
              <div className="space-y-4">
                {/* Required Input Documents */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Download size={12} /> Required Inputs
                  </h4>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {inputs.map((doc: any) => {
                      const hasFile = !!doc.file_path;
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border/40 rounded-xl">
                          <div className="min-w-0 pr-3">
                            <p className="text-xs font-bold text-foreground truncate">{doc.document_name}</p>
                            {hasFile ? (
                              <p className="text-[9px] text-emerald-400 font-bold truncate mt-0.5">
                                ✓ {doc.file_name}
                              </p>
                            ) : (
                              <p className="text-[9px] text-muted-foreground/60 italic mt-0.5">
                                Not Uploaded
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasFile ? (
                              <>
                                <button
                                  onClick={() => handleViewDoc(doc)}
                                  className="p-1.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                                  title="View"
                                >
                                  <Eye size={12} />
                                </button>
                                <button
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="p-1.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                                  title="Download"
                                >
                                  <Download size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id, 'input')}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            ) : (
                              <div className="relative">
                                <input
                                  type="file"
                                  onChange={(e) => handleUploadDoc(e, doc.id)}
                                  className="hidden"
                                  id={`card-upload-${doc.id}`}
                                />
                                <label
                                  htmlFor={`card-upload-${doc.id}`}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[9px] font-bold uppercase rounded-lg cursor-pointer transition-colors"
                                >
                                  {isUploadingDoc === doc.id ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <Upload size={10} />
                                  )}
                                  Upload
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {inputs.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No required inputs for this service.</p>
                    )}
                  </div>
                </div>

                {/* Output Deliverables */}
                <div className="space-y-2 pt-3 border-t border-border/40">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Upload size={12} /> Output Deliverables</span>
                    <span className="text-[8px] font-normal text-muted-foreground italic">Add multiple files</span>
                  </h4>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {outputs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border/40 rounded-xl">
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-bold text-foreground truncate">{doc.document_name}</p>
                          <p className="text-[9px] text-emerald-400 font-bold truncate mt-0.5">
                            ✓ {doc.file_name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleViewDoc(doc)}
                            className="p-1.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => handleDownloadDoc(doc)}
                            className="p-1.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id, 'output')}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Multi-file selector dropzone style */}
                    <div className="relative border border-dashed border-border hover:border-primary/40 rounded-xl p-3 text-center transition-all bg-card/20 cursor-pointer">
                      <input
                        type="file"
                        multiple
                        onChange={handleUploadMultipleDocs}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploadingMultiple}
                      />
                      <div className="flex items-center justify-center gap-1.5">
                        {isUploadingMultiple ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-primary" />
                            <span className="text-[9px] font-bold text-primary uppercase">Uploading deliverables...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={12} className="text-muted-foreground" />
                            <span className="text-[9px] font-bold text-foreground uppercase">Upload Deliverable files</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inline Action Footer */}
            <div className="flex justify-end pt-3 border-t border-border/40">
              <button
                onClick={() => onOpenStatusSheet(js)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-xl hover:shadow-[0_0_10px_rgba(212,175,55,0.2)] transition-all"
              >
                <Activity size={12} /> Update Applicant Status
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Service Status Bottom Sheet ────────────────────────────────────────────

const SERVICE_STATUS_OPTIONS: { value: JobServiceStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-white/60' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-400' },
  { value: 'applied', label: 'Applied', color: 'text-cyan-400' },
  { value: 'assigned_to_pro', label: 'Assigned to PRO', color: 'text-amber-400' },
  { value: 'gov_approved', label: 'Govt Approved', color: 'text-emerald-400' },
  { value: 'gov_rejected', label: 'Govt Rejected', color: 'text-red-400' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-500' },
  { value: 'on_hold', label: 'On Hold', color: 'text-yellow-400' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-500' },
];

const StatusBadge = ({ status }: { status: JobServiceStatus }) => {
  const opt = SERVICE_STATUS_OPTIONS.find(o => o.value === status);
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 ${opt?.color || 'text-white/40'}`}>
      {opt?.label || status}
    </span>
  );
};

const DeadlineBadge = ({ dateStr, status }: { dateStr: string | null; status: string }) => {
  if (!dateStr) return null;
  if (status === 'completed' || status === 'cancelled') return null;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20 whitespace-nowrap shrink-0">
      <AlertCircle size={9} /> {Math.abs(days)}d overdue
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20 whitespace-nowrap shrink-0">
      <Clock size={9} /> {days}d left
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/50 whitespace-nowrap shrink-0">
      <Calendar size={9} /> {format(parseISO(dateStr), 'MMM d')}
    </span>
  );
};

const ServiceStatusSheet = ({
  service,
  jobId,
  employees,
  onClose,
  onUpdated,
}: {
  service: JobService;
  jobId: string;
  employees: any[];
  onClose: () => void;
  onUpdated: () => void;
}) => {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [status, setStatus] = useState<JobServiceStatus>(service.status);
  const [proId, setProId] = useState(service.pro_id || '');
  const [proNotes, setProNotes] = useState(service.pro_notes || '');
  const [govRef, setGovRef] = useState(service.government_ref || '');
  const [holdReason, setHoldReason] = useState(service.pending_reason || '');
  const [rejectionReason, setRejectionReason] = useState(service.rejection_reason || '');
  const [applicantName, setApplicantName] = useState(service.applicant_name || '');
  const [notes, setNotes] = useState(service.notes || '');
  const [opsEmployeeId, setOpsEmployeeId] = useState(service.ops_employee_id || '');
  const [deadline, setDeadline] = useState(service.deadline || '');
  const [issueDate, setIssueDate] = useState((service as any).issue_date || '');
  const [expiryDate, setExpiryDate] = useState((service as any).expiry_date || '');
  const [isSaving, setIsSaving] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [forwardReason, setForwardReason] = useState('');
  const [actualFee, setActualFee] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paidByClient, setPaidByClient] = useState(service.notes?.includes('[PAID BY CLIENT CARD]') || false);

  const handleAssignSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    setShowConfirmModal(true);
  };

  const isOpsOnly = !!(profile?.can_do_ops && !profile?.is_manager && !profile?.can_do_sales && profile?.role !== 'admin');
  const isSalesOnly = !!(profile?.can_do_sales && !profile?.can_do_ops && !profile?.is_manager && profile?.role !== 'admin');
  const isStatusDisabled = isSalesOnly && opsEmployeeId !== profile?.id;

  const filteredEmployees = isOpsOnly
    ? employees.filter((e: any) => (e.can_do_ops || e.role === 'employee') && e.id !== profile?.id)
    : employees.filter((e: any) => e.can_do_ops || e.role === 'employee');

  useEffect(() => {
    if (service.id) {
      supabase
        .from('job_service_documents')
        .select('*')
        .eq('job_service_id', service.id)
        .then(({ data }) => {
          if (data) setDocs(data);
        });
    }
  }, [service.id]);

  const PRESET_DOCUMENTS = [
    'SELFIE WITH PASSPORT',
    'PASSPORT SIZE PHOTO',
    'EMAIL ID',
    'CONTACT NUMBER',
    'COLOR PASSPORT COPIES OF SHAREHOLDERS',
    'COLOR PHOTO OF THE SHARE HOLDER',
    'DOCUMENTS PROVIDING PREVIOUS EXPERIENCE IN THE SAME LINE OF BUSINESS OR EDUCATION CERTIFICATE',
    'SUGGESTION OF 5 NAMES FOR THE NEW COMPANY (PREFERABLY ARABIC)'
  ];

  const handleAddPresetDoc = async (docName: string) => {
    if (docs.some(d => d.document_name.toLowerCase() === docName.toLowerCase())) {
      toast.error('This document requirement is already added.');
      return;
    }
    
    setIsAddingDoc(true);
    try {
      const { data: newDoc, error } = await supabase
        .from('job_service_documents')
        .insert({
          job_service_id: service.id,
          job_id: jobId,
          document_name: docName,
          status: 'pending',
          is_client_visible: true,
          created_at: new Date().toISOString()
        } as any)
        .select()
        .single() as any;

      if (error) throw error;
      
      toast.success(`"${docName}" requirement added`);
      setDocs(prev => [...prev, newDoc]);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add document requirement');
    } finally {
      setIsAddingDoc(false);
    }
  };

  const [newDocName, setNewDocName] = useState('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  const handleAddDocRequirement = async () => {
    if (!newDocName.trim() || !profile) return;
    setIsAddingDoc(true);
    try {
      const { data: newDoc, error } = await supabase
        .from('job_service_documents')
        .insert({
          job_service_id: service.id,
          job_id: jobId,
          document_name: newDocName.trim(),
          status: 'pending',
          is_client_visible: true,
          created_at: new Date().toISOString()
        } as any)
        .select()
        .single() as any;

      if (error) throw error;
      
      toast.success('Document requirement added');
      setDocs(prev => [...prev, newDoc]);
      setNewDocName('');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add document requirement');
    } finally {
      setIsAddingDoc(false);
    }
  };

  const handleDeleteDocRequirement = async (docId: string) => {
    if (!window.confirm('Are you sure you want to remove this required document?')) return;
    try {
      const { error } = await supabase
        .from('job_service_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
      toast.success('Document requirement deleted');
      setDocs(prev => prev.filter(d => d.id !== docId));
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete requirement');
    }
  };

  const handleDeleteUploadedFile = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete the uploaded file for this requirement?')) return;
    try {
      const { error } = await supabase
        .from('job_service_documents')
        .update({
          file_name: null,
          file_path: null,
          file_size: null,
          file_type: null,
          uploaded_by: null,
          status: 'pending'
        } as any)
        .eq('id', docId);

      if (error) throw error;
      toast.success('Document file removed');
      
      const { data } = await supabase.from('job_service_documents').select('*').eq('job_service_id', service.id);
      if (data) setDocs(data);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove file');
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsUploadingDoc(docId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}/${service.id}/${Date.now()}_${docId}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: storageError } = await supabase.storage.from('documents').upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('job_service_documents')
        .update({
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: profile.id,
          status: 'approved',
          created_at: new Date().toISOString()
        } as any)
        .eq('id', docId);

      if (dbError) throw dbError;
      toast.success('Document uploaded successfully!');
      
      const { data } = await supabase.from('job_service_documents').select('*').eq('job_service_id', service.id);
      if (data) setDocs(data);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const handleViewDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast.error('Could not generate view link');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const feeAmount = parseFloat(actualFee) || 0;
      if (feeAmount > 0 && !receiptFile) {
        toast.error('You must upload a payment receipt when recording government fees.');
        setIsSaving(false);
        return;
      }

      // Upload receipt file if government fee is recorded
      let receiptUrl = '';
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${jobId}/${service.id}/${Date.now()}_receipt.${fileExt}`;
        const filePath = `documents/${fileName}`;
        
        const { error: storageError } = await supabase.storage.from('documents').upload(filePath, receiptFile);
        if (storageError) throw storageError;
        receiptUrl = filePath;

        if (paidByClient) {
          // If paid by client card, upload it directly as an output deliverable document
          const { error: docError } = await supabase
            .from('job_service_documents')
            .insert({
              job_service_id: service.id,
              job_id: jobId,
              document_name: 'Government Receipt Document',
              file_name: receiptFile.name,
              file_path: filePath,
              file_size: receiptFile.size,
              file_type: receiptFile.type,
              document_category: 'output',
              uploaded_by: profile?.id,
              status: 'approved',
              created_at: new Date().toISOString()
            } as any);
          if (docError) throw docError;
        }
      }

      // Log expense in job_expenses table (only if NOT paid by client card)
      if (feeAmount > 0 && !paidByClient) {
        const { error: expenseError } = await supabase.from('job_expenses').insert({
          job_id: jobId,
          job_service_id: service.id,
          amount: feeAmount,
          expense_type: 'ministry_fee',
          receipt_url: receiptUrl || null,
          notes: `Recorded during status update to ${status}`,
          status: 'pending_approval',
          created_by: profile?.id
        });
        if (expenseError) throw expenseError;
      }

      const payload: any = {
        status,
        applicant_name: applicantName || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };

      if (profile?.role === 'admin' || profile?.is_manager || profile?.can_do_sales || profile?.can_do_ops) {
        payload.ops_employee_id = opsEmployeeId || null;
        payload.deadline = deadline || null;
        payload.target_completion_date = deadline || null;

        // Assignment directly goes into accepted state
        if (opsEmployeeId !== service.ops_employee_id) {
          payload.acceptance_status = 'accepted';
        }
      }

      if (status === 'assigned_to_pro') {
        payload.pro_id = proId || null;
        payload.pro_notes = proNotes || null;
        payload.pro_shared_at = new Date().toISOString();
      }
      if (status === 'gov_approved' || status === 'gov_rejected') {
        payload.government_ref = govRef || null;
        payload.government_approved_at = status === 'gov_approved' ? new Date().toISOString() : null;
      }
      if (status === 'gov_approved' || status === 'completed') {
        payload.issue_date = issueDate || null;
        payload.expiry_date = expiryDate || null;
      }
      if (status === 'on_hold') {
        payload.pending_reason = holdReason || null;
      }
      if (status === 'gov_rejected') {
        payload.rejection_reason = rejectionReason || null;
      }
      if (status === 'in_progress' && !service.started_at) {
        payload.started_at = new Date().toISOString();
      }
      if (status === 'completed' && !service.completed_at) {
        payload.completed_at = new Date().toISOString();
      }
      if (status === 'assigned_to_pro') {
        payload.assigned_by = profile?.id;
      }

      const { error } = await (supabase.from('job_services').update(payload).eq('id', service.id) as any);
      if (error) throw error;

      // Log assignment change to timeline
      if (opsEmployeeId !== service.ops_employee_id) {
        let changerRole = 'ops';
        if (profile?.role === 'admin') changerRole = 'admin';
        else if (profile?.is_manager) changerRole = 'manager';
        else if (profile?.can_do_sales && !profile?.can_do_ops) changerRole = 'sales';

        const targetEmp = employees.find((e: any) => e.id === opsEmployeeId);
        const targetName = targetEmp ? targetEmp.full_name : 'Unassigned';

        await (supabase.from('job_service_timeline').insert({
          job_service_id: service.id,
          job_id: jobId,
          from_status: service.ops_employee_id ? 'assigned' : null,
          to_status: opsEmployeeId ? 'assigned' : 'unassigned',
          changed_by: profile?.id,
          changed_by_name: profile?.full_name,
          changed_by_role: changerRole,
          changed_at: new Date().toISOString(),
          reason: forwardReason ? `Forwarded to ${targetName}. Note: ${forwardReason}` : `Assigned to ${targetName}`,
          is_delay_event: false,
          is_client_caused: false
        } as any) as any);
      }

      // Log status transition to timeline
      if (status !== service.status) {
        let daysInPrevStage: number | null = null;
        const prevTimestamp = service.updated_at || service.created_at;
        if (prevTimestamp) {
          const diff = (Date.now() - new Date(prevTimestamp).getTime()) / (1000 * 60 * 60 * 24);
          daysInPrevStage = Math.round(diff * 10) / 10;
        }

        let changerRole = 'ops';
        if (profile?.role === 'admin') changerRole = 'admin';
        else if (profile?.is_manager) changerRole = 'manager';
        else if (profile?.is_pro) changerRole = 'pro';
        else if (profile?.can_do_sales && !profile?.can_do_ops) changerRole = 'sales';

        const clientPaidNote = paidByClient
          ? (isRtl 
             ? `[دفع بواسطة بطاقة العميل] الرسوم الحكومية: ${feeAmount.toFixed(3)} ريال عماني`
             : `[Paid by Client Card] Government fee: ${feeAmount.toFixed(3)} OMR`)
          : null;

        await (supabase.from('job_service_timeline').insert({
          job_service_id: service.id,
          job_id: jobId,
          from_status: service.status,
          to_status: status,
          changed_by: profile?.id,
          changed_by_name: profile?.full_name,
          changed_by_role: changerRole,
          days_in_previous_stage: daysInPrevStage,
          changed_at: new Date().toISOString(),
          reason: clientPaidNote || holdReason || rejectionReason || notes || null,
          government_ref: govRef || null,
          is_delay_event: status === 'on_hold',
          service_name: service.service_name || null,
        } as any) as any);
      }

      toast.success('Service status updated');
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {service.service_name}{service.quantity > 1 ? ` · Applicant ${service.item_number}` : ''}
            </p>
            <h3 className="font-syne font-bold text-foreground mt-0.5">
              {service.applicant_name || `Item #${service.item_number}`}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* Applicant name */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Applicant / Item Name</label>
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="Enter applicant name..."
              className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
            />
          </div>

          {/* Assignment & Deadline (Sales/Admin/Manager only) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                {isOpsOnly ? 'Forward to Coworker' : 'Ops Employee'}
              </label>
              <select
                value={opsEmployeeId}
                onChange={(e) => handleAssignSelect(e.target.value)}
                className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
              >
                <option value="">Unassigned</option>
                {filteredEmployees.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>

            {!isOpsOnly && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Deadline</label>
                <input
                  type="date"
                  value={deadline ? deadline.split('T')[0] : ''}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Status grid */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Status</label>
              {isStatusDisabled && (
                <span className="text-[9px] font-bold text-yellow-500/90 uppercase tracking-wider">
                  ⚠️ Read-Only (Assigned to Ops)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SERVICE_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isStatusDisabled}
                  onClick={() => setStatus(opt.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    status === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  } ${isStatusDisabled ? 'opacity-40 cursor-not-allowed border-dashed' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PRO assignment */}
          {status === 'assigned_to_pro' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1"><Shield size={10} /> PRO Agent</label>
                <select
                  value={proId}
                  onChange={(e) => setProId(e.target.value)}
                  className="w-full bg-muted/30 border border-amber-400/30 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                >
                  <option value="">Select PRO Agent...</option>
                  {employees.filter(e => e.role === 'pro' || e.is_pro).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">PRO Instructions</label>
                <textarea
                  value={proNotes}
                  onChange={(e) => setProNotes(e.target.value)}
                  rows={2}
                  placeholder="Special instructions for PRO agent..."
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all resize-none"
                />
              </div>
            </motion.div>
          )}

          {/* Government info */}
          {(status === 'gov_approved' || status === 'gov_rejected' || status === 'completed') && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
              {(status === 'gov_approved' || status === 'gov_rejected') && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Government Reference No.</label>
                  <input
                    type="text"
                    value={govRef}
                    onChange={(e) => setGovRef(e.target.value)}
                    placeholder="e.g. MOL/2025/12345"
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                  />
                </div>
              )}

              {(status === 'gov_approved' || status === 'completed') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                    <input
                      type="date"
                      value={issueDate ? issueDate.split('T')[0] : ''}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">{isRtl ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                    <input
                      type="date"
                      value={expiryDate ? expiryDate.split('T')[0] : ''}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Rejection reason */}
          {status === 'gov_rejected' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
              <label className="text-[9px] font-bold text-red-400 uppercase tracking-widest block">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Why was this rejected?"
                className="w-full bg-muted/30 border border-red-400/30 focus:border-red-400 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all resize-none"
              />
            </motion.div>
          )}

          {/* On hold reason */}
          {status === 'on_hold' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
              <label className="text-[9px] font-bold text-yellow-400 uppercase tracking-widest block">Hold Reason</label>
              <textarea
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                rows={2}
                placeholder="Why is this on hold?"
                className="w-full bg-muted/30 border border-yellow-400/30 focus:border-yellow-400 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all resize-none"
              />
            </motion.div>
          )}

          {/* Internal notes */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes for this service item..."
              className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all resize-none"
            />
          </div>

          {/* Document Checklist */}
          <div className="space-y-3 pt-2">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
              Required Documents Checklist
            </label>
            <div className="space-y-2">
              {docs.map((doc: any) => {
                const hasFile = !!doc.file_path;
                return (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-foreground truncate">{doc.document_name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {hasFile ? `File: ${doc.file_name}` : 'Not Uploaded'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasFile ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(doc)}
                            className="p-1.5 bg-muted/40 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewDoc(doc)}
                            className="p-1.5 bg-muted/40 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUploadedFile(doc.id)}
                            className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-rose-400 rounded-lg transition-colors"
                            title="Delete Uploaded File"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="file"
                            onChange={(e) => handleUploadDoc(e, doc.id)}
                            className="hidden"
                            id={`file-upload-${doc.id}`}
                          />
                          <label
                            htmlFor={`file-upload-${doc.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold uppercase rounded-lg cursor-pointer transition-colors"
                          >
                            {isUploadingDoc === doc.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Upload size={10} />
                            )}
                            Upload
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocRequirement(doc.id)}
                            className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-rose-400 rounded-lg transition-colors"
                            title="Delete Requirement"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground italic mb-2">No document requirements for this service.</p>
              )}
              {/* Quick Add Preset Recommendation Chips */}
              <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Quick Add Common Documents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_DOCUMENTS.map((docName) => {
                    const isAdded = docs.some(d => d.document_name.toLowerCase() === docName.toLowerCase());
                    return (
                      <button
                        key={docName}
                        type="button"
                        onClick={() => handleAddPresetDoc(docName)}
                        className={`text-[9px] px-2.5 py-1 rounded-lg border transition-all duration-200 flex items-center gap-1 font-medium select-none ${
                          isAdded 
                            ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 opacity-55 cursor-not-allowed"
                            : "bg-muted/30 hover:bg-primary/10 text-muted-foreground hover:text-primary border-border/60 cursor-pointer"
                        }`}
                        disabled={isAdded || isAddingDoc}
                      >
                        {isAdded && <span className="text-emerald-400 font-bold">✓</span>}
                        {docName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Requirement Input */}
              <div className="flex gap-2 items-center mt-3 pt-3 border-t border-border/40">
                <input
                  type="text"
                  placeholder="Add custom required document... (e.g. Municipal License)"
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  className="flex-1 bg-muted/20 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none transition-all"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDocRequirement();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddDocRequirement}
                  disabled={isAddingDoc || !newDocName.trim()}
                  className="px-3.5 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-[#0A0F1E] text-xs font-bold rounded-xl border border-primary/20 transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isAddingDoc ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add Document
                </button>
              </div>
            </div>

            {/* Government Fee & Receipt */}
            <AnimatePresence>
              {(status === 'gov_approved' || status === 'completed') && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-3 border-t border-border/40">
                  {/* Paid by Client Card Checkbox */}
                  <div className="flex items-center gap-2 py-1.5 bg-primary/5 px-3.5 rounded-xl border border-primary/10">
                    <input
                      type="checkbox"
                      id="details_paid_by_client"
                      checked={paidByClient}
                      onChange={(e) => setPaidByClient(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary bg-muted/20 border-border cursor-pointer"
                    />
                    <label htmlFor="details_paid_by_client" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none uppercase tracking-wider flex-1">
                      {isRtl ? 'العميل دفع ببطاقته (دفع مباشر)' : 'Paid by Client Card (Direct Pay)'}
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-primary uppercase tracking-widest block">
                      Actual Government Fee Spent (OMR)
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
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-primary uppercase tracking-widest block">
                      Government Receipt Document
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        id="details_receipt_file_upload"
                        className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        accept="image/*,.pdf"
                      />
                      <label 
                        htmlFor="details_receipt_file_upload"
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Upload size={14} />
                        {receiptFile ? receiptFile.name : "Upload Payment Receipt"}
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-muted hover:bg-muted/70 text-muted-foreground font-bold rounded-xl transition-all text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Reassignment / Forward Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowConfirmModal(false)} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-md bg-card border border-gold/30 rounded-2xl p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-base font-bold text-foreground font-syne flex items-center gap-2 text-gold">
                  ⚠️ Confirm Task Assignment
                </h3>
                
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to assign or forward this task to{' '}
                  <span className="text-foreground font-bold">
                    {employees.find((e: any) => e.id === selectedEmployeeId)?.full_name || 'Unassigned'}
                  </span>
                  ? This will send them a real-time notification alert.
                </p>

                {/* Handoff Reason Note */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                    Reassignment Note / Reason
                  </label>
                  <textarea
                    value={forwardReason}
                    onChange={(e) => setForwardReason(e.target.value)}
                    rows={3}
                    placeholder="Type a handoff message or reason for assignment..."
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all resize-none"
                    required={isOpsOnly}
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setSelectedEmployeeId('');
                      setForwardReason('');
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-bold rounded-xl transition-all text-xs border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (isOpsOnly && !forwardReason.trim()) {
                        toast.error('Reassignment note is required for coworker handoffs');
                        return;
                      }
                      setShowConfirmModal(false);
                      
                      // Update assignee state
                      setOpsEmployeeId(selectedEmployeeId);
                      
                      // If reassigning to another worker, reset status to pending_acceptance
                      if (selectedEmployeeId && selectedEmployeeId !== service.ops_employee_id) {
                        setStatus('pending' as any); // Reset to base status or trigger acceptance
                      }
                      
                      toast.success('Assignment confirmed. Click "Save Changes" to commit.');
                    }}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-[#0A0F1E] font-bold rounded-xl transition-all text-xs hover:shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ─── Services Tab ─────────────────────────────────────────────────────────────

const OperationsPanel = ({ job, employees, onDataRefresh }: { job: any; employees: any[]; onDataRefresh: () => void }) => {
  const { data: jobServices, isLoading, refetch } = useJobServices(job?.id);
  const [selectedService, setSelectedService] = useState<JobService | null>(null);
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const isManagerOrAdmin = profile?.role === 'admin' || profile?.is_manager;
  const isJobSalesOrCreator = job?.sales_employee_id === profile?.id || job?.assigned_by === profile?.id;
  const filteredServices = (jobServices || []).filter(js => {
    if (isManagerOrAdmin || isJobSalesOrCreator) return true;
    return js.ops_employee_id === profile?.id;
  }).sort((a, b) => {
    const orderA = a.display_order ?? 1;
    const orderB = b.display_order ?? 1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.item_number || 1) - (b.item_number || 1);
  });

  // Group by service_id to show service groups
  const grouped: Record<string, JobService[]> = {};
  filteredServices.forEach((js) => {
    const key = js.service_id + '_' + js.service_name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(js);
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12 animate-pulse text-sm">{isRtl ? 'جاري تحميل العمليات...' : 'Loading operations...'}</div>;
  }

  if (filteredServices.length === 0) {
    return (
      <div className="text-center border-2 border-dashed border-border rounded-3xl p-12 bg-card/25">
        <Layers size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="font-bold text-foreground mb-1">{isRtl ? 'لا توجد خدمات عملياتية بعد' : 'No operational services yet'}</p>
        <p className="text-xs text-muted-foreground">{isRtl ? 'قم بإضافة خدمات باستخدام منشئ الوظائف أو إعدادات القوالب.' : 'Add services using the Job Builder or template configs.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([key, items]) => {
        const firstItem = items[0];
        const allDone = items.every(i => i.status === 'completed' || i.status === 'cancelled');
        return (
          <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Group header */}
            <div className="px-5 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  allDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
                }`}>
                  {allDone ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-syne font-bold text-foreground text-sm">
                      {isRtl ? (firstItem.service?.name_ar || firstItem.service_name) : firstItem.service_name}
                    </p>
                    {job?.package?.name_en && (
                      <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {job.package.name_en}
                      </span>
                    )}
                    {job?.custom_name && !job?.package?.name_en && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        {job.custom_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isRtl ? `${items.length} طلب` : `${items.length} applicant${items.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              {firstItem.service?.requires_pro && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield size={9} /> {isRtl ? 'مطلوب مخلص معاملات' : 'PRO Required'}
                </span>
              )}
            </div>

            {/* Per-applicant list */}
            <div className="p-4 space-y-3">
              {items.map((js) => (
                <ApplicantCard
                  key={js.id}
                  js={js}
                  employees={employees}
                  job={job}
                  onUpdated={() => {
                    refetch();
                    onDataRefresh();
                  }}
                  onOpenStatusSheet={(serviceToEdit) => setSelectedService(serviceToEdit)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Status update bottom sheet */}
      <AnimatePresence>
        {selectedService && (
          <ServiceStatusSheet
            service={selectedService}
            jobId={job.id}
            employees={employees}
            onClose={() => setSelectedService(null)}
            onUpdated={() => {
              setSelectedService(null);
              refetch();
              onDataRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Timeline Panel (Imported from shared components/jobs/JobTimelinePanel) ───

export const JobDetailsView = ({ job, onUpdated }: { job: any; onUpdated?: () => void }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'operations' | 'ledger' | 'timeline' | 'documents' | 'messages'>('operations');
  const [steps, setSteps] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch messages reactively via React Query
  const { data: messages = [] } = useQuery({
    queryKey: ['job_messages', job?.id],
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(full_name, role)')
        .eq('job_id', job.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      return (data || []).map((m: any) => ({
        id: m.id,
        job_id: m.job_id,
        sender_id: m.sender_id,
        sender_type: m.sender?.role || 'client',
        sender_name: m.sender?.full_name ?? 'Unknown',
        content: m.content,
        is_read: m.is_read ?? true,
        created_at: m.created_at,
        conversation_scope: m.conversation_scope ?? 'staff_client',
      }));
    },
    enabled: !!job?.id
  });

  const { profile } = useAuth();
  const canViewFinancials = profile?.role === 'admin' || profile?.id === job?.sales_employee_id;
  const unreadCount = messages ? messages.filter((m: any) => m.sender_id !== profile?.id && !m.is_read).length : 0;
  const [totalMinistryFee, setTotalMinistryFee] = useState<number>(0);
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [isCustomStepModalOpen, setIsCustomStepModalOpen] = useState(false);
  const [customStepName, setCustomStepName] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState<{ id: string; status: string } | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPayMode, setSelectedPayMode] = useState('Bank Transfer');

  const fetchCombinedDocuments = async (jobId: string) => {
    const { data: docsData } = await supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name, role)')
      .eq('job_id', jobId);

    const { data: serviceDocsData } = await supabase
      .from('job_service_documents')
      .select(`
        *,
        uploader:profiles!uploaded_by(full_name, role),
        job_service:job_services!job_service_id(applicant_name, service_name)
      `)
      .eq('job_id', jobId)
      .not('file_path', 'is', null);

    const generalDocs = (docsData || []).map((d: any) => ({
      ...d,
      uploaded_by_role: d.uploader?.role ?? 'client',
      uploaded_by_name: d.uploader?.full_name ?? 'Unknown',
      is_checklist_doc: false,
      is_client_visible: d.is_client_visible ?? true,
    }));

    const serviceDocs = (serviceDocsData || []).map((d: any) => ({
      ...d,
      file_name: d.file_name ?? d.document_name,
      uploaded_by_role: d.uploader?.role ?? 'client',
      uploaded_by_name: d.uploader?.full_name ?? 'Unknown',
      is_checklist_doc: true,
      is_client_visible: d.is_client_visible ?? false,
      applicant_name: d.job_service?.applicant_name,
      service_name: d.job_service?.service_name,
      document_type: d.document_name,
      document_category: d.document_category
    }));

    return [...generalDocs, ...serviceDocs];
  };

  useEffect(() => {
    if (job?.id) {
      loadData();

      // Realtime listener for general document updates
      const docChannel = supabase
        .channel(`job-docs-${job.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents',
            filter: `job_id=eq.${job.id}`
          },
          () => {
            fetchCombinedDocuments(job.id).then(setJobDocuments);
          }
        )
        .subscribe();

      // Realtime listener for checklist service documents updates
      const serviceDocChannel = supabase
        .channel(`job-service-docs-${job.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'job_service_documents',
            filter: `job_id=eq.${job.id}`
          },
          () => {
            fetchCombinedDocuments(job.id).then(setJobDocuments);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(docChannel);
        supabase.removeChannel(serviceDocChannel);
      };
    }
  }, [job?.id]);

  const handleMarkInvoicePaid = async () => {
    if (!existingInvoice) return;
    try {
      // 1. Fetch latest job data
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, total_fee, work_fee, ministry_fee, advance_amount, remaining_amount')
        .eq('id', job.id)
        .single();

      // 2. Fetch all verified payments
      const { data: payments } = await supabase
        .from('job_payments')
        .select('amount')
        .eq('job_id', job.id)
        .eq('status', 'verified');

      const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingToPay = Math.max(0, Number(jobData?.total_fee || 0) - totalPaid);

      // 3. Insert a verified payment record in job_payments if balance remains
      if (remainingToPay > 0) {
        const { error: payErr } = await supabase.from('job_payments').insert({
          job_id: job.id,
          amount: remainingToPay,
          payment_method: selectedPayMode.toLowerCase(),
          notes: `Manually marked as paid via invoice actions`,
          status: 'verified',
          recorded_by: profile?.id,
          verified_by: profile?.id,
          verified_at: new Date().toISOString()
        });
        if (payErr) throw payErr;
      }

      // 4. Update the job details to show fully paid status
      const { error: jobErr } = await supabase.from('jobs').update({
        advance_paid: true,
        advance_paid_at: new Date().toISOString(),
        remaining_paid: true,
        remaining_paid_at: new Date().toISOString(),
        advance_amount: Number(jobData?.total_fee || 0),
        remaining_amount: 0
      }).eq('id', job.id);
      
      if (jobErr) throw jobErr;

      // 5. Update invoice status to paid
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid', 
          paid_date: new Date().toISOString(),
          terms: selectedPayMode
        })
        .eq('id', existingInvoice.id);

      if (error) {
        import('react-hot-toast').then(toast => {
          toast.default.error(`Failed to update invoice: ${error.message}`);
        });
      } else {
        import('react-hot-toast').then(toast => {
          toast.default.success(`Invoice marked as Paid via ${selectedPayMode}. Financial ledger updated.`);
        });
        setIsPayModalOpen(false);
        loadData();
        if (onUpdated) onUpdated();
      }
    } catch (e: any) {
      import('react-hot-toast').then(toast => {
        toast.default.error(`Error: ${e.message}`);
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    
    // Fetch steps with workflow template info
    const { data: stepData } = await supabase
      .from('job_steps')
      .select(`
        *,
        workflow_step:workflow_steps(name_en, step_order)
      `)
      .eq('job_id', job.id)
      .order('created_at', { ascending: true }); 

    // Fetch total ministry fees for the job
    const { data: feesData } = await supabase
      .from('job_sub_tasks')
      .select('ministry_fee, job_steps!inner(job_id)')
      .eq('job_steps.job_id', job.id);
      
    if (feesData) {
      const total = feesData.reduce((sum, item) => sum + (Number(item.ministry_fee) || 0), 0);
      setTotalMinistryFee(total);
    }

    // Fetch invoice for this job
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('job_id', job.id)
      .maybeSingle();
    setExistingInvoice(invoiceData || null);

    // Fetch documents
    const mergedDocs = await fetchCombinedDocuments(job.id);
    setJobDocuments(mergedDocs);

    // Fetch employees for assignment
    const { data: empData } = await supabase.from('profiles').select('id, full_name, availability_status, role, is_pro, can_do_ops, can_do_sales').eq('role', 'employee');

    if (stepData) {
      // Sort by workflow_step order if available
      const sortedSteps = (stepData as any[]).sort((a, b) => {
        const orderA = a.workflow_step?.step_order ?? 999;
        const orderB = b.workflow_step?.step_order ?? 999;
        return orderA - orderB;
      });
      setSteps(sortedSteps);
    }
    
    if (empData) setEmployees(empData);
    
    setLoading(false);
  };

  const submitCustomStep = async () => {
    if (!customStepName.trim()) return;
    setIsAddingStep(true);

    const { error } = await supabase.from('job_steps').insert({
      job_id: job.id,
      custom_name: customStepName.trim(),
      status: 'pending'
    });

    if (error) {
      import('react-hot-toast').then(toast => {
        toast.default.error(`Error: ${error.message || 'Failed to add step'}`);
      });
      console.error("Supabase Error Details:", error);
    } else {
      import('react-hot-toast').then(toast => {
        toast.default.success('Custom step added successfully');
      });
      setCustomStepName('');
      setIsCustomStepModalOpen(false);
      loadData();
    }
    setIsAddingStep(false);
  };

  const handleUpdateJobStatus = async (status: string) => {
    if (status === 'completed') {
      // Check for incomplete steps in the UI state
      const hasIncompleteSteps = steps.some(s => s.status !== 'completed' && s.status !== 'skipped');
      
      // Query the database for any incomplete sub-tasks linked to this job
      const { data: incompleteSubTasks, error: checkError } = await supabase
        .from('job_sub_tasks')
        .select('id, status, job_steps!inner(job_id)')
        .eq('job_steps.job_id', job.id)
        .neq('status', 'approved');

      if (hasIncompleteSteps || (incompleteSubTasks && incompleteSubTasks.length > 0)) {
        import('react-hot-toast').then(toast => {
          toast.default.error('Cannot complete job: Please mark all steps and sub-tasks as completed first.');
        });
        // Re-render to reset the select dropdown visually since we blocked it
        loadData();
        return;
      }
      
      // Check if full payment has been made before closing the job
      if (!job.remaining_paid && (job.total_fee > 0 || job.remaining_amount > 0)) {
        import('react-hot-toast').then(toast => {
          toast.default.error('Payment Incomplete: Please verify full payment in the Financial Ledger before closing this job.');
        });
        loadData();
        return;
      }
    }

    const updatePayload: any = { status: status as any };
    if (status === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
      
      try {
        const { data: jobServices } = await supabase
          .from('job_services')
          .select('expiry_date')
          .eq('job_id', job.id);
          
        if (jobServices && jobServices.length > 0) {
          const dates = jobServices
            .map((js: any) => js.expiry_date)
            .filter(Boolean)
            .map((d: string) => new Date(d));
            
          if (dates.length > 0) {
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            updatePayload.service_expiry_date = maxDate.toISOString().split('T')[0];
          }
        }
      } catch (err) {
        console.error('Failed to sync master job expiry date:', err);
      }
    } else {
      updatePayload.completed_at = null;
    }

    const { error } = await supabase.from('jobs').update(updatePayload).eq('id', job.id);
    
    if (error) {
      import('react-hot-toast').then(toast => {
        toast.default.error(`Failed to update status: ${error.message}`);
      });
    } else {
      import('react-hot-toast').then(toast => {
        toast.default.success('Job status updated');
      });
      loadData(); // Ensure UI is synced
      if (onUpdated) onUpdated();
    }
  };

  if (!job) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Tabs */}
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 border-b border-border bg-card">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto hide-scrollbar whitespace-nowrap">
          <button 
            onClick={() => setActiveTab('operations')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === 'operations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Operations
          </button>
          {canViewFinancials && (
            <button 
              onClick={() => setActiveTab('ledger')}
              className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === 'ledger' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Financial Ledger
            </button>
          )}
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'timeline' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock size={14} /> Timeline
          </button>
          <button 
            onClick={() => setActiveTab('documents')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Documents
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'messages' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Chat Support</span>
            {unreadCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                activeTab === 'messages' 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
        {activeTab === 'timeline' ? (
          <div className="max-w-3xl mx-auto pb-12">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-syne font-bold text-foreground mb-1">Execution Timeline</h2>
                <p className="text-xs text-muted-foreground">Historical trail of status changes and delays.</p>
              </div>
            </div>
            <JobTimelinePanel jobId={job.id} />
          </div>
        ) : activeTab === 'operations' ? (
           <div className="max-w-4xl mx-auto pb-12 space-y-6">
              {/* Operations Bar */}
              <div className="bg-card border border-border p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div className="space-y-1.5">
                 <div className="flex items-center gap-3">
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Status</span>
                   {job.status === 'draft' && (
                     <div className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 border border-amber-500/20">
                       <AlertCircle size={10} /> Pending Payment
                     </div>
                   )}
                 </div>
                 
                 <div className="flex items-center gap-3">
                   <CustomSelect
                     value={job.status}
                     onChange={(v: string) => handleUpdateJobStatus(v)}
                     options={[
                       { value: 'draft', label: 'Draft (Pending)' },
                       { value: 'active', label: 'In Progress' },
                       { value: 'awaiting_govt', label: 'Awaiting Govt' },
                       { value: 'completed', label: 'Completed' },
                       { value: 'cancelled', label: 'Cancelled' }
                     ]}
                     className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary/50 transition-colors min-w-[185px] text-left"
                   />

                   {canViewFinancials && totalMinistryFee > 0 && (
                     <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5">
                       <Coins size={12} />
                       FEES: {totalMinistryFee.toFixed(3)} OMR
                     </div>
                   )}
                 </div>
               </div>

               {/* Invoice actions */}
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0 self-end sm:self-center">
                 {canViewFinancials && (
                   existingInvoice ? (
                     <>
                       <button 
                         onClick={() => navigate(`/employee/invoices/${existingInvoice.id}`)}
                         className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-3 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                       >
                         <FileText size={14} /> Update Invoice
                       </button>
                       
                       {existingInvoice.status !== 'paid' ? (
                         <button 
                           onClick={() => setIsPayModalOpen(true)}
                           className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-3 rounded-xl border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap animate-pulse"
                         >
                           <CheckCircle2 size={14} /> Mark Paid
                         </button>
                       ) : (
                         <div className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap">
                           <CheckCircle2 size={14} className="text-emerald-500" /> Invoice Paid
                         </div>
                       )}
                     </>
                   ) : (
                     <button 
                       onClick={() => {
                         const url = new URLSearchParams({
                           job_id: job.id,
                           client_id: job.client_id,
                           base_fee: job.work_fee?.toString() || '0',
                           min_fee: totalMinistryFee > 0 ? totalMinistryFee.toString() : (job.ministry_fee?.toString() || '0')
                         });
                         navigate(`/employee/invoices/new?${url.toString()}`);
                       }}
                       className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-3 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                     >
                       <FileText size={14} /> Generate Invoice
                     </button>
                   )
                 )}
               </div>
             </div>

             {/* Operations Content */}
             <OperationsPanel
               job={job}
               employees={employees}
               onDataRefresh={loadData}
             />
           </div>
        ) : activeTab === 'documents' ? (
           <div className="max-w-4xl mx-auto pb-12">
             <DocumentsTab jobId={job.id} documents={jobDocuments} isEmployee={true} isAdmin={false} />
           </div>
         ) : activeTab === 'messages' ? (
          <div className="max-w-3xl mx-auto h-[600px] pb-12">
            <MessagesTab jobId={job.id} messages={messages} isAdmin={false} currentUserType="employee" scope="staff_client" />
          </div>
        ) : (
          <JobLedger job={job} onPaymentReceived={loadData} />
        )}
      </div>

      {/* Add Custom Step Modal */}
      <AnimatePresence>
        {isCustomStepModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCustomStepModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Plus size={18} className="text-primary" /> Add Custom Step
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Insert an ad-hoc step to this specific workflow.</p>
                </div>
                <button onClick={() => setIsCustomStepModalOpen(false)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Step Name</label>
                  <input
                    type="text"
                    value={customStepName}
                    onChange={(e) => setCustomStepName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCustomStep();
                    }}
                    placeholder="e.g., Emergency Ministry Review"
                    autoFocus
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                  <button onClick={() => setIsCustomStepModalOpen(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
                  <button 
                    onClick={submitCustomStep}
                    disabled={!customStepName.trim() || isAddingStep}
                    className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAddingStep ? 'Adding...' : 'Add Step'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

          {/* Select Payment Mode Modal */}
          {isPayModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPayModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-blue-500" /> Select Payment Mode
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Specify how the payment was processed.</p>
                  </div>
                  <button onClick={() => setIsPayModalOpen(false)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Mode</label>
                    <select
                      value={selectedPayMode}
                      onChange={(e) => setSelectedPayMode(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Card / POS">Card / POS</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                    <button onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
                    <button 
                      onClick={handleMarkInvoicePaid}
                      className="px-6 py-2 bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2"
                    >
                      Confirm Payment
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
};
