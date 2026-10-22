import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, Download, TrendingUp, DollarSign, Receipt,
  Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, X, Upload,
  Eye, Trash2, Edit2, Users, FileText, Calendar, Phone, Banknote,
  CreditCard, Landmark, BarChart3, ArrowUpRight, ArrowDownRight,
  Printer, RefreshCw, ShoppingBag
} from 'lucide-react';
import { useWalkinSales, calcProfit } from '../../hooks/employee/useWalkinSales';
import type { WalkinSale, WalkinSaleFormData, WalkinStatus, PaymentMode } from '../../hooks/employee/useWalkinSales';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays } from 'date-fns';

// ─── Constants ─────────────────────────────────────────────────────────────

const WORK_TYPES = [
  'Visa Typing', 'Emirates ID', 'Trade License', 'PRO Services',
  'Document Attestation', 'Translation', 'Notarization', 'Medical Insurance',
  'Labour Card', 'Tenancy Contract', 'Power of Attorney', 'Other',
];

const STATUS_CONFIG: Record<WalkinStatus, { label: string; color: string; icon: React.FC<any>; dot: string }> = {
  pending:     { label: 'Pending',     color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',   icon: Clock,         dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',     icon: RefreshCw,     dot: 'bg-blue-400' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle2, dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',   color: 'text-rose-400 bg-rose-400/10 border-rose-400/20',     icon: XCircle,       dot: 'bg-rose-400' },
};

const PAYMENT_CONFIG: Record<PaymentMode, { label: string; icon: React.FC<any> }> = {
  cash:          { label: 'Cash',          icon: Banknote   },
  card:          { label: 'Card',          icon: CreditCard },
  bank_transfer: { label: 'Bank Transfer', icon: Landmark   },
};

const emptyForm = (): WalkinSaleFormData => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  client_name: '',
  client_phone: '',
  work_type: WORK_TYPES[0],
  work_description: '',
  payment_mode: 'cash',
  total_amount: 0,
  government_fee: 0,
  status: 'pending',
  notes: '',
  client_receipt_file: null,
  gov_fee_receipt_file: null,
});

// ─── Receipt Upload Field ────────────────────────────────────────────────────

