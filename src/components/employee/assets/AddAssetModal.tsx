import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Monitor, Laptop, Cpu, Phone, ShieldCheck, 
  Key, Armchair, HelpCircle, Check, Building2, 
  DollarSign, Calendar, Barcode, Plus
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBranch } from '../../../contexts/BranchContext';
import { 
  useCreateAsset, 
  useUpdateAsset,
  type Asset, 
  type AssetCategory, 
  type AssetCondition,
  generateAssetTag 
} from '../../../hooks/employee/useAssets';
import toast from 'react-hot-toast';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: Asset | null;
}

const CATEGORIES: { value: AssetCategory; label: string; icon: any; desc: string }[] = [
  { value: 'desktop_pc', label: 'Desktop PC / All-in-One', icon: Cpu, desc: 'Tower or All-in-One CPU Workstation' },
  { value: 'laptop', label: 'Laptop / MacBook', icon: Laptop, desc: 'Portable employee notebook' },
  { value: 'monitor', label: 'External Monitor', icon: Monitor, desc: 'Screen display unit' },
  { value: 'peripheral', label: 'Peripherals (Keyboard/Mouse/Headset)', icon: HelpCircle, desc: 'Desk input & audio accessories' },
  { value: 'sim_mobile', label: 'Corporate SIM / Phone', icon: Phone, desc: 'Official WhatsApp & phone line' },
  { value: 'pki_token', label: 'PRO PKI Token / Smart Card', icon: ShieldCheck, desc: 'Gov portal dongle (MOCIIP/ROP/Labour)' },
  { value: 'access_card', label: 'Office Key / Access Card', icon: Key, desc: 'Physical entrance & safe clearance' },
  { value: 'furniture', label: 'Desk / Ergonomic Chair', icon: Armchair, desc: 'Assigned office fixtures' },
  { value: 'other', label: 'General Equipment', icon: HelpCircle, desc: 'Scanners, printers, other' },
];

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  assetToEdit
}) => {
  const { profile } = useAuth();
  const { branches } = useBranch();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();

  const isEditing = Boolean(assetToEdit);

  const [category, setCategory] = useState<AssetCategory>(assetToEdit?.category || 'desktop_pc');
  const [assetTag, setAssetTag] = useState<string>(assetToEdit?.asset_tag || generateAssetTag('desktop_pc'));
  const [name, setName] = useState<string>(assetToEdit?.name || '');
  const [brand, setBrand] = useState<string>(assetToEdit?.brand || '');
  const [model, setModel] = useState<string>(assetToEdit?.model || '');
  const [serialNumber, setSerialNumber] = useState<string>(assetToEdit?.serial_number || '');
  const [branchId, setBranchId] = useState<string>(assetToEdit?.branch_id || profile?.branch_id || '');
  const [condition, setCondition] = useState<AssetCondition>(assetToEdit?.condition || 'good');
  const [purchaseDate, setPurchaseDate] = useState<string>(assetToEdit?.purchase_date || '');
  const [purchaseCost, setPurchaseCost] = useState<string>(assetToEdit?.purchase_cost ? String(assetToEdit.purchase_cost) : '');
  const [warrantyExpiry, setWarrantyExpiry] = useState<string>(assetToEdit?.warranty_expiry || '');
  const [notes, setNotes] = useState<string>(assetToEdit?.notes || '');

  // Auto-regenerate tag prefix when switching category if creating new
  const handleCategorySelect = (cat: AssetCategory) => {
    setCategory(cat);
    if (!isEditing) {
      setAssetTag(generateAssetTag(cat));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter equipment name / description');
      return;
    }
    if (!assetTag.trim()) {
      toast.error('Asset tag is required');
      return;
    }

    try {
      if (isEditing && assetToEdit) {
        await updateAsset.mutateAsync({
          id: assetToEdit.id,
          updates: {
            name: name.trim(),
            category,
            brand: brand.trim() || null,
            model: model.trim() || null,
            serial_number: serialNumber.trim() || null,
            branch_id: branchId || null,
            condition,
            purchase_date: purchaseDate || null,
            purchase_cost: purchaseCost ? Number(purchaseCost) : 0,
            warranty_expiry: warrantyExpiry || null,
            notes: notes.trim() || null,
          }
        });
      } else {
        await createAsset.mutateAsync({
          asset_tag: assetTag.trim(),
          name: name.trim(),
          category,
          brand: brand.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          branch_id: branchId || null,
          status: 'in_stock',
          condition,
          purchase_date: purchaseDate || null,
          purchase_cost: purchaseCost ? Number(purchaseCost) : 0,
          warranty_expiry: warrantyExpiry || null,
          notes: notes.trim() || null,
          created_by: profile?.id || null
        });
      }
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
          className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold">
                <Barcode size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">
                  {isEditing ? 'Edit Asset Details' : 'Register New Hardware Asset'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanent Asset Tag allocation & branch storage assignment
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
            {/* Category Selector Grid */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Asset Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSel = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handleCategorySelect(cat.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                        isSel
                          ? 'bg-primary/15 border-primary text-primary shadow-sm font-bold'
                          : 'bg-muted/10 border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon size={16} className={isSel ? 'text-primary' : 'text-muted-foreground'} />
                        {isSel && <Check size={14} className="text-primary" />}
                      </div>
                      <span className="text-xs font-semibold leading-tight line-clamp-1">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permanent Asset Tag & Item Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Asset Tag ID *
                </label>
                <input
                  type="text"
                  required
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
                  disabled={isEditing}
                  placeholder="e.g. AST-PC-009"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-primary focus:border-primary outline-none disabled:opacity-70"
                />
                <span className="text-[9px] text-muted-foreground mt-0.5 block">Permanent QR sticker ID</span>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Item Name / Description *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dell OptiPlex 7460 All-in-One Core i7"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
                />
              </div>
            </div>

            {/* Brand, Model, Serial Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Dell, HP, Apple"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Model Number
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. OptiPlex 7460"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Serial Number (S/N)
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. CN-0J746-871"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:border-primary outline-none"
                />
              </div>
            </div>

            {/* Branch Assignment & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Branch Inventory Location
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
                >
                  <option value="">Unassigned / Sultanate General</option>
                  {branches.filter(b => b.is_active).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city || 'Oman'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Hardware Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as AssetCondition)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
                >
                  <option value="new">Brand New (Unopened)</option>
                  <option value="good">Good Condition (Clean / Fully Working)</option>
                  <option value="fair">Fair (Minor Scratches / Usable)</option>
                  <option value="needs_repair">Needs Maintenance / Servicing</option>
                  <option value="damaged">Damaged / Defective</option>
                </select>
              </div>
            </div>

            {/* Purchase & Financial Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Cost (OMR)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0.000"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Warranty Expiry
                </label>
                <input
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Internal Notes / Specs
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 16GB RAM, 512GB SSD, includes power adapter and HDMI cable..."
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
                disabled={createAsset.isPending || updateAsset.isPending}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isEditing ? 'Save Changes' : 'Register Asset'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
