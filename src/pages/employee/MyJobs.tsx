import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle, Clock, CheckCircle2, ChevronRight, Plus, Filter, X, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useEmployeeJobs } from '../../hooks/shared/useJobs';
import CreateJobModal from '../../components/jobs/CreateJobModal';
import { useAuth } from '../../contexts/AuthContext';
import Skeleton from '../../components/ui/Skeleton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MyJobs = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: jobs, isLoading } = useEmployeeJobs(profile?.id || '');
  
  const [filter, setFilter] = useState<'all' | 'active' | 'awaiting_govt' | 'completed' | 'on_hold'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'fee_desc' | 'progress_desc'>('newest');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const queryClient = useQueryClient();

  const acceptJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      // Set the job status to active
      const { error } = await (supabase
        .from('jobs') as any)
        .update({ status: 'active' })
        .eq('id', jobId);
      if (error) throw error;
      
      // Also set any pending steps assigned to this employee to in_progress
      await (supabase
        .from('job_steps') as any)
        .update({ status: 'in_progress' })
        .eq('job_id', jobId)
        .eq('assigned_to', profile?.id)
        .eq('status', 'pending');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      toast.success('Task accepted and moved to active workload!');
    }
  });

  const pendingJobs = jobs?.filter(job => job.status === 'pending' && job.assigned_by !== profile?.id) || [];

  // Dynamically extract unique services for filter dropdown
  const availableServices = Array.from(new Set(jobs?.map(j => j.service_name).filter(Boolean) || []));

  const hasActiveFilters = searchQuery.trim() !== '' || serviceFilter !== 'all' || paymentFilter !== 'all' || filter !== 'active' || sortBy !== 'newest';

  const resetAllFilters = () => {
    setSearchQuery('');
    setFilter('active');
    setServiceFilter('all');
    setPaymentFilter('all');
    setSortBy('newest');
  };

  const filteredJobs = jobs?.filter(job => {
    // Exclude pending jobs from the main active list, they live in the tray
    if (job.status === 'pending' && job.assigned_by !== profile?.id) return false;

    // 1. Filter by Status
    let matchStatus = true;
    if (filter === 'active') matchStatus = job.status === 'active' || job.status === 'in_progress' || job.status === 'pending';
    else if (filter === 'awaiting_govt') matchStatus = job.status === 'awaiting_govt';
    else if (filter === 'completed') matchStatus = job.status === 'completed';
    else if (filter === 'on_hold') matchStatus = job.status === 'on_hold';

    // 2. Filter by Service Name
    let matchService = true;
    if (serviceFilter !== 'all') {
      matchService = job.service_name === serviceFilter;
    }

    // 3. Filter by Payment Status
    let matchPayment = true;
    if (paymentFilter === 'paid') {
      matchPayment = job.remaining_paid === true;
    } else if (paymentFilter === 'pending') {
      matchPayment = job.remaining_paid === false;
    }

    // 4. Multi-field Search Query (Client Name, Service Name, Job Code)
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || (
      job.job_code.toLowerCase().includes(q) ||
      job.client_name.toLowerCase().includes(q) ||
      job.service_name.toLowerCase().includes(q)
    );

    return matchStatus && matchService && matchPayment && matchSearch;
  })?.sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.started_date || 0).getTime() - new Date(a.started_date || 0).getTime();
    if (sortBy === 'oldest') return new Date(a.started_date || 0).getTime() - new Date(b.started_date || 0).getTime();
    if (sortBy === 'fee_desc') return (b.total_fee || 0) - (a.total_fee || 0);
    if (sortBy === 'progress_desc') return ((b.completed_steps || 0) / (b.total_steps || 1)) - ((a.completed_steps || 0) / (a.total_steps || 1));
    return 0;
  });

  const stats = {
    active: jobs?.filter(j => j.status === 'active' || j.status === 'in_progress' || j.status === 'awaiting_govt' || j.status === 'pending').length || 0,
    completed: jobs?.filter(j => j.status === 'completed').length || 0,
    issues: jobs?.filter(j => j.status === 'on_hold').length || 0
  };

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-syne font-bold text-foreground mb-1">My Assigned Jobs</h1>
          <p className="text-sm text-muted-foreground/60">Manage your active service workflows</p>
        </div>
        <button 
          onClick={() => setIsCreateJobOpen(true)}
          className="group relative bg-primary hover:bg-gold transition-all px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(212,175,55,0.15)] hover:shadow-[0_0_40px_rgba(212,175,55,0.25)] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="w-10 h-10 rounded-[0.9rem] bg-[#0A0F1E]/10 flex items-center justify-center text-[#0A0F1E] border border-[#0A0F1E]/5">
             <Plus size={20} strokeWidth={3} />
          </div>
          <div className="flex flex-col items-start pr-2">
             <span className="text-[#0A0F1E] font-syne font-black text-xs uppercase tracking-tight leading-none">Initiate</span>
             <span className="text-[#0A0F1E]/60 font-bold text-[10px] uppercase tracking-widest mt-0.5">New Job Bundle</span>
          </div>
        </button>
      </div>
        
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Active Workload</p>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Completed (Month)</p>
            <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-gold/30 transition-colors" onClick={() => setFilter('on_hold')}>
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Attention Needed</p>
            <p className="text-2xl font-bold text-amber-500">{stats.issues}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* Pending Acceptance Tray */}
      {pendingJobs.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.05)]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
           <h2 className="text-sm font-syne font-bold text-foreground flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Pending Acceptance ({pendingJobs.length})
           </h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
             {pendingJobs.map(job => (
               <div key={job.id} className="bg-card border border-primary/20 rounded-xl p-4 flex items-center justify-between shadow-lg">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{job.client_name}</h3>
                    <p className="text-xs text-muted-foreground">{job.service_name}</p>
                    <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest mt-1">
                      Assigned by: {job.assigned_by_role}
                    </p>
                  </div>
                  <button
                    onClick={() => acceptJobMutation.mutate(job.id)}
                    disabled={acceptJobMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:bg-gold transition-all disabled:opacity-50"
                  >
                    Accept Task
                  </button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Single-Line Toolbar & Filters */}
      <div className="bg-card border border-border p-3 rounded-2xl shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left Section: Expanded Search Bar */}
        <div className="w-full md:flex-1 relative min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search Client Name, Service, or Task ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border outline-none pl-9 pr-8 py-2 rounded-xl text-foreground placeholder:text-muted-foreground/60 text-xs focus:border-primary transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Section: Single Horizontal Row of Compact Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end text-xs">
          
          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
            >
              <option value="active" className="bg-card text-foreground py-1">Active Workload</option>
              <option value="awaiting_govt" className="bg-card text-foreground py-1">Awaiting Govt</option>
              <option value="completed" className="bg-card text-foreground py-1">Completed</option>
              <option value="on_hold" className="bg-card text-foreground py-1">On Hold</option>
              <option value="all" className="bg-card text-foreground py-1">All Tasks</option>
            </select>
          </div>

          {/* Service Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
            <Filter size={13} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Service:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer max-w-[140px] truncate"
            >
              <option value="all" className="bg-card text-foreground py-1">All Services</option>
              {availableServices.map((svc, i) => (
                <option key={i} value={svc} className="bg-card text-foreground py-1">{svc}</option>
              ))}
            </select>
          </div>

          {/* Payment Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
            >
              <option value="all" className="bg-card text-foreground py-1">All Payments</option>
              <option value="paid" className="bg-card text-foreground py-1">Fully Paid</option>
              <option value="pending" className="bg-card text-foreground py-1">Pending Payment</option>
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
            <ArrowUpDown size={13} className="text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
            >
              <option value="newest" className="bg-card text-foreground py-1">Newest First</option>
              <option value="oldest" className="bg-card text-foreground py-1">Oldest First</option>
              <option value="fee_desc" className="bg-card text-foreground py-1">Highest Fee</option>
              <option value="progress_desc" className="bg-card text-foreground py-1">Highest Progress %</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button 
              onClick={resetAllFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton height={200} rounded="xl" />
          <Skeleton height={200} rounded="xl" />
          <Skeleton height={200} rounded="xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredJobs?.map(job => {
               const progressRaw = (job.completed_steps / job.total_steps) * 100;
               return (
                 <motion.div 
                   layout
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   key={job.id} 
                   className="bg-card border border-border rounded-2xl p-5 shadow-xl hover:border-primary/30 transition-all flex flex-col cursor-pointer group"
                   onClick={() => navigate(`/employee/my-jobs/${job.id}`)}
                 >
                    <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center text-foreground font-bold font-syne text-lg">
                           {job.client_name[0]}
                         </div>
                         <div>
                           <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{job.client_name}</h3>
                           <p className="text-[10px] text-muted-foreground/60 font-mono">{job.job_code}</p>
                         </div>
                       </div>
                       <div className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                          job.status === 'in_progress' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : 
                          job.status === 'awaiting_govt' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                          job.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          "bg-white/5 text-muted-foreground border-border"
                       )}>
                          {job.status === 'completed' && <CheckCircle2 size={10} className="inline mr-1" />}
                          {job.status.replace('_', ' ')}
                       </div>
                    </div>

                    <div className="mb-4">
                       <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{job.service_name}</p>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] bg-white/5 border border-border px-2 py-0.5 rounded text-muted-foreground/60 font-mono">STEP {job.completed_steps + 1} OF {job.total_steps}</span>
                         <span className="text-[10px] text-muted-foreground/60">{Math.round(progressRaw)}%</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                         <div className="h-full bg-gold transition-all" style={{ width: `${progressRaw}%` }} />
                       </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                       {job.advance_paid ? (
                         <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Advance Paid</span>
                       ) : (
                         <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">Advance Pending</span>
                       )}
                       
                       {!job.remaining_paid && job.remaining_due_amount > 0 && (
                         <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">Balance Due</span>
                       )}

                       {job.status !== 'completed' && job.status !== 'cancelled' && (() => {
                         const est = job.estimated_days || 7;
                         const act = job.days_active || 0;
                         if (act > est) {
                           return (
                             <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-red-500/10 text-rose-400 border border-red-500/20 animate-pulse">
                               🔴 Overdue ({act - est}d late)
                             </span>
                           );
                         } else if (est - act <= 1) {
                           return (
                             <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                               🟡 Due Soon
                             </span>
                           );
                         } else {
                           return (
                             <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                               🟢 On Track
                             </span>
                           );
                         }
                       })()}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-muted-foreground group-hover:text-foreground transition-colors">
                       <span className="text-xs font-bold text-muted-foreground/60 flex items-center gap-1.5">
                         <Clock size={12} /> {job.days_active} of {job.estimated_days || 7} Days Active
                       </span>
                       <span className="text-xs font-medium flex items-center gap-1">Open Job <ChevronRight size={14} /></span>
                    </div>
                 </motion.div>
               )
            })}
          </AnimatePresence>
          {filteredJobs?.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
               <p className="text-muted-foreground/60 font-bold">No jobs found matching the current criteria.</p>
            </div>
          )}
        </div>
      )}

      <CreateJobModal 
        isOpen={isCreateJobOpen}
        onClose={() => setIsCreateJobOpen(false)}
      />
    </div>
  );
};

export default MyJobs;
