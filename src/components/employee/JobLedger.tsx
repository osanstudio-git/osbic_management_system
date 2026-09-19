import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Receipt, DollarSign, CheckCircle2, AlertCircle, X, CreditCard, Banknote, Landmark, Upload, Paperclip, Download, Eye, Loader2, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { pdf } from '@react-pdf/renderer';
import { downloadReceipt } from '../../utils/invoiceGenerator';
import { AllocationModal } from './AllocationModal';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');



export const JobLedger = ({ job, onPaymentReceived }: { job: any, onPaymentReceived: () => void }) => {
  const { profile } = useAuth();
  const [additionalCharges, setAdditionalCharges] = useState<any[]>([]);
  const [subTasks, setSubTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<any[]>([]);
  const [allocatingPayment, setAllocatingPayment] = useState<any>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [newCharge, setNewCharge] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Derived Financial Metrics
  const clientPaysMinistryFee = job.client_pays_ministry_fee === true;
  const billedMinistryFee = clientPaysMinistryFee ? 0 : job.ministry_fee;
  const totalAdditional = additionalCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const totalSubTasks = subTasks.reduce((sum, st) => sum + Number(st.ministry_fee), 0);
  const totalBilled = job.work_fee + billedMinistryFee + totalAdditional + totalSubTasks;
  const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  const totalVerified = payments.filter(p => p.status === 'verified').reduce((sum, pay) => sum + Number(pay.amount), 0);
  const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const remainingBalance = totalBilled - totalPaid;

  const [paymentType, setPaymentType] = useState<'advance' | 'remaining' | 'custom'>('advance');
  const [showAllServices, setShowAllServices] = useState(false);

  // Auto-switch payment tab based on whether advance is paid
  useEffect(() => {
    if (job.advance_paid) {
      setPaymentType('remaining');
    } else {
      setPaymentType('advance');
    }
  }, [job.advance_paid]);

  // Pre-fill payment amount automatically
  useEffect(() => {
    if (paymentType === 'advance') {
      const advAmount = Number(job.advance_due_amount) || (totalBilled * (Number(job.advance_percentage || 50) / 100));
      setNewPayment(prev => ({ ...prev, amount: advAmount.toFixed(3) }));
    } else if (paymentType === 'remaining') {
      const remAmount = Math.max(0, totalBilled - totalPaid);
      setNewPayment(prev => ({ ...prev, amount: remAmount.toFixed(3) }));
    } else if (paymentType === 'custom') {
      setNewPayment(prev => ({ ...prev, amount: '' }));
    }
  }, [paymentType, job.advance_due_amount, job.advance_percentage, totalBilled, totalPaid]);

  const loadChargesAndPayments = async () => {
    setLoading(true);
    
    // Fetch Charges
    const { data: charges } = await supabase
      .from('job_additional_charges')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });
    if (charges) setAdditionalCharges(charges);

    // Fetch Sub-Task Fees
    const { data: stData } = await supabase
      .from('job_sub_tasks')
      .select('id, name, ministry_fee, job_steps!inner(job_id)')
      .eq('job_steps.job_id', job.id);
    if (stData) setSubTasks(stData.filter(st => st.ministry_fee && st.ministry_fee > 0));

    // Fetch Payments
    const { data: payData } = await supabase
      .from('job_payments')
      .select('*, profiles:recorded_by(full_name)')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });
    if (payData) setPayments(payData);

    // Fetch Payment Allocations
    const paymentIds = payData?.map(p => p.id) || [];
    if (paymentIds.length > 0) {
      const { data: allocs } = await supabase
        .from('payment_allocations')
        .select('*')
        .in('payment_id', paymentIds);
      if (allocs) setPaymentAllocations(allocs);
    } else {
      setPaymentAllocations([]);
    }

    // Fetch Expenses
    const { data: expData } = await supabase
      .from('job_expenses')
      .select('*')
      .eq('job_id', job.id)
      .eq('status', 'approved');
    if (expData) setExpenses(expData);

    // Fetch Job Services for Allocation
    const { data: jsData } = await supabase
      .from('job_services')
      .select('*')
      .eq('job_id', job.id)
      .order('display_order', { ascending: true });
    if (jsData) setJobServices(jsData);

    setLoading(false);
  };

  useEffect(() => {
    if (job?.id) loadChargesAndPayments();
  }, [job]);

  const handleAddCharge = async () => {
    if (!newCharge.description || !newCharge.amount) return;

    const { data } = await supabase.from('job_additional_charges').insert({
      job_id: job.id,
      description: newCharge.description,
      amount: parseFloat(newCharge.amount)
    } as any).select().single();

    if (data) {
      const updatedCharges = [...additionalCharges, data];
      setAdditionalCharges(updatedCharges);
      setNewCharge({ description: '', amount: '' });
      setIsAddingCharge(false);

      // Update job totals in DB
      const billedMinistryFee = clientPaysMinistryFee ? 0 : job.ministry_fee;
      const newTotalAdditional = updatedCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
      const totalSubTasks = subTasks.reduce((sum, st) => sum + Number(st.ministry_fee), 0);
      const newTotalBilled = job.work_fee + billedMinistryFee + newTotalAdditional + totalSubTasks;
      const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
      const newRemaining = Math.max(0, newTotalBilled - totalPaid);
      
      await supabase.from('jobs').update({
        total_fee: newTotalBilled,
        remaining_amount: newRemaining,
        remaining_paid: newRemaining <= 0
      }).eq('id', job.id);
      
      onPaymentReceived();
    }
  };

  const handleDeleteCharge = async (id: string) => {
    await supabase.from('job_additional_charges').delete().eq('id', id);
    const updatedCharges = additionalCharges.filter(c => c.id !== id);
    setAdditionalCharges(updatedCharges);

    // Update job totals in DB
    const billedMinistryFee = clientPaysMinistryFee ? 0 : job.ministry_fee;
    const newTotalAdditional = updatedCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
    const totalSubTasks = subTasks.reduce((sum, st) => sum + Number(st.ministry_fee), 0);
    const newTotalBilled = job.work_fee + billedMinistryFee + newTotalAdditional + totalSubTasks;
    const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const newRemaining = Math.max(0, newTotalBilled - totalPaid);
    
    await supabase.from('jobs').update({
      total_fee: newTotalBilled,
      remaining_amount: newRemaining,
      remaining_paid: newRemaining <= 0
    }).eq('id', job.id);
    
    onPaymentReceived();
  };

  const handleRecordPayment = async () => {
    if (!newPayment.amount) return;
    
    setIsUploading(true);
    let filePath = '';
    
    try {
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${job.id}/receipt_${Date.now()}.${fileExt}`;
        filePath = `documents/${fileName}`;
        
        const { error: storageError } = await supabase.storage.from('documents').upload(filePath, receiptFile);
        if (storageError) throw storageError;
        
        // Also add it to documents table so it shows up in job documents if needed
        await supabase.from('documents').insert({
          job_id: job.id,
          uploaded_by: profile?.id,
          file_name: receiptFile.name,
          file_path: filePath,
          file_size: receiptFile.size,
          file_type: receiptFile.type,
          document_type: 'payment_receipt',
          status: 'approved',
          is_client_visible: false,
          version: 1
        });
      }

      let finalNotes = newPayment.notes || null;
      if (filePath) {
        finalNotes = finalNotes ? `${finalNotes}\n[RECEIPT:${filePath}|${receiptFile?.name}]` : `[RECEIPT:${filePath}|${receiptFile?.name}]`;
      }

      const { data, error } = await supabase.from('job_payments').insert({
        job_id: job.id,
        amount: parseFloat(newPayment.amount),
        payment_method: newPayment.method,
        reference_number: newPayment.reference || null,
        notes: finalNotes,
        recorded_by: profile?.id
      } as any).select('*, profiles:recorded_by(full_name)').single();

      if (error) throw error;
      toast.success('Payment recorded successfully');
      setIsUploading(false);

    if (data) {
      const updatedPayments = [...payments, data];
      setPayments(updatedPayments);
      setNewPayment({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
      setReceiptFile(null);
      setIsAddingPayment(false);
      setAllocatingPayment(data); // Trigger allocation modal
      
      // Do not prematurely mark jobs table fields as paid. They will update automatically when verified.
      onPaymentReceived();
    }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to record payment');
      setIsUploading(false);
    }
  };

  const handleDownloadReceipt = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
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

  const handleConfirmPayment = async () => {
    await (supabase as any).from('jobs').update({ status: 'active' }).eq('id', job.id);
    onPaymentReceived();
  };

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      const { error: verifyErr } = await supabase
        .from('job_payments')
        .update({
          status: 'verified',
          verified_by: profile?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', paymentId);
      if (verifyErr) throw verifyErr;

      const { data: verifiedList } = await supabase
        .from('job_payments')
        .select('amount')
        .eq('job_id', job.id)
        .eq('status', 'verified');

      const totalPaid = (verifiedList || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const billedMinistryFee = clientPaysMinistryFee ? 0 : job.ministry_fee;
      const totalAdditional = additionalCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
      const totalSubTasks = subTasks.reduce((sum, st) => sum + Number(st.ministry_fee), 0);
      const totalBilled = job.work_fee + billedMinistryFee + totalAdditional + totalSubTasks;
      const remaining = Math.max(0, totalBilled - totalPaid);

      const isAdvancePaid = totalPaid >= (totalBilled * 0.5);
      const isRemainingPaid = totalPaid >= totalBilled;

      await supabase.from('jobs').update({
        advance_paid: isAdvancePaid,
        advance_paid_at: isAdvancePaid ? (job.advance_paid_at || new Date().toISOString()) : null,
        remaining_paid: isRemainingPaid,
        remaining_paid_at: isRemainingPaid ? (job.remaining_paid_at || new Date().toISOString()) : null,
        advance_amount: totalPaid,
        remaining_amount: remaining
      }).eq('id', job.id);

      toast.success('Payment verified successfully. Receipt is now active!');
      setPayments(payments.map(p => p.id === paymentId ? { ...p, status: 'verified', verified_by: profile?.id, verified_at: new Date().toISOString() } : p));
      onPaymentReceived();
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify payment');
    }
  };

  const handleGenerateReceipt = async (payment: any, action: 'download' | 'view' = 'download') => {
    try {
      // Create a unified job object that downloadReceipt expects
      const receiptJob = {
        ...job,
        services: jobServices,
        payments: payments,
        client: job.client || { full_name: job.client_name, company_name: '' }
      };
      
      downloadReceipt(receiptJob, payment, action);
    } catch (err) {
      toast.error('Failed to generate receipt');
    }
  };

  // Calculate Wallet Balance
  // We estimate allocated funds by seeing which services are funded. Since we don't have exact per-service ministry fee,
  // we'll just show the total ministry fee and total paid, and let the user decide.
  const isFundedHelper = (service: any) => {
    const currentMinistryAllocated = service.ministry_fee_allocated || 0;
    const reqMinistryFee = service.ministry_fee || 0;
    const isAutoUnlocked = reqMinistryFee > 0 && currentMinistryAllocated >= reqMinistryFee;
    return service.is_funded || isAutoUnlocked || Number(service.total_fee) === 0;
  };

  const fundedCount = jobServices.filter(isFundedHelper).length;
  const lockedCount = jobServices.filter(s => !isFundedHelper(s)).length;

  const handleToggleFund = async (serviceId: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('job_services')
        .update({ is_funded: !currentVal })
        .eq('id', serviceId);
      if (error) throw error;
      setJobServices(jobServices.map(s => s.id === serviceId ? { ...s, is_funded: !currentVal } : s));
      toast.success(!currentVal ? 'Service Unlocked!' : 'Service Locked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update allocation');
    }
  };

  const canDoSales = profile?.can_do_sales ?? false;
  const canDoOps = profile?.can_do_ops ?? false;
  const isManager = profile?.is_manager ?? false;
  const isAdmin = profile?.role === 'admin';
  const canDoAccounts = profile?.can_do_accounts ?? false;

  // Dynamically resolve mode based on actual current permissions rather than stale localStorage
  let isSalesMode = true;
  if (isAdmin || isManager || canDoAccounts) {
    isSalesMode = true;
  } else if (canDoSales && canDoOps) {
    const saved = localStorage.getItem('employee_mode');
    isSalesMode = saved !== 'ops';
  } else if (canDoSales) {
    isSalesMode = true;
    if (localStorage.getItem('employee_mode') === 'ops') {
      localStorage.setItem('employee_mode', 'sales');
    }
  } else if (canDoOps) {
    isSalesMode = false;
  } else {
    isSalesMode = true;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">

      {/* Draft State Alert */}
      {job.status === 'draft' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="font-syne font-bold text-amber-500 text-lg">Awaiting Payment Confirmation</h3>
              <p className="text-amber-500/70 text-sm">This job is in a Draft/Pre-requisite state. Confirm payment to unlock subsequent steps.</p>
            </div>
          </div>
          <button
            onClick={handleConfirmPayment}
            className="px-6 py-3 bg-amber-500 text-amber-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 transition-all text-sm uppercase tracking-widest flex items-center gap-2"
          >
            <CheckCircle2 size={18} /> Confirm Payment
          </button>
        </div>
      )}

      {/* Invoice Card */}
      <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8 border-b border-border pb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Receipt size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-syne font-bold text-foreground">Financial Ledger</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{job.job_code}</p>
          </div>
        </div>

        {/* Fixed Fees */}
        <div className="space-y-4 mb-8">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Base Fees</h4>
          <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
            <span className="text-sm font-bold text-foreground">Service Fee</span>
            <span className="font-mono text-sm">{job.work_fee.toFixed(3)} OMR</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
            <div>
              <span className="text-sm font-bold text-foreground block">Ministry Fee (Fixed)</span>
              {clientPaysMinistryFee && (
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mt-0.5 block">
                  💳 Paid Directly via Client Card
                </span>
              )}
            </div>
            <span className={cn(
              "font-mono text-sm",
              clientPaysMinistryFee ? "line-through text-muted-foreground" : "text-foreground"
            )}>
              {job.ministry_fee.toFixed(3)} OMR
            </span>
          </div>
        </div>

        {/* Additional Charges */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Additional Charges</h4>
            <button
              onClick={() => setIsAddingCharge(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus size={12} /> Add Charge
            </button>
          </div>

          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-4">Loading charges...</div>
          ) : additionalCharges.length === 0 && subTasks.length === 0 && !isAddingCharge ? (
            <div className="text-center border border-dashed border-border rounded-xl p-6 text-muted-foreground text-xs">
              No additional charges or sub-task fees added.
            </div>
          ) : (
            <div className="space-y-2">
              {additionalCharges.map(charge => (
                <div key={charge.id} className="flex items-center justify-between p-4 border border-border rounded-xl group hover:border-primary/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">{charge.description}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm">{Number(charge.amount).toFixed(3)} OMR</span>
                    <button
                      onClick={() => handleDeleteCharge(charge.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Render Sub-Task Auto Fees */}
              {subTasks.map(st => (
                <div key={st.id} className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{st.name}</h4>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-primary/80 mt-0.5">Sub-Task Fee</p>
                  </div>
                  <div className="flex items-center gap-4 pr-1">
                    <span className="font-mono text-sm text-primary">+{st.ministry_fee.toFixed(3)} OMR</span>
                  </div>
                </div>
              ))}

              {isAddingCharge && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 border border-primary/30 bg-primary/5 rounded-xl">
                  <input
                    type="text"
                    placeholder="Description (e.g. Resubmission Fee)"
                    value={newCharge.description}
                    onChange={e => setNewCharge({ ...newCharge, description: e.target.value })}
                    className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.000"
                      value={newCharge.amount}
                      onChange={e => setNewCharge({ ...newCharge, amount: e.target.value })}
                      className="w-24 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <button onClick={handleAddCharge} className="p-2 bg-primary text-primary-foreground rounded-lg hover:scale-105 transition-all">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => setIsAddingCharge(false)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ── SALES MODE PAYMENT RECORDING SECTION ── */}
        {isSalesMode && (
          <div className="mt-8 border-t border-border pt-8 space-y-6">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment Recording</h4>
            
            {remainingBalance <= 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h5 className="text-base font-syne font-bold text-emerald-400">Ledger Reconciled & Fully Paid</h5>
                  <p className="text-xs text-emerald-500/70 mt-1">This project has no remaining balance due. All milestones are fully funded.</p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex flex-col gap-1 border-b border-border/40 pb-4">
                  <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign size={16} className="text-primary" /> Record Client Payment
                  </h5>
                  <p className="text-xs text-muted-foreground font-medium">Select a payment option below to auto-fill or enter a custom amount</p>
                </div>

                {/* Modern Radio Cards (Option A) */}
                <div className={cn(
                  "grid grid-cols-1 gap-3 pt-2",
                  job.advance_paid ? "sm:grid-cols-2" : "sm:grid-cols-3"
                )}>
                  {/* Card 1: Advance Payment */}
                  {!job.advance_paid && (
                    <div
                      onClick={() => setPaymentType('advance')}
                      className={cn(
                        "relative rounded-2xl border p-4 cursor-pointer transition-all flex flex-col text-left gap-1 group overflow-hidden select-none",
                        paymentType === 'advance'
                          ? "bg-primary/10 border-primary shadow-md shadow-primary/5"
                          : "bg-muted/10 border-border hover:border-border/80 hover:bg-muted/20"
                      )}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest",
                          paymentType === 'advance' ? "text-primary" : "text-muted-foreground"
                        )}>
                          1. Advance Payment
                        </span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                          paymentType === 'advance' 
                            ? "border-primary bg-primary text-primary-foreground" 
                            : "border-border text-transparent group-hover:border-muted-foreground"
                        )}>
                          {paymentType === 'advance' && <CheckCircle2 size={10} className="stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-sm font-bold font-mono text-foreground mt-1">
                        {(Number(job.advance_due_amount) || (totalBilled * (Number(job.advance_percentage || 50) / 100))).toFixed(3)} OMR
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                        Initial setup deposit ({job.advance_percentage || 50}%)
                      </span>
                    </div>
                  )}

                  {/* Card 2: Remaining Balance */}
                  <div
                    onClick={() => setPaymentType('remaining')}
                    className={cn(
                      "relative rounded-2xl border p-4 cursor-pointer transition-all flex flex-col text-left gap-1 group overflow-hidden select-none",
                      paymentType === 'remaining'
                        ? "bg-primary/10 border-primary shadow-md shadow-primary/5"
                        : "bg-muted/10 border-border hover:border-border/80 hover:bg-muted/20"
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest",
                        paymentType === 'remaining' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {job.advance_paid ? "1. Remaining Balance" : "2. Full Payment"}
                      </span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                        paymentType === 'remaining' 
                          ? "border-primary bg-primary text-primary-foreground" 
                          : "border-border text-transparent group-hover:border-muted-foreground"
                      )}>
                        {paymentType === 'remaining' && <CheckCircle2 size={10} className="stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground mt-1">
                      {Math.max(0, totalBilled - totalPaid).toFixed(3)} OMR
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                      {job.advance_paid ? "Clear outstanding balance (100%)" : "Pay total amount in full (100%)"}
                    </span>
                  </div>

                  {/* Card 3: Custom / Partial */}
                  <div
                    onClick={() => setPaymentType('custom')}
                    className={cn(
                      "relative rounded-2xl border p-4 cursor-pointer transition-all flex flex-col text-left gap-1 group overflow-hidden select-none",
                      paymentType === 'custom'
                        ? "bg-primary/10 border-primary shadow-md shadow-primary/5"
                        : "bg-muted/10 border-border hover:border-border/80 hover:bg-muted/20"
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest",
                        paymentType === 'custom' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {job.advance_paid ? "2. Custom / Partial" : "3. Custom / Partial"}
                      </span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                        paymentType === 'custom' 
                          ? "border-primary bg-primary text-primary-foreground" 
                          : "border-border text-transparent group-hover:border-muted-foreground"
                      )}>
                        {paymentType === 'custom' && <CheckCircle2 size={10} className="stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground mt-1">
                      Custom Amount
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                      Enter any custom payment value
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Balance Due Reminder */}
                  <div className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-xl px-4 py-2.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding Balance</span>
                    <span className="text-sm font-bold font-mono text-amber-400">{remainingBalance.toFixed(3)} OMR</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-1.5">Amount (OMR)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={newPayment.amount}
                          disabled={paymentType !== 'custom'}
                          onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                          className={`w-full bg-card border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-75 disabled:bg-muted/10 font-mono font-bold text-foreground transition-colors ${
                            paymentType === 'custom' && Number(newPayment.amount) > remainingBalance
                              ? 'border-amber-400/70 focus:border-amber-400'
                              : paymentType === 'custom' && Number(newPayment.amount) > 0 && Math.abs(Number(newPayment.amount) - remainingBalance) < 0.001
                              ? 'border-emerald-400/70 focus:border-emerald-400'
                              : 'border-border'
                          }`}
                        />
                        {paymentType !== 'custom' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded uppercase tracking-wider">
                            Auto-locked
                          </span>
                        )}
                      </div>

                      {/* Real-time amount validation feedback */}
                      {paymentType === 'custom' && Number(newPayment.amount) > 0 && (() => {
                        const entered = Number(newPayment.amount);
                        const over = entered - remainingBalance;
                        const isOver = entered > remainingBalance;
                        const isExact = Math.abs(over) < 0.001;
                        if (isExact) return (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 size={11} /> Perfect — exactly settles the outstanding balance
                          </div>
                        );
                        if (isOver) return (
                          <div className="mt-1.5 p-2.5 bg-amber-400/10 border border-amber-400/30 rounded-xl space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
                              <AlertTriangle size={11} /> Overpayment Warning!
                            </div>
                            <p className="text-[10px] text-amber-400/80 leading-relaxed">
                              This is <span className="font-bold">{over.toFixed(3)} OMR more</span> than the outstanding balance of <span className="font-bold">{remainingBalance.toFixed(3)} OMR</span>. Double-check the amount before saving.
                            </p>
                          </div>
                        );
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            <TrendingUp size={11} /> {(remainingBalance - entered).toFixed(3)} OMR will still be outstanding after this
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-1.5">Payment Method</label>
                      <select
                        value={newPayment.method}
                        onChange={e => setNewPayment({ ...newPayment, method: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary text-foreground font-semibold"
                      >
                        <option value="bank_transfer">🏛️ Bank Transfer</option>
                        <option value="pos">💳 POS / Card</option>
                        <option value="cash">💵 Cash</option>
                        <option value="online">🌐 Online Payment</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {newPayment.method !== 'cash' && (
                      <div>
                        <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-1.5">Reference Number *</label>
                        <input
                          type="text"
                          placeholder="e.g. Transaction ID or Bank Ref"
                          value={newPayment.reference}
                          onChange={e => setNewPayment({ ...newPayment, reference: e.target.value })}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary text-foreground"
                        />
                      </div>
                    )}

                    <div className={cn(newPayment.method === 'cash' ? "sm:col-span-2" : "")}>
                      <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-1.5">Document Proof (Optional)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 flex items-center justify-center gap-2 border border-dashed border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all rounded-xl p-2.5 cursor-pointer group">
                          <Upload size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors truncate max-w-[200px]">
                            {receiptFile ? receiptFile.name : 'Upload Invoice or Receipt (PDF, Image)'}
                          </span>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*,.pdf"
                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        {receiptFile && (
                          <button 
                            onClick={() => setReceiptFile(null)}
                            className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-1.5">Internal Notes (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Add reference notes or ledger remarks here..."
                      value={newPayment.notes}
                      onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleRecordPayment}
                    className="w-full py-3 bg-primary text-[#0A0F1E] font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-[#0A0F1E]" /> Recording Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Record Payment
                      </>
                    )}
                  </button>
                </div>

                {/* FUND ALLOCATION / TRANCHE BLOCK */}
                {job?.client_pays_ministry_fee ? (
                  /* Client is paying ministry fee directly — no allocation needed */
                  <div className="mt-8 bg-blue-500/5 border border-blue-500/30 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2 mb-1">
                        Client Paying Ministry Fee Directly via Card
                      </h4>
                      <p className="text-xs text-blue-300/70">
                        No fund allocation is required for this job. The client is covering the Ministry Fee using their own card.
                        All services are immediately authorized for the Operations team.
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                          ✓ {jobServices.length} Services Unlocked
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                          Accounts Verifies Service Charge Only
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 bg-card border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Landmark size={16} className="text-primary" /> 
                          Service Allocation & Authorization
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Select which services Operations is allowed to work on based on funds received. 
                          <span className="font-bold text-foreground ml-1">Total Paid: {totalPaid.toFixed(3)} OMR</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/40 border border-border px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider select-none whitespace-nowrap">
                        <span className="text-emerald-500 font-extrabold">{fundedCount} Unlocked</span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-amber-500 font-extrabold">{lockedCount} Locked</span>
                      </div>
                    </div>

                    {jobServices.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground">No services found for this job.</div>
                    ) : (
                      <div className="space-y-3">
                        {(showAllServices ? jobServices : jobServices.slice(0, 3)).map((service, idx) => {
                          const currentMinistryAllocated = service.ministry_fee_allocated || 0;
                          const reqMinistryFee = service.ministry_fee || 0;
                          const isAutoUnlocked = reqMinistryFee > 0 && currentMinistryAllocated >= reqMinistryFee;
                          const isServiceFunded = service.is_funded || isAutoUnlocked || Number(service.total_fee) === 0 || job?.client_pays_ministry_fee;
                          const isFree = Number(service.total_fee) === 0;
                          
                          return (
                            <div key={service.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isServiceFunded ? 'bg-primary/5 border-primary/30' : 'bg-muted/10 border-border opacity-75'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isServiceFunded ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <h5 className={`text-sm font-bold ${isServiceFunded ? 'text-foreground' : 'text-muted-foreground line-through decoration-muted-foreground/30'}`}>
                                    {service.service_name}
                                  </h5>
                                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
                                    {isFree ? '⚡ Free Service (Auto-Unlocked)' : (isAutoUnlocked ? '⚡ Funded (Auto-Unlocked)' : (isServiceFunded ? '✅ Authorized for Ops' : '🔒 Locked (Awaiting Funds)'))}
                                  </p>
                                </div>
                              </div>
                              {isFree ? (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 uppercase tracking-widest font-mono">Free</span>
                              ) : (isAutoUnlocked || service.is_funded) ? (
                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 uppercase tracking-widest font-mono">Funded</span>
                              ) : (
                                <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20 uppercase tracking-widest font-mono">Locked</span>
                              )}
                            </div>
                          );
                        })}

                        {jobServices.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setShowAllServices(!showAllServices)}
                            className="w-full py-2.5 mt-2 border border-dashed border-border hover:border-primary/50 text-xs font-bold text-muted-foreground hover:text-primary rounded-xl flex items-center justify-center gap-1.5 transition-all bg-card/20 hover:bg-primary/5"
                          >
                            {showAllServices ? (
                              <>
                                <ChevronUp size={14} /> Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown size={14} /> Show All Services ({jobServices.length})
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payment History Section */}
            <div className="mt-8 border-t border-border pt-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment History</h4>
              </div>

              <div className="space-y-2">
                {payments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {payment.payment_method === 'cash' && <Banknote size={14} className="text-emerald-500" />}
                        {payment.payment_method === 'bank_transfer' && <Landmark size={14} className="text-blue-500" />}
                        {(payment.payment_method === 'pos' || payment.payment_method === 'online') && <CreditCard size={14} className="text-purple-500" />}
                        <span className="text-sm font-bold text-foreground capitalize">{payment.payment_method.replace('_', ' ')}</span>
                        
                        {payment.status === 'pending' && (
                          <span className="ml-2 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                            <AlertCircle size={10} /> Pending Verification
                          </span>
                        )}
                        {payment.status === 'verified' && (
                          <span className="ml-2 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={10} /> Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                        {payment.reference_number && (
                          <>
                            <span>•</span>
                            <span className="font-mono uppercase tracking-wider">Ref: {payment.reference_number}</span>
                          </>
                        )}
                        {payment.profiles?.full_name && (
                          <>
                            <span>•</span>
                            <span>By {payment.profiles.full_name}</span>
                          </>
                        )}
                      </div>
                      
                      {(() => {
                        if (!payment.notes) return null;
                        const receiptMatch = payment.notes.match(/\[RECEIPT:(.*?)\|(.*?)\]/);
                        if (receiptMatch) {
                          const filePath = receiptMatch[1];
                          const fileName = receiptMatch[2];
                          return (
                            <div className="mt-2 flex items-center gap-2">
                              <button 
                                onClick={() => handleViewReceipt(filePath)}
                                className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors"
                              >
                                <Eye size={10} /> View Upload
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {(() => {
                        const totalMinistryBilled = jobServices.reduce((sum, s) => sum + (s.ministry_fee || 0), 0);
                        const totalMinistryAllocated = jobServices.reduce((sum, s) => sum + (s.ministry_fee_allocated || 0) + (s.ministry_fee_pending || 0), 0);
                        const remainingMinistryDue = Math.max(0, totalMinistryBilled - totalMinistryAllocated);

                        const allocatedForThis = paymentAllocations
                          .filter(a => a.payment_id === payment.id)
                          .reduce((sum, a) => sum + Number(a.amount), 0);
                        
                        // Only show "Allocate Funds" if there are unpaid ministry fees and this payment hasn't already allocated its full amount
                        const canAllocateMore = !job?.client_pays_ministry_fee && remainingMinistryDue > 0 && allocatedForThis < Number(payment.amount);

                        return payment.status === 'verified' ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button 
                              onClick={() => handleGenerateReceipt(payment, 'view')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
                            >
                              <Eye size={12} /> View Receipt
                            </button>
                            <button 
                              onClick={() => handleGenerateReceipt(payment, 'download')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
                            >
                              <Download size={12} /> Download Receipt
                            </button>
                            {canAllocateMore && (
                              <button 
                                onClick={() => setAllocatingPayment(payment)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
                              >
                                <Landmark size={12} /> Allocate Funds
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {payment.status === 'pending' && (profile?.role === 'admin' || profile?.is_manager || profile?.can_do_accounts) && (
                              <button 
                                onClick={() => handleVerifyPayment(payment.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors shadow-lg shadow-emerald-500/15"
                              >
                                <CheckCircle2 size={12} /> Verify Payment
                              </button>
                            )}
                            {canAllocateMore && (
                              <button 
                                onClick={() => setAllocatingPayment(payment)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
                              >
                                <Landmark size={12} /> Allocate Funds
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <span className="font-mono text-sm text-emerald-500 font-bold">+{Number(payment.amount).toFixed(3)} OMR</span>
                  </div>
                ))}

                {payments.length === 0 && (
                  <div className="text-center border border-dashed border-border rounded-xl p-6 text-muted-foreground text-xs">
                    No payments recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Total Summaries */}

        <div className="mt-8 bg-muted/20 border border-border rounded-[1.5rem] p-6 grid grid-cols-2 md:grid-cols-4 gap-y-6 divide-x divide-border">
          <div className="px-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Billed</p>
            <p className="text-xl font-mono font-bold text-foreground">{totalBilled.toFixed(3)} <span className="text-xs text-muted-foreground ml-0.5">OMR</span></p>
          </div>
          <div className="px-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Paid</p>
            <p className="text-xl font-mono font-bold text-emerald-500 flex flex-col items-center">
              <span>{totalPaid.toFixed(3)} <span className="text-xs text-emerald-500/50 ml-0.5">OMR</span></span>
              {totalVerified < totalPaid && (
                <span className="text-[9px] font-medium text-amber-500 mt-1">({totalVerified.toFixed(3)} Verified)</span>
              )}
            </p>
          </div>
          <div className="px-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Spent (Ops)</p>
            <p className="text-xl font-mono font-bold text-rose-500">{totalSpent.toFixed(3)} <span className="text-xs text-rose-500/50 ml-0.5">OMR</span></p>
          </div>
          <div className="px-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Amount Due</p>
            <p className={`text-2xl font-mono font-black ${remainingBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {remainingBalance.toFixed(3)} <span className="text-sm opacity-50 ml-0.5">OMR</span>
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {allocatingPayment && (
          <AllocationModal 
            payment={allocatingPayment}
            jobServices={jobServices}
            clientPaysMinistryFee={job.client_pays_ministry_fee === true}
            onClose={() => setAllocatingPayment(null)}
            onSuccess={() => {
              setAllocatingPayment(null);
              loadChargesAndPayments();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
