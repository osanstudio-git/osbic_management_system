import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, Save, Plus, Trash2, FileText, Printer, Edit, 
  CheckCircle2, CreditCard, CheckSquare, Square, Calendar, 
  Camera, Layers, Settings2, Sliders, UserCheck, User, 
  Building2, Building, Check, Loader2, RotateCcw, WifiOff, CloudCheck, AlertCircle 
} from 'lucide-react';
import { useInvoice, useSaveInvoice, type Invoice, type InvoiceItem } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminClients, useEmployeeClients } from '../../hooks/admin/useAdminClients';
import { useAdminJobs, useEmployeeJobs } from '../../hooks/shared/useJobs';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
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
  const { data: employees } = useAdminEmployees();

  const printRef = useRef<HTMLDivElement>(null);
  const [isAcceptWizardOpen, setIsAcceptWizardOpen] = useState(false);
  const [quotationMode, setQuotationMode] = useState<'detailed' | 'simple'>('detailed');

  // Interactive Checklist states
  const [timelineTab, setTimelineTab] = useState<'checklist' | 'raw'>('checklist');
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskDays, setCustomTaskDays] = useState('1-2 Working Days');

  const [documentsTab, setDocumentsTab] = useState<'checklist' | 'raw'>('checklist');
  const [customDocName, setCustomDocName] = useState('');

  // Auto-Save & Draft Persistence states
  type AutoSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'offline';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [restoredDraftInfo, setRestoredDraftInfo] = useState<{ savedAt: string } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Concurrency Mutex & Timers
  const isSavingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  const draftStorageKey = `quotation_draft_${isNew ? 'new' : id}`;

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
      recipient_name: '',
      company_name: '',
      recipient_phone: '',
      recipient_display_mode: 'contact',
      custom_recipient: '',
      prepared_by: profile?.full_name || '',
      prepared_by_employee_id: profile?.id || '',
      documents: DEFAULT_QUOTATION_DOCUMENTS,
      timeline: DEFAULT_QUOTATION_TIMELINE,
      showQuantity: false,
      showTimeline: true,
      showDocuments: true,
      showKycProof: false
    }
  });

  // Track network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSaveStatus === 'offline') setAutoSaveStatus('unsaved');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setAutoSaveStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSaveStatus]);

  // Handle Initial Data Loading & Draft Recovery
  useEffect(() => {
    if (initialData && !isNew) {
      const initCompanyName = initialData.metadata?.company_name || initialData.client?.company_name || initialData.lead?.company_name || '';
      const initContactName = initialData.metadata?.recipient_name || initialData.client?.full_name || initialData.lead?.contact_name || '';
      const initPhone = initialData.metadata?.recipient_phone || initialData.client?.phone || initialData.lead?.contact_phone || '';
      const initDisplayMode = initialData.metadata?.recipient_display_mode || (initCompanyName ? 'both' : 'contact');

      const formattedInitial: Invoice = {
        ...initialData,
        metadata: {
          ...initialData.metadata,
          recipient_name: initContactName || initialData.metadata?.recipient_name || '',
          company_name: initCompanyName || initialData.metadata?.company_name || '',
          recipient_phone: initPhone || initialData.metadata?.recipient_phone || '',
          recipient_display_mode: initDisplayMode,
          prepared_by: initialData.metadata?.prepared_by || initialData.employee?.full_name || profile?.full_name || '',
          prepared_by_employee_id: initialData.metadata?.prepared_by_employee_id || initialData.employee_id || profile?.id || ''
        }
      };

      // Check for unsaved local draft that is newer than database
      const cachedDraftStr = localStorage.getItem(draftStorageKey);
      if (cachedDraftStr && !viewMode) {
        try {
          const cached = JSON.parse(cachedDraftStr);
          if (cached && cached.data) {
            setFormData(cached.data);
            setRestoredDraftInfo({ savedAt: cached.savedAt });
            setAutoSaveStatus('unsaved');
            hasInitializedRef.current = true;
            return;
          }
        } catch (e) {
          console.warn('Error reading cached draft', e);
        }
      }

      setFormData(formattedInitial);
      if (initialData.metadata?.isSimple) {
        setQuotationMode('simple');
      } else {
        setQuotationMode('detailed');
      }
      hasInitializedRef.current = true;
    } else if (isNew) {
      // Check for URL query params: if a specific lead, client, or job is requested, do not restore mismatched draft
      const params = new URLSearchParams(window.location.search);
      const urlLeadId = params.get('lead_id');
      const urlClientId = params.get('client_id');
      const urlJobId = params.get('job_id');

      const cachedDraftStr = localStorage.getItem(draftStorageKey);
      if (cachedDraftStr && !viewMode && !urlLeadId && !urlClientId && !urlJobId) {
        try {
          const cached = JSON.parse(cachedDraftStr);
          if (cached && cached.data && (cached.data.client_id || cached.data.lead_id || (cached.data.items && cached.data.items.length > 0))) {
            setFormData(cached.data);
            setRestoredDraftInfo({ savedAt: cached.savedAt });
            setAutoSaveStatus('unsaved');
            hasInitializedRef.current = true;
            return;
          }
        } catch (e) {
          console.warn('Error reading new cached draft', e);
        }
      }
      hasInitializedRef.current = true;
    }
  }, [initialData, isNew, profile, draftStorageKey, viewMode]);

  // Sync profile full_name if new quotation and not yet set
  useEffect(() => {
    if (isNew && profile?.full_name && !formData.metadata?.prepared_by) {
      setFormData(prev => ({
        ...prev,
        employee_id: prev.employee_id || profile.id,
        metadata: {
          ...prev.metadata,
          prepared_by: profile.full_name,
          prepared_by_employee_id: profile.id
        }
      }));
    }
  }, [isNew, profile?.full_name, profile?.id]);

  // Handle Lead ID autofill from URL params & selection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetLeadId = (isNew ? params.get('lead_id') : null) || formData.lead_id;

    if (targetLeadId) {
      const loadLeadAndServices = async () => {
        let leadObj = leads?.find(l => l.id === targetLeadId);
        if (!leadObj) {
          const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('id', targetLeadId)
            .maybeSingle();
          leadObj = data as any;
        }

        if (!leadObj) return;

        const isSwitchingLead = formData.lead_id !== targetLeadId || formData.lead?.id !== leadObj.id;
        const hasNoRealItems = !formData.items || formData.items.length === 0 ||
          (formData.items.length === 1 && !formData.items[0].description);

        if ((hasNoRealItems || isSwitchingLead) && leadObj.interested_services && leadObj.interested_services.length > 0) {
          let finalItems: InvoiceItem[] = [];
          let activityName = leadObj.company_name || 'BUSINESS SETUP';

          for (const item of leadObj.interested_services) {
            if (item.type === 'package') {
              activityName = item.name || activityName;

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
                finalItems.push({
                  description: item.name,
                  quantity: 1,
                  unit_price: item.price || 0,
                  total: item.price || 0
                });
              }
            } else {
              finalItems.push({
                description: item.name || item.name_en || 'Service',
                quantity: 1,
                unit_price: item.price || 0,
                total: item.price || 0
              });
            }
          }

          if (finalItems.length === 0) {
            finalItems = [{ description: '', quantity: 1, unit_price: 0, total: 0 }];
          }

          const calculatedTotal = finalItems.reduce((sum, item) => sum + (item.total || 0), 0);

          setFormData(prev => ({
            ...prev,
            lead_id: targetLeadId,
            lead: leadObj,
            client_id: null,
            client: null,
            items: finalItems,
            subtotal: calculatedTotal,
            total_amount: calculatedTotal,
            notes: prev.notes === 'BUSINESS SETUP' || !prev.notes || isSwitchingLead ? activityName : prev.notes,
            metadata: {
              ...prev.metadata,
              recipient_name: leadObj.contact_name || '',
              company_name: leadObj.company_name || '',
              recipient_phone: leadObj.contact_phone || '',
              recipient_display_mode: leadObj.company_name ? 'both' : 'contact',
              documents: prev.metadata?.documents || DEFAULT_QUOTATION_DOCUMENTS,
              timeline: prev.metadata?.timeline || DEFAULT_QUOTATION_TIMELINE,
              showQuantity: prev.metadata?.showQuantity ?? false,
              showTimeline: prev.metadata?.showTimeline ?? true,
              showDocuments: prev.metadata?.showDocuments ?? true,
              showKycProof: prev.metadata?.showKycProof ?? false
            }
          }));
        } else {
          setFormData(prev => {
            if (prev.lead?.id === leadObj.id && prev.lead_id === targetLeadId && prev.metadata?.recipient_name === leadObj.contact_name) return prev;
            return {
              ...prev,
              lead_id: targetLeadId,
              lead: leadObj,
              client_id: null,
              client: null,
              metadata: {
                ...prev.metadata,
                recipient_name: leadObj.contact_name || '',
                company_name: leadObj.company_name || '',
                recipient_phone: leadObj.contact_phone || '',
                recipient_display_mode: leadObj.company_name ? 'both' : 'contact',
              }
            };
          });
        }
      };

      loadLeadAndServices();
    }
  }, [isNew, formData.lead_id, leads]);

  // Sync selected client details into formData for the document preview
  useEffect(() => {
    if (formData.client_id) {
      const selectedClient = clients?.find(c => c.id === formData.client_id);
      if (selectedClient && formData.client?.id !== selectedClient.id) {
        setFormData(prev => ({
          ...prev,
          client: selectedClient,
          lead: null,
          lead_id: null,
          metadata: {
            ...prev.metadata,
            recipient_name: selectedClient.full_name || '',
            company_name: selectedClient.company_name || '',
            recipient_phone: selectedClient.phone || '',
            recipient_display_mode: selectedClient.company_name ? 'both' : 'contact'
          }
        }));
      }
    }
  }, [formData.client_id, clients]);

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
      const qty = Math.max(1, parseInt(String(item.quantity), 10) || 1);
      const dbMinFee = matchedService?.ministry_fee ?? 0;
      const curMinFee = item.ministry_fee !== undefined ? item.ministry_fee : dbMinFee;

      let rawSrvFee = 0;
      if (item.service_fee !== undefined && item.service_fee !== null) {
        rawSrvFee = Number(item.service_fee) || 0;
      } else if (item.unit_price !== undefined && item.unit_price !== null) {
        const rawUnit = Number(item.unit_price) || 0;
        const singleUnitPrice = (item.total && Math.abs(Number(item.total) - rawUnit) < 0.001 && qty > 1)
          ? rawUnit / qty
          : rawUnit;
        rawSrvFee = Math.max(0, singleUnitPrice - curMinFee);
      }
      const curSrvFee = Math.max(0, Math.round(rawSrvFee * 1000) / 1000);

      const calculatedUnitPrice = Math.round((Number(curMinFee) + curSrvFee) * 1000) / 1000;
      const calculatedTotal = Math.round((qty * calculatedUnitPrice) * 1000) / 1000;

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
    const qty = Math.max(1, parseInt(String(targetItem.quantity), 10) || 1);
    const dbMinFee = matchedService?.ministry_fee ?? 0;
    const curMinFee = targetItem.ministry_fee !== undefined ? targetItem.ministry_fee : dbMinFee;

    let rawSrvFee = 0;
    if (targetItem.service_fee !== undefined && targetItem.service_fee !== null) {
      rawSrvFee = Number(targetItem.service_fee) || 0;
    } else if (targetItem.unit_price !== undefined && targetItem.unit_price !== null) {
      const rawUnit = Number(targetItem.unit_price) || 0;
      const singleUnitPrice = (targetItem.total && Math.abs(Number(targetItem.total) - rawUnit) < 0.001 && qty > 1)
        ? rawUnit / qty
        : rawUnit;
      rawSrvFee = Math.max(0, singleUnitPrice - curMinFee);
    }
    const curSrvFee = Math.max(0, Math.round(rawSrvFee * 1000) / 1000);

    targetItem.ministry_fee = Math.round(Number(curMinFee || 0) * 1000) / 1000;
    targetItem.service_fee = curSrvFee;
    targetItem.unit_price = Math.round((Number(targetItem.ministry_fee) + curSrvFee) * 1000) / 1000;
    targetItem.total = Math.round((qty * targetItem.unit_price) * 1000) / 1000;

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

  // Auto-Save Effect (Local Storage Cache + Debounced Cloud Sync for Existing Quotations)
  useEffect(() => {
    if (!hasInitializedRef.current || viewMode) return;

    // 1. Immediately cache to local storage (0ms latency, works offline)
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        data: formData,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('LocalStorage draft cache failed', e);
    }

    if (!isOnline) {
      setAutoSaveStatus('offline');
      return;
    }

    // 2. Debounced background save to Supabase for existing quotations
    if (!isNew && formData.id) {
      setAutoSaveStatus('unsaved');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        if (isSavingRef.current) return;
        if (!formData.client_id && !formData.lead_id) return;
        if (!formData.items || formData.items.length === 0 || formData.items.some(i => !i.description)) return;

        isSavingRef.current = true;
        setAutoSaveStatus('saving');

        try {
          const quotationPayload: Invoice = {
            ...formData,
            type: 'quotation',
            employee_id: formData.metadata?.prepared_by_employee_id || formData.employee_id || profile?.id,
            metadata: {
              ...formData.metadata,
              prepared_by: formData.metadata?.prepared_by || profile?.full_name || 'OSBIC TEAM',
              prepared_by_employee_id: formData.metadata?.prepared_by_employee_id || formData.employee_id || profile?.id,
              isSimple: quotationMode === 'simple'
            }
          };

          await saveQuotation(quotationPayload);
          setAutoSaveStatus('saved');
          setLastSavedTime(new Date());
        } catch (err) {
          console.warn('Background auto-save failed', err);
          setAutoSaveStatus('unsaved');
        } finally {
          isSavingRef.current = false;
        }
      }, 2500);
    } else {
      setAutoSaveStatus('unsaved');
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [formData, isNew, viewMode, isOnline, draftStorageKey, profile, quotationMode, saveQuotation]);

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftStorageKey);
    setRestoredDraftInfo(null);
    if (isNew) {
      navigate('/employee/invoices?tab=quotations');
    } else if (initialData) {
      setFormData(initialData);
      setAutoSaveStatus('saved');
      toast.success('Restored last saved server version');
    }
  };

  const handleSave = async () => {
    // Prevent double clicking / concurrent duplicate insertions
    if (isSavingRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!formData.client_id && !formData.lead_id) {
      return toast.error('Please select a client or lead');
    }
    if (!formData.items || formData.items.length === 0 || formData.items.some(i => !i.description)) {
      return toast.error('Please complete all item descriptions');
    }

    isSavingRef.current = true;
    setAutoSaveStatus('saving');

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

      const quotationPayload: Invoice = {
        ...formData,
        type: 'quotation', // Force type to quotation
        employee_id: formData.metadata?.prepared_by_employee_id || formData.employee_id || profile?.id,
        metadata: {
          ...formData.metadata,
          prepared_by: formData.metadata?.prepared_by || profile?.full_name || 'OSBIC TEAM',
          prepared_by_employee_id: formData.metadata?.prepared_by_employee_id || formData.employee_id || profile?.id,
          isSimple: quotationMode === 'simple'
        }
      };

      const savedId = await saveQuotation(quotationPayload);

      // Lock new ID into local state immediately to prevent duplicate creation on next save
      setFormData(prev => ({ ...prev, id: savedId }));
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
      setRestoredDraftInfo(null);
      localStorage.removeItem(draftStorageKey);

      toast.success('Quotation saved successfully');
      if (isNew) {
        navigate(`/employee/quotations/${savedId}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save quotation');
      setAutoSaveStatus('unsaved');
    } finally {
      isSavingRef.current = false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/employee/invoices?tab=quotations')}
            className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {formData.invoice_number || 'DRAFT QUOTATION'}
              </p>
              {!viewMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/40 border border-border text-[10px] font-medium text-muted-foreground">
                  {autoSaveStatus === 'saving' && (
                    <>
                      <Loader2 size={11} className="animate-spin text-primary" />
                      <span>Saving draft...</span>
                    </>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <>
                      <CheckCircle2 size={11} className="text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">
                        All changes saved {lastSavedTime ? `(${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                      </span>
                    </>
                  )}
                  {autoSaveStatus === 'unsaved' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>Draft saved locally</span>
                    </>
                  )}
                  {autoSaveStatus === 'offline' && (
                    <>
                      <WifiOff size={11} className="text-amber-500" />
                      <span className="text-amber-500 font-semibold">Offline (Saved locally)</span>
                    </>
                  )}
                  {autoSaveStatus === 'idle' && (
                    <>
                      <Check size={11} className="text-muted-foreground" />
                      <span>Ready</span>
                    </>
                  )}
                </div>
              )}
            </div>
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
              disabled={isSaving || isSavingRef.current}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving || isSavingRef.current ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Quotation
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Restored Draft Banner */}
      {!viewMode && restoredDraftInfo && (
        <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <RotateCcw size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Auto-Restored Unsaved Draft</p>
              <p className="text-[11px] text-muted-foreground">
                Your previous progress has been preserved from {new Date(restoredDraftInfo.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
            >
              Discard Draft
            </button>
            <button
              type="button"
              onClick={() => setRestoredDraftInfo(null)}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all shadow-sm"
            >
              Continue Working
            </button>
          </div>
        </div>
      )}

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
                        const clientId = val.replace('client:', '');
                        const selectedClient = clients?.find(c => c.id === clientId);
                        setFormData({
                          ...formData,
                          client_id: clientId,
                          lead_id: null,
                          job_id: '',
                          client: selectedClient,
                          lead: null,
                          metadata: {
                            ...formData.metadata,
                            recipient_name: selectedClient?.full_name || '',
                            company_name: selectedClient?.company_name || '',
                            recipient_phone: selectedClient?.phone || '',
                            recipient_display_mode: selectedClient?.company_name ? 'both' : 'contact'
                          }
                        });
                      } else if (val.startsWith('lead:')) {
                        const leadId = val.replace('lead:', '');
                        const selectedLead = leads?.find(l => l.id === leadId);
                        setFormData({
                          ...formData,
                          lead_id: leadId,
                          client_id: null,
                          job_id: '',
                          lead: selectedLead,
                          client: null,
                          metadata: {
                            ...formData.metadata,
                            recipient_name: selectedLead?.contact_name || '',
                            company_name: selectedLead?.company_name || '',
                            recipient_phone: selectedLead?.contact_phone || '',
                            recipient_display_mode: selectedLead?.company_name ? 'both' : 'contact'
                          }
                        });
                      } else {
                        setFormData({
                          ...formData,
                          client_id: null,
                          lead_id: null,
                          job_id: '',
                          client: null,
                          lead: null
                        });
                      }
                    }}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all"
                  >
                    <option value="">-- Choose Client or Lead --</option>
                    <optgroup label="Active Clients">
                      {formData.client && !activeClients.some(c => c.id === formData.client.id) && (
                        <option value={`client:${formData.client.id}`}>{formData.client.full_name} ({formData.client.company_name || 'Individual'})</option>
                      )}
                      {activeClients.map(c => (
                        <option key={c.id} value={`client:${c.id}`}>{c.full_name} ({c.company_name || 'Individual'})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Active Leads">
                      {formData.lead && !leads?.some(l => l.id === formData.lead.id) && (
                        <option value={`lead:${formData.lead.id}`}>{formData.lead.contact_name} ({formData.lead.company_name || 'Individual Lead'})</option>
                      )}
                      {leads?.map(l => (
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
                      onChange={e => setFormData({ ...formData, job_id: e.target.value })}
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

              {/* Recipient & Company Header Settings */}
              {(formData.client || formData.lead || formData.client_id || formData.lead_id) && (
                <div className="bg-muted/15 border border-border/70 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-primary" />
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Recipient & Company Header
                      </h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Controls quotation header & PDF
                    </span>
                  </div>

                  {/* Display Mode Switcher */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                      Display on Quotation Header As
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, recipient_display_mode: 'both' }
                        })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all border ${(formData.metadata?.recipient_display_mode || (formData.metadata?.company_name || formData.client?.company_name || formData.lead?.company_name ? 'both' : 'contact')) === 'both'
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <span className="text-[11px] font-bold">🏢👤 Both</span>
                        <span className="text-[9px] opacity-80 font-normal">Company + Attn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, recipient_display_mode: 'company' }
                        })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all border ${formData.metadata?.recipient_display_mode === 'company'
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <span className="text-[11px] font-bold">🏢 Company</span>
                        <span className="text-[9px] opacity-80 font-normal">Company Name</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, recipient_display_mode: 'contact' }
                        })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all border ${formData.metadata?.recipient_display_mode === 'contact'
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <span className="text-[11px] font-bold">👤 Client</span>
                        <span className="text-[9px] opacity-80 font-normal">Contact Person</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, recipient_display_mode: 'custom' }
                        })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all border ${formData.metadata?.recipient_display_mode === 'custom'
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <span className="text-[11px] font-bold">✍️ Custom</span>
                        <span className="text-[9px] opacity-80 font-normal">Custom Title</span>
                      </button>
                    </div>
                  </div>

                  {/* Input Fields */}
                  {formData.metadata?.recipient_display_mode === 'custom' ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                        Custom Recipient / Company Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AL TASAMEEM INTERNATIONAL LLC (ATTN: MR. AHMAD)"
                        value={formData.metadata?.custom_recipient || ''}
                        onChange={e => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, custom_recipient: e.target.value }
                        })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                          Client / Contact Person
                        </label>
                        <input
                          type="text"
                          placeholder="Contact Person Name"
                          value={
                            formData.metadata?.recipient_name !== undefined
                              ? formData.metadata.recipient_name
                              : (formData.client?.full_name || formData.lead?.contact_name || '')
                          }
                          onChange={e => setFormData({
                            ...formData,
                            metadata: { ...formData.metadata, recipient_name: e.target.value }
                          })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                          Company Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Apex Global Solutions LLC"
                          value={
                            formData.metadata?.company_name !== undefined
                              ? formData.metadata.company_name
                              : (formData.client?.company_name || formData.lead?.company_name || '')
                          }
                          onChange={e => setFormData({
                            ...formData,
                            metadata: { ...formData.metadata, company_name: e.target.value }
                          })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Contact Phone & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +968 9123 4567"
                        value={
                          formData.metadata?.recipient_phone !== undefined
                            ? formData.metadata.recipient_phone
                            : (formData.client?.phone || formData.lead?.contact_phone || '')
                        }
                        onChange={e => setFormData({
                          ...formData,
                          metadata: { ...formData.metadata, recipient_phone: e.target.value }
                        })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. client@example.com"
                        value={formData.client?.email || formData.lead?.contact_email || ''}
                        disabled
                        className="w-full bg-card/60 border border-border/60 rounded-xl px-3 py-2 text-xs text-muted-foreground outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Header Details (Prepared By & Activity) */}
              <div className="bg-muted/15 border border-border/60 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <UserCheck size={14} className="text-primary" /> Header Details (Prepared By & Activity)
                  </h3>
                  {profile?.full_name && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          employee_id: profile.id,
                          metadata: {
                            ...prev.metadata,
                            prepared_by: profile.full_name,
                            prepared_by_employee_id: profile.id
                          }
                        }));
                        toast.success(`Prepared By set to ${profile.full_name}`);
                      }}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      Set to My Name ({profile.full_name.split(' ')[0]})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Select Employee dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                      Select Staff / Employee
                    </label>
                    <select
                      value={formData.metadata?.prepared_by_employee_id || formData.employee_id || ''}
                      onChange={e => {
                        const empId = e.target.value;
                        const chosenEmp = employees?.find(emp => emp.id === empId);
                        setFormData(prev => ({
                          ...prev,
                          employee_id: empId || prev.employee_id,
                          metadata: {
                            ...prev.metadata,
                            prepared_by: chosenEmp ? chosenEmp.full_name : (empId ? prev.metadata?.prepared_by : ''),
                            prepared_by_employee_id: empId
                          }
                        }));
                      }}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                    >
                      <option value="">-- Choose Employee (or type custom) --</option>
                      {employees?.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} {emp.role ? `(${emp.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom / Editable Prepared By Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                      Prepared By Name (Editable)
                    </label>
                    <input
                      type="text"
                      value={formData.metadata?.prepared_by ?? (profile?.full_name || '')}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          prepared_by: e.target.value
                        }
                      }))}
                      placeholder="e.g. NADIR NOORISHA"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-semibold focus:border-primary outline-none transition-all"
                    />
                  </div>

                  {/* Activity / Subject Title */}
                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                        Activity / Quotation Title
                      </label>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {['BUSINESS SETUP', 'COMPANY FORMATION', 'INVESTOR VISA', 'PRO SERVICES'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, notes: tag }))}
                            className={`text-[9px] px-2 py-0.5 rounded-md font-semibold transition-all border ${formData.notes?.toUpperCase() === tag
                              ? 'bg-primary/15 text-primary border-primary/30'
                              : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                              }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={formData.notes || ''}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. BUSINESS SETUP"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

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
                    const curMinFee = Math.round(Number(item.ministry_fee !== undefined ? item.ministry_fee : dbMinFee) * 1000) / 1000;
                    const rawSrvFee = item.service_fee !== undefined ? item.service_fee : (item.unit_price - curMinFee);
                    const curSrvFee = Math.max(0, Math.round(Number(rawSrvFee || 0) * 1000) / 1000);
                    const curUnitPrice = Math.round((curMinFee + curSrvFee) * 1000) / 1000;
                    const curQty = Math.max(1, parseInt(String(item.quantity), 10) || 1);
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
                      onChange={e => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
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
                      onChange={e => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* INTERACTIVE DOCUMENTS REQUIRED SECTION */}
                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-primary" />
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
                              className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${isChecked
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
                        onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, documents: e.target.value } })}
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* INTERACTIVE TIMELINE SECTION */}
                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-primary" />
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
                                className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs transition-all ${isChecked
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
                          onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, timeline: e.target.value } })}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none transition-all font-mono"
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Payment Schedule Selector */}
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CreditCard size={16} /> Payment Schedule
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
                        let balM = 'Upon approval of clearance';

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
                          balM = formData.metadata?.balanceMilestone || 'Upon approval of clearance';
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
                            value={formData.metadata?.balanceMilestone || 'Upon approval of clearance'}
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
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${quotationMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Detailed
              </button>
              <button
                onClick={() => setQuotationMode('simple')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${quotationMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
                  employee: employees?.find(e => e.id === (formData.metadata?.prepared_by_employee_id || formData.employee_id)) || (formData.employee as any) || (profile ? { full_name: formData.metadata?.prepared_by || profile.full_name } : undefined),
                  metadata: {
                    ...formData.metadata,
                    prepared_by: formData.metadata?.prepared_by,
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
