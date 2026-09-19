import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, ShieldAlert, CheckCircle2, Clock, 
  MessageSquare, User, Phone, Mail, Filter, Plus, 
  X, ChevronRight, Star, ArrowUpRight, Flame, 
  CheckCircle, Building2, Send, Trash2, ArrowRight
} from 'lucide-react';
import { 
  useBranchEscalations, 
  useCreateEscalation, 
  useResolveEscalation, 
  useDeleteEscalation,
  type BranchEscalationItem, 
  type EscalationCategory, 
  type EscalationSeverity, 
  type EscalationStatus, 
  type FeedbackChannel 
} from '../../hooks/employee/useBranchEscalations';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { format } from 'date-fns';

interface ClientEscalationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientEscalationsModal: React.FC<ClientEscalationsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const { data: escalations = [], isLoading } = useBranchEscalations(branchId);
  const { data: employees = [] } = useAdminEmployees(branchId);

  const createEscalationMutation = useCreateEscalation();
  const resolveEscalationMutation = useResolveEscalation();
  const deleteEscalationMutation = useDeleteEscalation();

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open_only' | 'critical' | 'resolved'>('all');
  const [selectedEscalation, setSelectedEscalation] = useState<BranchEscalationItem | null>(null);

  // Resolution form state
  const [resolutionStatus, setResolutionStatus] = useState<EscalationStatus>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newCategory, setNewCategory] = useState<EscalationCategory>('quality_complaint');
  const [newSeverity, setNewSeverity] = useState<EscalationSeverity>('medium');
  const [newChannel, setNewChannel] = useState<FeedbackChannel>('walk_in');
  const [newStaffId, setNewStaffId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRating, setNewRating] = useState<number>(3);

  if (!isOpen) return null;

  const openEscalations = escalations.filter(e => e.status === 'open' || e.status === 'investigating');
  const criticalEscalations = escalations.filter(e => (e.status === 'open' || e.status === 'investigating') && (e.severity === 'critical' || e.severity === 'high'));

  const filteredEscalations = escalations.filter(item => {
    if (statusFilter === 'open_only') return item.status === 'open' || item.status === 'investigating';
    if (statusFilter === 'critical') return item.severity === 'critical' || item.severity === 'high';
    if (statusFilter === 'resolved') return item.status === 'resolved';
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;

    await createEscalationMutation.mutateAsync({
      branch_id: branchId,
      title: newTitle,
      client_name: newClientName,
      client_phone: newClientPhone || null,
      client_email: newClientEmail || null,
      category: newCategory,
      severity: newSeverity,
      feedback_channel: newChannel,
      assigned_staff_id: newStaffId || null,
      description: newDescription,
      rating: newRating || null,
    });

    // Reset form
    setNewTitle('');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientEmail('');
    setNewDescription('');
    setActiveTab('list');
  };

  const handleResolveSubmit = async () => {
    if (!selectedEscalation) return;

    await resolveEscalationMutation.mutateAsync({
      id: selectedEscalation.id,
      status: resolutionStatus,
      resolution_notes: resolutionNotes,
    });

    setSelectedEscalation(null);
    setResolutionNotes('');
  };

  const getSeverityBadge = (severity: EscalationSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <Flame size={11} className="text-red-400" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle size={11} />
            HIGH PRIORITY
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Medium
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            Low
          </span>
        );
    }
  };

  const getCategoryLabel = (category: EscalationCategory) => {
    switch (category) {
      case 'sla_breach': return 'SLA Breach / Delay';
      case 'milestone_delay': return 'Milestone Overdue';
      case 'quality_complaint': return 'Quality Complaint';
      case 'fee_dispute': return 'Fee / Invoice Dispute';
      case 'unresponsive_staff': return 'Unresponsive Staff';
      case 'general': return 'General Feedback';
    }
  };

  const getStatusBadge = (status: EscalationStatus) => {
    switch (status) {
      case 'open':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">Open</span>;
      case 'investigating':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">Investigating</span>;
      case 'resolved':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Resolved</span>;
      case 'escalated_to_hq':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">Escalated to HQ</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
      >
        {/* ─── Modal Header ─── */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-card via-card to-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Quality Assurance</span>
                <span className="text-xs text-muted-foreground">• {selectedBranch?.name || 'Branch'}</span>
              </div>
              <h2 className="text-xl font-syne font-bold text-foreground">
                Client Satisfaction & Escalation Control
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'list'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Escalations Feed ({openEscalations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'create'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Plus size={13} />
                Log Incident
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Metric Pills Banner ─── */}
        <div className="px-6 py-3 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-foreground font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>Open Tickets: <strong>{openEscalations.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-500 font-semibold">
              <AlertTriangle size={13} />
              <span>Critical / High: <strong>{criticalEscalations.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <CheckCircle size={13} />
              <span>Resolved: <strong>{escalations.filter(e => e.status === 'resolved').length}</strong></span>
            </div>
          </div>

          {activeTab === 'list' && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">Filter:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'all' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({escalations.length})
              </button>
              <button
                onClick={() => setStatusFilter('open_only')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'open_only' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Open ({openEscalations.length})
              </button>
              <button
                onClick={() => setStatusFilter('critical')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'critical' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Critical / High ({criticalEscalations.length})
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Resolved
              </button>
            </div>
          )}
        </div>

        {/* ─── Modal Body ─── */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'list' ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading branch escalations...
                </div>
              ) : filteredEscalations.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-bold text-foreground">No Escalations Found</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {statusFilter === 'open_only'
                      ? 'Great job! All customer concerns in this branch have been addressed and resolved.'
                      : 'No customer complaints or quality incidents match the selected filter.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {filteredEscalations.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedEscalation(item);
                        setResolutionStatus(item.status === 'open' ? 'resolved' : item.status);
                        setResolutionNotes(item.resolution_notes || '');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                        item.severity === 'critical' && item.status !== 'resolved'
                          ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/60 shadow-sm'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getSeverityBadge(item.severity)}
                          {getStatusBadge(item.status)}
                          <span className="text-[11px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                            {getCategoryLabel(item.category)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Via {item.feedback_channel.replace('_', ' ')}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </h4>

                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <User size={12} className="text-primary" />
                            {item.client_name}
                          </span>
                          {item.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {item.client_phone}
                            </span>
                          )}
                          {item.staff && (
                            <span className="flex items-center gap-1 text-primary">
                              <span>Staff: {item.staff.full_name || item.staff.email}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status !== 'resolved' ? (
                          <button
                            type="button"
                            className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <span>Manage / Resolve</span>
                            <ArrowRight size={13} />
                          </button>
                        ) : (
                          <div className="text-right text-xs">
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                              <CheckCircle2 size={13} />
                              Resolved
                            </span>
                            {item.resolved_at && (
                              <div className="text-[10px] text-muted-foreground">
                                {format(new Date(item.resolved_at), 'dd MMM')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ─── Create Escalation Form ─── */
            <form onSubmit={handleCreateSubmit} className="space-y-5 max-w-2xl mx-auto">
              <div>
                <h3 className="text-base font-bold text-foreground">Log Customer Incident or Feedback</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record client dissatisfaction, delay flags, or service disputes for local supervisory investigation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Incident Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Delay in Commercial Registration Renewal"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. Sheikh Mohammed Al Hinai"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Client Phone Number</label>
                  <input
                    type="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="+968 9123 4567"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EscalationCategory)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="sla_breach">SLA Breach / Critical Delay</option>
                    <option value="milestone_delay">Milestone Overdue</option>
                    <option value="quality_complaint">Quality Complaint</option>
                    <option value="fee_dispute">Fee or Invoice Dispute</option>
                    <option value="unresponsive_staff">Unresponsive Staff</option>
                    <option value="general">General Client Grievance</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Severity Level *</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as EscalationSeverity)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">Low (Minor remark)</option>
                    <option value="medium">Medium (Requires attention)</option>
                    <option value="high">High (Customer upset / deadline risk)</option>
                    <option value="critical">Critical (Immediate manager intervention)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Feedback Channel *</label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as FeedbackChannel)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="walk_in">Walk-in at Branch Front Desk</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="manager_flag">Manager Audit Flag</option>
                    <option value="portal_review">Portal Client Review</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Staff Member Responsible</label>
                  <select
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Unspecified / General Branch --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.email} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Incident Description & Grievance *</label>
                  <textarea
                    required
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide specific facts: dates promised, client's statement, documents pending..."
                    className="w-full p-3.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEscalationMutation.isPending}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
                >
                  {createEscalationMutation.isPending ? 'Logging Incident...' : 'Log & Notify Branch Manager'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ─── Detail / Resolution SlideOver Modal ─── */}
        <AnimatePresence>
          {selectedEscalation && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-5"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(selectedEscalation.severity)}
                      {getStatusBadge(selectedEscalation.status)}
                    </div>
                    <h3 className="text-lg font-syne font-bold text-foreground">
                      {selectedEscalation.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedEscalation(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">Client</span>
                      <strong className="text-foreground">{selectedEscalation.client_name}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">Phone</span>
                      <strong className="text-foreground">{selectedEscalation.client_phone || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">Category</span>
                      <span className="text-foreground">{getCategoryLabel(selectedEscalation.category)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">Assigned Staff</span>
                      <span className="text-foreground">{selectedEscalation.staff?.full_name || 'Branch Team'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/70 mb-1">Grievance Description</span>
                    <p className="text-foreground leading-relaxed">
                      {selectedEscalation.description}
                    </p>
                  </div>
                </div>

                {/* Resolution & Actions */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-foreground block">
                    Manager Resolution & Corrective Action
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Update Status</label>
                      <select
                        value={resolutionStatus}
                        onChange={(e) => setResolutionStatus(e.target.value as EscalationStatus)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="investigating">Under Investigation</option>
                        <option value="resolved">Mark Resolved (Satisfied)</option>
                        <option value="escalated_to_hq">Escalate to HQ Operations</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      {selectedEscalation.client_phone && (
                        <a
                          href={`https://wa.me/${selectedEscalation.client_phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare size={13} />
                          WhatsApp Client
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Resolution Summary / Action Taken</label>
                    <textarea
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="e.g. Contacted client, expedited PRO document submission with Ministry, waived expedited fee."
                      className="w-full p-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Delete this escalation record?')) {
                        await deleteEscalationMutation.mutateAsync({ id: selectedEscalation.id });
                        setSelectedEscalation(null);
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-xs flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEscalation(null)}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleResolveSubmit}
                      disabled={resolveEscalationMutation.isPending}
                      className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      {resolveEscalationMutation.isPending ? 'Saving...' : 'Save Resolution'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
