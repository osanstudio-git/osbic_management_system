import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, FileText, Printer, Edit, CheckCircle2, CreditCard, CheckSquare, Square, Calendar, Camera, Layers, Settings2, Sliders } from 'lucide-react';
import { useInvoice, useSaveInvoice, type Invoice, type InvoiceItem } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminClients, useEmployeeClients } from '../../hooks/admin/useAdminClients';
import { useAdminJobs, useEmployeeJobs } from '../../hooks/shared/useJobs';
import { QuotationDocument } from '../../components/employee/QuotationDocument';
import { useLeads, useAdminLeads } from '../../hooks/shared/useLeads';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { supabase } from '../../lib/supabase';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import QuotationAcceptWizard from '../../components/employee/QuotationAcceptWizard';
import { AnimatePresence } from 'framer-motion';

export interface TimelineStep {
  task: string;
  days: string;
}

export const STANDARD_TIMELINE_ITEMS: TimelineStep[] = [
  { task: 'Share Transfer', days: '4-6 Working Days' },
  { task: 'CR Renewal', days: '1 Working Day' },
  { task: 'Activity License Renewal', days: '1 Working Day' },
  { task: 'KYC Verification', days: '1-2 Working Days' },
  { task: 'CR Certificate Issue', days: '1-2 Working Days' },
  { task: 'OCCI Registration', days: '1 Working Day' },
  { task: 'Tax Card Issue', days: '1-2 Working Days' },
  { task: 'Activity License Issue', days: '1 Working Day' },
  { task: 'Feasibility Study', days: '1 Working Day' },
  { task: 'Investment License', days: '3-4 Working Days' },
  { task: 'Customs Clearance', days: '3-4 Working Days' },
  { task: 'Visa Processing', days: '2-3 Working Days (Depends on Nationality)' },
  { task: 'Attestation Services', days: '2-3 Working Days' }
];

export const STANDARD_DOCUMENT_ITEMS = [
  'COLOR PASSPORT COPIES OF SHAREHOLDERS',
  'COLOR PHOTO OF THE SHARE HOLDER',
  'EMAIL ID',
  'CONTACT NUMBER',
  'DOCUMENTS PROVIDING PREVIOUS EXPERIENCE IN THE SAME LINE OF BUSINESS OR EDUCATION CERTIFICATE',
  'SUGGESTION OF 5 NAMES FOR THE NEW COMPANY (PREFERABLY ARABIC)',
  'SELFIE WITH PASSPORT',
  'PASSPORT SIZE PHOTO'
];

const DEFAULT_QUOTATION_DOCUMENTS = `SELFIE WITH PASSPORT
PASSPORT SIZE PHOTO
EMAIL ID
CONTACT NUMBER
COLOR PASSPORT COPIES OF SHAREHOLDERS
COLOR PHOTO OF THE SHARE HOLDER
DOCUMENTS PROVIDING PREVIOUS EXPERIENCE IN THE SAME LINE OF BUSINESS OR EDUCATION CERTIFICATE
SUGGESTION OF 5 NAMES FOR THE NEW COMPANY (PREFERABLY ARABIC)`;

const DEFAULT_QUOTATION_TIMELINE = `Share Transfer:4-6 Working Days
CR Renewal:1 Working Day
Activity License Renewal:1 Working Day
KYC Verification:1-2 Working Days
CR Certificate Issue:1-2 Working Days
OCCI Registration:1 Working Day
Tax Card Issue:1-2 Working Days
Activity License Issue:1 Working Day
Feasibility Study:1 Working Day
Investment License:3-4 Working Days
Customs Clearance:3-4 Working Days
Visa Processing:2-3 Working Days (Depends on Nationality)
Attestation Services:2-3 Working Days`;

export const parseTimelineHelper = (timelineVal: any): TimelineStep[] => {
  if (Array.isArray(timelineVal)) {
    return timelineVal.filter(t => t && t.task);
  }
  if (typeof timelineVal === 'string') {
    return timelineVal.split('\n').filter(Boolean).map(line => {
      const [task, ...rest] = line.split(':');
      return { task: task?.trim() || '', days: rest.join(':')?.trim() || '' };
    }).filter(t => t.task);
  }
  return STANDARD_TIMELINE_ITEMS;
};

