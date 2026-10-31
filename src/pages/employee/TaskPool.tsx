import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Sparkles, Search, Layers, Clock, DollarSign,
  User, CheckCircle2, ChevronRight, FileText, ArrowRight,
  Shield, AlertCircle, RefreshCw, Briefcase, Eye, Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useClaimPoolTask, type PoolTask } from '../../hooks/employee/useClaimPoolTask';
import { TaskAssignmentBriefing } from '../../components/employee/TaskAssignmentBriefing';
import { format, formatDistanceToNow } from 'date-fns';

export default function TaskPool() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [briefingJobId, setBriefingJobId] = useState<string | null>(null);
  const [briefingServiceId, setBriefingServiceId] = useState<string | null>(null);

  const {
    tasks,
    isLoading,
    refetch,
    claimTask,
  } = useClaimPoolTask(profile?.branch_id);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      task.service_name.toLowerCase().includes(q) ||
      (task.applicant_name || '').toLowerCase().includes(q) ||
      (task.job?.client?.full_name || '').toLowerCase().includes(q) ||
      (task.job?.job_code || '').toLowerCase().includes(q) ||
      (task.job?.package?.name_en || '').toLowerCase().includes(q)
    );
  });

  const totalFeesAvailable = tasks.reduce((sum, t) => sum + (t.work_fee || 0), 0);

  const handleClaim = async (task: PoolTask) => {
    setClaimingId(task.id);
    try {
      await claimTask({ jobServiceId: task.id });
    } catch (err) {
      // Handled in mutation toast
    } finally {
      setClaimingId(null);
    }
  };

  const handleOpenBriefing = (jobId: string, serviceId?: string) => {
    setBriefingJobId(jobId);
    setBriefingServiceId(serviceId || null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── 1. HEADER & LIVE TICKER ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              LIVE TASK MARKETPLACE
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin text-muted-foreground/60" />
              Realtime Sync Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-1 tracking-tight flex items-center gap-2">
            <span>⚡ Open Task Pool</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Uber-style marketplace for corporate operations. Claim any available task to add directly to your active queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/employee/my-tasks"
            className="px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center gap-2 shadow-sm"
          >
            <Briefcase size={14} className="text-primary" />
            <span>Go to My Tasks</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm"
            title="Refresh Pool"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── 2. STATS OVERVIEW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Available Tasks
            </span>
            <p className="text-2xl font-black text-foreground leading-tight">
              {tasks.length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Work Value in Pool
            </span>
            <p className="text-2xl font-black text-foreground leading-tight">
              {totalFeesAvailable.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">OMR</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Specialist Pickup
            </span>
            <p className="text-xs font-medium text-muted-foreground mt-1 leading-snug">
              Instant assignment upon clicking claim with atomic row locking.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTERS ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-sm">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by service, client name, applicant, or job code..."
            className="w-full bg-muted/40 border border-border/60 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ── 4. TASK CARDS GRID ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Connecting to task pool feed...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-20 rounded-2xl bg-card/40 border border-dashed border-border/80 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center">
            <Zap size={28} className="text-muted-foreground/60" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-foreground">No Open Tasks in Marketplace</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery 
                ? 'No open tasks matched your search query. Clear search to see all pool tasks.'
                : 'All corporate operations services are currently claimed or assigned. When sales or the Ops Head releases new tasks to the marketplace, they will appear here live in real-time.'}
            </p>
          </div>
          <Link
            to="/employee/my-tasks"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <span>View My Assigned Tasks</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map(task => {
            const isClaimingThis = claimingId === task.id;
            const clientName = task.job?.client?.full_name || 'Client';
            const applicantDisplay = task.applicant_name || clientName;
            const packageTitle = task.job?.package?.name_en;
            const stepsCount = task.steps?.length || 0;
            const timeAgo = task.pool_posted_at 
              ? formatDistanceToNow(new Date(task.pool_posted_at), { addSuffix: true })
              : 'Recently';

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="rounded-2xl bg-card border border-border/80 shadow-md hover:shadow-xl hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top Banner */}
                <div className="p-5 border-b border-border/60 bg-gradient-to-br from-card to-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Zap size={10} />
                        Open Pool
                      </span>
                      {packageTitle && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                          {packageTitle}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {timeAgo}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors leading-snug">
                      {task.service_name}
                    </h3>
                    {task.quantity > 1 && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Item #{task.item_number} of {task.quantity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3.5 flex-1 text-xs">
                  {/* Applicant & Client Info */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Applicant / Target
                      </span>
                      {task.applicant_name ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Autofilled
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                        <User size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">
                          {applicantDisplay}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Client: {clientName}
                          {task.job?.job_code && <span className="ml-1 font-mono">#{task.job.job_code}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Steps & Scope */}
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] px-1">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-primary" />
                      <span>{stepsCount > 0 ? `${stepsCount} workflow steps` : 'Standard service'}</span>
                    </span>
                    {task.work_fee > 0 && (
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                        +{task.work_fee} OMR Fee
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenBriefing(task.job_id, task.id)}
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                    title="View Full Case Dossier"
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    type="button"
                    disabled={isClaimingThis}
                    onClick={() => handleClaim(task)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isClaimingThis ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Claiming...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} className="fill-current" />
                        <span>⚡ CLAIM THIS TASK</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Case Dossier Modal */}
      <TaskAssignmentBriefing
        jobId={briefingJobId || ''}
        currentServiceId={briefingServiceId || undefined}
        isOpen={!!briefingJobId}
        onClose={() => {
          setBriefingJobId(null);
          setBriefingServiceId(null);
        }}
      />
    </div>
  );
}
