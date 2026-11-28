import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, RefreshCw, ArrowRight, Check, 
  AlertCircle, ShieldAlert, Cpu 
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  useAssets, 
  useSwapAsset, 
  type Asset, 
  type AssetStatus 
} from '../../../hooks/employee/useAssets';
import toast from 'react-hot-toast';

interface SwapAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToSwap: Asset | null;
  onSuccess?: () => void;
}

export const SwapAssetModal: React.FC<SwapAssetModalProps> = ({
  isOpen,
  onClose,
  assetToSwap,
  onSuccess
}) => {
  const { profile } = useAuth();
  const swapAsset = useSwapAsset();

  // Fetch available replacement items of the same category (or any category)
  const { data: stockItems = [], isLoading: loadingStock } = useAssets({
    branchId: assetToSwap?.branch_id,
    status: 'in_stock',
    category: assetToSwap?.category
  });

  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
  const [oldReturnCondition, setOldReturnCondition] = useState<'good' | 'fair' | 'damaged'>('damaged');
  const [oldTargetStatus, setOldTargetStatus] = useState<AssetStatus>('in_repair');
  const [newHandoverCondition, setNewHandoverCondition] = useState<'new' | 'good' | 'fair' | 'damaged'>('good');
  const [swapReason, setSwapReason] = useState<string>('Hardware malfunctioning, replaced with tested stock unit');

  const selectedReplacement = stockItems.find(a => a.id === selectedReplacementId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetToSwap || !assetToSwap.current_assignment) {
      toast.error('No active assignment record found for this item');
      return;
    }
    if (!selectedReplacementId) {
      toast.error('Please pick a replacement item from available stock');
      return;
    }
    if (!profile?.id) {
      toast.error('Authentication required');
      return;
    }

    try {
      await swapAsset.mutateAsync({
        old_assignment_id: assetToSwap.current_assignment.id,
        old_asset_id: assetToSwap.id,
        new_asset_id: selectedReplacementId,
        employee_id: assetToSwap.current_assignment.employee_id,
        assigned_by: profile.id,
        old_return_condition: oldReturnCondition,
        old_target_status: oldTargetStatus,
        new_handover_condition: newHandoverCondition,
        reason: swapReason.trim()
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      // Handled by hook
    }
  };

  if (!isOpen || !assetToSwap) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold">
                <RefreshCw size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">
                  1-Click Equipment Swap / Replace
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replace active hardware and update stock status in one operation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Visual Swap Preview Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Old Item (Being Returned) */}
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Current Defective Item</span>
                <h5 className="font-bold text-foreground text-xs">{assetToSwap.name}</h5>
                <p className="font-mono text-xs font-bold text-rose-400">{assetToSwap.asset_tag}</p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-rose-500/20">
                  Holder: <strong className="text-foreground">{assetToSwap.current_assignment?.employee?.full_name || 'Staff'}</strong>
                </div>
              </div>

              {/* Replacement Item */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Replacement from Stock</span>
                {selectedReplacement ? (
                  <>
                    <h5 className="font-bold text-foreground text-xs">{selectedReplacement.name}</h5>
                    <p className="font-mono text-xs font-bold text-emerald-400">{selectedReplacement.asset_tag}</p>
                    <div className="text-[10px] text-emerald-400 pt-1 border-t border-emerald-500/20 flex items-center gap-1">
                      <Check size={12} /> Ready to deploy
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-3">Select available unit below ↓</p>
                )}
              </div>
            </div>

            {/* Select Replacement Item from Stock */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Pick Replacement Unit ({stockItems.length} in stock) *
              </label>
              {loadingStock ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Loading stock...</div>
              ) : stockItems.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs text-center font-bold">
                  No replacement items currently in stock for category: {assetToSwap.category}
                </div>
              ) : (
                <div className="border border-border rounded-2xl p-1 max-h-40 overflow-y-auto space-y-1">
                  {stockItems.map(item => {
                    const isSelected = selectedReplacementId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReplacementId(item.id)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-500/15 border border-emerald-500 text-emerald-400 font-bold shadow-sm'
                            : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground">{item.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {item.asset_tag} {item.serial_number && `• S/N: ${item.serial_number}`} • Condition: {item.condition}
                          </p>
                        </div>
                        {isSelected && <Check size={16} className="text-emerald-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Disposition of Old Asset */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Old Item Condition
                </label>
                <select
                  value={oldReturnCondition}
                  onChange={(e) => setOldReturnCondition(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="damaged">Damaged / Broken</option>
                  <option value="fair">Fair (Needs Servicing)</option>
                  <option value="good">Good (Working)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Send Old Item To
                </label>
                <select
                  value={oldTargetStatus}
                  onChange={(e) => setOldTargetStatus(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="in_repair">IT Repair & Warranty Service</option>
                  <option value="damaged_lost">Damaged / Scrap Stock</option>
                  <option value="in_stock">Return Back to Available Stock</option>
                </select>
              </div>
            </div>

            {/* Swap Reason */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Reason for Swap
              </label>
              <input
                type="text"
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="e.g. Broken display, malfunctioning keyboard keys..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={swapAsset.isPending || !selectedReplacementId}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Execute Swap
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
