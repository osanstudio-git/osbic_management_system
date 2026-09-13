import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Edit3, Key, Ban, Mail, Phone, Calendar,
  Clock, CheckCircle, TrendingUp,
  FileText, Activity, UserCheck, AlertCircle, Trash2, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  useAdminEmployee,
  useUpdateEmployee,
  useToggleEmployeeStatus,
  useDeleteEmployee,
  useEmployeeActivity
} from '../../hooks/admin/useAdminEmployees';
import EditEmployeeSlideOver from '../../components/admin/EditEmployeeSlideOver';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import ConfirmStatusModal from '../../components/admin/ConfirmStatusModal';
import DeleteEmployeeModal from '../../components/admin/DeleteEmployeeModal';
import Skeleton from '../../components/ui/Skeleton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const { data: employee, isLoading } = useAdminEmployee(id);
  const { data: activityLogs } = useEmployeeActivity(id!);
  const { mutate: toggleStatus, isPending: isToggling } = useToggleEmployeeStatus();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: deleteEmployee, isPending: isDeleting } = useDeleteEmployee();

  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'performance' | 'audit'>('active');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton height={40} width={200} rounded="lg" />
        <Skeleton height={200} rounded="xl" />
        <Skeleton height={400} rounded="xl" />
      </div>
    );
  }

  if (!employee) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-20 h-20 bg-red-400/10 rounded-3xl flex items-center justify-center text-red-400 mb-6">
        <AlertCircle size={40} />
      </div>
      <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Employee Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">The employee you are looking for might have been removed or the ID is incorrect.</p>
      <Link to="/admin/employees" className="flex items-center gap-2 bg-muted/50 border border-border px-6 py-3 rounded-xl text-foreground font-bold hover:bg-muted/50 transition-all">
        <ChevronLeft size={20} />
        <span>Back to Employees</span>
      </Link>
    </div>
  );

  const emp = employee as any;
  const isEmployeeActive = emp.is_active !== false;
  const jobs = emp.jobs || [];
  const activeJobsList = jobs.filter((j: any) => j.status === 'active');
  const completedJobsList = jobs.filter((j: any) => j.status === 'completed');

  const handleConfirmStatus = () => {
    const newStatus = !isEmployeeActive;
    toggleStatus({ id: emp.id, is_active: newStatus }, {
      onSuccess: () => {
        toast.success(`Employee ${newStatus ? 'activated' : 'deactivated'} successfully`);
        setIsStatusOpen(false);
      }
    });
  };

  const handleConfirmReset = () => {
    // This is no longer used by the modal since it handles its own submit
  };

  const handleConfirmDelete = () => {
    if (emp.id) {
      deleteEmployee(emp.id, {
        onSuccess: () => {
          setIsDeleteOpen(false);
          navigate('/admin/employees');
        }
      });
    }
  };

  const tabs = [
    { id: 'active', label: 'Active Jobs', icon: Clock, count: emp.active_jobs || 0 },
    { id: 'completed', label: 'Completed Jobs', icon: CheckCircle, count: emp.total_jobs || 0 },
    { id: 'performance', label: 'Performance Analytics', icon: TrendingUp },
    { id: 'audit', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Navigation */}
      <div className="flex items-center gap-3">
        <Link to="/admin/employees" className="p-2 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="text-sm">
          <Link to="/admin/employees" className="text-muted-foreground hover:text-foreground transition-colors">Employees</Link>
          <span className="text-muted-foreground/60 mx-2">/</span>
          <span className="text-foreground font-medium">{emp.full_name}</span>
        </div>
      </div>

      {/* Top Profile Card */}
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        <div className="flex flex-col md:flex-row gap-8 relative z-10">
          {/* Avatar side */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-primary/5 border border-gold/10 flex items-center justify-center text-4xl font-syne font-bold text-primary overflow-hidden relative group shadow-inner">
                {emp.avatar_url ? (
                  <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{emp.full_name?.[0]}</span>
                )}
                <div
                  onClick={() => setIsEditOpen(true)}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-md"
                >
                  <div className="bg-white/10 p-2 rounded-full border border-white/20">
                    <Edit3 size={20} className="text-foreground" />
                  </div>
                </div>
              </div>
              <div className={cn(
                "absolute -bottom-2 -right-2 w-8 h-8 border-4 border-card rounded-full z-10",
                isEmployeeActive === false ? 'bg-red-500' : (emp.availability_status === 'available' ? 'bg-emerald-500' : 'bg-amber-500')
              )} />
            </div>
            <div className={cn(
              "px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border",
              isEmployeeActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
            )}>
              {isEmployeeActive ? 'Active Account' : 'Inactive Account'}
            </div>
          </div>

          {/* Info side */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-syne font-bold text-foreground mb-2">{emp.full_name}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-muted-foreground font-mono tracking-widest text-xs uppercase bg-muted/50 px-2 py-1 rounded inline-block">{emp.employee_code}</p>

                  {emp.is_manager && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">Manager</span>}
                  {emp.can_do_sales && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Sales</span>}
                  {emp.can_do_marketing && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pink-500/10 text-pink-400 border border-pink-500/20">Marketing</span>}
                  {emp.can_do_ops && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Operations</span>}
                  {emp.can_do_accounts && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Accounts</span>}
                  {emp.is_pro && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">PRO</span>}

                  <div className="relative">
                    <select
                      value={emp.department || 'operations'}
                      onChange={(e) => {
                        const newDept = e.target.value as 'sales' | 'operations' | 'pro' | 'accounts' | 'marketing';
                        const extraUpdates = newDept === 'sales'
                          ? { can_do_sales: true, can_do_marketing: false, can_do_ops: false, can_do_accounts: false, is_pro: false }
                          : newDept === 'marketing'
                            ? { can_do_marketing: true, can_do_sales: false, can_do_ops: false, can_do_accounts: false, is_pro: false }
                            : newDept === 'pro'
                              ? { is_pro: true, can_do_sales: false, can_do_marketing: false, can_do_ops: false, can_do_accounts: false }
                              : newDept === 'accounts'
                                ? { can_do_accounts: true, can_do_sales: false, can_do_marketing: false, can_do_ops: false, is_pro: false }
                                : { can_do_ops: true, can_do_sales: false, can_do_marketing: false, can_do_accounts: false, is_pro: false };
                        
                        updateEmployee({
                          id: emp.id,
                          updates: { 
                            department: newDept,
                            ...extraUpdates
                          }
                        }, {
                          onSuccess: () => toast.success('Department & permissions updated')
                        });
                      }}
                      disabled={isUpdating}
                      className={cn(
                        "appearance-none text-xs font-bold uppercase tracking-widest px-3 py-1 rounded border outline-none cursor-pointer transition-all pr-8",
                        emp.department === 'sales'
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                          : emp.department === 'marketing'
                            ? "bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20"
                            : emp.department === 'pro'
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                              : emp.department === 'accounts'
                                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
                        isUpdating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <option value="operations" className="bg-[#131824] text-foreground">Operations Team</option>
                      <option value="sales" className="bg-[#131824] text-foreground">Sales Executive</option>
                      <option value="marketing" className="bg-[#131824] text-foreground">Marketing Specialist</option>
                      <option value="accounts" className="bg-[#131824] text-foreground">Accounts Team</option>
                      <option value="pro" className="bg-[#131824] text-foreground">PRO Agent</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 mt-6">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Mail size={14} />
                    </div>
                    {emp.email}
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Phone size={14} />
                    </div>
                    {emp.phone || 'No phone'}
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground group">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Calendar size={14} />
                    </div>
                    Joined {new Date(emp.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground font-bold hover:bg-muted/50 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Edit3 size={14} /> <span>Edit</span>
                </button>
                <button
                  onClick={() => setIsResetOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Key size={14} /> <span>Reset</span>
                </button>
                <button
                  onClick={() => setIsStatusOpen(true)}
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2.5 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-lg",
                    isEmployeeActive
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-[#0A0F1E] shadow-amber-500/5"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-[#0A0F1E] shadow-emerald-500/5"
                  )}
                >
                  {isEmployeeActive ? <Ban size={14} /> : <UserCheck size={14} />}
                  <span>{isEmployeeActive ? 'Deactivate' : 'Activate'}</span>
                </button>
                <button
                  onClick={() => setIsDeleteOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold hover:bg-red-500 hover:text-foreground transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Trash2 size={14} /> <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-border">
              <div className="p-4 rounded-2xl bg-muted/50 border border-border hover:border-gold/20 transition-all group">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1 group-hover:text-primary transition-colors">Total Jobs</p>
                <p className="text-3xl font-mono font-bold text-foreground">{emp.total_jobs || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 border border-border hover:border-accent/20 transition-all group">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1 group-hover:text-accent transition-colors">Active Now</p>
                <p className="text-3xl font-mono font-bold text-accent">{emp.active_jobs || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 border border-border hover:border-white/20 transition-all group">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Completed (Mo)</p>
                <p className="text-3xl font-mono font-bold text-foreground">{emp.completed_month || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 border border-border hover:border-white/20 transition-all group">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Avg Completion</p>
                <p className="text-3xl font-mono font-bold text-foreground">{emp.avg_completion_days || 0} <span className="text-sm font-normal text-muted-foreground/60">days</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-5 border-b-2 text-sm font-bold transition-all whitespace-nowrap relative",
              activeTab === tab.id
                ? "border-gold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm border",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border-gold/20"
                  : "bg-muted/50 text-muted-foreground/60 border-border"
              )}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(251,191,36,0.5)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-card border border-border rounded-3xl p-8 shadow-2xl min-h-[500px] relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-gold/20 via-transparent to-transparent opacity-30" />

        {activeTab === 'active' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-syne font-bold text-foreground flex items-center gap-3">
                <Clock className="text-primary" size={24} />
                Currently Processing ({activeJobsList.length})
              </h3>
            </div>

            {activeJobsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeJobsList.map((job: any) => (
                  <Link key={job.id} to={`/admin/jobs/${job.id}`} className="group p-4 rounded-2xl bg-muted/30 border border-border hover:border-gold/30 hover:bg-muted/50 transition-all flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-primary font-bold mb-0.5">{job.job_code}</p>
                      <p className="text-sm font-bold text-foreground truncate">{isRtl ? job.service?.name_ar : job.service?.name_en}</p>
                      <p className="text-[10px] text-muted-foreground truncate">Client: {job.client?.full_name}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-black/20 border border-border rounded-3xl text-center px-6">
                <div className="w-20 h-20 bg-muted/50 rounded-3xl flex items-center justify-center text-[#222B45] mb-6 relative">
                  <FileText size={40} className="opacity-20" />
                </div>
                <h4 className="text-foreground font-bold mb-2">No active jobs found</h4>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-6">
            <h3 className="text-xl font-syne font-bold text-foreground flex items-center gap-3">
              <CheckCircle className="text-emerald-400" size={24} />
              Historical Jobs History ({completedJobsList.length})
            </h3>

            {completedJobsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedJobsList.map((job: any) => (
                  <Link key={job.id} to={`/admin/jobs/${job.id}`} className="group p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                      <CheckCircle size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-emerald-400 font-bold mb-0.5">{job.job_code}</p>
                      <p className="text-sm font-bold text-foreground truncate">{isRtl ? job.service?.name_ar : job.service?.name_en}</p>
                      <p className="text-[10px] text-muted-foreground">Finished {new Date(job.completed_at).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground/30" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-black/20 border border-border rounded-3xl text-center px-6">
                <CheckCircle size={40} className="text-[#222B45] opacity-20 mb-6" />
                <h4 className="text-foreground font-bold mb-2">No completed records</h4>
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <h3 className="text-xl font-syne font-bold text-foreground flex items-center gap-3">
              <TrendingUp className="text-accent" size={24} />
              Efficiency Analytics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-muted/30 border border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Delivery Speed</p>
                <p className="text-4xl font-mono font-bold text-foreground mb-1">{emp.avg_completion_days} <span className="text-sm font-normal text-muted-foreground/60">Days</span></p>
                <p className="text-[10px] text-emerald-500 font-bold">Standard target: 5 Days</p>
              </div>
              <div className="p-6 rounded-3xl bg-muted/30 border border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">CSAT Rating</p>
                <p className="text-4xl font-mono font-bold text-amber-400 mb-1 flex items-baseline gap-1">
                  ★ {emp.avg_rating || '—'}
                  <span className="text-xs font-normal text-muted-foreground/60">/ 5.0</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-bold">Based on client feedback</p>
              </div>
              <div className="p-6 rounded-3xl bg-primary/5 border border-gold/20">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Trust Level</p>
                {(() => {
                  const speedDays = emp.avg_completion_days;
                  const speedScore = speedDays === 0 ? 100 :
                                     speedDays <= 5 ? 100 :
                                     speedDays === 6 ? 90 :
                                     speedDays === 7 ? 80 :
                                     speedDays === 8 ? 70 :
                                     speedDays === 9 ? 60 : 50;
                  
                  const csatScore = emp.avg_rating ? (emp.avg_rating * 20) : speedScore;
                  const trustPct = Math.round((speedScore * 0.6) + (csatScore * 0.4));
                  
                  const level = trustPct >= 95 ? 'Excellent' :
                                trustPct >= 85 ? 'Good' :
                                trustPct >= 75 ? 'Satisfactory' : 'Needs Action';
                  
                  return (
                    <>
                      <p className="text-4xl font-syne font-bold text-foreground mb-1">{level}</p>
                      <p className="text-[10px] text-primary/60 font-bold">{trustPct}% On-Time & Quality Rating</p>
                    </>
                  );
                })()}
              </div>
            </div>

            {(() => {
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              
              if (emp.can_do_sales) {
                // Aggregate monthly leads vs converted
                const monthlyLeads: Record<string, { assigned: number; converted: number }> = {};
                
                // Initialize last 6 months
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  monthlyLeads[monthNames[d.getMonth()]] = { assigned: 0, converted: 0 };
                }

                (emp.leads || []).forEach((lead: any) => {
                  const date = new Date(lead.created_at);
                  const monthKey = monthNames[date.getMonth()];
                  if (monthlyLeads[monthKey] !== undefined) {
                    monthlyLeads[monthKey].assigned += 1;
                    if (lead.status === 'converted') {
                      monthlyLeads[monthKey].converted += 1;
                    }
                  }
                });

                const chartData = Object.entries(monthlyLeads).map(([name, values]) => ({
                  name,
                  ...values
                }));

                return (
                  <div className="bg-card border border-border p-6 rounded-3xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Leads Allocation vs. Conversion Trend</h4>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Assigned monthly pipeline volume compared against converted client files</p>
                    </div>
                    <div className="h-[250px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                          <YAxis stroke="#94A3B8" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#131824', borderColor: '#1E293B', borderRadius: '12px' }}
                            labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                          />
                          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10, textTransform: 'uppercase', paddingBottom: 15 }} />
                          <Bar dataKey="assigned" name="Assigned Leads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="converted" name="Converted Leads" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              } else {
                // Aggregate monthly jobs completed
                const monthlyJobs: Record<string, { completed: number }> = {};
                
                // Initialize last 6 months
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  monthlyJobs[monthNames[d.getMonth()]] = { completed: 0 };
                }

                (emp.jobs || []).forEach((job: any) => {
                  if (job.status === 'completed' && job.completed_at) {
                    const date = new Date(job.completed_at);
                    const monthKey = monthNames[date.getMonth()];
                    if (monthlyJobs[monthKey] !== undefined) {
                      monthlyJobs[monthKey].completed += 1;
                    }
                  }
                });

                const chartData = Object.entries(monthlyJobs).map(([name, values]) => ({
                  name,
                  ...values
                }));

                return (
                  <div className="bg-card border border-border p-6 rounded-3xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Jobs Fulfillment Trend</h4>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Fulfillment volume tracks total operations finalized by month</p>
                    </div>
                    <div className="h-[250px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                          <YAxis stroke="#94A3B8" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#131824', borderColor: '#1E293B', borderRadius: '12px' }}
                            labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                          />
                          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10, textTransform: 'uppercase', paddingBottom: 15 }} />
                          <Bar dataKey="completed" name="Completed Jobs" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Customer Reviews Feed */}
            <div className="bg-card border border-border p-6 rounded-3xl space-y-4">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Client Reviews & CSAT Feed</h4>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Real-time ratings and feedback collected from completed client jobs</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {(() => {
                  const reviewedJobs = (emp.jobs || []).filter((j: any) => j.client_rating || j.client_feedback);
                  
                  if (reviewedJobs.length === 0) {
                    return <p className="text-xs text-muted-foreground italic text-center py-6">No client reviews submitted for this employee yet.</p>;
                  }

                  return reviewedJobs.map((job: any) => (
                    <div key={job.id} className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[9px] text-primary font-mono font-bold uppercase">{job.job_code}</span>
                          <h5 className="text-xs font-bold text-foreground mt-0.5">{job.client?.full_name || 'Client'}</h5>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < (job.client_rating || 0) ? 'text-amber-400 text-xs' : 'text-muted-foreground/20 text-xs'}>
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      {job.client_feedback && (
                        <p className="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-xl border border-border/20">
                          "{job.client_feedback}"
                        </p>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Sales & CRM Analytics */}
            {emp.can_do_sales && (
              <div className="mt-8 pt-8 border-t border-border space-y-6">
                <h3 className="text-xl font-syne font-bold text-foreground flex items-center gap-3">
                  <TrendingUp className="text-primary" size={24} />
                  Sales & CRM Performance
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-3xl bg-muted/30 border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Total Leads Assigned</p>
                    <p className="text-4xl font-mono font-bold text-foreground mb-1">
                      {emp.leads?.length || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-bold">Total pipeline allocation</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-muted/30 border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Leads Converted</p>
                    <p className="text-4xl font-mono font-bold text-emerald-500 mb-1">
                      {emp.leads?.filter((l: any) => l.status === 'converted').length || 0}
                    </p>
                    <p className="text-[10px] text-emerald-500/60 font-bold">Successfully converted to jobs</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-primary/5 border border-gold/20">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Sales Conversion Rate</p>
                    <p className="text-4xl font-mono font-bold text-primary mb-1">
                      {emp.leads?.length > 0 
                        ? Math.round((emp.leads.filter((l: any) => l.status === 'converted').length / emp.leads.length) * 100)
                        : 0}%
                    </p>
                    <p className="text-[10px] text-primary/60 font-bold">Pipeline closure efficiency</p>
                  </div>
                </div>

                {/* Leads List Table */}
                <div className="bg-black/20 border border-border rounded-3xl overflow-hidden mt-6">
                  <div className="p-5 border-b border-border bg-white/[0.01]">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assigned Leads History</h4>
                  </div>
                  {emp.leads && emp.leads.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-white/[0.01]">
                            <th className="p-4">Lead Code</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Source</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-xs">
                          {emp.leads.map((lead: any) => (
                            <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="p-4 font-mono font-bold text-primary">{lead.lead_code || '—'}</td>
                              <td className="p-4 font-bold text-foreground">{lead.contact_name}</td>
                              <td className="p-4">{lead.lead_sources?.name || 'Unknown'}</td>
                              <td className="p-4 capitalize">
                                <span 
                                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
                                  style={{
                                    borderColor: lead.status === 'converted' ? '#10B98140' : lead.status === 'lost' ? '#EF444440' : '#E2E8F020',
                                    backgroundColor: lead.status === 'converted' ? '#10B98110' : lead.status === 'lost' ? '#EF444410' : '#E2E8F005',
                                    color: lead.status === 'converted' ? '#10B981' : lead.status === 'lost' ? '#EF4444' : '#94A3B8'
                                  }}
                                >
                                  {lead.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-4 text-muted-foreground/60">{new Date(lead.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground italic">
                      No leads have been assigned to this employee yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h3 className="text-xl font-syne font-bold text-foreground flex items-center gap-3">
              <Activity className="text-primary" size={24} />
              System Activity Log
            </h3>

            {activityLogs && activityLogs.length > 0 ? (
              <div className="space-y-3">
                {activityLogs.map((log: any) => (
                  <div key={log.id} className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Activity size={14} />
                      </div>
                      <div>
                          <p className="text-sm font-bold text-foreground">{log.action}</p>
                          <p className="text-[10px] text-muted-foreground">Entity: {log.entity_type || 'System'} • {log.new_values ? (typeof log.new_values === 'object' ? JSON.stringify(log.new_values).substring(0, 50) + '...' : String(log.new_values)) : 'No details'}</p>
                        </div>
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground/60">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-black/20 border border-border rounded-3xl text-center px-6">
                <Activity size={40} className="text-[#222B45] opacity-20 mb-6" />
                <h4 className="text-foreground font-bold mb-2">Log is empty</h4>
                <p className="text-muted-foreground/60 text-sm max-w-xs px-2">System events and admin changes will be tracked here for security auditing.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Modals & Slide-overs */}
      <EditEmployeeSlideOver
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        employee={emp}
      />

      <ResetPasswordModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        userId={emp.id}
        userName={emp.full_name || ''}
      />

      <ConfirmStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        onConfirm={handleConfirmStatus}
        employeeName={emp.full_name || ''}
        isActivating={!isEmployeeActive}
        isPending={isToggling}
      />

      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        employeeName={emp.full_name || ''}
        isPending={isDeleting}
      />
    </div>
  );
};

export default EmployeeDetail;
