import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Plus, Check, Building2, Monitor, Cpu } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBranch } from '../../../contexts/BranchContext';
import { useAssets, useCreateKit } from '../../../hooks/employee/useAssets';
import toast from 'react-hot-toast';

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateKitModal: React.FC<CreateKitModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const { branches } = useBranch();
  const createKit = useCreateKit();

  const [name, setName] = useState<string>('Standard Sales Desk Kit');
  const [kitCode, setKitCode] = useState<string>(`KIT-DESK-${Math.floor(10 + Math.random() * 90)}`);
  const [branchId, setBranchId] = useState<string>(profile?.branch_id || '');
  const [description, setDescription] = useState<string>('Standard workstation bundle (PC + Monitor + Peripherals)');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Fetch items currently in stock to bundle
  const { data: stockItems = [], isLoading: loadingStock } = useAssets({
    branchId: branchId || undefined,
    status: 'in_stock'
  });

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter kit bundle name');
      return;
    }
    if (selectedAssetIds.length === 0) {
      toast.error('Please pick at least one equipment item to include in this kit');
      return;
    }

    try {
      await createKit.mutateAsync({
        name: name.trim(),
        kit_code: kitCode.trim(),
        branch_id: branchId || null,
        description: description.trim() || null,
        asset_ids: selectedAssetIds,
        created_by: profile?.id || null
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      // Handled by hook
    }
  };

  if (!isOpen) return null;

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
                <Layers size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">
                  Create Workstation Desk Kit
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bundle multiple stock items (PC + Monitor + Accessories) for 1-click hire assignment
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Kit Bundle Code *
                </label>
                <input
                  type="text"
                  required
                  value={kitCode}
                  onChange={(e) => setKitCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KIT-DESK-01"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Kit Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Operations Workstation Set"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Branch Stock
                </label>
                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setSelectedAssetIds([]);
                  }}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="">Sultanate HQ / All</option>
                  {branches.filter(b => b.is_active).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Standard 4-piece desk equipment"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                />
              </div>
            </div>

            {/* Select Stock Items */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-foreground">
                  Pick Items to Bundle ({selectedAssetIds.length} selected) *
                </label>
                <span className="text-[10px] text-muted-foreground">{stockItems.length} available in stock</span>
              </div>

              {loadingStock ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Loading stock...</div>
              ) : stockItems.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs text-center font-bold">
                  No items currently in stock for this branch. Register hardware first.
                </div>
              ) : (
                <div className="border border-border rounded-2xl p-1 max-h-48 overflow-y-auto space-y-1">
                  {stockItems.map(item => {
                    const isSelected = selectedAssetIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleAsset(item.id)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-primary/15 border border-primary text-primary font-bold shadow-sm'
                            : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs border ${
                            isSelected ? 'bg-primary text-black border-primary' : 'border-border'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {item.asset_tag} • {item.category.replace('_', ' ').toUpperCase()} {item.serial_number && `• S/N: ${item.serial_number}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                          {item.condition}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
                disabled={createKit.isPending || selectedAssetIds.length === 0}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={14} /> Create Bundle Kit
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
