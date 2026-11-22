import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, User, Building2, Phone, Calendar, DollarSign,
  CheckCircle2, ArrowDownLeft, ShieldAlert, Sparkles, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import type { Lead } from '../../hooks/shared/useLeads';
import { ensureClientProfile } from '../../utils/clientProvisioning';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSuccess: () => void;
  defaultSarRate?: number;
}

export const AssignToOmanOpsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  lead,
  onSuccess,
  defaultSarRate = 9.75
}) => {
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Currency & Financial state
  const [inputCurrency, setInputCurrency] = useState<'SAR' | 'OMR'>('SAR');
  const [sarRate, setSarRate] = useState<number>(defaultSarRate);
  const [quotedInput, setQuotedInput] = useState<number>(
    lead ? (lead.quoted_amount ? Number(lead.quoted_amount) * defaultSarRate : 9750) : 9750
  );
  const [omanGovFeeOmr, setOmanGovFeeOmr] = useState<number>(200);
  const [advanceCollectedOmr, setAdvanceCollectedOmr] = useState<number>(0);

  // Operational Assignment state
  const [serviceTitle, setServiceTitle] = useState(lead?.service_required || 'Oman 100% Foreign Investment CR Setup');
  const [selectedOpsId, setSelectedOpsId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [opsInstructions, setOpsInstructions] = useState('');

  // Fetch Ops Specialists & Managers
  const { data: opsEmployees = [] } = useQuery({
    queryKey: ['oman_ops_specialists_lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, branch_id, branches:branch_id(name)')
        .in('role', ['employee', 'manager', 'admin'])
        .order('full_name');
      return data || [];
    }
  });

  if (!isOpen || !lead) return null;

  // Compute OMR equivalent and profit
  const totalFeeOmr = inputCurrency === 'SAR' ? (quotedInput / sarRate) : quotedInput;
  const netOfficeProfitOmr = Math.max(0, totalFeeOmr - omanGovFeeOmr);

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpsId) {
      return toast.error('Please select an Oman Ops Specialist to assign this work to');
    }

    setIsSubmitting(true);
    try {
      // 1. Ensure client profile exists
      let clientId = lead.client_id;
      if (!clientId) {
        clientId = await ensureClientProfile({
          fullName: lead.contact_name,
          companyName: lead.company_name || null,
          phone: lead.contact_phone,
          whatsapp: lead.contact_whatsapp || lead.contact_phone,
          nationality: lead.nationality || 'Saudi Arabia',
          createdBy: user?.id,
          leadId: lead.id
        });
      }

      // 2. Generate specialized Saudi Job Code
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const jobCode = `JOB-KSA-26-${randDigits}`;

      // 3. Create Job in jobs table
      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          job_code: jobCode,
          client_id: clientId || null,
          service_title: serviceTitle.trim(),
          sales_employee_id: user?.id,
          ops_employee_id: selectedOpsId,
          assigned_by: user?.id,
          work_fee: netOfficeProfitOmr,
          govt_fee: omanGovFeeOmr,
          total_fee: totalFeeOmr,
          advance_amount: advanceCollectedOmr,
          advance_paid: advanceCollectedOmr > 0,
          remaining_amount: Math.max(0, totalFeeOmr - advanceCollectedOmr),
          status: 'active',
          b2b_partner_id: lead.b2b_partner_id || null,
          b2b_flow_type: 'inbound_oman_exec',
          currency: inputCurrency,
          currency_rate: sarRate,
          quoted_sar_amount: inputCurrency === 'SAR' ? quotedInput : quotedInput * sarRate,
          oman_gov_fee_omr: omanGovFeeOmr,
          notes: opsInstructions ? `[Saudi Sales Instructions]: ${opsInstructions}` : null
        })
        .select('id')
        .single();

      if (jobErr) throw jobErr;

      // 4. Update the lead to converted and link job
      await supabase
        .from('leads')
        .update({
          status: 'converted',
          conversion_date: new Date().toISOString().split('T')[0],
          b2b_flow_type: 'inbound_oman_exec',
          call_status: '1st Call Done'
        })
        .eq('id', lead.id);

      // 5. Dispatch notification to the assigned Oman Ops Specialist
      const assignedSpecialist = opsEmployees.find((e: any) => e.id === selectedOpsId);
      await supabase.from('notifications').insert({
        recipient_id: selectedOpsId,
        sender_id: user?.id,
        type: 'assignment',
        title_en: 'New Saudi ➔ Oman Job Assigned',
        title_ar: 'تم تكليفك بمشروع جديد قادم من السعودية',
        body_en: `${profile?.full_name || 'Saudi Rep'} assigned ${lead.contact_name} (${jobCode}) to you for Oman execution.`,
        body_ar: `قام ممثل السعودية بتكليفك بالطلب ${jobCode} للعميل ${lead.contact_name}.`,
        action_url: `/employee/tasks?jobId=${newJob?.id || ''}`
      });

      toast.success(`Job ${jobCode} created & assigned to ${assignedSpecialist?.full_name || 'Ops Specialist'}!`, {
        duration: 4000
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign job to Oman Ops');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col text-foreground"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-emerald-950/40 via-card to-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ArrowDownLeft size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Saudi ➔ Oman Fulfillment
                </span>
                <span className="text-xs text-muted-foreground">• Inbound Flow</span>
              </div>
              <h2 className="text-base font-bold text-foreground mt-0.5">
                Assign Work to Oman Ops Team
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitAssignment} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Client & Service Summary Strip */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Investor / Client</span>
              <span className="font-bold text-foreground text-sm">{lead.contact_name}</span>
              {lead.company_name && <span className="text-muted-foreground block text-[11px]">{lead.company_name}</span>}
              <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">{lead.contact_phone || 'No phone'}</span>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Service to Execute</span>
              <input
                type="text"
                required
                value={serviceTitle}
                onChange={e => setServiceTitle(e.target.value)}
                className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-semibold outline-none focus:border-emerald-500 w-full sm:w-64 sm:text-right"
              />
            </div>
          </div>

          {/* Dual Currency & Gov Fee Calculation */}
          <div className="p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} /> Currency & Oman Gov Fee Calculator
              </span>

              {/* Currency Toggle */}
              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputCurrency('SAR')}
                  className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${
                    inputCurrency === 'SAR' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  🇸🇦 SAR (Saudi Riyals)
                </button>
                <button
                  type="button"
                  onClick={() => setInputCurrency('OMR')}
                  className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${
                    inputCurrency === 'OMR' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  🇴🇲 OMR (Omani Rials)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Contract Billed ({inputCurrency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={quotedInput || ''}
                  onChange={e => setQuotedInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Oman Gov Ministry Fee (OMR) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={omanGovFeeOmr || ''}
                  onChange={e => setOmanGovFeeOmr(parseFloat(e.target.value) || 0)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono text-amber-400 font-bold"
                />
                <span className="text-[9px] text-muted-foreground mt-0.5 block">MOCIIP, Chamber & Tax</span>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Advance Deposit Paid (OMR)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={advanceCollectedOmr || ''}
                  onChange={e => setAdvanceCollectedOmr(parseFloat(e.target.value) || 0)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Financial Ledger Output Strip */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Total in OMR (Rate: {sarRate} SAR/OMR):</span>
                <span className="font-mono font-bold text-foreground text-sm">{totalFeeOmr.toFixed(3)} OMR</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Real OSBIC Office Profit:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {netOfficeProfitOmr.toFixed(3)} OMR
                </span>
              </div>
            </div>
          </div>

          {/* Oman Ops Team Specialist Selection */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={13} className="text-primary" /> Assign to Oman Operations Specialist
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Oman Ops Specialist *
                </label>
                <select
                  required
                  value={selectedOpsId}
                  onChange={e => setSelectedOpsId(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none font-medium"
                >
                  <option value="">-- Choose Specialist in Oman --</option>
                  {opsEmployees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.branches?.name || 'Muscat HQ'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Expected Delivery / Target Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Operational Notes for Oman Specialist (e.g. Document checklist, Power of Attorney)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Saudi investor has verified passport copy and attestation. Needs priority filing at Invest Oman lounge..."
                value={opsInstructions}
                onChange={e => setOpsInstructions(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Job to Oman Ops Team'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
