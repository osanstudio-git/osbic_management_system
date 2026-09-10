import React, { useState } from 'react';
import { TaskDashboard } from './TaskDashboard';
import { ChevronRight, LayoutGrid, List as ListIcon, Clock, CheckCircle2, Briefcase, Plus, Zap, Search, Filter, X, ArrowUpDown, RotateCcw, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface TaskListViewProps {
  jobs: any[];
  activeFilter: 'all' | 'self' | 'manager' | 'coworker';
  onFilterChange: (filter: 'all' | 'self' | 'manager' | 'coworker') => void;
  profileId: string;
  onTaskSelect: (jobId: string) => void;
  onViewToggle: (mode: 'split' | 'list') => void;
  currentMode: 'split' | 'list';
  onNewTask: () => void;
  onWalkIn: () => void;
  jobTypeFilter: 'standard' | 'quick';
  onJobTypeChange: (type: 'standard' | 'quick') => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({ 
  jobs, 
  activeFilter, 
  onFilterChange, 
  profileId, 
  onTaskSelect,
  onViewToggle,
  currentMode,
  onNewTask,
  onWalkIn,
  jobTypeFilter,
  onJobTypeChange
}) => {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'awaiting_govt' | 'completed' | 'on_hold'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'fee_desc'>('newest');

  const acceptJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'active' })
        .eq('id', jobId);
      if (error) throw error;
      
      await supabase
        .from('job_steps')
        .update({ status: 'in_progress' })
        .eq('job_id', jobId)
        .eq('assigned_to', profileId)
        .eq('status', 'pending');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      toast.success('Task accepted and moved to active workload!');
    }
  });

  const pendingJobs = jobs?.filter(job => job.status === 'pending' && job.assigned_by !== profileId) || [];

  // Extract unique services dynamically
  const availableServices = Array.from(new Set(jobs?.map(j => j.service_name).filter(Boolean) || []));

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || serviceFilter !== 'all' || paymentFilter !== 'all' || sortBy !== 'newest';

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setServiceFilter('all');
    setPaymentFilter('all');
    setSortBy('newest');
  };

  const getClientName = (job: any) => {
    if (job.service_name === 'Quick Task (POS)' && job.notes) {
      const match = job.notes.match(/Walk-in Name:\s*(.*?)\s*\|/);
      if (match && match[1] && match[1] !== 'Anonymous') {
        return match[1];
      }
    }
    return job.client_name || 'Client';
  };

  // Base filter by assignment tab (All / Self / Manager / Coworker)
  let filteredJobs = (jobs || []).filter(job => !(job.status === 'pending' && job.assigned_by !== profileId));
  if (activeFilter === 'self') {
    filteredJobs = jobs.filter(j => j.assigned_by === profileId);
  } else if (activeFilter === 'manager') {
    filteredJobs = jobs.filter(j => j.assigned_by_role === 'admin' || j.assigned_by_role === 'manager');
  } else if (activeFilter === 'coworker') {
    filteredJobs = jobs.filter(j => j.assigned_by !== profileId && j.assigned_by_role === 'employee');
  }

  // 1. Filter by Status Dropdown
  if (statusFilter !== 'all') {
    if (statusFilter === 'active') filteredJobs = filteredJobs.filter(j => j.status === 'active' || j.status === 'in_progress' || j.status === 'pending');
    else if (statusFilter === 'awaiting_govt') filteredJobs = filteredJobs.filter(j => j.status === 'awaiting_govt');
    else if (statusFilter === 'completed') filteredJobs = filteredJobs.filter(j => j.status === 'completed');
    else if (statusFilter === 'on_hold') filteredJobs = filteredJobs.filter(j => j.status === 'on_hold');
  }

  // 2. Filter by Service Dropdown
  if (serviceFilter !== 'all') {
    filteredJobs = filteredJobs.filter(j => j.service_name === serviceFilter);
  }

  // 3. Filter by Payment Status
  if (paymentFilter === 'paid') {
    filteredJobs = filteredJobs.filter(j => j.remaining_paid === true || j.total_fee === 0);
  } else if (paymentFilter === 'pending') {
    filteredJobs = filteredJobs.filter(j => !j.remaining_paid && j.total_fee > 0);
  }

  // 4. Filter by Multi-Field Search Query (Client Name, Service Name, Job Code)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredJobs = filteredJobs.filter(j => {
      const clientName = getClientName(j).toLowerCase();
      const serviceName = (j.service_name || '').toLowerCase();
      const jobCode = (j.job_code || '').toLowerCase();
      return clientName.includes(q) || serviceName.includes(q) || jobCode.includes(q);
    });
  }

  // 5. Sorting
  filteredJobs.sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.started_date || b.created_at || 0).getTime() - new Date(a.started_date || a.created_at || 0).getTime();
    if (sortBy === 'oldest') return new Date(a.started_date || a.created_at || 0).getTime() - new Date(b.started_date || b.created_at || 0).getTime();
    if (sortBy === 'fee_desc') return (b.total_fee || 0) - (a.total_fee || 0);
    return 0;
  });

  const quickTasks = filteredJobs.filter(j => j.service_name === 'Quick Task (POS)' || j.entry_type === 'walkin');
  const standardTasks = filteredJobs.filter(j => j.service_name !== 'Quick Task (POS)' && j.entry_type !== 'walkin');
  
  const displayJobs = jobTypeFilter === 'quick' ? quickTasks : standardTasks;

  const renderJobRow = (job: any, isQuick: boolean) => (
    <tr 
      key={job.id} 
      onClick={() => onTaskSelect(job.id)}
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group text-start font-sans"
    >
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isQuick ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
             {isQuick ? <Zap size={18} /> : <Briefcase size={18} />}
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{getClientName(job)}</div>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${isQuick ? 'text-amber-500' : 'text-muted-foreground'}`}>{job.job_code}</div>
          </div>
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="text-sm text-foreground">{job.service_name}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{job.service_category}</div>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${
            job.status === 'completed' ? 'bg-emerald-500' :
            job.status === 'active' || job.status === 'in_progress' ? 'bg-primary' :
            job.status === 'draft' ? 'bg-amber-500' : 'bg-muted-foreground'
          }`} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {job.status === 'completed' ? (isRtl ? 'مكتمل' : 'completed') :
             job.status === 'active' || job.status === 'in_progress' ? (isRtl ? 'نشط' : 'active') :
             job.status === 'draft' ? (isRtl ? 'مسودة' : 'draft') : (isRtl ? 'معلق' : job.status)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {isRtl ? `${job.completed_steps} من أصل ${job.total_steps} خطوات` : `${job.completed_steps} of ${job.total_steps} steps`}
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="text-sm font-bold text-foreground">
          {isRtl ? `${(job.total_fee || 0).toFixed(3)} ر.ع.` : `${(job.total_fee || 0).toFixed(3)} OMR`}
        </div>
        {job.remaining_paid || job.total_fee === 0 ? (
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1 mt-1">
            <CheckCircle2 size={12} /> {isRtl ? 'مدفوع بالكامل' : 'Fully Paid'}
          </div>
        ) : (
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1 mt-1">
            <Clock size={12} /> {isRtl ? 'مستحق:' : 'Pending:'} {job.remaining_paid ? 0 : (job.remaining_due_amount > 0 ? job.remaining_due_amount : job.total_fee).toFixed(3)} {isRtl ? 'ر.ع.' : 'OMR'}
          </div>
        )}
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Clock size={12} />
          {format(new Date(job.started_date), isRtl ? 'yyyy/MM/dd' : 'MMM dd, yyyy')}
        </div>
      </td>
      <td className="py-4 px-6 text-right">
        <ChevronRight size={18} className={`text-muted-foreground group-hover:text-primary transition-colors ml-auto ${isRtl ? 'rotate-180' : ''}`} />
      </td>
    </tr>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background no-scrollbar" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h2 className="text-xl md:text-2xl font-syne font-bold text-foreground whitespace-nowrap">{isRtl ? 'إدارة المهام' : 'Task Management'}</h2>
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar w-full md:w-auto font-sans">
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border mr-0 md:mr-4 shrink-0">
              <button 
                onClick={() => onJobTypeChange('standard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 transition-all ${jobTypeFilter === 'standard' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Briefcase size={14} /> {isRtl ? 'الاعتيادية' : 'Standard'}
              </button>
              <button 
                onClick={() => onJobTypeChange('quick')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 transition-all ${jobTypeFilter === 'quick' ? 'bg-card shadow-sm text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Zap size={14} /> {isRtl ? 'حضور مباشر' : 'Walk-in'}
              </button>
            </div>
            
            <button 
              onClick={onWalkIn}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-emerald-950 font-bold text-[10px] md:text-xs tracking-widest whitespace-nowrap shrink-0 uppercase rounded-xl hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
            >
              <Users size={16} /> {isRtl ? 'تسجيل سريع' : 'Walk-in'}
            </button>
            <button 
              onClick={onNewTask}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-[10px] md:text-xs tracking-widest whitespace-nowrap shrink-0 uppercase rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Plus size={16} /> {isRtl ? 'مهمة جديدة' : 'New Task'}
            </button>
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border shrink-0">
              <button 
                onClick={() => onViewToggle('split')}
                className={`p-1.5 rounded-lg transition-all ${currentMode === 'split' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => onViewToggle('list')}
                className={`p-1.5 rounded-lg transition-all ${currentMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Pending Acceptance Tray */}
        {pendingJobs.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.05)]">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
             <h2 className="text-sm font-syne font-bold text-foreground flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {isRtl ? `في انتظار القبول (${pendingJobs.length})` : `Pending Acceptance (${pendingJobs.length})`}
             </h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
               {pendingJobs.map(job => (
                 <div key={job.id} className="bg-card border border-primary/20 rounded-xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                       <h3 className="text-sm font-bold text-foreground">{job.client_name}</h3>
                       <p className="text-xs text-muted-foreground">{job.service_name}</p>
                       <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest mt-1">
                         {isRtl ? 'مسند بواسطة:' : 'Assigned by:'} {job.assigned_by_role === 'employee' ? (isRtl ? 'موظف' : 'employee') : (isRtl ? 'مشرف' : job.assigned_by_role)}
                       </p>
                    </div>
                    <button
                      onClick={() => acceptJobMutation.mutate(job.id)}
                      disabled={acceptJobMutation.isPending}
                      className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:bg-gold transition-all disabled:opacity-50"
                    >
                      {isRtl ? 'قبول المهمة' : 'Accept Task'}
                    </button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* The Dashboard fits perfectly here in a full-width view */}
        <TaskDashboard 
          jobs={jobs} 
          activeFilter={activeFilter} 
          onFilterChange={onFilterChange} 
          profileId={profileId} 
        />

        {/* Single-Line Search & Multi-Filter Control Bar */}
        <div className="bg-card border border-border p-3 rounded-2xl shadow-sm mt-6 mb-4 flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Left Section: Expanded Search Input */}
          <div className="w-full md:flex-1 relative min-w-[220px]">
            <Search size={15} className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <input 
              type="text" 
              placeholder={isRtl ? 'البحث عن اسم العميل أو الخدمة أو رمز المهمة...' : 'Search Client Name, Service, or Task ID...'} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-background border border-border outline-none ${isRtl ? 'pr-9 pl-8' : 'pl-9 pr-8'} py-2 rounded-xl text-foreground placeholder:text-muted-foreground/60 text-xs focus:border-primary transition-all`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1`}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right Section: Single Horizontal Row of Compact Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end text-xs font-sans">
            
            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'الحالة:' : 'Status:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
              >
                <option value="all" className="bg-card text-foreground py-1">{isRtl ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="active" className="bg-card text-foreground py-1">{isRtl ? 'المهام النشطة' : 'Active Workload'}</option>
                <option value="awaiting_govt" className="bg-card text-foreground py-1">{isRtl ? 'بانتظار الجهات الحكومية' : 'Awaiting Govt'}</option>
                <option value="completed" className="bg-card text-foreground py-1">{isRtl ? 'مكتملة' : 'Completed'}</option>
                <option value="on_hold" className="bg-card text-foreground py-1">{isRtl ? 'قيد الانتظار' : 'On Hold'}</option>
              </select>
            </div>

            {/* Service Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
              <Filter size={13} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'الخدمة:' : 'Service:'}</span>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer max-w-[140px] truncate"
              >
                <option value="all" className="bg-card text-foreground py-1">{isRtl ? 'جميع الخدمات' : 'All Services'}</option>
                {availableServices.map((svc, i) => (
                  <option key={i} value={svc} className="bg-card text-foreground py-1">{svc}</option>
                ))}
              </select>
            </div>

            {/* Payment Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'الدفع:' : 'Payment:'}</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
              >
                <option value="all" className="bg-card text-foreground py-1">{isRtl ? 'جميع الدفعات' : 'All Payments'}</option>
                <option value="paid" className="bg-card text-foreground py-1">{isRtl ? 'مدفوع بالكامل' : 'Fully Paid'}</option>
                <option value="pending" className="bg-card text-foreground py-1">{isRtl ? 'دفع معلق' : 'Pending Payment'}</option>
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5">
              <ArrowUpDown size={13} className="text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{isRtl ? 'الترتيب:' : 'Sort:'}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none outline-none text-xs text-foreground font-medium cursor-pointer"
              >
                <option value="newest" className="bg-card text-foreground py-1">{isRtl ? 'الأحدث أولاً' : 'Newest First'}</option>
                <option value="oldest" className="bg-card text-foreground py-1">{isRtl ? 'الأقدم أولاً' : 'Oldest First'}</option>
                <option value="fee_desc" className="bg-card text-foreground py-1">{isRtl ? 'الأعلى رسوماً' : 'Highest Fee'}</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button 
                onClick={resetAllFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
              >
                <RotateCcw size={13} /> {isRtl ? 'إعادة ضبط' : 'Reset'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm mt-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="border-b border-border bg-muted/20 text-right">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'العميل ورمز المهمة' : 'Client & Task ID'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'الخدمة' : 'Service'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'الحالة والتقدم' : 'Status & Progress'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'المالية' : 'Financials'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-start">{isRtl ? 'تاريخ البدء' : 'Start Date'}</th>
                  <th className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${isRtl ? 'text-left' : 'text-right'}`}>{isRtl ? 'الإجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {displayJobs.map((job) => renderJobRow(job, jobTypeFilter === 'quick'))}
                
                {displayJobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                      {isRtl 
                        ? `لم يتم العثور على ${jobTypeFilter === 'quick' ? 'مهام سريعة' : 'مهام اعتيادية'} تطابق بحثك.` 
                        : `No ${jobTypeFilter === 'quick' ? 'Quick Tasks' : 'Standard Jobs'} found matching your filter.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
