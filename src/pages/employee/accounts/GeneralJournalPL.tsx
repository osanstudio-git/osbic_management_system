import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, Download, ArrowUpRight, ArrowDownRight, 
  FileText, DollarSign, Wallet, Building2, Calendar, Eye, 
  Paperclip, RefreshCw, X, Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useBranch } from '../../../contexts/BranchContext';
import { AccountsNavHeader } from '../../../components/employee/accounts/AccountsNavHeader';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import toast from 'react-hot-toast';

export default function GeneralJournalPL() {
  const { profile } = useAuth();
  const { branches } = useBranch();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [timePreset, setTimePreset] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'payment'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State for Manual Journal Voucher
  const [formData, setFormData] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    particular: '',
    entry_type: 'payment' as 'sales' | 'payment',
    amount: '',
    description: '',
    branch_id: profile?.branch_id || branches[0]?.id || '',
    category: 'office_supplies',
    receiptFile: null as File | null
  });
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch Manual Journal Entries
  const { data: manualEntries = [], isLoading: loadingManual, refetch: refetchManual } = useQuery({
    queryKey: ['general_journal_entries', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('general_journal_entries')
        .select(`
          *,
          branch:branches!branch_id(name),
          recorder:profiles!recorded_by(full_name)
        `)
        .order('entry_date', { ascending: false });

      if (selectedBranchId) {
        q = q.eq('branch_id', selectedBranchId);
      }
      const { data, error } = await q;
      if (error) {
        console.warn('Could not fetch general_journal_entries:', error);
        return [];
      }
      return data || [];
    }
  });

  // 2. Fetch Auto-Synced Job Payments (Sales Income)
  const { data: autoJobPayments = [] } = useQuery({
    queryKey: ['journal_auto_job_payments', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('job_payments')
        .select(`
          id, amount, payment_method, reference_number, notes, created_at, status,
          job:jobs!job_id(
            id, job_code, branch_id, branch:branches!branch_id(name),
            client:profiles!client_id(full_name, company_name),
            service:services!service_id(name_en)
          ),
          recorder:profiles!recorded_by(full_name)
        `)
        .eq('status', 'verified')
        .order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) return [];
      return (data || []).map((p: any) => ({
        id: `pay-${p.id}`,
        entry_date: p.created_at ? p.created_at.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
        particular: `Client Payment: ${p.job?.client?.full_name || p.job?.client?.company_name || 'Walk-in'}`,
        entry_type: 'sales' as const,
        amount: Number(p.amount) || 0,
        description: `Job ${p.job?.job_code || ''} (${p.job?.service?.name_en || 'Service'}) - Ref: ${p.reference_number || p.payment_method || 'Verified'}`,
        branch_id: p.job?.branch_id,
        branch: p.job?.branch,
        category: 'service_revenue',
        receipt_url: null,
        is_auto: true,
        source: 'Job Payment',
        recorder: p.recorder
      }));
    }
  });

  // 3. Fetch Auto-Synced Walk-In Sales
  const { data: autoWalkinSales = [] } = useQuery({
    queryKey: ['journal_auto_walkin_sales', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('walkin_sales')
        .select(`
          id, date, client_name, client_company, service_name, amount, payment_mode, branch_id,
          branch:branches!branch_id(name),
          staff:profiles!employee_id(full_name)
        `)
        .order('date', { ascending: false });

      if (selectedBranchId) {
        q = q.eq('branch_id', selectedBranchId);
      }
      const { data, error } = await q;
      if (error) return [];
      return (data || []).map((w: any) => ({
        id: `walkin-${w.id}`,
        entry_date: w.date || format(new Date(), 'yyyy-MM-dd'),
        particular: `Walk-in Sale: ${w.client_name || w.client_company || 'Walk-in'}`,
        entry_type: 'sales' as const,
        amount: Number(w.amount) || 0,
        description: `${w.service_name || 'Retail Typing'} (Payment: ${w.payment_mode || 'Cash'})`,
        branch_id: w.branch_id,
        branch: w.branch,
        category: 'walkin_service',
        receipt_url: null,
        is_auto: true,
        source: 'Walk-in Sales',
        recorder: w.staff
      }));
    }
  });

  // Combine and Filter Entries
  const combinedEntries = useMemo(() => {
    const list = [...manualEntries, ...autoJobPayments, ...autoWalkinSales];

    // Branch Filter
    let filtered = list;
    if (selectedBranchId) {
      filtered = filtered.filter(item => item.branch_id === selectedBranchId);
    }

    // Type Filter (Sales vs Payment)
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.entry_type === typeFilter);
    }

    // Category Filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Time Preset Filter
    const now = new Date();
    if (timePreset === 'today') {
      const todayStr = format(now, 'yyyy-MM-dd');
      filtered = filtered.filter(item => item.entry_date === todayStr);
    } else if (timePreset === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 6 });
      const end = endOfWeek(now, { weekStartsOn: 6 });
      filtered = filtered.filter(item => {
        try {
          return isWithinInterval(parseISO(item.entry_date), { start, end });
        } catch { return true; }
      });
    } else if (timePreset === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter(item => {
        try {
          return isWithinInterval(parseISO(item.entry_date), { start, end });
        } catch { return true; }
      });
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        (item.particular || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.branch?.name || '').toLowerCase().includes(q)
      );
    }

    // Sort Descending by Date
    return filtered.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [manualEntries, autoJobPayments, autoWalkinSales, selectedBranchId, typeFilter, categoryFilter, timePreset, searchQuery]);

  // Derived P&L KPIs
  const totalSales = useMemo(() => {
    return combinedEntries
      .filter(item => item.entry_type === 'sales')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [combinedEntries]);

  const totalPayments = useMemo(() => {
    return combinedEntries
      .filter(item => item.entry_type === 'payment')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [combinedEntries]);

  const netProfit = totalSales - totalPayments;
  const marginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Add Manual Journal Entry Mutation
  const addEntryMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      let receiptPath = null;

      if (formData.receiptFile) {
        const ext = formData.receiptFile.name.split('.').pop();
        const fName = `journal_${Date.now()}.${ext}`;
        const fPath = `journal_receipts/${fName}`;

        const { error: upErr } = await supabase.storage.from('documents').upload(fPath, formData.receiptFile, { upsert: true });
        if (upErr) throw upErr;
        receiptPath = fPath;
      }

      const { data, error } = await supabase.from('general_journal_entries').insert({
        entry_date: formData.entry_date,
        particular: formData.particular.trim(),
        entry_type: formData.entry_type,
        amount: parseFloat(formData.amount) || 0,
        description: formData.description.trim() || null,
        branch_id: formData.branch_id || null,
        category: formData.category,
        receipt_url: receiptPath,
        recorded_by: profile?.id
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Journal entry recorded successfully!');
      setIsAddOpen(false);
      setIsUploading(false);
      setFormData({
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        particular: '',
        entry_type: 'payment',
        amount: '',
        description: '',
        branch_id: profile?.branch_id || branches[0]?.id || '',
        category: 'office_supplies',
        receiptFile: null
      });
      queryClient.invalidateQueries({ queryKey: ['general_journal_entries'] });
    },
    onError: (err: any) => {
      setIsUploading(false);
      toast.error(err.message || 'Failed to save entry');
    }
  });

  const handleOpenReceipt = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      toast.error('Could not preview receipt: ' + e.message);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Particular', 'Type', 'Amount (OMR)', 'Category', 'Branch', 'Description', 'Recorded By'];
    const rows = combinedEntries.map(e => [
      e.entry_date,
      `"${e.particular.replace(/"/g, '""')}"`,
      e.entry_type.toUpperCase(),
      Number(e.amount).toFixed(3),
      e.category,
      `"${e.branch?.name || 'All'}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${e.recorder?.full_name || 'System'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Journal_PL_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Shared Accounts Header */}
      <AccountsNavHeader
        title="Journal & Real-Time Profit & Loss"
        description="Comprehensive chronological ledger of all sales revenues, ministry outflows, and operational expenses with live profit margin analytics."
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      >
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all border border-border flex items-center gap-1.5"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus size={15} />
          <span>Add Journal Voucher</span>
        </button>
      </AccountsNavHeader>

      {/* ─── P&L Executive Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales (Credit) */}
        <div className="bg-card border border-emerald-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Sales / Income (Credit)</span>
            <ArrowUpRight size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-emerald-400">
            {totalSales.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{combinedEntries.filter(e => e.entry_type === 'sales').length} Transactions</span>
            <span className="text-emerald-400 font-semibold">Inflow</span>
          </div>
        </div>

        {/* Total Payments (Debit) */}
        <div className="bg-card border border-rose-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-rose-500/[0.02]">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Payments / Outflows (Debit)</span>
            <ArrowDownRight size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-rose-400">
            {totalPayments.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{combinedEntries.filter(e => e.entry_type === 'payment').length} Outflows</span>
            <span className="text-rose-400 font-semibold">Expenses & Gov</span>
          </div>
        </div>

        {/* Net Profit & Loss */}
        <div className={`bg-card border rounded-3xl p-5 shadow-sm space-y-1 ${
          netProfit >= 0 ? 'border-primary/40 bg-primary/[0.02]' : 'border-rose-500/40 bg-rose-500/[0.05]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${netProfit >= 0 ? 'text-primary' : 'text-rose-400'}`}>
              Net Profit / Loss (P&L)
            </span>
            <DollarSign size={18} className={netProfit >= 0 ? 'text-primary' : 'text-rose-400'} />
          </div>
          <p className={`text-3xl font-mono font-black ${netProfit >= 0 ? 'text-primary' : 'text-rose-400'}`}>
            {netProfit.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Income minus Outflows</span>
            <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netProfit >= 0 ? '✓ Profitable' : '⚠ Loss'}
            </span>
          </div>
        </div>

        {/* Profit Margin % */}
        <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm space-y-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Operating Net Margin</span>
            <Wallet size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-3xl font-mono font-black text-foreground">
              {marginPercent.toFixed(1)} <span className="text-xs font-normal opacity-50">%</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Net margin on total gross revenue
            </p>
          </div>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border/70 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Presets */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border text-xs">
            {(['today', 'week', 'month', 'all'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => setTimePreset(preset)}
                className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                  timePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Flows (Sales & Payments)</option>
            <option value="sales">Sales / Income Only (Credit)</option>
            <option value="payment">Payments / Expenses Only (Debit)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="service_revenue">Client Service Revenue</option>
            <option value="walkin_service">Walk-in Retail Sales</option>
            <option value="gov_fees">Government & Ministry Fees</option>
            <option value="office_supplies">Office Supplies & Stationery</option>
            <option value="utilities">Utilities & Telecom</option>
            <option value="rent">Office Rent</option>
            <option value="salaries">Staff Salaries & Advances</option>
            <option value="marketing">Advertising & Marketing</option>
            <option value="other">Other Outflows</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search particular, desc, category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* ─── Journal Table ─── */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Particular (Account)</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Amount (OMR)</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Category</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Branch</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Description / Narration</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loadingManual ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading journal records...
                  </td>
                </tr>
              ) : combinedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    No journal entries matching the selected criteria.
                  </td>
                </tr>
              ) : (
                combinedEntries.map(entry => {
                  const isSales = entry.entry_type === 'sales';

                  return (
                    <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">
                        {entry.entry_date}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          {entry.particular}
                          {entry.is_auto && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Auto
                            </span>
                          )}
                        </div>
                        {entry.recorder?.full_name && (
                          <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                            By: {entry.recorder.full_name}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                          isSales
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {isSales ? 'Credit (Sales)' : 'Debit (Payment)'}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-mono font-extrabold text-sm ${
                        isSales ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isSales ? '+' : '-'}{Number(entry.amount).toFixed(3)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-muted/40 border border-border text-[10px] font-bold text-foreground/80 capitalize">
                          {entry.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground/90">
                        {entry.branch?.name || 'All Branches'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate" title={entry.description}>
                        {entry.description || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {entry.receipt_url ? (
                          <button
                            onClick={() => handleOpenReceipt(entry.receipt_url)}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Eye size={12} /> View
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px] italic">No slip</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add Journal Voucher Modal ─── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-base">
                  <Plus size={18} className="text-primary" />
                  <span>Add Journal Voucher</span>
                </div>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={e => { e.preventDefault(); addEntryMutation.mutate(); }} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Entry Date *</label>
                    <input
                      type="date"
                      value={formData.entry_date}
                      onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Flow Type *</label>
                    <select
                      value={formData.entry_type}
                      onChange={e => setFormData({ ...formData, entry_type: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary font-bold"
                    >
                      <option value="payment">Payment / Outflow (Debit Expense)</option>
                      <option value="sales">Sales / Inflow (Credit Income)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Particular (Account Name) *</label>
                  <input
                    type="text"
                    value={formData.particular}
                    onChange={e => setFormData({ ...formData, particular: e.target.value })}
                    placeholder="e.g. Office Rent, Electricity, Tea & Supplies, Advertising"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Amount (OMR) *</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.000"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono font-bold focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Category *</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="office_supplies">Office Supplies & Stationery</option>
                      <option value="gov_fees">Government & Ministry Fees</option>
                      <option value="utilities">Utilities & Telecom</option>
                      <option value="rent">Office Rent</option>
                      <option value="salaries">Staff Salaries & Advances</option>
                      <option value="marketing">Advertising & Marketing</option>
                      <option value="maintenance">Office Maintenance</option>
                      <option value="service_revenue">Service Revenue</option>
                      <option value="other">Other Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Branch *</label>
                    <select
                      value={formData.branch_id}
                      onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Receipt / Voucher File</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setFormData({ ...formData, receiptFile: e.target.files?.[0] || null })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-foreground file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-primary/10 file:text-primary cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter narration or invoice / check number..."
                    className="w-full bg-background border border-border rounded-xl p-3 text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-muted font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>{isUploading ? 'Recording...' : 'Save Journal Entry'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
