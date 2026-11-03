import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle, ArrowRight, ArrowLeft, ChevronDown, Users, 
  Calendar, Briefcase, Sparkles, AlertTriangle, UserCheck, 
  Building2, Phone, Clock, Loader2, ShieldAlert
} from 'lucide-react';
import { useLeads, useCreateLead, useCheckDuplicateLead } from '../../hooks/shared/useLeads';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: 'bg-zinc-500/10 border-zinc-500/30', text: 'text-zinc-400' },
  contacted: { label: 'Contacted', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  interested: { label: 'Interested', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400' },
  qualified: { label: 'Qualified', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
  quoted: { label: 'Quoted', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  negotiating: { label: 'Negotiating', bg: 'bg-pink-500/10 border-pink-500/30', text: 'text-pink-400' },
  converted: { label: 'Converted', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  lost: { label: 'Lost', bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
  on_hold: { label: 'On Hold', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddLeadSlideOver({ isOpen, onClose }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [allowDuplicateProceed, setAllowDuplicateProceed] = useState(false);
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    contact_whatsapp: '',
    whatsappSameAsPhone: false,
    lead_date: new Date().toISOString().split('T')[0],
    source_id: '',
    custom_source_text: '',
    referral_name: '',
    selected_service_id: '',
    custom_service_name: '',
    is_custom_service: false,
    services: [] as string[],
    contact_email: '',
    company_name: '',
    nationality: '',
    notes: '',
    next_follow_up_at: '',
  });

  const { useLeadSourcesList } = useLeads();
  const { data: sources } = useLeadSourcesList();
  const { data: servicesList } = useAdminServices();

  const createLeadMutation = useCreateLead();

  const selectedSourceName = sources?.find(s => s.id === formData.source_id)?.name;
  const isOtherSource = selectedSourceName === 'Other';
  const isReferralSource = selectedSourceName?.toLowerCase().includes('referral') ?? false;

  // Reset form when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setIsSourceDropdownOpen(false);
      setAllowDuplicateProceed(false);
      setDebouncedPhone('');
      setDebouncedName('');
      setFormData({
        contact_name: '',
        contact_phone: '',
        contact_whatsapp: '',
        whatsappSameAsPhone: false,
        lead_date: new Date().toISOString().split('T')[0],
        source_id: '',
        custom_source_text: '',
        referral_name: '',
        selected_service_id: '',
        custom_service_name: '',
        is_custom_service: false,
        services: [],
        contact_email: '',
        company_name: '',
        nationality: '',
        notes: '',
        next_follow_up_at: '',
      });
    }
  }, [isOpen]);

  // Debounce phone and name for duplicate check
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhone(formData.contact_phone);
      setDebouncedName(formData.contact_name);
    }, 250);
    return () => clearTimeout(timer);
  }, [formData.contact_phone, formData.contact_name]);

  const { data: duplicateCheck, isLoading: isCheckingDuplicate } = useCheckDuplicateLead(debouncedPhone, debouncedName);

  // Sync whatsapp with phone if checkmark is toggled
  useEffect(() => {
    if (formData.whatsappSameAsPhone) {
      setFormData(prev => ({ ...prev, contact_whatsapp: prev.contact_phone }));
    }
  }, [formData.whatsappSameAsPhone, formData.contact_phone]);

  const handleNext = () => {
    if (!formData.contact_name || !formData.contact_phone || !formData.source_id) {
      toast.error('Please fill in all required fields (Name, Phone, Source)');
      return;
    }
    if (duplicateCheck?.hasPhoneDuplicate && !allowDuplicateProceed) {
      toast.error('Duplicate phone number detected! Please review the existing lead or tick the confirmation box to proceed.');
      return;
    }
    if (isOtherSource && !formData.custom_source_text.trim()) {
      toast.error('Please specify the custom source name');
      return;
    }
    if (isReferralSource && !formData.referral_name.trim()) {
      toast.error('Please enter the name of the person who referred this lead');
      return;
    }
    setStep(2);
  };

  const handleSubmit = () => {
    // Final check
    if (!formData.contact_name || !formData.contact_phone || !formData.source_id) {
      toast.error('Please fill in all required fields (Name, Phone, Source)');
      return;
    }
    if (duplicateCheck?.hasPhoneDuplicate && !allowDuplicateProceed) {
      toast.error('Duplicate phone number detected! Please review the existing lead or tick the confirmation box to proceed.');
      return;
    }
    if (isOtherSource && !formData.custom_source_text.trim()) {
      toast.error('Please specify the custom source name');
      return;
    }
    if (isReferralSource && !formData.referral_name.trim()) {
      toast.error('Please enter the name of the person who referred this lead');
      return;
    }

    const finalNotes = isOtherSource && formData.custom_source_text
      ? `[Custom Source: ${formData.custom_source_text.trim()}]\n${formData.notes}`
      : formData.notes;

    const chosenService = servicesList?.find(s => s.id === formData.selected_service_id);
    const resolvedServiceName = formData.is_custom_service
      ? formData.custom_service_name.trim()
      : (chosenService ? chosenService.name_en : '');

    const interestedServicesPayload = chosenService ? [{
      id: chosenService.id,
      name: chosenService.name_en,
      price: (Number(chosenService.work_fee) || 0) + (Number(chosenService.ministry_fee) || 0)
    }] : (resolvedServiceName ? [{
      id: 'custom',
      name: resolvedServiceName,
      price: 0
    }] : undefined);

    const serviceIds = formData.selected_service_id ? [formData.selected_service_id] : [];

    createLeadMutation.mutate({
      contact_name: formData.contact_name,
      contact_phone: formData.contact_phone,
      contact_whatsapp: formData.whatsappSameAsPhone ? formData.contact_phone : formData.contact_whatsapp,
      source_id: formData.source_id,
      services: serviceIds,
      service_required: resolvedServiceName || undefined,
      interested_services: interestedServicesPayload,
      created_at: formData.lead_date || undefined,
      contact_email: formData.contact_email || undefined,
      company_name: formData.company_name || undefined,
      nationality: formData.nationality || undefined,
      notes: finalNotes || undefined,
      next_follow_up_at: formData.next_follow_up_at || undefined,
      referral_name: isReferralSource ? formData.referral_name.trim() : undefined,
    }, {
      onSuccess: () => {
        toast.success('Lead added successfully!');
        onClose();
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to create lead');
      }
    });
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-syne font-bold text-foreground">Add New Lead</h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Step {step} of 2 — {step === 1 ? 'Required Details' : 'Optional Context'}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {step === 1 ? (
                /* STEP 1: REQUIRED + CORE DETAILS */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Contact Name *</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="e.g. Salim Al-Harthy"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors text-sm"
                      required
                    />
                  </div>

                  {/* Lead / Received Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar size={14} className="text-primary" />
                        <span>Lead Date (Received Date) *</span>
                      </label>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        Reports Date
                      </span>
                    </div>
                    <input
                      type="date"
                      value={formData.lead_date}
                      onChange={e => setFormData({ ...formData, lead_date: e.target.value })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors text-sm font-mono"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Attributed to sales reports on this date (ideal if recording a lead from 1–2 days ago)
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-muted-foreground">Phone Number *</label>
                      {isCheckingDuplicate && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                          <Loader2 size={11} className="animate-spin text-primary" />
                          Checking duplicates...
                        </span>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="e.g. 91234567"
                      className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground focus:outline-none transition-all text-sm font-mono ${
                        duplicateCheck?.hasPhoneDuplicate 
                          ? 'border-amber-500/70 focus:border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                          : 'border-border focus:border-gold'
                      }`}
                      required
                    />
                  </div>

                  {/* ─── LIVE DUPLICATE INTELLIGENCE BOX ─── */}
                  <AnimatePresence>
                    {(duplicateCheck?.hasDuplicate || isCheckingDuplicate) && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        className={`rounded-2xl border p-4 space-y-3.5 shadow-xl transition-all ${
                          duplicateCheck?.hasPhoneDuplicate 
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
                            : 'bg-blue-500/10 border-blue-500/40 text-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            {duplicateCheck?.hasPhoneDuplicate ? (
                              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                                <AlertTriangle size={18} />
                              </div>
                            ) : (
                              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                                <ShieldAlert size={18} />
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                {duplicateCheck?.hasPhoneDuplicate 
                                  ? 'DUPLICATE RECORD FOUND (Matching Phone)' 
                                  : 'POTENTIAL MATCH (Matching Client Name)'}
                              </h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {duplicateCheck?.hasPhoneDuplicate 
                                  ? 'This phone number already exists in OSBIC. Details below show who currently handles it:' 
                                  : 'A record with a matching contact name was found:'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* List of Matched Existing Leads */}
                        <div className="space-y-2">
                          {duplicateCheck?.phoneLeads?.map(lead => {
                            const isOwnLead = lead.assigned_to === profile?.id;
                            const badge = STATUS_BADGES[lead.status] || { label: lead.status, bg: 'bg-muted', text: 'text-foreground' };
                            const addedDate = lead.created_at ? format(new Date(lead.created_at), 'dd MMM yyyy') : '';

                            return (
                              <div key={lead.id} className="bg-card/90 border border-border rounded-xl p-3 space-y-2.5 text-xs shadow-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary tracking-wide">{lead.lead_code || 'LEAD'}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                      {badge.label}
                                    </span>
                                  </div>
                                  {addedDate && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock size={11} /> Added {addedDate}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <p className="font-bold text-foreground text-sm">
                                    {lead.contact_name} 
                                    {lead.company_name && <span className="text-muted-foreground font-normal text-xs ml-1">({lead.company_name})</span>}
                                  </p>
                                  <p className="text-muted-foreground font-mono text-xs mt-0.5">
                                    📞 {lead.contact_phone || lead.contact_whatsapp || 'No phone'}
                                  </p>
                                </div>

                                {/* CRITICAL: WITH WHOM IT CURRENTLY IS & WHO ADDED */}
                                <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                  <div className="p-2 rounded-lg bg-background/60 border border-border">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                                      Currently Handled By:
                                    </span>
                                    <p className={`font-bold flex items-center gap-1.5 ${isOwnLead ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      <UserCheck size={13} className="shrink-0" />
                                      <span>{lead.assigned_to_profile?.full_name || 'Unassigned'}</span>
                                      {isOwnLead && <span className="text-[10px] font-normal text-emerald-400/80">(Your Lead)</span>}
                                    </p>
                                    {lead.assigned_to_profile?.employee_code && (
                                      <span className="text-[10px] text-muted-foreground font-mono block">Code: {lead.assigned_to_profile.employee_code}</span>
                                    )}
                                  </div>

                                  <div className="p-2 rounded-lg bg-background/60 border border-border">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                                      Originally Added By:
                                    </span>
                                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                                      <Users size={13} className="shrink-0 text-muted-foreground" />
                                      <span>{lead.assigned_by_profile?.full_name || 'Direct / System'}</span>
                                    </p>
                                    {lead.assigned_by_profile?.employee_code && (
                                      <span className="text-[10px] text-muted-foreground font-mono block">Code: {lead.assigned_by_profile.employee_code}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Matched Registered Client Profiles */}
                          {duplicateCheck?.registeredClients?.map(client => (
                            <div key={client.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-1 text-xs">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                                <Building2 size={13} />
                                <span>Official Registered Client Profile in OSBIC</span>
                              </div>
                              <p className="font-bold text-foreground text-sm">
                                {client.full_name} 
                                {client.company_name && <span className="text-muted-foreground text-xs font-normal ml-1">({client.company_name})</span>}
                              </p>
                              <p className="text-muted-foreground font-mono text-[11px]">{client.phone || client.email}</p>
                            </div>
                          ))}

                          {/* Matched by Name (when phone didn't match) */}
                          {!duplicateCheck?.hasPhoneDuplicate && duplicateCheck?.nameLeads?.map(lead => {
                            const isOwnLead = lead.assigned_to === profile?.id;
                            const badge = STATUS_BADGES[lead.status] || { label: lead.status, bg: 'bg-muted', text: 'text-foreground' };
                            return (
                              <div key={lead.id} className="bg-card/90 border border-border rounded-xl p-3 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-primary">{lead.lead_code || 'LEAD'}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${badge.bg} ${badge.text}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <p className="font-bold text-foreground">{lead.contact_name}</p>
                                <p className="text-muted-foreground text-[11px]">
                                  Currently with: <strong className={isOwnLead ? 'text-primary' : 'text-foreground'}>{lead.assigned_to_profile?.full_name || 'Unassigned'}</strong>
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Confirmation Override Checkbox */}
                        {duplicateCheck?.hasPhoneDuplicate && (
                          <div className="pt-2 border-t border-amber-500/20">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={allowDuplicateProceed}
                                onChange={e => setAllowDuplicateProceed(e.target.checked)}
                                className="mt-0.5 accent-primary rounded w-4 h-4"
                              />
                              <span className="text-[11px] text-amber-200/90 leading-tight">
                                I confirm this contact is already known, but this is an <strong>authorized separate inquiry</strong> that I need to add.
                              </span>
                            </label>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-muted-foreground">WhatsApp Number</label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.whatsappSameAsPhone}
                          onChange={e => setFormData({ ...formData, whatsappSameAsPhone: e.target.checked })}
                          className="accent-primary rounded"
                        />
                        <span>Same as phone</span>
                      </label>
                    </div>
                    <input
                      type="tel"
                      value={formData.whatsappSameAsPhone ? formData.contact_phone : formData.contact_whatsapp}
                      onChange={e => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                      disabled={formData.whatsappSameAsPhone}
                      placeholder="e.g. 91234567"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors disabled:opacity-50 text-sm font-mono"
                    />
                  </div>



                  {/* Interested Service (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Briefcase size={14} className="text-primary" />
                      <span>Interested Service (Optional)</span>
                    </label>
                    <select
                      value={formData.is_custom_service ? 'custom' : formData.selected_service_id}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setFormData({
                            ...formData,
                            is_custom_service: true,
                            selected_service_id: ''
                          });
                        } else {
                          setFormData({
                            ...formData,
                            is_custom_service: false,
                            selected_service_id: val,
                            custom_service_name: ''
                          });
                        }
                      }}
                      className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors text-sm"
                    >
                      <option value="" className="bg-card text-foreground">-- Select Interested Service (Optional) --</option>
                      {servicesList?.map(svc => (
                        <option key={svc.id} value={svc.id} className="bg-card text-foreground">
                          {svc.name_en} {svc.name_ar ? `(${svc.name_ar})` : ''}
                        </option>
                      ))}
                      <option value="custom" className="bg-card text-primary font-bold">+ Custom Service (Free Text)...</option>
                    </select>

                    {formData.is_custom_service && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 space-y-1"
                      >
                        <input
                          type="text"
                          value={formData.custom_service_name}
                          onChange={e => setFormData({ ...formData, custom_service_name: e.target.value })}
                          placeholder="e.g. Investor Visa, Company Liquidation, etc."
                          className="w-full bg-white/5 border border-primary/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                          autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground">Specify the custom service requirement</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Source *</label>
                    <button
                      type="button"
                      onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                      className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-left text-foreground focus:outline-none focus:border-gold transition-colors flex items-center justify-between text-sm"
                    >
                      <span>{selectedSourceName || 'Select lead source'}</span>
                      <ChevronDown size={16} className="text-muted-foreground" />
                    </button>

                    {isSourceDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsSourceDropdownOpen(false)} 
                        />
                        <div className="absolute left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 py-1 max-h-48 overflow-y-auto">
                          {sources?.map(source => (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, source_id: source.id, custom_source_text: '' });
                                setIsSourceDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors block"
                            >
                              {source.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {isOtherSource && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-medium text-muted-foreground">Specify Custom Source *</label>
                      <input
                        type="text"
                        value={formData.custom_source_text}
                        onChange={e => setFormData({ ...formData, custom_source_text: e.target.value })}
                        placeholder="e.g. Instagram Ad, Banner, etc."
                        className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors text-sm"
                        required
                      />
                    </motion.div>
                  )}

                  {isReferralSource && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Users size={14} className="text-primary" />
                        Referred By *
                      </label>
                      <input
                        type="text"
                        value={formData.referral_name}
                        onChange={e => setFormData({ ...formData, referral_name: e.target.value })}
                        placeholder="e.g. Mohammed Al-Harthy"
                        className="w-full bg-white/5 border border-primary/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                        autoFocus
                      />
                      <p className="text-[11px] text-muted-foreground">The person who referred this lead to you</p>
                    </motion.div>
                  )}
                </div>
              ) : (
                /* STEP 2: OPTIONAL */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="e.g. client@domain.com"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Company Name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="e.g. Al Maya Enterprises"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nationality</label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                      placeholder="e.g. Omani"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={formData.next_follow_up_at}
                      onChange={e => setFormData({ ...formData, next_follow_up_at: e.target.value })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any extra context, requirements, conversation history..."
                      rows={4}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-border flex gap-3">
              {step === 1 ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 rounded-xl border border-border text-foreground font-bold hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-primary text-[#0A0F1E] font-bold rounded-xl py-3 hover:bg-primary/90 transition-colors shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
                  >
                    <span>Next step</span>
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl border border-border text-foreground font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={createLeadMutation.isPending}
                    className="flex-1 bg-primary text-[#0A0F1E] font-bold rounded-xl py-3 hover:bg-primary/90 transition-colors shadow-lg shadow-gold/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createLeadMutation.isPending ? (
                      'Creating Lead...'
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        <span>Submit Lead</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
