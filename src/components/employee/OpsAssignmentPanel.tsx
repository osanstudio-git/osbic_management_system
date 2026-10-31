import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, User, CheckCircle2, AlertCircle, Shield, 
  Calendar, Layers, Sparkles, ArrowRight, UserPlus
} from 'lucide-react';
import type { OpsCommandService, OpsEmployeeRoster } from '../../hooks/employee/useOpsCommandCenter';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

interface OpsAssignmentPanelProps {
  service: OpsCommandService | null;
  employees: OpsEmployeeRoster[];
  isOpen: boolean;
  onClose: () => void;
  onAssign: (serviceId: string, employeeId: string | null) => Promise<void>;
  isAssigning: boolean;
  onPostToPool?: (serviceId: string) => Promise<void>;
  isPostingToPool?: boolean;
  onOpenBriefing?: (jobId: string, serviceId?: string) => void;
}

export const OpsAssignmentPanel: React.FC<OpsAssignmentPanelProps> = ({
  service,
  employees,
  isOpen,
  onClose,
  onAssign,
  isAssigning,
  onPostToPool,
  isPostingToPool = false,
  onOpenBriefing
}) => {
  const { profile } = useAuth();
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(service?.ops_employee_id || null);

  if (!isOpen || !service) return null;

  const currentEmp = employees.find(e => e.id === (selectedEmpId || service.ops_employee_id));

  const handleConfirm = async () => {
    await onAssign(service.id, selectedEmpId);
    onClose();
  };

  const handleUnassign = async () => {
    await onAssign(service.id, null);
    onClose();
  };

  const handleReleaseToPool = async () => {
    if (onPostToPool) {
      await onPostToPool(service.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
              Operations Work Assignment
            </span>
            <h2 className="text-base font-bold text-foreground mt-1">
              {service.service_name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Client: <span className="font-semibold text-foreground">{service.job?.client?.full_name || 'N/A'}</span>
              {service.job?.job_code && <span className="ml-2 font-mono">#{service.job.job_code}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick Dossier Link */}
          {onOpenBriefing && (
            <button
              onClick={() => onOpenBriefing(service.job_id, service.id)}
              className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={14} />
                View Full Case Dossier & Client Requirements
              </span>
              <ArrowRight size={14} />
            </button>
          )}

          {/* Current Assignment Snapshot */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Currently Assigned To
            </span>
            {service.ops_employee ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                    {service.ops_employee.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{service.ops_employee.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Assigned: {service.assigned_at ? format(new Date(service.assigned_at), 'MMM d, h:mm a') : 'N/A'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUnassign}
                  disabled={isAssigning}
                  className="text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg transition-all"
                >
                  Unassign
                </button>
              </div>
            ) : service.assignment_model === 'pool' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>Listed in Open Marketplace Pool</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {service.pool_posted_at ? format(new Date(service.pool_posted_at), 'h:mm a') : 'Open'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <AlertCircle size={14} />
                <span>Currently Unassigned (Pending Allocation)</span>
              </div>
            )}
          </div>

          {/* Marketplace / Pool Quick Release Button */}
          {onPostToPool && service.assignment_model !== 'pool' && (
            <button
              type="button"
              onClick={handleReleaseToPool}
              disabled={isPostingToPool}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              <span>{isPostingToPool ? 'Releasing to Pool...' : '⚡ Release to Open Marketplace Pool (Any Specialist Can Claim)'}</span>
            </button>
          )}

          {/* Select Specialist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Assign To Specialist
              </span>
              <span className="text-[10px] text-muted-foreground">
                {employees.length} available
              </span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {employees.map(emp => {
                const isSelected = selectedEmpId === emp.id;
                const workload = emp.active_tasks_count;
                const isHeavy = workload >= 6;
                const isModerate = workload >= 3 && workload < 6;

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                        : 'bg-card border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {emp.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                          <span>{emp.full_name}</span>
                          {emp.is_ops_head && (
                            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded">
                              Head
                            </span>
                          )}
                          {emp.is_pro && (
                            <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded">
                              PRO
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {emp.employee_code || 'OPS Staff'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isHeavy
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : isModerate
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {workload} active
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-foreground text-xs font-bold rounded-xl hover:bg-muted transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isAssigning || !selectedEmpId || selectedEmpId === service.ops_employee_id}
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <UserPlus size={14} />
            <span>{isAssigning ? 'Assigning...' : 'Confirm Assignment'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