export const parseDocumentsHelper = (docsVal: any): string[] => {
  if (Array.isArray(docsVal)) {
    return docsVal.map(d => typeof d === 'string' ? d.trim() : d?.name?.trim()).filter(Boolean);
  }
  if (typeof docsVal === 'string') {
    return docsVal.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return STANDARD_DOCUMENT_ITEMS;
};

const QuotationBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'true';
  const isNew = id === 'new';
  const { profile } = useAuth();

  const { data: initialData, isLoading: isLoadingQuotation } = useInvoice(id);
  const { mutateAsync: saveQuotation, isPending: isSaving } = useSaveInvoice();
  
  // Scope clients and jobs: regular employees only see their assigned clients & jobs
  const adminClientsQuery = useAdminClients();
  const employeeClientsQuery = useEmployeeClients(profile?.id);
  const clients = profile?.is_manager ? adminClientsQuery.data : employeeClientsQuery.data;

  const adminJobsQuery = useAdminJobs();
  const employeeJobsQuery = useEmployeeJobs(profile?.id || '');
  const jobs = profile?.is_manager ? adminJobsQuery.data : employeeJobsQuery.data;

  const { useLeadsList } = useLeads(profile?.id);
  const { useAllLeadsList } = useAdminLeads();
  const leads = profile?.is_manager ? useAllLeadsList().data : useLeadsList().data;

  const { data: allServices } = useAdminServices();

  const printRef = useRef<HTMLDivElement>(null);
  const [isAcceptWizardOpen, setIsAcceptWizardOpen] = useState(false);
  const [quotationMode, setQuotationMode] = useState<'detailed' | 'simple'>('detailed');

  // Interactive Checklist states
  const [timelineTab, setTimelineTab] = useState<'checklist' | 'raw'>('checklist');
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskDays, setCustomTaskDays] = useState('1-2 Working Days');

  const [documentsTab, setDocumentsTab] = useState<'checklist' | 'raw'>('checklist');
  const [customDocName, setCustomDocName] = useState('');

  const [formData, setFormData] = useState<Invoice>({
    client_id: '',
    lead_id: null,
    job_id: '',
    type: 'quotation',
    status: 'draft',
    subtotal: 0,
    tax_percentage: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    notes: 'BUSINESS SETUP',
    terms: 'Payment is due within 10 days.',
    items: [],
    metadata: {
      documents: DEFAULT_QUOTATION_DOCUMENTS,
      timeline: DEFAULT_QUOTATION_TIMELINE,
      showQuantity: false,
      showTimeline: true,
      showDocuments: true,
      showKycProof: false
    }
  });

  useEffect(() => {
    if (initialData && !isNew) {
      setFormData(initialData);
      if (initialData.metadata?.isSimple) {
        setQuotationMode('simple');
      } else {
        setQuotationMode('detailed');
      }
    }
  }, [initialData, isNew]);

  // Handle Lead ID autofill from URL params
  useEffect(() => {
    if (isNew) {
      const params = new URLSearchParams(window.location.search);
      const autofillLeadId = params.get('lead_id');
      if (autofillLeadId) {
        setFormData(prev => ({
          ...prev,
          lead_id: autofillLeadId,
          type: 'quotation',
          client_id: null,
          notes: prev.notes === 'Thank you for your business.' ? 'BUSINESS SETUP' : prev.notes,
          metadata: {
            ...prev.metadata,
            documents: prev.metadata?.documents || DEFAULT_QUOTATION_DOCUMENTS,
            timeline: prev.metadata?.timeline || DEFAULT_QUOTATION_TIMELINE,
            showQuantity: prev.metadata?.showQuantity ?? false,
            showTimeline: prev.metadata?.showTimeline ?? true,
            showDocuments: prev.metadata?.showDocuments ?? true,
            showKycProof: prev.metadata?.showKycProof ?? false
          }
        }));
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
        
        if (hasNoRealItems && selectedLead.interested_services && selectedLead.interested_services.length > 0) {
          const loadServicesAndSet = async () => {
            let finalItems: InvoiceItem[] = [];
            let activityName = 'BUSINESS SETUP';

            for (const item of selectedLead.interested_services) {
              if (item.type === 'package') {
                activityName = item.name;

                try {
                  const { data: junctionRows } = await supabase
                    .from('package_services')
                    .select('display_order, services(id, name_en, name_ar)')
                    .eq('package_id', item.id) as any;

                  const sorted = (junctionRows || [])
                    .sort((a: any, b: any) => a.display_order - b.display_order)
                    .map((row: any) => row.services)
                    .filter(Boolean);

                  if (sorted.length > 0) {
                    const mapped = sorted.map((srv: any, idx: number) => ({
                      description: srv.name_en,
                      quantity: 1,
                      unit_price: idx === 0 ? (item.price || 0) : 0,
                      total: idx === 0 ? (item.price || 0) : 0
                    }));
                    finalItems = [...finalItems, ...mapped];
                  } else {
                    finalItems.push({
                      description: item.name,
                      quantity: 1,
                      unit_price: item.price || 0,
                      total: item.price || 0
                    });
                  }
                } catch (err) {
                  console.error('Error fetching package services:', err);
                  finalItems.push({
                    description: item.name,
                    quantity: 1,
                    unit_price: item.price || 0,
                    total: item.price || 0
                  });
                }
              } else {
                finalItems.push({
                  description: item.name,
                  quantity: 1,
                  unit_price: item.price || 0,
                  total: item.price || 0
                });
              }
            }

            setFormData(prev => ({ 
              ...prev, 
              lead: selectedLead, 
              client: null,
              notes: prev.notes === 'BUSINESS SETUP' ? activityName : prev.notes,
              items: finalItems,
              subtotal: finalItems.reduce((acc, curr) => acc + (curr.total || 0), 0),
              total_amount: finalItems.reduce((acc, curr) => acc + (curr.total || 0), 0)
            }));
          };
          
          loadServicesAndSet();
        } else {
          setFormData(prev => ({ 
            ...prev, 
            lead: selectedLead, 
            client: null
          }));
        }
      }
    } else {
      if (formData.client || formData.lead) {
        setFormData(prev => ({ ...prev, client: null, lead: null }));
      }
    }
  }, [formData.client_id, formData.lead_id, clients, leads]);

  // Handle URL Params and selection changes for Auto-Drafting from a Job
  useEffect(() => {
    if (isNew && jobs && jobs.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const autofillJobId = params.get('job_id') || formData.job_id;
      const autofillClientId = params.get('client_id') || formData.client_id;
      
      const urlBaseFee = params.get('base_fee');
      const urlMinFee = params.get('min_fee');

      if (autofillJobId) {
        const jobDetail = jobs.find(j => j.id === autofillJobId);
        if (jobDetail) {
          const serviceName = jobDetail.service_name || 'Service';
          const finalWorkFee = urlBaseFee ? parseFloat(urlBaseFee) : (jobDetail.work_fee || 0);
          const finalMinistryFee = urlMinFee ? parseFloat(urlMinFee) : (jobDetail.ministry_fee || 0);
          const totalFee = finalWorkFee + finalMinistryFee;
          
          const autoItems: InvoiceItem[] = [];
          if (totalFee > 0) {
            autoItems.push({ 
              description: serviceName, 
              quantity: 1, 
              unit_price: totalFee, 
              total: totalFee 
            });
          }

          const autoNotes = `${jobDetail.job_code} - ${serviceName}`;

          setFormData(prev => {
            const hasExistingCustomItems = prev.items && prev.items.length > 0 && prev.items.some(item => item.description.trim() !== '');
            if (prev.job_id === autofillJobId && hasExistingCustomItems) {
              return prev;
            }
            const currentNotes = prev.notes || '';
            const shouldAutofillNotes = currentNotes === '' || currentNotes === 'BUSINESS SETUP' || currentNotes === autoNotes || currentNotes.startsWith('REF BY:');
            return {
              ...prev,
              client_id: autofillClientId || jobDetail.client_id,
              job_id: autofillJobId,
              notes: shouldAutofillNotes ? autoNotes : currentNotes,
              items: autoItems.length > 0 ? autoItems : [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
            };
          });

        }
      } else if (formData.items?.length === 0) {
        setFormData(prev => ({ ...prev, items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] }));
      }
    }
  }, [isNew, jobs, formData.job_id]);

  // Recalculate totals whenever items, tax, or discount changes
  useEffect(() => {
    if (!formData.items || !allServices) return;

    let subtotal = 0;
    let itemsChanged = false;
    const updatedItems = formData.items.map(item => {
      const matchedService = allServices?.find(
        s => s.name_en.toLowerCase() === item.description?.toLowerCase() ||
             s.name_ar === item.description
      );
      const dbMinFee = matchedService?.ministry_fee ?? 0;
      const curMinFee = item.ministry_fee !== undefined ? item.ministry_fee : dbMinFee;
      
      const rawSrvFee = item.service_fee !== undefined 
        ? item.service_fee 
        : (item.unit_price - curMinFee);
      const curSrvFee = Math.max(0, parseFloat(rawSrvFee as any) || 0);

      const calculatedUnitPrice = curMinFee + curSrvFee;
      const calculatedTotal = (item.quantity || 1) * calculatedUnitPrice;

      subtotal += calculatedTotal;

      if (
        item.ministry_fee !== curMinFee ||
        item.service_fee !== curSrvFee ||
        item.unit_price !== calculatedUnitPrice ||
        item.total !== calculatedTotal
      ) {
        itemsChanged = true;
        return {
          ...item,
          ministry_fee: curMinFee,
          service_fee: curSrvFee,
          unit_price: calculatedUnitPrice,
          total: calculatedTotal
        };
      }
      return item;
    });

    const tax_amount = (subtotal - formData.discount_amount) * (formData.tax_percentage / 100);
    const total_amount = subtotal - formData.discount_amount + tax_amount;

    const subtotalDiff = Math.abs((formData.subtotal || 0) - subtotal) > 0.0001;
    const totalDiff = Math.abs((formData.total_amount || 0) - total_amount) > 0.0001;

    if (itemsChanged || subtotalDiff || totalDiff) {
      setFormData(prev => ({
        ...prev,
        items: updatedItems,
        subtotal,
        tax_amount,
        total_amount
      }));
    }
  }, [formData.items, formData.tax_percentage, formData.discount_amount, allServices]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    const targetItem = { ...newItems[index] } as any;

    if (field === 'description') {
      targetItem.description = value;
      const matched = allServices?.find(
        s => s.name_en.toLowerCase() === value.toLowerCase() ||
             s.name_ar === value
      );
      if (matched) {
        targetItem.ministry_fee = matched.ministry_fee || 0;
      }
    } else if (field === 'service_fee') {
      targetItem.service_fee = parseFloat(value) || 0;
    } else if (field === 'ministry_fee') {
      targetItem.ministry_fee = parseFloat(value) || 0;
    } else if (field === 'quantity') {
      targetItem.quantity = Math.max(1, parseInt(value) || 1);
    } else {
      targetItem[field] = value;
    }

    const matchedService = allServices?.find(
      s => s.name_en.toLowerCase() === targetItem.description?.toLowerCase() ||
           s.name_ar === targetItem.description
    );
    const dbMinFee = matchedService?.ministry_fee ?? 0;
    const curMinFee = targetItem.ministry_fee !== undefined ? targetItem.ministry_fee : dbMinFee;

    const rawSrvFee = targetItem.service_fee !== undefined 
      ? targetItem.service_fee 
      : (targetItem.unit_price - curMinFee);
    const curSrvFee = Math.max(0, parseFloat(rawSrvFee as any) || 0);

    targetItem.ministry_fee = curMinFee;
    targetItem.service_fee = curSrvFee;
    targetItem.unit_price = curMinFee + curSrvFee;
    targetItem.total = (targetItem.quantity || 1) * targetItem.unit_price;

    newItems[index] = targetItem;
    
    // Auto recalculate subtotal & total immediately
    const newSubtotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const newTaxAmount = (newSubtotal - (formData.discount_amount || 0)) * ((formData.tax_percentage || 0) / 100);
    const newTotalAmount = newSubtotal - (formData.discount_amount || 0) + newTaxAmount;

    setFormData({
      ...formData,
      items: newItems,
      subtotal: newSubtotal,
      tax_amount: newTaxAmount,
      total_amount: newTotalAmount
    });
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

  // Timeline helper handlers
  const currentTimelineList = parseTimelineHelper(formData.metadata?.timeline);

  const toggleTimelineStep = (task: string, defaultDays: string) => {
    const exists = currentTimelineList.some(t => t.task === task);
    let updated: TimelineStep[];
    if (exists) {
      updated = currentTimelineList.filter(t => t.task !== task);
    } else {
      updated = [...currentTimelineList, { task, days: defaultDays }];
    }
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, timeline: updated }
    }));
  };

  const updateTimelineStepDays = (task: string, newDays: string) => {
    const updated = currentTimelineList.map(t => t.task === task ? { ...t, days: newDays } : t);
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, timeline: updated }
    }));
  };

  const selectAllTimeline = () => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, timeline: STANDARD_TIMELINE_ITEMS }
    }));
  };

  const clearAllTimeline = () => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, timeline: [] }
    }));
  };

  const addCustomTimelineStep = () => {
    if (!customTaskName.trim()) return toast.error('Please enter step name');
    const updated = [...currentTimelineList, { task: customTaskName.trim(), days: customTaskDays.trim() || '1-2 Working Days' }];
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, timeline: updated }
    }));
    setCustomTaskName('');
    toast.success('Added timeline step');
  };

  // Documents helper handlers
  const currentDocsList = parseDocumentsHelper(formData.metadata?.documents);

  const toggleDocument = (docName: string) => {
    const exists = currentDocsList.includes(docName);
    let updated: string[];
    if (exists) {
      updated = currentDocsList.filter(d => d !== docName);
    } else {
      updated = [...currentDocsList, docName];
    }
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, documents: updated }
    }));
  };

  const selectAllDocuments = () => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, documents: STANDARD_DOCUMENT_ITEMS }
    }));
  };

  const clearAllDocuments = () => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, documents: [] }
    }));
  };

  const addCustomDocument = () => {
    if (!customDocName.trim()) return toast.error('Please enter document name');
    const updated = [...currentDocsList, customDocName.trim().toUpperCase()];
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, documents: updated }
    }));
    setCustomDocName('');
    toast.success('Added required document');
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

      const quotationPayload = {
        ...formData,
        type: 'quotation', // Force type to quotation
        employee_id: formData.employee_id || profile?.id,
        metadata: {
          ...formData.metadata,
          isSimple: quotationMode === 'simple'
        }
      };
      const savedId = await saveQuotation(quotationPayload);
      toast.success('Quotation saved successfully');
      if (isNew) {
        navigate(`/employee/quotations/${savedId}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save quotation');
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: formData.invoice_number || 'Quotation',
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 0mm !important;
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

  if (isLoadingQuotation) return <div className="p-8 text-center text-muted-foreground">Loading quotation data...</div>;

  const activeClients = clients || [];
  const clientJobs = jobs?.filter(j => j.client_id === formData.client_id) || [];

  return (
    <div className="max-w-7xl mx-auto pb-24 print:p-0 print:m-0">
      
      {/* HEADER (Hidden in Print) */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/employee/invoices?tab=quotations')} 
            className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {formData.invoice_number || 'DRAFT QUOTATION'}
            </p>
            <h1 className="text-2xl font-syne font-bold text-foreground tracking-tight flex items-center gap-3">
              {isNew ? 'Create Quotation' : viewMode ? 'View Quotation' : 'Edit Quotation'}
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
             <div className="flex items-center gap-2">
               {formData.status !== 'accepted' && (
                 <button 
                   onClick={() => setIsAcceptWizardOpen(true)}
                   className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 active:scale-95"
                 >
                   <CheckCircle2 size={16} /> Accept & Launch Job
                 </button>
               )}
               <button 
                 onClick={() => navigate(`/employee/quotations/${id}`)}
                 className="flex items-center gap-2 px-6 py-2 bg-card border border-border text-foreground hover:bg-muted rounded-xl text-xs font-bold transition-colors"
               >
                 <Edit size={16} /> Edit Quotation
               </button>
             </div>
           ) : (
             <button 
               onClick={handleSave}
               disabled={isSaving}
               className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
             >
               <Save size={16} /> {isSaving ? 'Saving...' : 'Save Draft'}
             </button>
           )}
        </div>
      </div>

      <div className={`flex flex-col ${viewMode ? 'items-center' : 'lg:flex-row'} gap-8 print:block`}>
        
        {/* LEFT: FORM BUILDER (Hidden in Print and View Mode) */}
        {!viewMode && (
          <div className="w-full lg:w-[48%] space-y-6 print:hidden">
          
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl space-y-6">
             <div className="grid grid-cols-2 gap-4 border-b border-border pb-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Recipient *</label>
                  <select 
                    value={formData.client_id ? `client:${formData.client_id}` : (formData.lead_id ? `lead:${formData.lead_id}` : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.startsWith('client:')) {
                        setFormData({...formData, client_id: val.replace('client:', ''), lead_id: null, job_id: ''});
                      } else if (val.startsWith('lead:')) {
                        setFormData({...formData, lead_id: val.replace('lead:', ''), client_id: null, job_id: ''});
                      } else {
                        setFormData({...formData, client_id: null, lead_id: null, job_id: ''});
                      }
                    }}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                  >
                    <option value="">-- Choose Client or Lead --</option>
                    <optgroup label="Active Clients">
                      {activeClients.map(c => (
                        <option key={c.id} value={`client:${c.id}`}>{c.full_name} ({c.company_name || 'Individual'})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Active Leads">
                      {leads?.filter(l => l.status !== 'converted' && l.status !== 'lost').map(l => (
                        <option key={l.id} value={`lead:${l.id}`}>{l.contact_name} ({l.company_name || 'Individual Lead'})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                
                {formData.client_id && (
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Link to Client File / Job (Optional)</label>
                    <select 
                      value={formData.job_id || ''}
                      onChange={e => setFormData({...formData, job_id: e.target.value})}
                      className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                    >
                      <option value="">-- Select Parent File --</option>
                      {clientJobs.map(j => (
                        <option key={j.id} value={j.id}>{j.job_code} - {j.service_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

             {/* Recipient Details Sync Preview */}
             {(formData.client || formData.lead) && (
               <div className="bg-muted/10 border border-border/60 rounded-xl p-4 space-y-3">
                 <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Recipient Details</h3>
                 {formData.client ? (
                   <div className="text-xs text-muted-foreground space-y-1">
                     <p>Name: <span className="text-foreground font-semibold">{formData.client.full_name}</span></p>
                     <p>Phone: <span className="text-foreground">{formData.client.phone || 'N/A'}</span></p>
                     <p>Email: <span className="text-foreground">{formData.client.email || 'N/A'}</span></p>
                   </div>
                 ) : formData.lead ? (
                   <div className="space-y-3">
                     <div className="text-xs text-muted-foreground space-y-1">
                       <p>Lead Name: <span className="text-foreground font-semibold">{formData.lead.contact_name}</span></p>
                       <p>Company: <span className="text-foreground">{formData.lead.company_name || 'Individual'}</span></p>
                     </div>
                     <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
                       <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Contact Phone</label>
                         <input 
                           type="text" 
                           value={formData.lead.contact_phone || ''}
                           onChange={e => setFormData({
                             ...formData,
                             lead: { ...formData.lead!, contact_phone: e.target.value }
                           })}
                           className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all"
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Contact Email</label>
                         <input 
                           type="text" 
                           value={formData.lead.contact_email || ''}
                           onChange={e => setFormData({
                             ...formData,
                             lead: { ...formData.lead!, contact_email: e.target.value }
                           })}
                           className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all"
                         />
                       </div>
                     </div>
                   </div>
                 ) : null}
               </div>
             )}

             {/* Quotation Configuration Toggles */}
             <div className="bg-muted/15 border border-border/60 rounded-xl p-4 space-y-3">
               <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                 <Sliders size={14} className="text-primary" /> Document Settings & Toggles
               </h3>
               <div className="grid grid-cols-2 gap-3 pt-1">
                 {/* Show Quantity Toggle */}
                 <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/30 cursor-pointer transition-all">
                   <input 
                     type="checkbox"
                     checked={!!formData.metadata?.showQuantity}
                     onChange={e => setFormData({
                       ...formData,
                       metadata: { ...formData.metadata, showQuantity: e.target.checked }
                     })}
                     className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                   />
                   <div>
                     <span className="text-xs font-bold text-foreground block">Show Quantity</span>
                     <span className="text-[9px] text-muted-foreground block">Display Qty column on quote</span>
                   </div>
                 </label>

                 {/* Include KYC Photo Proof Toggle */}
                 <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/30 cursor-pointer transition-all">
                   <input 
                     type="checkbox"
                     checked={!!formData.metadata?.showKycProof}
                     onChange={e => {
                       const checked = e.target.checked;
                       let docs = currentDocsList;
                       if (checked) {
                         if (!docs.includes('SELFIE WITH PASSPORT')) docs.push('SELFIE WITH PASSPORT');
                         if (!docs.includes('PASSPORT SIZE PHOTO')) docs.push('PASSPORT SIZE PHOTO');
                       }
                       setFormData({
                         ...formData,
                         metadata: { ...formData.metadata, showKycProof: checked, documents: docs }
                       });
                     }}
                     className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                   />
                   <div>
                     <span className="text-xs font-bold text-foreground block">KYC Photo Proof</span>
                     <span className="text-[9px] text-muted-foreground block">Include selfie guide on Page 2</span>
                   </div>
                 </label>
               </div>
             </div>

              {/* Line Items */}
              <div className="space-y-4 border-t border-border pt-6">
                 <div className="flex justify-between items-center">
                   <div>
                     <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Service Fee Items</h3>
                     <p className="text-[9px] text-muted-foreground">Auto-calculated: (Gov Fee + Service Fee) × Quantity</p>
                   </div>
                   <button 
                     onClick={addItem}
                     className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/20 text-primary text-xs font-bold hover:bg-primary/5 transition-all"
                   >
                     <Plus size={14} /> Add Line Item
                   </button>
                 </div>

                <div className="space-y-3">
                  {(formData.items || []).map((item: any, idx) => {
                    const matchedService = allServices?.find(
                      s => s.name_en.toLowerCase() === item.description?.toLowerCase() ||
                           s.name_ar === item.description
                    );
                    const dbMinFee = matchedService?.ministry_fee ?? 0;
                    const curMinFee = item.ministry_fee !== undefined ? item.ministry_fee : dbMinFee;
                    const rawSrvFee = item.service_fee !== undefined ? item.service_fee : (item.unit_price - curMinFee);
                    const curSrvFee = Math.max(0, rawSrvFee);
                    const curUnitPrice = curMinFee + curSrvFee;
                    const curQty = Math.max(1, parseInt(item.quantity) || 1);
                    const curTotal = curQty * curUnitPrice;

                    return (
                      <div key={idx} className="bg-muted/10 p-4 rounded-xl border border-border/40 space-y-3">
                        <div className="flex gap-3 items-end">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Service Description</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Visa Issuance Fee"
                              value={item.description}
                              onChange={e => handleItemChange(idx, 'description', e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                            />
                          </div>
                          <div className="w-20 space-y-1.5 shrink-0">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block text-center">Qty</label>
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity || 1}
                              onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:border-primary outline-none transition-all text-center font-bold font-mono"
                            />
                          </div>
                          
                          {formData.items!.length > 1 && (
                            <button 
                              onClick={() => removeItem(idx)}
                              className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shrink-0 mb-0.5"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-border/30 pt-3">
                          <div>
                            <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Gov Fee (OMR)</label>
                            <input 
                              type="number" 
                              min="0"
                              step="0.001"
                              value={curMinFee}
                              onChange={e => handleItemChange(idx, 'ministry_fee', e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Service Fee (OMR)</label>
                            <input 
                              type="number" 
                              min="0"
                              step="0.001"
                              value={curSrvFee}
                              onChange={e => handleItemChange(idx, 'service_fee', e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all font-mono"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                              Total ({curQty > 1 ? `${curQty}×` : ''}OMR {curUnitPrice.toFixed(3)})
                            </span>
                            <div className="h-[34px] flex items-center px-3 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary font-mono">
                              OMR {curTotal.toFixed(3)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>

             {/* Discount & Tax */}
             <div className="space-y-4 border-t border-border pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Discount (OMR)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.001"
                      value={formData.discount_amount}
                      onChange={e => setFormData({...formData, discount_amount: parseFloat(e.target.value) || 0})}
                      className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
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
                      className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* INTERACTIVE DOCUMENTS REQUIRED SECTION */}
                <div className="space-y-4 border-t border-border pt-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <FileText size={16} className="text-primary"/>
                       <h3 className="text-sm font-bold text-foreground">Documents Required</h3>
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => setDocumentsTab(documentsTab === 'checklist' ? 'raw' : 'checklist')}
                         className="text-[10px] font-bold text-primary hover:underline"
                       >
                         {documentsTab === 'checklist' ? 'Edit Raw Text' : 'Checklist View'}
                       </button>
                     </div>
                   </div>

                   {documentsTab === 'checklist' ? (
                     <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/40">
                       <div className="flex justify-between items-center pb-2 border-b border-border/40">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                           Selected ({currentDocsList.length} items)
                         </span>
                         <div className="flex gap-2">
                           <button
                             type="button"
                             onClick={selectAllDocuments}
                             className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-background border border-border/50"
                           >
                             Select All
                           </button>
                           <button
                             type="button"
                             onClick={clearAllDocuments}
                             className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-background border border-border/50"
                           >
                             Clear All
                           </button>
                         </div>
                       </div>

                       <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                         {STANDARD_DOCUMENT_ITEMS.map((doc, idx) => {
                           const isChecked = currentDocsList.includes(doc);
                           return (
                             <label 
                               key={idx} 
                               className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                 isChecked 
                                   ? 'bg-primary/5 border-primary/30 text-foreground font-medium' 
                                   : 'bg-background/40 border-border/40 text-muted-foreground hover:bg-muted/30'
                               }`}
                             >
                               <input 
                                 type="checkbox"
                                 checked={isChecked}
                                 onChange={() => toggleDocument(doc)}
                                 className="w-3.5 h-3.5 mt-0.5 rounded text-primary border-border focus:ring-primary shrink-0"
                               />
                               <span className="leading-tight text-[11px]">{doc}</span>
                             </label>
                           );
                         })}

                         {/* Custom added documents */}
                         {currentDocsList.filter(d => !STANDARD_DOCUMENT_ITEMS.includes(d)).map((customDoc, idx) => (
                           <div key={`custom-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/30 text-xs">
                             <div className="flex items-center gap-2">
                               <CheckSquare size={14} className="text-primary shrink-0" />
                               <span className="font-medium text-[11px] text-foreground">{customDoc}</span>
                             </div>
                             <button
                               type="button"
                               onClick={() => toggleDocument(customDoc)}
                               className="text-muted-foreground hover:text-destructive p-1"
                             >
                               <Trash2 size={12} />
                             </button>
                           </div>
                         ))}
                       </div>

                       {/* Add custom document input */}
                       <div className="flex gap-2 pt-2 border-t border-border/40">
                         <input 
                           type="text"
                           placeholder="Add custom required document..."
                           value={customDocName}
                           onChange={e => setCustomDocName(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomDocument(); } }}
                           className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none"
                         />
                         <button
                           type="button"
                           onClick={addCustomDocument}
                           className="px-3 py-1.5 bg-card border border-border hover:bg-muted text-foreground text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                         >
                           <Plus size={14} /> Add
                         </button>
                       </div>
                     </div>
                   ) : (
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Documents Required (One per line)</label>
                       <textarea 
                         rows={6}
                         value={typeof formData.metadata?.documents === 'string' ? formData.metadata.documents : (formData.metadata?.documents?.join('\n') || '')}
                         onChange={e => setFormData({...formData, metadata: { ...formData.metadata, documents: e.target.value }})}
                         className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                       />
                     </div>
                   )}
                </div>

                {/* INTERACTIVE TIMELINE SECTION */}
                <div className="space-y-4 border-t border-border pt-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Calendar size={16} className="text-primary"/>
                       <h3 className="text-sm font-bold text-foreground">Processing Timeline</h3>
                     </div>
                     <div className="flex items-center gap-3">
                       <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-muted-foreground">
                         <input 
                           type="checkbox"
                           checked={formData.metadata?.showTimeline !== false}
                           onChange={e => setFormData({
                             ...formData,
                             metadata: { ...formData.metadata, showTimeline: e.target.checked }
                           })}
                           className="w-3.5 h-3.5 rounded text-primary border-border focus:ring-primary"
                         />
                         <span>Include</span>
                       </label>
                       <button
                         type="button"
                         onClick={() => setTimelineTab(timelineTab === 'checklist' ? 'raw' : 'checklist')}
                         className="text-[10px] font-bold text-primary hover:underline"
                       >
                         {timelineTab === 'checklist' ? 'Edit Raw Text' : 'Checklist View'}
                       </button>
                     </div>
                   </div>

                   {formData.metadata?.showTimeline !== false && (
                     timelineTab === 'checklist' ? (
                       <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/40">
                         <div className="flex justify-between items-center pb-2 border-b border-border/40">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                             Selected Timeline Steps ({currentTimelineList.length})
                           </span>
                           <div className="flex gap-2">
                             <button
                               type="button"
                               onClick={selectAllTimeline}
                               className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-background border border-border/50"
                             >
                               Select All
                             </button>
                             <button
                               type="button"
                               onClick={clearAllTimeline}
                               className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-background border border-border/50"
                             >
                               Clear All (Select only needed)
                             </button>
                           </div>
                         </div>

                         <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                           {STANDARD_TIMELINE_ITEMS.map((item, idx) => {
                             const matched = currentTimelineList.find(t => t.task === item.task);
                             const isChecked = !!matched;
                             return (
                               <div 
                                 key={idx} 
                                 className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs transition-all ${
                                   isChecked 
                                     ? 'bg-primary/5 border-primary/30 text-foreground' 
                                     : 'bg-background/40 border-border/40 text-muted-foreground'
                                 }`}
                               >
                                 <label className="flex items-center gap-2 cursor-pointer flex-1">
                                   <input 
                                     type="checkbox"
                                     checked={isChecked}
                                     onChange={() => toggleTimelineStep(item.task, item.days)}
                                     className="w-3.5 h-3.5 rounded text-primary border-border focus:ring-primary"
                                   />
                                   <span className={`text-[11px] ${isChecked ? 'font-bold text-foreground' : ''}`}>{item.task}</span>
                                 </label>
                                 
                                 {isChecked && (
                                   <input 
                                     type="text"
                                     value={matched.days}
                                     onChange={e => updateTimelineStepDays(item.task, e.target.value)}
                                     className="w-40 bg-background border border-border/60 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                                     placeholder="e.g. 1-2 Working Days"
                                   />
                                 )}
                               </div>
                             );
                           })}

                           {/* Custom timeline steps */}
                           {currentTimelineList.filter(t => !STANDARD_TIMELINE_ITEMS.some(s => s.task === t.task)).map((customStep, idx) => (
                             <div key={`custom-timeline-${idx}`} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-primary/5 border border-primary/30 text-xs">
                               <div className="flex items-center gap-2 flex-1">
                                 <CheckSquare size={14} className="text-primary shrink-0" />
                                 <span className="font-bold text-[11px] text-foreground">{customStep.task}</span>
                               </div>
                               <input 
                                 type="text"
                                 value={customStep.days}
                                 onChange={e => updateTimelineStepDays(customStep.task, e.target.value)}
                                 className="w-40 bg-background border border-border/60 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                               />
                               <button
                                 type="button"
                                 onClick={() => toggleTimelineStep(customStep.task, '')}
                                 className="text-muted-foreground hover:text-destructive p-1"
                               >
                                 <Trash2 size={12} />
                               </button>
                             </div>
                           ))}
                         </div>

                         {/* Add custom timeline step */}
                         <div className="grid grid-cols-12 gap-2 pt-2 border-t border-border/40">
                           <input 
                             type="text"
                             placeholder="Step Name (e.g. Special Clearance)..."
                             value={customTaskName}
                             onChange={e => setCustomTaskName(e.target.value)}
                             className="col-span-6 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none"
                           />
                           <input 
                             type="text"
                             placeholder="Days (e.g. 2-3 Working Days)..."
                             value={customTaskDays}
                             onChange={e => setCustomTaskDays(e.target.value)}
                             className="col-span-4 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none font-mono"
                           />
                           <button
                             type="button"
                             onClick={addCustomTimelineStep}
                             className="col-span-2 px-2 py-1.5 bg-card border border-border hover:bg-muted text-foreground text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                           >
                             <Plus size={14} /> Add
                           </button>
                         </div>
                       </div>
                     ) : (
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Timeline (Format: Task:Days - One per line)</label>
                         <textarea 
                           rows={6}
                           value={typeof formData.metadata?.timeline === 'string' ? formData.metadata.timeline : (formData.metadata?.timeline?.map((t: any) => `${t.task}:${t.days}`).join('\n') || '')}
                           onChange={e => setFormData({...formData, metadata: { ...formData.metadata, timeline: e.target.value }})}
                           className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                         />
                       </div>
                     )
                   )}
                </div>

                 {/* Payment Schedule Selector */}
                 <div className="space-y-4 border-t border-border pt-6">
                   <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                     <CreditCard size={16}/> Payment Schedule
                   </h3>
                   
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment Schedule Mode</label>
                     <select
                       value={formData.metadata?.paymentScheduleType || '50_50'}
                       onChange={e => {
                         const val = e.target.value;
                         let adv = 50;
                         let bal = 50;
                         let advM = 'Upon signing the quotation';
                         let balM = 'Upon completion of Visa';
                         
                         if (val === 'full_advance') {
                           adv = 100;
                           bal = 0;
                         } else if (val === '50_50') {
                           adv = 50;
                           bal = 50;
                         } else { // custom
                           adv = formData.metadata?.advancePercentage !== undefined ? formData.metadata.advancePercentage : 50;
                           bal = formData.metadata?.balancePercentage !== undefined ? formData.metadata.balancePercentage : 50;
                           advM = formData.metadata?.advanceMilestone || 'Upon signing the quotation';
                           balM = formData.metadata?.balanceMilestone || 'Upon completion of Visa';
                         }

                         setFormData({
                           ...formData,
                           metadata: {
                             ...formData.metadata,
                             paymentScheduleType: val,
                             advancePercentage: adv,
                             balancePercentage: bal,
                             advanceMilestone: advM,
                             balanceMilestone: balM
                           }
                         });
                       }}
                       className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                     >
                       <option value="50_50">50/50 Split (Default)</option>
                       <option value="full_advance">100% Advance Payment</option>
                       <option value="custom">Custom Split & Milestones</option>
                     </select>
                   </div>

                   {/* Show percentage configurations for custom mode */}
                   {(formData.metadata?.paymentScheduleType === 'custom') && (
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Advance %</label>
                         <input
                           type="number"
                           min="0"
                           max="100"
                           value={formData.metadata?.advancePercentage !== undefined ? formData.metadata.advancePercentage : 50}
                           onChange={e => {
                             const adv = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                             const bal = 100 - adv;
                             setFormData({
                               ...formData,
                               metadata: {
                                 ...formData.metadata,
                                 advancePercentage: adv,
                                 balancePercentage: bal
                               }
                             });
                           }}
                           className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Balance %</label>
                         <input
                           type="number"
                           min="0"
                           max="100"
                           value={formData.metadata?.balancePercentage !== undefined ? formData.metadata.balancePercentage : 50}
                           onChange={e => {
                             const bal = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                             const adv = 100 - bal;
                             setFormData({
                               ...formData,
                               metadata: {
                                 ...formData.metadata,
                                 advancePercentage: adv,
                                 balancePercentage: bal
                               }
                             });
                           }}
                           className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                         />
                       </div>
                     </div>
                   )}

                   {/* Milestone description fields */}
                   {(formData.metadata?.paymentScheduleType === 'custom' || formData.metadata?.paymentScheduleType === 'full_advance') && (
                     <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/40">
                       <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Advance Milestone</label>
                         <input 
                           type="text"
                           value={formData.metadata?.advanceMilestone || 'Upon signing the quotation'}
                           onChange={e => setFormData({
                             ...formData,
                             metadata: {
                               ...formData.metadata,
                               advanceMilestone: e.target.value
                             }
                           })}
                           className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all"
                         />
                       </div>
                       {(formData.metadata?.paymentScheduleType === 'custom') && (
                         <div className="space-y-1">
                           <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Balance Milestone</label>
                           <input 
                             type="text"
                             value={formData.metadata?.balanceMilestone || 'Upon completion of Visa'}
                             onChange={e => setFormData({
                               ...formData,
                               metadata: {
                                 ...formData.metadata,
                                 balanceMilestone: e.target.value
                               }
                             })}
                             className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary outline-none transition-all"
                           />
                         </div>
                       )}
                     </div>
                   )}
                 </div>

                <div className="space-y-2 border-t border-border pt-6">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Remarks / Notes</label>
                  <input 
                    type="text" 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                  />
                </div>
             </div>

          </div>
        </div>
        )}

        {/* RIGHT: DOCUMENT PREVIEW (Visible in Print) */}
        <div className={viewMode ? "w-full max-w-[210mm] mx-auto print:w-full print:block print:static" : "w-full lg:w-[52%] print:w-full print:block print:static"}>
           {/* Mode Selector (Hidden in Print) */}
           <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card border border-border rounded-[2rem] mb-6 print:hidden items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold text-foreground">Quotation Presentation Mode</span>
                <p className="text-[9px] text-muted-foreground mt-0.5">Toggle between detailed itemized prices and flat package summary</p>
              </div>
              <div className="flex bg-muted/40 p-1 border border-border rounded-xl">
                 <button
                   onClick={() => setQuotationMode('detailed')}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     quotationMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                   }`}
                 >
                   Detailed
                 </button>
                 <button
                   onClick={() => setQuotationMode('simple')}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     quotationMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                   }`}
                 >
                   Simple Summary
                 </button>
              </div>
           </div>

           <div className="sticky top-8 rounded-2xl overflow-hidden border border-border shadow-2xl print:shadow-none print:border-none print:overflow-visible print:static">
              <style>{`
                @media print {
                  @page { margin: 0mm !important; size: A4 portrait; }
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
                <QuotationDocument 
                  invoice={{
                    ...formData,
                    client: clients?.find(c => c.id === formData.client_id),
                    lead: leads?.find(l => l.id === formData.lead_id),
                    job: jobs?.find(j => j.id === formData.job_id),
                    metadata: { 
                      ...formData.metadata, 
                      isSimple: quotationMode === 'simple'
                    }
                  }} 
                  isSimple={quotationMode === 'simple'}
                />
              </div>
           </div>
        </div>

      </div>

      <AnimatePresence>
        {isAcceptWizardOpen && (
          <QuotationAcceptWizard 
            isOpen={isAcceptWizardOpen}
            onClose={() => setIsAcceptWizardOpen(false)}
            quotation={{
              ...formData,
              client: clients?.find(c => c.id === formData.client_id),
              lead: leads?.find(l => l.id === formData.lead_id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuotationBuilder;
