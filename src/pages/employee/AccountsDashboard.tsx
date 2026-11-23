import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { Wallet, CheckCircle2, AlertCircle, RefreshCw, FileText, Lock, Building2, ExternalLink, Activity, DollarSign, Users, ChevronRight, BarChart4, LayoutDashboard, History, X, Download, Eye, CreditCard, Phone, Calendar, Globe, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useExpenses } from '../../hooks/employee/useExpenses';
import { useAccountsOverview } from '../../hooks/employee/useAccountsOverview';
import { useNavigate } from 'react-router-dom';
import { downloadInvoice, downloadReceipt } from '../../utils/invoiceGenerator';
import { getPaymentReceivedDate, formatPaymentReceivedDate } from '../../utils/paymentUtils';
import AccountsNavHeader from '../../components/employee/accounts/AccountsNavHeader';

interface AccountsDashboardProps {
  hideHeader?: boolean;
}

export default function AccountsDashboard({ hideHeader = false }: AccountsDashboardProps = {}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isAuthorized = Boolean(
    profile?.can_do_accounts ||
    profile?.department === 'hr' ||
    profile?.is_manager ||
    profile?.role === 'admin'
  );

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <Lock className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-syne font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view the Accounts Portal.</p>
      </div>
    );
  }

  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'branches' | 'sales_report' | 'receivables' | 'govt_fees' | 'financials' | 'expenses' | 'history'>('overview');

  // Payment Proof Modal State
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Verify Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<any | null>(null);

  // Job Details Modal State
  const [jobDetailsModalOpen, setJobDetailsModalOpen] = useState(false);
  const [jobDetailsTarget, setJobDetailsTarget] = useState<any | null>(null);

  // Receivables Sub-tab State
  const [receivablesSubTab, setReceivablesSubTab] = useState<'due' | 'surplus'>('due');

  const { pendingExpenses, loadingPending, updateExpenseStatus } = useExpenses();
  const { data: accountsData, isLoading: loadingOverview } = useAccountsOverview(selectedBranchId);
  const { data: allBranchesData } = useAccountsOverview(null);

  // Fetch pending payments (scoped by selected branch or full list if all)
  const { data: pendingPayments, isLoading: loadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ['pending_payments', selectedBranchId || 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_payments')
        .select(`
          *,
          job:jobs(job_code, branch_id, branch:branches(id, name, code), work_fee, ministry_fee, client_pays_ministry_fee, advance_receipt_url, remaining_receipt_url, sales_employee:profiles!sales_employee_id(full_name), ops_employee:profiles!ops_employee_id(full_name), client:profiles!client_id(full_name, company_name, phone)),
          recorder:profiles!job_payments_recorded_by_fkey(full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = data || [];
      if (!selectedBranchId) return list;
      return list.filter((p: any) => p.job?.branch_id === selectedBranchId);
    }
  });

  // Fetch verified/history payments
  const { data: historyPayments, isLoading: loadingHistory } = useQuery({
    queryKey: ['history_payments', selectedBranchId || 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_payments')
        .select(`
          *,
          job:jobs(job_code, branch_id, branch:branches(id, name, code), client:profiles!client_id(full_name, phone)),
          recorder:profiles!job_payments_recorded_by_fkey(full_name),
          verifier:profiles!job_payments_verified_by_fkey(full_name)
        `)
        .in('status', ['verified', 'rejected'])
        .order('verified_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const list = data || [];
      if (!selectedBranchId) return list;
      return list.filter((p: any) => p.job?.branch_id === selectedBranchId);
    }
  });

  // Fetch All Jobs for Financial Reports & Statements (scoped to selected branch if any)
  const { data: allJobsReport = [] } = useQuery({
    queryKey: ['all_jobs_report', selectedBranchId || 'all'],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          branch:branches(id, name, code),
          client:profiles!client_id(full_name, company_name, phone),
          sales_employee:profiles!sales_employee_id(full_name),
          ops_employee:profiles!ops_employee_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    }
  });

  // Fetch Unfiltered Jobs across all branches for branch-wise matrix calculation
  const { data: allJobsReportAll = [] } = useQuery({
    queryKey: ['all_jobs_report_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          branch:branches(id, name, code),
          client:profiles!client_id(full_name, company_name, phone),
          sales_employee:profiles!sales_employee_id(full_name),
          ops_employee:profiles!ops_employee_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    }
  });

  // Branch-Wise Comparative Analytics Breakdown
  const branchBreakdown = useMemo(() => {
    const jobs = allJobsReportAll.length > 0 ? allJobsReportAll : (allBranchesData || []);
    
    const results = branches.filter(b => b.is_active).map(b => {
      const bJobs = jobs.filter((j: any) => j.branch_id === b.id);
      const totalBilled = bJobs.reduce((sum: number, j: any) => sum + (Number(j.total_fee) || 0), 0);
      const totalCollected = bJobs.reduce((sum: number, j: any) => sum + (Number(j.advance_amount) || 0), 0);
      const totalSpent = bJobs.reduce((sum: number, j: any) => sum + (Number(j.total_spent) || 0), 0);
      const totalOutstanding = bJobs.reduce((sum: number, j: any) => sum + Math.max(0, (Number(j.remaining_amount) || 0)), 0);
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
      const netMargin = Math.max(0, totalBilled - totalSpent);

      const pendingCount = (pendingPayments || []).filter((p: any) => p.job?.branch_id === b.id).length;

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        phone: b.phone,
        address: b.address,
        jobCount: bJobs.length,
        totalBilled,
        totalCollected,
        totalSpent,
        totalOutstanding,
        collectionRate,
        netMargin,
        pendingCount
      };
    });

    // Check for unassigned / online branch jobs
    const unassignedJobs = jobs.filter((j: any) => !j.branch_id);
    if (unassignedJobs.length > 0) {
      const totalBilled = unassignedJobs.reduce((sum: number, j: any) => sum + (Number(j.total_fee) || 0), 0);
      const totalCollected = unassignedJobs.reduce((sum: number, j: any) => sum + (Number(j.advance_amount) || 0), 0);
      const totalSpent = unassignedJobs.reduce((sum: number, j: any) => sum + (Number(j.total_spent) || 0), 0);
      const totalOutstanding = unassignedJobs.reduce((sum: number, j: any) => sum + Math.max(0, (Number(j.remaining_amount) || 0)), 0);
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

      results.push({
        id: 'unassigned',
        name: 'Direct / Online / Unassigned',
        code: 'ONL',
        phone: null,
        address: null,
        jobCount: unassignedJobs.length,
        totalBilled,
        totalCollected,
        totalSpent,
        totalOutstanding,
        collectionRate,
        netMargin: Math.max(0, totalBilled - totalSpent),
        pendingCount: (pendingPayments || []).filter((p: any) => !p.job?.branch_id).length
      });
    }

    return results;
  }, [allJobsReportAll, allBranchesData, branches, pendingPayments]);

  const grandTotalBilled = branchBreakdown.reduce((s, b) => s + b.totalBilled, 0);
  const grandTotalCollected = branchBreakdown.reduce((s, b) => s + b.totalCollected, 0);
  const grandTotalSpent = branchBreakdown.reduce((s, b) => s + b.totalSpent, 0);
  const grandTotalDue = branchBreakdown.reduce((s, b) => s + b.totalOutstanding, 0);
  const grandTotalJobs = branchBreakdown.reduce((s, b) => s + b.jobCount, 0);
  const grandCollectionRate = grandTotalBilled > 0 ? (grandTotalCollected / grandTotalBilled) * 100 : 0;

  const handleViewPaymentProof = async (payment: any) => {
    let targetPath = payment?.proof_url;

    if (!targetPath && payment?.notes) {
      const match = payment.notes.match(/\[RECEIPT:(.*?)\|/);
      if (match && match[1]) {
        targetPath = match[1];
      }
    }

    if (!targetPath && payment?.job) {
      targetPath = payment.job.advance_receipt_url || payment.job.remaining_receipt_url;
    }

    if (!targetPath) {
      toast.error('No payment proof image found for this payment record.');
      return;
    }

    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      setProofUrl(targetPath);
      setProofModalOpen(true);
      return;
    }

    try {
      setProofLoading(true);
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(targetPath, 3600);
      if (error || !data?.signedUrl) {
        toast.error('Could not load signed proof URL');
        return;
      }
      setProofUrl(data.signedUrl);
      setProofModalOpen(true);
    } catch (err) {
      console.error('Error fetching proof image:', err);
      toast.error('Failed to load proof screenshot');
    } finally {
      setProofLoading(false);
    }
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['accounts_overview'] });
    qc.invalidateQueries({ queryKey: ['job'] });
    qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
    qc.invalidateQueries({ queryKey: ['history_payments'] });
    qc.invalidateQueries({ queryKey: ['pending_payments'] });
    qc.invalidateQueries({ queryKey: ['all_jobs_report'] });
    qc.invalidateQueries({ queryKey: ['all_jobs_report_all'] });
    refetchPayments();
  };

  const openVerifyModal = (payment: any) => {
    setVerifyTarget(payment);
    setVerifyModalOpen(true);
  };

  const submitVerify = async () => {
    if (!verifyTarget || !profile?.id) return;
    try {
      // 1. Update payment status to verified
      const { error: verifyErr } = await supabase
        .from('job_payments')
        .update({
          status: 'verified',
          verified_by: profile.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', verifyTarget.id);

      if (verifyErr) throw verifyErr;

      // 2. Fetch job details
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, total_fee, work_fee, ministry_fee, advance_paid_at, remaining_paid_at')
        .eq('id', verifyTarget.job_id)
        .single();

      if (jobData) {
        // Fetch all verified payments
        const { data: verifiedList } = await supabase
          .from('job_payments')
          .select('amount')
          .eq('job_id', verifyTarget.job_id)
          .eq('status', 'verified');

        // Fetch additional charges
        const { data: chargesList } = await supabase
          .from('job_additional_charges')
          .select('amount')
          .eq('job_id', verifyTarget.job_id);

        const totalPaid = (verifiedList || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const totalAdditional = (chargesList || []).reduce((sum, c) => sum + Number(c.amount), 0);
        const totalBilled = Number(jobData.total_fee) || (Number(jobData.work_fee) + Number(jobData.ministry_fee) + totalAdditional);
        const remaining = Math.max(0, totalBilled - totalPaid);

        const isAdvancePaid = totalPaid >= (totalBilled * 0.5);
        const isRemainingPaid = totalPaid >= totalBilled;

        await supabase.from('jobs').update({
          advance_paid: isAdvancePaid,
          advance_paid_at: isAdvancePaid ? (jobData.advance_paid_at || new Date().toISOString()) : null,
          remaining_paid: isRemainingPaid,
          remaining_paid_at: isRemainingPaid ? (jobData.remaining_paid_at || new Date().toISOString()) : null,
          advance_amount: totalPaid,
          remaining_amount: remaining
        }).eq('id', verifyTarget.job_id);

        // Update the linked invoice status based on remaining payment status
        const invoiceStatus = isRemainingPaid ? 'paid' : 'unpaid';
        await supabase
          .from('invoices')
          .update({
            status: invoiceStatus,
            paid_date: isRemainingPaid ? new Date().toISOString() : null
          })
          .eq('job_id', verifyTarget.job_id);
      }

      toast.success('Payment verified successfully.');
      setVerifyModalOpen(false);
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    }
  };

  const openRejectModal = (paymentId: string) => {
    setRejectTargetId(paymentId);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTargetId || !profile?.id) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      const { data: paymentData } = await supabase
        .from('job_payments')
        .select('job_id')
        .eq('id', rejectTargetId)
        .single();

      const { error } = await supabase
        .from('job_payments')
        .update({
          status: 'rejected',
          verified_by: profile.id,
          verified_at: new Date().toISOString(),
          notes: `[REJECTED]: ${rejectReason}`
        })
        .eq('id', rejectTargetId);

      if (error) throw error;

      // Recalculate job totals
      if (paymentData?.job_id) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('id, total_fee, work_fee, ministry_fee, advance_paid_at, remaining_paid_at')
          .eq('id', paymentData.job_id)
          .single();

        if (jobData) {
          const { data: verifiedList } = await supabase
            .from('job_payments')
            .select('amount')
            .eq('job_id', paymentData.job_id)
            .eq('status', 'verified');

          const { data: chargesList } = await supabase
            .from('job_additional_charges')
            .select('amount')
            .eq('job_id', paymentData.job_id);

          const totalPaid = (verifiedList || []).reduce((sum, p) => sum + Number(p.amount), 0);
          const totalAdditional = (chargesList || []).reduce((sum, c) => sum + Number(c.amount), 0);
          const totalBilled = Number(jobData.total_fee) || (Number(jobData.work_fee) + Number(jobData.ministry_fee) + totalAdditional);
          const remaining = Math.max(0, totalBilled - totalPaid);

          const isAdvancePaid = totalPaid >= (totalBilled * 0.5);
          const isRemainingPaid = totalPaid >= totalBilled;

          await supabase.from('jobs').update({
            advance_paid: isAdvancePaid,
            advance_paid_at: isAdvancePaid ? jobData.advance_paid_at : null,
            remaining_paid: isRemainingPaid,
            remaining_paid_at: isRemainingPaid ? jobData.remaining_paid_at : null,
            advance_amount: totalPaid,
            remaining_amount: remaining
          }).eq('id', paymentData.job_id);

          // Update the linked invoice status based on remaining payment status
          const invoiceStatus = isRemainingPaid ? 'paid' : 'unpaid';
          await supabase
            .from('invoices')
            .update({
              status: invoiceStatus,
              paid_date: isRemainingPaid ? new Date().toISOString() : null
            })
            .eq('job_id', paymentData.job_id);
        }
      }

      toast.success('Payment rejected.');
      setRejectModalOpen(false);
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    }
  };

  const handleViewReceipt = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast.error('Could not open document.');
    }
  };

  // KPI Calculations
  const totalBilled = accountsData?.reduce((sum, job) => sum + (job.total_fee || 0), 0) || 0;
  const totalVerified = accountsData?.reduce((sum, job) => sum + (job.advance_amount || 0), 0) || 0;
  const totalSpent = accountsData?.reduce((sum, job) => sum + (job.total_spent || 0), 0) || 0;
  const totalOutstanding = accountsData?.reduce((sum, job) => sum + Math.max(0, job.remaining_amount || 0), 0) || 0;

  return (
    <div className={hideHeader ? "space-y-8" : "p-6 md:p-10 max-w-[1600px] mx-auto space-y-8"}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-syne font-bold text-foreground flex items-center gap-3">
              <BarChart4 className="w-8 h-8 text-primary" /> Accounts Portal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Master Financial Ledger & Verification Center</p>
          </div>
        </div>
      )}

      {/* Navigation Suite */}
      <AccountsNavHeader activePage="overview" selectedBranchId={selectedBranchId} onBranchChange={setSelectedBranchId} />

      {/* Scope / Branch Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border/80 p-4 rounded-3xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground pr-2">
            <Building2 size={15} className="text-primary" />
            <span>Branch Scope:</span>
          </div>
          <button
            onClick={() => setSelectedBranchId(null)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              !selectedBranchId
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-black'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Globe size={13} />
            <span>All Branches (Consolidated)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${!selectedBranchId ? 'bg-black/25 text-white' : 'bg-muted text-muted-foreground'}`}>
              {allBranchesData?.length || 0}
            </span>
          </button>

          {branches.filter(b => b.is_active).map(b => {
            const count = (allBranchesData || []).filter(j => j.branch_id === b.id).length;
            const isSel = selectedBranchId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSel
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-black'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-mono font-bold ${isSel ? 'bg-black/25 text-white' : 'bg-primary/15 text-primary'}`}>
                  {b.code.slice(0, 2)}
                </span>
                <span>{b.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isSel ? 'bg-black/25 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {selectedBranch ? (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-2xl font-bold">
            <span>Viewing: <strong>{selectedBranch.name}</strong></span>
            <button
              onClick={() => setSelectedBranchId(null)}
              className="p-1 hover:bg-primary/20 rounded-lg text-primary transition-colors"
              title="Clear branch filter (Show all branches)"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-2xl font-bold">
            <CheckCircle2 size={13} />
            <span>Consolidated Sultanate Accounts (All Branches)</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <DollarSign size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Billed</span>
          </div>
          <div>
            <div className="text-3xl font-mono font-black text-foreground">
              {totalBilled.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedBranch ? `Revenue in ${selectedBranch.name}` : 'Consolidated sales revenue'}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Verified Paid</span>
          </div>
          <div>
            <div className="text-3xl font-mono font-black text-emerald-500">
              {totalVerified.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedBranch ? `Collections in ${selectedBranch.name}` : 'Total collected & verified'}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Activity size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ops Expenses</span>
          </div>
          <div>
            <div className="text-3xl font-mono font-black text-rose-500">
              {totalSpent.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedBranch ? `Spending in ${selectedBranch.name}` : 'Total operational spending'}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Outstanding</span>
          </div>
          <div>
            <div className="text-3xl font-mono font-black text-amber-500">
              {totalOutstanding.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedBranch ? `Due in ${selectedBranch.name}` : 'Total amount due'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-1 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'overview'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <LayoutDashboard size={16} /> Master Ledger
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'branches'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <Building2 size={16} /> Branch Breakdown
            <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
              {branches.filter(b => b.is_active).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'payments'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <RefreshCw size={16} /> Verifications
            {pendingPayments && pendingPayments.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingPayments.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sales_report')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'sales_report'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <Users size={16} /> Sales Performance
          </button>
          <button
            onClick={() => setActiveTab('receivables')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'receivables'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <Wallet size={16} /> Receivables Aging
          </button>
          <button
            onClick={() => setActiveTab('govt_fees')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'govt_fees'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <Building2 size={16} /> Govt Fees Paid
          </button>
          <button
            onClick={() => setActiveTab('financials')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'financials'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <BarChart4 size={16} /> Financial Statements
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'expenses'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <FileText size={16} /> Audits
            {pendingExpenses && pendingExpenses.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingExpenses.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
          >
            <History size={16} /> Verified History
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client & Team</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Billed</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Verified Paid</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Ops Spent</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Balance Due</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loadingOverview ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading ledger data...
                        </td>
                      </tr>
                    ) : accountsData?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                          No jobs found in the ledger.
                        </td>
                      </tr>
                    ) : (
                      accountsData?.map((job) => (
                        <tr key={job.id} className="hover:bg-muted/10 transition-colors group cursor-pointer" onClick={() => { setJobDetailsTarget(job); setJobDetailsModalOpen(true); }}>
                          <td className="px-6 py-4">
                            <div className="font-syne font-bold text-foreground flex items-center gap-2">
                              {job.job_code}
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{format(new Date(job.created_at), 'MMM d, yyyy')}</span>
                              {job.branch?.name && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                                  {job.branch.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              {job.client?.full_name || 'Unknown'}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex flex-col gap-0.5">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Sales: {job.sales?.full_name || 'None'}</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Ops: {job.ops?.full_name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-mono text-sm font-bold text-foreground">{(job.total_fee || 0).toFixed(3)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-mono text-sm font-bold text-emerald-500">{(job.advance_amount || 0).toFixed(3)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-mono text-sm font-bold text-rose-500">{(job.total_spent || 0) > 0 ? (job.total_spent || 0).toFixed(3) : '-'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-mono text-sm font-bold ${(job.remaining_amount || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {(job.remaining_amount || 0).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              job.status === 'draft' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              }`}>
                              {job.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BRANCH BREAKDOWN TAB */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* Branch Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {branchBreakdown.map((b) => (
                  <div
                    key={b.id}
                    className="p-6 rounded-3xl bg-card border border-border hover:border-primary/40 transition-all shadow-sm space-y-4 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-2">
                            {b.name}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase">
                              {b.code}
                            </span>
                          </h4>
                          <p className="text-xs text-muted-foreground">{b.city || 'Oman'} Branch</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {b.jobCount} deals
                      </span>
                    </div>

                    {/* Financial Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Invoiced</span>
                        <span className="text-sm font-mono font-black text-foreground">{b.totalBilled.toFixed(3)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Collected</span>
                        <span className="text-sm font-mono font-black text-emerald-400">{b.totalCollected.toFixed(3)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Ops Spent</span>
                        <span className="text-sm font-mono font-black text-rose-400">{b.totalSpent.toFixed(3)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Balance Due</span>
                        <span className="text-sm font-mono font-black text-amber-400">{b.totalOutstanding.toFixed(3)}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Collection Efficiency</span>
                        <span className="text-primary font-mono">{b.collectionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, b.collectionRate))}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="pt-2 flex items-center justify-between border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Net: <strong className="text-foreground font-bold">OMR {b.netMargin.toFixed(3)}</strong>
                      </span>
                      <button
                        onClick={() => {
                          setSelectedBranchId(b.id === 'unassigned' ? null : b.id);
                          setActiveTab('overview');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        Focus Ledger <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sultanate Comparison Matrix Table */}
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-syne font-bold text-foreground text-base">Sultanate Branch Performance Matrix</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Cross-branch financial ledger aggregation and recovery tracking</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBranchId(null);
                      setActiveTab('overview');
                    }}
                    className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
                  >
                    <Globe size={14} /> View Consolidated Ledger
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <th className="px-6 py-4">Branch</th>
                        <th className="px-6 py-4 text-center">Deals</th>
                        <th className="px-6 py-4 text-right">Invoiced (OMR)</th>
                        <th className="px-6 py-4 text-right">Cash In (OMR)</th>
                        <th className="px-6 py-4 text-right">Ops Expenses</th>
                        <th className="px-6 py-4 text-right">Net Margin</th>
                        <th className="px-6 py-4 text-right">Due Balance</th>
                        <th className="px-6 py-4 text-center">Recovery %</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {branchBreakdown.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 font-bold text-foreground flex items-center gap-2.5">
                            <Building2 size={16} className="text-primary shrink-0" />
                            <div>
                              <span>{b.name}</span>
                              <span className="block text-[10px] text-muted-foreground font-mono">{b.code}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-bold text-foreground">{b.jobCount}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-foreground">{b.totalBilled.toFixed(3)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">{b.totalCollected.toFixed(3)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-rose-400">{b.totalSpent.toFixed(3)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-primary">{b.netMargin.toFixed(3)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-amber-400">{b.totalOutstanding.toFixed(3)}</td>
                          <td className="px-6 py-4 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              b.collectionRate >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                              b.collectionRate >= 50 ? 'bg-amber-500/10 text-amber-400' :
                              'bg-rose-500/10 text-rose-400'
                            }`}>
                              {b.collectionRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedBranchId(b.id === 'unassigned' ? null : b.id);
                                setActiveTab('overview');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition-all"
                            >
                              Filter
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 border-border font-bold text-foreground">
                        <td className="px-6 py-4 flex items-center gap-2 text-primary font-syne">
                          <Globe size={16} /> Sultanate Total
                        </td>
                        <td className="px-6 py-4 text-center font-mono">{grandTotalJobs}</td>
                        <td className="px-6 py-4 text-right font-mono text-foreground">{grandTotalBilled.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400">{grandTotalCollected.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right font-mono text-rose-400">{grandTotalSpent.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right font-mono text-primary">{(grandTotalBilled - grandTotalSpent).toFixed(3)}</td>
                        <td className="px-6 py-4 text-right font-mono text-amber-400">{grandTotalDue.toFixed(3)}</td>
                        <td className="px-6 py-4 text-center font-mono text-primary">
                          <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-black">
                            {grandCollectionRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-muted-foreground">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {loadingPayments ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              ) : pendingPayments?.length === 0 ? (
                <div className="bg-card/50 border border-border/50 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-80" />
                  <h3 className="text-xl font-bold text-foreground">All Caught Up!</h3>
                  <p className="text-muted-foreground mt-2">No pending payments waiting for verification.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingPayments?.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="bg-card border border-amber-500/30 shadow-lg shadow-amber-500/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-amber-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-syne font-bold text-lg">{payment.job?.job_code}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest">
                              {payment.payment_method}
                            </span>
                            {payment.job?.branch?.name && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                <Building2 size={10} /> {payment.job.branch.name}
                              </span>
                            )}
                            {payment.job?.client_pays_ministry_fee && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest flex items-center gap-1">
                                <CreditCard size={9} /> Client Card — Service Charge Only
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Client: <span className="text-foreground font-semibold">{payment.job?.client?.full_name}</span>
                          </p>

                          {/* Date Amount Received Highlight */}
                          {(() => {
                            const { date, isExplicit } = getPaymentReceivedDate(payment);
                            let formattedDate = 'N/A';
                            try {
                              formattedDate = format(new Date(date), 'MMM d, yyyy');
                            } catch {
                              formattedDate = String(date);
                            }
                            return (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs shadow-sm">
                                  <Calendar size={13} className="text-emerald-400 shrink-0" />
                                  <span>Date Received: <strong className="text-white underline decoration-emerald-500/50">{formattedDate}</strong></span>
                                  {!isExplicit && (
                                    <span className="text-[9px] text-emerald-400/70 font-normal ml-0.5">(System Recorded)</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  • Recorded by: <span className="text-foreground font-medium">{payment.recorder?.full_name || 'Staff'}</span> on {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                                </span>
                              </div>
                            );
                          })()}

                          {payment.reference_number && (
                            <p className="text-xs font-mono mt-1.5 text-primary">Ref: {payment.reference_number}</p>
                          )}
                          <button
                            onClick={() => handleViewPaymentProof(payment)}
                            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg w-fit transition-colors"
                          >
                            <Eye size={14} /> View Payment Proof Screenshot
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-3 shrink-0">
                        <div className="text-3xl font-mono font-black text-amber-500">
                          {payment.amount.toFixed(3)} <span className="text-lg opacity-50">OMR</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button
                            onClick={() => openRejectModal(payment.id)}
                            className="flex-1 md:flex-none px-4 py-2 border border-rose-500/30 text-rose-500 rounded-xl text-sm font-bold hover:bg-rose-500/10 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openVerifyModal(payment)}
                            className="flex-1 md:flex-none px-6 py-2 bg-emerald-500 text-emerald-950 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Verify Payment
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {loadingPending ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              ) : pendingExpenses?.length === 0 ? (
                <div className="bg-card/50 border border-border/50 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-80" />
                  <h3 className="text-xl font-bold text-foreground">All Audited!</h3>
                  <p className="text-muted-foreground mt-2">No pending expenses waiting for approval.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingExpenses?.map((expense: any) => (
                    <div
                      key={expense.id}
                      className="bg-card border border-emerald-500/30 shadow-lg shadow-emerald-500/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-syne font-bold text-lg">{expense.job?.job_code}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest">
                              {expense.service?.service_name}
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-widest">
                              {expense.expense_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Logged by: <span className="text-foreground">{expense.creator?.full_name}</span> on {format(new Date(expense.created_at), 'MMM d, h:mm a')}
                          </p>
                          {expense.notes && (
                            <p className="text-xs mt-2 text-foreground/80 bg-foreground/5 p-3 rounded-xl italic border-l-2 border-primary">"{expense.notes}"</p>
                          )}
                          {expense.receipt_url && (
                            <button
                              onClick={() => handleViewReceipt(expense.receipt_url)}
                              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg w-fit transition-colors"
                            >
                              <ExternalLink size={14} /> View Attached Receipt
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-3 shrink-0">
                        <div className="text-3xl font-mono font-black text-emerald-500">
                          {expense.amount.toFixed(3)} <span className="text-lg opacity-50">OMR</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button
                            onClick={() => {
                              if (window.confirm('Reject this expense?')) {
                                updateExpenseStatus.mutate({ id: expense.id, status: 'rejected' });
                                invalidateAll();
                              }
                            }}
                            className="flex-1 md:flex-none px-4 py-2 border border-rose-500/30 text-rose-500 rounded-xl text-sm font-bold hover:bg-rose-500/10 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              updateExpenseStatus.mutate({ id: expense.id, status: 'approved' });
                              invalidateAll();
                            }}
                            className="flex-1 md:flex-none px-6 py-2 bg-emerald-500 text-emerald-950 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve Expense
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              ) : historyPayments?.length === 0 ? (
                <div className="bg-card/50 border border-border/50 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                  <History className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-foreground">No History</h3>
                  <p className="text-muted-foreground mt-2">Verified and rejected payments will appear here.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {historyPayments?.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="bg-card border border-border shadow-sm rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${payment.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {payment.status === 'verified' ? <CheckCircle2 className="w-6 h-6" /> : <X className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-syne font-bold text-lg">{payment.job?.job_code}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${payment.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {payment.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Client: <span className="text-foreground font-semibold">{payment.job?.client?.full_name}</span>
                          </p>
                          {(() => {
                            const { date } = getPaymentReceivedDate(payment);
                            let formattedDate = 'N/A';
                            try {
                              formattedDate = format(new Date(date), 'MMM d, yyyy');
                            } catch {
                              formattedDate = String(date);
                            }
                            return (
                              <div className="flex flex-wrap items-center gap-2 my-1">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
                                  <Calendar size={12} className="text-emerald-400 shrink-0" />
                                  <span>Received: {formattedDate}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  • Verified by: {payment.verifier?.full_name || 'Accounts'} on {payment.verified_at ? format(new Date(payment.verified_at), 'MMM d, h:mm a') : 'Unknown'}
                                </span>
                              </div>
                            );
                          })()}
                          {payment.recorder?.full_name && (
                            <p className="text-[11px] text-muted-foreground">
                              Recorded by: {payment.recorder.full_name} on {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                            </p>
                          )}
                          {payment.notes && payment.notes.includes('[REJECTED]') && (
                            <p className="text-xs mt-2 text-rose-400 bg-rose-500/10 p-2 rounded-lg italic border-l-2 border-rose-500">
                              {payment.notes.replace('[REJECTED]: ', 'Reason: ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-3 shrink-0">
                        <div className={`text-3xl font-mono font-black ${payment.status === 'verified' ? 'text-emerald-500' : 'text-muted-foreground line-through'}`}>
                          {payment.amount.toFixed(3)} <span className="text-lg opacity-50">OMR</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SALES PERFORMANCE REPORT TAB */}
          {activeTab === 'sales_report' && (() => {
            const salesSummary = allJobsReport.reduce((acc: any, job: any) => {
              const sId = job.sales_employee_id || 'unassigned';
              const sName = job.sales_employee?.full_name || 'Unassigned / Direct Client';
              if (!acc[sId]) {
                acc[sId] = {
                  name: sName,
                  totalDeals: 0,
                  totalBilled: 0,
                  totalCollected: 0,
                  totalOutstanding: 0,
                };
              }
              acc[sId].totalDeals += 1;
              acc[sId].totalBilled += (job.total_fee || 0);
              acc[sId].totalCollected += (job.advance_amount || 0);
              acc[sId].totalOutstanding += (job.remaining_amount || 0);
              return acc;
            }, {});

            const salesList = Object.values(salesSummary);

            return (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl">
                  <div>
                    <h3 className="font-syne font-bold text-xl text-foreground">Sales Representatives Performance</h3>
                    <p className="text-sm text-muted-foreground mt-1">Individual breakdown of deals closed, total revenue invoiced, cash collected, and outstanding balances.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {salesList.map((sales: any, idx: number) => (
                    <div key={idx} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                            <Users size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground">{sales.name}</h4>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{sales.totalDeals} Total Deals</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-background border border-border p-2.5 rounded-xl">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Invoiced Revenue</span>
                          <span className="font-mono font-bold text-foreground text-sm">{sales.totalBilled.toFixed(3)} OMR</span>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl">
                          <span className="text-[10px] text-emerald-600 uppercase font-bold block">Cash Collected</span>
                          <span className="font-mono font-bold text-emerald-500 text-sm">{sales.totalCollected.toFixed(3)} OMR</span>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl">
                          <span className="text-[10px] text-amber-600 uppercase font-bold block">Outstanding</span>
                          <span className="font-mono font-bold text-amber-500 text-sm">{sales.totalOutstanding.toFixed(3)} OMR</span>
                        </div>
                        <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl">
                          <span className="text-[10px] text-primary uppercase font-bold block">Est. Comm (5%)</span>
                          <span className="font-mono font-bold text-primary text-sm">{(sales.totalCollected * 0.05).toFixed(3)} OMR</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}          {/* RECEIVABLES AGING & CLIENT SURPLUS TAB */}
          {activeTab === 'receivables' && (() => {
            const receivablesJobs = allJobsReport.filter((j: any) => (j.remaining_amount || 0) > 0);
            const totalReceivable = receivablesJobs.reduce((sum: number, j: any) => sum + (j.remaining_amount || 0), 0);

            const surplusJobs = allJobsReport.filter((j: any) => {
              const paid = Number(j.advance_amount || 0);
              const totalBilled = Number(j.total_fee || 0);
              return paid > totalBilled && totalBilled > 0;
            });
            const totalSurplus = surplusJobs.reduce((sum: number, j: any) => sum + (Number(j.advance_amount || 0) - Number(j.total_fee || 0)), 0);

            return (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl">
                  <div>
                    <h3 className="font-syne font-bold text-xl text-foreground">Customer Balances & Surplus Reconciliation</h3>
                    <p className="text-sm text-muted-foreground mt-1">Monitor outstanding client receivables or surplus customer refunds from ministry fee savings.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 px-5 py-3 rounded-2xl shrink-0">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">Receivables Due</span>
                      <span className="font-mono font-black text-xl text-amber-500">{totalReceivable.toFixed(3)} OMR</span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-2xl shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Client Surplus / Refunds</span>
                      <span className="font-mono font-black text-xl text-emerald-400">{totalSurplus.toFixed(3)} OMR</span>
                    </div>
                  </div>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-2xl border border-border w-fit">
                  <button
                    onClick={() => setReceivablesSubTab('due')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${receivablesSubTab === 'due'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Outstanding Balances Due ({receivablesJobs.length})
                  </button>
                  <button
                    onClick={() => setReceivablesSubTab('surplus')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${receivablesSubTab === 'surplus'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Client Surplus & Refunds Due ({surplusJobs.length})
                  </button>
                </div>

                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    {receivablesSubTab === 'due' ? (
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client & Contact</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sales Rep</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total Fee</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Paid</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Balance Due</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {receivablesJobs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                No outstanding customer payments! All receivables are fully collected.
                              </td>
                            </tr>
                          ) : (
                            receivablesJobs.map((job: any) => {
                              const phoneClean = job.client?.phone?.replace(/[^0-9]/g, '') || '';
                              const waMsg = encodeURIComponent(`Dear ${job.client?.full_name || 'Client'},\nThis is a payment reminder from OSBIC Accounts regarding Job ${job.job_code}. Outstanding balance: ${job.remaining_amount.toFixed(3)} OMR.\nPlease contact us to finalize payment.\nThank you!`);
                              const waUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${waMsg}` : null;

                              return (
                                <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-foreground text-sm">{job.client?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{job.client?.company_name || 'Individual'}</div>
                                    {job.client?.phone && <div className="text-xs font-mono text-primary mt-1 flex items-center gap-1"><Phone size={12} /> {job.client?.phone}</div>}
                                  </td>
                                  <td className="px-6 py-4 font-mono font-bold text-sm text-foreground">{job.job_code}</td>
                                  <td className="px-6 py-4 text-xs font-bold text-muted-foreground">{job.sales_employee?.full_name || 'Unassigned'}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-bold text-foreground">{(job.total_fee || 0).toFixed(3)}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-bold text-emerald-500">{(job.advance_amount || 0).toFixed(3)}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-bold text-amber-500">{(job.remaining_amount || 0).toFixed(3)}</td>
                                  <td className="px-6 py-4 text-center">
                                    {waUrl ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                                      >
                                        <Phone size={13} /> Send Reminder
                                      </a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">No phone</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client & Contact</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sales Rep</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Billed Cost</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Customer Deposited</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Surplus Refund Due</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {surplusJobs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                No customer surplus or refunds due. All accounts balanced.
                              </td>
                            </tr>
                          ) : (
                            surplusJobs.map((job: any) => {
                              const surplusAmount = Number(job.advance_amount || 0) - Number(job.total_fee || 0);
                              const phoneClean = job.client?.phone?.replace(/[^0-9]/g, '') || '';
                              const waMsg = encodeURIComponent(`Dear ${job.client?.full_name || 'Client'},\nGreetings from OSBIC Accounts regarding Job ${job.job_code}.\nYour account has a surplus balance of ${surplusAmount.toFixed(3)} OMR from lower government fee expenses.\nPlease share your bank IBAN for refund transfer or confirm crediting to your account.\nThank you!`);
                              const waUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${waMsg}` : null;

                              return (
                                <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-foreground text-sm">{job.client?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{job.client?.company_name || 'Individual'}</div>
                                    {job.client?.phone && <div className="text-xs font-mono text-primary mt-1 flex items-center gap-1"><Phone size={12} /> {job.client?.phone}</div>}
                                  </td>
                                  <td className="px-6 py-4 font-mono font-bold text-sm text-foreground">{job.job_code}</td>
                                  <td className="px-6 py-4 text-xs font-bold text-muted-foreground">{job.sales_employee?.full_name || 'Unassigned'}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-bold text-foreground">{(job.total_fee || 0).toFixed(3)}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-bold text-blue-400">{(job.advance_amount || 0).toFixed(3)}</td>
                                  <td className="px-6 py-4 text-right font-mono text-sm font-extrabold text-emerald-400">
                                    +{surplusAmount.toFixed(3)} OMR
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    {waUrl ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                                      >
                                        <Phone size={13} /> Notify Refund via WA
                                      </a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">No phone</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* GOVT FEES PAID TAB */}
          {activeTab === 'govt_fees' && (() => {
            const govtJobs = allJobsReport.filter((j: any) => (j.ministry_fee || 0) > 0);
            const totalGovtPaid = govtJobs.reduce((sum: number, j: any) => sum + (j.ministry_fee || 0), 0);

            return (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl">
                  <div>
                    <h3 className="font-syne font-bold text-xl text-foreground">Government & Ministry Fees Paid</h3>
                    <p className="text-sm text-muted-foreground mt-1">Audit log of official government fees paid per service, matching customer, PRO operational staff, and sales representative.</p>
                  </div>
                  <div className="bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl shrink-0">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Total Govt Fees Paid</span>
                    <span className="font-mono font-black text-2xl text-primary">{totalGovtPaid.toFixed(3)} OMR</span>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job & Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client Name</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Operations / PRO Staff</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sales Staff</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Govt Fee (OMR)</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Payment Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {govtJobs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                              No government fee records logged yet.
                            </td>
                          </tr>
                        ) : (
                          govtJobs.map((job: any) => (
                            <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-mono font-bold text-foreground text-sm">{job.job_code}</div>
                                <div className="text-[10px] text-muted-foreground">{format(new Date(job.created_at), 'MMM d, yyyy')}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-foreground text-sm">{job.client?.full_name || 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground">{job.client?.company_name || 'Individual'}</div>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-foreground">
                                {job.ops_employee?.full_name || 'Operations Team'}
                              </td>
                              <td className="px-6 py-4 text-xs text-muted-foreground font-bold">
                                {job.sales_employee?.full_name || 'Unassigned'}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-sm font-bold text-rose-500">
                                {(job.ministry_fee || 0).toFixed(3)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${job.client_pays_ministry_fee ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  }`}>
                                  {job.client_pays_ministry_fee ? 'Client Card Direct' : 'OSBIC Govt Treasury'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FINANCIAL STATEMENTS SUITE TAB */}
          {activeTab === 'financials' && (() => {
            const totalInvoiced = allJobsReport.reduce((sum: number, j: any) => sum + (j.total_fee || 0), 0);
            const totalCollected = allJobsReport.reduce((sum: number, j: any) => sum + (j.advance_amount || 0), 0);
            const totalGovtPaid = allJobsReport.reduce((sum: number, j: any) => sum + (j.ministry_fee || 0), 0);
            const totalOpsSpent = allJobsReport.reduce((sum: number, j: any) => sum + (j.total_spent || 0), 0);
            const totalReceivables = allJobsReport.reduce((sum: number, j: any) => sum + (j.remaining_amount || 0), 0);

            const netOperatingProfit = totalCollected - totalGovtPaid - totalOpsSpent;

            return (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl">
                  <div>
                    <h3 className="font-syne font-bold text-xl text-foreground">Executive Financial Statements Suite</h3>
                    <p className="text-sm text-muted-foreground mt-1">Real-time Profit & Loss Statement, Balance Sheet Summary, and Cash Flow Audits.</p>
                  </div>
                </div>

                {/* P&L Statement Card */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                  <h4 className="font-syne font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
                    <BarChart4 className="text-primary" size={20} /> Profit & Loss Statement (P&L)
                  </h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="font-bold text-foreground">Gross Cash Revenue (Verified Collections)</span>
                      <span className="font-mono font-bold text-emerald-500">{totalCollected.toFixed(3)} OMR</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground pl-4">Less: Government & Ministry Fees Paid</span>
                      <span className="font-mono font-bold text-rose-500">-{totalGovtPaid.toFixed(3)} OMR</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground pl-4">Less: Approved Operational Expenses</span>
                      <span className="font-mono font-bold text-rose-500">-{totalOpsSpent.toFixed(3)} OMR</span>
                    </div>
                    <div className="flex justify-between items-center py-4 bg-primary/10 px-4 rounded-2xl font-bold text-lg mt-4">
                      <span className="text-primary font-syne">Net Operating Profit</span>
                      <span className={`font-mono font-black ${netOperatingProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {netOperatingProfit.toFixed(3)} OMR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet & Cash Flow Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                    <h4 className="font-syne font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
                      <Wallet className="text-emerald-500" size={20} /> Balance Sheet Summary
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Current Cash Assets (Vault & Bank)</span>
                        <span className="font-mono font-bold text-emerald-500">{totalCollected.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Accounts Receivable (Outstanding Payments)</span>
                        <span className="font-mono font-bold text-amber-500">{totalReceivables.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between py-3 font-bold bg-muted/30 px-3 rounded-xl">
                        <span className="text-foreground">Total Assets</span>
                        <span className="font-mono text-primary">{(totalCollected + totalReceivables).toFixed(3)} OMR</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                    <h4 className="font-syne font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
                      <Activity className="text-blue-500" size={20} /> Cash Flow Audit
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Operating Cash Inflow</span>
                        <span className="font-mono font-bold text-emerald-500">+{totalCollected.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Operating Cash Outflow (Govt + Ops)</span>
                        <span className="font-mono font-bold text-rose-500">-{(totalGovtPaid + totalOpsSpent).toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between py-3 font-bold bg-muted/30 px-3 rounded-xl">
                        <span className="text-foreground">Net Cash Flow</span>
                        <span className={`font-mono ${(totalCollected - totalGovtPaid - totalOpsSpent) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {(totalCollected - totalGovtPaid - totalOpsSpent).toFixed(3)} OMR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      </AnimatePresence>

      {/* Verify Modal */}
      <AnimatePresence>
        {verifyModalOpen && verifyTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVerifyModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-syne font-bold text-foreground">Confirm Verification</h2>
                  <p className="text-sm text-muted-foreground">Please double-check the details below.</p>
                </div>
              </div>

              <div className="space-y-4 bg-background/50 border border-border p-4 rounded-xl mb-6">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount</span>
                  <span className="font-mono text-sm font-bold text-emerald-500">{verifyTarget.amount.toFixed(3)} OMR</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Job Code</span>
                  <span className="font-syne font-bold text-sm text-foreground">{verifyTarget.job?.job_code}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Client</span>
                  <span className="font-syne font-bold text-sm text-foreground">{verifyTarget.job?.client?.full_name}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Method</span>
                  <span className="text-sm text-foreground capitalize">{verifyTarget.payment_method?.replace('_', ' ')}</span>
                </div>
                {verifyTarget.reference_number && (
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Ref No.</span>
                    <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded">{verifyTarget.reference_number}</span>
                  </div>
                )}
              </div>

              {/* Context for client-pays-ministry-fee jobs */}
              {verifyTarget.job?.client_pays_ministry_fee && (
                <div className="flex items-start gap-3 bg-blue-500/8 border border-blue-500/30 rounded-xl px-4 py-3 mb-6">
                  <CreditCard size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-300 mb-1">Client Pays Ministry Fee via Card</p>
                    <p className="text-xs text-blue-300/70">
                      Only verify the <strong className="text-blue-200">Service Charge: {Number(verifyTarget.job?.work_fee || 0).toFixed(3)} OMR</strong>.
                      The Ministry Fee ({Number(verifyTarget.job?.ministry_fee || 0).toFixed(3)} OMR) is paid directly by the client — no verification needed.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setVerifyModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-border text-foreground rounded-xl text-sm font-bold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitVerify}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-emerald-950 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Confirm & Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-syne font-bold text-foreground">Reject Payment</h2>
                  <p className="text-sm text-muted-foreground">Provide a reason for the Sales team.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Rejection Reason</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g., Transfer screenshot is blurry, amounts do not match..."
                    className="w-full h-32 px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setRejectModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-border text-foreground rounded-xl text-sm font-bold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReject}
                    className="flex-1 px-4 py-3 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={16} /> Confirm Rejection
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Job Details Modal */}
      <AnimatePresence>
        {jobDetailsModalOpen && jobDetailsTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setJobDetailsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-syne font-bold text-foreground">{jobDetailsTarget.job_code}</h2>
                    <p className="text-sm text-muted-foreground">{jobDetailsTarget.client?.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => downloadInvoice(jobDetailsTarget, 'view')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" /> View Invoice
                  </button>
                  <button
                    onClick={() => downloadInvoice(jobDetailsTarget, 'download')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" /> Full Invoice
                  </button>
                  <button
                    onClick={() => setJobDetailsModalOpen(false)}
                    className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                {/* Job & Client Details */}
                <div className="bg-background border border-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Client Name</p>
                    <p className="text-sm font-bold text-foreground">{jobDetailsTarget.client?.full_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company Name</p>
                    <p className="text-sm font-bold text-foreground">{jobDetailsTarget.client?.company_name || 'Individual'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Handled By (Sales)</p>
                    <p className="text-sm font-bold text-foreground">{jobDetailsTarget.sales?.full_name || 'Unassigned'}</p>
                  </div>
                </div>

                {/* Job Financial Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background border border-border rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Fee</p>
                    <p className="text-xl font-mono font-bold text-foreground">{(jobDetailsTarget.total_fee || 0).toFixed(3)}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Paid</p>
                    <p className="text-xl font-mono font-bold text-emerald-500">{(jobDetailsTarget.advance_amount || 0).toFixed(3)}</p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Balance Due</p>
                    <p className="text-xl font-mono font-bold text-amber-500">{(jobDetailsTarget.remaining_amount || 0).toFixed(3)}</p>
                  </div>
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Ops Spent</p>
                    <p className="text-xl font-mono font-bold text-rose-500">{(jobDetailsTarget.total_spent || 0).toFixed(3)}</p>
                  </div>
                </div>

                {/* Payment History Table */}
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Payment History
                  </h3>

                  {jobDetailsTarget.payments?.length === 0 ? (
                    <div className="bg-background border border-border border-dashed rounded-2xl p-8 text-center">
                      <p className="text-muted-foreground">No payments recorded yet.</p>
                    </div>
                  ) : (
                    <div className="bg-background border border-border rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date Received</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Amount</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Method</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ref #</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Status</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {jobDetailsTarget.payments?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((payment: any, idx: number) => {
                            const { date } = getPaymentReceivedDate(payment);
                            let formattedDate = 'N/A';
                            try {
                              formattedDate = format(new Date(date), 'MMM d, yyyy');
                            } catch {
                              formattedDate = String(date);
                            }
                            return (
                              <tr key={idx} className="hover:bg-muted/10">
                                <td className="px-4 py-3 text-sm text-foreground">
                                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                                    <Calendar size={12} className="shrink-0" />
                                    {formattedDate}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Rec: {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-foreground">
                                  {Number(payment.amount).toFixed(3)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="capitalize text-sm">{payment.payment_method?.replace('_', ' ') || 'Unknown'}</span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                  {payment.reference_number || '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${payment.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' :
                                    payment.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                      'bg-rose-500/10 text-rose-500'
                                    }`}>
                                    {payment.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {payment.status === 'verified' && (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); downloadReceipt(jobDetailsTarget, payment, 'view'); }}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="View Receipt"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); downloadReceipt(jobDetailsTarget, payment, 'download'); }}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="Download Receipt"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Proof Screenshot Modal */}
      <AnimatePresence>
        {proofModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProofModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
                <h3 className="font-syne font-bold text-lg text-foreground flex items-center gap-2">
                  <Eye className="text-primary" size={20} /> Payment Proof Screenshot / Receipt
                </h3>
                <button onClick={() => setProofModalOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center overflow-auto min-h-[300px] p-4 bg-background/50 rounded-2xl border border-border/50">
                {proofLoading ? (
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                ) : proofUrl ? (
                  <img src={proofUrl} alt="Payment Proof" className="max-w-full max-h-[60vh] object-contain rounded-xl border border-border shadow-md" />
                ) : (
                  <p className="text-muted-foreground text-sm">No payment proof uploaded or found for this transaction.</p>
                )}
              </div>

              {proofUrl && (
                <div className="pt-4 border-t border-border flex justify-end gap-3 mt-4">
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                  >
                    <ExternalLink size={14} /> Open Full Size / Download
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
