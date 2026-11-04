import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  X, CheckCircle2, Calendar, User, Phone, Building2, Upload, FileText,
  DollarSign, Sparkles, AlertCircle, Trash2, Loader2, Check, Clock,
  Layers, ChevronDown, Paperclip, Shield, Search, Plus, Hash
} from 'lucide-react';

export interface LoggedServiceItem {
  id: string;
  catalogServiceId?: string;
  name: string;
  isCustom: boolean;
  workFee: string;
  govFee: string;
  govRef?: string;
}

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
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // New Client fields (Phone is now optional!)
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientCompany, setNewClientCompany] = useState<string>('');
  const [newClientEmail, setNewClientEmail] = useState<string>('');

  // Sales Staff Attribution
  const [assignedSalesId, setAssignedSalesId] = useState<string>('');

  // Multiple Services State
  const [serviceItems, setServiceItems] = useState<LoggedServiceItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Financial Options
  const [paidByClient, setPaidByClient] = useState<boolean>(false);

  // Documents (Multi-Upload)
  const [govReceiptFiles, setGovReceiptFiles] = useState<File[]>([]);
  const [deliverableFiles, setDeliverableFiles] = useState<File[]>([]);

  // Metadata
  const [govRef, setGovRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>('');

  // Initialize with 1 editable service item when opened
  useEffect(() => {
    if (isOpen && serviceItems.length === 0) {
      setServiceItems([
        {
          id: `custom_${Date.now()}`,
          name: '',
          isCustom: true,
          workFee: '0.000',
          govFee: '0.000',
          govRef: ''
        }
      ]);
    }
  }, [isOpen]);

  // Load clients & sales staff on modal open
  useEffect(() => {
    if (!isOpen) return;

    const fetchLookups = async () => {
      setLoadingRefs(true);
      try {
        const { data: cliData } = await supabase
          .from('profiles')
          .select('id, full_name, phone, company_name, email')
          .eq('role', 'client')
          .order('full_name', { ascending: true });

        if (cliData) setClients(cliData);

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

  // Multi-Service Handlers
  const handleAddCatalogService = (svcId: string) => {
    if (!svcId) return;
    const svc = services.find(s => s.id === svcId);
    if (!svc) return;

    const newItem: LoggedServiceItem = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      catalogServiceId: svc.id,
      name: isRtl ? (svc.name_ar || svc.name_en) : svc.name_en,
      isCustom: false,
      workFee: svc.work_fee ? Number(svc.work_fee).toFixed(3) : '0.000',
      govFee: svc.ministry_fee ? Number(svc.ministry_fee).toFixed(3) : '0.000',
      govRef: ''
    };

    // If currently there is only 1 item and it's empty, replace it
    if (serviceItems.length === 1 && serviceItems[0].isCustom && !serviceItems[0].name.trim()) {
      setServiceItems([newItem]);
    } else {
      setServiceItems(prev => [...prev, newItem]);
    }

    setSelectedCatalogId('');
    setCatalogSearch('');
  };

  const handleAddCustomService = () => {
    const newItem: LoggedServiceItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      isCustom: true,
      workFee: '0.000',
      govFee: '0.000',
      govRef: ''
    };
    setServiceItems(prev => [...prev, newItem]);
  };

  const updateServiceItem = (id: string, field: keyof LoggedServiceItem, value: any) => {
    setServiceItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeServiceItem = (id: string) => {
    setServiceItems(prev => prev.filter(item => item.id !== id));
  };

  // Totals calculations
  const totalWorkFee = serviceItems.reduce((acc, item) => acc + (parseFloat(item.workFee) || 0), 0);
  const totalGovFee = serviceItems.reduce((acc, item) => acc + (parseFloat(item.govFee) || 0), 0);
  const grandTotal = totalWorkFee + totalGovFee;

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

  // Filter catalog services
  const filteredCatalogServices = services.filter(s => {
    if (!catalogSearch) return true;
    const term = catalogSearch.toLowerCase();
    return (
      (s.name_en && s.name_en.toLowerCase().includes(term)) ||
      (s.name_ar && s.name_ar.includes(term))
    );
  });

  // Handle Gov Receipt Upload (Multi-Upload)
  const handleGovReceiptsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setGovReceiptFiles(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeGovReceipt = (index: number) => {
    setGovReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Deliverables Upload (Multi-Upload)
  const handleDeliverablesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setDeliverableFiles(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeDeliverable = (index: number) => {
    setDeliverableFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Reset form
  const resetForm = () => {
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setClientMode('new');
    setSelectedClientId('');
    setClientSearch('');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientCompany('');
    setNewClientEmail('');
    setAssignedSalesId('');
    setServiceItems([
      {
        id: `custom_${Date.now()}`,
        name: '',
        isCustom: true,
        workFee: '0.000',
        govFee: '0.000',
        govRef: ''
      }
    ]);
    setSelectedCatalogId('');
    setCatalogSearch('');
    setPaidByClient(false);
    setGovReceiptFiles([]);
    setDeliverableFiles([]);
    setGovRef('');
    setNotes('');
    setIsSubmitting(false);
    setSubmitStep('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation
    if (clientMode === 'existing' && !selectedClientId) {
      toast.error(isRtl ? 'يرجى اختيار العميل المسجل' : 'Please select an existing client');
      return;
    }
    // Phone number is now optional! Only full_name is required.
    if (clientMode === 'new' && !newClientName.trim()) {
      toast.error(isRtl ? 'يرجى إدخال اسم العميل' : 'Please provide client name');
      return;
    }
    if (serviceItems.length === 0) {
      toast.error(isRtl ? 'يرجى إضافة خدمة واحدة على الأقل' : 'Please add at least one service');
      return;
    }
    const emptyIndex = serviceItems.findIndex(s => !s.name.trim());
    if (emptyIndex !== -1) {
      toast.error(isRtl ? `يرجى تحديد اسم الخدمة #${emptyIndex + 1}` : `Please provide name for service #${emptyIndex + 1}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Resolve Client (Fix for `null value in column "id" of relation "profiles" violates not-null constraint`)
      setSubmitStep(isRtl ? 'جاري تجهيز بيانات العميل...' : 'Resolving client record...');
      let finalClientId = selectedClientId;
      let finalClientName = '';

      if (clientMode === 'new') {
        const clientCode = `CLT-${Date.now().toString().slice(-7)}`;
        const dummyEmail = newClientEmail.trim() || `client_${Date.now()}_${Math.floor(Math.random() * 1000)}@osbic.placeholder`;
        const tempPassword = `Client#${Date.now()}!${Math.floor(Math.random() * 1000)}`;

        // Create auth user using detached client so active admin session is preserved
        const authClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
            }
          }
        );

        let clientId = '';

        try {
          const { data: authData, error: authError } = await authClient.auth.signUp({
            email: dummyEmail,
            password: tempPassword,
            options: {
              data: {
                full_name: newClientName.trim(),
                role: 'client'
              }
            }
          });

          if (!authError && authData?.user?.id) {
            clientId = authData.user.id;
          } else if (authError) {
            console.warn('Isolated client auth signup warning:', authError);
          }
        } catch (authEx) {
          console.warn('Isolated client auth exception:', authEx);
        }

        // Fallback to random UUID if auth returned empty
        if (!clientId) {
          clientId = crypto.randomUUID();
        }

        // Upsert profile with non-null ID
        const { data: createdClient, error: clientErr } = await (supabase
          .from('profiles')
          .upsert({
            id: clientId,
            full_name: newClientName.trim(),
            phone: newClientPhone.trim() || null,
            company_name: newClientCompany.trim() || null,
            email: dummyEmail,
            role: 'client',
            client_code: clientCode,
            branch_id: profile?.branch_id || null,
            is_active: true
          }, { onConflict: 'id' })
          .select()
          .single() as any);

        if (clientErr) throw new Error(clientErr.message || 'Failed to create new client record in profiles');
        finalClientId = createdClient.id;
        finalClientName = createdClient.full_name;
      } else {
        const existingCli = clients.find(c => c.id === selectedClientId);
        finalClientName = existingCli?.full_name || 'Client';
      }

      // 3. Resolve Master Anchor Service ID
      const firstCatalogItem = serviceItems.find(s => s.catalogServiceId);
      let fallbackServiceId = firstCatalogItem?.catalogServiceId;
      if (!fallbackServiceId && services.length > 0) {
        fallbackServiceId = services[0].id;
      }
      if (!fallbackServiceId) {
        const { data: anySvc } = await supabase.from('services').select('id').limit(1).maybeSingle();
        fallbackServiceId = anySvc?.id;
      }
      if (!fallbackServiceId) {
        throw new Error('No services registered in the database to link completed job.');
      }

      const combinedServiceName = serviceItems.map(s => s.name.trim()).join(' + ');
      const completedIsoDate = new Date(completionDate).toISOString();

      // 4. Create Master Completed Job Record
      setSubmitStep(isRtl ? 'إنشاء ملف المعاملة المكتملة...' : 'Creating completed master job...');
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
        custom_name: combinedServiceName,
        total_fee: grandTotal,
        work_fee: totalWorkFee,
        ministry_fee: totalGovFee,
        client_pays_ministry_fee: paidByClient,
        advance_percentage: 100,
        advance_amount: grandTotal,
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

      // 5. Create Multiple Completed Job Service Items
      setSubmitStep(isRtl ? `تسجيل بنود الخدمات المكتملة (${serviceItems.length})...` : `Recording completed services (${serviceItems.length})...`);
      
      const servicePayloads = serviceItems.map((item, idx) => {
        const itemWork = Math.max(0, parseFloat(item.workFee) || 0);
        const itemGov = Math.max(0, parseFloat(item.govFee) || 0);
        const itemTotal = itemWork + itemGov;

        return {
          job_id: job.id,
          service_id: item.catalogServiceId || fallbackServiceId,
          service_name: item.name.trim(),
          display_order: idx + 1,
          quantity: 1,
          item_number: idx + 1,
          applicant_name: finalClientName,
          status: 'completed',
          work_fee: itemWork,
          ministry_fee: itemGov,
          total_fee: itemTotal,
          ops_employee_id: profile?.id,
          assigned_by: assignedSalesId || profile?.id,
          assigned_at: completedIsoDate,
          started_at: completedIsoDate,
          completed_at: completedIsoDate,
          acceptance_status: 'accepted',
          assignment_model: 'direct',
          government_ref: item.govRef ? item.govRef.trim() : (govRef ? govRef.trim() : null),
          notes: notes ? `[Historical Done] ${notes}` : null
        };
      });

      const { data: createdJobServices, error: svcErr } = await (supabase
        .from('job_services')
        .insert(servicePayloads as any)
        .select() as any);

      if (svcErr) throw svcErr;

      // 6. Upload Government Fee Receipts (Multi-Upload)
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

      // 7. Record Government Expenses for each service with gov fee (unless paid by client directly)
      if (!paidByClient && createdJobServices && createdJobServices.length > 0) {
        setSubmitStep(isRtl ? 'تسجيل المصروفات الحكومية...' : 'Recording ministry fee expenses...');
        for (const svc of createdJobServices) {
          if (svc.ministry_fee > 0) {
            await supabase.from('job_expenses').insert({
              job_id: job.id,
              job_service_id: svc.id,
              amount: svc.ministry_fee,
              expense_type: 'ministry_fee',
              receipt_url: firstReceiptPath || null,
              notes: `Historical Ministry Fee for ${svc.service_name}${svc.government_ref ? ` [Ref: ${svc.government_ref}]` : ''}`,
              status: 'approved',
              created_by: profile?.id
            } as any);
          }
        }
      }

      // 8. Upload Deliverables / Final Output Documents (Multi-Upload)
      if (deliverableFiles.length > 0) {
        setSubmitStep(isRtl ? `رفع المخرجات والمستندات النهائية (${deliverableFiles.length})...` : `Uploading deliverables (${deliverableFiles.length})...`);
        const anchorSvcId = createdJobServices?.[0]?.id || null;

        for (let idx = 0; idx < deliverableFiles.length; idx++) {
          const file = deliverableFiles[idx];
          const ext = file.name.split('.').pop() || 'pdf';
          const filePath = `${job.id}/deliverable_${Date.now()}_${idx}.${ext}`;

          const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
          if (!uploadErr) {
            const docName = file.name.replace(/\.[^/.]+$/, "");

            // Insert into job_service_documents for deliverables dossier
            if (anchorSvcId) {
              await supabase.from('job_service_documents').insert({
                job_id: job.id,
                job_service_id: anchorSvcId,
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
            }

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

      // 9. Log Timeline Events for each service
      if (createdJobServices && createdJobServices.length > 0) {
        for (const svc of createdJobServices) {
          try {
            await supabase.from('job_service_timeline').insert({
              job_service_id: svc.id,
              job_id: job.id,
              from_status: 'in_progress',
              to_status: 'completed',
              changed_by: profile?.id || null,
              changed_by_name: profile?.full_name || 'Ops Specialist',
              changed_by_role: 'ops',
              changed_at: completedIsoDate,
              reason: 'Recorded historical completed work completed prior to ERP system rollout',
              government_ref: svc.government_ref || govRef || null,
              service_name: svc.service_name
            } as any);
          } catch (tErr) {
            console.warn('Timeline recording notice:', tErr);
          }
        }
      }

      // 10. Suppress any auto-generated assignment notification for this completed job
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('job_id', job.id);
      } catch (cleanErr) {
        console.warn('Notification cleanup notice:', cleanErr);
      }

      toast.success(isRtl ? 'تم حفظ وتوثيق الأعمال المكتملة بنجاح!' : 'Historical completed work logged successfully!');
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
                    ? 'توثيق المعاملات المنجزة سابقاً مع دعم اختيار خدمات متعددة ورسومها وإيصالاتها'
                    : 'Record past jobs with multiple services, individual gov fees & multi-file uploads'}
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
                      required
                      className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{isRtl ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}</label>
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

            {/* Section 3: Multiple Services Selection with Individual Gov Fees */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Layers size={15} className="text-primary" />
                  {isRtl ? 'الخدمات المنجزة والرسوم الحكومية' : 'Completed Services & Government Fees'}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {serviceItems.length} {isRtl ? 'خدمات' : 'item(s)'}
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all"
                  >
                    <Plus size={13} />
                    <span>{isRtl ? '+ إضافة خدمة مخصصة' : '+ Add Custom Service'}</span>
                  </button>
                </div>
              </div>

              {/* Add from Catalog Dropdown */}
              <div className="p-3 bg-muted/30 rounded-xl border border-border/40 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Search size={12} className="text-primary" />
                  <span>{isRtl ? 'إضافة خدمة من دليل الخدمات المعتمد:' : 'Add Service from Catalog:'}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={isRtl ? 'فلترة دليل الخدمات...' : 'Filter catalog services...'}
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
                  />
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => handleAddCatalogService(e.target.value)}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-foreground outline-none transition-all"
                  >
                    <option value="">{isRtl ? '-- اختر لإضافة خدمة للدائمة --' : '-- Pick to add service --'}</option>
                    {filteredCatalogServices.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name_en} {svc.name_ar ? `(${svc.name_ar})` : ''} — Min: {Number(svc.ministry_fee || 0).toFixed(3)} | Work: {Number(svc.work_fee || 0).toFixed(3)} OMR
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Services List */}
              <div className="space-y-3">
                {serviceItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-card border border-border/60 hover:border-border transition-all space-y-3"
                  >
                    {/* Item header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {index + 1}
                        </span>
                        {item.isCustom ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {isRtl ? 'مخصصة' : 'Custom'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {isRtl ? 'دليل الخدمات' : 'Catalog'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-foreground">
                          {((parseFloat(item.workFee) || 0) + (parseFloat(item.govFee) || 0)).toFixed(3)} OMR
                        </span>
                        {serviceItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeServiceItem(item.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Remove service"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Service Name Input */}
                    <div>
                      {item.isCustom ? (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateServiceItem(item.id, 'name', e.target.value)}
                          placeholder={isRtl ? 'اكتب اسم الخدمة المخصصة...' : 'Enter custom service name...'}
                          className="w-full bg-muted/20 border border-border focus:border-primary rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none"
                        />
                      ) : (
                        <div className="text-xs font-bold text-foreground px-1">
                          {item.name}
                        </div>
                      )}
                    </div>

                    {/* Fees Grid for this service */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <DollarSign size={11} className="text-emerald-400" />
                          <span>{isRtl ? 'الرسوم الحكومية (ريال)' : 'Gov / Ministry Fee (OMR)'}</span>
                        </label>
                        <input
                          type="text"
                          value={item.govFee}
                          onChange={(e) => {
                            if (/^\d*\.?\d*$/.test(e.target.value)) {
                              updateServiceItem(item.id, 'govFee', e.target.value);
                            }
                          }}
                          placeholder="0.000"
                          className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <DollarSign size={11} className="text-primary" />
                          <span>{isRtl ? 'أتعاب المكتب (ريال)' : 'Work / Agency Fee (OMR)'}</span>
                        </label>
                        <input
                          type="text"
                          value={item.workFee}
                          onChange={(e) => {
                            if (/^\d*\.?\d*$/.test(e.target.value)) {
                              updateServiceItem(item.id, 'workFee', e.target.value);
                            }
                          }}
                          placeholder="0.000"
                          className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Hash size={11} className="text-muted-foreground" />
                          <span>{isRtl ? 'رقم القيد / المرجع الحكومي' : 'Gov Ref / App No.'}</span>
                        </label>
                        <input
                          type="text"
                          value={item.govRef || ''}
                          onChange={(e) => updateServiceItem(item.id, 'govRef', e.target.value)}
                          placeholder="e.g. APP-9821"
                          className="w-full bg-muted/30 border border-border focus:border-primary rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                      {isRtl ? 'إجمالي الرسوم الحكومية' : 'Total Gov Fees'}
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {totalGovFee.toFixed(3)} OMR
                    </span>
                  </div>

                  <div className="h-6 w-px bg-border/60" />

                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                      {isRtl ? 'إجمالي أتعاب المكتب' : 'Total Work Fees'}
                    </span>
                    <span className="text-sm font-bold font-mono text-primary">
                      {totalWorkFee.toFixed(3)} OMR
                    </span>
                  </div>

                  <div className="h-6 w-px bg-border/60" />

                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                      {isRtl ? 'الإجمالي الكلي' : 'Grand Total'}
                    </span>
                    <span className="text-sm font-extrabold font-mono text-foreground">
                      {grandTotal.toFixed(3)} OMR
                    </span>
                  </div>
                </div>

                {/* Direct Pay Option */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="paidByClientCard"
                    checked={paidByClient}
                    onChange={(e) => setPaidByClient(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary bg-muted/30 border-border cursor-pointer"
                  />
                  <label htmlFor="paidByClientCard" className="text-xs font-medium text-foreground cursor-pointer select-none">
                    {isRtl ? 'الرسوم دفعت ببطاقة العميل (لا تحسب كمصروف من الشركة)' : 'Paid by Client Card directly'}
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Multi-File Uploads: Gov Receipts */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Paperclip size={15} className="text-emerald-400" />
                  {isRtl ? 'إيصالات السداد الحكومي (تحميل متعدد)' : 'Government Payment Receipts (Multi-File)'}
                </span>
                {govReceiptFiles.length > 0 && (
                  <span className="text-emerald-400 text-[10px] font-bold">
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
                    {isRtl ? 'انقر أو اسحب لاختيار إيصالات الرسوم الحكومية' : 'Click or drag ministry receipt files'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    PNG, JPG, PDF (Select multiple receipts at once)
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

            {/* Section 5: Multi-File Uploads: Output Deliverables */}
            <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={15} className="text-primary" />
                  {isRtl ? 'المخرجات والمستندات النهائية (مستندات الإنجاز)' : 'Deliverables & Output Documents (Multi-File)'}
                </span>
                {deliverableFiles.length > 0 && (
                  <span className="text-primary text-[10px] font-bold">
                    {deliverableFiles.length} {isRtl ? 'مستند محدد' : 'file(s) selected'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isRtl
                  ? 'رفع شهادات السجل التجاري، التراخيص البلدية، التأشيرات أو الموافقات المنجزة (ستظهر في بوابة العميل)'
                  : 'Upload licenses, CR certificates, approved permits or visas (will appear in client portal)'}
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
                    {isRtl ? 'انقر أو اسحب لإرفاق ملفات المخرجات النهائية' : 'Click or drag output deliverables'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    PDF, JPG, PNG, DOCX (Select multiple files at once)
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
                  {isRtl ? 'رقم القيد / المرجع العام' : 'General Gov Reference / App No.'}
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
