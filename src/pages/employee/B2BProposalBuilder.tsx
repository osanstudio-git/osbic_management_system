import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { 
  ArrowLeft, Printer, Save, Building2, User, Phone, 
  Mail, ShieldCheck, Handshake, Globe, DollarSign, FileText, 
  RotateCcw, Sparkles, ChevronRight, Eye, ZoomIn, ZoomOut, 
  Maximize2, Sliders, CheckSquare, Layers, Landmark, HelpCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInvoice, useSaveInvoice, type Invoice } from '../../hooks/employee/useInvoices';
import { useB2BPartners } from '../../hooks/shared/useB2BPartners';
import { useLeads, useAdminLeads } from '../../hooks/shared/useLeads';
import { useAdminClients } from '../../hooks/admin/useAdminClients';
import { useCurrencyRates, getCurrencyConfig } from '../../hooks/shared/useCurrencyRates';
import { B2BPartnershipProposalDocument } from '../../components/employee/B2BPartnershipProposalDocument';
import { supabase } from '../../lib/supabase';

export default function B2BProposalBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const { profile } = useAuth();

  // Queries
  const { data: initialData, isLoading: isLoadingProposal } = useInvoice(isNew ? undefined : id);
  const { mutateAsync: saveInvoiceMutation, isPending: isSaving } = useSaveInvoice();
  const { data: partners = [] } = useB2BPartners();

  const { useLeadsList } = useLeads(profile?.id);
  const { useAllLeadsList } = useAdminLeads();
  const leads = profile?.is_manager ? useAllLeadsList().data : useLeadsList().data;

  const adminClients = useAdminClients().data || [];
  const { data: ratesData } = useCurrencyRates();

  // View & Zoom controls for Live Preview
  const [zoomLevel, setZoomLevel] = useState<number>(0.68);
  const [activePreviewPage, setActivePreviewPage] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  
  // Page-Wise UX Tab on Left Panel
  const [pageTab, setPageTab] = useState<'page1' | 'page2' | 'page3' | 'page4'>('page1');

  // Form State
  const [recipientType, setRecipientType] = useState<'partner' | 'lead' | 'custom'>('partner');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [proposalData, setProposalData] = useState<{
    proposalTitle: string;
    submittedTo: string;
    contactPerson: string;
    clientPhone: string;
    clientEmail: string;
    submittedBy: string;
    preparedBy: string;
    ourPhone: string;
    currency: string;
    
    // Page 1: Introduction text
    introP1: string;
    introP2: string;

    // Page 1: New CR Package
    pkgNewCrServicesT1: string;
    pkgNewCrNoAttest: number;
    pkgNewCrServicesT2: string;
    pkgNewCrWithAttest: number;
    pkgNewCrDocs: string;
    pkgNewCrTimeline: string;

    // Page 1: Existing CR Package
    pkgExistingCrServices: string;
    pkgExistingCr: number;
    pkgExistingCrDocs: string;
    pkgExistingCrTimeline: string;

    // Page 2: Models & Surcharge
    surchargeNote: string;
    showOptionA: boolean;
    optionATitle: string;
    optionADesc: string;
    showOptionB: boolean;
    optionBTitle: string;
    optionBDesc: string;

    // Page 3: Bank Details
    showBankDetails: boolean;
    bankMuscatName: string;
    bankMuscatSwift: string;
    bankMuscatIban: string;
    bankMuscatAccount: string;
    bankDhofarName: string;
    bankDhofarSwift: string;
    bankDhofarIban: string;
    bankDhofarAccount: string;
    mobileBankingNumber: string;

    // Page 4: Selfie Guide & Internal Notes
    showSelfieGuide: boolean;
    notes: string;
    status: Invoice['status'];
  }>({
    proposalTitle: 'Oman Company Formation Services',
    submittedTo: 'A C H',
    contactPerson: '',
    clientPhone: '',
    clientEmail: '',
    submittedBy: 'OSBIC International LLC',
    preparedBy: profile?.full_name || 'ANSAR NV',
    ourPhone: '+968 72596531, +968 72229827',
    currency: 'SAR',

    // Page 1 Introduction defaults
    introP1: 'OSBIC International LLC is pleased to present this proposal for a strategic partnership to deliver professional Oman company formation and acquisition services to your clients. With deep expertise in Omani business regulations and a commitment to efficient, compliant service delivery, we are well-positioned to support your clients in establishing a credible corporate presence in the Sultanate of Oman.',
    introP2: 'We believe this collaboration presents a valuable opportunity for both organizations to expand service offerings, generate additional revenue streams, and deliver tangible value to mutual clients.',

    // Page 1 New CR defaults (matching Image 2)
    pkgNewCrServicesT1: 'New commercial registration',
    pkgNewCrNoAttest: 2000,
    pkgNewCrServicesT2: 'New commercial registration\nAttestation of CR with MOFA & SAUDI EMBASSY.',
    pkgNewCrWithAttest: 4000,
    pkgNewCrDocs: 'Passport copy & Passport with selfie\nEmail address\nPhone number\nBusiness activity list\nProposed company name(s)',
    pkgNewCrTimeline: 'Name approval: Same day\nCR issuance: Same day (post-approval)\nAttestation: Within 4 working days',

    // Page 1 Existing CR defaults (matching Image 2)
    pkgExistingCrServices: 'Commercial registration with MOFA & Saudi embassy attestation\nMOA with MOFA & Saudi attestation\nAudit report with MOFA & Saudi embassy attestation\n1 POA for Saudi client, with MOFA & Saudi attestation.',
    pkgExistingCr: 13000,
    pkgExistingCrDocs: 'Passport copy & Iqama copy\nPassport with selfie\nEmail address\nPhone number\nPower of Attorney (POA)',
    pkgExistingCrTimeline: 'Complete documentation: Within 10-15 working days.',

    // Page 2 defaults
    surchargeNote: 'An additional fee of OMR 250 will apply, subject to the IQAMA & POA are not available as per the conditions mentioned above.',
    showOptionA: true,
    optionATitle: 'B2B Partnership',
    optionADesc: 'Direct business cooperation with structured agreements, defined service levels, and formalized billing arrangements between both organizations.',
    showOptionB: true,
    optionBTitle: 'Reference-Based Partnership',
    optionBDesc: 'Commission-based model where your organization refers clients to OSBIC and receives a competitive commission for each successful company formation.',

    // Page 3 Bank Details defaults (matching Image 1)
    showBankDetails: true,
    bankMuscatName: 'OSBIC INTERNATIONAL LLC',
    bankMuscatSwift: 'BMUSOMRXXX',
    bankMuscatIban: 'OM550270423081077790019',
    bankMuscatAccount: '0423081077790019',
    bankDhofarName: 'OSBIC INTERNATIONAL LLC',
    bankDhofarSwift: 'BDOFOMRUXXX',
    bankDhofarIban: 'OM390250001045788333002',
    bankDhofarAccount: '01045788333002',
    mobileBankingNumber: '72229827',

    // Page 4 defaults
    showSelfieGuide: true,
    notes: 'Strategic B2B Partnership Model for GCC Client Expansion into Oman.',
    status: 'draft'
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `B2B_Proposal_${proposalData.submittedTo || 'OSBIC'}`.replace(/\s+/g, '_'),
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

  // Switch tab & optionally focus preview
  const handleTabChange = (tab: 'page1' | 'page2' | 'page3' | 'page4') => {
    setPageTab(tab);
    if (tab === 'page1') setActivePreviewPage('1');
    else if (tab === 'page2') setActivePreviewPage('2');
    else if (tab === 'page3') setActivePreviewPage('3');
    else if (tab === 'page4') setActivePreviewPage('4');
  };

  // Handle URL query parameters for pre-filling on new proposal
  useEffect(() => {
    if (!isNew) return;

    const urlPartnerId = searchParams.get('partner_id') || searchParams.get('partnerId');
    const urlLeadId = searchParams.get('lead_id') || searchParams.get('leadId');
    const urlClientId = searchParams.get('client_id') || searchParams.get('clientId');
    const urlCurrency = searchParams.get('currency');

    if (urlCurrency) {
      setProposalData(prev => ({ ...prev, currency: urlCurrency }));
    }

    if (urlPartnerId && partners.length > 0) {
      const partner = partners.find(p => p.id === urlPartnerId);
      if (partner) {
        setRecipientType('partner');
        setSelectedPartnerId(partner.id);
        setProposalData(prev => ({
          ...prev,
          submittedTo: partner.name,
          contactPerson: partner.contact_person || '',
          clientPhone: partner.contact_phone || '',
          clientEmail: partner.contact_email || ''
        }));
      }
    } else if (urlLeadId && leads && leads.length > 0) {
      const lead = leads.find(l => l.id === urlLeadId);
      if (lead) {
        setRecipientType('lead');
        setSelectedLeadId(lead.id);
        setProposalData(prev => ({
          ...prev,
          submittedTo: lead.company_name || lead.contact_name || '',
          contactPerson: lead.contact_name || '',
          clientPhone: lead.contact_phone || lead.contact_whatsapp || '',
          clientEmail: lead.contact_email || ''
        }));
      }
    } else if (urlClientId && adminClients.length > 0) {
      const client = adminClients.find(c => c.id === urlClientId);
      if (client) {
        setSelectedClientId(client.id);
        setProposalData(prev => ({
          ...prev,
          submittedTo: client.company_name || client.full_name || '',
          contactPerson: client.full_name || '',
          clientPhone: client.phone || '',
          clientEmail: client.email || ''
        }));
      }
    }
  }, [isNew, searchParams, partners, leads, adminClients]);

  // Load Existing Proposal Data
  useEffect(() => {
    if (initialData && !isNew) {
      const meta = initialData.metadata || {};
      
      if (initialData.b2b_partner_id) {
        setRecipientType('partner');
        setSelectedPartnerId(initialData.b2b_partner_id);
      } else if (initialData.lead_id) {
        setRecipientType('lead');
        setSelectedLeadId(initialData.lead_id);
      } else {
        setRecipientType('custom');
      }

      setProposalData({
        proposalTitle: meta.b2b_proposal_title || 'Oman Company Formation Services',
        submittedTo: meta.b2b_submitted_to || initialData.client?.company_name || initialData.lead?.company_name || initialData.client?.full_name || initialData.lead?.contact_name || 'A C H',
        contactPerson: meta.b2b_contact_person || initialData.client?.full_name || initialData.lead?.contact_name || '',
        clientPhone: meta.b2b_submitted_phone || initialData.client?.phone || initialData.lead?.contact_phone || '',
        clientEmail: meta.b2b_submitted_email || initialData.client?.email || initialData.lead?.contact_email || '',
        submittedBy: meta.b2b_submitted_by || 'OSBIC International LLC',
        preparedBy: meta.b2b_prepared_by || initialData.employee?.full_name || profile?.full_name || 'ANSAR NV',
        ourPhone: meta.b2b_our_phone || '+968 72596531, +968 72229827',
        currency: initialData.currency || 'SAR',

        introP1: meta.b2b_intro_p1 || 'OSBIC International LLC is pleased to present this proposal for a strategic partnership to deliver professional Oman company formation and acquisition services to your clients. With deep expertise in Omani business regulations and a commitment to efficient, compliant service delivery, we are well-positioned to support your clients in establishing a credible corporate presence in the Sultanate of Oman.',
        introP2: meta.b2b_intro_p2 || 'We believe this collaboration presents a valuable opportunity for both organizations to expand service offerings, generate additional revenue streams, and deliver tangible value to mutual clients.',

        pkgNewCrServicesT1: typeof meta.pkg_new_cr_services_t1 === 'string' ? meta.pkg_new_cr_services_t1 : (Array.isArray(meta.pkg_new_cr_services_t1) ? meta.pkg_new_cr_services_t1.join('\n') : 'New commercial registration'),
        pkgNewCrNoAttest: meta.pkg_new_cr_no_attest ?? 2000,
        pkgNewCrServicesT2: typeof meta.pkg_new_cr_services_t2 === 'string' ? meta.pkg_new_cr_services_t2 : (Array.isArray(meta.pkg_new_cr_services_t2) ? meta.pkg_new_cr_services_t2.join('\n') : 'New commercial registration\nAttestation of CR with MOFA & SAUDI EMBASSY.'),
        pkgNewCrWithAttest: meta.pkg_new_cr_with_attest ?? 4000,
        pkgNewCrDocs: typeof meta.pkg_new_cr_docs === 'string' ? meta.pkg_new_cr_docs : (Array.isArray(meta.pkg_new_cr_docs) ? meta.pkg_new_cr_docs.join('\n') : 'Passport copy & Passport with selfie\nEmail address\nPhone number\nBusiness activity list\nProposed company name(s)'),
        pkgNewCrTimeline: typeof meta.pkg_new_cr_timeline === 'string' ? meta.pkg_new_cr_timeline : (Array.isArray(meta.pkg_new_cr_timeline) ? meta.pkg_new_cr_timeline.join('\n') : 'Name approval: Same day\nCR issuance: Same day (post-approval)\nAttestation: Within 4 working days'),

        pkgExistingCrServices: typeof meta.pkg_existing_cr_services === 'string' ? meta.pkg_existing_cr_services : (Array.isArray(meta.pkg_existing_cr_services) ? meta.pkg_existing_cr_services.join('\n') : 'Commercial registration with MOFA & Saudi embassy attestation\nMOA with MOFA & Saudi attestation\nAudit report with MOFA & Saudi embassy attestation\n1 POA for Saudi client, with MOFA & Saudi attestation.'),
        pkgExistingCr: meta.pkg_existing_cr ?? 13000,
        pkgExistingCrDocs: typeof meta.pkg_existing_cr_docs === 'string' ? meta.pkg_existing_cr_docs : (Array.isArray(meta.pkg_existing_cr_docs) ? meta.pkg_existing_cr_docs.join('\n') : 'Passport copy & Iqama copy\nPassport with selfie\nEmail address\nPhone number\nPower of Attorney (POA)'),
        pkgExistingCrTimeline: typeof meta.pkg_existing_cr_timeline === 'string' ? meta.pkg_existing_cr_timeline : (Array.isArray(meta.pkg_existing_cr_timeline) ? meta.pkg_existing_cr_timeline.join('\n') : 'Complete documentation: Within 10-15 working days.'),

        surchargeNote: meta.b2b_surcharge_note || 'An additional fee of OMR 250 will apply, subject to the IQAMA & POA are not available as per the conditions mentioned above.',
        showOptionA: meta.show_option_a !== false,
        optionATitle: meta.b2b_option_a_title || 'B2B Partnership',
        optionADesc: meta.b2b_option_a_desc || 'Direct business cooperation with structured agreements, defined service levels, and formalized billing arrangements between both organizations.',
        showOptionB: meta.show_option_b !== false,
        optionBTitle: meta.b2b_option_b_title || 'Reference-Based Partnership',
        optionBDesc: meta.b2b_option_b_desc || 'Commission-based model where your organization refers clients to OSBIC and receives a competitive commission for each successful company formation.',

        showBankDetails: meta.show_bank_details !== false,
        bankMuscatName: meta.bank_muscat_name || 'OSBIC INTERNATIONAL LLC',
        bankMuscatSwift: meta.bank_muscat_swift || 'BMUSOMRXXX',
        bankMuscatIban: meta.bank_muscat_iban || 'OM550270423081077790019',
        bankMuscatAccount: meta.bank_muscat_account || '0423081077790019',
        bankDhofarName: meta.bank_dhofar_name || 'OSBIC INTERNATIONAL LLC',
        bankDhofarSwift: meta.bank_dhofar_swift || 'BDOFOMRUXXX',
        bankDhofarIban: meta.bank_dhofar_iban || 'OM390250001045788333002',
        bankDhofarAccount: meta.bank_dhofar_account || '01045788333002',
        mobileBankingNumber: meta.mobile_banking_number || '72229827',

        showSelfieGuide: meta.show_selfie_guide !== false,
        notes: initialData.notes || 'Strategic B2B Partnership Model for GCC Client Expansion into Oman.',
        status: initialData.status || 'draft'
      });
    }
  }, [initialData, isNew, profile]);

  // Auto-fill when Partner Selected
  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    if (!partnerId) return;
    const partner = partners.find(p => p.id === partnerId);
    if (partner) {
      setProposalData(prev => ({
        ...prev,
        submittedTo: partner.name,
        contactPerson: partner.contact_person || '',
        clientPhone: partner.contact_phone || '',
        clientEmail: partner.contact_email || ''
      }));
    }
  };

  // Auto-fill when Lead Selected
  const handleLeadSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) return;
    const lead = leads?.find(l => l.id === leadId);
    if (lead) {
      setProposalData(prev => ({
        ...prev,
        submittedTo: lead.company_name || lead.contact_name || '',
        contactPerson: lead.contact_name || '',
        clientPhone: lead.contact_phone || lead.contact_whatsapp || '',
        clientEmail: lead.contact_email || ''
      }));
    }
  };

  // Save Proposal
  const handleSave = async () => {
    if (!proposalData.submittedTo.trim()) {
      return toast.error('Please enter the Partner or Client Company name');
    }

    try {
      const totalAmount = Number(proposalData.pkgExistingCr || 13000);
      const payload: Invoice = {
        id: isNew ? undefined : id,
        type: 'quotation',
        status: proposalData.status || 'draft',
        currency: proposalData.currency || 'SAR',
        subtotal: totalAmount,
        total_amount: totalAmount,
        tax_percentage: 0,
        tax_amount: 0,
        discount_amount: 0,
        notes: proposalData.notes,
        terms: 'Strategic Partnership Proposal. Terms valid for 30 days from submission date.',
        client_id: selectedClientId || null,
        lead_id: selectedLeadId || null,
        b2b_partner_id: selectedPartnerId || null,
        b2b_flow_type: 'inbound_oman_exec',
        metadata: {
          proposal_type: 'b2b_proposal',
          b2b_proposal_title: proposalData.proposalTitle,
          b2b_submitted_to: proposalData.submittedTo,
          b2b_contact_person: proposalData.contactPerson,
          b2b_submitted_phone: proposalData.clientPhone,
          b2b_submitted_email: proposalData.clientEmail,
          b2b_submitted_by: proposalData.submittedBy,
          b2b_prepared_by: proposalData.preparedBy,
          b2b_our_phone: proposalData.ourPhone,

          // Page 1 details
          b2b_intro_p1: proposalData.introP1,
          b2b_intro_p2: proposalData.introP2,

          pkg_new_cr_services_t1: proposalData.pkgNewCrServicesT1,
          pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
          pkg_new_cr_services_t2: proposalData.pkgNewCrServicesT2,
          pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
          pkg_new_cr_docs: proposalData.pkgNewCrDocs,
          pkg_new_cr_timeline: proposalData.pkgNewCrTimeline,

          pkg_existing_cr_services: proposalData.pkgExistingCrServices,
          pkg_existing_cr: Number(proposalData.pkgExistingCr),
          pkg_existing_cr_docs: proposalData.pkgExistingCrDocs,
          pkg_existing_cr_timeline: proposalData.pkgExistingCrTimeline,

          // Page 2 details
          b2b_surcharge_note: proposalData.surchargeNote,
          show_option_a: proposalData.showOptionA,
          b2b_option_a_title: proposalData.optionATitle,
          b2b_option_a_desc: proposalData.optionADesc,
          show_option_b: proposalData.showOptionB,
          b2b_option_b_title: proposalData.optionBTitle,
          b2b_option_b_desc: proposalData.optionBDesc,

          // Page 3 Bank Details
          show_bank_details: proposalData.showBankDetails,
          bank_muscat_name: proposalData.bankMuscatName,
          bank_muscat_swift: proposalData.bankMuscatSwift,
          bank_muscat_iban: proposalData.bankMuscatIban,
          bank_muscat_account: proposalData.bankMuscatAccount,
          bank_dhofar_name: proposalData.bankDhofarName,
          bank_dhofar_swift: proposalData.bankDhofarSwift,
          bank_dhofar_iban: proposalData.bankDhofarIban,
          bank_dhofar_account: proposalData.bankDhofarAccount,
          mobile_banking_number: proposalData.mobileBankingNumber,

          // Page 4 details
          show_selfie_guide: proposalData.showSelfieGuide,

          company_name: proposalData.submittedTo,
          recipient_name: proposalData.contactPerson || proposalData.submittedTo,
          recipient_phone: proposalData.clientPhone
        },
        items: [
          {
            description: `Strategic B2B Partnership Proposal - ${proposalData.proposalTitle}`,
            quantity: 1,
            unit_price: totalAmount,
            total: totalAmount
          }
        ]
      };

      const savedId = await saveInvoiceMutation(payload);
      toast.success(isNew ? 'B2B Strategic Proposal created successfully!' : 'B2B Proposal updated successfully!');
      if (isNew && savedId) {
        navigate(`/employee/b2b/proposals/${savedId}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Failed to save B2B proposal:', err);
      toast.error(err?.message || 'Failed to save proposal');
    }
  };

  // Live preview virtual invoice
  const livePreviewInvoice: Invoice = {
    id: id || 'preview',
    type: 'quotation',
    status: proposalData.status,
    currency: proposalData.currency,
    subtotal: Number(proposalData.pkgExistingCr || 13000),
    total_amount: Number(proposalData.pkgExistingCr || 13000),
    tax_percentage: 0,
    tax_amount: 0,
    discount_amount: 0,
    notes: proposalData.notes,
    client: {
      company_name: proposalData.submittedTo,
      full_name: proposalData.contactPerson,
      phone: proposalData.clientPhone,
      email: proposalData.clientEmail
    },
    metadata: {
      proposal_type: 'b2b_proposal',
      b2b_proposal_title: proposalData.proposalTitle,
      b2b_submitted_to: proposalData.submittedTo,
      b2b_contact_person: proposalData.contactPerson,
      b2b_submitted_phone: proposalData.clientPhone,
      b2b_submitted_email: proposalData.clientEmail,
      b2b_submitted_by: proposalData.submittedBy,
      b2b_prepared_by: proposalData.preparedBy,
      b2b_our_phone: proposalData.ourPhone,

      b2b_intro_p1: proposalData.introP1,
      b2b_intro_p2: proposalData.introP2,

      pkg_new_cr_services_t1: proposalData.pkgNewCrServicesT1,
      pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
      pkg_new_cr_services_t2: proposalData.pkgNewCrServicesT2,
      pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
      pkg_new_cr_docs: proposalData.pkgNewCrDocs,
      pkg_new_cr_timeline: proposalData.pkgNewCrTimeline,

      pkg_existing_cr_services: proposalData.pkgExistingCrServices,
      pkg_existing_cr: Number(proposalData.pkgExistingCr),
      pkg_existing_cr_docs: proposalData.pkgExistingCrDocs,
      pkg_existing_cr_timeline: proposalData.pkgExistingCrTimeline,

      b2b_surcharge_note: proposalData.surchargeNote,
      show_option_a: proposalData.showOptionA,
      b2b_option_a_title: proposalData.optionATitle,
      b2b_option_a_desc: proposalData.optionADesc,
      show_option_b: proposalData.showOptionB,
      b2b_option_b_title: proposalData.optionBTitle,
      b2b_option_b_desc: proposalData.optionBDesc,

      show_bank_details: proposalData.showBankDetails,
      bank_muscat_name: proposalData.bankMuscatName,
      bank_muscat_swift: proposalData.bankMuscatSwift,
      bank_muscat_iban: proposalData.bankMuscatIban,
      bank_muscat_account: proposalData.bankMuscatAccount,
      bank_dhofar_name: proposalData.bankDhofarName,
      bank_dhofar_swift: proposalData.bankDhofarSwift,
      bank_dhofar_iban: proposalData.bankDhofarIban,
      bank_dhofar_account: proposalData.bankDhofarAccount,
      mobile_banking_number: proposalData.mobileBankingNumber,

      show_selfie_guide: proposalData.showSelfieGuide
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Back & Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/employee/b2b')}
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
              title="Back to Saudi B2B Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Saudi B2B Hub</span>
            </button>

            <div className="h-4 w-[1px] bg-border hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#0073b7]/15 text-[#0073b7] dark:text-cyan-400 border border-[#0073b7]/30">
                  Strategic B2B Quotation
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {isNew ? 'New Quotation' : `#${id?.slice(0, 8)}`}
                </span>
              </div>
              <h1 className="text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md">
                {proposalData.submittedTo || 'Untitled Partnership Quotation'}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl border border-border transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4 text-[#0073b7]" />
              <span className="hidden sm:inline">Print / Export PDF</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-4 py-2 bg-[#0073b7] hover:bg-[#00609a] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#0073b7]/25 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Quotation'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT: PAGE-WISE FORM CONTROLS (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-4 print:hidden">

          {/* PAGE NAVIGATION TABS (OPTIMAL UX: Direct Page-Wise Organization) */}
          <div className="bg-card border border-border rounded-2xl p-2 shadow-sm">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5 px-1 flex items-center justify-between">
              <span>Page-by-Page Editor</span>
              <span className="text-[#0073b7] font-semibold">Live Preview Synced</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => handleTabChange('page1')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 text-center border ${
                  pageTab === 'page1'
                    ? 'bg-[#0073b7] text-white border-[#0073b7] shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">Page 1</span>
                <span className="truncate w-full text-[11px]">Scope & Price</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('page2')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 text-center border ${
                  pageTab === 'page2'
                    ? 'bg-[#0073b7] text-white border-[#0073b7] shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">Page 2</span>
                <span className="truncate w-full text-[11px]">Partnership</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('page3')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 text-center border ${
                  pageTab === 'page3'
                    ? 'bg-[#0073b7] text-white border-[#0073b7] shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">Page 3</span>
                <span className="truncate w-full text-[11px]">Bank Details</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('page4')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 text-center border ${
                  pageTab === 'page4'
                    ? 'bg-[#0073b7] text-white border-[#0073b7] shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">Page 4</span>
                <span className="truncate w-full text-[11px]">Selfie & Notes</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* =================== TAB 1: PAGE 1 (SCOPE & PRICING) ===================== */}
          {/* ========================================================================= */}
          {pageTab === 'page1' && (
            <div className="space-y-4">
              
              {/* Recipient & Header Box */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0073b7]" />
                    Page 1: Recipient & Proposal Header
                  </h2>
                </div>

                {/* Source Selector */}
                <div className="grid grid-cols-3 gap-1.5 bg-muted p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setRecipientType('partner')}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                      recipientType === 'partner'
                        ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    B2B Partner
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('lead')}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                      recipientType === 'lead'
                        ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Saudi Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('custom')}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                      recipientType === 'custom'
                        ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Dropdowns */}
                {recipientType === 'partner' && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Choose Partner Firm
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => handlePartnerSelect(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                    >
                      <option value="">-- Choose Partner Company --</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.country === 'KSA' ? '🇸🇦' : '🇴🇲'} {p.name} ({p.partner_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {recipientType === 'lead' && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Choose Saudi/GCC Lead
                    </label>
                    <select
                      value={selectedLeadId}
                      onChange={(e) => handleLeadSelect(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                    >
                      <option value="">-- Choose Lead --</option>
                      {(leads || []).map(l => (
                        <option key={l.id} value={l.id}>
                          {l.company_name ? `${l.company_name} — ${l.contact_name}` : l.contact_name} ({l.nationality || 'Client'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Submitted To & Phone */}
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Submitted To (Partner / Client Company Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={proposalData.submittedTo}
                      onChange={(e) => setProposalData({ ...proposalData, submittedTo: e.target.value })}
                      placeholder="e.g. A C H"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-[#0073b7] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={proposalData.contactPerson}
                        onChange={(e) => setProposalData({ ...proposalData, contactPerson: e.target.value })}
                        placeholder="e.g. Eng. Mohammed"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#0073b7]" /> Client Phone
                      </label>
                      <input
                        type="text"
                        value={proposalData.clientPhone}
                        onChange={(e) => setProposalData({ ...proposalData, clientPhone: e.target.value })}
                        placeholder="e.g. +966582288816"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-[#0073b7] outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Proposal Title & Currency */}
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Proposal Title (Banner Subheading)
                    </label>
                    <input
                      type="text"
                      value={proposalData.proposalTitle}
                      onChange={(e) => setProposalData({ ...proposalData, proposalTitle: e.target.value })}
                      placeholder="Oman Company Formation Services"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-[#0073b7] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Currency
                      </label>
                      <select
                        value={proposalData.currency}
                        onChange={(e) => setProposalData({ ...proposalData, currency: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none"
                      >
                        <option value="SAR">🇸🇦 SAR (Saudi Riyal)</option>
                        <option value="OMR">🇴🇲 OMR (Omani Rial)</option>
                        <option value="AED">🇦🇪 AED (UAE Dirham)</option>
                        <option value="USD">🇺🇸 USD (US Dollar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Prepared By (Rep Name)
                      </label>
                      <input
                        type="text"
                        value={proposalData.preparedBy}
                        onChange={(e) => setProposalData({ ...proposalData, preparedBy: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Introduction Text Box */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0073b7]" />
                  Executive Introduction Paragraphs
                </h3>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Introduction — Paragraph 1
                  </label>
                  <textarea
                    rows={3}
                    value={proposalData.introP1}
                    onChange={(e) => setProposalData({ ...proposalData, introP1: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Introduction — Paragraph 2
                  </label>
                  <textarea
                    rows={2}
                    value={proposalData.introP2}
                    onChange={(e) => setProposalData({ ...proposalData, introP2: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Scope of Services: New CR Column */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-2.5">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0073b7]" />
                    Scope of Services: New CR Column (Left Side)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Controls the 2 tiers, required documents, and timeline on the left column.
                  </p>
                </div>

                {/* Tier 1 */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase block">
                    Tier 1: Services List (Without Attestation)
                  </label>
                  <textarea
                    rows={2}
                    value={proposalData.pkgNewCrServicesT1}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrServicesT1: e.target.value })}
                    placeholder="One service per line"
                    className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                  />

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Tier 1 Total Amount ({proposalData.currency})
                    </span>
                    <input
                      type="number"
                      value={proposalData.pkgNewCrNoAttest}
                      onChange={(e) => setProposalData({ ...proposalData, pkgNewCrNoAttest: Number(e.target.value) })}
                      className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none text-right font-mono"
                    />
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase block">
                    Tier 2: Services List (With Attestation)
                  </label>
                  <textarea
                    rows={2}
                    value={proposalData.pkgNewCrServicesT2}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrServicesT2: e.target.value })}
                    placeholder="One service per line"
                    className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                  />

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Tier 2 Total Amount ({proposalData.currency})
                    </span>
                    <input
                      type="number"
                      value={proposalData.pkgNewCrWithAttest}
                      onChange={(e) => setProposalData({ ...proposalData, pkgNewCrWithAttest: Number(e.target.value) })}
                      className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none text-right font-mono"
                    />
                  </div>
                </div>

                {/* Docs & Timeline */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Required Documents (Line by Line)
                    </label>
                    <textarea
                      rows={3}
                      value={proposalData.pkgNewCrDocs}
                      onChange={(e) => setProposalData({ ...proposalData, pkgNewCrDocs: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Processing Timeline (Line by Line)
                    </label>
                    <textarea
                      rows={3}
                      value={proposalData.pkgNewCrTimeline}
                      onChange={(e) => setProposalData({ ...proposalData, pkgNewCrTimeline: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Scope of Services: Existing CR Column */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-2.5">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0073b7]" />
                    Scope of Services: Existing CR Package (Right Side)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Controls package services, all-inclusive price, required docs, and timeline.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-foreground uppercase block mb-1">
                    Included Services (Line by Line)
                  </label>
                  <textarea
                    rows={4}
                    value={proposalData.pkgExistingCrServices}
                    onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrServices: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Package Total Amount</span>
                    <span className="text-[10px] text-muted-foreground">Standard all-inclusive CR package price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={proposalData.pkgExistingCr}
                      onChange={(e) => setProposalData({ ...proposalData, pkgExistingCr: Number(e.target.value) })}
                      className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none text-right font-mono"
                    />
                    <span className="text-xs font-bold text-foreground">{proposalData.currency}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Required Documents (Line by Line)
                    </label>
                    <textarea
                      rows={3}
                      value={proposalData.pkgExistingCrDocs}
                      onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrDocs: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Processing Timeline (Line by Line)
                    </label>
                    <textarea
                      rows={2}
                      value={proposalData.pkgExistingCrTimeline}
                      onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrTimeline: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* =================== TAB 2: PAGE 2 (PARTNERSHIP MODELS) ================== */}
          {/* ========================================================================= */}
          {pageTab === 'page2' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0073b7]" />
                  Page 2: Surcharge Notice & Partnership Models
                </h2>
              </div>

              {/* Surcharge Note */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Surcharge Notice (Page 2 Accent Box)
                </label>
                <textarea
                  rows={2}
                  value={proposalData.surchargeNote}
                  onChange={(e) => setProposalData({ ...proposalData, surchargeNote: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none leading-relaxed"
                />
              </div>

              {/* Option A Toggle & Description */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showOptionA}
                    onChange={(e) => setProposalData({ ...proposalData, showOptionA: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0073b7] focus:ring-[#0073b7] accent-[#0073b7] cursor-pointer"
                  />
                  <span>Include Option A (B2B Partnership)</span>
                </label>

                {proposalData.showOptionA && (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={proposalData.optionATitle}
                      onChange={(e) => setProposalData({ ...proposalData, optionATitle: e.target.value })}
                      placeholder="B2B Partnership"
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none"
                    />
                    <textarea
                      rows={2}
                      value={proposalData.optionADesc}
                      onChange={(e) => setProposalData({ ...proposalData, optionADesc: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Option B Toggle & Description */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showOptionB}
                    onChange={(e) => setProposalData({ ...proposalData, showOptionB: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0073b7] focus:ring-[#0073b7] accent-[#0073b7] cursor-pointer"
                  />
                  <span>Include Option B (Reference-Based Partnership)</span>
                </label>

                {proposalData.showOptionB && (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={proposalData.optionBTitle}
                      onChange={(e) => setProposalData({ ...proposalData, optionBTitle: e.target.value })}
                      placeholder="Reference-Based Partnership"
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none"
                    />
                    <textarea
                      rows={2}
                      value={proposalData.optionBDesc}
                      onChange={(e) => setProposalData({ ...proposalData, optionBDesc: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-[#0073b7] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Informational preview of Why Partner With OSBIC */}
              <div className="p-3 bg-muted/20 border border-border rounded-xl text-xs space-y-1">
                <span className="font-bold text-foreground text-[11px] block">
                  Why Partner With OSBIC? (6 Visual Cards)
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Fast & Reliable • End-to-End Support • Market Expertise • Competitive Pricing • Dedicated Team • Fully Compliant. These 6 enterprise trust cards are displayed directly on Page 2 in the live preview.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* =================== TAB 3: PAGE 3 (BANK DETAILS) ======================== */}
          {/* ========================================================================= */}
          {pageTab === 'page3' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[#0073b7]" />
                  Page 3: Bank Account Details
                </h2>
                <label className="flex items-center gap-2 text-xs font-bold text-[#0073b7] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showBankDetails}
                    onChange={(e) => setProposalData({ ...proposalData, showBankDetails: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0073b7] focus:ring-[#0073b7] accent-[#0073b7] cursor-pointer"
                  />
                  <span>Include Page</span>
                </label>
              </div>

              {proposalData.showBankDetails ? (
                <div className="space-y-4">
                  {/* Bank Muscat */}
                  <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        1. Bank Muscat Details
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">Primary</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatName}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatName: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:border-[#0073b7] outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            SWIFT Code
                          </label>
                          <input
                            type="text"
                            value={proposalData.bankMuscatSwift}
                            onChange={(e) => setProposalData({ ...proposalData, bankMuscatSwift: e.target.value })}
                            className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={proposalData.bankMuscatAccount}
                            onChange={(e) => setProposalData({ ...proposalData, bankMuscatAccount: e.target.value })}
                            className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          IBAN Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatIban}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatIban: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bank Dhofar */}
                  <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        2. Bank Dhofar Details
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">Secondary</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarName}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarName: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:border-[#0073b7] outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            SWIFT Code
                          </label>
                          <input
                            type="text"
                            value={proposalData.bankDhofarSwift}
                            onChange={(e) => setProposalData({ ...proposalData, bankDhofarSwift: e.target.value })}
                            className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={proposalData.bankDhofarAccount}
                            onChange={(e) => setProposalData({ ...proposalData, bankDhofarAccount: e.target.value })}
                            className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          IBAN Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarIban}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarIban: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Banking */}
                  <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-2">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide block border-b border-border pb-1.5">
                      3. Mobile Banking Number
                    </span>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        value={proposalData.mobileBankingNumber}
                        onChange={(e) => setProposalData({ ...proposalData, mobileBankingNumber: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:border-[#0073b7] outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                  <p className="text-xs font-medium">Bank details page is currently excluded from this proposal.</p>
                  <button
                    type="button"
                    onClick={() => setProposalData({ ...proposalData, showBankDetails: true })}
                    className="mt-2 text-xs font-bold text-[#0073b7] hover:underline"
                  >
                    Enable Bank Details Page
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* =================== TAB 4: PAGE 4 (SELFIE & NOTES) ====================== */}
          {/* ========================================================================= */}
          {pageTab === 'page4' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#0073b7]" />
                  Page 4: Contact & Selfie Guide Settings
                </h2>
              </div>

              {/* Page 4 Selfie Guide Checkbox */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showSelfieGuide}
                    onChange={(e) => setProposalData({ ...proposalData, showSelfieGuide: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0073b7] focus:ring-[#0073b7] accent-[#0073b7] cursor-pointer"
                  />
                  <span>Display "Example of Acceptable Selfie With Passport" visual box</span>
                </label>
                <p className="text-[10px] text-muted-foreground mt-1 ml-6 leading-relaxed">
                  Crucial compliance visual to prevent partner and client document rejections during Royal Oman Police & Ministry processing.
                </p>
              </div>

              {/* Internal Notes & Quotation Status */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Internal Deal Notes
                  </label>
                  <textarea
                    rows={2}
                    value={proposalData.notes}
                    onChange={(e) => setProposalData({ ...proposalData, notes: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-[#0073b7] outline-none"
                    placeholder="Internal reference notes for sales tracking..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Quotation Lifecycle Status
                  </label>
                  <select
                    value={proposalData.status}
                    onChange={(e) => setProposalData({ ...proposalData, status: e.target.value as Invoice['status'] })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-[#0073b7] outline-none"
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="sent">📨 Sent to Partner/Client</option>
                    <option value="paid">✅ Accepted / Finalized</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ================= RIGHT: LIVE DOCUMENT PREVIEW (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          {/* Controls Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3 text-xs bg-card border border-border p-2.5 rounded-2xl shadow-sm">
            {/* Page Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActivePreviewPage('all')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] shrink-0 ${
                  activePreviewPage === 'all'
                    ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Pages
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('1')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] shrink-0 ${
                  activePreviewPage === '1'
                    ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 1
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('2')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] shrink-0 ${
                  activePreviewPage === '2'
                    ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 2
              </button>
              {proposalData.showBankDetails && (
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('3')}
                  className={`px-2.5 py-1 rounded-lg transition text-[11px] shrink-0 ${
                    activePreviewPage === '3'
                      ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Page 3 (Bank)
                </button>
              )}
              <button
                type="button"
                onClick={() => setActivePreviewPage('4')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] shrink-0 ${
                  activePreviewPage === '4'
                    ? 'bg-card text-[#0073b7] dark:text-cyan-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page {proposalData.showBankDetails ? '4' : '3'} (Selfie)
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.45, Number((prev - 0.08).toFixed(2))))}
                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] font-mono font-bold text-muted-foreground w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(1.2, Number((prev + 0.08).toFixed(2))))}
                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoomLevel(0.68)}
                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition"
                title="Fit Width"
              >
                Fit Width
              </button>
            </div>
          </div>

          {/* Scaled Document Viewport Container */}
          <div className="w-full overflow-hidden bg-slate-900/10 dark:bg-black/40 p-4 sm:p-6 rounded-3xl border border-border shadow-inner flex justify-center items-start min-h-[750px]">
            <div 
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top center',
                width: 794,
                marginBottom: `${(1 - zoomLevel) * -850}px`
              }}
              className="transition-transform duration-150 ease-out"
            >
              <B2BPartnershipProposalDocument
                ref={printRef}
                invoice={livePreviewInvoice}
                activePagePreview={activePreviewPage}
              />
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
