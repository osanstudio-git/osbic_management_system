import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Landmark, CreditCard, DollarSign, CheckCircle2, 
  AlertTriangle, History, Calendar, FileText, ArrowRight, 
  Sparkles, Save, ShieldCheck, TrendingDown, TrendingUp,
  Receipt, Building2, User
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  useDailyRegister, 
  useSaveReconciliation, 
  useBranchReconciliationHistory 
} from '../../hooks/employee/useBranchReconciliation';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';

interface DailyReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyReconciliationModal: React.FC<DailyReconciliationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  const { data: registerData, isLoading: loadingRegister } = useDailyRegister(branchId, selectedDate);
  const { data: historyList = [], isLoading: loadingHistory } = useBranchReconciliationHistory(branchId);
  const saveMutation = useSaveReconciliation();

  // Form State
  const [openingCash, setOpeningCash] = useState<string>('0.000');
  const [closingCashActual, setClosingCashActual] = useState<string>('0.000');
  const [posCardActual, setPosCardActual] = useState<string>('0.000');
  const [bankDepositAmount, setBankDepositAmount] = useState<string>('0.000');
  const [depositReference, setDepositReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showTxnsList, setShowTxnsList] = useState<boolean>(false);

  // Sync form with existing reconciliation or defaults when date/data changes
  useEffect(() => {
    if (registerData) {
      if (registerData.existingReconciliation) {
        const rec = registerData.existingReconciliation;
        setOpeningCash(rec.opening_cash.toFixed(3));
        setClosingCashActual(rec.closing_cash_actual.toFixed(3));
        setPosCardActual(rec.pos_card_total_actual.toFixed(3));
        setBankDepositAmount((rec.bank_deposit_amount || 0).toFixed(3));
        setDepositReference(rec.deposit_reference || '');
        setNotes(rec.notes || '');
      } else {
        // Pre-fill expected POS total as default for card terminal batch
        setOpeningCash('0.000');
        setClosingCashActual(registerData.expectedCash.toFixed(3));
        setPosCardActual(registerData.expectedCard.toFixed(3));
        setBankDepositAmount('0.000');
        setDepositReference('');
        setNotes('');
      }
    }
  }, [registerData]);

  if (!isOpen) return null;

  const numOpening = parseFloat(openingCash) || 0;
  const numClosing = parseFloat(closingCashActual) || 0;
  const numPosActual = parseFloat(posCardActual) || 0;
  const numBankDeposit = parseFloat(bankDepositAmount) || 0;

  const expectedCash = registerData?.expectedCash || 0;
  const expectedCard = registerData?.expectedCard || 0;
  const expectedBank = registerData?.expectedBank || 0;

  const netCashCollected = numClosing - numOpening;
  const cashVariance = netCashCollected - expectedCash;
  const cardVariance = numPosActual - expectedCard;
  const totalVariance = cashVariance + cardVariance;

  const isBalanced = Math.abs(totalVariance) < 0.005;
  const isShort = totalVariance < -0.005;
  const isOver = totalVariance > 0.005;

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!branchId) {
      toast.error('Branch identifier is required');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        branch_id: branchId,
        reconciliation_date: selectedDate,
        opening_cash: numOpening,
        closing_cash_actual: numClosing,
        pos_card_total_actual: numPosActual,
        expected_cash: expectedCash,
        expected_card: expectedCard,
        bank_deposit_amount: numBankDeposit,
        deposit_reference: depositReference.trim() || undefined,
        notes: notes.trim() || undefined,
        status: status === 'draft' ? 'draft' : isBalanced ? 'submitted' : 'discrepancy',
      });

      toast.success(
        status === 'draft' 
          ? 'Draft reconciliation saved' 
          : isBalanced 
            ? '✅ Register reconciled and balanced successfully!' 
            : '⚠️ Register submitted with variance noted'
      );
      if (status === 'submitted') {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save reconciliation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-card via-card/80 to-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
              <Building2 size={14} />
              <span>{selectedBranch?.name || 'Branch'} Daily Register</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-syne font-bold text-foreground">
              Cash Drawer & POS Reconciliation
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify physical cash in drawer, POS card batch settlements, and end-of-day bank handovers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('reconcile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'reconcile'
                    ? 'bg-primary text-[#0A0F1E] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Reconcile Shift
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-primary text-[#0A0F1E] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <History size={13} />
                <span>History</span>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'reconcile' ? (
            <>
              {/* Date Filter & Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-primary" />
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Register Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${
                    isBalanced 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : isShort 
                        ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}>
                    {isBalanced ? (
                      <CheckCircle2 size={16} />
                    ) : isShort ? (
                      <TrendingDown size={16} />
                    ) : (
                      <TrendingUp size={16} />
                    )}
                    <span className="text-xs font-bold font-mono">
                      {isBalanced 
                        ? 'PERFECTLY BALANCED' 
                        : isShort 
                          ? `CASH SHORT: ${totalVariance.toFixed(3)} OMR` 
                          : `CASH OVER: +${totalVariance.toFixed(3)} OMR`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Key Metrics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Expected Cash */}
                <div className="bg-card border border-border p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Recorded Cash (POS)</span>
                    <DollarSign size={16} className="text-emerald-500" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-foreground">
                    OMR {expectedCash.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {registerData?.cashPayments.length || 0} cash transaction(s) today
                  </div>
                </div>

                {/* Expected Card POS */}
                <div className="bg-card border border-border p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Recorded Card / Terminal</span>
                    <CreditCard size={16} className="text-blue-500" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-foreground">
                    OMR {expectedCard.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {registerData?.cardPayments.length || 0} card swipe(s) today
                  </div>
                </div>

                {/* Total Shift Volume */}
                <div className="bg-card border border-border p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Shift Payments</span>
                    <Receipt size={16} className="text-primary" />
                  </div>
                  <div className="text-2xl font-syne font-bold text-primary">
                    OMR {(expectedCash + expectedCard + expectedBank).toFixed(3)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Cash, POS & Bank transfers
                  </div>
                </div>
              </div>

              {/* Input Forms: Physical Drawer & Terminal Batch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LEFT: Cash Drawer Counting */}
                <div className="bg-muted/10 border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <DollarSign size={15} className="text-emerald-500" />
                      1. Cash Drawer Physical Count
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        Opening Float Cash (OMR)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(e.target.value)}
                        placeholder="e.g. 50.000"
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-primary outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                        Cash kept in drawer at shift start for change
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        Closing Cash Counted in Drawer (OMR) *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={closingCashActual}
                        onChange={(e) => setClosingCashActual(e.target.value)}
                        placeholder="e.g. 245.500"
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-primary outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                        Total banknotes & coins counted in drawer at close
                      </span>
                    </div>

                    {/* Calculated Net Cash in drawer */}
                    <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Net Collections (Closing - Float):</span>
                        <span className="font-mono font-bold text-foreground">OMR {netCashCollected.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Expected from system:</span>
                        <span className="font-mono font-bold text-foreground">OMR {expectedCash.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                        <span className="font-bold text-foreground">Cash Variance:</span>
                        <span className={`font-mono font-black ${
                          Math.abs(cashVariance) < 0.005 ? 'text-emerald-500' : cashVariance < 0 ? 'text-red-400' : 'text-blue-400'
                        }`}>
                          {cashVariance > 0 ? `+${cashVariance.toFixed(3)}` : cashVariance.toFixed(3)} OMR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: POS Settlement & Bank Handover */}
                <div className="bg-muted/10 border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <CreditCard size={15} className="text-blue-500" />
                      2. POS Terminal & Bank Deposit
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        POS Terminal Batch Settlement (OMR)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={posCardActual}
                        onChange={(e) => setPosCardActual(e.target.value)}
                        placeholder="e.g. 180.000"
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-primary outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                        Total from terminal settlement slip (Expected: OMR {expectedCard.toFixed(3)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                          Bank Deposit (OMR)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={bankDepositAmount}
                          onChange={(e) => setBankDepositAmount(e.target.value)}
                          placeholder="OMR deposited"
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                          Deposit Ref / Slip #
                        </label>
                        <input
                          type="text"
                          value={depositReference}
                          onChange={(e) => setDepositReference(e.target.value)}
                          placeholder="Slip No. #10293"
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        Reconciliation Notes / Remarks
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any discrepancy reason or shift handover notes..."
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Collapsible Payment Transactions Breakdown */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <button
                  type="button"
                  onClick={() => setShowTxnsList(!showTxnsList)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      View Recorded Shift Transactions ({registerData?.allPayments.length || 0})
                    </span>
                  </div>
                  <span className="text-xs text-primary font-semibold">
                    {showTxnsList ? 'Hide List' : 'Show List'}
                  </span>
                </button>

                {showTxnsList && (
                  <div className="p-4 border-t border-border overflow-x-auto divide-y divide-border/60">
                    {registerData?.allPayments.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No payments recorded for this branch on {selectedDate}.
                      </p>
                    ) : (
                      registerData?.allPayments.map((p) => (
                        <div key={p.id} className="py-2.5 flex items-center justify-between text-xs gap-4">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-primary mr-2">
                              {p.job?.job_code || 'JOB'}
                            </span>
                            <span className="font-semibold text-foreground">
                              {p.job?.client?.full_name || 'Walk-in Client'}
                            </span>
                            <span className="text-muted-foreground text-[11px] block">
                              Recorded by: {p.recorder?.full_name || 'Staff'} • {format(new Date(p.created_at), 'hh:mm a')}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-foreground block">
                              OMR {Number(p.amount).toFixed(3)}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              p.payment_method === 'cash' 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : p.payment_method === 'pos' || p.payment_method === 'card'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {p.payment_method}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  Past 30 Days Closeout Records
                </h3>
              </div>

              <div className="space-y-3">
                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Loading reconciliation history...</p>
                ) : historyList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs rounded-2xl border border-dashed border-border">
                    No past reconciliation records submitted for this branch yet.
                  </div>
                ) : (
                  historyList.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => {
                        setSelectedDate(rec.reconciliation_date);
                        setActiveTab('reconcile');
                      }}
                      className="p-4 rounded-2xl bg-muted/20 border border-border hover:border-primary/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground font-mono">
                            {format(new Date(rec.reconciliation_date), 'EEEE, MMM dd, yyyy')}
                          </span>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            rec.status === 'verified'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : rec.status === 'discrepancy'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-primary/15 text-primary border border-primary/30'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Closed by: <span className="text-foreground font-medium">{rec.creator?.full_name || 'Manager'}</span>
                          {rec.deposit_reference && ` • Slip: ${rec.deposit_reference}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block">Net Collected</span>
                          <span className="font-mono font-bold text-foreground text-sm">
                            OMR {(rec.closing_cash_actual - rec.opening_cash + rec.pos_card_total_actual).toFixed(3)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block">Variance</span>
                          <span className={`font-mono font-bold text-sm ${
                            Math.abs(rec.variance) < 0.005 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {rec.variance > 0 ? `+${rec.variance.toFixed(3)}` : rec.variance.toFixed(3)} OMR
                          </span>
                        </div>

                        <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {activeTab === 'reconcile' && (
          <div className="p-6 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" />
              <span>Signed by: <strong className="text-foreground">{profile?.full_name || 'Branch Manager'}</strong></span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saveMutation.isPending}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-all"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave('submitted')}
                disabled={saveMutation.isPending}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                <span>{saveMutation.isPending ? 'Reconciling...' : 'Submit & Close Register'}</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
