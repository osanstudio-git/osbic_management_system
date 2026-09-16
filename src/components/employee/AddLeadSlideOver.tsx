import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ArrowRight, ArrowLeft, ChevronDown, Users } from 'lucide-react';
import { useLeads, useCreateLead } from '../../hooks/shared/useLeads';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddLeadSlideOver({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    contact_whatsapp: '',
    whatsappSameAsPhone: false,
    source_id: '',
    custom_source_text: '',
    referral_name: '',
    services: [] as string[],
    contact_email: '',
    company_name: '',
    nationality: '',
    notes: '',
    next_follow_up_at: '',
  });

  const { useLeadSourcesList } = useLeads();
  const { data: sources } = useLeadSourcesList();

  const createLeadMutation = useCreateLead();

  const selectedSourceName = sources?.find(s => s.id === formData.source_id)?.name;
  const isOtherSource = selectedSourceName === 'Other';
  const isReferralSource = selectedSourceName?.toLowerCase().includes('referral') ?? false;

  // Reset form when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setIsSourceDropdownOpen(false);
      setFormData({
        contact_name: '',
        contact_phone: '',
        contact_whatsapp: '',
        whatsappSameAsPhone: false,
        source_id: '',
        custom_source_text: '',
        referral_name: '',
        services: [],
        contact_email: '',
        company_name: '',
        nationality: '',
        notes: '',
        next_follow_up_at: '',
      });
    }
  }, [isOpen]);

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

    createLeadMutation.mutate({
      contact_name: formData.contact_name,
      contact_phone: formData.contact_phone,
      contact_whatsapp: formData.whatsappSameAsPhone ? formData.contact_phone : formData.contact_whatsapp,
      source_id: formData.source_id,
      services: formData.services,
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
                /* STEP 1: REQUIRED */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Contact Name *</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="e.g. Salim Al-Harthy"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone Number *</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="e.g. 91234567"
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                      required
                    />
                  </div>

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
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors disabled:opacity-50"
                    />
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
                        className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
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
                        className="w-full bg-white/5 border border-primary/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
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
