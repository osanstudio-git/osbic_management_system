import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Calendar, DollarSign, CreditCard, Banknote,
  FileText, UploadCloud, X, Check, ArrowRight, User, Phone,
  Layers, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateBranchIncome } from '../../hooks/employee/useBranchIncome';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface RecordBranchIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBranchId?: string | null;
}

export default function RecordBranchIncomeModal({
  isOpen,
  onClose,
  defaultBranchId
}: RecordBranchIncomeModalProps) {
  const { branches } = useBranch();
  const { profile } = useAuth();
  const createIncome = useCreateBranchIncome();

  const activeBranches = branches.filter(b => b.is_active);

  // Form State
  const [branchId, setBranchId] = useState<string>(
    defaultBranchId ||
    branches.find(b => b.name.toLowerCase().includes('ruwi'))?.id ||
    activeBranches[0]?.id ||
    ''
  );
  const [entryMode, setEntryMode] = useState<'single' | 'daily_summary'>('single');
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [serviceCategory, setServiceCategory] = useState<string>('sanad_typing');
  const [workDescription, setWorkDescription] = useState<string>('');
  const [ministryFee, setMinistryFee] = useState<string>('0');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [dealsCount, setDealsCount] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Sync defaultBranchId when opened
  React.useEffect(() => {
    if (defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [defaultBranchId, isOpen]);

  // Computed Net Profit
  const numAmount = parseFloat(amount) || 0;
  const numMinistry = parseFloat(ministryFee) || 0;
  const computedNet = Math.max(0, numAmount - numMinistry);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast.error('Please select a branch');
      return;
    }
    if (!amount || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await createIncome.mutateAsync({
        branch_id: branchId,
        entry_date: entryDate,
        entry_mode: entryMode,
        amount: numAmount,
        payment_mode: paymentMode,
        client_name: clientName,
        client_phone: clientPhone,
        service_category: serviceCategory,
        work_description: workDescription,
        ministry_fee: numMinistry,
        net_profit: computedNet,
        receipt_number: receiptNumber,
        deals_count: entryMode === 'daily_summary' ? (parseInt(dealsCount, 10) || 1) : 1,
        receiptFile,
        notes,
        recorded_by: profile?.id
      });

      // Reset and close
      setAmount('');
      setMinistryFee('0');
      setClientName('');
      setClientPhone('');
      setWorkDescription('');
      setReceiptNumber('');
      setNotes('');
      setReceiptFile(null);
      onClose();
    } catch {
      // Error handled by hook
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
              <Banknote size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground font-syne">
                  Record Branch Income
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Offline / Satellite Entry
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Log external collections and daily sales from satellite branches (e.g. Ruwi) into central accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-5 pb-2">
          <div className="grid grid-cols-2 p-1 bg-muted/40 rounded-2xl border border-border/60">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                entryMode === 'single'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText size={14} />
              <span>Single Deal / Transaction</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('daily_summary')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                entryMode === 'daily_summary'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={14} />
              <span>Daily Branch Closing Sheet</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Branch & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Building2 size={13} className="text-primary" />
                <span>Source Branch *</span>
              </label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                required
              >
                {activeBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Collection Date *</span>
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                required
              />
            </div>
          </div>

          {/* Amount & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-500" />
                <span>Total Amount Collected (OMR) *</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-3.5 pr-14 py-2 text-sm font-mono font-bold text-foreground focus:border-emerald-500 outline-none"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                  OMR
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Payment Mode *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'cash'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-black'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <Banknote size={13} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'card'
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 font-black'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>Card/POS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('bank_transfer')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'bank_transfer'
                      ? 'border-purple-500/50 bg-purple-500/10 text-purple-400 font-black'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <Building2 size={13} />
                  <span>Transfer</span>
                </button>
              </div>
            </div>
          </div>

          {/* Conditional Mode Fields */}
          {entryMode === 'single' ? (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-muted-foreground" />
                    <span>Client Name (Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tariq Al Harthy / Walk-in"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-muted-foreground" />
                    <span>Client Phone (Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 96891234567"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Service Category
                  </label>
                  <select
                    value={serviceCategory}
                    onChange={e => setServiceCategory(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="sanad_typing">Sanad & Retail Typing</option>
                    <option value="visa_processing">Visa & Immigration Services</option>
                    <option value="cr_renewal">Commercial Registration (MOCIIP)</option>
                    <option value="pro_services">PRO & Labour Clearance</option>
                    <option value="legal_translation">Legal Translation & Attestation</option>
                    <option value="consulting">Business Consulting</option>
                    <option value="other">Other Inflow</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Branch Paper Receipt # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RW-2094"
                    value={receiptNumber}
                    onChange={e => setReceiptNumber(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                  />
                </div>
              </div>

              {/* Ministry Fee & Net Margin Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-2xl bg-muted/20 border border-border/80">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Govt / Ministry Fee Outflow (If Any)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={ministryFee}
                      onChange={e => setMinistryFee(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl pl-3.5 pr-14 py-1.5 text-xs font-mono font-bold text-foreground outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                      OMR
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Net Service Margin (Retained Profit)
                  </label>
                  <p className="text-base font-black font-mono text-emerald-400 py-1">
                    {computedNet.toFixed(3)} OMR
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Daily Summary Mode */
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Approximate Deals / Transactions Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={dealsCount}
                    onChange={e => setDealsCount(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono font-bold outline-none"
                    placeholder="e.g. 15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Summary Category
                  </label>
                  <select
                    value={serviceCategory}
                    onChange={e => setServiceCategory(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="daily_closing">Branch Daily Closing Total</option>
                    <option value="sanad_typing">Daily Typing Register</option>
                    <option value="visa_processing">Daily Visa Collections</option>
                    <option value="other">General Batch Summary</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Daily Closing Remarks / Breakdown
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Ruwi Branch POS settlement and evening cash tally sheet"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Receipt / Voucher Upload */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Attach Receipt / Closing Sheet (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-muted/40 hover:bg-muted text-xs font-bold text-foreground border border-border transition-all flex items-center gap-2">
                <UploadCloud size={14} className="text-primary" />
                <span>{receiptFile ? receiptFile.name : 'Choose Slip (PDF/Image)'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {receiptFile && (
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={createIncome.isPending}
              className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createIncome.isPending || !amount || numAmount <= 0}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {createIncome.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Recording Income...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Record {numAmount > 0 ? `${numAmount.toFixed(3)} OMR` : 'Income'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
