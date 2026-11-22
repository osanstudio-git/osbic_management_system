import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Download, Phone, MessageSquare, 
  DollarSign, Clock, AlertTriangle, CheckCircle2, RefreshCw, 
  X, ExternalLink, CreditCard, Banknote, Landmark, Loader2 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useBranch } from '../../../contexts/BranchContext';
import { AccountsNavHeader } from '../../../components/employee/accounts/AccountsNavHeader';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function ClientReceivables() {
  const { profile } = useAuth();
  const { branches } = useBranch();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [agingFilter, setAgingFilter] = useState<'all' | 'current' | 'due' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect Payment Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'pos'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  // Fetch Jobs with Unpaid Balances
  const { data: rawJobs = [], isLoading, refetch } = useQuery({
    queryKey: ['accounts_client_receivables', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('jobs')
        .select(`
          id, job_code, created_at, started_at, total_fee, work_fee, ministry_fee,
          client_pays_ministry_fee, advance_amount, remaining_amount, remaining_paid,
          status, branch_id,
          branch:branches!branch_id(name),
          client:profiles!client_id(id, full_name, company_name, phone, client_code),
          service:services!service_id(name_en, name_ar),
          sales_rep:profiles!sales_employee_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (selectedBranchId) {
        q = q.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await q;
      if (error) {
        console.warn('Could not fetch receivables:', error);
        return [];
      }
      return data || [];
    }
  });

  // Calculate Receivables & Aging Days
  const receivables = useMemo(() => {
    const now = new Date();

    return rawJobs
      .map((job: any) => {
        const clientPaysMin = job.client_pays_ministry_fee === true;
        const totalBilled = Number(job.total_fee) || (Number(job.work_fee || 0) + (clientPaysMin ? 0 : Number(job.ministry_fee || 0)));
        const totalPaid = Number(job.advance_amount || 0);
        const dueAmount = job.remaining_paid ? 0 : Math.max(0, totalBilled - totalPaid);

        let ageDays = 0;
        try {
          const startDate = job.started_at || job.created_at;
          if (startDate) ageDays = Math.max(0, differenceInDays(now, parseISO(startDate)));
        } catch { /* ignore */ }

        let agingCategory: 'current' | 'due' | 'critical' = 'current';
        if (ageDays > 30) agingCategory = 'critical';
        else if (ageDays > 15) agingCategory = 'due';

        return {
          ...job,
          totalBilled,
          totalPaid,
          dueAmount,
          ageDays,
          agingCategory
        };
      })
      .filter((job: any) => job.dueAmount > 0.001); // Only active debts
  }, [rawJobs]);

  // Filtered List
  const filteredReceivables = useMemo(() => {
    return receivables.filter((job: any) => {
      if (agingFilter !== 'all' && job.agingCategory !== agingFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (job.client?.full_name || '').toLowerCase();
        const clientComp = (job.client?.company_name || '').toLowerCase();
        const code = (job.job_code || '').toLowerCase();
        const phone = (job.client?.phone || '').toLowerCase();
        if (!clientName.includes(q) && !clientComp.includes(q) && !code.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [receivables, agingFilter, searchQuery]);

  // KPI Rollup
  const kpis = useMemo(() => {
    const totalDue = receivables.reduce((sum, j) => sum + j.dueAmount, 0);
    const criticalDue = receivables.filter(j => j.agingCategory === 'critical').reduce((sum, j) => sum + j.dueAmount, 0);
    const clientCount = new Set(receivables.map(j => j.client?.id).filter(Boolean)).size;

    return { totalDue, criticalDue, clientCount, totalJobsWithDue: receivables.length };
  }, [receivables]);

  // WhatsApp Reminder Generator
  const openWhatsAppReminder = (job: any) => {
    const phone = job.client?.phone?.replace(/[^0-9]/g, '');
    if (!phone) {
      toast.error('Client has no phone number on record');
      return;
    }
    const cleanPhone = phone.startsWith('00') ? phone.slice(2) : (phone.length === 8 ? '968' + phone : phone);
    const clientName = job.client?.full_name || job.client?.company_name || 'Valued Client';
    const message = encodeURIComponent(
      `Dear ${clientName},\n\nGreetings from OSBIC Financial Operations.\n\nThis is a gentle payment reminder regarding Job Ref: *${job.job_code}* (${job.service?.name_en || 'Service'}).\n` +
      `• Total Contract: ${job.totalBilled.toFixed(3)} OMR\n` +
      `• Paid to Date: ${job.totalPaid.toFixed(3)} OMR\n` +
      `• Outstanding Balance Due: *${job.dueAmount.toFixed(3)} OMR*\n\n` +
      `Kindly arrange settlement at your earliest convenience to complete document release.\nThank you!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  // Instant Collect Payment Mutation
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJob || !paymentAmount) return;
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsRecording(true);
    try {
      // 1. Insert into job_payments
      const { data: payData, error: payError } = await supabase.from('job_payments').insert({
        job_id: targetJob.id,
        amount: amountNum,
        payment_method: paymentMethod,
        reference_number: paymentRef || null,
        status: 'verified',
        recorded_by: profile?.id,
        verified_by: profile?.id,
        verified_at: new Date().toISOString()
      }).select().single();

      if (payError) throw payError;

      // 2. Recalculate job remaining amount & remaining_paid
      const newTotalPaid = targetJob.totalPaid + amountNum;
      const newRemaining = Math.max(0, targetJob.totalBilled - newTotalPaid);
      const isFullySettled = newRemaining <= 0.001;

      await supabase.from('jobs').update({
        advance_paid: true,
        advance_amount: newTotalPaid,
        remaining_amount: newRemaining,
        remaining_paid: isFullySettled,
        remaining_paid_at: isFullySettled ? new Date().toISOString() : null
      }).eq('id', targetJob.id);

      toast.success(`Payment of ${amountNum.toFixed(3)} OMR recorded & reconciled!`);
      setCollectModalOpen(false);
      setTargetJob(null);
      setPaymentAmount('');
      setPaymentRef('');
      queryClient.invalidateQueries({ queryKey: ['accounts_client_receivables'] });
    } catch (err: any) {
      toast.error(err.message || 'Payment recording failed');
    } finally {
      setIsRecording(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Client Name', 'Company', 'Phone', 'Job Code', 'Service', 'Total Billed (OMR)', 'Paid (OMR)', 'Balance Due (OMR)', 'Aging Days', 'Category', 'Branch'];
    const rows = filteredReceivables.map((j: any) => [
      `"${(j.client?.full_name || 'Individual').replace(/"/g, '""')}"`,
      `"${(j.client?.company_name || '—').replace(/"/g, '""')}"`,
      `"${j.client?.phone || '—'}"`,
      j.job_code,
      `"${(j.service?.name_en || 'Service').replace(/"/g, '""')}"`,
      j.totalBilled.toFixed(3),
      j.totalPaid.toFixed(3),
      j.dueAmount.toFixed(3),
      j.ageDays,
      j.agingCategory.toUpperCase(),
      `"${j.branch?.name || 'All'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `OSBIC_Client_Receivables_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Shared Accounts Header */}
      <AccountsNavHeader
        title="Client Outstanding Receivables & Aging"
        description="Debt collection radar tracking clients with unpaid balances, overdue durations, automated WhatsApp payment reminders, and instant balance reconciliation."
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      >
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all border border-border flex items-center gap-1.5"
        >
          <Download size={14} />
          <span>Export Aging</span>
        </button>
      </AccountsNavHeader>

      {/* ─── Executive Receivables KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Due */}
        <div className="bg-card border border-rose-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-rose-500/[0.02]">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Outstanding Due</span>
            <DollarSign size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-rose-400">
            {kpis.totalDue.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Across {kpis.totalJobsWithDue} contracts</p>
        </div>

        {/* Critical Overdue (> 30 days) */}
        <div className="bg-card border border-amber-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-amber-500/[0.02]">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Critical Overdue (&gt; 30 Days)</span>
            <AlertTriangle size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-amber-400">
            {kpis.criticalDue.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Requires immediate follow-up</p>
        </div>

        {/* Clients with Debt */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Debtor Clients Count</span>
            <Users size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-mono font-black text-foreground">
            {kpis.clientCount} <span className="text-xs font-normal opacity-50">Clients</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Unique businesses & individuals</p>
        </div>

        {/* Healthy Collection Status */}
        <div className="bg-card border border-emerald-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Receivable Status</span>
            <CheckCircle2 size={18} />
          </div>
          <p className="text-2xl font-black text-foreground">
            Active Follow-up
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold pt-1">1-Click WhatsApp Chaser Ready</p>
        </div>
      </div>

      {/* ─── Filters & Search ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border/70 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Aging Buckets */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border text-xs">
            {[
              { id: 'all', label: 'All Due' },
              { id: 'current', label: 'Current (0–15d)' },
              { id: 'due', label: 'Due (16–30d)' },
              { id: 'critical', label: 'Critical (> 30d)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAgingFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  agingFilter === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client, phone, job code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* ─── Receivables Table ─── */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client & Contact</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Details</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Branch</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total Billed</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Deposited</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Outstanding Due</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Aging Days</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Auditing client receivables...
                  </td>
                </tr>
              ) : filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    ✓ All accounts settled! No outstanding client balances in this filter.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((job: any) => (
                  <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground text-sm">
                        {job.client?.full_name || 'Individual'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {job.client?.company_name || 'Private Client'}
                      </div>
                      {job.client?.phone && (
                        <div className="text-[10px] font-mono text-primary mt-0.5 flex items-center gap-1">
                          <Phone size={10} /> {job.client.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-primary text-xs">
                        {job.job_code}
                      </div>
                      <div className="font-medium text-foreground truncate max-w-[180px]">
                        {job.service?.name_en || 'Service Delivery'}
                      </div>
                      {job.sales_rep?.full_name && (
                        <div className="text-[10px] text-muted-foreground/70">
                          Sales: {job.sales_rep.full_name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {job.branch?.name || 'All'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                      {job.totalBilled.toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-blue-400 font-bold">
                      {job.totalPaid.toFixed(3)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-black text-rose-400 text-sm">
                      {job.dueAmount.toFixed(3)} OMR
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                        job.agingCategory === 'critical'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : job.agingCategory === 'due'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {job.ageDays} Days
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1-Click WhatsApp Chaser */}
                        <button
                          onClick={() => openWhatsAppReminder(job)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="Send payment reminder on WhatsApp"
                        >
                          <MessageSquare size={12} />
                          <span>Remind</span>
                        </button>

                        {/* 1-Click Collect Payment */}
                        <button
                          onClick={() => {
                            setTargetJob(job);
                            setPaymentAmount(job.dueAmount.toFixed(3));
                            setCollectModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] flex items-center gap-1 shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                          title="Record payment & settle balance"
                        >
                          <DollarSign size={12} />
                          <span>Collect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Collect Payment Modal ─── */}
      <AnimatePresence>
        {collectModalOpen && targetJob && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-base font-bold text-foreground">Record Client Settlement</h4>
                  <p className="text-xs text-muted-foreground font-mono">{targetJob.job_code} • {targetJob.client?.full_name}</p>
                </div>
                <button
                  onClick={() => setCollectModalOpen(false)}
                  className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                <div className="p-3 bg-muted/30 border border-border/60 rounded-2xl flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Outstanding Balance Due:</span>
                  <span className="font-mono font-black text-rose-400 text-sm">{targetJob.dueAmount.toFixed(3)} OMR</span>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Amount to Collect (OMR) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={targetJob.dueAmount}
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono font-bold text-sm focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="bank_transfer">Bank Transfer (Deposit / Wire)</option>
                    <option value="cash">Cash (Office Drawer)</option>
                    <option value="pos">Card / POS Machine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Transaction Ref / Cheque No</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="e.g. Bank Muscat Ref #10294"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setCollectModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-muted font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecording}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isRecording ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>{isRecording ? 'Reconciling...' : 'Confirm & Reconcile'}</span>
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
