import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Phone, MessageSquare, Mail, Users, FileText, 
  Calendar, Clock, CheckCircle2, ArrowUpRight, ArrowDownLeft,
  Loader2, Sparkles, Building2, ThumbsUp, ThumbsDown, Minus
} from 'lucide-react';
import { useCreateInteraction, useUpdateLead, type Lead } from '../../hooks/shared/useLeads';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

export const QuickInteractionModal: React.FC<Props> = ({ isOpen, onClose, lead }) => {
  const createInteraction = useCreateInteraction();
  const updateLead = useUpdateLead();

  const [type, setType] = useState<'call' | 'whatsapp' | 'email' | 'meeting' | 'note'>('call');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [outcomeType, setOutcomeType] = useState<'positive' | 'negative' | 'neutral'>('neutral');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('Interested in services');
  const [newStatus, setNewStatus] = useState<string>(lead?.status || 'contacted');
  const [nextFollowUp, setNextFollowUp] = useState<string>('');

  React.useEffect(() => {
    if (lead) {
      setNewStatus(lead.status || 'contacted');
      setNextFollowUp(lead.next_follow_up_at ? lead.next_follow_up_at.substring(0, 16) : '');
      setNotes('');
    }
  }, [lead]);

  const handleQuickFollowUpPreset = (daysAhead: number) => {
    const target = addDays(new Date(), daysAhead);
    target.setHours(10, 0, 0, 0); // Default to 10:00 AM
    setNextFollowUp(format(target, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !notes.trim()) {
      toast.error('Please enter discussion notes');
      return;
    }

    try {
      // 1. Log interaction
      await createInteraction.mutateAsync({
        lead_id: lead.id,
        type,
        direction,
        outcome_type: outcomeType,
        notes: notes.trim(),
        outcome: outcome.trim()
      });

      // 2. Update lead status and follow-up if changed
      const leadUpdates: any = {};
      if (newStatus && newStatus !== lead.status) {
        leadUpdates.status = newStatus;
      }
      if (nextFollowUp) {
        leadUpdates.next_follow_up_at = new Date(nextFollowUp).toISOString();
      }
      if (Object.keys(leadUpdates).length > 0) {
        await updateLead.mutateAsync({
          id: lead.id,
          updates: leadUpdates
        });
      }

      toast.success('Activity logged to Daily Sales Report!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log activity');
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                {lead.contact_name?.[0]?.toUpperCase() || 'L'}
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  {lead.contact_name}
                  {lead.company_name && <span className="text-muted-foreground font-normal text-xs">({lead.company_name})</span>}
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">{lead.contact_phone || 'No phone'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {/* Type Selector */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                Activity Type
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'call', label: 'Call', icon: Phone },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'meeting', label: 'Meeting', icon: Users },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'note', label: 'Note', icon: FileText }
                ].map(item => {
                  const Icon = item.icon;
                  const active = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as any)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 font-bold transition-all ${
                        active 
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direction Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Direction:</span>
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setDirection('outbound')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowUpRight size={12} /> Outbound (I called)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('inbound')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    direction === 'inbound' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowDownLeft size={12} /> Inbound (Client called)
                </button>
              </div>
            </div>

            {/* Call Result */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                Call Result
              </label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'positive', label: 'Positive', icon: ThumbsUp, active: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200' },
                  { id: 'neutral',  label: 'Neutral',  icon: Minus,     active: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200' },
                  { id: 'negative', label: 'Negative', icon: ThumbsDown, active: 'bg-red-500 text-white border-red-500 shadow-sm shadow-red-200' },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = outcomeType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOutcomeType(item.id as any)}
                      className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-[11px] transition-all ${
                        isActive ? item.active : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon size={13} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                Discussion Summary & Details *
              </label>
              <textarea
                rows={3}
                required
                placeholder="What was discussed with the client? e.g. Discussed 100% foreign ownership LLC setup, agreed to send proposal..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-xl p-3 text-xs text-foreground focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60 resize-none"
              />
            </div>

            {/* Outcome & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Call Outcome
                </label>
                <select
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none cursor-pointer"
                >
                  <option value="Interested in services">Interested in services</option>
                  <option value="Quotation requested">Quotation requested</option>
                  <option value="Meeting scheduled">Meeting scheduled</option>
                  <option value="Follow-up requested later">Follow-up requested later</option>
                  <option value="Not answering / Busy">Not answering / Busy</option>
                  <option value="Not interested / Budget issue">Not interested / Budget issue</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Update Lead Stage
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none cursor-pointer capitalize"
                >
                  <option value="new">New Inquiry</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="quoted">Quoted / Proposal Sent</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="converted">Won / Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>

            {/* Next Follow-up */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Next Follow-up Schedule
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUpPreset(1)}
                    className="px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                  >
                    +1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUpPreset(2)}
                    className="px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                  >
                    +2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUpPreset(7)}
                    className="px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                  >
                    +1 Week
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                value={nextFollowUp}
                onChange={e => setNextFollowUp(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-foreground font-bold hover:bg-muted transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createInteraction.isPending || updateLead.isPending}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                {createInteraction.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Save to Daily Sheet</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
