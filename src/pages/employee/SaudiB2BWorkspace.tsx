import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Globe, ArrowUpRight, ArrowDownLeft, Plus, Search,
  DollarSign, FileText, ShieldCheck, Handshake, X
} from 'lucide-react';
import { useB2BPartners, useCreateB2BPartner } from '../../hooks/shared/useB2BPartners';
import type { Lead } from '../../hooks/shared/useLeads';
import { useCurrencyRates } from '../../hooks/shared/useCurrencyRates';
import { supabase } from '../../lib/supabase';

export default function SaudiB2BWorkspace() {
  const navigate = useNavigate();
  const { data: partners = [] } = useB2BPartners();
  const { data: leads = [], refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ['b2b_workspace_leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Lead[];
    }
  });
  const { data: currencyData } = useCurrencyRates();
  const rates = currencyData?.rates || {};
  const createPartnerMutation = useCreateB2BPartner();

  // State
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound' | 'partners'>('outbound');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<Lead | null>(null);

  // New partner form state
  const [newPartner, setNewPartner] = useState({
    name: '',
    country: 'KSA' as 'KSA' | 'OMN' | 'OTHER',
    partner_type: 'execution' as 'execution' | 'sales_referral' | 'hybrid',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    commission_rate: 0,
    notes: '',
  });

  // Partner assignment state
  const [assignState, setAssignState] = useState({
    partner_id: '',
    flow_type: 'outbound_saudi_exec' as 'outbound_saudi_exec' | 'inbound_oman_exec',
    partner_cost: 0,
    partner_notes: '',
  });

  const sarRate = rates['SAR'] || 9.75; // OMR to SAR rate approx

  // Filtered leads
  const crossBorderLeads = leads.filter(l => l.b2b_flow_type || l.b2b_partner_id || l.nationality === 'Saudi Arabia' || l.nationality === 'Saudi');

  const lowerSearch = searchTerm.toLowerCase().trim();

  const rawOutboundLeads = crossBorderLeads.filter(l => l.b2b_flow_type === 'outbound_saudi_exec' || (!l.b2b_flow_type && l.nationality !== 'Saudi Arabia'));
  const rawInboundLeads = crossBorderLeads.filter(l => l.b2b_flow_type === 'inbound_oman_exec' || (!l.b2b_flow_type && (l.nationality === 'Saudi Arabia' || l.nationality === 'Saudi')));

  const outboundLeads = rawOutboundLeads.filter(l => 
    !lowerSearch || 
    l.contact_name?.toLowerCase().includes(lowerSearch) || 
    l.company_name?.toLowerCase().includes(lowerSearch)
  );

  const inboundLeads = rawInboundLeads.filter(l => 
    !lowerSearch || 
    l.contact_name?.toLowerCase().includes(lowerSearch) || 
    l.company_name?.toLowerCase().includes(lowerSearch)
  );

  const filteredPartners = partners.filter(p =>
    !lowerSearch ||
    p.name.toLowerCase().includes(lowerSearch) ||
    p.contact_person?.toLowerCase().includes(lowerSearch)
  );

  // Metrics
  const outboundCount = rawOutboundLeads.length;
  const inboundCount = rawInboundLeads.length;

  const totalPartnerCosts = crossBorderLeads.reduce((acc, lead) => acc + (Number(lead.partner_cost) || 0), 0);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name.trim()) return;

    try {
      await createPartnerMutation.mutateAsync({
        ...newPartner,
        status: 'active',
      });
      setShowAddPartnerModal(false);
      setNewPartner({
        name: '',
        country: 'KSA',
        partner_type: 'execution',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        commission_rate: 0,
        notes: '',
      });
    } catch (err) {
      console.error('Failed to create partner:', err);
    }
  };

  const handleSaveLeadAssignment = async () => {
    if (!selectedLeadForAssign) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          b2b_partner_id: assignState.partner_id || null,
          b2b_flow_type: assignState.flow_type,
          partner_cost: assignState.partner_cost,
          partner_notes: assignState.partner_notes,
        } as any)
        .eq('id', selectedLeadForAssign.id);

      if (error) throw error;
      setSelectedLeadForAssign(null);
      refetchLeads();
    } catch (err) {
      console.error('Failed to update lead B2B assignment:', err);
    }
  };

  const openAssignModal = (lead: Lead) => {
    setSelectedLeadForAssign(lead);
    setAssignState({
      partner_id: lead.b2b_partner_id || '',
      flow_type: lead.b2b_flow_type || (lead.nationality === 'Saudi Arabia' ? 'inbound_oman_exec' : 'outbound_saudi_exec'),
      partner_cost: lead.partner_cost || 0,
      partner_notes: lead.partner_notes || '',
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-foreground">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-background border border-emerald-500/20 text-foreground p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Globe className="w-4 h-4" /> Saudi Arabia & GCC B2B Operations
            </div>
            <h1 className="text-2xl md:text-3xl font-syne font-black tracking-tight text-foreground flex items-center gap-3">
              Cross-Border B2B Hub
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/30 font-bold">
                Live SAR API Sync
              </span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Manage Saudi B2B partners, subcontracted ground operations in KSA, and inbound Saudi business setups in Oman.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/employee/quotations/new?type=b2b_proposal&currency=SAR')}
              className="px-4 py-2.5 bg-cyan-500 text-cyan-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all flex items-center gap-2 text-xs"
            >
              <FileText className="w-4 h-4" /> Create B2B Partnership Proposal
            </button>
            <button
              onClick={() => navigate('/employee/quotations/new?currency=SAR')}
              className="px-4 py-2.5 bg-emerald-500 text-emerald-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> Create SAR Quotation
            </button>
            <button
              onClick={() => setShowAddPartnerModal(true)}
              className="px-4 py-2.5 bg-primary/10 border border-primary/20 text-primary font-bold rounded-xl hover:bg-primary/20 transition-all flex items-center gap-2 text-xs"
            >
              <Handshake className="w-4 h-4 text-emerald-400" /> Add B2B Partner
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-emerald-500/20">
          <div className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Active B2B Partners
            </div>
            <div className="text-2xl font-mono font-bold text-foreground mt-1">{partners.length} Firms</div>
            <div className="text-[10px] text-emerald-400 font-bold mt-0.5">Saudi & Oman Partners</div>
          </div>

          <div className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" /> Outbound KSA Deals
            </div>
            <div className="text-2xl font-mono font-bold text-foreground mt-1">{outboundCount}</div>
            <div className="text-[10px] text-blue-300 font-bold mt-0.5">Oman Client → KSA Exec</div>
          </div>

          <div className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" /> Inbound Oman Deals
            </div>
            <div className="text-2xl font-mono font-bold text-foreground mt-1">{inboundCount}</div>
            <div className="text-[10px] text-amber-300 font-bold mt-0.5">Saudi Client → Oman Exec</div>
          </div>

          <div className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
            <div className="text-muted-foreground text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Est. Partner Costs
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
              {(totalPartnerCosts * sarRate).toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR
            </div>
            <div className="text-[10px] text-muted-foreground font-bold mt-0.5">Subcontractor payouts</div>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('outbound')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
              activeTab === 'outbound'
                ? 'bg-emerald-500 text-emerald-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> 
            Flow 1: Oman → KSA Subcontracting
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-background/50 font-mono">
              {outboundCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inbound')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
              activeTab === 'inbound'
                ? 'bg-emerald-500 text-emerald-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" /> 
            Flow 2: KSA → Oman Referrals
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-background/50 font-mono">
              {inboundCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
              activeTab === 'partners'
                ? 'bg-emerald-500 text-emerald-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" /> 
            B2B Partner Firms
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-background/50 font-mono">
              {partners.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads or partners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* TAB CONTENT 1 & 2: LEADS (OUTBOUND / INBOUND) */}
      {(activeTab === 'outbound' || activeTab === 'inbound') && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/90 leading-relaxed">
              <strong className="text-amber-200">{activeTab === 'outbound' ? 'Flow 1 (Outbound Saudi Execution):' : 'Flow 2 (Inbound Oman Execution):'}</strong>{' '}
              {activeTab === 'outbound'
                ? 'Oman clients wanting Saudi company registration or government services. OSBIC Oman handles billing and assigns execution to verified Saudi B2B subcontractor partner firms.'
                : 'Saudi clients / partners wanting Oman company setup & PRO services. Originated by Saudi Sales/Partner, executed in Oman by OSBIC Oman fulfillment team.'}
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground font-bold tracking-widest border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Client / Lead</th>
                    <th className="px-6 py-4">Flow Type</th>
                    <th className="px-6 py-4">Assigned B2B Partner</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Partner Cost</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(activeTab === 'outbound' ? outboundLeads : inboundLeads).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No cross-border leads found for this flow. Click <strong>"Assign B2B Partner"</strong> on any lead to populate this dashboard.
                      </td>
                    </tr>
                  ) : (
                    (activeTab === 'outbound' ? outboundLeads : inboundLeads).map((lead) => {
                      const partner = partners.find(p => p.id === lead.b2b_partner_id);

                      return (
                        <tr key={lead.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground text-sm">{lead.contact_name}</div>
                            {lead.company_name && (
                              <div className="text-xs text-muted-foreground">{lead.company_name}</div>
                            )}
                            <div className="text-[10px] font-bold text-emerald-500 mt-0.5">
                              {lead.nationality || 'GCC Client'}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                              lead.b2b_flow_type === 'outbound_saudi_exec'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {lead.b2b_flow_type === 'outbound_saudi_exec' ? (
                                <><ArrowUpRight className="w-3 h-3" /> Oman → Saudi Exec</>
                              ) : (
                                <><ArrowDownLeft className="w-3 h-3" /> Saudi → Oman Exec</>
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {partner ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                <div>
                                  <div className="font-bold text-foreground text-xs">{partner.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{partner.country} ({partner.partner_type})</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-500 font-bold italic">
                                Unassigned Partner
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span className="capitalize px-2.5 py-1 bg-muted/50 text-foreground rounded-lg text-xs font-bold">
                              {lead.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 font-mono font-bold text-foreground text-xs">
                            {lead.partner_cost ? `${lead.partner_cost} OMR` : '0 OMR'}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openAssignModal(lead)}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-xl hover:bg-emerald-500/20 font-bold transition-all"
                              >
                                {partner ? 'Manage B2B' : 'Assign Partner'}
                              </button>
                              <button
                                onClick={() => navigate(`/employee/quotations/new?lead_id=${lead.id}&currency=SAR`)}
                                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 text-xs rounded-xl hover:bg-primary/20 font-bold transition-all"
                                title="Create SAR Quote"
                              >
                                Quote (SAR)
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PARTNER DIRECTORY */}
      {activeTab === 'partners' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredPartners.map((partner) => {
            const assignedCount = crossBorderLeads.filter(l => l.b2b_partner_id === partner.id).length;

            return (
              <div key={partner.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-emerald-500/50 transition-all space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
                      {partner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-syne font-bold text-foreground text-base">{partner.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {partner.country === 'KSA' ? '🇸🇦 Saudi Arabia Firm' : '🇴🇲 Oman Firm'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider border ${
                    partner.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {partner.status}
                  </span>
                </div>

                <div className="pt-3 border-t border-border/60 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Contact Person:</span>
                    <span className="font-bold text-foreground">{partner.contact_person || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Email / Phone:</span>
                    <span className="font-bold text-foreground">{partner.contact_email || partner.contact_phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Partner Role:</span>
                    <span className="capitalize font-bold text-emerald-400">{partner.partner_type}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Assigned Deals:</span>
                    <span className="font-mono font-bold text-foreground">{assignedCount} Leads/Jobs</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD B2B PARTNER */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-3xl max-w-md w-full p-6 border border-border shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-syne font-bold text-lg text-foreground flex items-center gap-2">
                <Handshake className="w-5 h-5 text-emerald-500" /> Add B2B Partner Firm
              </h3>
              <button onClick={() => setShowAddPartnerModal(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Company / Partner Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Riyadh Corporate Services LLC"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Country</label>
                  <select
                    value={newPartner.country}
                    onChange={(e) => setNewPartner({ ...newPartner, country: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="KSA">🇸🇦 Saudi Arabia (KSA)</option>
                    <option value="OMN">🇴🇲 Oman (OMN)</option>
                    <option value="OTHER">GCC / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Partner Role</label>
                  <select
                    value={newPartner.partner_type}
                    onChange={(e) => setNewPartner({ ...newPartner, partner_type: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="execution">Subcontractor / Execution</option>
                    <option value="sales_referral">Lead Referral / Agent</option>
                    <option value="hybrid">Hybrid Partner</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Manager Name"
                    value={newPartner.contact_person}
                    onChange={(e) => setNewPartner({ ...newPartner, contact_person: e.target.value })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+966 5..."
                    value={newPartner.contact_phone}
                    onChange={(e) => setNewPartner({ ...newPartner, contact_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowAddPartnerModal(false)} className="px-4 py-2 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-500 text-emerald-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">Save B2B Partner</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: ASSIGN PARTNER TO LEAD */}
      {selectedLeadForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-3xl max-w-lg w-full p-6 border border-border shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-syne font-bold text-lg text-foreground">B2B Cross-Border Setup</h3>
                <p className="text-xs text-muted-foreground">Lead: {selectedLeadForAssign.contact_name}</p>
              </div>
              <button onClick={() => setSelectedLeadForAssign(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Operation Flow Type</label>
                <select
                  value={assignState.flow_type}
                  onChange={(e) => setAssignState({ ...assignState, flow_type: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="outbound_saudi_exec">Flow 1: Outbound (Oman Client → Saudi Execution)</option>
                  <option value="inbound_oman_exec">Flow 2: Inbound (Saudi Client → Oman Execution)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Assigned B2B Subcontractor / Partner</label>
                <select
                  value={assignState.partner_id}
                  onChange={(e) => setAssignState({ ...assignState, partner_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select B2B Partner Firm --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.country})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Partner Cost / Fee (OMR)</label>
                <input
                  type="number"
                  placeholder="Wholesale fee billed by partner..."
                  value={assignState.partner_cost}
                  onChange={(e) => setAssignState({ ...assignState, partner_cost: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Execution Notes</label>
                <textarea
                  rows={3}
                  placeholder="Special instructions or partner scope..."
                  value={assignState.partner_notes}
                  onChange={(e) => setAssignState({ ...assignState, partner_notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button onClick={() => setSelectedLeadForAssign(null)} className="px-4 py-2 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleSaveLeadAssignment} className="px-5 py-2 bg-emerald-500 text-emerald-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">Update Lead Assignment</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
