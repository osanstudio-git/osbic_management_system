import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Briefcase, CheckCircle2, 
  ArrowUpRight, Bell,
  ChevronRight, Activity, Zap, AlertCircle, Building2, User
} from 'lucide-react';
import { useEmployeeJobs } from '../../hooks/shared/useJobs';
import { useAuth } from '../../contexts/AuthContext';
import { useProQueue } from '../../hooks/employee/useTimeline';
import Skeleton from '../../components/ui/Skeleton';
import { useNotifications } from '../../hooks/shared/useNotifications';
import { Clock } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import BranchOverviewDashboard from '../../components/employee/BranchOverviewDashboard';

const weeklyData = [
  { day: 'Mon', tasks: 3 },
  { day: 'Tue', tasks: 6 },
  { day: 'Wed', tasks: 4 },
  { day: 'Thu', tasks: 9 },
  { day: 'Fri', tasks: 7 },
  { day: 'Sat', tasks: 2 },
  { day: 'Sun', tasks: 5 },
];

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isManager = Boolean(profile?.is_manager);
  const [managerView, setManagerView] = useState<'branch' | 'personal'>('branch');

  const { data: jobs, isLoading: isJobsLoading } = useEmployeeJobs(profile?.id || '');
  const { data: proTasks, isLoading: isProLoading } = useProQueue(profile?.id || null);
  const [greeting, setGreeting] = useState('Good evening');
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const isLoading = isJobsLoading || isProLoading;

  // Mode switcher logic
  const canDoSales = profile?.can_do_sales ?? false;
  const canDoOps = profile?.can_do_ops ?? false;
  const isPro = profile?.is_pro ?? false;
  const showModeSwitcher = canDoSales && canDoOps && !isPro;
  const [mode, setMode] = useState<'sales' | 'ops' | 'pro'>('sales');

  useEffect(() => {
    if (profile) {
      if (isPro) {
        setMode('pro');
      } else if (canDoSales && canDoOps) {
        const saved = localStorage.getItem('employee_mode');
        setMode(saved === 'ops' ? 'ops' : 'sales');
      } else if (canDoOps) {
        setMode('ops');
      } else {
        setMode('sales');
        if (localStorage.getItem('employee_mode') === 'ops') {
          localStorage.setItem('employee_mode', 'sales');
        }
      }
    }
  }, [profile, canDoSales, canDoOps, isPro]);

  // Redirect accounts-only staff to their dedicated portal
  const isAccountsOnly = profile?.can_do_accounts && !profile?.is_manager && !profile?.can_do_ops && !profile?.can_do_sales && !profile?.is_pro;
  useEffect(() => {
    if (isAccountsOnly) {
      navigate('/employee/accounts', { replace: true });
    }
  }, [isAccountsOnly, navigate]);

  const handleModeChange = (newMode: 'sales' | 'ops' | 'pro') => {
    setMode(newMode);
    localStorage.setItem('employee_mode', newMode);
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const { useNotificationsList, useMarkRead } = useNotifications();
  const { data: notifications } = useNotificationsList();
  const markReadMutation = useMarkRead();

  const activeJobs = jobs?.filter(j => j.status !== 'completed' && j.status !== 'cancelled') || [];
  const completedToday = jobs?.filter(j => {
    if (j.status !== 'completed') return false;
    const completedDate = new Date(j.expected_completion).toDateString();
    return completedDate === new Date().toDateString();
  }).length || 0;

  // Ops Mode Stats
  const opsJobs = jobs?.filter(j => j.ops_employee_id === profile?.id) || [];
  const opsActiveJobs = opsJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
  const opsCompletedToday = opsJobs.filter(j => {
    if (j.status !== 'completed') return false;
    const completedDate = new Date(j.expected_completion || j.updated_at).toDateString();
    return completedDate === new Date().toDateString();
  }).length;
  const opsNeedsAttention = opsActiveJobs.filter(j => {
    if (!j.deadline) return false;
    return new Date(j.deadline).getTime() < new Date().getTime();
  }).length;

  // PRO Mode Stats
  const activeProTasks = (proTasks || []).filter(t => 
    t.acceptance_status === 'accepted' && 
    t.status !== 'completed' && 
    t.status !== 'cancelled'
  );
  const completedProTasks = (proTasks || []).filter(t => 
    t.status === 'completed' || t.status === 'gov_approved'
  );
  const completedTodayPro = completedProTasks.filter(t => {
    const dateStr = t.completed_at || t.government_approved_at;
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }).length;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const proChartData = days.map((day, idx) => {
    const count = completedProTasks.filter(t => {
      const dateStr = t.completed_at || t.government_approved_at;
      if (!dateStr) return false;
      return new Date(dateStr).getDay() === idx;
    }).length;
    return { day, tasks: count };
  });

  if (isLoading) {
    return (
      <div className="space-y-8 p-8 max-w-6xl mx-auto">
        <Skeleton height={100} rounded="xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton height={120} rounded="xl" />
          <Skeleton height={120} rounded="xl" />
          <Skeleton height={120} rounded="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 p-4 sm:p-8 max-w-6xl mx-auto">
      
      {/* ── Branch Manager View Switcher (for managers) ── */}
      {isManager && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-card border border-border rounded-2xl shadow-md">
          <div className="flex items-center gap-2 pl-2">
            <Building2 size={16} className="text-primary" />
            <span className="text-xs font-bold text-foreground">Workspace View</span>
          </div>
          <div className="flex bg-muted p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setManagerView('branch')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                managerView === 'branch'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Branch Command Center
            </button>
            <button
              onClick={() => setManagerView('personal')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                managerView === 'personal'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              My Personal Work
            </button>
          </div>
        </div>
      )}

      {isManager && managerView === 'branch' ? (
        <BranchOverviewDashboard />
      ) : (
        <>
      {/* ── Welcome Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
           <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2 flex items-center gap-2 flex-wrap">
             <span>{new Date().toLocaleDateString(isRtl ? 'ar-OM' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
             <span className="text-muted-foreground/30">•</span>
             <span className="text-primary font-bold">
               {mode === 'pro' ? (isRtl ? 'مساحة عمل المندوب (PRO)' : 'PRO Workspace') : mode === 'sales' ? (isRtl ? 'مساحة عمل المبيعات' : 'Sales Workspace') : (isRtl ? 'مساحة عمل العمليات' : 'Operations Workspace')}
             </span>
           </p>
           <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground tracking-tight">
             {greeting === 'Good morning' ? (isRtl ? 'صباح الخير' : 'Good morning') : 
              greeting === 'Good afternoon' ? (isRtl ? 'طاب يومك' : 'Good afternoon') : 
              (isRtl ? 'مساء الخير' : 'Good evening')}, <br className="sm:hidden" />
             <span className="text-primary">{profile?.full_name?.split(' ')[0] || (isRtl ? 'عضو' : 'Member')}</span>.
           </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap w-full md:w-auto font-sans">
          {showModeSwitcher && (
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border w-full sm:w-auto">
              <button
                onClick={() => handleModeChange('sales')}
                className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                  mode === 'sales' ? 'bg-primary text-[#0A0F1E]' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'نمط المبيعات' : 'Sales Mode'}
              </button>
              <button
                onClick={() => handleModeChange('ops')}
                className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                  mode === 'ops' ? 'bg-primary text-[#0A0F1E]' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'نمط العمليات' : 'Ops Mode'}
              </button>
            </div>
          )}

          {!isPro && (
            <button 
              onClick={() => navigate('/employee/my-jobs')}
              className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-widest hover:text-primary transition-colors pb-1 mt-2 sm:mt-0 w-full justify-between sm:w-auto sm:justify-start"
            >
              <span>{isRtl ? 'فتح سير العمل' : 'Open Workflow'}</span> 
              <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* ── Top Stats (Minimal Row) ── */}
      {mode === 'pro' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <Briefcase size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'مهام المندوب النشطة' : 'Active PRO Tasks'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{activeProTasks.length}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <CheckCircle2 size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'المنجزة الإجمالية' : 'Lifetime Completed'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{completedProTasks.length}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <CheckCircle2 size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'المكتملة اليوم' : 'Completed Today'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{completedTodayPro}</p>
              </div>
           </div>
        </div>
      ) : mode === 'sales' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <Briefcase size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'المشاريع النشطة' : 'Active Projects'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{activeJobs.length}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <CheckCircle2 size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'المنجزة اليوم' : 'Finalized Today'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{completedToday}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <Activity size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'القدرة الاستيعابية' : 'Assigned Capacity'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">85<span className="text-xl text-muted-foreground">%</span></p>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <Briefcase size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'مهام العمليات النشطة' : 'Active Ops Tasks'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{opsActiveJobs.length}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <AlertCircle size={16} className="text-rose-500/70" />
                 <p className="text-[10px] text-rose-500/70 font-bold uppercase tracking-widest">{isRtl ? 'تحتاج إلى اهتمام' : 'Needs Attention'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{opsNeedsAttention}</p>
              </div>
           </div>

           <div className="bg-transparent border border-border/60 rounded-xl p-5 flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                 <CheckCircle2 size={16} className="text-muted-foreground" />
                 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{isRtl ? 'اكتملت اليوم' : 'Completed Today'}</p>
              </div>
              <div className="flex items-baseline gap-2">
                 <p className="text-4xl font-bold text-foreground tracking-tighter">{opsCompletedToday}</p>
              </div>
           </div>
        </div>
      )}

      {/* ── Main Content Grid (Shared) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4">
        
        {/* Left Column: Flow Chart */}
        <div className="space-y-12">
           <div>
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                   <Activity size={14} className="text-primary" /> {isRtl ? 'تدفق الإنتاجية' : 'Productivity Flow'}
                 </h2>
                 <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{isRtl ? 'آخر ٧ أيام' : 'Last 7 Days'}</span>
              </div>
              <div className="h-[200px] sm:h-[140px] w-full -ml-2 sm:-ml-4 mt-6 sm:mt-0">
                 <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                   <AreaChart data={mode === 'pro' ? proChartData : weeklyData}>
                     <defs>
                       <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <Tooltip 
                       contentStyle={{ backgroundColor: 'rgba(20, 27, 50, 0.9)', borderColor: 'rgba(212, 175, 55, 0.2)', borderRadius: '12px', fontSize: '10px', backdropFilter: 'blur(8px)' }}
                       itemStyle={{ color: '#d4af37', fontWeight: 'bold' }}
                       labelStyle={{ color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                       cursor={{ stroke: '#d4af37', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.5 }}
                     />
                     <Area 
                       type="monotone" 
                       dataKey="tasks" 
                       stroke="#d4af37" 
                       strokeWidth={2}
                       fillOpacity={1} 
                       fill="url(#colorTasks)" 
                     />
                   </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* Right Column: Live Feed */}
        <div>
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                <Bell size={14} className="text-primary" /> {isRtl ? 'صندوق الوارد' : 'Inbox Feed'}
              </h2>
           </div>

           <div className="relative pl-4 border-l border-border/40 space-y-6">
              {notifications?.slice(0, 6).map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                     if (!notif.is_read) markReadMutation.mutate(notif.id);
                     if (notif.action_url) {
                        let url = notif.action_url;
                        if (url.startsWith('/employee/my-jobs/')) {
                           url = `/employee/tasks?jobId=${url.split('/').pop()}`;
                        }
                        navigate(url);
                     } else if (notif.job_id) {
                        navigate(`/employee/tasks?jobId=${notif.job_id}`);
                     }
                  }}
                  className="relative group cursor-pointer"
                >
                   <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ring-4 ring-background transition-colors ${!notif.is_read ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground'}`} />
                   
                   <div>
                     <div className="flex items-center justify-between mb-1">
                       <h4 className={`text-sm font-medium ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                         {isRtl ? (notif.title_ar || notif.title_en) : notif.title_en}
                       </h4>
                       <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                         {new Date(notif.created_at).toLocaleTimeString(isRtl ? 'ar-OM' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                       </span>
                     </div>
                     <p className="text-[13px] text-muted-foreground/80 leading-relaxed pr-4">
                       {isRtl ? (notif.body_ar || notif.body_en) : notif.body_en}
                     </p>
                   </div>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <p className="text-sm text-muted-foreground italic py-4">{isRtl ? 'ليس لديك تنبيهات جديدة.' : 'You have no new alerts.'}</p>
              )}
           </div>
        </div>
      </div>

      {mode === 'pro' && (
        <div className="space-y-6 pt-8 border-t border-border/40 font-sans">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
              <Briefcase size={14} className="text-primary" /> {isRtl ? 'مهام المندوب النشطة' : 'Active PRO Tasks'}
            </h2>
          </div>

          {activeProTasks.length > 0 ? (
            <div className="overflow-x-auto bg-card border border-border rounded-2xl w-full">
              <table className="w-full text-left border-collapse whitespace-nowrap" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-right">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'رمز الوظيفة' : 'Job Code'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'اسم العميل' : 'Client Name'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'اسم الخدمة' : 'Service Name'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProTasks.map((task) => (
                    <tr 
                      key={task.id} 
                      onClick={() => navigate(`/employee/pro-queue`)}
                      className="border-b border-border/40 hover:bg-muted/10 transition-colors cursor-pointer text-start"
                    >
                      <td className="p-4 text-sm font-mono font-bold text-primary">{task.job?.job_code || 'N/A'}</td>
                      <td className="p-4 text-sm text-foreground font-medium">{task.job?.client?.full_name || 'N/A'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{task.service_name}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                          {isRtl ? 'نشط' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-3xl bg-muted/5 text-center px-6">
              <Briefcase size={36} className="text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground font-medium">{isRtl ? 'لا توجد مهام مندوب نشطة' : 'No active PRO tasks assigned yet'}</p>
            </div>
          )}
        </div>
      )}

      {mode === 'ops' && (
        <div className="space-y-6 pt-8 border-t border-border/40 font-sans">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
              <Briefcase size={14} className="text-primary" /> {isRtl ? 'وظائف العمليات المسندة' : 'Assigned Operations Jobs'}
            </h2>
          </div>

          {jobs?.filter(j => j.ops_employee_id === profile?.id).length > 0 ? (
            <div className="overflow-x-auto bg-card border border-border rounded-2xl w-full">
              <table className="w-full text-left border-collapse whitespace-nowrap" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-right">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'رمز الوظيفة' : 'Job Code'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'اسم العميل' : 'Client Name'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'اسم الخدمة' : 'Service Name'}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs
                    .filter(j => j.ops_employee_id === profile?.id)
                    .map((job) => (
                      <tr 
                        key={job.id} 
                        onClick={() => navigate(`/employee/tasks?jobId=${job.id}`)}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors cursor-pointer text-start"
                      >
                        <td className="p-4 text-sm font-mono font-bold text-primary">{job.job_code}</td>
                        <td className="p-4 text-sm text-foreground font-medium">{job.client_name}</td>
                        <td className="p-4 text-sm text-muted-foreground">{job.service_name}</td>
                        <td className="p-4 text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            job.status === 'active' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : job.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {job.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : job.status === 'active' ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معلق' : job.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-3xl bg-muted/5 text-center px-6">
              <Briefcase size={36} className="text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground font-medium">{isRtl ? 'لم يتم تعيين وظائف عمليات لك بعد' : 'No operations jobs assigned to you yet'}</p>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default EmployeeDashboard;
