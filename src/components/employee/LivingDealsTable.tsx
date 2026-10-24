import React, { useState, useMemo } from 'react';
import { format, isBefore, startOfDay, isToday } from 'date-fns';
import { 
  Phone, MessageSquare, AlertTriangle, ArrowRight, UserCheck, 
  Calendar, Check, CheckCircle2, Clock, DollarSign, Edit3, 
  ExternalLink, FileText, ChevronDown, User, ShieldAlert, Sparkles,
  TrendingUp, Award, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { type Lead, useUpdateLead } from '../../hooks/shared/useLeads';
import { type Employee } from '../../hooks/admin/useAdminEmployees';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  leads: Lead[];
  allLeads?: Lead[];
  salesReps: Employee[];
  canAssignLeads: boolean;
  isSalesHead: boolean;
  currentUserId?: string;
  onSelectLead: (lead: Lead) => void;
  onOpenQuickInteraction?: (lead: Lead) => void;
}

export const LivingDealsTable: React.FC<Props> = ({
  leads,
  allLeads = [],
  salesReps,
  canAssignLeads,
  isSalesHead,
  currentUserId,
  onSelectLead,
  onOpenQuickInteraction,
}) => {
  const updateLeadMutation = useUpdateLead();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [tempValues, setTempValues] = useState<Record<string, any>>({});
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);

  // Phone duplication detector
  const duplicatePhoneSet = useMemo(() => {
    const counts: Record<string, number> = {};
    const dataset = allLeads.length > 0 ? allLeads : leads;
    dataset.forEach(l => {
      const clean = (l.contact_phone || '').replace(/\D/g, '');
      if (clean.length >= 7) {
        counts[clean] = (counts[clean] || 0) + 1;
      }
    });
    const dupes = new Set<string>();
    Object.entries(counts).forEach(([phone, count]) => {
      if (count > 1) dupes.add(phone);
    });
    return dupes;
  }, [leads, allLeads]);

  const handleInlineSave = async (leadId: string, field: string, value: any) => {
    setEditingCell(null);
    try {
      const updates: Record<string, any> = { [field]: value };
      
      // Auto-compute profits locally for instant feedback if fields are financial
      if (field === 'quoted_amount' || field === 'expected_govt_fee') {
        const lead = leads.find(l => l.id === leadId);
        const q = field === 'quoted_amount' ? (Number(value) || 0) : (lead?.quoted_amount || 0);
        const egf = field === 'expected_govt_fee' ? (Number(value) || 0) : (lead?.expected_govt_fee || 0);
        updates.expected_profit = Math.max(0, q - egf);
      } else if (field === 'total_amount' || field === 'govt_fee') {
        const lead = leads.find(l => l.id === leadId);
        const tot = field === 'total_amount' ? (Number(value) || 0) : (lead?.total_amount || 0);
        const gf = field === 'govt_fee' ? (Number(value) || 0) : (lead?.govt_fee || 0);
        updates.profit = tot - gf;
        if (tot > 0 && !lead?.conversion_date) {
          updates.conversion_date = format(new Date(), 'yyyy-MM-dd');
          updates.status = 'converted';
        }
      }

      await updateLeadMutation.mutateAsync({ id: leadId, updates });
      toast.success('Updated', { duration: 1500 });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update deal');
    }
  };

  const handleReassign = async (lead: Lead, targetRepId: string) => {
    if (!targetRepId || targetRepId === lead.assigned_to) {
      setReassigningLeadId(null);
      return;
    }
    const targetRep = salesReps.find(r => r.id === targetRepId);
    try {
      await updateLeadMutation.mutateAsync({
        id: lead.id,
        updates: {
          assigned_to: targetRepId,
          is_reassigned: true,
          reassigned_from_id: lead.assigned_to,
          date_reassigned: new Date().toISOString()
        }
      });
      toast.success(`Lead reassigned to ${targetRep?.full_name || 'rep'}`);
      setReassigningLeadId(null);
    } catch (err: any) {
      toast.error(err.message || 'Reassignment failed');
    }
  };

  const openWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from OSBIC Business Solutions. How can we assist you today?`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Table Sub-Header / Stage Legend */}
      <div className="px-6 py-3 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Zap size={14} className="text-primary" /> Single Living Deal Grid
          </span>
          <span className="text-muted-foreground/60">|</span>
          <span className="text-muted-foreground text-[11px]">
            {leads.length} Active Deal{leads.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Pipeline Stage Indicators */}
        <div className="flex items-center gap-3 text-[10px] font-bold tracking-wide">
          <span className="flex items-center gap-1 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> 1. Inbound & Outreach
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> 2. Follow-Up Radar
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className="flex items-center gap-1 text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-400" /> 3. Pipeline & Forecast
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> 4. Won & Net Profit
          </span>
        </div>
      </div>

      {/* Living Rows Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-muted/80 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">
              {/* STAGE 1: Client & Lead */}
              <th className="p-3 sticky left-0 z-20 bg-muted/95 backdrop-blur shadow-[2px_0_5px_rgba(0,0,0,0.1)] min-w-[200px]">
                Client / Contact
              </th>
              <th className="p-3 min-w-[140px]">Phone & Actions</th>
              <th className="p-3 min-w-[140px]">Service Interested</th>
              <th className="p-3 min-w-[120px]">Source</th>
              
              {/* STAGE 2: Outreach & Call */}
              <th className="p-3 min-w-[150px] bg-blue-500/5 text-blue-400 border-l border-border">1st Call Status</th>
              <th className="p-3 min-w-[180px] bg-blue-500/5 text-blue-400">1st Call Notes</th>
              
              {/* STAGE 3: Follow-Up Radar */}
              <th className="p-3 min-w-[140px] bg-amber-500/5 text-amber-400 border-l border-border">2nd Follow-up</th>
              <th className="p-3 min-w-[150px] bg-amber-500/5 text-amber-400">Next Follow-Up Date</th>
              <th className="p-3 min-w-[180px] bg-amber-500/5 text-amber-400">Follow-up Notes</th>

              {/* STAGE 4: Pipeline & Forecast */}
              <th className="p-3 min-w-[130px] bg-purple-500/5 text-purple-400 border-l border-border">Quote Date</th>
              <th className="p-3 min-w-[120px] bg-purple-500/5 text-purple-400">Quoted (OMR)</th>
              <th className="p-3 min-w-[120px] bg-purple-500/5 text-purple-400">Exp. Govt Fee</th>
              <th className="p-3 min-w-[120px] bg-purple-500/5 text-purple-400 font-black">Exp. Profit</th>
              <th className="p-3 min-w-[130px] bg-purple-500/5 text-purple-400">Exp. Close Date</th>

              {/* STAGE 5: Closed Sale & Net Profit */}
              <th className="p-3 min-w-[130px] bg-emerald-500/5 text-emerald-400 border-l border-border">Won Date</th>
              <th className="p-3 min-w-[120px] bg-emerald-500/5 text-emerald-400">Pay Mode</th>
              <th className="p-3 min-w-[120px] bg-emerald-500/5 text-emerald-400">Total Sale (OMR)</th>
              <th className="p-3 min-w-[120px] bg-emerald-500/5 text-emerald-400">Govt Fee</th>
              <th className="p-3 min-w-[130px] bg-emerald-500/10 text-emerald-300 font-black">Net Profit</th>

              {/* CONDITIONAL: Lead Coordinator Reassignment Columns (Sandra's Role) */}
              {(canAssignLeads || isSalesHead) && (
                <>
                  <th className="p-3 min-w-[170px] bg-indigo-500/10 text-indigo-300 border-l border-border">
                    🎯 Reassign To
                  </th>
                  <th className="p-3 min-w-[140px] bg-indigo-500/10 text-indigo-300">
                    Date Reassigned
                  </th>
                </>
              )}

              {/* Assigned Rep info for Sales Head */}
              {isSalesHead && (
                <th className="p-3 min-w-[140px] bg-muted/60 text-muted-foreground border-l border-border">
                  Current Rep
                </th>
              )}

              <th className="p-3 sticky right-0 z-10 bg-muted/95 backdrop-blur text-center min-w-[80px]">
                Open
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={24} className="py-16 text-center text-muted-foreground text-sm">
                  No deals found matching the current filter.
                </td>
              </tr>
            ) : (
              leads.map((lead, idx) => {
                const cleanPhone = (lead.contact_phone || '').replace(/\D/g, '');
                const isDuplicatePhone = cleanPhone.length >= 7 && duplicatePhoneSet.has(cleanPhone);
                
                // Follow up radar calculation
                let radarStatus: 'overdue' | 'today' | 'upcoming' | 'none' = 'none';
                if (lead.next_follow_up_at) {
                  const fDate = new Date(lead.next_follow_up_at);
                  if (isToday(fDate)) {
                    radarStatus = 'today';
                  } else if (isBefore(fDate, startOfDay(new Date()))) {
                    radarStatus = 'overdue';
                  } else {
                    radarStatus = 'upcoming';
                  }
                }

                // Calculated Profits
                const quotedAmt = Number(lead.quoted_amount) || 0;
                const expGovtFee = Number(lead.expected_govt_fee) || 0;
                const expectedProfit = lead.expected_profit != null ? Number(lead.expected_profit) : Math.max(0, quotedAmt - expGovtFee);

                const totalAmt = Number(lead.total_amount) || 0;
                const actualGovtFee = Number(lead.govt_fee) || 0;
                const actualProfit = lead.profit != null ? Number(lead.profit) : (totalAmt - actualGovtFee);

                const isConverted = lead.status === 'converted' || totalAmt > 0;

                return (
                  <tr 
                    key={lead.id} 
                    className={cn(
                      "hover:bg-white/[0.02] transition-colors group",
                      idx % 2 === 0 ? "bg-card" : "bg-card/40",
                      isConverted && "bg-emerald-950/10 hover:bg-emerald-950/20"
                    )}
                  >
                    {/* Sticky Client Name */}
                    <td className="p-3 sticky left-0 z-20 bg-card/95 backdrop-blur shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-foreground hover:text-primary transition-colors text-left truncate max-w-[170px]"
                          title={lead.contact_name}
                        >
                          {lead.contact_name}
                        </button>
                        {lead.lead_code && (
                          <span className="text-[9px] font-mono bg-muted/60 text-muted-foreground px-1 py-0.5 rounded">
                            {lead.lead_code}
                          </span>
                        )}
                        {lead.is_reassigned && (
                          <span className="text-[8px] font-bold bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/30" title="Transferred Lead">
                            Transferred
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone & Instant Actions */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {lead.contact_phone || '—'}
                        </span>
                        {lead.contact_phone && (
                          <>
                            <button
                              onClick={() => openWhatsApp(lead.contact_phone, lead.contact_name)}
                              className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              title="1-Click WhatsApp"
                            >
                              <MessageSquare size={12} />
                            </button>
                            <a
                              href={`tel:${lead.contact_phone}`}
                              className="p-1 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                              title="Call Phone"
                            >
                              <Phone size={12} />
                            </a>
                          </>
                        )}
                        {isDuplicatePhone && (
                          <span 
                            className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse" 
                            title="Duplicate Phone Number Detected across system"
                          >
                            <AlertTriangle size={9} /> DUP
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Service Required */}
                    <td className="p-3">
                      {editingCell?.id === lead.id && editingCell?.field === 'service_required' ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={lead.service_required || ''}
                          onBlur={e => handleInlineSave(lead.id, 'service_required', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleInlineSave(lead.id, 'service_required', (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="bg-muted/80 border border-primary px-2 py-1 rounded text-xs text-foreground outline-none w-32"
                        />
                      ) : (
                        <div 
                          onClick={() => setEditingCell({ id: lead.id, field: 'service_required' })}
                          className="cursor-pointer hover:text-primary transition-colors truncate max-w-[140px] text-muted-foreground"
                          title="Click to edit service"
                        >
                          {lead.service_required || (lead.interested_services?.[0]?.name) || <span className="italic opacity-40">+ Add Service</span>}
                        </div>
                      )}
                    </td>

                    {/* Source */}
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {lead.lead_sources?.name || lead.utm_source || 'Direct'}
                    </td>

                    {/* 1st Call Status */}
                    <td className="p-3 bg-blue-500/[0.02] border-l border-border">
                      <select
                        value={lead.call_status || 'Pending'}
                        onChange={e => handleInlineSave(lead.id, 'call_status', e.target.value)}
                        className={cn(
                          "bg-muted/50 border rounded-lg px-2 py-1 text-[11px] font-medium outline-none cursor-pointer transition-all",
                          lead.call_status === '1st Call Done' ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" :
                          lead.call_status === 'Connected Through Watsapp' ? "border-teal-500/40 text-teal-400 bg-teal-500/10" :
                          lead.call_status === 'RNR' || lead.call_status === 'Busy' ? "border-amber-500/40 text-amber-400 bg-amber-500/10" :
                          lead.call_status === 'Invalid Number' || lead.call_status === 'Not Interested' ? "border-red-500/40 text-red-400 bg-red-500/10" :
                          "border-border text-foreground"
                        )}
                      >
                        <option value="Pending">Pending 1st Call</option>
                        <option value="1st Call Done">1st Call Done</option>
                        <option value="Connected Through Watsapp">Connected Through WhatsApp</option>
                        <option value="RNR">RNR (Ringing)</option>
                        <option value="Busy">Busy</option>
                        <option value="Switch Off">Switch Off</option>
                        <option value="Invalid Number">Invalid Number</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                    </td>

                    {/* 1st Call Notes */}
                    <td className="p-3 bg-blue-500/[0.02]">
                      {editingCell?.id === lead.id && editingCell?.field === 'first_call_notes' ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={lead.first_call_notes || ''}
                          onBlur={e => handleInlineSave(lead.id, 'first_call_notes', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleInlineSave(lead.id, 'first_call_notes', (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="bg-muted/80 border border-primary px-2 py-1 rounded text-xs text-foreground outline-none w-44"
                        />
                      ) : (
                        <div 
                          onClick={() => setEditingCell({ id: lead.id, field: 'first_call_notes' })}
                          className="cursor-pointer hover:text-primary transition-colors truncate max-w-[170px] text-muted-foreground"
                          title={lead.first_call_notes || 'Click to add notes'}
                        >
                          {lead.first_call_notes || <span className="italic opacity-40">+ 1st Call Notes</span>}
                        </div>
                      )}
                    </td>

                    {/* 2nd Follow-up Status */}
                    <td className="p-3 bg-amber-500/[0.02] border-l border-border">
                      <select
                        value={lead.second_followup_status || ''}
                        onChange={e => handleInlineSave(lead.id, 'second_followup_status', e.target.value)}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none cursor-pointer"
                      >
                        <option value="">— Select Status —</option>
                        <option value="Interested">Interested</option>
                        <option value="Follow Up Required">Follow Up Required</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Negotiating">Negotiating</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </td>

                    {/* Next Follow-Up Date with Radar */}
                    <td className="p-3 bg-amber-500/[0.02]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), 'yyyy-MM-dd') : ''}
                          onChange={e => handleInlineSave(lead.id, 'next_follow_up_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                        />
                        {radarStatus === 'overdue' && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                            OVERDUE
                          </span>
                        )}
                        {radarStatus === 'today' && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            TODAY
                          </span>
                        )}
                        {radarStatus === 'upcoming' && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
                            PLANNED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Follow-up Notes */}
                    <td className="p-3 bg-amber-500/[0.02]">
                      {editingCell?.id === lead.id && editingCell?.field === 'final_notes' ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={lead.final_notes || lead.follow_up_notes || ''}
                          onBlur={e => handleInlineSave(lead.id, 'final_notes', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleInlineSave(lead.id, 'final_notes', (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="bg-muted/80 border border-primary px-2 py-1 rounded text-xs text-foreground outline-none w-44"
                        />
                      ) : (
                        <div 
                          onClick={() => setEditingCell({ id: lead.id, field: 'final_notes' })}
                          className="cursor-pointer hover:text-primary transition-colors truncate max-w-[170px] text-muted-foreground"
                          title={lead.final_notes || 'Click to add follow-up notes'}
                        >
                          {lead.final_notes || lead.follow_up_notes || <span className="italic opacity-40">+ Follow-up Notes</span>}
                        </div>
                      )}
                    </td>

                    {/* Quote Date */}
                    <td className="p-3 bg-purple-500/[0.02] border-l border-border">
                      <input
                        type="date"
                        value={lead.quote_date || ''}
                        onChange={e => handleInlineSave(lead.id, 'quote_date', e.target.value || null)}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                      />
                    </td>

                    {/* Quoted Amount */}
                    <td className="p-3 bg-purple-500/[0.02]">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        defaultValue={lead.quoted_amount ?? ''}
                        onBlur={e => handleInlineSave(lead.id, 'quoted_amount', Number(e.target.value) || 0)}
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-purple-300 outline-none text-right"
                      />
                    </td>

                    {/* Expected Govt Fee */}
                    <td className="p-3 bg-purple-500/[0.02]">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        defaultValue={lead.expected_govt_fee ?? ''}
                        onBlur={e => handleInlineSave(lead.id, 'expected_govt_fee', Number(e.target.value) || 0)}
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-muted-foreground outline-none text-right"
                      />
                    </td>

                    {/* Expected Profit (Auto-calculated) */}
                    <td className="p-3 bg-purple-500/[0.02]">
                      <span className="font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 text-[11px]">
                        {expectedProfit.toFixed(3)}
                      </span>
                    </td>

                    {/* Expected Close Date */}
                    <td className="p-3 bg-purple-500/[0.02]">
                      <input
                        type="date"
                        value={lead.expected_close_date || ''}
                        onChange={e => handleInlineSave(lead.id, 'expected_close_date', e.target.value || null)}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                      />
                    </td>

                    {/* Won Date */}
                    <td className="p-3 bg-emerald-500/[0.02] border-l border-border">
                      <input
                        type="date"
                        value={lead.conversion_date || ''}
                        onChange={e => handleInlineSave(lead.id, 'conversion_date', e.target.value || null)}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                      />
                    </td>

                    {/* Payment Mode */}
                    <td className="p-3 bg-emerald-500/[0.02]">
                      <select
                        value={lead.payment_mode || ''}
                        onChange={e => handleInlineSave(lead.id, 'payment_mode', e.target.value)}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none cursor-pointer"
                      >
                        <option value="">— Mode —</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card</option>
                        <option value="cheque">Cheque</option>
                        <option value="online">Online</option>
                      </select>
                    </td>

                    {/* Total Sale Amount */}
                    <td className="p-3 bg-emerald-500/[0.02]">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        defaultValue={lead.total_amount ?? ''}
                        onBlur={e => handleInlineSave(lead.id, 'total_amount', Number(e.target.value) || 0)}
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-emerald-400 font-bold outline-none text-right"
                      />
                    </td>

                    {/* Actual Govt Fee */}
                    <td className="p-3 bg-emerald-500/[0.02]">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        defaultValue={lead.govt_fee ?? ''}
                        onBlur={e => handleInlineSave(lead.id, 'govt_fee', Number(e.target.value) || 0)}
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-muted-foreground outline-none text-right"
                      />
                    </td>

                    {/* Net Profit (Auto Calculated: Total - Govt Fee) */}
                    <td className="p-3 bg-emerald-500/[0.05]">
                      <span className={cn(
                        "font-mono font-black px-2 py-1 rounded border text-[11px]",
                        actualProfit > 0 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        OMR {actualProfit.toFixed(3)}
                      </span>
                    </td>

                    {/* Reassign To Column (Visible for Coordinator / Sales Head) */}
                    {(canAssignLeads || isSalesHead) && (
                      <>
                        <td className="p-3 bg-indigo-500/[0.05] border-l border-border">
                          <select
                            value={lead.assigned_to || ''}
                            onChange={e => handleReassign(lead, e.target.value)}
                            className="bg-muted/70 border border-indigo-500/30 rounded-lg px-2 py-1 text-[11px] font-bold text-indigo-300 outline-none cursor-pointer max-w-[150px]"
                          >
                            <option value="">Select Rep...</option>
                            {salesReps.map(rep => (
                              <option key={rep.id} value={rep.id}>
                                {rep.full_name} {rep.id === currentUserId ? '(You)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 bg-indigo-500/[0.05] text-[10px] font-mono text-muted-foreground">
                          {lead.date_reassigned ? format(new Date(lead.date_reassigned), 'yyyy-MM-dd HH:mm') : '—'}
                        </td>
                      </>
                    )}

                    {/* Current Rep for Sales Head */}
                    {isSalesHead && (
                      <td className="p-3 border-l border-border text-[11px] font-medium text-muted-foreground">
                        {lead.assigned_to_profile?.full_name || 'Unassigned'}
                      </td>
                    )}

                    {/* View/Details Button */}
                    <td className="p-3 sticky right-0 z-10 bg-card/95 backdrop-blur text-center">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="p-1.5 rounded-lg bg-muted/60 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-all"
                        title="View Full Lead & Interactions"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
