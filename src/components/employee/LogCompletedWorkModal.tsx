import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAdminServices, type Service } from '../../hooks/admin/useAdminServices';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  X, CheckCircle2, Calendar, User, Phone, Building2, Upload, FileText,
  DollarSign, Sparkles, AlertCircle, Trash2, Loader2, Check, Clock,
  Layers, ChevronDown, Paperclip, Shield, Search
} from 'lucide-react';

interface LogCompletedWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LogCompletedWorkModal: React.FC<LogCompletedWorkModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const { data: services = [], isLoading: loadingServices } = useAdminServices();

  // Reference lists
  const [clients, setClients] = useState<any[]>([]);
  const [salesStaff, setSalesStaff] = useState<any[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Form Fields
  const [completionDate, setCompletionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Client selection
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // New Client fields
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientCompany, setNewClientCompany] = useState<string>('');
  const [newClientEmail, setNewClientEmail] = useState<string>('');

  // Service Selection
  const [serviceMode, setServiceMode] = useState<'catalog' | 'custom'>('catalog');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [customServiceName, setCustomServiceName] = useState<string>('');
  const [serviceSearch, setServiceSearch] = useState<string>('');

  // Sales Staff Attribution
  const [assignedSalesId, setAssignedSalesId] = useState<string>('');

  // Financials
  const [govFee, setGovFee] = useState<string>('0.000');
  const [paidByClient, setPaidByClient] = useState<boolean>(false);
  const [workFee, setWorkFee] = useState<string>('0.000');

  // Documents
  const [govReceiptFiles, setGovReceiptFiles] = useState<File[]>([]);
  const [deliverableFiles, setDeliverableFiles] = useState<File[]>([]);

  // Metadata
  const [govRef, setGovRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>('');

  // Load clients & sales staff on modal open
  useEffect(() => {
    if (!isOpen) return;

    const fetchLookups = async () => {
      setLoadingRefs(true);
      try {
        // Fetch clients
        const { data: cliData } = await supabase
          .from('profiles')
          .select('id, full_name, phone, company_name, email')
          .eq('role', 'client')
          .order('full_name', { ascending: true });

        if (cliData) setClients(cliData);

        // Fetch sales staff (profiles with department sales or role employee)
        const { data: staffData } = await supabase
          .from('profiles')
          .select('id, full_name, role, department')
          .eq('role', 'employee')
          .order('full_name', { ascending: true });

        if (staffData) setSalesStaff(staffData);
      } catch (err) {
        console.error('Failed to load lookups:', err);
      } finally {
        setLoadingRefs(false);
      }
    };

    fetchLookups();
  }, [isOpen]);

  // When a catalog service is picked, prefill fees if empty
  const handleServiceSelect = (svcId: string) => {
    setSelectedServiceId(svcId);
    const svc = services.find(s => s.id === svcId);
    if (svc) {
      if (svc.ministry_fee) setGovFee(Number(svc.ministry_fee).toFixed(3));
      if (svc.work_fee) setWorkFee(Number(svc.work_fee).toFixed(3));
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const term = clientSearch.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.company_name && c.company_name.toLowerCase().includes(term))
    );
  });

  // Filter services
  const filteredServices = services.filter(s => {
    if (!serviceSearch) return true;
    const term = serviceSearch.toLowerCase();
    return (
      (s.name_en && s.name_en.toLowerCase().includes(term)) ||
      (s.name_ar && s.name_ar.includes(term))
    );
  });

  // Handle Receipt Upload
  const handleGovReceiptsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setGovReceiptFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeGovReceipt = (index: number) => {
    setGovReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Deliverables Upload
  const handleDeliverablesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setDeliverableFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeDeliverable = (index: number) => {
    setDeliverableFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Reset form
  const resetForm = () => {
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setClientMode('existing');
    setSelectedClientId('');
    setClientSearch('');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientCompany('');
    setNewClientEmail('');
    setServiceMode('catalog');
    setSelectedServiceId('');
    setCustomServiceName('');
    setServiceSearch('');
    setAssignedSalesId('');
    setGovFee('0.000');
    setPaidByClient(false);
    setWorkFee('0.000');
    setGovReceiptFiles([]);
    setDeliverableFiles([]);
    setGovRef('');
    setNotes('');
    setIsSubmitting(false);
    setSubmitStep('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (clientMode === 'existing' && !selectedClientId) {
      toast.error(isRtl ? 'يرجى اختيار العميل المسجل' : 'Please select an existing client');
      return;
    }
    if (clientMode === 'new' && (!newClientName.trim() || !newClientPhone.trim())) {
      toast.error(isRtl ? 'يرجى إدخال اسم ورقم هاتف العميل' : 'Please provide client name and phone');
      return;
    }
    if (serviceMode === 'catalog' && !selectedServiceId) {
      toast.error(isRtl ? 'يرجى اختيار الخدمة من الدليل' : 'Please select a catalog service');
      return;
    }
    if (serviceMode === 'custom' && !customServiceName.trim()) {
      toast.error(isRtl ? 'يرجى كتابة اسم الخدمة المخصصة' : 'Please enter custom service name');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Resolve Client
      setSubmitStep(isRtl ? 'جاري تجهيز بيانات العميل...' : 'Resolving client...');
      let finalClientId = selectedClientId;
      let finalClientName = '';

      if (clientMode === 'new') {
        const dummyEmail = newClientEmail.trim() || `client_${Date.now()}_${Math.floor(Math.random() * 1000)}@osbic.placeholder`;
        const { data: createdClient, error: clientErr } = await supabase
          .from('profiles')
          .insert({
            full_name: newClientName.trim(),
            phone: newClientPhone.trim(),
            company_name: newClientCompany.trim() || null,
            email: dummyEmail,
            role: 'client',
            branch_id: profile?.branch_id || null,
            is_active: true
          } as any)
          .select()
          .single();

        if (clientErr) throw new Error(clientErr.message || 'Failed to create new client record');
        finalClientId = createdClient.id;
        finalClientName = createdClient.full_name;
      } else {
        const existingCli = clients.find(c => c.id === selectedClientId);
        finalClientName = existingCli?.full_name || 'Client';
      }

      // 2. Resolve Service Name and Reference ID
      const chosenCatalogSvc = serviceMode === 'catalog' 
        ? services.find(s => s.id === selectedServiceId)
        : null;
      
      const resolvedServiceName = serviceMode === 'catalog'
        ? (chosenCatalogSvc ? chosenCatalogSvc.name_en : 'Standard Service')
        : customServiceName.trim();

      const fallbackServiceId = chosenCatalogSvc?.id || services?.[0]?.id;
      if (!fallbackServiceId) {
        throw new Error('No catalog services available in system to anchor job to.');
      }

      const numGovFee = Math.max(0, parseFloat(govFee) || 0);
      const numWorkFee = Math.max(0, parseFloat(workFee) || 0);
      const totalFee = numGovFee + numWorkFee;
      const completedIsoDate = new Date(completionDate).toISOString();

      // 3. Create Completed Master Job
      setSubmitStep(isRtl ? 'إنشاء ملف المعاملة المكتملة...' : 'Creating completed job record...');
      const jobCode = `LEG-${Math.floor(Math.random() * 899999 + 100000)}`;

      const jobPayload: any = {
        job_code: jobCode,
        client_id: finalClientId,
        employee_id: profile?.id,
        assigned_by: assignedSalesId || profile?.id,
        sales_employee_id: assignedSalesId || profile?.id,
        ops_employee_id: profile?.id,
        service_id: fallbackServiceId,
        status: 'completed',
        custom_name: resolvedServiceName,
        total_fee: totalFee,
        work_fee: numWorkFee,
        ministry_fee: numGovFee,
        client_pays_ministry_fee: paidByClient,
        advance_percentage: 100,
        advance_amount: totalFee,
        remaining_amount: 0,
        advance_paid: true,
        remaining_paid: true,
        entry_type: 'direct',
        branch_id: profile?.branch_id,
        created_at: completedIsoDate,
        notes: notes ? `[Historical Completed Work] ${notes}` : '[Historical Completed Work]'
      };

      const { data: job, error: jobErr } = await (supabase.from('jobs').insert(jobPayload as any).select().single() as any);
      if (jobErr) throw jobErr;

      // 4. Create Completed Job Service Line
      setSubmitStep(isRtl ? 'تسجيل بنود الخدمة المكتملة...' : 'Recording service item...');
      const servicePayload: any = {
        job_id: job.id,
        service_id: fallbackServiceId,
        service_name: resolvedServiceName,
        display_order: 1,
        quantity: 1,
        item_number: 1,
        applicant_name: finalClientName,
        status: 'completed',
        work_fee: numWorkFee,
        ministry_fee: numGovFee,
        total_fee: totalFee,
        ops_employee_id: profile?.id,
        assigned_by: assignedSalesId || profile?.id,
        assigned_at: completedIsoDate,
        started_at: completedIsoDate,
        completed_at: completedIsoDate,
        acceptance_status: 'accepted',
        assignment_model: 'direct',
        government_ref: govRef ? govRef.trim() : null,
        notes: notes ? `[Legacy Done] ${notes}` : null
      };

      const { data: jobService, error: svcErr } = await (supabase.from('job_services').insert(servicePayload as any).select().single() as any);
      if (svcErr) throw svcErr;

      // 5. Upload Government Fee Receipts (Multi-Upload)
      let firstReceiptPath: string | null = null;
      if (govReceiptFiles.length > 0) {
        setSubmitStep(isRtl ? `رفع إيصالات الرسوم الحكومية (${govReceiptFiles.length})...` : `Uploading gov receipts (${govReceiptFiles.length})...`);
        for (let idx = 0; idx < govReceiptFiles.length; idx++) {
          const file = govReceiptFiles[idx];
          const ext = file.name.split('.').pop() || 'png';
          const filePath = `${job.id}/gov_receipt_${Date.now()}_${idx}.${ext}`;

          const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
          if (!uploadErr) {
            if (!firstReceiptPath) firstReceiptPath = filePath;

            await supabase.from('documents').insert({
              job_id: job.id,
              uploaded_by: profile?.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              document_type: 'payment_receipt',
              status: 'approved',
              is_client_visible: false
            } as any);
          }
        }
      }

      // 6. Record Government Expense if fee was spent and not paid directly by client
      if (numGovFee > 0 && !paidByClient) {
        setSubmitStep(isRtl ? 'تسجيل المصروفات الحكومية...' : 'Recording ministry fee expense...');
        await supabase.from('job_expenses').insert({
          job_id: job.id,
          job_service_id: jobService.id,
          amount: numGovFee,
          expense_type: 'ministry_fee',
          receipt_url: firstReceiptPath || null,
          notes: `Historical Ministry Fee for ${resolvedServiceName}${govRef ? ` [Ref: ${govRef}]` : ''}`,
          status: 'approved',
          created_by: profile?.id
        } as any);
      }

      // 7. Upload Deliverables / Final Output Documents (Multi-Upload)
      if (deliverableFiles.length > 0) {
        setSubmitStep(isRtl ? `رفع المخرجات والمستندات النهائية (${deliverableFiles.length})...` : `Uploading deliverables (${deliverableFiles.length})...`);
        for (let idx = 0; idx < deliverableFiles.length; idx++) {
          const file = deliverableFiles[idx];
          const ext = file.name.split('.').pop() || 'pdf';
          const filePath = `${job.id}/deliverable_${Date.now()}_${idx}.${ext}`;

          const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
          if (!uploadErr) {
            const docName = file.name.replace(/\.[^/.]+$/, "");

            // Insert into job_service_documents for deliverables dossier
            await supabase.from('job_service_documents').insert({
              job_id: job.id,
              job_service_id: jobService.id,
              document_name: docName,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: profile?.id,
              upload_source: 'ops',
              document_category: 'output',
              status: 'approved',
              is_client_visible: true
            } as any);

            // Also insert into master documents table for client portal access
            await supabase.from('documents').insert({
              job_id: job.id,
              uploaded_by: profile?.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              document_type: 'deliverable',
              status: 'approved',
              is_client_visible: true
            } as any);
          }
        }
      }

      // 8. Log Timeline Event
      try {
        await supabase.from('job_service_timeline').insert({
          job_service_id: jobService.id,
          job_id: job.id,
          from_status: 'in_progress',
          to_status: 'completed',
          changed_by: profile?.id || null,
          changed_by_name: profile?.full_name || 'Ops Specialist',
          changed_by_role: 'ops',
          changed_at: completedIsoDate,
          reason: 'Recorded historical completed work completed prior to ERP system rollout',
          government_ref: govRef || null,
          service_name: resolvedServiceName
        } as any);
      } catch (timelineErr) {
        console.warn('Timeline recording notice:', timelineErr);
      }

      toast.success(isRtl ? 'تم حفظ وتوثيق العمل المكتمل بنجاح!' : 'Historical completed work logged successfully!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error logging completed work:', err);
      toast.error(err.message || 'Failed to save completed work');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-3xl bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4.5 border-b border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-syne text-lg font-bold text-foreground">
                    {isRtl ? 'تسجيل عمل سابق / مكتمل' : 'Log Completed Past Work'}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {isRtl ? 'أرشيف الإنجاز' : 'Historical Archive'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRtl
                    ? 'توثيق المعاملات والخدمات المنجزة سابقاً وربط المستندات وإيصالات الرسوم الحكومية'
                    : 'Record jobs executed prior to system rollout with receipts & deliverables'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {/* Row 1: Completion Date & Sales Person Attribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-primary" />
                  <span>{isRtl ? 'تاريخ إنجاز العمل *' : 'Completion Date *'}</span>
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  required
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User size={13} className="text-primary" />
                  <span>{isRtl ? 'موظف المبيعات المسؤول (صاحب المعاملة)' : 'Assigned Sales Person'}</span>
                </label>
                <select
                  value={assignedSalesId}
                  onChange={(e) => setAssignedSalesId(e.target.value)}
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                >
                  <option value="">{isRtl ? '-- معاملة مباشرة / بدون وسيط مبيعات --' : '-- Direct Walk-in / Self --'}</option>
                  {salesStaff.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.department ? `(${emp.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 2: Client Details */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Building2 size={15} className="text-primary" />
                  {isRtl ? 'بيانات العميل' : 'Client Information'}
                </span>

                {/* Toggle Mode */}
                <div className="flex bg-muted/40 p-1 rounded-xl text-[11px] font-bold border border-border/30">
                  <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      clientMode === 'existing'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? 'عميل مسجل' : 'Registered Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('new')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      clientMode === 'new'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? '+ عميل جديد / سابق' : '+ New / Past Client'}
                  </button>
                </div>
              </div>

              {clientMode === 'existing' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={isRtl ? 'ابحث بالاسم، رقم الهاتف أو الشركة...' : 'Search by name, phone or company...'}
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                  >
                    <option value="">{isRtl ? '-- اختر العميل المسجل --' : '-- Select Registered Client --'}</option>
                    {filteredClients.map((cli) => (
                      <option key={cli.id} value={cli.id}>
                        {cli.full_name} {cli.phone ? `(${cli.phone})` : ''} {cli.company_name ? `— ${cli.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'اسم العميل الكامل *' : 'Client Full Name *'}</label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="e.g. Salim Al-Harthy"
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                    <input
                      type="text"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="+968 9XXXXXXX"
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'اسم الشركة / السجل التجاري' : 'Company Name (Optional)'}</label>
                    <input
                      type="text"
                      value={newClientCompany}
                      onChange={(e) => setNewClientCompany(e.target.value)}
                      placeholder="e.g. Al-Bustan LLC"
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}</label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Service Information */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Layers size={15} className="text-primary" />
                  {isRtl ? 'الخدمة المنجزة' : 'Service Completed'}
                </span>

                {/* Toggle Mode */}
                <div className="flex bg-muted/40 p-1 rounded-xl text-[11px] font-bold border border-border/30">
                  <button
                    type="button"
                    onClick={() => setServiceMode('catalog')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      serviceMode === 'catalog'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? 'من دليل الخدمات' : 'From Catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceMode('custom')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      serviceMode === 'custom'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isRtl ? 'خدمة مخصصة' : 'Custom Service'}
                  </button>
                </div>
              </div>

              {serviceMode === 'catalog' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={isRtl ? 'ابحث في دليل الخدمات...' : 'Search services...'}
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleServiceSelect(e.target.value)}
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                  >
                    <option value="">{isRtl ? '-- اختر الخدمة من الدليل --' : '-- Select Catalog Service --'}</option>
                    {filteredServices.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name_en} {svc.name_ar ? `(${svc.name_ar})` : ''} — Est. Min: {Number(svc.ministry_fee || 0).toFixed(3)} OMR
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'اسم الخدمة المخصصة *' : 'Custom Service Name *'}</label>
                  <input
                    type="text"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="e.g. Commercial Activity License Renewal & Inspection Clearance"
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none"
                  />
                </div>
              )}
            </div>

            {/* Section 4: Government Fee & Multi-Receipt Upload */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <DollarSign size={15} className="text-emerald-400" />
                  {isRtl ? 'الرسوم الحكومية وإيصالات الدفع' : 'Government Fees & Proofs'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {isRtl ? 'خيارات متعددة للإيصالات' : 'Multiple uploads supported'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    {isRtl ? 'الرسوم الحكومية المصروفة (ريال عماني)' : 'Actual Government Fee Spent (OMR)'}
                  </label>
                  <input
                    type="text"
                    value={govFee}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setGovFee(e.target.value);
                    }}
                    placeholder="0.000"
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    {isRtl ? 'أتعاب الخدمة / المكتب (اختياري)' : 'Work / Agency Fee (OMR)'}
                  </label>
                  <input
                    type="text"
                    value={workFee}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setWorkFee(e.target.value);
                    }}
                    placeholder="0.000"
                    className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono outline-none"
                  />
                </div>
              </div>

              {/* Direct payment checkbox */}
              <div className="flex items-center gap-2.5 py-2 px-3 bg-muted/20 rounded-xl border border-border/30">
                <input
                  type="checkbox"
                  id="direct_paid_client"
                  checked={paidByClient}
                  onChange={(e) => setPaidByClient(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary bg-muted/30 border-border cursor-pointer"
                />
                <label htmlFor="direct_paid_client" className="text-xs font-medium text-foreground cursor-pointer select-none">
                  {isRtl
                    ? 'تم دفع الرسوم ببطاقة العميل مباشرة (لا تحتسب كمصروف من رصيد الشركة)'
                    : 'Paid by Client Card (Direct Pay — not deducted from company balance)'}
                </label>
              </div>

              {/* Multi-upload for Gov Receipts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Paperclip size={13} className="text-emerald-400" />
                    {isRtl ? 'إيصالات السداد الحكومي (تحميل متعدد)' : 'Government Payment Receipts (Multi-upload)'}
                  </span>
                  {govReceiptFiles.length > 0 && (
                    <span className="text-emerald-400 text-[10px]">
                      {govReceiptFiles.length} {isRtl ? 'إيصال محدد' : 'file(s) selected'}
                    </span>
                  )}
                </div>

                <div className="relative border border-dashed border-border/70 hover:border-emerald-500/50 rounded-2xl p-4 text-center transition-all bg-card/40 cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleGovReceiptsChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Upload size={18} className="text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                    <p className="text-xs font-bold text-foreground">
                      {isRtl ? 'انقر أو اسحب لإضافة إيصالات الرسوم' : 'Click or drag ministry receipt files'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PNG, JPG, PDF (Supports multiple receipts at once)
                    </p>
                  </div>
                </div>

                {/* Receipts list */}
                {govReceiptFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {govReceiptFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono"
                      >
                        <FileText size={12} />
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <span className="text-[9px] text-emerald-400/70 font-sans">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeGovReceipt(idx)}
                          className="hover:text-red-400 transition-colors p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Deliverables / Final Output Documents (Multi-Upload) */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={15} className="text-primary" />
                  {isRtl ? 'المخرجات والمستندات النهائية (مستندات الإنجاز)' : 'Deliverables & Output Documents'}
                </span>
                {deliverableFiles.length > 0 && (
                  <span className="text-primary text-[10px] font-bold">
                    {deliverableFiles.length} {isRtl ? 'مستند محدد' : 'file(s) selected'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isRtl
                  ? 'قم برفع شهادة السجل التجاري، الترخيص البلدي، التأشيرات أو التراخيص المعتمدة (ستكون متاحة في بوابة العميل)'
                  : 'Upload completed licenses, CR copies, approved permits or visas (will appear in client portal)'}
              </p>

              <div className="relative border border-dashed border-border/70 hover:border-primary/50 rounded-2xl p-4 text-center transition-all bg-card/40 cursor-pointer group">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleDeliverablesChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-xs font-bold text-foreground">
                    {isRtl ? 'انقر أو اسحب لإرفاق مستندات المخرجات النهائية' : 'Click or drag output deliverables'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    PDF, JPG, PNG, DOCX (Multiple files can be attached)
                  </p>
                </div>
              </div>

              {/* Deliverables list */}
              {deliverableFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {deliverableFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-mono"
                    >
                      <FileText size={12} />
                      <span className="max-w-[160px] truncate">{file.name}</span>
                      <span className="text-[9px] text-muted-foreground font-sans">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDeliverable(idx)}
                        className="hover:text-red-400 transition-colors p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Government Reference & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {isRtl ? 'رقم القيد / المرجع الحكومي' : 'Government Reference / App No.'}
                </label>
                <input
                  type="text"
                  value={govRef}
                  onChange={(e) => setGovRef(e.target.value)}
                  placeholder="e.g. MOCIIP/2024/78219"
                  className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {isRtl ? 'حالة المعاملة' : 'Status'}
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold">
                  <CheckCircle2 size={15} />
                  <span>{isRtl ? 'مكتمل (أرشيف تاريخي)' : 'Completed (Historical Archive)'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                {isRtl ? 'ملاحظات وتفاصيل إضافية' : 'Internal Notes / Remarks'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={isRtl ? 'أي ملاحظات خاصة تم إنجازها أو تسليمها للعميل...' : 'Any details about previous execution, delivery method, etc...'}
                className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground outline-none resize-none"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
            <div className="text-xs text-muted-foreground">
              {submitStep && (
                <span className="flex items-center gap-2 text-primary animate-pulse font-medium">
                  <Loader2 size={13} className="animate-spin" />
                  {submitStep}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-muted hover:bg-muted/70 text-muted-foreground font-bold text-xs transition-all"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{isRtl ? 'حفظ وتوثيق العمل المكتمل' : 'Save Completed Work'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
