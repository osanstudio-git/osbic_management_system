import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Plane, Hotel, Calendar, CheckCircle2, Clock, AlertCircle,
  FileText, DollarSign, Shield, MapPin, ExternalLink, RefreshCw,
  Building, Check, X, AlertTriangle, ArrowRight, UserCheck, Ticket
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface GlobalVisaCommandCenterProps {
  job: any;
  onUpdated?: () => void;
  canEdit?: boolean;
}

export type GlobalVisaCategory = 'schengen_29' | 'usa_uk' | 'gcc_visit' | 'oman_family';
export type EmbassyFeeMode = 'paid_to_osbic' | 'client_direct' | 'at_embassy';
export type EmbassyOutcome = 'pending' | 'approved' | 'rejected';

export const GlobalVisaCommandCenter: React.FC<GlobalVisaCommandCenterProps> = ({
  job,
  onUpdated,
  canEdit = true
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [visaCategory, setVisaCategory] = useState<GlobalVisaCategory>(job.visa_category || 'schengen_29');
  const [destinationCountry, setDestinationCountry] = useState<string>(job.destination_country || '');
  const [embassyFeeMode, setEmbassyFeeMode] = useState<EmbassyFeeMode>(job.embassy_fee_mode || 'paid_to_osbic');
  const [hasDummyTicket, setHasDummyTicket] = useState<boolean>(Boolean(job.has_dummy_ticket));
  const [hasDummyHotel, setHasDummyHotel] = useState<boolean>(Boolean(job.has_dummy_hotel));
  const [hasInsurance, setHasInsurance] = useState<boolean>(Boolean(job.has_insurance));
  const [travelDate, setTravelDate] = useState<string>(job.travel_date || '');
  const [embassyOutcome, setEmbassyOutcome] = useState<EmbassyOutcome>(job.embassy_outcome || 'pending');
  const [rejectionReason, setRejectionReason] = useState<string>(job.embassy_rejection_reason || '');
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);

  // Quick preset countries
  const popularCountries: Record<GlobalVisaCategory, string[]> = {
    schengen_29: ['France', 'Germany', 'Spain', 'Italy', 'Switzerland', 'Netherlands', 'Greece', 'Austria', 'Portugal'],
    usa_uk: ['United Kingdom', 'United States of America', 'Canada'],
    gcc_visit: ['Saudi Arabia (Tourist/Umrah)', 'UAE (Dubai/Abu Dhabi)', 'Qatar', 'Bahrain', 'Kuwait'],
    oman_family: ['Oman 2-Year Family Visa', 'Oman 3-Month Family Visit', 'Relative Visit Visa']
  };

  const handleUpdateCategory = async (cat: GlobalVisaCategory) => {
    setVisaCategory(cat);
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('jobs')
        .update({
          visa_category: cat,
          migrate_category: 'global_visa'
        })
        .eq('id', job.id);

      if (error) throw error;
      toast.success(`Category updated: ${getCategoryLabel(cat)}`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveField = async (fields: Record<string, any>) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('jobs')
        .update({
          ...fields,
          migrate_category: 'global_visa'
        })
        .eq('id', job.id);

      if (error) throw error;
      toast.success('Logistics record updated');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleDummy = async (field: 'has_dummy_ticket' | 'has_dummy_hotel' | 'has_insurance', currentVal: boolean) => {
    const newVal = !currentVal;
    if (field === 'has_dummy_ticket') setHasDummyTicket(newVal);
    if (field === 'has_dummy_hotel') setHasDummyHotel(newVal);
    if (field === 'has_insurance') setHasInsurance(newVal);

    await handleSaveField({ [field]: newVal });
  };

  const handleUpdateOutcome = async (outcome: EmbassyOutcome) => {
    if (outcome === 'rejected') {
      setIsRejectionModalOpen(true);
      return;
    }
    setEmbassyOutcome(outcome);
    await handleSaveField({
      embassy_outcome: outcome,
      embassy_rejection_reason: null
    });
  };

  const handleConfirmRejection = async () => {
    setEmbassyOutcome('rejected');
    await handleSaveField({
      embassy_outcome: 'rejected',
      embassy_rejection_reason: rejectionReason
    });
    setIsRejectionModalOpen(false);
  };

  const getCategoryLabel = (cat: GlobalVisaCategory) => {
    switch (cat) {
      case 'schengen_29': return 'Schengen (29 European States)';
      case 'usa_uk': return 'USA / UK (GCC Residents Only)';
      case 'gcc_visit': return 'All GCC Visit Visas (from Oman)';
      case 'oman_family': return 'Oman Family Visa (2-Year / 3-Month)';
    }
  };

  return (
    <div className="bg-gradient-to-b from-card to-background border border-sky-500/30 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-500/5 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20 shrink-0">
            <Globe size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400">
                OSBIC MIGRATE • GLOBAL VISA DESK
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Outbound Tourist, Visit & Family Visas
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-syne font-bold text-foreground mt-1">
              Global Tourist & Travel Visa Command Center
            </h2>
          </div>
        </div>

        {/* Lead Source Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Source:</span>
            <span className="font-semibold text-foreground capitalize">
              {job.lead_source_type ? job.lead_source_type.replace('_', ' ') : 'Social Ads (Meta)'}
            </span>
          </div>
        </div>
      </div>

      {/* Rejection Alert Banner if rejected */}
      {embassyOutcome === 'rejected' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-300 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-rose-200 uppercase">
              Embassy Rejection Recorded
            </p>
            {rejectionReason ? (
              <p className="text-xs text-rose-300/80">Reason: {rejectionReason}</p>
            ) : (
              <p className="text-xs text-rose-300/80">Case flagged as rejected by embassy. Review documentation for appeal.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Visa Category & Destination Selection */}
      <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              1. Visa Category & Destination Country
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Country-Specific Rules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              { id: 'schengen_29', label: 'Schengen (29 States)', desc: 'Europe (France, Germany, Italy, Spain, etc.)' },
              { id: 'usa_uk', label: 'USA / UK Visas', desc: 'Strictly for valid GCC residents with local ID' },
              { id: 'gcc_visit', label: 'All GCC Visas', desc: 'Travel to UAE, Saudi, Qatar, Bahrain, Kuwait' },
              { id: 'oman_family', label: 'Oman Family Visa', desc: '2-Year residence or 3-Month family visit' }
            ] as const
          ).map((cat) => {
            const isSelected = visaCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => canEdit && handleUpdateCategory(cat.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-400 bg-sky-500/10 shadow-md shadow-sky-500/10'
                    : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-sky-400' : 'text-foreground'}`}>
                      {cat.label}
                    </span>
                    {isSelected && <Check size={14} className="text-sky-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Destination Country Input & Presets */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Destination Country / Target Embassy:
            </label>
            <input
              type="text"
              value={destinationCountry}
              onChange={(e) => setDestinationCountry(e.target.value)}
              onBlur={() => handleSaveField({ destination_country: destinationCountry })}
              placeholder="e.g. France, United Kingdom, USA, Germany, Saudi Arabia..."
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:border-sky-400 outline-none"
            />
          </div>

          <div className="sm:w-2/3">
            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {popularCountries[visaCategory]?.slice(0, 5).map((country) => (
                <button
                  key={country}
                  type="button"
                  onClick={() => {
                    setDestinationCountry(country);
                    handleSaveField({ destination_country: country });
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted/60 hover:bg-sky-500/10 hover:text-sky-400 border border-border/70 text-muted-foreground transition-all"
                >
                  {country}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Financial Threshold & Eligibility Check (Note 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              2. Bank Statement & Financial Rule
            </h3>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">Minimum Balance Requirement:</span>
              <span className="font-mono font-black text-sm text-emerald-400">2,000 – 2,500 OMR</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Standard 6-month certified bank statement. Balance varies by destination country.
              <strong> There is no age restriction</strong> for applicant eligibility.
            </p>
          </div>

          {visaCategory === 'usa_uk' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>USA / UK Mandatory Condition:</strong> Applicant must hold a valid GCC Resident Card (Oman Civil ID).
              </span>
            </div>
          )}
        </div>

        {/* Step 3: Embassy & Government Fee Payment Mode (Note 1) */}
        <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              3. Visa & Embassy Payment Mode
            </h3>
          </div>

          <div className="space-y-2">
            {(
              [
                { id: 'paid_to_osbic', label: 'Paid to OSBIC (US)', desc: 'Client pays visa fee to OSBIC. OSBIC pays embassy portal.' },
                { id: 'client_direct', label: 'Them Direct (Online)', desc: 'Client pays embassy portal directly using their card.' },
                { id: 'at_embassy', label: 'On Embassy / VFS Counter', desc: 'Client pays in person at the embassy or VFS appointment.' }
              ] as const
            ).map((mode) => {
              const isSelected = embassyFeeMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => {
                    if (canEdit) {
                      setEmbassyFeeMode(mode.id);
                      handleSaveField({ embassy_fee_mode: mode.id });
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/10 text-foreground font-semibold'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <div>
                    <span className={isSelected ? 'text-sky-400 font-bold' : ''}>{mode.label}</span>
                    <span className="text-[10px] block opacity-70">{mode.desc}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-sky-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 4: Dummy Bookings & Logistics Checklist (Note 1) */}
      <div className="bg-card/60 border border-border/70 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              4. Travel Logistics & Dummy Bookings
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Embassy Submission Requirements</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Dummy Ticket */}
          <div
            onClick={() => canEdit && handleToggleDummy('has_dummy_ticket', hasDummyTicket)}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              hasDummyTicket
                ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
                : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasDummyTicket ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                <Plane size={18} />
              </div>
              <div>
                <p className="text-xs font-bold">Dummy Flight Ticket</p>
                <p className="text-[10px] text-muted-foreground">{hasDummyTicket ? 'Confirmed & Attached' : 'Pending Booking'}</p>
              </div>
            </div>
            {hasDummyTicket ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Clock size={16} className="text-muted-foreground/60" />}
          </div>

          {/* Dummy Hotel */}
          <div
            onClick={() => canEdit && handleToggleDummy('has_dummy_hotel', hasDummyHotel)}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              hasDummyHotel
                ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
                : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasDummyHotel ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                <Hotel size={18} />
              </div>
              <div>
                <p className="text-xs font-bold">Hotel Reservation Voucher</p>
                <p className="text-[10px] text-muted-foreground">{hasDummyHotel ? 'Confirmed & Attached' : 'Pending Booking'}</p>
              </div>
            </div>
            {hasDummyHotel ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Clock size={16} className="text-muted-foreground/60" />}
          </div>

          {/* Travel Medical Insurance */}
          <div
            onClick={() => canEdit && handleToggleDummy('has_insurance', hasInsurance)}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              hasInsurance
                ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
                : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasInsurance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                <Shield size={18} />
              </div>
              <div>
                <p className="text-xs font-bold">Travel Medical Insurance</p>
                <p className="text-[10px] text-muted-foreground">{hasInsurance ? 'Policy Issued (30k EUR+)' : 'Pending Policy'}</p>
              </div>
            </div>
            {hasInsurance ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Clock size={16} className="text-muted-foreground/60" />}
          </div>
        </div>
      </div>

      {/* Step 5: Travel Date & Embassy Outcome Tracking (Note 1) */}
      <div className="bg-muted/15 border border-border/70 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
              5. Travel Timing & Embassy Outcome
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Travel Date vs Visa Validity</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Client Planned Travel Date *
            </label>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => {
                setTravelDate(e.target.value);
                handleSaveField({ travel_date: e.target.value || null });
              }}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:border-sky-400 outline-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ensure embassy appointment & visa validity window aligns with this travel departure date.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Embassy Outcome Status *
            </label>
            <select
              value={embassyOutcome}
              onChange={(e) => canEdit && handleUpdateOutcome(e.target.value as EmbassyOutcome)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-foreground focus:border-sky-400 outline-none"
            >
              <option value="pending">⏳ Pending Submission / Embassy Review</option>
              <option value="approved">✓ Visa Approved & Stamped</option>
              <option value="rejected">✕ Embassy Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Embassy Rejection Modal */}
      <AnimatePresence>
        {isRejectionModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-400" />
                  <h3 className="font-syne font-bold text-foreground">Log Embassy Rejection</h3>
                </div>
                <button
                  onClick={() => setIsRejectionModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Record the official refusal reason given by the embassy or VFS (e.g. justification for stay, insufficient financial means, travel history). This ensures full CRM audit history.
              </p>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-1.5">
                  Refusal Reason / Details *
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Standard refusal clause 2/8 (purpose of stay not justified), or bank statement issue..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-rose-400 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsRejectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRejection}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Confirm Rejection Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

