import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { 
  ArrowLeft, Printer, Save, Building2, User, Phone, 
  Mail, ShieldCheck, Handshake, Globe, DollarSign, FileText, 
  RotateCcw, Sparkles, ChevronRight, Eye, ZoomIn, ZoomOut, 
  Maximize2, Sliders, CheckSquare, Layers, Landmark, Smartphone, CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInvoice, useSaveInvoice, type Invoice } from '../../hooks/employee/useInvoices';
import { useB2BPartners } from '../../hooks/shared/useB2BPartners';
import { useLeads, useAdminLeads } from '../../hooks/shared/useLeads';
import { useAdminClients } from '../../hooks/admin/useAdminClients';
import { useCurrencyRates, getCurrencyConfig } from '../../hooks/shared/useCurrencyRates';
import { B2BPartnershipProposalDocument } from '../../components/employee/B2BPartnershipProposalDocument';
import ThemeToggle from '../../components/ThemeToggle';
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
  const [formTab, setFormTab] = useState<'recipient' | 'intro' | 'new_cr' | 'existing_cr' | 'models' | 'bank_details'>('recipient');

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

    // Page 1: Column Titles & Scope
    pkgNewCrTitle: string;
    pkgNewCrServicesT1: string;
    pkgNewCrNoAttest: number;
    pkgNewCrServicesT2: string;
    pkgNewCrWithAttest: number;
    pkgNewCrDocs: string;
    pkgNewCrTimeline: string;

    // Page 1: Existing CR Package
    pkgExistingCrTitle: string;
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

    // Page 3: Bank Account Details
    showBankDetails: boolean;
    bankMuscatCustomer: string;
    bankMuscatSwift: string;
    bankMuscatIban: string;
    bankMuscatAcc: string;
    bankDhofarCustomer: string;
    bankDhofarSwift: string;
    bankDhofarIban: string;
    bankDhofarAcc: string;
    mobileBankingNum: string;

    // Page 4: Selfie Guide
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

    // Page 1 Scope Titles & Column defaults
    pkgNewCrTitle: 'NEW COMPANY REGISTRATION (CR)',
    pkgNewCrServicesT1: 'New commercial registration',
    pkgNewCrNoAttest: 2000,
    pkgNewCrServicesT2: 'New commercial registration\nAttestation of CR with MOFA & SAUDI EMBASSY.',
    pkgNewCrWithAttest: 4000,
    pkgNewCrDocs: 'Passport copy & Passport with selfie\nEmail address\nPhone number\nBusiness activity list\nProposed company name(s)',
    pkgNewCrTimeline: 'Name approval: Same day\nCR issuance: Same day (post-approval)\nAttestation: Within 4 working days',

    // Page 1 Existing CR defaults
    pkgExistingCrTitle: 'EXISTING COMPANY (CR) PACKAGE',
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
    
    // Page 3 Bank Account Details defaults (matching official OSBIC accounts)
    showBankDetails: true,
    bankMuscatCustomer: 'OSBIC INTERNATIONAL LLC',
    bankMuscatSwift: 'BMUSOMRXXX',
    bankMuscatIban: 'OM550270423081077790019',
    bankMuscatAcc: '0423081077790019',
    bankDhofarCustomer: 'OSBIC INTERNATIONAL LLC',
    bankDhofarSwift: 'BDOFOMRUXXX',
    bankDhofarIban: 'OM390250001045788333002',
    bankDhofarAcc: '01045788333002',
    mobileBankingNum: '72229827',

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

        pkgNewCrTitle: meta.pkg_new_cr_title || 'NEW COMPANY REGISTRATION (CR)',
        pkgNewCrServicesT1: typeof meta.pkg_new_cr_services_t1 === 'string' ? meta.pkg_new_cr_services_t1 : (Array.isArray(meta.pkg_new_cr_services_t1) ? meta.pkg_new_cr_services_t1.join('\n') : 'New commercial registration'),
        pkgNewCrNoAttest: meta.pkg_new_cr_no_attest ?? 2000,
        pkgNewCrServicesT2: typeof meta.pkg_new_cr_services_t2 === 'string' ? meta.pkg_new_cr_services_t2 : (Array.isArray(meta.pkg_new_cr_services_t2) ? meta.pkg_new_cr_services_t2.join('\n') : 'New commercial registration\nAttestation of CR with MOFA & SAUDI EMBASSY.'),
        pkgNewCrWithAttest: meta.pkg_new_cr_with_attest ?? 4000,
        pkgNewCrDocs: typeof meta.pkg_new_cr_docs === 'string' ? meta.pkg_new_cr_docs : (Array.isArray(meta.pkg_new_cr_docs) ? meta.pkg_new_cr_docs.join('\n') : 'Passport copy & Passport with selfie\nEmail address\nPhone number\nBusiness activity list\nProposed company name(s)'),
        pkgNewCrTimeline: typeof meta.pkg_new_cr_timeline === 'string' ? meta.pkg_new_cr_timeline : (Array.isArray(meta.pkg_new_cr_timeline) ? meta.pkg_new_cr_timeline.join('\n') : 'Name approval: Same day\nCR issuance: Same day (post-approval)\nAttestation: Within 4 working days'),

        pkgExistingCrTitle: meta.pkg_existing_cr_title || 'EXISTING COMPANY (CR) PACKAGE',
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
        bankMuscatCustomer: meta.bank_muscat_customer || 'OSBIC INTERNATIONAL LLC',
        bankMuscatSwift: meta.bank_muscat_swift || 'BMUSOMRXXX',
        bankMuscatIban: meta.bank_muscat_iban || 'OM550270423081077790019',
        bankMuscatAcc: meta.bank_muscat_acc || '0423081077790019',
        bankDhofarCustomer: meta.bank_dhofar_customer || 'OSBIC INTERNATIONAL LLC',
        bankDhofarSwift: meta.bank_dhofar_swift || 'BDOFOMRUXXX',
        bankDhofarIban: meta.bank_dhofar_iban || 'OM390250001045788333002',
        bankDhofarAcc: meta.bank_dhofar_acc || '01045788333002',
        mobileBankingNum: meta.mobile_banking_num || '72229827',

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

          pkg_new_cr_title: proposalData.pkgNewCrTitle,
          pkg_new_cr_services_t1: proposalData.pkgNewCrServicesT1,
          pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
          pkg_new_cr_services_t2: proposalData.pkgNewCrServicesT2,
          pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
          pkg_new_cr_docs: proposalData.pkgNewCrDocs,
          pkg_new_cr_timeline: proposalData.pkgNewCrTimeline,

          pkg_existing_cr_title: proposalData.pkgExistingCrTitle,
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

          // Page 3 Bank Account Details
          show_bank_details: proposalData.showBankDetails,
          bank_muscat_customer: proposalData.bankMuscatCustomer,
          bank_muscat_swift: proposalData.bankMuscatSwift,
          bank_muscat_iban: proposalData.bankMuscatIban,
          bank_muscat_acc: proposalData.bankMuscatAcc,
          bank_dhofar_customer: proposalData.bankDhofarCustomer,
          bank_dhofar_swift: proposalData.bankDhofarSwift,
          bank_dhofar_iban: proposalData.bankDhofarIban,
          bank_dhofar_acc: proposalData.bankDhofarAcc,
          mobile_banking_num: proposalData.mobileBankingNum,

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

      pkg_new_cr_title: proposalData.pkgNewCrTitle,
      pkg_new_cr_services_t1: proposalData.pkgNewCrServicesT1,
      pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
      pkg_new_cr_services_t2: proposalData.pkgNewCrServicesT2,
      pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
      pkg_new_cr_docs: proposalData.pkgNewCrDocs,
      pkg_new_cr_timeline: proposalData.pkgNewCrTimeline,

      pkg_existing_cr_title: proposalData.pkgExistingCrTitle,
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
      bank_muscat_customer: proposalData.bankMuscatCustomer,
      bank_muscat_swift: proposalData.bankMuscatSwift,
      bank_muscat_iban: proposalData.bankMuscatIban,
      bank_muscat_acc: proposalData.bankMuscatAcc,
      bank_dhofar_customer: proposalData.bankDhofarCustomer,
      bank_dhofar_swift: proposalData.bankDhofarSwift,
      bank_dhofar_iban: proposalData.bankDhofarIban,
      bank_dhofar_acc: proposalData.bankDhofarAcc,
      mobile_banking_num: proposalData.mobileBankingNum,

      show_selfie_guide: proposalData.showSelfieGuide
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
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
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  B2B Strategic Proposal
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {isNew ? 'New Draft' : `#${id?.slice(0, 8)}`}
                </span>
              </div>
              <h1 className="text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md">
                {proposalData.submittedTo || 'Untitled Partnership Proposal'}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl border border-border transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Print / Export PDF</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Proposal'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT: FORM CONTROLS (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-4 print:hidden">

          {/* Form Section Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-muted/60 p-1 rounded-2xl border border-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormTab('recipient')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
                formTab === 'recipient'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              1. Recipient & Title
            </button>

            <button
              type="button"
              onClick={() => setFormTab('intro')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
                formTab === 'intro'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              2. Introduction
            </button>

            <button
              type="button"
              onClick={() => setFormTab('new_cr')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
                formTab === 'new_cr'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              3. New CR
            </button>

            <button
              type="button"
              onClick={() => setFormTab('existing_cr')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
                formTab === 'existing_cr'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              4. Existing CR
            </button>

            <button
              type="button"
              onClick={() => setFormTab('models')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
                formTab === 'models'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              5. Operating Models
            </button>

            <button
              type="button"
              onClick={() => setFormTab('bank_details')}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
                formTab === 'bank_details'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-blue-500" />
              <span>6. Bank Details</span>
            </button>
          </div>

          {/* TAB 1: RECIPIENT & TITLE */}
          {formTab === 'recipient' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  Partner Recipient & Header Info
                </h2>
              </div>

              {/* Source Selector */}
              <div className="grid grid-cols-3 gap-1.5 bg-muted p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setRecipientType('partner')}
                  className={`py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                    recipientType === 'partner'
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
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
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
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
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
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
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
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
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
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
                    Submitted To (Partner / Company Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={proposalData.submittedTo}
                    onChange={(e) => setProposalData({ ...proposalData, submittedTo: e.target.value })}
                    placeholder="e.g. A C H"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-emerald-500 outline-none"
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
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-500" /> Client Phone
                    </label>
                    <input
                      type="text"
                      value={proposalData.clientPhone}
                      onChange={(e) => setProposalData({ ...proposalData, clientPhone: e.target.value })}
                      placeholder="e.g. +966582288816"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Proposal Title & Presenter */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Proposal Title (Banner Heading)
                  </label>
                  <input
                    type="text"
                    value={proposalData.proposalTitle}
                    onChange={(e) => setProposalData({ ...proposalData, proposalTitle: e.target.value })}
                    placeholder="Oman Company Formation Services"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Submitted By
                    </label>
                    <input
                      type="text"
                      value={proposalData.submittedBy}
                      onChange={(e) => setProposalData({ ...proposalData, submittedBy: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Prepared By (Representative)
                    </label>
                    <input
                      type="text"
                      value={proposalData.preparedBy}
                      onChange={(e) => setProposalData({ ...proposalData, preparedBy: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Currency
                    </label>
                    <select
                      value={proposalData.currency}
                      onChange={(e) => setProposalData({ ...proposalData, currency: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none"
                    >
                      <option value="SAR">🇸🇦 SAR (Saudi Riyal)</option>
                      <option value="OMR">🇴🇲 OMR (Omani Rial)</option>
                      <option value="AED">🇦🇪 AED (UAE Dirham)</option>
                      <option value="USD">🇺🇸 USD (US Dollar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Our Phone Numbers
                    </label>
                    <input
                      type="text"
                      value={proposalData.ourPhone}
                      onChange={(e) => setProposalData({ ...proposalData, ourPhone: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTRODUCTION */}
          {formTab === 'intro' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  Page 1: Introduction Section (Editable)
                </h2>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Introduction — Paragraph 1
                </label>
                <textarea
                  rows={4}
                  value={proposalData.introP1}
                  onChange={(e) => setProposalData({ ...proposalData, introP1: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-cyan-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Introduction — Paragraph 2
                </label>
                <textarea
                  rows={3}
                  value={proposalData.introP2}
                  onChange={(e) => setProposalData({ ...proposalData, introP2: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-cyan-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: NEW CR PACKAGE */}
          {formTab === 'new_cr' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  Page 1: New Company Registration (CR) Column
                </h2>
              </div>

              {/* Column Header Title */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Column Header Title
                </label>
                <input
                  type="text"
                  value={proposalData.pkgNewCrTitle}
                  onChange={(e) => setProposalData({ ...proposalData, pkgNewCrTitle: e.target.value })}
                  placeholder="NEW COMPANY REGISTRATION (CR)"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none uppercase tracking-wide"
                />
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
                  placeholder="One service item per line"
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none"
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Tier 1 Total Amount ({proposalData.currency})
                  </span>
                  <input
                    type="number"
                    value={proposalData.pkgNewCrNoAttest}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrNoAttest: Number(e.target.value) })}
                    className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-emerald-500 outline-none text-right"
                  />
                </div>
              </div>

              {/* Tier 2 */}
              <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-2">
                <label className="text-[10px] font-bold text-foreground uppercase block">
                  Tier 2: Services List (With Attestation)
                </label>
                <textarea
                  rows={3}
                  value={proposalData.pkgNewCrServicesT2}
                  onChange={(e) => setProposalData({ ...proposalData, pkgNewCrServicesT2: e.target.value })}
                  placeholder="One service item per line"
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none"
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Tier 2 Total Amount ({proposalData.currency})
                  </span>
                  <input
                    type="number"
                    value={proposalData.pkgNewCrWithAttest}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrWithAttest: Number(e.target.value) })}
                    className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-emerald-500 outline-none text-right"
                  />
                </div>
              </div>

              {/* Required Documents */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Required Documents (Line by Line)
                </label>
                <textarea
                  rows={4}
                  value={proposalData.pkgNewCrDocs}
                  onChange={(e) => setProposalData({ ...proposalData, pkgNewCrDocs: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              {/* Processing Timeline */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Processing Timeline (Line by Line)
                </label>
                <textarea
                  rows={3}
                  value={proposalData.pkgNewCrTimeline}
                  onChange={(e) => setProposalData({ ...proposalData, pkgNewCrTimeline: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: EXISTING CR PACKAGE */}
          {formTab === 'existing_cr' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Page 1: Existing Company (CR) Package Column
                </h2>
              </div>

              {/* Column Header Title */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Column Header Title
                </label>
                <input
                  type="text"
                  value={proposalData.pkgExistingCrTitle}
                  onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrTitle: e.target.value })}
                  placeholder="EXISTING COMPANY (CR) PACKAGE"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none uppercase tracking-wide"
                />
              </div>

              {/* Services List */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-foreground uppercase block">
                  Included Package Services (Line by Line)
                </label>
                <textarea
                  rows={4}
                  value={proposalData.pkgExistingCrServices}
                  onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrServices: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Total Amount */}
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
                    className="w-32 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-emerald-500 outline-none text-right font-mono"
                  />
                  <span className="text-xs font-bold text-foreground">{proposalData.currency}</span>
                </div>
              </div>

              {/* Required Documents */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Required Documents (Line by Line)
                </label>
                <textarea
                  rows={4}
                  value={proposalData.pkgExistingCrDocs}
                  onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrDocs: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              {/* Processing Timeline */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Processing Timeline (Line by Line)
                </label>
                <textarea
                  rows={2}
                  value={proposalData.pkgExistingCrTimeline}
                  onChange={(e) => setProposalData({ ...proposalData, pkgExistingCrTimeline: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PARTNERSHIP MODELS & SURCHARGE */}
          {formTab === 'models' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-500" />
                  Page 2: Operating Models & Page 4 Selfie Guide
                </h2>
              </div>

              {/* Surcharge Note */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Surcharge Notice (Page 2 Top Box)
                </label>
                <textarea
                  rows={2}
                  value={proposalData.surchargeNote}
                  onChange={(e) => setProposalData({ ...proposalData, surchargeNote: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-cyan-500 outline-none leading-relaxed"
                />
              </div>

              {/* Option A Toggle & Description */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showOptionA}
                    onChange={(e) => setProposalData({ ...proposalData, showOptionA: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
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
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-cyan-500 outline-none"
                    />
                    <textarea
                      rows={2}
                      value={proposalData.optionADesc}
                      onChange={(e) => setProposalData({ ...proposalData, optionADesc: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-cyan-500 outline-none"
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
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
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
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-cyan-500 outline-none"
                    />
                    <textarea
                      rows={2}
                      value={proposalData.optionBDesc}
                      onChange={(e) => setProposalData({ ...proposalData, optionBDesc: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground focus:border-cyan-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Page 4 Selfie Guide Checkbox */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showSelfieGuide}
                    onChange={(e) => setProposalData({ ...proposalData, showSelfieGuide: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Include Page 4 (Corporate Contact Info & Passport Selfie Guide)</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 6: BANK ACCOUNT DETAILS */}
          {formTab === 'bank_details' && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-500" />
                  Page 3: Bank Account Details
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setProposalData(prev => ({
                      ...prev,
                      bankMuscatCustomer: 'OSBIC INTERNATIONAL LLC',
                      bankMuscatSwift: 'BMUSOMRXXX',
                      bankMuscatIban: 'OM550270423081077790019',
                      bankMuscatAcc: '0423081077790019',
                      bankDhofarCustomer: 'OSBIC INTERNATIONAL LLC',
                      bankDhofarSwift: 'BDOFOMRUXXX',
                      bankDhofarIban: 'OM390250001045788333002',
                      bankDhofarAcc: '01045788333002',
                      mobileBankingNum: '72229827'
                    }));
                    toast.success('Reset to official OSBIC bank details');
                  }}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </button>
              </div>

              {/* Master Toggle */}
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showBankDetails}
                    onChange={(e) => setProposalData({ ...proposalData, showBankDetails: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Include Official Bank Account Details Page (Page 3)</span>
                </label>
              </div>

              {proposalData.showBankDetails && (
                <div className="space-y-4 pt-1">
                  {/* 1. BANK MUSCAT */}
                  <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Bank Muscat Account
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatCustomer}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatCustomer: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:border-emerald-500 outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          SWIFT Code
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatSwift}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatSwift: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          IBAN Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatIban}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatIban: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankMuscatAcc}
                          onChange={(e) => setProposalData({ ...proposalData, bankMuscatAcc: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. BANK DHOFAR */}
                  <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Bank Dhofar Account
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarCustomer}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarCustomer: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:border-emerald-500 outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          SWIFT Code
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarSwift}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarSwift: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          IBAN Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarIban}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarIban: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={proposalData.bankDhofarAcc}
                          onChange={(e) => setProposalData({ ...proposalData, bankDhofarAcc: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. MOBILE BANKING */}
                  <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Mobile Banking Number
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Registered Mobile / Alias Number
                      </label>
                      <input
                        type="text"
                        value={proposalData.mobileBankingNum}
                        onChange={(e) => setProposalData({ ...proposalData, mobileBankingNum: e.target.value })}
                        placeholder="72229827"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ================= RIGHT: LIVE DOCUMENT PREVIEW (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          {/* Controls Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3 text-xs bg-card border border-border p-2.5 rounded-2xl shadow-sm">
            {/* Page Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActivePreviewPage('all')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  activePreviewPage === 'all'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All (1-4)
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('1')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  activePreviewPage === '1'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 1
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('2')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  activePreviewPage === '2'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 2
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('3')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  activePreviewPage === '3'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 3 (Bank)
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewPage('4')}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                  activePreviewPage === '4'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Page 4 (Contact)
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

            {/* Export PDF Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Export PDF
            </button>
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
