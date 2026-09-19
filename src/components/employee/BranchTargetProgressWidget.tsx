import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, TrendingUp, TrendingDown, DollarSign, 
  Briefcase, Users, Calendar, Sparkles, Edit3, ArrowUpRight 
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  useBranchMonthlyTarget, 
  type BranchTargetData 
} from '../../hooks/employee/useBranchKPITargets';
import { SetBranchTargetModal } from './SetBranchTargetModal';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';

export const BranchTargetProgressWidget: React.FC = () => {
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const { data: targetData, isLoading } = useBranchMonthlyTarget(branchId);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (isLoading || !targetData) {
    return (
      <div className="p-6 rounded-3xl bg-card border border-border animate-pulse h-36" />
    );
  }

  const revenuePct = Math.min(100, targetData.revenue_progress_pct);
  const isTargetAchieved = targetData.actual_revenue >= targetData.revenue_target;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/95 to-primary/5 border border-border p-6 shadow-md hover:border-primary/30 transition-all">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Target size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {format(new Date(), 'MMMM yyyy')} Target vs. Actuals
                </h3>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isTargetAchieved 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : targetData.is_pacing_ahead
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  {isTargetAchieved ? '🏆 TARGET HIT' : targetData.is_pacing_ahead ? '🚀 ON TRACK' : '⚠️ BEHIND PACE'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target: <strong className="text-foreground">OMR {targetData.revenue_target.toLocaleString()}</strong> • {targetData.days_remaining} days remaining in month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-foreground text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Edit3 size={12} />
              <span>Adjust Target</span>
            </button>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2 mb-5">
          <div className="flex items-baseline justify-between text-xs">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-syne font-black text-foreground">
                OMR {targetData.actual_revenue.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                of OMR {targetData.revenue_target.toLocaleString()} ({targetData.revenue_progress_pct}%)
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">
                Forecast: <strong className={targetData.is_pacing_ahead ? 'text-emerald-400' : 'text-amber-400'}>
                  OMR {targetData.projected_revenue.toFixed(2)}
                </strong>
              </span>
            </div>
          </div>

          {/* Bar track */}
          <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/60 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${revenuePct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isTargetAchieved 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50' 
                  : targetData.is_pacing_ahead
                    ? 'bg-gradient-to-r from-primary to-amber-400 shadow-sm shadow-primary/40'
                    : 'bg-gradient-to-r from-amber-500 to-primary'
              }`}
            />
          </div>
        </div>

        {/* 3 Secondary Progress Mini Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/50 text-xs">
          
          {/* Completed Jobs Progress */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-blue-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Deals Closed</span>
                <span className="font-bold text-foreground">
                  {targetData.actual_deals} / {targetData.deals_target} ({targetData.deals_progress_pct}%)
                </span>
              </div>
            </div>
            <span className={`text-[10px] font-bold ${targetData.deals_progress_pct >= 100 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {targetData.deals_progress_pct >= 100 ? 'Done' : `${Math.max(0, targetData.deals_target - targetData.actual_deals)} left`}
            </span>
          </div>

          {/* Leads Volume & Conversion */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-purple-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Leads & Conversion</span>
                <span className="font-bold text-foreground">
                  {targetData.actual_leads} Leads ({targetData.leads_conversion_pct}% Conv)
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-400">
              {targetData.converted_leads} won
            </span>
          </div>

          {/* Daily Pace Requirement */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-amber-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Required Daily Pace</span>
                <span className="font-bold text-foreground font-mono">
                  OMR {(targetData.revenue_shortfall / Math.max(1, targetData.days_remaining)).toFixed(2)} / day
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {targetData.days_remaining}d left
            </span>
          </div>

        </div>

      </div>

      {isEditModalOpen && (
        <SetBranchTargetModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialTarget={targetData}
        />
      )}
    </>
  );
};