const ReceiptUploadField: React.FC<{
  label: string;
  file: File | null | undefined;
  existingUrl: string | null;
  onChange: (file: File | null) => void;
}> = ({ label, file, existingUrl, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : existingUrl;
  const isPdf = (file?.name || existingUrl || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label} <span className="text-muted-foreground font-normal normal-case">(optional)</span></label>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 cursor-pointer transition-all group"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
        {preview && !isPdf ? (
          <img src={preview} alt="receipt" className="w-10 h-10 rounded-lg object-cover border border-border" />
        ) : preview && isPdf ? (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText size={18} className="text-primary" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Upload size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {file ? file.name : preview ? 'Receipt uploaded' : 'Click to upload'}
          </p>
          <p className="text-xs text-muted-foreground">JPG, PNG, PDF — max 5MB</p>
        </div>
        {(file || preview) && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Sale Form Modal ─────────────────────────────────────────────────────────

const SaleFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  editSale?: WalkinSale | null;
}> = ({ isOpen, onClose, editSale }) => {
  const { createSale, updateSale, getReceiptUrl } = useWalkinSales();
  const [form, setForm] = useState<WalkinSaleFormData>(emptyForm);
  const [customWorkType, setCustomWorkType] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (editSale) {
        setForm({
          date: editSale.date,
          client_name: editSale.client_name,
          client_phone: editSale.client_phone || '',
          work_type: editSale.work_type,
          work_description: editSale.work_description || '',
          payment_mode: editSale.payment_mode,
          total_amount: editSale.total_amount,
          government_fee: editSale.government_fee,
          status: editSale.status,
          notes: editSale.notes || '',
          client_receipt_file: null,
          gov_fee_receipt_file: null,
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [isOpen, editSale]);

  const set = <K extends keyof WalkinSaleFormData>(key: K, value: WalkinSaleFormData[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const liveProfit = calcProfit(Number(form.total_amount) || 0, Number(form.government_fee) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalWorkType = form.work_type === 'Other' ? customWorkType : form.work_type;
    const payload = { ...form, work_type: finalWorkType };

    if (editSale) {
      await updateSale.mutateAsync({ id: editSale.id, formData: payload });
    } else {
      await createSale.mutateAsync(payload);
    }
    onClose();
  };

  const isPending = createSale.isPending || updateSale.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
              <div>
                <h2 className="text-xl font-bold text-foreground">{editSale ? 'Edit Sale Entry' : 'Add Walk-in Sale'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Record a walk-in client transaction</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: Date + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Date</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value as WalkinStatus)}
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm">
                    {(Object.keys(STATUS_CONFIG) as WalkinStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Client Name + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Client Name</label>
                  <input type="text" value={form.client_name} onChange={e => set('client_name', e.target.value)} required placeholder="Full name"
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Client Phone <span className="font-normal normal-case text-muted-foreground">(optional)</span></label>
                  <input type="tel" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+971..."
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                </div>
              </div>

              {/* Work Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Work Type</label>
                <select value={form.work_type} onChange={e => set('work_type', e.target.value)}
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm">
                  {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {form.work_type === 'Other' && (
                  <input type="text" value={customWorkType} onChange={e => setCustomWorkType(e.target.value)} placeholder="Specify work type..."
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Work Description <span className="font-normal normal-case text-muted-foreground">(optional)</span></label>
                <textarea value={form.work_description} onChange={e => set('work_description', e.target.value)} rows={2} placeholder="Brief description..."
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm resize-none" />
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PAYMENT_CONFIG) as PaymentMode[]).map(pm => {
                    const cfg = PAYMENT_CONFIG[pm];
                    const Icon = cfg.icon;
                    return (
                      <button key={pm} type="button" onClick={() => set('payment_mode', pm)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${form.payment_mode === pm ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-border/60 hover:text-foreground'}`}>
                        <Icon size={16} /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount (AED)</label>
                  <input type="number" min="0" step="0.01" value={form.total_amount || ''} onChange={e => set('total_amount', parseFloat(e.target.value) || 0)} required placeholder="0.00"
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gov. Fee (AED)</label>
                  <input type="number" min="0" step="0.01" value={form.government_fee || ''} onChange={e => set('government_fee', parseFloat(e.target.value) || 0)} placeholder="0.00"
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Profit (Auto)</label>
                  <div className={`w-full p-3 rounded-xl border text-sm font-bold ${liveProfit > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-muted/50 border-border text-muted-foreground'}`}>
                    {liveProfit.toFixed(2)} AED
                  </div>
                </div>
              </div>

              {/* Receipt Uploads */}
              <div className="grid grid-cols-2 gap-4">
                <ReceiptUploadField
                  label="Client Payment Receipt"
                  file={form.client_receipt_file ?? null}
                  existingUrl={editSale ? getReceiptUrl(editSale.client_receipt_url) : null}
                  onChange={f => set('client_receipt_file', f)}
                />
                <ReceiptUploadField
                  label="Gov. Fee Receipt"
                  file={form.gov_fee_receipt_file ?? null}
                  existingUrl={editSale ? getReceiptUrl(editSale.gov_fee_receipt_url) : null}
                  onChange={f => set('gov_fee_receipt_file', f)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Notes <span className="font-normal normal-case text-muted-foreground">(optional)</span></label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any additional notes..."
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all text-sm resize-none" />
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/20 shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSubmit as any} disabled={isPending}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                {isPending ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><CheckCircle2 size={16} /> {editSale ? 'Update Sale' : 'Add Sale'}</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── Status Badge & Quick Changer ────────────────────────────────────────────

const StatusDropdown: React.FC<{ sale: WalkinSale }> = ({ sale }) => {
  const { updateStatus } = useWalkinSales();
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[sale.status];
  const Icon = cfg.icon;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${cfg.color}`}>
        <Icon size={11} /> {cfg.label} <ChevronDown size={10} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="absolute left-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-2xl z-20 overflow-hidden"
            >
              {(Object.keys(STATUS_CONFIG) as WalkinStatus[]).map(s => {
                const sc = STATUS_CONFIG[s];
                const SIcon = sc.icon;
                return (
                  <button key={s} onClick={() => { updateStatus.mutate({ id: sale.id, status: s }); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/50 ${sale.status === s ? 'text-primary' : 'text-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                    {sc.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Stats Card ──────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string; sub?: string; icon: React.FC<any>; color: string }> = ({ label, value, sub, icon: Icon, color }) => (
  <div className={`bg-card border border-border rounded-2xl p-5 flex items-start gap-4`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const WalkinSales: React.FC = () => {
  const { profile } = useAuth();
  const { sales, isLoading, deleteSale, getReceiptUrl } = useWalkinSales();
  const [activeTab, setActiveTab] = useState<'sales' | 'active' | 'reports'>('sales');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WalkinStatus | 'all'>('all');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [modalOpen, setModalOpen] = useState(false);
  const [editSale, setEditSale] = useState<WalkinSale | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = sales.filter(s => {
    const matchSearch =
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.client_phone || '').includes(search) ||
      s.work_type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeSales = sales.filter(s => s.status === 'in_progress');

  // ── Report Aggregation ────────────────────────────────────────────────────

  const getReportData = useCallback(() => {
    const now = new Date();
    let start: Date, end: Date;
    if (reportPeriod === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (reportPeriod === 'weekly') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    const inRange = sales.filter(s => {
      try { return isWithinInterval(parseISO(s.date), { start, end }); } catch { return false; }
    });

    const totalRevenue = inRange.reduce((a, s) => a + (s.total_amount || 0), 0);
    const totalGovFee  = inRange.reduce((a, s) => a + (s.government_fee || 0), 0);
    const totalProfit  = inRange.reduce((a, s) => a + (s.profit || 0), 0);
    const countByStatus = Object.keys(STATUS_CONFIG).reduce((acc, k) => {
      acc[k as WalkinStatus] = inRange.filter(s => s.status === k).length;
      return acc;
    }, {} as Record<WalkinStatus, number>);

    // Group by work type
    const byWorkType: Record<string, { count: number; revenue: number; profit: number }> = {};
    inRange.forEach(s => {
      if (!byWorkType[s.work_type]) byWorkType[s.work_type] = { count: 0, revenue: 0, profit: 0 };
      byWorkType[s.work_type].count++;
      byWorkType[s.work_type].revenue += s.total_amount || 0;
      byWorkType[s.work_type].profit += s.profit || 0;
    });

    return { inRange, totalRevenue, totalGovFee, totalProfit, countByStatus, byWorkType, start, end };
  }, [sales, reportPeriod]);

  const report = getReportData();

  const handleEdit = (sale: WalkinSale) => { setEditSale(sale); setModalOpen(true); };
  const handleAdd = () => { setEditSale(null); setModalOpen(true); };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag size={22} className="text-primary" />
            </div>
            Daily Sales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Walk-in client transactions & daily work log</p>
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20">
          <Plus size={18} /> Add New Sale
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Revenue" icon={DollarSign} color="bg-emerald-500/10 text-emerald-400"
          value={`${sales.filter(s => s.date === format(new Date(), 'yyyy-MM-dd')).reduce((a, s) => a + s.total_amount, 0).toFixed(0)} AED`}
          sub="Total collected today" />
        <StatCard label="Today's Profit" icon={TrendingUp} color="bg-blue-500/10 text-blue-400"
          value={`${sales.filter(s => s.date === format(new Date(), 'yyyy-MM-dd')).reduce((a, s) => a + s.profit, 0).toFixed(0)} AED`}
          sub="After gov. fees" />
        <StatCard label="Active Works" icon={RefreshCw} color="bg-amber-500/10 text-amber-400"
          value={`${activeSales.length}`}
          sub="In progress now" />
        <StatCard label="Total Records" icon={Receipt} color="bg-purple-500/10 text-purple-400"
          value={`${sales.length}`}
          sub="All time entries" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border w-fit">
        {[
          { key: 'sales', label: 'My Sales', icon: Receipt },
          { key: 'active', label: `Active Works (${activeSales.length})`, icon: RefreshCw },
          { key: 'reports', label: 'Reports', icon: BarChart3 },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.key ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MY SALES ─────────────────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/30 border border-border px-4 py-2 rounded-xl flex-1 min-w-[220px]">
              <Search size={16} className="text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, work type..."
                className="bg-transparent border-none outline-none text-sm text-foreground w-full placeholder:text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              {(['all', ...Object.keys(STATUS_CONFIG)] as (WalkinStatus | 'all')[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${statusFilter === s ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {s === 'all' ? 'All' : STATUS_CONFIG[s as WalkinStatus].label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={24} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-2xl">
              <ShoppingBag size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No sales entries yet</p>
              <p className="text-xs mt-1">Click "Add New Sale" to record a walk-in transaction</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Date', 'Client', 'Work Type', 'Payment', 'Amount', 'Gov. Fee', 'Profit', 'Status', 'Receipts', 'Actions'].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((sale, i) => {
                      const PayIcon = PAYMENT_CONFIG[sale.payment_mode].icon;
                      const clientReceiptUrl = getReceiptUrl(sale.client_receipt_url);
                      const govReceiptUrl = getReceiptUrl(sale.gov_fee_receipt_url);

                      return (
                        <motion.tr key={sale.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className="hover:bg-muted/20 transition-colors group">
                          <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap font-medium">
                            {format(parseISO(sale.date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-foreground">{sale.client_name}</p>
                            {sale.client_phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} />{sale.client_phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-foreground">{sale.work_type}</span>
                            {sale.work_description && <p className="text-xs text-muted-foreground mt-0.5 max-w-[150px] truncate">{sale.work_description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <PayIcon size={13} /> {PAYMENT_CONFIG[sale.payment_mode].label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-foreground whitespace-nowrap">{sale.total_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">{sale.government_fee.toFixed(2)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-sm font-bold ${sale.profit > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                              {sale.profit.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusDropdown sale={sale} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {clientReceiptUrl && (
                                <a href={clientReceiptUrl} target="_blank" rel="noopener noreferrer" title="Client Receipt"
                                  className="p-1.5 rounded-lg bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition-colors">
                                  <Receipt size={13} />
                                </a>
                              )}
                              {govReceiptUrl && (
                                <a href={govReceiptUrl} target="_blank" rel="noopener noreferrer" title="Gov. Fee Receipt"
                                  className="p-1.5 rounded-lg bg-purple-400/10 text-purple-400 hover:bg-purple-400/20 transition-colors">
                                  <Landmark size={13} />
                                </a>
                              )}
                              {!clientReceiptUrl && !govReceiptUrl && <span className="text-xs text-muted-foreground">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(sale)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setDeleteId(sale.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ACTIVE WORKS ─────────────────────────────────────────────────── */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-2xl">
              <CheckCircle2 size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No active works right now</p>
              <p className="text-xs mt-1">All tasks are either completed or pending</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSales.map((sale, i) => {
                const days = differenceInDays(new Date(), parseISO(sale.date));
                return (
                  <motion.div key={sale.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-card border border-blue-400/20 rounded-2xl p-5 space-y-3 hover:border-blue-400/40 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-foreground">{sale.client_name}</p>
                        {sale.client_phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone size={10} />{sale.client_phone}</p>}
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-400/10 text-blue-400 border border-blue-400/20">
                        {days === 0 ? 'Today' : `${days}d ago`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-foreground">{sale.work_type}</span>
                    </div>
                    {sale.work_description && <p className="text-xs text-muted-foreground">{sale.work_description}</p>}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <p className="text-sm font-bold text-emerald-400">{sale.profit.toFixed(2)} AED</p>
                      </div>
                      {sale.employee && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Assigned to</p>
                          <p className="text-xs font-semibold text-foreground">{sale.employee.full_name}</p>
                        </div>
                      )}
                    </div>
                    <StatusDropdown sale={sale} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: REPORTS ──────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border">
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setReportPeriod(p)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${reportPeriod === p ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}>
                  {p}
                </button>
              ))}
            </div>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
              <Printer size={16} /> Print Report
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Period: <span className="font-semibold text-foreground">
              {format(report.start, 'dd MMM yyyy')} – {format(report.end, 'dd MMM yyyy')}
            </span> — <span className="font-semibold text-foreground">{report.inRange.length}</span> entries
          </p>

          {/* Report Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-emerald-500/20 rounded-2xl p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{report.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">AED collected from clients</p>
            </div>
            <div className="bg-card border border-rose-500/20 rounded-2xl p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gov. Fees Paid</p>
              <p className="text-3xl font-bold text-rose-400 mt-1">{report.totalGovFee.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">AED paid to government</p>
            </div>
            <div className="bg-card border border-blue-500/20 rounded-2xl p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net Profit</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{report.totalProfit.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">AED OSBIC profit</p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Status Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(STATUS_CONFIG) as WalkinStatus[]).map(s => {
                const cfg = STATUS_CONFIG[s];
                const count = report.countByStatus[s] || 0;
                return (
                  <div key={s} className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.color}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div>
                      <p className="text-xs font-semibold">{cfg.label}</p>
                      <p className="text-xl font-bold">{count}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Type Breakdown */}
          {Object.keys(report.byWorkType).length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Work Type Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Work Type</th>
                      <th className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Count</th>
                      <th className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Revenue (AED)</th>
                      <th className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">Profit (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(report.byWorkType).sort(([,a],[,b]) => b.revenue - a.revenue).map(([wt, data]) => (
                      <tr key={wt} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-sm font-semibold text-foreground">{wt}</td>
                        <td className="px-5 py-3 text-sm text-foreground">{data.count}</td>
                        <td className="px-5 py-3 text-sm font-bold text-foreground">{data.revenue.toFixed(2)}</td>
                        <td className="px-5 py-3 text-sm font-bold text-emerald-400">{data.profit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.inRange.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed border-border rounded-2xl">
              <BarChart3 size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No data for this period</p>
            </div>
          )}
        </div>
      )}

      {/* ── Sale Form Modal ───────────────────────────────────────────────────── */}
      <SaleFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditSale(null); }}
        editSale={editSale}
      />

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={18} className="text-destructive" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Delete Sale Entry</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-all">
                  Cancel
                </button>
                <button onClick={() => { deleteSale.mutate(deleteId); setDeleteId(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-bold hover:bg-destructive/90 active:scale-95 transition-all">
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalkinSales;
