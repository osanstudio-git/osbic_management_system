import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { 
  ArrowLeft, Printer, Save, CheckCircle2, Building2, User, Phone, 
  Mail, ShieldCheck, Handshake, Globe, DollarSign, FileText, 
  RotateCcw, Sparkles, ChevronRight, Eye
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
    preparedBy: string;
    ourPhone: string;
    currency: string;
    showOptionA: boolean;
    showOptionB: boolean;
    pkgNewCrNoAttest: number;
    pkgNewCrWithAttest: number;
    pkgExistingCr: number;
    surchargeNote: string;
    notes: string;
    status: Invoice['status'];
  }>({
    proposalTitle: 'Oman Company Formation Services',
    submittedTo: '',
    contactPerson: '',
    clientPhone: '',
    clientEmail: '',
    preparedBy: profile?.full_name || 'ANSAR NV',
    ourPhone: '+968 72596531, +968 72229827',
    currency: 'SAR',
    showOptionA: true,
    showOptionB: true,
    pkgNewCrNoAttest: 2000,
    pkgNewCrWithAttest: 4000,
    pkgExistingCr: 12250,
    surchargeNote: 'Please note: In cases where an Iqama or Power of Attorney is unavailable, Additional 2000 SAR will be charged.',
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
        submittedTo: meta.b2b_submitted_to || initialData.client?.company_name || initialData.lead?.company_name || initialData.client?.full_name || initialData.lead?.contact_name || '',
        contactPerson: meta.b2b_contact_person || initialData.client?.full_name || initialData.lead?.contact_name || '',
        clientPhone: meta.b2b_submitted_phone || initialData.client?.phone || initialData.lead?.contact_phone || '',
        clientEmail: meta.b2b_submitted_email || initialData.client?.email || initialData.lead?.contact_email || '',
        preparedBy: meta.b2b_prepared_by || initialData.employee?.full_name || profile?.full_name || 'ANSAR NV',
        ourPhone: meta.b2b_our_phone || '+968 72596531, +968 72229827',
        currency: initialData.currency || 'SAR',
        showOptionA: meta.show_option_a !== false,
        showOptionB: meta.show_option_b !== false,
        pkgNewCrNoAttest: meta.pkg_new_cr_no_attest ?? 2000,
        pkgNewCrWithAttest: meta.pkg_new_cr_with_attest ?? 4000,
        pkgExistingCr: meta.pkg_existing_cr ?? 12250,
        surchargeNote: meta.b2b_surcharge_note || 'Please note: In cases where an Iqama or Power of Attorney is unavailable, Additional 2000 SAR will be charged.',
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
      const totalAmount = Number(proposalData.pkgExistingCr || 12250);
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
          b2b_prepared_by: proposalData.preparedBy,
          b2b_our_phone: proposalData.ourPhone,
          show_option_a: proposalData.showOptionA,
          show_option_b: proposalData.showOptionB,
          pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
          pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
          pkg_existing_cr: Number(proposalData.pkgExistingCr),
          b2b_surcharge_note: proposalData.surchargeNote,
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

  // Virtual Invoice Object for live preview
  const livePreviewInvoice: Invoice = {
    id: id || 'preview',
    type: 'quotation',
    status: proposalData.status,
    currency: proposalData.currency,
    subtotal: Number(proposalData.pkgExistingCr || 12250),
    total_amount: Number(proposalData.pkgExistingCr || 12250),
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
      b2b_prepared_by: proposalData.preparedBy,
      b2b_our_phone: proposalData.ourPhone,
      show_option_a: proposalData.showOptionA,
      show_option_b: proposalData.showOptionB,
      pkg_new_cr_no_attest: Number(proposalData.pkgNewCrNoAttest),
      pkg_new_cr_with_attest: Number(proposalData.pkgNewCrWithAttest),
      pkg_existing_cr: Number(proposalData.pkgExistingCr),
      b2b_surcharge_note: proposalData.surchargeNote
    }
  };

  const currCfg = getCurrencyConfig(proposalData.currency);

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
              className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl border border-border transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Print / PDF</span>
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

      {/* Main Workspace Layout: Left Form + Right Live 2-Page Preview */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT: FORM CONTROLS (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-5 print:hidden">

          {/* CARD 1: RECIPIENT & PARTNER SELECTION */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-500" />
                1. Recipient / B2B Partner
              </h2>
              <span className="text-[10px] text-muted-foreground">Select or Type Details</span>
            </div>

            {/* Recipient Source Selector */}
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
                Custom Name
              </button>
            </div>

            {/* Partner Dropdown */}
            {recipientType === 'partner' && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Choose Existing Partner Firm
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

            {/* Lead Dropdown */}
            {recipientType === 'lead' && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Choose Cross-Border Lead
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

            {/* Editable Contact Fields */}
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
                  placeholder="e.g. UNITED ENGINEERS CO."
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
                    placeholder="e.g. +966 50 123 4567"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PROPOSAL TITLE & PRESENTER DETAILS */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" />
              2. Scope & OSBIC Presenter
            </h2>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                Proposal Title (Banner Heading)
              </label>
              <input
                type="text"
                value={proposalData.proposalTitle}
                onChange={(e) => setProposalData({ ...proposalData, proposalTitle: e.target.value })}
                placeholder="Oman Company Formation Services"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-cyan-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Prepared By (Representative)
                </label>
                <input
                  type="text"
                  value={proposalData.preparedBy}
                  onChange={(e) => setProposalData({ ...proposalData, preparedBy: e.target.value })}
                  placeholder="ANSAR NV"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Currency
                </label>
                <select
                  value={proposalData.currency}
                  onChange={(e) => setProposalData({ ...proposalData, currency: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-cyan-500 outline-none"
                >
                  <option value="SAR">🇸🇦 SAR (Saudi Riyal) - Standard</option>
                  <option value="OMR">🇴🇲 OMR (Omani Rial)</option>
                  <option value="AED">🇦🇪 AED (UAE Dirham)</option>
                  <option value="USD">🇺🇸 USD (US Dollar)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-cyan-500" /> OSBIC Official Contact Numbers
              </label>
              <input
                type="text"
                value={proposalData.ourPhone}
                onChange={(e) => setProposalData({ ...proposalData, ourPhone: e.target.value })}
                placeholder="+968 72596531, +968 72229827"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-cyan-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* CARD 3: PARTNERSHIP MODELS & PACKAGE PRICING */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Handshake className="w-4 h-4 text-emerald-500" />
              3. Partnership Models & Package Pricing ({proposalData.currency})
            </h2>

            {/* Model Display Checkboxes */}
            <div className="bg-muted/50 p-3 rounded-xl border border-border space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">
                Included Partnership Options
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showOptionA}
                    onChange={(e) => setProposalData({ ...proposalData, showOptionA: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Option A (B2B Partnership)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={proposalData.showOptionB}
                    onChange={(e) => setProposalData({ ...proposalData, showOptionB: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Option B (Reference Referral)</span>
                </label>
              </div>
            </div>

            {/* Pricing Packages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  New CR (No Attest)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={proposalData.pkgNewCrNoAttest}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrNoAttest: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-muted-foreground font-bold">
                    {proposalData.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  New CR (With Attest)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={proposalData.pkgNewCrWithAttest}
                    onChange={(e) => setProposalData({ ...proposalData, pkgNewCrWithAttest: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-muted-foreground font-bold">
                    {proposalData.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Existing CR Package
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={proposalData.pkgExistingCr}
                    onChange={(e) => setProposalData({ ...proposalData, pkgExistingCr: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-muted-foreground font-bold">
                    {proposalData.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Surcharge Note */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                Surcharge Notice / Special Terms
              </label>
              <textarea
                rows={2}
                value={proposalData.surchargeNote}
                onChange={(e) => setProposalData({ ...proposalData, surchargeNote: e.target.value })}
                className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-emerald-500 outline-none resize-none"
                placeholder="In cases where an Iqama or Power of Attorney is unavailable, Additional 2000 SAR will be charged."
              />
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Verified 2-Page Confidential Proposal
            </div>
            <p className="text-[11px] opacity-90">
              Official company email is automatically rendered as <strong>info@osbic.net</strong>. Document includes high-resolution print styles ready for immediate PDF export.
            </p>
          </div>

        </div>

        {/* ================= RIGHT: LIVE 2-PAGE DOCUMENT PREVIEW (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          <div className="w-full flex items-center justify-between mb-3 text-xs text-muted-foreground px-2">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
              <Eye className="w-4 h-4 text-emerald-500" /> Live Document Preview (Page 1 & 2)
            </span>
            <button
              onClick={handlePrint}
              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Printer className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>

          {/* Document Container with responsive zoom/scroll */}
          <div className="w-full overflow-x-auto bg-slate-900/10 dark:bg-black/30 p-3 sm:p-6 rounded-3xl border border-border shadow-inner flex justify-center">
            <div className="transform origin-top transition-transform">
              <B2BPartnershipProposalDocument
                ref={printRef}
                invoice={livePreviewInvoice}
              />
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
