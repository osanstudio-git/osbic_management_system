import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldAlert, Landmark, Briefcase, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export const AllocationModal = ({ 
  payment, 
  jobServices, 
  clientPaysMinistryFee = false,
  onClose,
  onSuccess
}: { 
  payment: any; 
  jobServices: any[]; 
  clientPaysMinistryFee?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [leftoverFromPrevious, setLeftoverFromPrevious] = useState(0);
 
  // Auto-allocate payment funds step-by-step or load existing allocations on mount
  React.useEffect(() => {
    const loadAllocations = async () => {
      // 1. Fetch all payments for this job to calculate leftover from other payments
      const { data: jobPayments } = await supabase
        .from('job_payments')
        .select('id, amount')
        .eq('job_id', payment.job_id);

      const paymentIds = jobPayments?.map(p => p.id) || [];
      let jobAllocations: any[] = [];
      if (paymentIds.length > 0) {
        const { data: allocs } = await supabase
          .from('payment_allocations')
          .select('amount, payment_id, job_service_id, allocation_type')
          .in('payment_id', paymentIds);
        if (allocs) jobAllocations = allocs;
      }

      // Calculate leftover from other payments (verified or pending, excluding current payment)
      const otherPayments = (jobPayments || []).filter(p => p.id !== payment.id);
      const totalOtherPaymentsAmount = otherPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalOtherAllocations = jobAllocations.filter(a => a.payment_id !== payment.id).reduce((sum, a) => sum + Number(a.amount), 0);
      const prevLeftover = Math.max(0, totalOtherPaymentsAmount - totalOtherAllocations);
      setLeftoverFromPrevious(prevLeftover);

      // Load existing allocations for the CURRENT payment from DB
      const currentAllocations = jobAllocations.filter(a => a.payment_id === payment.id && a.allocation_type === 'ministry_fee');
      const mapped: Record<string, string> = {};
      for (const alloc of currentAllocations) {
        const prev = parseFloat(mapped[alloc.job_service_id] || '0') || 0;
        mapped[alloc.job_service_id] = parseFloat((prev + alloc.amount).toFixed(3)).toString();
      }

      // Run step-by-step auto-allocation on top of existing allocations
      // Total available is current payment + previous leftover
      let remaining = payment.amount + prevLeftover;
      
      // Subtract what is already allocated in the current payment from the available pool
      const currentAllocatedTotal = Object.values(mapped).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      remaining = Math.max(0, remaining - currentAllocatedTotal);

      const finalAllocations: Record<string, string> = { ...mapped };

      for (const service of jobServices) {
        // Only allocate to services with a ministry fee
        if (!(service.ministry_fee > 0)) continue;

        // Calculate what has been allocated by OTHER payments
        const currentMinistryAllocated = (service.ministry_fee_allocated || 0) + (service.ministry_fee_pending || 0);

        // Revert any pending/allocated amount from the current payment's existing database record
        const revertedMin = currentAllocations.filter(o => o.job_service_id === service.id && o.allocation_type === 'ministry_fee').reduce((sum, o) => sum + o.amount, 0) || 0;

        const otherMinistryAllocated = Math.max(0, currentMinistryAllocated - revertedMin);

        const hasPredefinedCosts = (service.ministry_fee || 0) > 0;
        const ministryRemaining = hasPredefinedCosts ? Math.max(0, (service.ministry_fee || 0) - otherMinistryAllocated) : 0;

        let needed = ministryRemaining;

        // Subtract what has already been allocated in this payment (during load/mapped)
        const alreadyAllocated = parseFloat(finalAllocations[service.id] || '0') || 0;
        needed = Math.max(0, needed - alreadyAllocated);

        if (needed > 0) {
          if (remaining >= needed) {
            finalAllocations[service.id] = parseFloat((alreadyAllocated + needed).toFixed(3)).toString();
            remaining -= needed;
          } else {
            // Partially allocate whatever remains in the pool
            finalAllocations[service.id] = parseFloat((alreadyAllocated + remaining).toFixed(3)).toString();
            remaining = 0;
            break;
          }
        }
      }

      setAllocations(finalAllocations);
    };

    loadAllocations();
  }, [payment.id, payment.amount, jobServices]);
 
  // Total allocated so far in this modal
  const totalAllocated = Object.values(allocations).reduce((sum, amountStr) => sum + (parseFloat(amountStr) || 0), 0);
  const remainingToAllocate = Math.max(0, (payment.amount + leftoverFromPrevious) - totalAllocated);

  const handleAllocate = (serviceId: string, amountStr: string) => {
    setAllocations(prev => ({
      ...prev,
      [serviceId]: amountStr
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isVerified = payment.status === 'verified';

      // 1. Revert existing allocations first
      const { data: oldAllocations } = await supabase
        .from('payment_allocations')
        .select('*')
        .eq('payment_id', payment.id);

      if (oldAllocations && oldAllocations.length > 0) {
        // Group by service ID to revert from job_services
        const revertMap: Record<string, { ministry: number }> = {};
        for (const alloc of oldAllocations) {
          if (!revertMap[alloc.job_service_id]) {
            revertMap[alloc.job_service_id] = { ministry: 0 };
          }
          if (alloc.allocation_type === 'ministry_fee') {
            revertMap[alloc.job_service_id].ministry += alloc.amount;
          }
        }

        // Revert counts in job_services table
        for (const [serviceId, diff] of Object.entries(revertMap)) {
          const service = jobServices.find(s => s.id === serviceId);
          if (service) {
            const updatedMinistryAllocated = Math.max(0, (service.ministry_fee_allocated || 0) - (isVerified ? diff.ministry : 0));
            const updatedMinistryPending = Math.max(0, (service.ministry_fee_pending || 0) - (isVerified ? 0 : diff.ministry));

            await supabase
              .from('job_services')
              .update({
                ministry_fee_allocated: updatedMinistryAllocated,
                ministry_fee_pending: updatedMinistryPending
              })
              .eq('id', serviceId);
          }
        }

        // Delete old payment_allocations records
        await supabase
          .from('payment_allocations')
          .delete()
          .eq('payment_id', payment.id);
      }

      // 2. Prepare new allocation records
      const recordsToInsert = [];
      const serviceUpdates = [];

      for (const [serviceId, amountStr] of Object.entries(allocations)) {
        const amount = parseFloat(amountStr) || 0;
        if (amount <= 0) continue;
        
        const service = jobServices.find(s => s.id === serviceId);
        // Note: We need to fetch fresh values after revert
        const revertedMin = oldAllocations?.filter(o => o.job_service_id === serviceId && o.allocation_type === 'ministry_fee').reduce((sum, o) => sum + o.amount, 0) || 0;

        const currentMinistryAllocated = Math.max(0, (service.ministry_fee_allocated || 0) + (service.ministry_fee_pending || 0) - revertedMin);
        
        const hasPredefinedCosts = (service.ministry_fee || 0) > 0;
        const ministryRemaining = hasPredefinedCosts ? Math.max(0, (service.ministry_fee || 0) - currentMinistryAllocated) : amount;

        const allocMinistry = Math.min(amount, ministryRemaining);
        
        if (allocMinistry > 0) {
          recordsToInsert.push({
            payment_id: payment.id,
            job_service_id: serviceId,
            amount: allocMinistry,
            allocation_type: 'ministry_fee',
            created_by: payment.recorded_by
          });
        }

        // Prepare service updates (adjust from reverted baseline)
        const baseMinAlloc = Math.max(0, (service.ministry_fee_allocated || 0) - (isVerified ? revertedMin : 0));
        const baseMinPend = Math.max(0, (service.ministry_fee_pending || 0) - (isVerified ? 0 : revertedMin));

        serviceUpdates.push({
          id: serviceId,
          ministry_fee_allocated: isVerified ? baseMinAlloc + allocMinistry : baseMinAlloc,
          ministry_fee_pending: isVerified ? baseMinPend : baseMinPend + allocMinistry
        });
      }

      if (recordsToInsert.length === 0) {
        onClose();
        return;
      }

      // 3. Insert into payment_allocations
      const { error: insertError } = await supabase
        .from('payment_allocations')
        .insert(recordsToInsert);
      if (insertError) throw insertError;

      // 4. Update job_services
      for (const update of serviceUpdates) {
        const { error: updateError } = await supabase
          .from('job_services')
          .update({
            ministry_fee_allocated: update.ministry_fee_allocated,
            ministry_fee_pending: update.ministry_fee_pending
          })
          .eq('id', update.id);
        if (updateError) throw updateError;
      }

      toast.success('Funds allocated successfully!');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Failed to allocate funds');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-[440px] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[72vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
          <div>
            <h2 className="text-lg font-syne font-bold text-foreground">Allocate Payment Funds</h2>
            <p className="text-xs text-muted-foreground mt-1">Distribute this payment across job services to unlock them for Operations.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-emerald-500/5 border-b border-emerald-500/10 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Available Funds</p>
            <p className="text-2xl font-mono font-bold text-foreground">{(payment.amount + leftoverFromPrevious).toFixed(3)} OMR</p>
            {leftoverFromPrevious > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5 font-bold">
                (Includes {leftoverFromPrevious.toFixed(3)} OMR leftover)
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unallocated</p>
            <p className={`text-xl font-mono font-bold ${remainingToAllocate === 0 ? 'text-muted-foreground' : 'text-amber-500'}`}>
              {remainingToAllocate.toFixed(3)} OMR
            </p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {clientPaysMinistryFee ? (
            <div className="text-center py-8 text-muted-foreground text-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <CreditCard size={24} />
              </div>
              <p className="font-bold text-foreground">Direct Card Payment Enabled</p>
              <p className="px-4 text-[11px] leading-relaxed">
                The client is paying the ministry fees directly via their own card. Fund allocation is bypassed and not required for this job.
              </p>
            </div>
          ) : jobServices.filter(s => (s.ministry_fee || 0) > 0).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={24} />
              No ministry fees require allocation for this job.
            </div>
          ) : (
            jobServices.filter(s => (s.ministry_fee || 0) > 0).map(service => {
              const amountStr = allocations[service.id] ?? '';
              const currentMinistryAllocated = (service.ministry_fee_allocated || 0) + (service.ministry_fee_pending || 0);
              const hasPredefinedCosts = (service.ministry_fee || 0) > 0;
              const ministryRemaining = hasPredefinedCosts ? Math.max(0, (service.ministry_fee || 0) - currentMinistryAllocated) : remainingToAllocate;
              const totalRemaining = ministryRemaining;

              const isFullyFunded = hasPredefinedCosts && totalRemaining === 0;

              return (
                <div key={service.id} className="border border-border rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{service.service_name}</h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Ministry Fee: {service.ministry_fee?.toFixed(3)} OMR</p>
                    </div>
                    {isFullyFunded ? (
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded">Ministry Funded</span>
                    ) : (
                      <span className="px-2 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-widest rounded">Unfunded</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Allocate to Task</label>
                      <span className="text-[9px] text-muted-foreground">
                        {hasPredefinedCosts ? `Due: ${totalRemaining.toFixed(3)} OMR` : 'No Fixed Due Amount'}
                      </span>
                    </div>
                    
                    <div className="relative">
                      <input 
                        type="text"
                        value={amountStr}
                        onChange={(e) => {
                          const text = e.target.value;
                          // Only allow numbers and a single decimal point
                          if (!/^\d*\.?\d*$/.test(text)) return;
                          
                          if (text === '' || text === '.') {
                            handleAllocate(service.id, text);
                            return;
                          }
                          
                          const parsed = parseFloat(text);
                          const val = Math.min(totalRemaining, parsed);
                          const prevVal = parseFloat(allocations[service.id] || '0') || 0;
                          
                          if (val - prevVal <= remainingToAllocate) {
                            if (parsed > totalRemaining) {
                               handleAllocate(service.id, totalRemaining.toString());
                            } else {
                               handleAllocate(service.id, text);
                            }
                          }
                        }}
                        placeholder="0.000"
                        className="w-full bg-background text-foreground placeholder:text-muted-foreground border border-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-primary disabled:opacity-50 font-mono"
                        disabled={isFullyFunded}
                      />
                      <button 
                        onClick={() => {
                          const prevVal = parseFloat(allocations[service.id] || '0') || 0;
                          const maxPossible = Math.min(totalRemaining, prevVal + remainingToAllocate);
                          handleAllocate(service.id, maxPossible.toString());
                        }}
                        disabled={isFullyFunded || remainingToAllocate <= 0}
                        className="absolute right-1.5 top-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-1.5 rounded-md hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
          {clientPaysMinistryFee ? (
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-md"
            >
              Got It
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors">
                Skip for Now
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || (jobServices.filter(s => (s.ministry_fee || 0) > 0).length > 0 && totalAllocated === 0)}
                className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : <><CheckCircle2 size={14} /> Confirm Allocation</>}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
