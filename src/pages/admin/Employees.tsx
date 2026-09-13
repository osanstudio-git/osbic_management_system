import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useBranch } from '../../contexts/BranchContext';
import {
  Plus, Search, Filter, Grid, List as ListIcon,
  Check, X as XIcon, AlertCircle
} from 'lucide-react';
import {
  useAdminEmployees,
  useToggleEmployeeStatus,
  useDeleteEmployee
} from '../../hooks/admin/useAdminEmployees';
import CreateEmployeeSlideOver from '../../components/admin/CreateEmployeeSlideOver';
import EditEmployeeSlideOver from '../../components/admin/EditEmployeeSlideOver';
import EmployeeActionsMenu from '../../components/admin/EmployeeActionsMenu';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import ConfirmStatusModal from '../../components/admin/ConfirmStatusModal';
import DeleteEmployeeModal from '../../components/admin/DeleteEmployeeModal';
import Skeleton from '../../components/ui/Skeleton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Employees = () => {
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();
  const { data: employees, isLoading } = useAdminEmployees();
  const { mutate: toggleStatus, isPending: isToggling } = useToggleEmployeeStatus();
  const { mutate: deleteEmployee, isPending: isDeleting } = useDeleteEmployee();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Action States
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Filter by branch first
  const branchEmployees = employees?.filter(emp => {
    if (selectedBranchId) {
      return emp.branch_id === selectedBranchId;
    }
    return true;
  }) || [];

  // Derived stats based on branch-filtered list
  const totalEmployees = branchEmployees.length;
  const activeEmployees = branchEmployees.filter(e => e.is_active !== false).length;
  const inactiveEmployees = totalEmployees - activeEmployees;

  const topPerformer = branchEmployees.length
    ? [...branchEmployees].sort((a, b) => (b.completed_month || 0) - (a.completed_month || 0))[0]
    : null;

  const filteredEmployees = branchEmployees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleEdit = (emp: any) => {
    setSelectedEmployee(emp);
    setIsEditOpen(true);
  };

  const handleResetPassword = (emp: any) => {
    setSelectedEmployee(emp);
    setIsResetOpen(true);
  };

  const handleToggleStatus = (emp: any) => {
    setSelectedEmployee(emp);
    setIsStatusOpen(true);
  };

  const handleDelete = (emp: any) => {
    setSelectedEmployee(emp);
    setIsDeleteOpen(true);
  };

  const handleConfirmStatus = () => {
    const newStatus = !selectedEmployee.is_active;
    toggleStatus({ id: selectedEmployee.id, is_active: newStatus }, {
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
    if (selectedEmployee?.id) {
      deleteEmployee(selectedEmployee.id, {
        onSuccess: () => {
          setIsDeleteOpen(false);
          setSelectedEmployee(null);
        }
      });
    }
  };

  const containerAnimations = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemAnimations = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ... header and toolbar ... */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your Sanad center workforce</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: isLoading ? '-' : totalEmployees, color: 'text-foreground' },
          { label: 'Active', value: isLoading ? '-' : activeEmployees, color: 'text-emerald-500' },
          { label: 'On Leave / Inactive', value: isLoading ? '-' : inactiveEmployees, color: 'text-amber-500' },
          {
            label: 'Top Performer (Month)',
            value: isLoading ? '-' : (topPerformer ? topPerformer.full_name : 'N/A'),
            subValue: topPerformer ? `${topPerformer.completed_month || 0} jobs` : '',
            color: 'text-primary'
          },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{stat.label}</p>
            {isLoading ? (
              <Skeleton height={28} width="50%" />
            ) : (
              <div>
                <p className={cn("text-2xl font-mono font-bold truncate", stat.color)}>{stat.value}</p>
                {stat.subValue && <p className="text-[10px] text-[#94A3B8] mt-1">{stat.subValue}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card border border-border p-2 rounded-2xl shadow-sm">
        <div className="flex-1 w-full sm:w-auto relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none pl-12 pr-4 py-2 text-foreground placeholder:text-muted-foreground/50 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pr-2">
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors border border-transparent hover:border-border flex items-center gap-2">
            <Filter size={16} /> <span className="text-sm font-medium hidden sm:inline">Filter</span>
          </button>
          <div className="w-[1px] h-6 bg-border mx-2" />
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'table' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={250} rounded="xl" />)}
        </div>
      ) : filteredEmployees?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-3xl text-center px-6">
          <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center text-muted-foreground mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-syne font-bold text-foreground mb-2">No employees found</h3>
          <p className="text-muted-foreground max-w-xs">We couldn't find any employees matching your search criteria.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <motion.div
          variants={containerAnimations} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {filteredEmployees?.map((emp: any) => (
            <motion.div key={emp.id} variants={itemAnimations} className="bg-card border border-border rounded-2xl p-6 shadow-sm group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-center items-center overflow-hidden">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-lg">{emp.full_name?.[0]}</span>
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 border-2 border-card rounded-full z-10", 
                      emp.is_active === false ? 'bg-red-500' : (emp.availability_status === 'available' ? 'bg-emerald-500' : 'bg-amber-500')
                    )} />
                  </div>
                  <div>
                    <Link to={`/admin/employees/${emp.id}`} className="text-base font-bold text-foreground hover:text-primary transition-colors">{emp.full_name}</Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{emp.employee_code}</p>
                      {emp.is_manager && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-purple-500/10 text-purple-400 border border-purple-500/20">Manager</span>}
                      {emp.can_do_sales && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">Sales</span>}
                      {emp.can_do_marketing && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-pink-500/10 text-pink-400 border border-pink-500/20">Marketing</span>}
                      {emp.can_do_ops && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ops</span>}
                      {emp.can_do_accounts && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Accounts</span>}
                      {emp.is_pro && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">PRO</span>}
                    </div>
                  </div>
                </div>
                <EmployeeActionsMenu
                  employee={emp}
                  onEdit={handleEdit}
                  onResetPassword={handleResetPassword}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest mb-1.5">Assigned Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {emp.assigned_services?.slice(0, 3).map((s: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-[#94A3B8]">{s}</span>
                    ))}
                    {(emp.assigned_services?.length || 0) > 3 && (
                      <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-[#94A3B8]">+{emp.assigned_services.length - 3}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="text-center group-hover:scale-105 transition-transform cursor-pointer" onClick={() => navigate(`/admin/jobs?employee=${emp.id}`)}>
                    <p className="text-xl font-mono font-bold text-accent">{emp.active_jobs || 0}</p>
                    <p className="text-[9px] text-[#475569] uppercase tracking-widest">Active Jobs</p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/5" />
                  <div className="text-center">
                    <p className="text-xl font-mono font-bold text-white">{emp.completed_month || 0}</p>
                    <p className="text-[9px] text-[#475569] uppercase tracking-widest">Done (Mo)</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm">
          <div className="overflow-x-auto sm:overflow-visible">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 [&>th:first-child]:rounded-tl-2xl [&>th:last-child]:rounded-tr-2xl">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Employee</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Contact</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-center">Performance</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees?.map((emp: any, idx: number) => (
                  <tr key={emp.id} className={cn(
                    "border-b border-border hover:bg-muted/30 transition-colors group",
                    idx === (filteredEmployees?.length || 0) - 1 ? "border-0 [&>td:first-child]:rounded-bl-2xl [&>td:last-child]:rounded-br-2xl" : ""
                  )}>
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                          {emp.avatar_url ? <img src={emp.avatar_url} alt="" /> : emp.full_name?.[0]}
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-3 h-3 border-2 border-card rounded-full z-10", 
                          emp.is_active === false ? 'bg-red-500' : (emp.availability_status === 'available' ? 'bg-emerald-500' : 'bg-amber-500')
                        )} />
                      </div>
                      <div>
                        <Link to={`/admin/employees/${emp.id}`} className="text-sm font-bold text-foreground hover:text-primary transition-colors">{emp.full_name}</Link>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-muted-foreground font-mono leading-none">{emp.employee_code}</p>
                          {emp.is_manager && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/10 leading-none">Manager</span>}
                          {emp.can_do_sales && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/10 leading-none">Sales</span>}
                          {emp.can_do_marketing && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-pink-500/10 text-pink-400 border border-pink-500/10 leading-none">Marketing</span>}
                          {emp.can_do_ops && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 leading-none">Ops</span>}
                          {emp.can_do_accounts && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 leading-none">Accounts</span>}
                          {emp.is_pro && <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/10 leading-none">PRO</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-foreground">{emp.email}</div>
                      {emp.phone && <div className="text-[10px] text-muted-foreground mt-0.5">{emp.phone}</div>}
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5",
                        emp.is_active !== false ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}>
                        {emp.is_active !== false ? <Check size={10} /> : <XIcon size={10} />}
                        {emp.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => navigate(`/admin/jobs?employee=${emp.id}`)}>
                          <span className="text-sm font-mono font-bold text-accent">{emp.active_jobs || 0}</span>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Active</p>
                        </div>
                        <div className="w-[1px] h-6 bg-border" />
                        <div className="text-center">
                          <span className="text-sm font-mono font-bold text-foreground">{emp.completed_month || 0}</span>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Done(Mo)</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <EmployeeActionsMenu
                        employee={emp}
                        onEdit={handleEdit}
                        onResetPassword={handleResetPassword}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slideovers and Modals */}
      <CreateEmployeeSlideOver isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <EditEmployeeSlideOver
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        employee={selectedEmployee}
      />

      <ResetPasswordModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        userId={selectedEmployee?.id || ''}
        userName={selectedEmployee?.full_name || ''}
      />

      <ConfirmStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        onConfirm={handleConfirmStatus}
        employeeName={selectedEmployee?.full_name || ''}
        isActivating={!selectedEmployee?.is_active}
        isPending={isToggling}
      />

      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        employeeName={selectedEmployee?.full_name || ''}
        isPending={isDeleting}
      />
    </div>
  );
};

export default Employees;
