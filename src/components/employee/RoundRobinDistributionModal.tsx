import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Zap, Users, CheckCircle2, ArrowRight, 
  Sparkles, RefreshCw, Scale, UserCheck, Shield 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  computeDistributionPlan, 
  useExecuteRoundRobin, 
  type DistributionStrategy, 
  type StaffCapacity 
} from '../../hooks/employee/useRoundRobinDistribution';
import type { Lead } from '../../hooks/shared/useLeads';

interface RoundRobinDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  unassignedLeads: Lead[];
  employees: any[];
  allJobs?: any[];
  allLeads?: Lead[];
}

export const RoundRobinDistributionModal: React.FC<RoundRobinDistributionModalProps> = ({
  isOpen,
  onClose,
  unassignedLeads,
  employees,
  allJobs = [],
  allLeads = [],
}) => {
  const [strategy, setStrategy] = useState<DistributionStrategy>('workload_balanced');
  const executeMutation = useExecuteRoundRobin();

  // Prepare staff capacities
  const salesStaffCapacities = useMemo<StaffCapacity[]>(() => {
    // Filter to sales-capable or active employees
    const salesEligible = employees.filter(e => 
      e.is_active && (e.can_do_sales || e.department === 'sales' || !e.department || e.is_manager)
    );

    return salesEligible.map(emp => {
      const activeJobs = allJobs.filter(j => 
        (j.employee_id === emp.id || j.sales_employee_id === emp.id) &&
        j.status !== 'completed' && j.status !== 'cancelled'
      ).length;

      const activeLeads = allLeads.filter(l => 
        l.assigned_to === emp.id && 
        l.status !== 'converted' && l.status !== 'lost'
      ).length;

      return {
        id: emp.id,
        full_name: emp.full_name,
        avatar_url: emp.avatar_url,
        department: emp.department,
        role: emp.role,
        is_active: emp.is_active ?? true,
        availability_status: emp.availability_status || 'available',
        activeLeadCount: activeLeads,
        activeJobCount: activeJobs,
        totalActiveLoad: activeJobs + activeLeads,
      };
    });
  }, [employees, allJobs, allLeads]);

  // Compute live distribution plan
  const plan = useMemo(() => {
    return computeDistributionPlan(unassignedLeads, salesStaffCapacities, strategy);
  }, [unassignedLeads, salesStaffCapacities, strategy]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (plan.assignments.length === 0) {
      toast.error('No leads available to distribute');
      return;
    }

    try {
      await executeMutation.mutateAsync(plan);
      toast.success(`⚡ Successfully auto-distributed ${plan.totalLeadsToDistribute} leads across ${plan.staffSummary.filter(s => s.assignedCount > 0).length} consultants!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to distribute leads');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-3xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              <Zap size={14} />
              <span>Smart Round-Robin Engine</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-syne font-bold text-foreground">
              Auto-Distribute Unassigned Leads
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribute <strong className="text-foreground">{unassignedLeads.length} waiting inbound leads</strong> evenly across your branch sales consultants.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Strategy Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
            Distribution Strategy
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setStrategy('workload_balanced')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                strategy === 'workload_balanced'
                  ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                  : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs mb-1">
                <Scale size={14} className={strategy === 'workload_balanced' ? 'text-primary' : ''} />
                <span>Workload Balanced</span>
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Prioritizes consultants with lowest active task count.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStrategy('pure_round_robin')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                strategy === 'pure_round_robin'
                  ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                  : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs mb-1">
                <RefreshCw size={14} className={strategy === 'pure_round_robin' ? 'text-primary' : ''} />
                <span>Pure Turn-by-Turn</span>
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Strict sequential 1:1 split across all team members.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStrategy('available_only')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                strategy === 'available_only'
                  ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                  : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs mb-1">
                <UserCheck size={14} className={strategy === 'available_only' ? 'text-primary' : ''} />
                <span>Available Staff Only</span>
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Distributes only to staff marked as "Available" right now.
              </p>
            </button>
          </div>
        </div>

        {/* Live Distribution Allocation Preview */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>Staff Allocation Preview ({plan.staffSummary.length} Consultants)</span>
            <span className="text-primary font-mono">{plan.assignments.length} Leads to be Assigned</span>
          </div>

          <div className="space-y-2.5">
            {plan.staffSummary.map(({ employee, assignedCount, initialLoad, projectedLoad }) => (
              <div
                key={employee.id}
                className="p-4 rounded-2xl bg-muted/20 border border-border flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {employee.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-foreground truncate">{employee.full_name}</h4>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        employee.availability_status === 'available'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {employee.availability_status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Current: {initialLoad} active tasks ({employee.activeLeadCount} leads, {employee.activeJobCount} jobs)
                    </p>
                  </div>
                </div>

                {/* Allocation Badge */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-primary block">
                      +{assignedCount} New Leads
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      → {projectedLoad} total load
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span>Will notify each consultant automatically upon allocation.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={executeMutation.isPending || plan.assignments.length === 0}
              onClick={handleExecute}
              className="px-6 py-2.5 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-95 flex items-center gap-2"
            >
              <Zap size={14} />
              <span>{executeMutation.isPending ? 'Distributing...' : `Distribute ${plan.totalLeadsToDistribute} Leads`}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
