import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, RotateCcw, AlertTriangle, Check, 
  Building2, ShieldAlert, ArrowDownLeft 
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  useReturnAsset, 
  type Asset,
  type AssetStatus 
} from '../../../hooks/employee/useAssets';
import toast from 'react-hot-toast';

interface ReturnAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess?: () => void;
}

export const ReturnAssetModal: React.FC<ReturnAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess
}) => {
  const { profile } = useAuth();
  const returnAsset = useReturnAsset();

  const [returnCondition, setReturnCondition] = useState<'new' | 'good' | 'fair' | 'damaged'>('good');
  const [targetStatus, setTargetStatus] = useState<AssetStatus>('in_stock');
  const [notes, setNotes] = useState<string>('');

  const handleConditionChange = (cond: 'new' | 'good' | 'fair' | 'damaged') => {
    setReturnCondition(cond);
    if (cond === 'damaged') {
      setTargetStatus('damaged_lost');
    } else {
      setTargetStatus('in_stock');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !asset.current_assignment) {
      toast.error('No active assignment record found for this item');
      return;
    }
    if (!profile?.id) {
      toast.error('Authentication required');
      return;
    }

    try {
      await returnAsset.mutateAsync({
        assignment_id: asset.current_assignment.id,
        asset_id: asset.id,
        returned_to: profile.id,
        return_condition: returnCondition,
        target_status: targetStatus,
        notes: notes.trim() || null
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      // Handled by hook
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 font-bold">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">
                  Return Asset to Stock
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive equipment back into branch storage
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

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Asset & Current Holder Info */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Returning</span>
                <span className="font-mono text-xs font-bold text-primary">{asset.asset_tag}</span>
              </div>
              <h4 className="font-bold text-foreground text-sm">{asset.name}</h4>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Currently held by:</span>
                <strong className="text-foreground">
                  {asset.current_assignment?.employee?.full_name || 'Staff Member'}
                </strong>
              </div>
            </div>

            {/* Return Condition */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Physical Condition on Return *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'good', label: 'Good & Working', desc: 'Clean, no defects' },
                  { value: 'fair', label: 'Fair / Normal Wear', desc: 'Minor scratches, fully usable' },
                  { value: 'damaged', label: 'Damaged / Broken', desc: 'Hardware defect, needs repair' },
                  { value: 'new', label: 'Like New', desc: 'Pristine condition' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleConditionChange(item.value as any)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      returnCondition === item.value
                        ? 'bg-primary/15 border-primary text-primary font-bold shadow-sm'
                        : 'bg-muted/10 border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Status in Inventory */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Move Item Status To
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as AssetStatus)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
              >
                <option value="in_stock">Available in Stock (Ready for reissue)</option>
                <option value="in_repair">Send to IT Repair / Maintenance</option>
                <option value="damaged_lost">Damaged / Lost Stock</option>
                <option value="decommissioned">Decommission / Scrap Item</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Return Inspection Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Returned upon resignation. Mouse missing, PC in working order."
                className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-primary outline-none"
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
                disabled={returnAsset.isPending}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw size={14} /> Confirm Item Return
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
