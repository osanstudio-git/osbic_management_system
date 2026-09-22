import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { X, CheckCircle2, CreditCard, Sparkles, AlertCircle, ArrowUpRight, RotateCcw } from 'lucide-react';
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
  const [otherAllocationsMap, setOtherAllocationsMap] = useState<Record<string, number>>({});
 
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

      // Map other allocations per service
      const otherMap: Record<string, number> = {};
      jobAllocations.filter(a => a.payment_id !== payment.id && a.allocation_type === 'ministry_fee').forEach(a => {
        otherMap[a.job_service_id] = (otherMap[a.job_service_id] || 0) + Number(a.amount);
      });
      setOtherAllocationsMap(otherMap);

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

      // Auto-fill services that have a predefined ministry fee if they have not been allocated yet
      for (const service of jobServices) {
        const baseGovFee = Number(service.ministry_fee) || 0;
        if (baseGovFee <= 0) continue;

        const otherMinistryAllocated = otherMap[service.id] || 0;
        const ministryRemaining = Math.max(0, baseGovFee - otherMinistryAllocated);

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
  const totalPool = payment.amount + leftoverFromPrevious;
  const remainingToAllocate = Math.max(0, totalPool - totalAllocated);

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

      // 2. Prepare new allocation records (allow custom amounts based on activities)
      const recordsToInsert = [];
      const serviceUpdates = [];

      for (const [serviceId, amountStr] of Object.entries(allocations)) {
        const amount = parseFloat(amountStr) || 0;
        if (amount <= 0) continue;
        
        const service = jobServices.find(s => s.id === serviceId);
        const revertedMin = oldAllocations?.filter(o => o.job_service_id === serviceId && o.allocation_type === 'ministry_fee').reduce((sum, o) => sum + o.amount, 0) || 0;

        // Custom amount allowed (not capped by service.ministry_fee)
        const allocMinistry = amount;
        
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
        const baseMinAlloc = Math.max(0, (service?.ministry_fee_allocated || 0) - (isVerified ? revertedMin : 0));
        const baseMinPend = Math.max(0, (service?.ministry_fee_pending || 0) - (isVerified ? 0 : revertedMin));

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

      toast.success('Gov fees allocated successfully!');
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
        className="bg-card border border-border w-full max-w-[480px] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-syne font-bold text-foreground">Allocate Government Fees</h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} /> Flexible
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pre-filled with default fee. You can adjust upwards if extra activities or changes require higher gov fees.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Funds Overview */}
        <div className="p-5 bg-emerald-500/5 border-b border-emerald-500/10 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Payment Available</p>
            <p className="text-2xl font-mono font-bold text-foreground">{totalPool.toFixed(3)} OMR</p>
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

        {/* Service Allocation Cards */}
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
          ) : jobServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={24} />
              No services found for this job.
            </div>
          ) : (
            jobServices.map(service => {
              const amountStr = allocations[service.id] ?? '';
              const currentVal = parseFloat(amountStr) || 0;
              const baseGovFee = Number(service.ministry_fee) || 0;
              const otherAllocated = otherAllocationsMap[service.id] || 0;
              const totalAllocatedForService = currentVal + otherAllocated;
              
              const isExceedingBase = baseGovFee > 0 && totalAllocatedForService > baseGovFee;
              const isBaseMet = baseGovFee > 0 && totalAllocatedForService >= baseGovFee;
              const extraAmount = Math.max(0, totalAllocatedForService - baseGovFee);

              const prevVal = parseFloat(allocations[service.id] || '0') || 0;
              const maxPossibleForThisService = prevVal + remainingToAllocate;

              return (
                <div key={service.id} className="border border-border rounded-2xl p-4 space-y-3 bg-card hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{service.service_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          Default Gov Fee: {baseGovFee > 0 ? `${baseGovFee.toFixed(3)} OMR` : '0.000 OMR (Flexible)'}
                        </span>
                        {otherAllocated > 0 && (
                          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            Prev: {otherAllocated.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExceedingBase ? (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1 shrink-0">
                        <ArrowUpRight size={11} /> +{extraAmount.toFixed(3)} OMR
                      </span>
                    ) : isBaseMet ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                        Funded
                      </span>
                    ) : currentVal > 0 ? (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                        Partial
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                        Unallocated
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Allocated Amount (OMR)
                      </label>
                      {baseGovFee > 0 && Math.abs(currentVal - Math.max(0, baseGovFee - otherAllocated)) > 0.001 && (
                        <button
                          type="button"
                          onClick={() => {
                            const neededBase = Math.max(0, baseGovFee - otherAllocated);
                            const allowed = Math.min(neededBase, maxPossibleForThisService);
                            handleAllocate(service.id, allowed.toFixed(3));
                          }}
                          className="text-[9px] text-primary hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RotateCcw size={10} /> Reset to Default ({Math.max(0, baseGovFee - otherAllocated).toFixed(3)})
                        </button>
                      )}
                    </div>
                    
                    <div className="relative flex items-center">
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
                          const maxAllowed = maxPossibleForThisService;
                          
                          if (parsed > maxAllowed) {
                            handleAllocate(service.id, parseFloat(maxAllowed.toFixed(3)).toString());
                          } else {
                            handleAllocate(service.id, text);
                          }
                        }}
                        placeholder="0.000"
                        className="w-full bg-background text-foreground placeholder:text-muted-foreground border border-border rounded-xl pl-3 pr-20 py-2 text-sm outline-none focus:border-primary font-mono transition-all"
                      />

                      <div className="absolute right-1.5 flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => {
                            const maxPossible = maxPossibleForThisService;
                            handleAllocate(service.id, parseFloat(maxPossible.toFixed(3)).toString());
                          }}
                          disabled={remainingToAllocate <= 0 && currentVal >= maxPossibleForThisService}
                          className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40"
                          title="Allocate maximum available from payment"
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    {isExceedingBase && (
                      <p className="text-[10px] text-amber-500/90 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Customized for extra activities (+{extraAmount.toFixed(3)} OMR above default feed)
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-border bg-muted/10 flex justify-end gap-3">
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
                disabled={isSaving || (jobServices.length > 0 && totalAllocated === 0)}
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : <><CheckCircle2 size={15} /> Confirm Allocation</>}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

