import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Briefcase, User, Users, ShieldAlert } from 'lucide-react';

interface TaskDashboardProps {
  jobs: any[]; // Total unfiltered jobs for this employee
  activeFilter: 'all' | 'self' | 'manager' | 'coworker';
  onFilterChange: (filter: 'all' | 'self' | 'manager' | 'coworker') => void;
  profileId: string;
}

export const TaskDashboard: React.FC<TaskDashboardProps> = ({ jobs, activeFilter, onFilterChange, profileId }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  // Calculate counts based on assigned_by, excluding cancelled tasks
  const activeJobs = jobs.filter(j => j.status !== 'cancelled');
  const selfAssigned = activeJobs.filter(j => j.assigned_by === profileId).length;
  const managerAssigned = activeJobs.filter(j => j.assigned_by_role === 'admin' || j.assigned_by_role === 'manager').length;
  const coworkerAssigned = activeJobs.filter(j => j.assigned_by !== profileId && j.assigned_by_role === 'employee').length;

  const filters = [
    { id: 'all', label: isRtl ? 'جميع المهام' : 'All Tasks', count: activeJobs.length, icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'self', label: isRtl ? 'المسندة إلي' : 'Self Assigned', count: selfAssigned, icon: User, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'manager', label: isRtl ? 'مسندة من الإدارة' : 'Manager Assigned', count: managerAssigned, icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'coworker', label: isRtl ? 'مفوضة من الزملاء' : 'Coworker Delegated', count: coworkerAssigned, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="mb-4">
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
         {filters.map((f) => (
           <div 
             key={f.id}
             onClick={() => onFilterChange(f.id as any)}
             className={`p-3 rounded-2xl border transition-all cursor-pointer ${
               activeFilter === f.id 
                 ? `bg-card border-primary shadow-sm` 
                 : 'bg-card border-border hover:border-primary/50'
             }`}
           >
             <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${f.bg} ${f.color}`}>
                  <f.icon size={16} />
                </div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{f.label}</h3>
             </div>
             <p className={`text-2xl font-syne font-bold ${activeFilter === f.id ? 'text-primary' : 'text-foreground'}`}>
               {f.count}
             </p>
           </div>
         ))}
       </div>
    </div>
  );
};
