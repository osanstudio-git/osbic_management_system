import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, UserCheck, Shield, Calendar, 
  Building2, Search, Check, AlertCircle, FileText 
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdminEmployees } from '../../../hooks/admin/useAdminEmployees';
import { 
  useAssignAsset, 
  type Asset 
} from '../../../hooks/employee/useAssets';
import toast from 'react-hot-toast';

interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess?: () => void;
}

export const AssignAssetModal: React.FC<AssignAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess
}) => {
  const { profile } = useAuth();
  const assignAsset = useAssignAsset();
  const { data: employees = [], isLoading: loadingEmployees } = useAdminEmployees(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [handoverCondition, setHandoverCondition] = useState<'new' | 'good' | 'fair' | 'damaged'>(
    asset?.condition === 'needs_repair' ? 'fair' : (asset?.condition || 'good')
  );
  const [notes, setNotes] = useState<string>('');

  const filteredEmployees = employees.filter((emp: any) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      (emp.full_name || '').toLowerCase().includes(q) ||
      (emp.employee_code || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.job_title || '').toLowerCase().includes(q)
    );
  });

  const selectedEmployee = employees.find((e: any) => e.id === selectedEmployeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    if (!selectedEmployeeId) {
      toast.error('Please select an employee to receive this item');
      return;
    }
    if (!profile?.id) {
      toast.error('Authentication required');
      return;
    }

    try {
      await assignAsset.mutateAsync({
        asset_id: asset.id,
        employee_id: selectedEmployeeId,
        assigned_by: profile.id,
        handover_condition: handoverCondition,
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
          className="w-full max-w-xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-lg">
                  Assign Hardware Custody
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link Asset Tag <strong className="text-primary font-mono">{asset.asset_tag}</strong> to employee
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
            {/* Asset Summary Badge */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Selected Item</span>
                <h4 className="font-bold text-foreground text-sm mt-0.5">{asset.name}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                  <span>Tag: <strong className="text-primary font-bold">{asset.asset_tag}</strong></span>
                  {asset.serial_number && <span>• S/N: {asset.serial_number}</span>}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ready to Assign
              </span>
            </div>

            {/* Employee Picker */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Assign To Employee *
              </label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search staff by name, code, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
                />
              </div>

              {/* Employee Selection List */}
              <div className="border border-border rounded-2xl p-1 max-h-48 overflow-y-auto space-y-1">
                {loadingEmployees ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading staff list...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No employees found.</div>
                ) : (
                  filteredEmployees.map((emp: any) => {
                    const isSelected = selectedEmployeeId === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-primary/15 border border-primary text-primary font-bold shadow-sm'
                            : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                            {emp.avatar_url ? (
                              <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              emp.full_name?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{emp.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {emp.employee_code || 'EMP'} • {emp.department?.toUpperCase() || 'Staff'} • {emp.job_title || ''}
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-primary shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Handover Condition & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Handover Condition
                </label>
                <select
                  value={handoverCondition}
                  onChange={(e) => setHandoverCondition(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-medium"
                >
                  <option value="new">Brand New (Unused)</option>
                  <option value="good">Good (Clean / 100% Working)</option>
                  <option value="fair">Fair (Minor Scratches)</option>
                  <option value="damaged">Damaged (Pre-existing defect)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Handover Date
                </label>
                <input
                  type="text"
                  disabled
                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  className="w-full bg-muted/20 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Handover Notes / Instructions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Handed over with charger, laptop bag, and wireless mouse..."
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
                disabled={assignAsset.isPending || !selectedEmployeeId}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Check size={14} /> Confirm Handover
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
