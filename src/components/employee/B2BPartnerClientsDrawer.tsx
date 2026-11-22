import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, X, User, Phone, Mail, Globe, DollarSign,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Plus,
  MessageSquare, ExternalLink, ShieldCheck, ChevronRight, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { B2BPartner } from '../../hooks/shared/useB2BPartners';
import type { Lead } from '../../hooks/shared/useLeads';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  partner: B2BPartner | null;
  leads: Lead[];
  onRefresh: () => void;
}

export const B2BPartnerClientsDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  partner,
  leads,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Client Under Partner Form State
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [nationality, setNationality] = useState('Saudi Arabia');
  const [serviceRequired, setServiceRequired] = useState('');
  const [flowType, setFlowType] = useState<'inbound_oman_exec' | 'outbound_saudi_exec'>('inbound_oman_exec');
  const [quotedAmount, setQuotedAmount] = useState<number>(0);
  const [partnerCost, setPartnerCost] = useState<number>(0);

  if (!isOpen || !partner) return null;

  // Filter leads attached to this B2B partner
  const partnerLeads = leads.filter(l => l.b2b_partner_id === partner.id);

  const filteredLeads = partnerLeads.filter(l => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (l.contact_name || '').toLowerCase().includes(q) ||
      (l.company_name || '').toLowerCase().includes(q) ||
      (l.contact_phone || '').toLowerCase().includes(q) ||
      (l.service_required || '').toLowerCase().includes(q)
    );
  });

  const totalValue = partnerLeads.reduce((acc, l) => acc + (Number(l.total_amount || l.quoted_amount) || 0), 0);
  const totalPartnerCosts = partnerLeads.reduce((acc, l) => acc + (Number(l.partner_cost) || 0), 0);
  const inboundCount = partnerLeads.filter(l => l.b2b_flow_type === 'inbound_oman_exec').length;
  const outboundCount = partnerLeads.filter(l => l.b2b_flow_type === 'outbound_saudi_exec').length;

  const openWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('Invalid phone number');
      return;
    }
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length === 8) cleanPhone = '968' + cleanPhone;
    else if (cleanPhone.length === 9 && cleanPhone.startsWith('0')) cleanPhone = '968' + cleanPhone.slice(1);

    const message = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from OSBIC Business Solutions.`);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleCreateClientUnderPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      return toast.error('Please enter client name and phone number');
    }

    setIsSubmitting(true);
    try {
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const leadCode = `LD-B2B-26-${randDigits}`;

      const { error } = await supabase.from('leads').insert({
        lead_code: leadCode,
        contact_name: contactName.trim(),
        company_name: companyName.trim() || null,
        contact_phone: contactPhone.trim(),
        contact_whatsapp: contactWhatsapp.trim() || contactPhone.trim(),
        nationality: nationality || 'Saudi Arabia',
        service_required: serviceRequired.trim() || 'Cross-Border Corporate Setup',
        b2b_partner_id: partner.id,
        b2b_flow_type: flowType,
        quoted_amount: quotedAmount || 0,
        partner_cost: partnerCost || 0,
        status: 'new',
        call_status: 'Pending'
      });

      if (error) throw error;

      toast.success(`Client added under ${partner.name}`);
      setIsAddingClient(false);
      setContactName('');
      setCompanyName('');
      setContactPhone('');
      setContactWhatsapp('');
      setServiceRequired('');
      setQuotedAmount(0);
      setPartnerCost(0);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register client under partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-3xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden text-foreground"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-emerald-950/40 via-card to-card flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/30 shrink-0">
              {partner.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {partner.country === 'KSA' ? '🇸🇦 Saudi Arabia B2B Partner' : '🇴🇲 Oman Firm'}
                </span>
                <span className="text-xs text-muted-foreground">• {partner.partner_type}</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mt-0.5">{partner.name}</h2>
              <p className="text-xs text-muted-foreground">
                Client roster and deal pipeline introduced by this B2B partner firm.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contact & Commission Strip */}
        <div className="px-6 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
            {partner.contact_person && (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <User size={13} className="text-primary" /> {partner.contact_person}
              </span>
            )}
            {partner.contact_phone && (
              <div className="flex items-center gap-1.5 font-mono">
                <Phone size={13} className="text-blue-400" />
                <span>{partner.contact_phone}</span>
                <button
                  onClick={() => openWhatsApp(partner.contact_phone, partner.contact_person || partner.name)}
                  className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  title="1-Click WhatsApp to Agent"
                >
                  <MessageSquare size={11} />
                </button>
              </div>
            )}
            {partner.contact_email && (
              <span className="flex items-center gap-1.5">
                <Mail size={13} className="text-purple-400" /> {partner.contact_email}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Commission Rate:</span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {partner.commission_rate || 0}%
            </span>
          </div>
        </div>

        {/* Aggregate KPI Banner */}
        <div className="p-6 border-b border-border bg-card grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Clients / Deals</span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">{partnerLeads.length}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Introduced</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">KSA ➔ Oman (Inbound)</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">{inboundCount}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Oman Ops Execution</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Oman ➔ KSA (Outbound)</span>
            <span className="text-xl font-bold font-mono text-sky-400 mt-0.5 block">{outboundCount}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">KSA Ground Execution</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Volume</span>
            <span className="text-xl font-bold font-mono text-primary mt-0.5 block">{totalValue.toFixed(3)}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">OMR Contract Value</span>
          </div>
        </div>

        {/* Action Controls & Search Bar */}
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clients by name, phone, service..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-emerald-500 outline-none"
            />
          </div>

          <button
            onClick={() => setIsAddingClient(!isAddingClient)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>{isAddingClient ? 'Close Form' : '+ Add Client Under This Partner'}</span>
          </button>
        </div>

        {/* Collapsible New Client Form */}
        <AnimatePresence>
          {isAddingClient && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleCreateClientUnderPartner}
              className="p-6 bg-muted/30 border-b border-border space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={14} /> Register Client under {partner.name}
                </span>
                <span className="text-[11px] text-muted-foreground">Auto-linked to partner ID</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Client Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abdulaziz Al-Saud"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Company / Enterprise</label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Riyadh Logistics LLC"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 966501234567"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    placeholder="Same as phone if empty"
                    value={contactWhatsapp}
                    onChange={e => setContactWhatsapp(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Flow Direction *</label>
                  <select
                    value={flowType}
                    onChange={e => setFlowType(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-medium"
                  >
                    <option value="inbound_oman_exec">🇸🇦➔🇴🇲 Saudi ➔ Oman (Oman Ops)</option>
                    <option value="outbound_saudi_exec">🇴🇲➔🇸🇦 Oman ➔ Saudi (KSA Partner)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Service Required</label>
                  <input
                    type="text"
                    placeholder="e.g. Oman 100% Foreign Company Registration"
                    value={serviceRequired}
                    onChange={e => setServiceRequired(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Contract Amount (OMR)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 850.000"
                    value={quotedAmount || ''}
                    onChange={e => setQuotedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{isSubmitting ? 'Registering...' : 'Save Client Under Partner'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Client Roster Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Building2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold">No clients registered under {partner.name} yet.</p>
              <p className="text-xs text-muted-foreground/70">
                Click "+ Add Client Under This Partner" above to register an inquiry or client.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="p-4">Client Name & Company</th>
                  <th className="p-4">Flow Direction</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Fee (OMR)</th>
                  <th className="p-4 text-right">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead) => {
                  const isOutbound = lead.b2b_flow_type === 'outbound_saudi_exec';

                  return (
                    <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-foreground">{lead.contact_name}</div>
                        {lead.company_name && (
                          <div className="text-[10px] text-muted-foreground">{lead.company_name}</div>
                        )}
                        <span className="text-[9px] font-mono text-muted-foreground/60">{lead.lead_code || '-'}</span>
                      </td>

                      <td className="p-4">
                        {isOutbound ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                            <ArrowUpRight size={11} /> 🇴🇲➔🇸🇦 KSA Subcontract
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <ArrowDownLeft size={11} /> 🇸🇦➔🇴🇲 Oman Ops
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="font-medium text-foreground truncate max-w-[180px]" title={lead.service_required}>
                          {lead.service_required || 'Corporate Setup'}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted border border-border">
                          {lead.status}
                        </span>
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-foreground">
                        {Number(lead.total_amount || lead.quoted_amount || 0).toFixed(3)}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lead.contact_phone && (
                            <>
                              <button
                                onClick={() => openWhatsApp(lead.contact_whatsapp || lead.contact_phone, lead.contact_name)}
                                className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <a
                                href={`tel:${lead.contact_phone}`}
                                className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                title="Call Phone"
                              >
                                <Phone size={12} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};
