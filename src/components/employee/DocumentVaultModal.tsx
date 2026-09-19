import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Shield, Key, FileText, Stamp, CreditCard, 
  Search, Plus, CheckCircle2, Clock, AlertTriangle, 
  ArrowRightLeft, Building2, User, Phone, Check, 
  History, Trash2, ChevronRight, Lock, Unlock,
  Calendar, Info, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  useBranchVaultDocuments, 
  useCreateVaultItem, 
  useCheckoutVaultItem, 
  useReturnToVaultItem, 
  useHandoverToClient, 
  useDeleteVaultItem,
  type DocumentType, 
  type VaultStatus, 
  type VaultItem 
} from '../../hooks/employee/useDocumentVault';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_TYPE_META: Record<DocumentType, { label: string; icon: any; color: string }> = {
  cr_certificate: { label: 'CR Certificate (سجل تجاري)', icon: FileText, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  company_stamp: { label: 'Company Stamp (ختم رسمي)', icon: Stamp, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  passport: { label: 'Passport (جواز سفر)', icon: User, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  civil_id: { label: 'Civil ID / Resident Card', icon: CreditCard, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  tenancy_contract: { label: 'Tenancy Contract (عقد إيجار)', icon: Building2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  pki_token: { label: 'PKI Portal Token / Dongle', icon: Key, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  power_of_attorney: { label: 'Power of Attorney (توكيل)', icon: Shield, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  municipal_license: { label: 'Municipal License (ترخيص بلدي)', icon: Building2, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  other: { label: 'Other Physical Asset', icon: Tag, color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
};

export const DocumentVaultModal: React.FC<DocumentVaultModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const [activeTab, setActiveTab] = useState<'inventory' | 'intake'>('inventory');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_vault' | 'with_pro' | 'returned_to_client'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Queries & Mutations
  const { data: vaultItems = [], isLoading } = useBranchVaultDocuments(branchId, statusFilter);
  const { data: employees = [] } = useAdminEmployees(branchId);
  const createItemMutation = useCreateVaultItem();
  const checkoutMutation = useCheckoutVaultItem();
  const returnToVaultMutation = useReturnToVaultItem();
  const handoverMutation = useHandoverToClient();
  const deleteMutation = useDeleteVaultItem();

  // Active item for modal actions
  const [checkoutTarget, setCheckoutTarget] = useState<VaultItem | null>(null);
  const [selectedProId, setSelectedProId] = useState('');
  const [checkoutReason, setCheckoutReason] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Selected item for audit timeline
  const [timelineTarget, setTimelineTarget] = useState<VaultItem | null>(null);

  // New Intake Form state
  const [newDoc, setNewDoc] = useState({
    document_type: 'cr_certificate' as DocumentType,
    document_name: '',
    document_identifier: '',
    client_name: '',
    contact_phone: '',
    locker_location: 'Safe #1 - Shelf A',
    notes: '',
  });

  if (!isOpen) return null;

  // Filter items
  const filteredItems = vaultItems.filter(item => {
    const q = searchTerm.toLowerCase();
    const matchesQuery = !q || 
      item.document_name.toLowerCase().includes(q) ||
      item.client_name.toLowerCase().includes(q) ||
      (item.document_identifier || '').toLowerCase().includes(q) ||
      (item.contact_phone || '').includes(q);

    const matchesType = typeFilter === 'all' || item.document_type === typeFilter;
    return matchesQuery && matchesType;
  });

  const inVaultCount = vaultItems.filter(i => i.status === 'in_vault').length;
  const withProCount = vaultItems.filter(i => i.status === 'with_pro').length;
  const returnedCount = vaultItems.filter(i => i.status === 'returned_to_client').length;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.document_name.trim() || !newDoc.client_name.trim()) {
      toast.error('Document title and client name are required');
      return;
    }
    if (!branchId) {
      toast.error('Branch context missing');
      return;
    }

    try {
      await createItemMutation.mutateAsync({
        branch_id: branchId,
        document_type: newDoc.document_type,
        document_name: newDoc.document_name.trim(),
        document_identifier: newDoc.document_identifier.trim() || undefined,
        client_name: newDoc.client_name.trim(),
        contact_phone: newDoc.contact_phone.trim() || undefined,
        locker_location: newDoc.locker_location.trim() || undefined,
        notes: newDoc.notes.trim() || undefined,
      });

      toast.success('Document received and safely logged in vault!');
      setNewDoc({
        document_type: 'cr_certificate',
        document_name: '',
        document_identifier: '',
        client_name: '',
        contact_phone: '',
        locker_location: 'Safe #1 - Shelf A',
        notes: '',
      });
      setActiveTab('inventory');
    } catch (err: any) {
      toast.error(err.message || 'Failed to log document in vault');
    }
  };

  const handleExecuteCheckout = async () => {
    if (!checkoutTarget || !selectedProId || !checkoutReason.trim()) {
      toast.error('Please choose a staff member and specify the purpose');
      return;
    }

    const proEmp = employees.find(e => e.id === selectedProId);

    try {
      await checkoutMutation.mutateAsync({
        itemId: checkoutTarget.id,
        proEmployeeId: selectedProId,
        proEmployeeName: proEmp?.full_name || 'Staff Member',
        reason: checkoutReason.trim(),
        expectedReturnDate,
      });

      toast.success(`Document checked out to ${proEmp?.full_name || 'PRO'}`);
      setCheckoutTarget(null);
      setSelectedProId('');
      setCheckoutReason('');
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed');
    }
  };

  const handleReturnToVault = async (item: VaultItem) => {
    try {
      await returnToVaultMutation.mutateAsync({
        itemId: item.id,
        notes: `Returned to vault by ${profile?.full_name || 'Manager'}.`,
      });
      toast.success('Document returned to Safe Vault!');
    } catch (err: any) {
      toast.error(err.message || 'Return failed');
    }
  };

  const handleHandoverToClient = async (item: VaultItem) => {
    if (!window.confirm(`Confirm return of ${item.document_name} directly to ${item.client_name}?`)) {
      return;
    }

    try {
      await handoverMutation.mutateAsync({
        itemId: item.id,
        handoverNotes: `Direct handover to client ${item.client_name} by ${profile?.full_name || 'Staff'}.`,
      });
      toast.success('Document handed back to client!');
    } catch (err: any) {
      toast.error(err.message || 'Handover failed');
    }
  };

  const handleDeleteItem = async (item: VaultItem) => {
    if (!window.confirm(`Permanently delete custody record for ${item.document_name}?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success('Custody record deleted');
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-card via-card/80 to-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              <Lock size={14} />
              <span>{selectedBranch?.name || 'Branch'} Custody Vault</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-syne font-bold text-foreground">
              Physical Documents & Assets Vault
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Securely track client original CRs, stamps, passports, and PRO ministry checkout transfers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'inventory'
                    ? 'bg-primary text-[#0A0F1E] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Vault Inventory ({vaultItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('intake')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'intake'
                    ? 'bg-primary text-[#0A0F1E] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Plus size={13} />
                <span>Intake Document</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'inventory' ? (
            <>
              {/* Quick Status Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  onClick={() => setStatusFilter(statusFilter === 'in_vault' ? 'all' : 'in_vault')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    statusFilter === 'in_vault' 
                      ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40' 
                      : 'bg-card border-border hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">In Safe Vault</span>
                    <Lock size={15} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-emerald-400">{inVaultCount}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Secure inside branch lockers</p>
                </div>

                <div 
                  onClick={() => setStatusFilter(statusFilter === 'with_pro' ? 'all' : 'with_pro')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    statusFilter === 'with_pro' 
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/40' 
                      : 'bg-card border-border hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">With PRO / In Transit</span>
                    <ArrowRightLeft size={15} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-amber-400">{withProCount}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Checked out for ministry visits</p>
                </div>

                <div 
                  onClick={() => setStatusFilter(statusFilter === 'returned_to_client' ? 'all' : 'returned_to_client')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    statusFilter === 'returned_to_client' 
                      ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/40' 
                      : 'bg-card border-border hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Returned to Client</span>
                    <CheckCircle2 size={15} className="text-blue-400" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-blue-400">{returnedCount}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Completed and handed over</p>
                </div>
              </div>

              {/* Search & Type Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by document title, client, CR #, phone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary outline-none"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="w-full sm:w-56 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none shrink-0"
                >
                  <option value="all">All Document Types</option>
                  {Object.entries(DOC_TYPE_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>

              {/* Documents List */}
              <div className="space-y-3">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-12">Loading vault documents...</p>
                ) : filteredItems.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-xs rounded-2xl border border-dashed border-border space-y-2">
                    <Lock size={24} className="mx-auto text-muted-foreground/40 mb-1" />
                    <p>No custody documents found matching your filter.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('intake')}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      + Intake new physical document
                    </button>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const typeMeta = DOC_TYPE_META[item.document_type] || DOC_TYPE_META.other;
                    const IconComponent = typeMeta.icon;

                    return (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-card border border-border hover:border-border/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm group"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${typeMeta.color}`}>
                            <IconComponent size={20} />
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${typeMeta.color}`}>
                                {item.document_type.replace('_', ' ')}
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                item.status === 'in_vault'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : item.status === 'with_pro'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                              }`}>
                                {item.status === 'in_vault' ? 'In Safe' : item.status === 'with_pro' ? 'With PRO' : 'Returned'}
                              </span>
                              {item.document_identifier && (
                                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                                  ID: {item.document_identifier}
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-bold text-foreground truncate">
                              {item.document_name}
                            </h4>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>Client: <strong className="text-foreground">{item.client_name}</strong></span>
                              {item.contact_phone && <span>• {item.contact_phone}</span>}
                              {item.locker_location && (
                                <span className="text-primary font-medium">• 📍 {item.locker_location}</span>
                              )}
                            </div>

                            {/* Status Details / Current holder info */}
                            {item.status === 'with_pro' && (
                              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-2 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <User size={13} className="shrink-0" />
                                  <span>Held by: <strong>{item.current_holder?.full_name || 'PRO Staff'}</strong></span>
                                  {item.checkout_reason && <span className="text-amber-300/80">({item.checkout_reason})</span>}
                                </div>
                                {item.expected_return_date && (
                                  <span className="text-[10px] font-mono shrink-0">
                                    Return: {item.expected_return_date}
                                  </span>
                                )}
                              </div>
                            )}

                            {item.status === 'returned_to_client' && item.returned_to_client_at && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Handed over on {format(new Date(item.returned_to_client_at), 'MMM dd, yyyy h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
                          {item.status === 'in_vault' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCheckoutTarget(item);
                                setSelectedProId('');
                                setCheckoutReason('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                            >
                              <ArrowRightLeft size={13} />
                              <span>Check Out to PRO</span>
                            </button>
                          )}

                          {item.status === 'with_pro' && (
                            <button
                              type="button"
                              onClick={() => handleReturnToVault(item)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                            >
                              <CheckCircle2 size={13} />
                              <span>Return to Safe</span>
                            </button>
                          )}

                          {item.status !== 'returned_to_client' && (
                            <button
                              type="button"
                              onClick={() => handleHandoverToClient(item)}
                              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-card border border-border text-foreground text-xs font-bold transition-all flex items-center gap-1.5"
                              title="Handover document back to customer"
                            >
                              <Check size={13} className="text-primary" />
                              <span>Return to Client</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setTimelineTarget(item)}
                            className="p-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View Custody Log Timeline"
                          >
                            <History size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Intake Form Tab */
            <form onSubmit={handleCreateSubmit} className="max-w-2xl mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div>
                <h3 className="text-lg font-syne font-bold text-foreground">
                  Intake Physical Document / Company Asset
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record custody of physical documents entrusted by the client to your branch.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Document Type *
                    </label>
                    <select
                      value={newDoc.document_type}
                      onChange={e => setNewDoc({ ...newDoc, document_type: e.target.value as any })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:border-primary outline-none"
                    >
                      {Object.entries(DOC_TYPE_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Document / Asset Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Al Noor LLC - Original CR Certificate"
                      value={newDoc.document_name}
                      onChange={e => setNewDoc({ ...newDoc, document_name: e.target.value })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Document Identifier / Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CR #1092834 / Passport #A123984"
                      value={newDoc.document_identifier}
                      onChange={e => setNewDoc({ ...newDoc, document_identifier: e.target.value })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Branch Storage Location *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Safe #1 - Shelf A / Drawer 3"
                      value={newDoc.locker_location}
                      onChange={e => setNewDoc({ ...newDoc, locker_location: e.target.value })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Client / Company Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Salim Al Rawahi"
                      value={newDoc.client_name}
                      onChange={e => setNewDoc({ ...newDoc, client_name: e.target.value })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+968 9000 0000"
                      value={newDoc.contact_phone}
                      onChange={e => setNewDoc({ ...newDoc, contact_phone: e.target.value })}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Condition / Special Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Document condition, number of stamps received, special instructions..."
                    value={newDoc.notes}
                    onChange={e => setNewDoc({ ...newDoc, notes: e.target.value })}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold hover:bg-primary/90 transition-all shadow-md active:scale-95"
                >
                  {createItemMutation.isPending ? 'Logging...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ─── Check Out to PRO Modal ─── */}
        {checkoutTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-amber-400" />
                  <h4 className="text-sm font-bold text-foreground">Check Out to PRO Staff</h4>
                </div>
                <button onClick={() => setCheckoutTarget(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                  <span className="font-bold text-foreground block">{checkoutTarget.document_name}</span>
                  <span className="text-muted-foreground text-[11px]">Client: {checkoutTarget.client_name}</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Assign to PRO / Staff Member *
                  </label>
                  <select
                    value={selectedProId}
                    onChange={e => setSelectedProId(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    required
                  >
                    <option value="">-- Choose Employee / PRO --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.department || emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Purpose / Ministry Destination *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Taking to Ministry of Labour for attestation"
                    value={checkoutReason}
                    onChange={e => setCheckoutReason(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={e => setExpectedReturnDate(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCheckoutTarget(null)}
                  className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={checkoutMutation.isPending}
                  onClick={handleExecuteCheckout}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {checkoutMutation.isPending ? 'Checking out...' : 'Confirm Checkout'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ─── Custody Audit Timeline Modal ─── */}
        {timelineTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  <h4 className="text-sm font-bold text-foreground">Custody Audit Trail</h4>
                </div>
                <button onClick={() => setTimelineTarget(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-0.5">
                <p className="font-bold text-foreground">{timelineTarget.document_name}</p>
                <p className="text-[11px] text-muted-foreground">Client: {timelineTarget.client_name}</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 divide-y divide-border/60">
                {timelineTarget.logs && timelineTarget.logs.length > 0 ? (
                  timelineTarget.logs.map(log => (
                    <div key={log.id} className="pt-3 first:pt-0 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-bold text-primary capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span>{format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}</span>
                      </div>
                      <p className="text-foreground text-xs leading-relaxed">{log.notes}</p>
                      {log.actor?.full_name && (
                        <p className="text-[10px] text-muted-foreground">
                          Logged by: <span className="font-medium text-foreground">{log.actor.full_name}</span>
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No custody log entries recorded yet.</p>
                )}
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setTimelineTarget(null)}
                  className="px-4 py-2 rounded-xl bg-muted text-xs font-bold text-foreground hover:bg-muted/80"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </motion.div>
    </div>
  );
};
