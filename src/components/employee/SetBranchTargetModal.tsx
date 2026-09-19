import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Target, DollarSign, CheckCircle2, TrendingUp, 
  Calendar, Save, Sparkles, Building2, HelpCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  useBranchMonthlyTarget, 
  useSetBranchMonthlyTarget, 
  type BranchTargetData 
} from '../../hooks/employee/useBranchKPITargets';
import { useBranch } from '../../contexts/BranchContext';

interface SetBranchTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTarget?: BranchTargetData | null;
}

export const SetBranchTargetModal: React.FC<SetBranchTargetModalProps> = ({
  isOpen,
  onClose,
  initialTarget,
}) => {
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = initialTarget?.branch_id || selectedBranchId;

  const currentMonthStr = format(new Date(), 'yyyy-MM-01');
  const [revenueTarget, setRevenueTarget] = useState<string>('10000');
  const [dealsTarget, setDealsTarget] = useState<string>('30');
  const [leadsTarget, setLeadsTarget] = useState<string>('50');
  const [notes, setNotes] = useState<string>('');

  const setTargetMutation = useSetBranchMonthlyTarget();

  useEffect(() => {
    if (initialTarget) {
      setRevenueTarget(initialTarget.revenue_target.toString());
      setDealsTarget(initialTarget.deals_target.toString());
      setLeadsTarget(initialTarget.leads_target.toString());
      setNotes(initialTarget.notes || '');
    }
  }, [initialTarget]);

  if (!isOpen) return null;

  const numRevenue = parseFloat(revenueTarget) || 0;
  const numDeals = parseInt(dealsTarget, 10) || 0;
  const numLeads = parseInt(leadsTarget, 10) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('Branch context missing');
      return;
    }

    try {
      await setTargetMutation.mutateAsync({
        branch_id: branchId,
        target_month: currentMonthStr,
        revenue_target: numRevenue,
        deals_target: numDeals,
        leads_target: numLeads,
        notes: notes.trim() || undefined,
      });

      toast.success('Monthly KPI targets updated successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update target');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
              <Target size={14} />
              <span>{selectedBranch?.name || 'Branch'} Goals</span>
            </div>
            <h3 className="text-xl font-syne font-bold text-foreground">
              Set Monthly Branch Targets
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Goal period: {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-400" />
              <span>Monthly Revenue Target (OMR) *</span>
            </label>
            <input
              type="number"
              step="100"
              min="0"
              value={revenueTarget}
              onChange={e => setRevenueTarget(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-base font-mono font-bold text-foreground focus:border-primary outline-none"
              required
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Required daily pace: ~OMR {(numRevenue / 30).toFixed(2)} / day
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
                Completed Deals Target
              </label>
              <input
                type="number"
                min="0"
                value={dealsTarget}
                onChange={e => setDealsTarget(e.target.value)}
                placeholder="e.g. 40"
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-primary outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
                Inbound Leads Target
              </label>
              <input
                type="number"
                min="0"
                value={leadsTarget}
                onChange={e => setLeadsTarget(e.target.value)}
                placeholder="e.g. 60"
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
              Strategic Notes / Incentives
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Ramadan focus, new commercial setup drive, 5% bonus on overachieving..."
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={setTargetMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold hover:bg-primary/90 transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <Save size={14} />
              <span>{setTargetMutation.isPending ? 'Saving...' : 'Save Targets'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
