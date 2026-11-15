import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, DollarSign, AlertTriangle, ArrowRight,
  TrendingDown, TrendingUp, CheckCircle2, RefreshCw, MessageSquare
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    job_code: string;
    custom_name?: string | null;
    total_fee: number;
    work_fee: number;
    ministry_fee: number;
    remaining_amount?: number | null;
    advance_amount?: number | null;
    client?: {
      full_name?: string | null;
      phone?: string | null;
      company_name?: string | null;
    } | null;
    notes?: string | null;
  };
  onSuccess: () => void;
}

export const GovFeeVarianceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  job,
  onSuccess
}) => {
  const { profile } = useAuth();

  const currentGovFee = Number(job.ministry_fee || 0);
  const currentWorkFee = Number(job.work_fee || 0);
  const currentTotal = Number(job.total_fee || (currentWorkFee + currentGovFee));
  const currentRemaining = Number(job.remaining_amount || 0);

  const [newGovFeeStr, setNewGovFeeStr] = useState<string>(currentGovFee.toFixed(3));
  const [reason, setReason] = useState<string>('Visa Fine / Surcharge');
  const [resolutionMode, setResolutionMode] = useState<'absorb' | 'charge_client'>('absorb');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const newGovFee = parseFloat(newGovFeeStr) || 0;
  const variance = newGovFee - currentGovFee; // positive = increased fee

  // Option 1: OSBIC absorbs -> Total deal same, work_fee reduced by variance
  const absorbedWorkFee = Math.max(0, currentWorkFee - variance);
  const absorbedTotal = currentTotal;

  // Option 2: Charge client -> Total deal increased by variance, work_fee unchanged
  const chargedTotal = currentTotal + variance;
  const chargedWorkFee = currentWorkFee;
  const chargedRemaining = Math.max(0, currentRemaining + variance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variance === 0) {
      toast.error('The new government fee is the same as the current fee.');
      return;
    }

    setIsSubmitting(true);
    try {
      const auditNote = `[GOV_FEE_VARIANCE on ${new Date().toISOString().split('T')[0]} by ${profile?.full_name || 'Staff'}]: ` +
        `Gov Fee changed from ${currentGovFee.toFixed(3)} to ${newGovFee.toFixed(3)} OMR (${variance > 0 ? '+' : ''}${variance.toFixed(3)} OMR). ` +
        `Reason: "${reason}". Handled via: ${resolutionMode === 'absorb' ? 'OSBIC Absorbed from Profit' : 'Billed to Client Top-Up'}.`;

      const existingNotes = job.notes ? `${job.notes}\n${auditNote}` : auditNote;

      if (resolutionMode === 'absorb') {
        // OSBIC Absorbs: Adjust ministry_fee and work_fee in jobs
        const { error: jobErr } = await supabase
          .from('jobs')
          .update({
            ministry_fee: newGovFee,
            work_fee: absorbedWorkFee,
            notes: existingNotes,
          })
          .eq('id', job.id);

        if (jobErr) throw jobErr;

        // Also add an audit record in job_additional_charges with 0 billed to client
        await supabase.from('job_additional_charges').insert({
          job_id: job.id,
          description: `Gov Fee Variance Absorbed by OSBIC (${reason})`,
          amount: 0,
        } as any);

        toast.success(`Gov Fee adjusted to ${newGovFee.toFixed(3)} OMR. Center profit updated.`);
      } else {
        // Charge Client: Add additional charge and increase job total & remaining balance
        const { error: chargeErr } = await supabase
          .from('job_additional_charges')
          .insert({
            job_id: job.id,
            description: `Gov Fee Variance / Top-up (${reason})`,
            amount: variance,
          } as any);

        if (chargeErr) throw chargeErr;

        const { error: jobErr } = await supabase
          .from('jobs')
          .update({
            ministry_fee: newGovFee,
            total_fee: chargedTotal,
            remaining_amount: chargedRemaining,
            remaining_paid: chargedRemaining <= 0,
            notes: existingNotes,
          })
          .eq('id', job.id);

        if (jobErr) throw jobErr;

        toast.success(`Added top-up charge of ${variance.toFixed(3)} OMR to client account.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update fee variance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsAppTopUpNotice = () => {
    let p = (job.client?.phone || '').replace(/[^0-9]/g, '');
    if (!p) {
      toast.error('Client phone number not available for WhatsApp');
      return;
    }
    if (p.startsWith('00')) p = p.slice(2);
    if (p.length === 8) p = '968' + p;

    const msg = [
      `*OSBIC INTERNATIONAL LLC — Official Fee Notice*`,
      `----------------------------------------`,
      `*Dear ${job.client?.full_name || 'Valued Client'},*`,
      `Regarding your active file *${job.job_code}* (${job.custom_name || 'Business Service'}):`,
      ``,
      `Official ministry fee adjustment required by government department:`,
      `• *Reason / Department:* ${reason}`,
      `• *Additional Government Fee:* ${variance.toFixed(3)} OMR`,
      `• *New Total Service Balance:* ${chargedRemaining.toFixed(3)} OMR`,
      ``,
      `Please arrange settlement of this official fee at your earliest convenience so our operations team can conclude your documentation without delay.`,
      `----------------------------------------`,
      `Muscat, Sultanate of Oman | www.osbic.net`,
    ].join('\n');

    window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">Government Fee Variance</h3>
                <p className="text-xs text-muted-foreground">
                  {job.job_code} • {job.custom_name || 'Active Task'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            {/* Current Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-muted/30 border border-border text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Original Gov Fee</span>
                <p className="font-syne font-bold text-foreground text-sm mt-0.5">{currentGovFee.toFixed(3)} OMR</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">OSBIC Service Fee</span>
                <p className="font-syne font-bold text-emerald-400 text-sm mt-0.5">{currentWorkFee.toFixed(3)} OMR</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Client Price</span>
                <p className="font-syne font-bold text-foreground text-sm mt-0.5">{currentTotal.toFixed(3)} OMR</p>
              </div>
            </div>

            {/* Inputs: New Fee & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  New Actual Gov Fee (OMR) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={newGovFeeStr}
                  onChange={e => setNewGovFeeStr(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-syne font-bold text-base focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Variance Reason *
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:border-amber-400 focus:outline-none"
                >
                  <option value="Visa Fine / Overstay Penalty">Visa Fine / Overstay Penalty</option>
                  <option value="Ministry Activity Tariff Change">Ministry Activity Tariff Change</option>
                  <option value="Commercial Registration (CR) Extra Fees">CR Extra Fees / Late Filing</option>
                  <option value="Municipality / Inspection Surcharge">Municipality / Inspection Surcharge</option>
                  <option value="Chamber of Commerce (OCCI) Tariff">OCCI Chamber Tariff</option>
                  <option value="Sanad Service Adjustment">Sanad Service Adjustment</option>
                  <option value="Other Official Variance">Other Official Variance</option>
                </select>
              </div>
            </div>

            {/* Variance Badge */}
            {variance !== 0 && (
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                variance > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                <span>Fee Variance: {variance > 0 ? `+${variance.toFixed(3)} OMR Increase` : `${variance.toFixed(3)} OMR Reduction`}</span>
                <span className="text-[11px] opacity-80">Requires financial rebalance below</span>
              </div>
            )}

            {/* Resolution Mode Choice */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                How should this variance be handled?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option A: OSBIC Absorbs */}
                <div
                  onClick={() => setResolutionMode('absorb')}
                  className={`p-4 rounded-2xl border text-xs cursor-pointer transition-all ${
                    resolutionMode === 'absorb'
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-muted/20 border-border hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-foreground mb-1">
                    <span>🏢 OSBIC Absorbs Margin</span>
                    {resolutionMode === 'absorb' && <CheckCircle2 size={16} className="text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Client price remains unchanged. OSBIC absorbs the fee variance from its center profit margin.
                  </p>
                  <div className="pt-2 border-t border-border/50 font-mono text-[11px] space-y-0.5">
                    <p className="text-foreground">Client Deal: <strong>{absorbedTotal.toFixed(3)} OMR</strong></p>
                    <p className="text-emerald-400">New Profit: <strong>{absorbedWorkFee.toFixed(3)} OMR</strong></p>
                  </div>
                </div>

                {/* Option B: Charge Client */}
                <div
                  onClick={() => setResolutionMode('charge_client')}
                  className={`p-4 rounded-2xl border text-xs cursor-pointer transition-all ${
                    resolutionMode === 'charge_client'
                      ? 'bg-indigo-500/15 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-muted/20 border-border hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-foreground mb-1">
                    <span>👤 Charge Client Top-Up</span>
                    {resolutionMode === 'charge_client' && <CheckCircle2 size={16} className="text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Client is billed the extra government fee. OSBIC center profit remains fully protected.
                  </p>
                  <div className="pt-2 border-t border-border/50 font-mono text-[11px] space-y-0.5">
                    <p className="text-foreground">New Total Deal: <strong>{chargedTotal.toFixed(3)} OMR</strong></p>
                    <p className="text-amber-400">Balance Due: <strong>{chargedRemaining.toFixed(3)} OMR</strong></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional WhatsApp Voucher button if charging client */}
            {resolutionMode === 'charge_client' && variance > 0 && job.client?.phone && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={openWhatsAppTopUpNotice}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare size={14} /> Send Official Top-Up Notice via WhatsApp
                </button>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || variance === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-[#0A0F1E] font-bold text-xs hover:bg-amber-400 active:scale-95 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Apply Fee Adjustment
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

