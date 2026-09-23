import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  X, Phone, MessageSquare, Mail, Building2, Calendar, 
  Check, Plus, Clock, FileText, Trash2, Edit3, Globe,
  AlertTriangle, User, Compass, Save
} from 'lucide-react';
import { 
  useLeadInteractions, 
  useUpdateLead, 
  useDeleteLead,
  useCreateInteraction, 
  useLeads,
  type Lead 
} from '../../hooks/shared/useLeads';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { useAdminPackages } from '../../hooks/admin/useAdminPackages';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import CreateClientSlideOver from '../shared/clients/CreateClientSlideOver';
import { supabase } from '../../lib/supabase';
import QuotationAcceptWizard from './QuotationAcceptWizard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

export default function LeadDetailSlideOver({ isOpen, onClose, lead }: Props) {
  const navigate = useNavigate();
  const interactionsQuery = useLeadInteractions(lead?.id);
  const updateLeadMutation = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();
  const logInteractionMutation = useCreateInteraction();
  const { useLeadSourcesList } = useLeads();
  const { data: leadSources = [] } = useLeadSourcesList();

  const { data: leadQuotations } = useQuery({
    queryKey: ['lead_quotations', lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*) ')
        .eq('lead_id', lead!.id)
        .eq('type', 'quotation')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [selectedQuoteToAccept, setSelectedQuoteToAccept] = useState<any | null>(null);

  const [status, setStatus] = useState<string>('');
  const [lostReason, setLostReason] = useState<string>('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>('');
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  
  const [showLogForm, setShowLogForm] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editFormData, setEditFormData] = useState({
    contact_name: '',
    contact_phone: '',
    contact_whatsapp: '',
    contact_email: '',
    company_name: '',
    nationality: 'Oman',
    source_id: '',
    referral_name: '',
    notes: '',
  });

  const [newLog, setNewLog] = useState({
    type: 'call' as 'call' | 'whatsapp' | 'email' | 'meeting' | 'note',
    direction: 'outbound' as 'inbound' | 'outbound',
    notes: '',
    outcome: '',
    next_action: '',
  });

  const { data: services } = useAdminServices();
  const { data: packages } = useAdminPackages();

  const [addType, setAddType] = useState<'package' | 'service' | 'custom'>('service');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');

  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const handleClientCreated = async (client: any) => {
    try {
      const { error: invoiceLinkError } = await supabase
        .from('invoices')
        .update({ client_id: client.id })
        .eq('lead_id', lead!.id);

      if (invoiceLinkError) throw invoiceLinkError;

      updateLeadMutation.mutate({
        id: lead!.id,
        updates: { status: 'converted', converted_at: new Date().toISOString() }
      }, {
        onSuccess: () => {
          toast.success('Lead converted and quotation history linked!');
          setIsConvertOpen(false);
          onClose();
        }
      });
    } catch (err: any) {
      toast.error('Failed to link lead history: ' + err.message);
    }
  };

  // Sync state with lead changes
  React.useEffect(() => {
    if (lead) {
      setStatus(lead.status || 'new');
      setLostReason(lead.lost_reason || '');
      setNextFollowUpDate(lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : '');
      setFollowUpNotes(lead.follow_up_notes || '');
      setShowLogForm(false);
      setIsEditingDetails(false);
      setShowDeleteConfirm(false);
      setEditFormData({
        contact_name: lead.contact_name || '',
        contact_phone: lead.contact_phone || '',
        contact_whatsapp: lead.contact_whatsapp || '',
        contact_email: lead.contact_email || '',
        company_name: lead.company_name || '',
        nationality: lead.nationality || 'Oman',
        source_id: lead.source_id || '',
        referral_name: lead.referral_name || '',
        notes: lead.notes || '',
      });
    }
  }, [lead]);

  if (!lead) return null;

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.contact_name.trim()) {
      toast.error('Contact name is required');
      return;
    }

    try {
      await updateLeadMutation.mutateAsync({
        id: lead.id,
        updates: {
          contact_name: editFormData.contact_name.trim(),
          contact_phone: editFormData.contact_phone.trim() || undefined,
          contact_whatsapp: editFormData.contact_whatsapp.trim() || undefined,
          contact_email: editFormData.contact_email.trim() || undefined,
          company_name: editFormData.company_name.trim() || undefined,
          nationality: editFormData.nationality.trim() || undefined,
          source_id: editFormData.source_id || undefined,
          referral_name: editFormData.referral_name.trim() || undefined,
          notes: editFormData.notes.trim() || undefined,
        }
      });
      toast.success('Lead details updated successfully!');
      setIsEditingDetails(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async () => {
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      toast.success('Lead deleted successfully');
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete lead');
    }
  };

  const handleUpdateStatus = (newStatus: string) => {
    setStatus(newStatus);
    
    if (newStatus === 'converted') {
      setIsConvertOpen(true);
      return;
    }

    if (newStatus === 'quoted') {
      const checkAndQuoted = async () => {
        try {
          const { count, error } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', lead.id);
          
          if (error) throw error;
          
          await updateLeadMutation.mutateAsync({
            id: lead.id,
            updates: { status: 'quoted', lost_reason: null }
          });
          
          toast.success('Status updated to Quoted');
          
          if (!count || count === 0) {
            toast.success('Opening quotation builder...');
            setTimeout(() => {
              onClose();
              navigate(`/employee/quotations/new?lead_id=${lead.id}`);
            }, 1000);
          }
        } catch (err: any) {
          toast.error('Failed to update status: ' + err.message);
          setStatus(lead.status);
        }
      };
      checkAndQuoted();
      return;
    }

    if (newStatus !== 'lost') {
      updateLeadMutation.mutate({
        id: lead.id,
        updates: { status: newStatus as any, lost_reason: null }
      }, {
        onSuccess: () => toast.success('Status updated'),
        onError: () => setStatus(lead.status)
      });
    }
  };

  const handleAddInterestedService = () => {
    if (!lead) return;
    
    let itemName = '';
    let itemPrice = 0;
    
    if (addType === 'service') {
      const s = services?.find(srv => srv.id === selectedItemId);
      if (!s) return toast.error('Please select a service');
      itemName = s.name_en;
      itemPrice = (s.work_fee || 0) + (s.ministry_fee || 0);
    } else if (addType === 'package') {
      const p = packages?.find(pkg => pkg.id === selectedItemId);
      if (!p) return toast.error('Please select a package');
      itemName = p.name_en;
      const totalServicesFee = p.services?.reduce((sum: number, s: any) => sum + (s.work_fee || 0) + (s.ministry_fee || 0), 0) || 0;
      itemPrice = totalServicesFee * (1 - (p.discount_percentage || 0) / 100);
    } else {
      if (!customName.trim()) return toast.error('Please enter service description');
      const parsedPrice = parseFloat(customPrice);
      if (isNaN(parsedPrice) || parsedPrice < 0) return toast.error('Please enter a valid price');
      itemName = customName.trim();
      itemPrice = parsedPrice;
    }
    
    const newItem = {
      id: selectedItemId || 'custom-' + Date.now(),
      type: addType,
      name: itemName,
      price: itemPrice
    };
    
    const currentList = lead.interested_services || [];
    const updatedList = [...currentList, newItem];
    
    updateLeadMutation.mutate({
      id: lead.id,
      updates: { interested_services: updatedList }
    }, {
      onSuccess: () => {
        toast.success('Interested service added');
        setSelectedItemId('');
        setCustomName('');
        setCustomPrice('');
      }
    });
  };

  const handleDeleteInterestedService = (itemId: string, index: number) => {
    if (!lead) return;
    const currentList = lead.interested_services || [];
    const updatedList = currentList.filter((_, idx) => idx !== index);
    
    updateLeadMutation.mutate({
      id: lead.id,
      updates: { interested_services: updatedList }
    }, {
      onSuccess: () => toast.success('Interested service removed')
    });
  };

  const handleSaveLostReason = () => {
    updateLeadMutation.mutate({
      id: lead.id,
      updates: { status: 'lost', lost_reason: lostReason }
    }, {
      onSuccess: () => toast.success('Lost reason saved')
    });
  };

  const handleSaveFollowUp = () => {
    updateLeadMutation.mutate({
      id: lead.id,
      updates: { 
        next_follow_up_at: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null, 
        follow_up_notes: followUpNotes || null 
      }
    }, {
      onSuccess: () => toast.success('Follow-up updated')
    });
  };

  const handleClearFollowUp = () => {
    const originalDate = lead.next_follow_up_at 
      ? new Date(lead.next_follow_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
      : 'N/A';
    const followUpNote = `[Completed Follow-up] Scheduled for ${originalDate}: ${lead.follow_up_notes || 'No description provided'}`;

    logInteractionMutation.mutate({
      lead_id: lead.id,
      type: 'note',
      direction: 'outbound',
      notes: followUpNote,
      outcome: 'Completed'
    }, {
      onSuccess: () => {
        setNextFollowUpDate('');
        setFollowUpNotes('');
        updateLeadMutation.mutate({
          id: lead.id,
          updates: { next_follow_up_at: null, follow_up_notes: null }
        }, {
          onSuccess: () => toast.success('Follow-up completed & logged to history')
        });
      },
      onError: () => {
        toast.error('Failed to archive follow-up logs');
      }
    });
  };

  const handleLogInteractionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.notes) {
      toast.error('Notes are required to log an interaction');
      return;
    }

    logInteractionMutation.mutate({
      lead_id: lead.id,
      type: newLog.type,
      direction: newLog.direction,
      notes: newLog.notes,
      outcome: newLog.outcome || undefined,
      next_action: newLog.next_action || undefined,
    }, {
      onSuccess: () => {
        toast.success('Interaction logged successfully!');
        setShowLogForm(false);
        setNewLog({
          type: 'call',
          direction: 'outbound',
          notes: '',
          outcome: '',
          next_action: '',
        });
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to log interaction');
      }
    });
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={14} />;
      case 'whatsapp': return <MessageSquare size={14} />;
      case 'email': return <Mail size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const cleanPhone = lead.contact_phone ? lead.contact_phone.replace(/\D/g, '') : '';
  const waUrl = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('968') ? cleanPhone : `968${cleanPhone}`}` : '';
  const matchedSource = leadSources.find(s => s.id === lead.source_id);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                    {lead.lead_code || 'LEAD'}
                  </span>
                  {matchedSource && (
                    <span className="text-[10px] text-muted-foreground bg-white/5 border border-border px-2 py-0.5 rounded flex items-center gap-1">
                      <Compass size={10} />
                      {matchedSource.name}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-syne font-bold text-foreground mt-1.5 truncate">{lead.contact_name}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Delete Confirmation Alert Banner */}
              {showDeleteConfirm && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-400">Delete Lead permanently?</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This action will permanently remove this lead, interactions, and services. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLeadMutation.isPending}
                      onClick={handleDeleteLead}
                      className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      <span>{deleteLeadMutation.isPending ? 'Deleting...' : 'Yes, Delete Lead'}</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* 1. Contact Info Card & Edit Mode */}
              <div className="bg-white/5 border border-border/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Contact & Company</h3>
                  <div className="flex items-center gap-1.5">
                    {!isEditingDetails ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingDetails(true)}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95"
                          title="Edit contact details"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-[11px] font-bold flex items-center gap-1 active:scale-95"
                          title="Delete lead"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingDetails(false)}
                        className="px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground text-[11px] transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {isEditingDetails ? (
                  <form onSubmit={handleSaveDetails} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={editFormData.contact_name}
                        onChange={e => setEditFormData({ ...editFormData, contact_name: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs font-semibold focus:border-primary outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+968 9000 0000"
                          value={editFormData.contact_phone}
                          onChange={e => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          WhatsApp
                        </label>
                        <input
                          type="text"
                          placeholder="+968 9000 0000"
                          value={editFormData.contact_whatsapp}
                          onChange={e => setEditFormData({ ...editFormData, contact_whatsapp: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          placeholder="client@company.om"
                          value={editFormData.contact_email}
                          onChange={e => setEditFormData({ ...editFormData, contact_email: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          placeholder="LLC / SPC"
                          value={editFormData.company_name}
                          onChange={e => setEditFormData({ ...editFormData, company_name: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          Nationality
                        </label>
                        <input
                          type="text"
                          placeholder="Oman / Expat"
                          value={editFormData.nationality}
                          onChange={e => setEditFormData({ ...editFormData, nationality: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                          Lead Source
                        </label>
                        <select
                          value={editFormData.source_id}
                          onChange={e => setEditFormData({ ...editFormData, source_id: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                        >
                          <option value="">-- Select Source --</option>
                          {leadSources.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                        Referral / Extra Details
                      </label>
                      <input
                        type="text"
                        placeholder="Referred by..."
                        value={editFormData.referral_name}
                        onChange={e => setEditFormData({ ...editFormData, referral_name: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground/80 font-bold uppercase mb-1">
                        Internal Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Special client requirements, CR details, etc."
                        value={editFormData.notes}
                        onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:border-primary outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingDetails(false)}
                        className="flex-1 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateLeadMutation.isPending}
                        className="flex-1 py-2 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                      >
                        <Save size={13} />
                        <span>{updateLeadMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {lead.contact_phone && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">Phone</span>
                        <a href={`tel:${lead.contact_phone}`} className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5">
                          <Phone size={14} />
                          <span>{lead.contact_phone}</span>
                        </a>
                      </div>
                    )}

                    {lead.contact_phone && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">WhatsApp</span>
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-400 hover:underline flex items-center gap-1.5">
                          <MessageSquare size={14} />
                          <span>Open WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {lead.contact_email && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <a href={`mailto:${lead.contact_email}`} className="text-sm font-medium text-foreground hover:underline flex items-center gap-1.5">
                          <Mail size={14} />
                          <span>{lead.contact_email}</span>
                        </a>
                      </div>
                    )}

                    {lead.company_name && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">Company</span>
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Building2 size={14} className="text-muted-foreground/60" />
                          <span>{lead.company_name}</span>
                        </span>
                      </div>
                    )}

                    {lead.nationality && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">Nationality</span>
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Globe size={13} className="text-muted-foreground/60" />
                          <span>{lead.nationality}</span>
                        </span>
                      </div>
                    )}

                    {lead.referral_name && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground">Referred By</span>
                        <span className="text-xs font-semibold text-primary">
                          {lead.referral_name}
                        </span>
                      </div>
                    )}

                    {lead.notes && (
                      <div className="pt-2 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Notes</span>
                        <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40 whitespace-pre-wrap">
                          {lead.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Interested Services Section */}
              <div className="bg-white/5 border border-border/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Interested Services</h3>
                  <span className="text-[10px] font-mono text-muted-foreground/80 bg-white/5 px-2 py-0.5 rounded border border-border">
                    {lead.interested_services?.length || 0} Items
                  </span>
                </div>
                
                {/* List of currently interested services */}
                {lead.interested_services && lead.interested_services.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {lead.interested_services.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-muted/20 border border-border/60 rounded-xl">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                              item.type === 'package' ? 'bg-primary/20 text-primary border border-gold/20' : 
                              item.type === 'service' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 
                              'bg-zinc-500/20 text-zinc-400 border border-border'
                            }`}>
                              {item.type}
                            </span>
                            <p className="text-xs font-bold text-foreground line-clamp-1">{item.name}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Rate: OMR {item.price.toFixed(3)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteInterestedService(item.id, idx)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">No interested services logged. Add one below!</p>
                )}

                {/* Add Service Section */}
                <div className="pt-3 border-t border-border/60 space-y-3">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Add Interest Item</p>
                  
                  {/* Select Type */}
                  <div className="flex gap-1.5 p-0.5 bg-muted/40 rounded-xl border border-border/40">
                    {(['service', 'package', 'custom'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          setAddType(type);
                          setSelectedItemId('');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          addType === type ? 'bg-primary text-[#0A0F1E]' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Fields */}
                  {addType === 'service' && (
                    <select
                      value={selectedItemId}
                      onChange={e => setSelectedItemId(e.target.value)}
                      className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors"
                    >
                      <option value="" className="bg-card text-foreground">Select service...</option>
                      {services?.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name_en} (OMR {((s.work_fee || 0) + (s.ministry_fee || 0)).toFixed(3)})</option>
                      ))}
                    </select>
                  )}

                  {addType === 'package' && (
                    <select
                      value={selectedItemId}
                      onChange={e => setSelectedItemId(e.target.value)}
                      className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors"
                    >
                      <option value="" className="bg-card text-foreground">Select package...</option>
                      {packages?.filter(p => p.is_active).map(p => {
                        const totalServicesFee = p.services?.reduce((sum: number, s: any) => sum + (s.work_fee || 0) + (s.ministry_fee || 0), 0) || 0;
                        const finalPrice = totalServicesFee * (1 - (p.discount_percentage || 0) / 100);
                        return (
                          <option key={p.id} value={p.id} className="bg-card text-foreground">{p.name_en} (OMR {finalPrice.toFixed(3)})</option>
                        );
                      })}
                    </select>
                  )}

                  {addType === 'custom' && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Description..."
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        className="col-span-2 bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"
                      />
                      <input
                        type="number"
                        placeholder="Price..."
                        value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                        className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleAddInterestedService}
                    className="w-full bg-primary text-[#0A0F1E] font-bold text-xs py-2 rounded-xl hover:bg-primary/95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} />
                    <span>Add to Interest List</span>
                  </button>
                </div>
              </div>

              {/* 2. Status Update */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Lead Status</label>
                <select
                  value={status}
                  disabled={lead.status === 'converted'}
                  onChange={e => handleUpdateStatus(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="new" className="bg-card text-foreground">New</option>
                  <option value="on_progress" className="bg-card text-foreground">On Progress</option>
                  <option value="contacted" className="bg-card text-foreground">Contacted</option>
                  <option value="interested" className="bg-card text-foreground">Interested</option>
                  <option value="qualified" className="bg-card text-foreground">Qualified</option>
                  <option value="quoted" className="bg-card text-foreground">Quoted</option>
                  <option value="negotiating" className="bg-card text-foreground">Negotiating</option>
                  <option value="converted" className="bg-card text-foreground">Converted</option>
                  <option value="cancelled" className="bg-card text-foreground">Cancelled</option>
                  <option value="lost" className="bg-card text-foreground">Lost</option>
                  <option value="on_hold" className="bg-card text-foreground">On Hold</option>
                </select>

                {lead.status === 'converted' && (
                  <p className="text-[10px] text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                    ✓ Converted to Client. Status transitions are locked.
                  </p>
                )}

                {status === 'lost' && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Why was the lead lost?"
                      value={lostReason}
                      onChange={e => setLostReason(e.target.value)}
                      className="flex-1 bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                    <button 
                      onClick={handleSaveLostReason}
                      className="bg-primary text-[#0A0F1E] font-bold p-3 rounded-xl hover:bg-primary/95 transition-all"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Quotations History */}
              <div className="bg-white/5 border border-border/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Quotations ({leadQuotations?.length || 0})
                  </h3>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/employee/quotations/new?lead_id=${lead.id}`);
                    }}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-colors"
                  >
                    <Plus size={12} /> New Quotation
                  </button>
                </div>
                
                {leadQuotations && leadQuotations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                    {leadQuotations.map((quote: any) => (
                      <div 
                        key={quote.id} 
                        onClick={() => {
                          onClose();
                          navigate(`/employee/quotations/${quote.id}`);
                        }}
                        className="flex items-center justify-between p-3 bg-card border border-border/80 hover:border-gold/30 rounded-xl cursor-pointer hover:bg-muted/30 transition-all shadow-sm"
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground hover:text-primary transition-colors">{quote.invoice_number || 'Draft Quotation'}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(quote.created_at), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-primary">OMR {quote.total_amount.toFixed(3)}</p>
                          <div className="flex items-center gap-1.5 mt-1 justify-end">
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              quote.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              quote.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                              quote.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                            }`}>
                              {quote.status}
                            </span>
                            {quote.status !== 'accepted' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedQuoteToAccept(quote);
                                }}
                                className="px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[7px] font-bold uppercase tracking-widest transition-colors shadow-sm"
                              >
                                Accept & Launch
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground bg-black/10 rounded-xl border border-dashed border-border/60">
                    <p className="mb-2">No quotations generated yet for this lead.</p>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/employee/quotations/new?lead_id=${lead.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-[#0A0F1E] text-xs font-bold hover:shadow-md transition-all inline-flex items-center gap-1"
                    >
                      <Plus size={12} /> Create First Quotation
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Follow-Up Schedule */}
              <div className="bg-white/5 border border-border/80 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Next Follow-Up</h3>
                  {lead.next_follow_up_at && (
                    <button 
                      onClick={handleClearFollowUp}
                      className="text-[10px] font-bold text-[#0A0F1E] bg-primary px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-all uppercase tracking-wider"
                    >
                      Mark as Done
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mb-1">Follow-Up Date</label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={e => setNextFollowUpDate(e.target.value)}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2 text-foreground text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mb-1">Action Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Call to discuss quotation modifications"
                      value={followUpNotes}
                      onChange={e => setFollowUpNotes(e.target.value)}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2 text-foreground text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  <button 
                    onClick={handleSaveFollowUp}
                    className="w-full bg-muted/60 border border-border text-foreground hover:bg-muted font-bold text-xs py-2 rounded-xl transition-all"
                  >
                    Save Follow-up Details
                  </button>
                </div>
              </div>

              {/* 4. Log Interaction Form Toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Communication Logs</h3>
                  <button
                    onClick={() => setShowLogForm(!showLogForm)}
                    className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline uppercase tracking-wider"
                  >
                    <Plus size={12} />
                    <span>Log Interaction</span>
                  </button>
                </div>

                {showLogForm && (
                  <form onSubmit={handleLogInteractionSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase mb-1">Type</label>
                        <select
                          value={newLog.type}
                          onChange={e => setNewLog({ ...newLog, type: e.target.value as any })}
                          className="w-full bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground text-xs"
                        >
                          <option value="call">Call</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                          <option value="meeting">Meeting</option>
                          <option value="note">Internal Note</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase mb-1">Direction</label>
                        <select
                          value={newLog.direction}
                          onChange={e => setNewLog({ ...newLog, direction: e.target.value as any })}
                          className="w-full bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground text-xs"
                        >
                          <option value="outbound">Outbound</option>
                          <option value="inbound">Inbound</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase mb-1">Conversation Notes *</label>
                      <textarea
                        rows={2}
                        placeholder="What did you discuss?"
                        value={newLog.notes}
                        onChange={e => setNewLog({ ...newLog, notes: e.target.value })}
                        className="w-full bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground text-xs resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase mb-1">Outcome</label>
                        <input
                          type="text"
                          placeholder="e.g. Price agreed"
                          value={newLog.outcome}
                          onChange={e => setNewLog({ ...newLog, outcome: e.target.value })}
                          className="w-full bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground/60 font-bold uppercase mb-1">Next Action</label>
                        <input
                          type="text"
                          placeholder="e.g. Draft proposal"
                          value={newLog.next_action}
                          onChange={e => setNewLog({ ...newLog, next_action: e.target.value })}
                          className="w-full bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLogForm(false)}
                        className="flex-1 bg-transparent border border-border hover:bg-white/5 text-foreground text-xs py-2 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={logInteractionMutation.isPending}
                        className="flex-1 bg-primary text-[#0A0F1E] font-bold text-xs py-2 rounded-xl hover:bg-primary/95 transition-all"
                      >
                        {logInteractionMutation.isPending ? 'Logging...' : 'Save Log'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 5. Interaction Logs History List */}
                <div className="space-y-3">
                  {interactionsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground italic">Loading communication logs...</p>
                  ) : interactionsQuery.data && interactionsQuery.data.length > 0 ? (
                    interactionsQuery.data.map(log => (
                      <div key={log.id} className="p-4 rounded-xl border border-border bg-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                          <span className="capitalize font-bold text-primary flex items-center gap-1">
                            {getInteractionIcon(log.type)}
                            <span>{log.type} ({log.direction})</span>
                          </span>
                          <span>{format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{log.notes}</p>
                        {log.outcome && (
                          <p className="text-[10px] text-muted-foreground font-medium">
                            <span className="font-bold text-foreground/80">Outcome:</span> {log.outcome}
                          </p>
                        )}
                        {log.next_action && (
                          <p className="text-[10px] text-muted-foreground font-medium">
                            <span className="font-bold text-foreground/80">Next Action:</span> {log.next_action}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 rounded-2xl border border-dashed border-border bg-muted/5 text-center">
                      <Clock size={20} className="text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground italic">No interactions logged yet for this lead.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>

          <CreateClientSlideOver
            isOpen={isConvertOpen}
            onClose={() => {
              setIsConvertOpen(false);
              if (lead.status !== 'converted') {
                setStatus(lead.status || 'new');
              }
            }}
            clientToEdit={{
              full_name: lead.contact_name,
              email: lead.contact_email || '',
              phone: lead.contact_phone || '',
              whatsapp: lead.contact_whatsapp || '',
              nationality: lead.nationality || 'Oman'
            }}
            onClientCreated={handleClientCreated}
          />

          <AnimatePresence>
            {selectedQuoteToAccept && (
              <QuotationAcceptWizard 
                isOpen={selectedQuoteToAccept !== null}
                onClose={() => setSelectedQuoteToAccept(null)}
                quotation={{
                  ...selectedQuoteToAccept,
                  lead: lead
                }}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
