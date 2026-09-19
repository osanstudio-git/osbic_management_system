import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Save, Plus, Trash2, FileText, Printer, CheckCircle2, Edit, X, Eye, Download, AlertCircle, Receipt } from 'lucide-react';
import { useInvoice, useSaveInvoice, useUpdateInvoiceStatus, useNextInvoiceNumber, type Invoice, type InvoiceItem } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAdminJobs, useEmployeeJobs } from '../../hooks/shared/useJobs';
import { InvoiceDocument } from '../../components/employee/InvoiceDocument';
import { QuotationDocument } from '../../components/employee/QuotationDocument';
import { useLeads, useAdminLeads } from '../../hooks/shared/useLeads';
import { useAdminClients, useEmployeeClients } from '../../hooks/admin/useAdminClients';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { downloadReceipt } from '../../utils/invoiceGenerator';

const InvoiceBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'true';
  const isNew = id === 'new';
  const { profile, role } = useAuth();
  const isPrivileged = role === 'admin' || profile?.is_manager;
  const [invoiceMode, setInvoiceMode] = useState<'detailed' | 'simple'>('simple');

  const { data: initialData, isLoading: isLoadingInvoice } = useInvoice(id);
  const { mutateAsync: saveInvoice, isPending: isSaving } = useSaveInvoice();
  const { mutateAsync: updateStatus } = useUpdateInvoiceStatus();
  
  const [formData, setFormData] = useState<Invoice>({
    client_id: '',
    lead_id: null,
    job_id: '',
    type: 'invoice',
    status: 'draft',
    subtotal: 0,
    tax_percentage: 5,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    notes: 'Thank you for your business.',
    terms: 'Payment is due within 10 days.',
    items: []
  });

  const printRef = useRef<HTMLDivElement>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPayMode, setSelectedPayMode] = useState('Bank Transfer');

  // Scope clients and jobs: regular employees only see their assigned clients & jobs
  const adminClientsQuery = useAdminClients();
  const employeeClientsQuery = useEmployeeClients(profile?.id);
  const clients = profile?.is_manager ? adminClientsQuery.data : employeeClientsQuery.data;

  const adminJobsQuery = useAdminJobs();
  const employeeJobsQuery = useEmployeeJobs(profile?.id || '');
  const jobs = profile?.is_manager ? adminJobsQuery.data : employeeJobsQuery.data;

  // Fetch payments for the associated job to check verification status and enable viewing receipt
  const { data: jobPayments } = useQuery({
    queryKey: ['job_payments', formData.job_id],
    queryFn: async () => {
      if (!formData.job_id) return [];
      const { data, error } = await supabase
        .from('job_payments')
        .select('*')
        .eq('job_id', formData.job_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.job_id
  });

  const { useLeadsList } = useLeads(profile?.id);
  const { useAllLeadsList } = useAdminLeads();
  const leads = profile?.is_manager ? useAllLeadsList().data : useLeadsList().data;

  const { data: nextInvoiceNumber } = useNextInvoiceNumber();

  useEffect(() => {
    if (initialData) {
      if (initialData.type === 'quotation') {
        navigate(`/employee/quotations/${initialData.id}${window.location.search}`, { replace: true });
        return;
      }
      if (!isNew) {
        setFormData(initialData);
        if (initialData.metadata?.isSimple === false) {
          setInvoiceMode('detailed');
        } else {
          setInvoiceMode('simple');
        }
      }
    }
  }, [initialData, isNew]);

  useEffect(() => {
    if (isNew) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('type') === 'quotation' || (params.get('lead_id') && !params.get('job_id'))) {
        navigate(`/employee/quotations/new${window.location.search}`, { replace: true });
      }
    }
  }, [isNew]);

  // Sync selected client and lead details into formData for the document preview
  useEffect(() => {
    if (formData.client_id) {
      const selectedClient = clients?.find(c => c.id === formData.client_id);
      if (selectedClient && formData.client?.id !== selectedClient.id) {
        setFormData(prev => ({ ...prev, client: selectedClient, lead: null }));
      }
    } else if (formData.lead_id) {
      const selectedLead = leads?.find(l => l.id === formData.lead_id);
      if (selectedLead && formData.lead?.id !== selectedLead.id) {
        const hasNoRealItems = !formData.items || formData.items.length === 0 || 
          (formData.items.length === 1 && !formData.items[0].description);
        
        let autoItems = formData.items;
        if (hasNoRealItems && selectedLead.interested_services && selectedLead.interested_services.length > 0) {
          autoItems = selectedLead.interested_services.map((item: any) => ({
            description: item.name,
            quantity: 1,
            unit_price: item.price,
            total: item.price
          }));
        }

        setFormData(prev => ({ 
          ...prev, 
          lead: selectedLead, 
          client: null,
          items: autoItems 
        }));
      }
    } else {
      if (formData.client || formData.lead) {
        setFormData(prev => ({ ...prev, client: null, lead: null }));
      }
    }
  }, [formData.client_id, formData.lead_id, clients, leads]);

  // Handle URL Params and selection changes for Auto-Drafting from a Job
  useEffect(() => {
    let isCancelled = false;

    const fetchJobServicesAndPopulate = async () => {
      if (!isNew || !jobs || jobs.length === 0) return;

      const params = new URLSearchParams(window.location.search);
      const autofillJobId = formData.job_id || params.get('job_id');
      const autofillClientId = formData.client_id || params.get('client_id');
      
      const urlBaseFee = params.get('base_fee');
      const urlMinFee = params.get('min_fee');

      if (!autofillJobId) {
        if (formData.items?.length === 0) {
          setFormData(prev => ({ ...prev, items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] }));
        }
        return;
      }

      const jobDetail = jobs.find(j => j.id === autofillJobId);
      if (!jobDetail) return;

      // 1. Fetch itemized services from job_services table
      const { data: jobServicesList } = await supabase
        .from('job_services')
        .select('*')
        .eq('job_id', autofillJobId)
        .order('display_order', { ascending: true });

      // 2. Fetch any additional services
      const { data: addServicesList } = await supabase
        .from('job_additional_services')
        .select('*')
        .eq('job_id', autofillJobId);

      if (isCancelled) return;

      const autoItems: InvoiceItem[] = [];

      if (jobServicesList && jobServicesList.length > 0) {
        jobServicesList.forEach((js: any) => {
          const unitFee = (Number(js.work_fee) || 0) + (Number(js.ministry_fee) || 0);
          const qty = Number(js.quantity) || 1;
          const label = js.applicant_name 
            ? `${js.service_name || 'Service'} (${js.applicant_name})`
            : (js.service_name || 'Service');

          autoItems.push({
            description: label,
            quantity: qty,
            unit_price: unitFee,
            total: unitFee * qty
          });
        });
      }

      if (addServicesList && addServicesList.length > 0) {
        addServicesList.forEach((as: any) => {
          const unitFee = (Number(as.work_fee) || 0) + (Number(as.ministry_fee) || 0);
          const qty = Number(as.quantity) || 1;
          autoItems.push({
            description: as.custom_name || 'Additional Service',
            quantity: qty,
            unit_price: unitFee,
            total: unitFee * qty
          });
        });
      }

      // Fallback if no job_services rows found
      if (autoItems.length === 0) {
        const rawServiceName = jobDetail.service_name || 'Service';
        const finalWorkFee = urlBaseFee ? parseFloat(urlBaseFee) : (jobDetail.work_fee || 0);
        const finalMinistryFee = urlMinFee ? parseFloat(urlMinFee) : (jobDetail.ministry_fee || 0);
        const totalFee = finalWorkFee + finalMinistryFee;

        // Check if service name is compound (e.g. "Medical Attestation + Visa Processing")
        if (rawServiceName.includes(' + ') || rawServiceName.includes(' & ') || rawServiceName.includes(', ')) {
          const parts = rawServiceName.split(/\s*(?:\+|\&|\,)\s*/).filter(Boolean);
          const splitFee = parts.length > 0 ? (totalFee / parts.length) : totalFee;
          parts.forEach(part => {
            autoItems.push({
              description: part.trim(),
              quantity: 1,
              unit_price: splitFee,
              total: splitFee
            });
          });
        } else if (totalFee > 0) {
          autoItems.push({
            description: rawServiceName,
            quantity: 1,
            unit_price: totalFee,
            total: totalFee
          });
        }
      }

      const autoNotes = `${jobDetail.job_code} - ${jobDetail.service_name || 'Services'}`;

      setFormData(prev => {
        const hasExistingCustomItems = prev.items && prev.items.length > 0 && prev.items.some(item => item.description.trim() !== '');
        if (prev.job_id === autofillJobId && hasExistingCustomItems && prev.items.length === autoItems.length) {
          return prev;
        }
        const currentNotes = prev.notes || '';
        const shouldAutofillNotes = currentNotes === '' || currentNotes === 'Thank you for your business.' || currentNotes.startsWith('REF BY:');
        return {
          ...prev,
          client_id: autofillClientId || jobDetail.client_id,
          job_id: autofillJobId,
          notes: shouldAutofillNotes ? autoNotes : currentNotes,
          items: autoItems.length > 0 ? autoItems : [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
        };
      });

      if (autoItems.length > 1) {
        setInvoiceMode('detailed');
      }
    };

    fetchJobServicesAndPopulate();

    return () => {
      isCancelled = true;
    };
  }, [isNew, jobs, formData.job_id]);

  // Recalculate totals whenever items, tax, or discount changes
  useEffect(() => {
    if (!formData.items) return;
    
    const subtotal = formData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const discount = Number(formData.discount_amount) || 0;
    const taxRate = Number(formData.tax_percentage) || 0;
    const tax_amount = Math.max(0, subtotal - discount) * (taxRate / 100);
    const total_amount = Math.max(0, subtotal - discount) + tax_amount;

    setFormData(prev => {
      if (
        prev.subtotal === subtotal &&
        prev.tax_amount === tax_amount &&
        prev.total_amount === total_amount
      ) {
        return prev;
      }
      return {
        ...prev,
        subtotal,
        tax_amount,
        total_amount
      };
    });
  }, [formData.items, formData.tax_percentage, formData.discount_amount]);

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), { description: '', quantity: 1, unit_price: 0, total: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!formData.client_id && !formData.lead_id) {
      return toast.error('Please select a client or lead');
    }
    if (!formData.items || formData.items.length === 0 || formData.items.some(i => !i.description)) {
      return toast.error('Please complete all item descriptions');
    }

    try {
      if (formData.lead_id && formData.lead) {
        const { error: leadUpdateError } = await supabase
          .from('leads')
          .update({
            contact_name: formData.lead.contact_name,
            contact_phone: formData.lead.contact_phone || null,
            contact_email: formData.lead.contact_email || null
          })
          .eq('id', formData.lead_id);
        
        if (leadUpdateError) throw leadUpdateError;
      }

      const invoicePayload = {
        ...formData,
        employee_id: formData.employee_id || profile?.id,
        metadata: {
          ...formData.metadata,
          isSimple: invoiceMode === 'simple'
        }
      };
      const savedId = await saveInvoice(invoicePayload);
      toast.success(formData.type === 'quotation' ? 'Quotation saved successfully' : 'Invoice saved successfully');
      if (isNew) {
        navigate(`/employee/invoices/${savedId}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save invoice');
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: formData.invoice_number || (formData.type === 'quotation' ? 'Quotation' : 'Invoice'),
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 8mm 10mm !important;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
  });

  const handleConfirmPaymentMode = async () => {
    try {
      await updateStatus({ id: id!, status: 'paid', terms: selectedPayMode });
      setFormData(prev => ({ ...prev, status: 'paid', terms: selectedPayMode }));
      toast.success(`Invoice marked as PAID via ${selectedPayMode}`);
      setIsPayModalOpen(false);
    } catch (err: any) {
      console.error("Payment confirmation error:", err);
      toast.error('Failed to save payment details: ' + (err.message || 'Unknown error'));
    }
  };

  const togglePaid = async () => {
    if (isNew) return toast.error('Please save the invoice first');
    
    const isMarkingPaid = formData.status !== 'paid';
    if (isMarkingPaid) {
      setIsPayModalOpen(true);
      return;
    }

    // Toggling back to unpaid
    try {
      await updateStatus({ id: id!, status: 'unpaid' });
      const defaultTerms = 'Payment is due within 10 days.';
      setFormData(prev => ({ ...prev, status: 'unpaid', terms: defaultTerms }));
      toast.success('Invoice marked as unpaid');
    } catch (err: any) {
      console.error("Payment revert error:", err);
      toast.error('Failed to update status');
    }
  };

  const handleViewReceipt = () => {
    const verifiedPayment = jobPayments?.find(p => p.status === 'verified');
    const associatedJob = jobs?.find(j => j.id === formData.job_id) || formData.job || {};
    
    const paymentObj = verifiedPayment || { 
      amount: formData.total_amount, 
      created_at: new Date().toISOString(),
      reference_number: `REC-${associatedJob.job_code || 'MANUAL'}`
    };
    
    downloadReceipt(associatedJob, paymentObj, 'view');
  };

  const handleDownloadReceipt = () => {
    const verifiedPayment = jobPayments?.find(p => p.status === 'verified');
    const associatedJob = jobs?.find(j => j.id === formData.job_id) || formData.job || {};
    
    const paymentObj = verifiedPayment || { 
      amount: formData.total_amount, 
      created_at: new Date().toISOString(),
      reference_number: `REC-${associatedJob.job_code || 'MANUAL'}`
    };
    
    downloadReceipt(associatedJob, paymentObj, 'download');
  };

  if (isLoadingInvoice) return <div className="p-8 text-center text-muted-foreground">Loading invoice data...</div>;

  const activeClients = clients || [];
  const clientJobs = jobs?.filter(j => j.client_id === formData.client_id) || [];

  return (
    <div className="max-w-7xl mx-auto pb-24 print:p-0 print:m-0">
      
      {/* HEADER (Hidden in Print) */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/employee/invoices')} 
            className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {formData.invoice_number || (formData.type === 'quotation' ? 'DRAFT QUOTATION' : 'DRAFT INVOICE')}
            </p>
            <h1 className="text-2xl font-syne font-bold text-foreground tracking-tight flex items-center gap-3">
              {isNew 
                ? (formData.type === 'quotation' ? 'Create Quotation' : 'Create Invoice') 
                : viewMode 
                  ? (formData.type === 'quotation' ? 'View Quotation' : 'View Invoice') 
                  : (formData.type === 'quotation' ? 'Edit Quotation' : 'Edit Invoice')
              }
              {!isNew && formData.status === 'paid' && (
                <span className="bg-emerald-500/10 text-emerald-500 text-xs px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 size={12} /> Paid
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={handlePrint}
             className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors text-foreground"
           >
             <Printer size={16} /> Print / PDF
           </button>
           
           {viewMode ? (
             <button 
               onClick={() => navigate(`/employee/invoices/${id}`)}
               className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
             >
               <Edit size={16} /> {formData.type === 'quotation' ? 'Edit Quotation' : 'Edit Invoice'}
             </button>
           ) : (
             <>
                {/* Payment Status Area — only for saved invoices of type 'invoice' */}
                {!isNew && formData.type === 'invoice' && (
                  formData.status === 'paid' ? (
                    // Already verified/paid — show receipt confirmation badge + View/Download Receipt actions
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/5">
                        <CheckCircle2 size={13} /> Receipt Issued
                      </span>
                      <button
                        onClick={handleViewReceipt}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/5"
                        title="View Official Receipt"
                      >
                        <Eye size={12} /> View Receipt
                      </button>
                      <button
                        onClick={handleDownloadReceipt}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                        title="Download Official Receipt"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  ) : (
                    // Unpaid — check if there's a pending payment
                    jobPayments && jobPayments.some(p => p.status === 'pending') ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded-xl text-xs font-bold animate-pulse">
                          <AlertCircle size={13} /> Verification Pending
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground/60 max-w-[200px] leading-tight">
                          Connect with Accounts to verify the pending deposit.
                        </span>
                      </div>
                    ) : (
                      // Truly unpaid — no payments recorded
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/5 border border-rose-500/15 text-rose-400/80 rounded-xl text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Unpaid
                        </span>
                        {isPrivileged ? (
                          <button 
                            onClick={togglePaid}
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                          >
                            <CheckCircle2 size={12} /> Override: Mark as Paid
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 leading-tight">
                            Record payment inside the Job's Ledger page.
                          </span>
                        )}
                      </div>
                    )
                  )
                )}
               
               <button 
                 onClick={handleSave}
                 disabled={isSaving}
                 className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
               >
                 <Save size={16} /> {isSaving ? 'Saving...' : 'Save Draft'}
               </button>
             </>
           )}
        </div>
      </div>

      <div className={`flex flex-col ${viewMode ? 'items-center' : 'lg:flex-row'} gap-8 print:block`}>
        
        {/* LEFT: FORM BUILDER (Hidden in Print and View Mode) */}
        {!viewMode && (
          <div className="w-full lg:w-[45%] space-y-6 print:hidden">
          
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl space-y-6">
             <div className="grid grid-cols-2 gap-4 border-b border-border pb-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Document Type</label>
                  <div className="w-full bg-muted/10 border border-border/80 rounded-xl px-4 py-3 text-sm text-foreground font-bold uppercase tracking-widest">
                    Invoice
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Recipient *</label>
                  <select 
                    value={formData.client_id ? `client:${formData.client_id}` : ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.startsWith('client:')) {
                        setFormData({...formData, client_id: val.replace('client:', ''), lead_id: null, job_id: ''});
                      } else {
                        setFormData({...formData, client_id: null, lead_id: null, job_id: ''});
                      }
                    }}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                  >
                    <option value="" className="bg-card text-foreground">Select recipient...</option>
                    <optgroup label="Registered Clients" className="bg-card text-foreground">
                      {activeClients.map(c => (
                        <option key={c.id} value={`client:${c.id}`} className="bg-card text-foreground">{c.full_name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

               <div className="space-y-2 col-span-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Link to Job (Optional)</label>
                 <select 
                   value={formData.job_id || ''}
                   onChange={e => setFormData({...formData, job_id: e.target.value})}
                   disabled={!formData.client_id}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all disabled:opacity-50"
                 >
                   <option value="">No specific job linked</option>
                   {clientJobs.map(j => (
                     <option key={j.id} value={j.id}>{j.job_code} - {j.service_name}</option>
                   ))}
                 </select>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Custom Invoice No.</label>
                 <input 
                   type="text" 
                   placeholder={nextInvoiceNumber || "Auto-generated"}
                   value={formData.invoice_number || ''}
                   onChange={e => setFormData({...formData, invoice_number: e.target.value})}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all placeholder:text-muted-foreground/40"
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Issue Date</label>
                 <input 
                   type="date" 
                   value={formData.issue_date ? formData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0]}
                   onChange={e => setFormData({...formData, issue_date: e.target.value})}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                 />
               </div>

               <div className="space-y-2 col-span-2 md:col-span-1">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                   {formData.type === 'quotation' ? 'Activity' : 'Reference Name (Description)'}
                 </label>
                 <input 
                   type="text" 
                   placeholder={formData.type === 'quotation' ? 'e.g. BUSINESS SETUP' : 'e.g. REF BY MAATHIR'}
                   value={formData.notes || ''}
                   onChange={e => setFormData({...formData, notes: e.target.value})}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                 />
               </div>

                <div className="space-y-2 col-span-2 md:col-span-1">
                  {formData.status === 'paid' ? (
                    <>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                        Payment Mode
                      </label>
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold rounded-xl px-4 py-3 text-sm">
                        Paid via {formData.terms || 'Bank Transfer'}
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                        Payment Terms
                      </label>
                      <select 
                        value={formData.terms || 'Payment is due within 10 days.'}
                        onChange={e => setFormData({...formData, terms: e.target.value})}
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                      >
                        <option value="Payment is due within 10 days.">Due within 10 days</option>
                        <option value="Payment is due within 15 days.">Due within 15 days</option>
                        <option value="Payment is due within 30 days.">Due within 30 days</option>
                        <option value="Payment is due upon receipt.">Due upon receipt</option>
                      </select>
                    </>
                  )}
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Line Items</label>
                  <button onClick={addItem} className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"><Plus size={12}/> ADD ITEM</button>
                </div>
                
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                  {formData.items?.map((item, idx) => (
                    <motion.div layout key={idx} className="bg-muted/10 border border-border rounded-xl p-4 relative group">
                      <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="Description..." 
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-b border-border/50 pb-2 text-sm text-foreground focus:border-primary outline-none transition-colors"
                        />
                        <div className="grid grid-cols-3 gap-3">
                           <div>
                             <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1">Qty</label>
                             <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none" />
                           </div>
                           <div>
                             <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1">Unit Price</label>
                             <input type="number" min="0" step="0.001" value={item.unit_price} onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none" />
                           </div>
                           <div>
                             <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1 text-right">Total</label>
                             <div className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold text-right">
                               {item.total.toFixed(3)}
                             </div>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Discount Amount (OMR)</label>
                 <input 
                   type="number" 
                   min="0"
                   step="0.001"
                   value={formData.discount_amount}
                   onChange={e => setFormData({...formData, discount_amount: parseFloat(e.target.value) || 0})}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tax Percentage (%)</label>
                 <input 
                   type="number" 
                   min="0"
                   max="100"
                   value={formData.tax_percentage}
                   onChange={e => setFormData({...formData, tax_percentage: parseFloat(e.target.value) || 0})}
                   className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                 />
               </div>
             </div>

              {false && (
                <div className="space-y-4 border-t border-border pt-6">
                   <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><FileText size={16}/> Quotation Details</h3>
                   
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Documents Required (One per line)</label>
                     <textarea 
                       rows={4}
                       placeholder="Selfie with Passport&#10;Passport Size Photo"
                       value={typeof formData.metadata?.documents === 'string' ? formData.metadata.documents : (formData.metadata?.documents?.join('\n') || '')}
                       onChange={e => setFormData({...formData, metadata: { ...formData.metadata, documents: e.target.value }})}
                       className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                     />
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Timeline (Format: Task:Days - One per line)</label>
                     <textarea 
                       rows={4}
                       placeholder="CR Certificate:0-1 Working Days&#10;Activity License:0-1 Working Days"
                       value={typeof formData.metadata?.timeline === 'string' ? formData.metadata.timeline : (formData.metadata?.timeline?.map((t: any) => `${t.task}:${t.days}`).join('\n') || '')}
                       onChange={e => setFormData({...formData, metadata: { ...formData.metadata, timeline: e.target.value }})}
                       className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                     />
                   </div>
                </div>
             )}

          </div>
        </div>
        )}

        {/* RIGHT: DOCUMENT PREVIEW (Visible in Print) */}
        <div className={viewMode ? "w-full max-w-[210mm] mx-auto print:w-full print:block print:static" : "w-full lg:w-[55%] print:w-full print:block print:static"}>
           {/* Mode Selector (Hidden in Print) */}
           <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card border border-border rounded-[2rem] mb-6 print:hidden items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold text-foreground">Invoice Presentation Mode</span>
                <p className="text-[9px] text-muted-foreground mt-0.5">Toggle between line-by-line itemized detail and flat package summary</p>
              </div>
              <div className="flex bg-muted/40 p-1 border border-border rounded-xl">
                 <button
                   onClick={() => setInvoiceMode('detailed')}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     invoiceMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                   }`}
                 >
                   Detailed
                 </button>
                 <button
                   onClick={() => setInvoiceMode('simple')}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     invoiceMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                   }`}
                 >
                   Simple Summary
                 </button>
              </div>
           </div>

           <div className="sticky top-8 rounded-2xl overflow-hidden border border-border shadow-2xl print:shadow-none print:border-none print:overflow-visible print:static">
              <style>{`
                @media print {
                  @page { margin: 8mm 10mm !important; size: A4 portrait; }
                  html, body {
                    width: auto;
                    height: auto;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }
                  .print-section {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
              `}</style>
              <div className="print-section" ref={printRef}>
                <InvoiceDocument 
                  invoice={{
                    ...formData,
                    client: clients?.find(c => c.id === formData.client_id),
                    job: jobs?.find(j => j.id === formData.job_id)
                  }} 
                  isSimple={invoiceMode === 'simple'}
                />
              </div>
           </div>
        </div>

      </div>
      
      {/* Select Payment Mode Modal */}
      <AnimatePresence>
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
                  <p className="text-xs text-muted-foreground mt-1">Specify how this invoice payment was processed.</p>
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
                    onClick={handleConfirmPaymentMode}
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

export default InvoiceBuilder;
