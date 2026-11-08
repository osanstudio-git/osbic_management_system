import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, CheckCircle2, Clock, AlertCircle, FileText, Download,
  ExternalLink, User, Phone, Mail, Globe, Building2, Shield,
  ArrowRight, History, Layers, Sparkles, UserCheck, Trash2, Loader2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface BriefingProps {
  jobId: string;
  currentServiceId?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const TaskAssignmentBriefing: React.FC<BriefingProps> = ({
  jobId,
  currentServiceId,
  isOpen,
  onClose,
  onUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [handoffNotes, setHandoffNotes] = useState<any[]>([]);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'timeline' | 'docs'>('overview');

  // Date editing state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);

  const handleOpenDateEdit = () => {
    const currentSvc = services.find(s => s.id === currentServiceId) || services[0];
    const raw = currentSvc?.completed_at || jobData?.completed_at || jobData?.created_at;
    const initial = raw ? raw.split('T')[0] : new Date().toISOString().split('T')[0];
    setCustomDate(initial);
    setIsEditingDate(true);
  };

  const handleSaveDate = async () => {
    if (!customDate) {
      toast.error('Please pick a valid date');
      return;
    }
    setIsSavingDate(true);
    try {
      const newTimestamp = new Date(`${customDate}T12:00:00Z`).toISOString();
      const currentSvc = services.find(s => s.id === currentServiceId) || services[0];

      // 1. Update job_services
      if (currentSvc?.id) {
        await supabase
          .from('job_services')
          .update({
            completed_at: newTimestamp,
            gov_paid_at: currentSvc.gov_payment_status === 'paid' ? newTimestamp : currentSvc.gov_paid_at
          })
          .eq('id', currentSvc.id);
      } else {
        await supabase
          .from('job_services')
          .update({ completed_at: newTimestamp })
          .eq('job_id', jobId);
      }

      // 2. Update jobs table (both completed_at and created_at if completed)
      const jobUpdate: any = {
        completed_at: newTimestamp
      };
      if (jobData?.status === 'completed' || currentSvc?.status === 'completed') {
        jobUpdate.created_at = newTimestamp;
      }
      await supabase
        .from('jobs')
        .update(jobUpdate)
        .eq('id', jobId);

      // 3. Update any job_expenses linked to this job
      await supabase
        .from('job_expenses')
        .update({ created_at: newTimestamp })
        .eq('job_id', jobId);

      toast.success('Date updated successfully');
      setIsEditingDate(false);

      // 4. Update local state
      setJobData((prev: any) => ({
        ...prev,
        completed_at: newTimestamp,
        created_at: jobUpdate.created_at || prev?.created_at
      }));
      setServices((prev: any[]) => prev.map(s => {
        if (!currentSvc?.id || s.id === currentSvc.id) {
          return { ...s, completed_at: newTimestamp };
        }
        return s;
      }));
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error('Failed to update date:', err);
      toast.error(err.message || 'Failed to update date');
    } finally {
      setIsSavingDate(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !jobId) return;

    let isMounted = true;
    setLoading(true);

    const fetchCaseData = async () => {
      try {
        // 1. Fetch Job + Client + Package + Sales Employee + Assigner
        const { data: job, error: jobErr } = await supabase
          .from('jobs')
          .select(`
            *,
            client:profiles!client_id(*),
            sales_employee:profiles!sales_employee_id(full_name, email, phone),
            assigner:profiles!assigned_by(full_name, email, phone)
          `)
          .eq('id', jobId)
          .single();

        if (jobErr) throw jobErr;

        // 2. Fetch all services for this job
        const { data: jobServices, error: servErr } = await supabase
          .from('job_services')
          .select(`
            *,
            ops_employee:profiles!job_services_ops_employee_id_fkey(full_name),
            pro_agent:profiles!job_services_pro_id_fkey(full_name),
            assigner:profiles!job_services_assigned_by_fkey(full_name),
            steps:job_service_steps(*)
          `)
          .eq('job_id', jobId)
          .order('display_order', { ascending: true });

        if (servErr) throw servErr;

        // 3. Fetch all documents for this job
        const { data: docs, error: docErr } = await supabase
          .from('job_service_documents')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false });

        if (docErr) throw docErr;

        // 4. Fetch job timeline history
        const { data: timelineData, error: timeErr } = await (supabase
          .from('job_service_timeline')
          .select(`
            *,
            changer:profiles!job_service_timeline_changed_by_fkey(full_name, role)
          `)
          .eq('job_id', jobId)
          .order('changed_at', { ascending: false }) as any);

        if (timeErr) throw timeErr;

        // 5. Fetch team handoff notes
        let handoffData: any[] = [];
        try {
          const { data: hData } = await supabase
            .from('job_handoff_notes')
            .select(`
              *,
              from_employee:profiles!job_handoff_notes_from_employee_id_fkey(full_name)
            `)
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
          if (hData) handoffData = hData;
        } catch (hErr) {
          console.warn('Could not fetch handoff notes:', hErr);
        }

        if (isMounted) {
          setJobData(job);
          setServices(jobServices || []);
          setAllDocs(docs || []);
          setTimeline(timelineData || []);
          setHandoffNotes(handoffData);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching briefing dossier:', err);
        toast.error('Failed to load job dossier');
        if (isMounted) setLoading(false);
      }
    };

    fetchCaseData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const currentService = services.find(s => s.id === currentServiceId);
  const client = jobData?.client;

  const handleDownloadDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name || doc.document_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

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

  const handleDeleteDoc = async (doc: any) => {
    const docTitle = doc.document_name || doc.file_name || 'document';
    if (!window.confirm(`Are you sure you want to delete "${docTitle}"?`)) {
      return;
    }

    setDeletingDocId(doc.id);
    try {
      // 1. Remove file from storage
      if (doc.file_path) {
        try {
          await supabase.storage.from('documents').remove([doc.file_path]);
        } catch (storageErr) {
          console.warn('Storage removal warning:', storageErr);
        }
      }

      // 2. Determine if document record should be deleted or reset
      const isCustomOrOutput =
        doc.document_category === 'output' ||
        doc.document_category === 'gov_receipt' ||
        doc.notes === 'gov_receipt' ||
        !doc.is_required;

      if (isCustomOrOutput) {
        const { error: delErr } = await supabase
          .from('job_service_documents')
          .delete()
          .eq('id', doc.id);
        if (delErr) throw delErr;

        setAllDocs(prev => prev.filter(d => d.id !== doc.id));
      } else {
        const { error: updErr } = await supabase
          .from('job_service_documents')
          .update({
            file_name: null,
            file_path: null,
            file_size: null,
            file_type: null,
            uploaded_by: null,
            status: 'pending'
          } as any)
          .eq('id', doc.id);
        if (updErr) throw updErr;

        setAllDocs(prev =>
          prev.map(d => (d.id === doc.id ? { ...d, file_path: null, file_name: null, status: 'pending' } : d))
        );
      }

      // 3. If this doc was linked as a government receipt on the job_service, clear it
      if (doc.job_service_id && doc.file_path) {
        await supabase
          .from('job_services')
          .update({
            gov_receipt_url: null,
            gov_payment_status: 'unpaid'
          })
          .eq('id', doc.job_service_id)
          .eq('gov_receipt_url', doc.file_path);
      }

      toast.success('Document deleted successfully');
      onUpdated?.();
    } catch (err: any) {
      console.error('Delete document failed:', err);
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  Job Summary & Overview
                </span>
                {jobData?.job_code && (
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    #{jobData.job_code}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                {currentService ? currentService.service_name : (jobData?.package?.name_en || jobData?.custom_name || 'Job Overview')}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted/80 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-border bg-muted/10 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <User size={14} /> Client & Job Brief
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'workflow'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Layers size={14} /> Package Workflow ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'timeline'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <History size={14} /> Handoff & Activity Log ({timeline.length})
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <FileText size={14} /> Case Documents ({allDocs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Assembling client dossier & handoff notes...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Current Service Spotlight */}
                  {currentService && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            Your Assigned Service
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${currentService.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                            {currentService.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground mt-1">
                          {currentService.service_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Applicant: <span className="font-semibold text-foreground">{currentService.applicant_name || client?.full_name || 'Not set'}</span>
                          {currentService.item_number && currentService.quantity > 1 && (
                            <span className="ml-2 font-mono text-[10px]">({currentService.item_number} of {currentService.quantity})</span>
                          )}
                        </p>
                      </div>
                      <div className="text-left sm:text-right flex flex-col sm:items-end gap-1.5">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {currentService.status === 'completed' ? 'Completed Date' : 'Deadline'}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {currentService.status === 'completed'
                              ? (currentService.completed_at ? format(new Date(currentService.completed_at), 'MMM d, yyyy') : 'Completed')
                              : (currentService.deadline ? format(new Date(currentService.deadline), 'MMM d, yyyy') : 'No deadline set')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenDateEdit}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Change completion or recorded date"
                        >
                          <Calendar size={11} />
                          <span>Edit Date ✏️</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Date Editor Modal/Block */}
                  {isEditingDate && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-card border border-amber-500/40 rounded-2xl shadow-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Calendar size={14} className="text-amber-400" />
                          <span>Edit Completion / Logged Date (تعديل تاريخ الإنجاز)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingDate(false)}
                          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/30"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          className="flex-1 bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none transition-all"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveDate}
                            disabled={isSavingDate || !customDate}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {isSavingDate ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            <span>Save Date</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingDate(false)}
                            className="px-3 py-2 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Fixes misdated entries. Automatically synchronizes the service completion date, job record, and expense timestamp so reports reflect the true date.
                      </p>
                    </motion.div>
                  )}

                  {/* Client Dossier Card */}
                  <div className="bg-muted/15 border border-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-primary font-bold">
                          {client?.full_name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                            {client?.full_name || 'Client Name Unavailable'}
                            {client?.is_trusted && (
                              <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                Trusted Client
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-muted-foreground">
                            Client ID: <span className="font-mono">{client?.client_code || client?.id?.substring(0, 8)}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Phone size={11} /> Phone / WhatsApp
                        </span>
                        <p className="text-xs font-semibold text-foreground">
                          {client?.phone || 'Not provided'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Mail size={11} /> Email Address
                        </span>
                        <p className="text-xs font-semibold text-foreground truncate">
                          {client?.email || 'Not provided'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Globe size={11} /> Nationality
                        </span>
                        <p className="text-xs font-semibold text-foreground">
                          {client?.nationality || 'Not specified'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Building2 size={11} /> Company / CR
                        </span>
                        <p className="text-xs font-semibold text-foreground">
                          {client?.company_name || client?.cr_number || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <User size={11} /> Sales Handler
                        </span>
                        <p className="text-xs font-semibold text-foreground">
                          {jobData?.sales_employee?.full_name || 'Unassigned'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <UserCheck size={11} className="text-amber-400" /> Assigned By
                        </span>
                        <p className="text-xs font-semibold text-amber-300">
                          {currentService?.assigner?.full_name || jobData?.assigner?.full_name || jobData?.sales_employee?.full_name || 'Direct / System'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock size={11} /> {jobData?.completed_at ? 'Completed Date' : 'Job Date'}
                          </span>
                          {!isEditingDate && (
                            <button
                              type="button"
                              onClick={handleOpenDateEdit}
                              className="text-[9px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            >
                              Edit ✏️
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {jobData?.completed_at
                            ? format(new Date(jobData.completed_at), 'MMM d, yyyy')
                            : jobData?.created_at
                            ? format(new Date(jobData.created_at), 'MMM d, yyyy')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {jobData?.notes && (
                      <div className="mt-3 p-3 bg-muted/20 border border-border/50 rounded-xl space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block">
                          Sales & Intake Notes
                        </span>
                        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                          {jobData.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary of what is done vs pending in this job */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Layers size={14} /> Workflow Snapshot
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Completed Services
                        </span>
                        <p className="text-xl font-bold text-foreground mt-0.5">
                          {services.filter(s => s.status === 'completed').length} / {services.length}
                        </p>
                      </div>
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block">
                          In Progress / Active
                        </span>
                        <p className="text-xl font-bold text-foreground mt-0.5">
                          {services.filter(s => ['in_progress', 'applied', 'assigned_to_pro'].includes(s.status)).length}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 block">
                          Documents In Vault
                        </span>
                        <p className="text-xl font-bold text-foreground mt-0.5">
                          {allDocs.filter(d => !!d.file_path).length} files
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WORKFLOW CHAIN */}
              {activeTab === 'workflow' && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    This job is divided into sequential operations. Here is the status of each service and who handled it:
                  </p>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                    {services.map((svc, idx) => {
                      const isCurrent = svc.id === currentServiceId;
                      const isComplete = svc.status === 'completed';
                      const isPending = svc.status === 'pending';

                      return (
                        <div key={svc.id} className="relative">
                          {/* Dot marker */}
                          <div className={`absolute -left-[27px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${isComplete
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : isCurrent
                                ? 'bg-primary border-primary text-primary-foreground animate-pulse'
                                : 'bg-card border-border text-muted-foreground'
                            }`}>
                            {isComplete ? '✓' : idx + 1}
                          </div>

                          <div className={`p-4 rounded-xl border transition-all ${isCurrent
                              ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                              : 'bg-card border-border/80'
                            }`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-foreground">
                                    {svc.service_name}
                                  </h4>
                                  {isCurrent && (
                                    <span className="text-[8px] font-extrabold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                      Your Task
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Applicant: <span className="font-semibold text-foreground">{svc.applicant_name || client?.full_name || 'N/A'}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isComplete
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : isPending
                                      ? 'bg-muted/40 text-muted-foreground border border-border'
                                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                  {svc.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
                              <span className="flex items-center gap-1.5">
                                <User size={12} className="text-primary" />
                                Handler: <span className="font-semibold text-foreground">{svc.ops_employee?.full_name || 'Unassigned'}</span>
                              </span>
                              {(svc.assigner?.full_name || jobData?.sales_employee?.full_name || jobData?.assigner?.full_name) && (
                                <span className="flex items-center gap-1.5 text-amber-400">
                                  <UserCheck size={12} />
                                  Assigned by: <span className="font-semibold text-amber-300">{svc.assigner?.full_name || jobData?.sales_employee?.full_name || jobData?.assigner?.full_name}</span>
                                </span>
                              )}
                              {svc.pro_agent && (
                                <span className="flex items-center gap-1.5 text-sky-400">
                                  <Shield size={12} />
                                  PRO: <span className="font-semibold">{svc.pro_agent.full_name}</span>
                                </span>
                              )}
                              {svc.completed_at && (
                                <span className="text-emerald-400">
                                  Done: {format(new Date(svc.completed_at), 'MMM d, h:mm a')}
                                </span>
                              )}
                            </div>

                            {/* Steps under this service */}
                            {svc.steps && svc.steps.length > 0 && (
                              <div className="mt-3 pt-2 space-y-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">
                                  Checklist ({svc.steps.filter((st: any) => st.status === 'completed').length}/{svc.steps.length} done):
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {svc.steps.map((st: any) => (
                                    <div key={st.id} className="text-[10px] flex items-center gap-1.5 bg-muted/20 px-2.5 py-1 rounded-lg">
                                      <span className={st.status === 'completed' ? 'text-emerald-400' : 'text-muted-foreground'}>
                                        {st.status === 'completed' ? '✓' : '○'}
                                      </span>
                                      <span className={`truncate ${st.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {st.step_name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: TIMELINE & HANDOFF LOG */}
              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Dedicated Handoff Notes from colleagues */}
                  {handoffNotes.length > 0 && (
                    <div className="space-y-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Sparkles size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          Specialist Handoff Notes ({handoffNotes.length})
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Specific instructions and details left by teammates who finished previous steps in this case:
                      </p>
                      <div className="space-y-2 mt-2">
                        {handoffNotes.map((hn: any) => (
                          <div key={hn.id} className="p-3 rounded-xl bg-card border border-border/80 shadow-sm space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-foreground">
                                {hn.from_employee?.full_name || 'Team Specialist'}
                                {hn.stage_name && (
                                  <span className="ml-2 font-normal text-muted-foreground">
                                    on <strong className="text-foreground">{hn.stage_name}</strong>
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {hn.created_at ? format(new Date(hn.created_at), 'MMM d, h:mm a') : ''}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed italic">
                              "{hn.note_text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Chronological audit log of handoffs, status transitions, and notes made across all steps of this job:
                    </p>

                    {timeline.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-xs italic">
                        No activity recorded yet for this job.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {timeline.map((entry) => (
                          <div key={entry.id} className="p-3 bg-muted/15 border border-border/70 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                {entry.changed_by_name || entry.changer?.full_name || 'System'}
                                <span className="text-[9px] font-normal text-muted-foreground uppercase px-1.5 py-0.2 rounded bg-muted/40">
                                  {entry.changed_by_role || entry.changer?.role || 'team'}
                                </span>
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {entry.changed_at ? format(new Date(entry.changed_at), 'MMM d, h:mm a') : ''}
                              </span>
                            </div>

                            <div className="text-xs text-foreground/80 pl-3.5">
                              {entry.reason || `Status updated to ${entry.to_status?.replace('_', ' ')}`}
                            </div>

                            {entry.notes && (
                              <div className="ml-3.5 mt-1 p-2 bg-muted/30 border border-border/40 rounded-lg text-[11px] text-muted-foreground italic">
                                "{entry.notes}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CASE DOCUMENTS */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      All documents uploaded across any stage of this job (KYC, Passports, Approvals):
                    </p>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {allDocs.filter(d => !!d.file_path).length} Available
                    </span>
                  </div>

                  {allDocs.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs italic">
                      No documents requested or uploaded yet for this case.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {allDocs.map((doc) => {
                        const hasFile = !!doc.file_path;
                        return (
                          <div key={doc.id} className="p-3 bg-muted/15 border border-border rounded-xl flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {doc.document_name}
                              </p>
                              {hasFile ? (
                                <p className="text-[10px] text-emerald-400 font-medium truncate mt-0.5">
                                  ✓ {doc.file_name || 'File uploaded'}
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">
                                  Pending upload
                                </p>
                              )}
                            </div>

                            {hasFile && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleViewDoc(doc)}
                                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                  title="View document"
                                >
                                  <ExternalLink size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                  title="Download document"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(doc)}
                                  disabled={deletingDocId === doc.id}
                                  className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                  title="Delete document"
                                >
                                  {deletingDocId === doc.id ? (
                                    <Loader2 size={13} className="animate-spin text-rose-400" />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Complete job overview ensures clear context and smooth handoffs between team members.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Summary
          </button>
        </div>
      </motion.div>
    </div>
  );
};
