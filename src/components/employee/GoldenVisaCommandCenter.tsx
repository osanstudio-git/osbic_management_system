import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, ShieldCheck, CheckCircle2, Clock, AlertTriangle, FileText,
  DollarSign, Building2, User, ArrowRight, Upload, ExternalLink,
  ChevronRight, Lock, Unlock, Sparkles, AlertCircle, RefreshCw,
  Send, Calendar, Check, HelpCircle, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface GoldenVisaCommandCenterProps {
  job: any;
  onUpdated?: () => void;
  canEdit?: boolean;
}

export type GoldenRoute = 'fixed_deposit' | 'itc_property' | 'omani_employees_50' | 'company_assets';
export type PaymentTerms = '50_50' | 'full';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type IdCardStatus = 'pending' | 'issued';

export const GoldenVisaCommandCenter: React.FC<GoldenVisaCommandCenterProps> = ({
  job,
  onUpdated,
  canEdit = true
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [goldenRoute, setGoldenRoute] = useState<GoldenRoute>(job.golden_route || 'company_assets');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(job.payment_terms || '50_50');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(job.golden_approval_status || 'pending');
  const [idCardStatus, setIdCardStatus] = useState<IdCardStatus>(job.id_card_status || 'pending');
  const [leadSource, setLeadSource] = useState<string>(job.lead_source_type || 'social_ads');
  const [isOpsDelegationOpen, setIsOpsDelegationOpen] = useState(false);
  const [delegationNotes, setDelegationNotes] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);

  // Smart Audit logic: Fixed Deposit, ITC Property, and >50 Omani Employees are EXEMPT.
  // Company assets/shares route REQUIRES an Audit Report.
  const isAuditExempt = goldenRoute === 'fixed_deposit' || goldenRoute === 'itc_property' || goldenRoute === 'omani_employees_50';
  const isAuditRequired = goldenRoute === 'company_assets';

  // Financial calculations
  const totalFee = Number(job.total_fee || 0);
  const advanceAmount = Number(job.advance_amount || 0);
  const remainingAmount = Number(job.remaining_amount || 0);
  const advancePaid = Boolean(job.advance_paid);
  const remainingPaid = Boolean(job.remaining_paid);

  // 50/50 Rest Collection Alert Trigger:
  // If payment terms is 50/50, and Government has approved (or file is at final approval stage),
  // but remaining balance is NOT yet paid, show strict collection blocker.
  const isRestPaymentPending = paymentTerms === '50_50' && !remainingPaid && remainingAmount > 0;
  const isRestPaymentBlockerActive = isRestPaymentPending && (approvalStatus === 'approved' || idCardStatus === 'issued');

  // Handle saving route and basic metadata
  const handleSaveRoute = async (newRoute: GoldenRoute) => {
    setGoldenRoute(newRoute);
    try {
      setIsUpdating(true);
      const auditNeeded = newRoute === 'company_assets';
      const { error } = await supabase
        .from('jobs')
        .update({
          golden_route: newRoute,
          audit_report_required: auditNeeded,
          migrate_category: 'golden_visa'
        })
        .eq('id', job.id);

      if (error) throw error;
      toast.success(`Qualifying route updated: ${formatRouteLabel(newRoute)}`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update qualifying route');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateApprovalStatus = async (newStatus: ApprovalStatus) => {
    try {
      setIsUpdating(true);
      const updates: any = {
        golden_approval_status: newStatus,
        migrate_category: 'golden_visa'
      };
      if (newStatus === 'approved') {
        updates.golden_approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', job.id);

      if (error) throw error;
      setApprovalStatus(newStatus);
      toast.success(`Government Approval Status: ${newStatus.toUpperCase()}`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update approval status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateIdCardStatus = async (newStatus: IdCardStatus) => {
    // Soft confirmation: if 50/50 and remaining amount not verified, prompt staff without hard-blocking workflow
    if (newStatus === 'issued' && isRestPaymentPending) {
      const confirmOverride = window.confirm(
        `Financial Notice: Remaining balance (${remainingAmount.toFixed(3)} OMR) is not yet verified by Accounts.\n\nProceed to mark the 10-Year Resident ID Card as issued?`
      );
      if (!confirmOverride) return;
    }

    try {
      setIsUpdating(true);
      const updates: any = {
        id_card_status: newStatus,
        migrate_category: 'golden_visa'
      };
      if (newStatus === 'issued') {
        updates.id_card_issued_at = new Date().toISOString();
        if (isRestPaymentPending) {
          updates.notes = job.notes 
            ? `${job.notes}\n[AUDIT: ID Card issued with remaining ${remainingAmount.toFixed(3)} OMR pending accounts verification]`
            : `[AUDIT: ID Card issued with remaining ${remainingAmount.toFixed(3)} OMR pending accounts verification]`;
        }
      }

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', job.id);

      if (error) throw error;
      setIdCardStatus(newStatus);
      toast.success(newStatus === 'issued' ? '10-Year Resident ID Card Issued & Delivered!' : 'ID Card status updated');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ID card status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignCrUpdateToOps = async () => {
    if (!delegationNotes.trim()) {
      toast.error('Please specify what CR updates are needed (e.g. add activity, increase capital)');
      return;
    }

    try {
      setIsDelegating(true);
      // Append CR Update requirement into job notes or sub-task
      const updatedNotes = `${job.notes || ''}\n[OPS_CR_DELEGATION]: ${delegationNotes.trim()} (Logged by Golden Visa desk at ${new Date().toLocaleDateString()})`;
      
      const { error } = await supabase
        .from('jobs')
        .update({
          notes: updatedNotes
        })
        .eq('id', job.id);

      if (error) throw error;
      toast.success('CR Update task flagged for Operations team!');
      setIsOpsDelegationOpen(false);
      setDelegationNotes('');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delegate CR update');
    } finally {
      setIsDelegating(false);
    }
  };

  const formatRouteLabel = (route: GoldenRoute) => {
    switch (route) {
      case 'fixed_deposit': return 'Fixed Deposit (250k / 500k OMR)';
      case 'itc_property': return 'Integrated Tourism Complex (ITC Property)';
      case 'omani_employees_50': return 'Company with > 50 Omani Employees';
      case 'company_assets': return 'Company Assets / Shares (Valuation)';
    }
  };

  return (
    <div className="bg-gradient-to-b from-card to-background border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-xl shadow-amber-500/5 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Crown size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                OSBIC MIGRATE • GOLDEN DESK
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Invest Oman 10-Year Investor Visa
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-syne font-bold text-foreground mt-1">
              Investor Onboarding & Approval Center
            </h2>
          </div>
        </div>

        {/* Lead Source Badge & Prerequisite Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Source:</span>
            <span className="font-semibold text-foreground capitalize">
              {job.lead_source_type ? job.lead_source_type.replace('_', ' ') : 'Social Ads (Meta)'}
            </span>
          </div>

          <button
            onClick={() => setIsOpsDelegationOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all flex items-center gap-1.5"
            title="If commercial registration changes are needed before portal submission"
          >
            <Building2 size={13} />
            <span>CR Update Needed? (Assign Ops)</span>
          </button>
        </div>
      </div>

      {/* 50/50 Payment Rest Status Advisory */}
      {isRestPaymentBlockerActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3.5"
        >
          <Clock size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-bold text-sm text-amber-200 uppercase tracking-wide flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <span>Remaining 50% Balance Pending Collection</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  Due: {remainingAmount.toFixed(3)} OMR
                </span>
              </span>
            </div>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Government approval milestone reached. Remaining balance of {remainingAmount.toFixed(3)} OMR is pending verification with the accounts team. Operations may proceed with ID card processing while accounting tracks settlement.
            </p>
          </div>
        </motion.div>
      )}

      {/* Step 1: Qualifying Route Selector & Smart Audit Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card/60 border border-border/70 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                1. Investor Qualifying Route & Audit Rule
              </h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Invest Oman Criteria</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                { id: 'company_assets', label: 'Company Assets / Shares', desc: 'Valuation basis. Requires formal Audit Report (500+ OMR).', auditNeeded: true },
                { id: 'fixed_deposit', label: 'Fixed Deposit (250k / 500k OMR)', desc: 'Bank deposit certificate. Audit is completely EXEMPT.', auditNeeded: false },
                { id: 'itc_property', label: 'ITC Tourism Property', desc: 'Title deed in Integrated Tourism Complex. Audit EXEMPT.', auditNeeded: false },
                { id: 'omani_employees_50', label: 'Company with > 50 Omanis', desc: 'Ministry of Labour Omanisation report. Audit EXEMPT.', auditNeeded: false }
              ] as const
            ).map((routeOption) => {
              const isSelected = goldenRoute === routeOption.id;
              return (
                <div
                  key={routeOption.id}
                  onClick={() => canEdit && handleSaveRoute(routeOption.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/10 shadow-md shadow-amber-500/10'
                      : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-foreground'}`}>
                        {routeOption.label}
                      </span>
                      {isSelected && <Check size={14} className="text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {routeOption.desc}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground uppercase font-bold">Audit Rule:</span>
                    {routeOption.auditNeeded ? (
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={11} /> Audit Report Required
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Audit Not Needed (Exempt)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audit Status Indicator */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className={isAuditRequired ? 'text-amber-400' : 'text-emerald-400'} />
              <div>
                <p className="text-xs font-bold text-foreground">
                  Audit Report Status: {isAuditRequired ? 'Mandatory for this Route' : 'Exempt (Audit Not Required)'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAuditRequired
                    ? 'Audit fee is estimated at 500.000 OMR or higher based on asset scale.'
                    : 'Selected qualifying criteria legally bypasses the commercial audit requirement.'}
                </p>
              </div>
            </div>

            {isAuditRequired && (
              <span className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                Audit Required (500+ OMR)
              </span>
            )}
          </div>
        </div>

        {/* Step 2: Fee Structure & Government Disbursements */}
        <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={18} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                2. Fee Breakdown (OMR)
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">Government Application Fee:</span>
                <span className="font-mono font-bold text-foreground">315.000 OMR</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">10-Yr Resident ID Card Fee:</span>
                <span className="font-mono font-bold text-foreground">565.000 OMR</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">Audit Report (if needed):</span>
                <span className="font-mono font-bold text-amber-400">
                  {isAuditRequired ? '500.000+ OMR' : '0.000 (Exempt)'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">Health Insurance:</span>
                <span className="font-bold text-blue-400">Billed as Extra</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-muted-foreground">Payment Plan:</span>
              <span className="font-bold uppercase text-amber-400">{paymentTerms.replace('_', '/')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">Total Fee:</span>
              <span className="font-mono font-black text-lg text-emerald-400">{totalFee.toFixed(3)} OMR</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
              <span>Advance Paid: {advanceAmount.toFixed(3)} OMR</span>
              <span>Balance: {remainingAmount.toFixed(3)} OMR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Mandatory Document Checklist (Note 4 & 5) */}
      <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              3. Mandatory Onboarding Documents
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Consultation Meeting Checklist</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Passport & Photo', status: 'Mandatory' },
            { label: 'Civil / Resident ID', status: 'Mandatory' },
            { label: 'Police Clearance', status: 'Mandatory' },
            { label: 'Affidavit Letter', status: 'Mandatory' },
            { label: 'E-Visa & Auth Letter', status: 'Mandatory' },
            { label: 'Health Insurance', status: 'Extra Billed' }
          ].map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-background border border-border/60 flex flex-col justify-between">
              <p className="text-xs font-semibold text-foreground">{item.label}</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-bold">Standard</span>
                <CheckCircle2 size={12} className="text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 4: Pipeline Milestones & Government Approval Actions */}
      <div className="bg-muted/15 border border-border/70 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              4. Government Portal & ID Card Pipeline
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Turnaround: 1–3 Days</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Milestone A: Invest Oman Submission */}
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Stage 1 • Submission
              </span>
              <h4 className="text-sm font-bold text-foreground">Invest Oman Portal</h4>
              <p className="text-[11px] text-muted-foreground mt-1">
                Submit application once consultation documents & initial 50% deposit are logged.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> {advancePaid ? 'Deposit Verified' : 'Deposit Pending'}
              </span>
            </div>
          </div>

          {/* Milestone B: Government Approval (1-3 Days) */}
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Stage 2 • Ministry Review
              </span>
              <h4 className="text-sm font-bold text-foreground">Government Approval</h4>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ministry review turnaround is 1–3 business days.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <select
                value={approvalStatus}
                onChange={(e) => canEdit && handleUpdateApprovalStatus(e.target.value as ApprovalStatus)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:border-primary outline-none"
              >
                <option value="pending">⏳ Pending Gov (1-3 Days)</option>
                <option value="approved">✓ Gov Approved</option>
                <option value="rejected">✕ Rejected / Needs Update</option>
              </select>
            </div>
          </div>

          {/* Milestone C: 10-Year Resident ID Card */}
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Stage 3 • Delivery
              </span>
              <h4 className="text-sm font-bold text-foreground">10-Year Resident ID Card</h4>
              <p className="text-[11px] text-muted-foreground mt-1">
                ROP issuance after Gov approval and remaining payment verification.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <select
                value={idCardStatus}
                onChange={(e) => canEdit && handleUpdateIdCardStatus(e.target.value as IdCardStatus)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:border-primary outline-none"
              >
                <option value="pending">⏳ ID Card Pending</option>
                <option value="issued">✓ ID Card Issued (565 OMR)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Delegate CR Update Modal */}
      <AnimatePresence>
        {isOpsDelegationOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-blue-400" />
                  <h3 className="font-syne font-bold text-foreground">Assign CR Update to Ops</h3>
                </div>
                <button
                  onClick={() => setIsOpsDelegationOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                If the investor's Commercial Registration requires updates (adding activities, increasing capital, or partner updates) before portal submission, describe the requirements below. This task will be flagged directly for the Operations clearing team.
              </p>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-1.5">
                  CR Instructions for Ops *
                </label>
                <textarea
                  rows={4}
                  value={delegationNotes}
                  onChange={(e) => setDelegationNotes(e.target.value)}
                  placeholder="e.g. Add investment commercial activity, update share capital to match qualifying threshold, or change authorized signatory..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-blue-400 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsOpsDelegationOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  disabled={isDelegating}
                  onClick={handleAssignCrUpdateToOps}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  {isDelegating ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Assign to Operations</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

