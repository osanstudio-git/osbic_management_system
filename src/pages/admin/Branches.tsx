import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useBranch, type Branch } from '../../contexts/BranchContext';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Building2, MapPin, Phone, Users, UserCheck, Plus, Edit2, Check,
  X, Loader2, Briefcase, DollarSign, Search, ChevronRight, ShieldCheck,
  AlertCircle, Activity, Globe, Power, Trash2, LayoutGrid, List, AlertTriangle, UserPlus, Mail
} from 'lucide-react';

export default function Branches() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const { branches, loadingBranches, createBranch, updateBranch, deleteBranch } = useBranch();

  // Search & Filter & View Mode
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranchForStaff, setSelectedBranchForStaff] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);

  // Staff Drawer/Modal Search & Filter
  const [staffSearch, setStaffSearch] = useState('');
  const [showAddStaffSelector, setShowAddStaffSelector] = useState(false);

  // Form States
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    manager_id: '',
  });

  const [savingBranch, setSavingBranch] = useState(false);

  // Fetch Employees for assignment & display
  const { data: employees = [], refetch: refetchEmployees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['admin_employees_for_branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_code, email, phone, branch_id, is_manager, role, department, is_active, avatar_url')
        .eq('role', 'employee')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Jobs summary for branch metrics
  const { data: jobsSummary = [] } = useQuery({
    queryKey: ['branch_jobs_summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, branch_id, status, total_fee');
      if (error) return [];
      return data || [];
    }
  });

  // Calculate Global Stats
  const activeBranchesCount = branches.filter(b => b.is_active).length;
  const totalEmployeesAssigned = employees.filter(e => e.branch_id).length;
  const managersCount = employees.filter(e => e.is_manager && e.branch_id).length;

  // Filter Branches
  const filteredBranches = branches.filter(b => {
    if (filterActive === 'active' && !b.is_active) return false;
    if (filterActive === 'inactive' && b.is_active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address && b.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Helper to compute metrics for a branch
  const getBranchMetrics = (branchId: string) => {
    const branchStaff = employees.filter(e => e.branch_id === branchId);
    const branchManager = branchStaff.find(e => e.is_manager);
    const branchJobs = jobsSummary.filter(j => j.branch_id === branchId);
    const activeJobs = branchJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
    const completedJobs = branchJobs.filter(j => j.status === 'completed').length;
    const totalVolume = branchJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);

    const opsCount = branchStaff.filter(e => (e.department || '').toLowerCase().includes('op') || (e.role || '').toLowerCase().includes('op')).length;
    const salesCount = branchStaff.filter(e => (e.department || '').toLowerCase().includes('sale')).length;
    const otherCount = Math.max(0, branchStaff.length - opsCount - salesCount);

    return {
      staff: branchStaff,
      manager: branchManager,
      activeJobs,
      completedJobs,
      totalVolume,
      opsCount,
      salesCount,
      otherCount
    };
  };

  const handleOpenAdd = () => {
    setBranchForm({ name: '', code: '', address: '', phone: '', manager_id: '' });
    setShowAddModal(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    const currentManager = employees.find(e => e.branch_id === branch.id && e.is_manager);
    setBranchForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      manager_id: currentManager?.id || '',
    });
    setEditingBranch(branch);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      toast.error(isRtl ? 'يرجى إدخال اسم ورمز الفرع' : 'Branch name and code are required');
      return;
    }

    setSavingBranch(true);
    try {
      if (editingBranch) {
        // Update existing branch
        await updateBranch(editingBranch.id, {
          name: branchForm.name.trim(),
          code: branchForm.code.trim().toUpperCase(),
          address: branchForm.address ? branchForm.address.trim() : null,
          phone: branchForm.phone ? branchForm.phone.trim() : null,
        });

        // Update manager appointment
        const oldManager = employees.find(e => e.branch_id === editingBranch.id && e.is_manager);
        if (oldManager && oldManager.id !== branchForm.manager_id) {
          await supabase.from('profiles').update({ is_manager: false }).eq('id', oldManager.id);
        }

        if (branchForm.manager_id) {
          await supabase
            .from('profiles')
            .update({ branch_id: editingBranch.id, is_manager: true })
            .eq('id', branchForm.manager_id);
        }

        await refetchEmployees();
        toast.success(isRtl ? 'تم تحديث بيانات الفرع بنجاح!' : 'Branch updated successfully!');
        setEditingBranch(null);
      } else {
        // Create new branch
        const newBranch = await createBranch({
          name: branchForm.name.trim(),
          code: branchForm.code.trim().toUpperCase(),
          address: branchForm.address ? branchForm.address.trim() : null,
          phone: branchForm.phone ? branchForm.phone.trim() : null,
          is_active: true
        } as any);

        if (branchForm.manager_id && newBranch?.id) {
          await supabase
            .from('profiles')
            .update({ branch_id: newBranch.id, is_manager: true })
            .eq('id', branchForm.manager_id);
          await refetchEmployees();
        }

        toast.success(isRtl ? `تم إنشاء الفرع "${newBranch.name}" بنجاح!` : `Branch "${newBranch.name}" created successfully!`);
        setShowAddModal(false);
      }
    } catch (err: any) {
      console.error('Save branch error:', err);
      toast.error(err.message || 'Failed to save branch');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      await updateBranch(branch.id, { is_active: !branch.is_active });
      toast.success(branch.is_active ? 'Branch deactivated' : 'Branch activated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    setIsDeletingBranch(true);
    try {
      await deleteBranch(deletingBranch.id);
      await refetchEmployees();
      toast.success(isRtl ? `تم حذف فرع "${deletingBranch.name}" بنجاح` : `Branch "${deletingBranch.name}" deleted successfully`);
      if (selectedBranchForStaff?.id === deletingBranch.id) {
        setSelectedBranchForStaff(null);
      }
      setDeletingBranch(null);
    } catch (err: any) {
      console.error('Delete branch error:', err);
      toast.error(err.message || 'Failed to delete branch');
    } finally {
      setIsDeletingBranch(false);
    }
  };

  const handleAssignEmployee = async (employeeId: string, branchId: string | null) => {
    try {
      const updates: any = { branch_id: branchId };
      if (!branchId) {
        updates.is_manager = false;
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', employeeId);
      if (error) throw error;
      await refetchEmployees();
      toast.success(branchId ? (isRtl ? 'تم تعيين الموظف في هذا الفرع' : 'Employee assigned to branch') : (isRtl ? 'تم إلغاء تعيين الموظف من الفرع' : 'Employee removed from branch'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign employee');
    }
  };

  const handleToggleManager = async (emp: any, branchId: string) => {
    try {
      const willBeManager = !emp.is_manager;
      if (willBeManager) {
        // Demote existing manager of this branch
        const existingMgr = employees.find(e => e.branch_id === branchId && e.is_manager && e.id !== emp.id);
        if (existingMgr) {
          await supabase.from('profiles').update({ is_manager: false }).eq('id', existingMgr.id);
        }
      }
      await supabase.from('profiles').update({ is_manager: willBeManager }).eq('id', emp.id);
      await refetchEmployees();
      toast.success(willBeManager ? 'Appointed as branch manager' : 'Manager status revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update manager status');
    }
  };

  // Branch staff for the opened branch modal
  const activeBranchStaff = selectedBranchForStaff
    ? employees.filter(e => e.branch_id === selectedBranchForStaff.id)
    : [];

  const filteredBranchStaff = activeBranchStaff.filter(e => {
    if (!staffSearch.trim()) return true;
    const q = staffSearch.toLowerCase();
    return (
      e.full_name?.toLowerCase().includes(q) ||
      e.employee_code?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.phone?.toLowerCase().includes(q)
    );
  });

  // Employees available to be added to this branch (either unassigned or in another branch)
  const availableEmployeesToAssign = employees.filter(
    e => selectedBranchForStaff && e.branch_id !== selectedBranchForStaff.id
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-syne font-bold text-foreground">
              {isRtl ? 'إدارة الفروع والمواقع' : 'Branches & Locations'}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              {branches.length} {isRtl ? 'فروع' : 'Branches'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRtl
              ? 'متابعة أداء الفروع، توزيع الموظفين، تعيين المشرفين وتخصيص رموز المعاملات'
              : 'Monitor branch operations, staff distribution, manager designations and case workloads'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 shrink-0"
        >
          <Plus size={15} />
          <span>{isRtl ? 'إضافة فرع جديد' : '+ Add New Branch'}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isRtl ? 'إجمالي الفروع' : 'Total Branches'}</p>
            <p className="text-xl font-bold font-syne text-foreground">{branches.length} <span className="text-xs text-emerald-400 font-normal">({activeBranchesCount} {isRtl ? 'نشط' : 'active'})</span></p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isRtl ? 'الموظفين الموزعين' : 'Assigned Staff'}</p>
            <p className="text-xl font-bold font-syne text-foreground">{totalEmployeesAssigned} <span className="text-xs text-muted-foreground font-normal">/ {employees.length}</span></p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isRtl ? 'مشرفي الفروع' : 'Branch Managers'}</p>
            <p className="text-xl font-bold font-syne text-foreground">{managersCount} <span className="text-xs text-purple-400 font-normal">{isRtl ? 'معتمد' : 'Appointed'}</span></p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isRtl ? 'إجمالي المعاملات' : 'Total Workload'}</p>
            <p className="text-xl font-bold font-syne text-foreground">{jobsSummary.length} <span className="text-xs text-muted-foreground font-normal">{isRtl ? 'معاملة' : 'cases'}</span></p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters & View Mode */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 p-2 rounded-2xl border border-border/40">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={isRtl ? 'ابحث باسم الفرع، الرمز أو العنوان...' : 'Search by branch name, code, city...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border/60 rounded-xl text-xs text-foreground outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl text-[11px] font-bold border border-border/30">
            <button
              onClick={() => setFilterActive('all')}
              className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'الكل' : 'All'} ({branches.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'active' ? 'bg-card text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'النشطة' : 'Active'} ({activeBranchesCount})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'inactive' ? 'bg-card text-red-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {isRtl ? 'المعطلة' : 'Inactive'} ({branches.length - activeBranchesCount})
            </button>
          </div>

          {/* View Mode Switcher: Grid vs List */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/30">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title={isRtl ? 'عرض شبكي' : 'Grid View'}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title={isRtl ? 'عرض قائمة' : 'List View'}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Grid or List View */}
      {loadingBranches ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/40 rounded-3xl p-8 space-y-3">
          <Building2 size={36} className="mx-auto text-muted-foreground/40" />
          <p className="text-sm font-bold text-foreground">{isRtl ? 'لا توجد فروع مطابقة' : 'No branches found'}</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {isRtl ? 'قم بإضافة فرع جديد لبدء توزيع الموظفين والمعاملات.' : 'Add your first branch to start assigning staff and organizing branch operations.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
          >
            + Add First Branch
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredBranches.map(branch => {
            const metrics = getBranchMetrics(branch.id);

            return (
              <motion.div
                key={branch.id}
                layout
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-5 ${
                  branch.is_active ? 'bg-card border-border/70 hover:border-primary/40 shadow-sm' : 'bg-muted/10 border-border/30 opacity-70'
                }`}
              >
                {/* Branch Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-sm shrink-0">
                      {branch.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold font-syne text-foreground">{branch.name}</h2>
                        {branch.code === 'GHL' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                            Main HQ
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                          branch.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {branch.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
                        </span>
                      </div>

                      {branch.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                          <MapPin size={12} className="text-primary/70 shrink-0" />
                          <span className="truncate max-w-[280px]">{branch.address}</span>
                        </p>
                      )}
                      {branch.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} className="text-primary/70 shrink-0" />
                          <span className="font-mono">{branch.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(branch)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                      title={isRtl ? 'تعديل بيانات الفرع' : 'Edit Branch'}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(branch)}
                      className={`p-2 rounded-xl transition-all ${
                        branch.is_active ? 'text-emerald-400 hover:text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title={branch.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      onClick={() => setDeletingBranch(branch)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Manager & Performance Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                  {/* Manager Block */}
                  <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <UserCheck size={11} className="text-purple-400" />
                      {isRtl ? 'مشرف الفرع' : 'Branch Manager'}
                    </span>
                    {metrics.manager ? (
                      <div>
                        <p className="text-xs font-bold text-foreground truncate">{metrics.manager.full_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{metrics.manager.phone || metrics.manager.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic pt-0.5">{isRtl ? 'لا يوجد مشرف معين' : 'Unassigned'}</p>
                    )}
                  </div>

                  {/* Workload Block */}
                  <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Activity size={11} className="text-emerald-400" />
                      {isRtl ? 'أداء الفرع' : 'Branch Workload'}
                    </span>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-amber-400">{metrics.activeJobs}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{isRtl ? 'جارية' : 'active'}</span>
                      </div>
                      <span className="text-border">•</span>
                      <div>
                        <span className="text-xs font-bold text-emerald-400">{metrics.completedJobs}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{isRtl ? 'مكتملة' : 'done'}</span>
                      </div>
                      <span className="text-border">•</span>
                      <div>
                        <span className="text-xs font-bold text-foreground font-mono">{metrics.totalVolume.toFixed(0)}</span>
                        <span className="text-[9px] text-muted-foreground ml-0.5">OMR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Staff Summary Box (Counts only, click to view staff) */}
                <div
                  onClick={() => {
                    setSelectedBranchForStaff(branch);
                    setStaffSearch('');
                    setShowAddStaffSelector(false);
                  }}
                  className="p-3.5 rounded-2xl bg-muted/20 hover:bg-primary/5 border border-border/40 hover:border-primary/40 transition-all cursor-pointer group flex items-center justify-between"
                  title={isRtl ? 'انقر لعرض موظفي هذا الفرع' : 'Click to view branch employees'}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {metrics.staff.length} {metrics.staff.length === 1 ? (isRtl ? 'موظف معين' : 'Assigned Employee') : (isRtl ? 'موظفين معينين' : 'Assigned Employees')}
                        </span>
                        {metrics.staff.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {metrics.staff.filter(e => e.is_active).length} {isRtl ? 'نشط' : 'active'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {metrics.staff.length > 0
                          ? `${metrics.opsCount} Ops • ${metrics.salesCount} Sales • ${metrics.otherCount} Other`
                          : (isRtl ? 'لا يوجد موظفين - انقر للتعيين' : 'No staff assigned - click to add')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-primary group-hover:translate-x-1 transition-transform">
                    <span>{isRtl ? 'عرض الموظفين' : 'View Staff'}</span>
                    <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3.5 px-5">{isRtl ? 'الفرع' : 'Branch'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'مشرف الفرع' : 'Branch Manager'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'عدد الموظفين' : 'Staff Count'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'حجم المعاملات' : 'Workload'}</th>
                  <th className="py-3.5 px-5 text-right">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredBranches.map(branch => {
                  const metrics = getBranchMetrics(branch.id);

                  return (
                    <tr
                      key={branch.id}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedBranchForStaff(branch);
                        setStaffSearch('');
                        setShowAddStaffSelector(false);
                      }}
                    >
                      {/* Branch Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-xs shrink-0">
                            {branch.code}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-xs">{branch.name}</span>
                              {branch.code === 'GHL' && (
                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                                  HQ
                                </span>
                              )}
                            </div>
                            {branch.address && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {branch.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                          branch.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {branch.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
                        </span>
                      </td>

                      {/* Manager */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {metrics.manager ? (
                          <div>
                            <p className="font-bold text-foreground text-xs">{metrics.manager.full_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{metrics.manager.phone || metrics.manager.email}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60 italic">{isRtl ? 'غير معين' : 'Unassigned'}</span>
                        )}
                      </td>

                      {/* Staff Count */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center gap-1.5">
                            <Users size={12} />
                            <span>{metrics.staff.length}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ({metrics.opsCount} Ops • {metrics.salesCount} Sales)
                          </span>
                        </div>
                      </td>

                      {/* Workload */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">{metrics.activeJobs} {isRtl ? 'جارية' : 'act'}</span>
                          <span className="text-border">•</span>
                          <span className="text-emerald-400 font-bold">{metrics.completedJobs} {isRtl ? 'مكتملة' : 'done'}</span>
                          <span className="text-border">•</span>
                          <span className="text-foreground font-mono font-bold">{metrics.totalVolume.toFixed(0)} OMR</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedBranchForStaff(branch);
                              setStaffSearch('');
                              setShowAddStaffSelector(false);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] transition-all flex items-center gap-1"
                            title={isRtl ? 'عرض موظفي الفرع' : 'View Staff'}
                          >
                            <Users size={13} />
                            <span className="hidden sm:inline">{isRtl ? 'الموظفين' : 'Staff'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(branch)}
                            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                            title={isRtl ? 'تعديل بيانات الفرع' : 'Edit Branch'}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(branch)}
                            className={`p-1.5 rounded-xl transition-all ${
                              branch.is_active ? 'text-emerald-400 hover:text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={branch.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingBranch(branch)}
                            className="p-1.5 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BRANCH STAFF MODAL (Shows ONLY employees in that branch when clicking on the branch) */}
      <AnimatePresence>
        {selectedBranchForStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm font-mono shrink-0">
                    {selectedBranchForStaff.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-syne text-base font-bold text-foreground">
                        {selectedBranchForStaff.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {activeBranchStaff.length} {isRtl ? 'موظف' : 'Employees'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl ? 'قائمة الموظفين المعينين فقط في هذا الفرع' : 'Employees assigned strictly to this branch'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddStaffSelector(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all border border-primary/20"
                  >
                    <UserPlus size={13} />
                    <span>{isRtl ? '+ تعيين موظف' : '+ Assign Staff'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBranchForStaff(null);
                      setShowAddStaffSelector(false);
                    }}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Sub-bar: Search & Inline Assign Box */}
              <div className="p-4 bg-muted/10 border-b border-border/30 space-y-3 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={isRtl ? 'ابحث في موظفي هذا الفرع بالاسم، الرمز، البريد...' : 'Search staff in this branch by name, code, email, dept...'}
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-card border border-border/60 rounded-xl text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Inline Assign Selector Drawer */}
                <AnimatePresence>
                  {showAddStaffSelector && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-primary">
                        <span>{isRtl ? 'تعيين موظف إضافي في هذا الفرع' : 'Assign Employee to this Branch'}</span>
                        <button
                          onClick={() => setShowAddStaffSelector(false)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isRtl
                          ? 'اختر موظفاً من الموظفين غير المعينين أو المعينين في فروع أخرى لنقله إلى هذا الفرع:'
                          : 'Select an employee (unassigned or from another branch) to assign here:'}
                      </p>
                      {availableEmployeesToAssign.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1">
                          {isRtl ? 'جميع موظفي النظام معينين بالفعل في هذا الفرع.' : 'All registered employees are already assigned to this branch.'}
                        </p>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            id="select-employee-to-add"
                            className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value && selectedBranchForStaff) {
                                handleAssignEmployee(e.target.value, selectedBranchForStaff.id);
                                setShowAddStaffSelector(false);
                              }
                            }}
                          >
                            <option value="" disabled>-- {isRtl ? 'اختر موظفاً للتعيين...' : 'Select an employee to assign...'} --</option>
                            {availableEmployeesToAssign.map(emp => {
                              const curBranch = branches.find(b => b.id === emp.branch_id);
                              return (
                                <option key={emp.id} value={emp.id}>
                                  {emp.full_name} ({emp.employee_code || 'EMP'}) {curBranch ? `[Currently in ${curBranch.name}]` : '[Unassigned]'}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Staff List Body */}
              <div className="p-6 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
                {filteredBranchStaff.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <Users size={32} className="mx-auto text-muted-foreground/30" />
                    <p className="text-xs font-bold text-foreground">
                      {staffSearch.trim()
                        ? (isRtl ? 'لا يوجد موظف مطابق لبحثك في هذا الفرع' : 'No staff match your search in this branch')
                        : (isRtl ? 'لم يتم تعيين أي موظف في هذا الفرع بعد' : 'No employees currently assigned to this branch')}
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      {isRtl
                        ? 'انقر على زر "+ تعيين موظف" بأعلى النافذة لتوزيع أعضاء الفريق.'
                        : 'Click "+ Assign Staff" above to move or appoint team members to this branch.'}
                    </p>
                  </div>
                ) : (
                  filteredBranchStaff.map(emp => (
                    <div
                      key={emp.id}
                      className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 hover:border-border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Employee Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {emp.full_name?.slice(0, 2).toUpperCase() || 'EM'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-foreground truncate">{emp.full_name}</span>
                            {emp.employee_code && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
                                {emp.employee_code}
                              </span>
                            )}
                            {emp.is_manager && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                <UserCheck size={10} />
                                Branch Manager
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                            {emp.department && (
                              <span className="capitalize text-primary/80 font-semibold">{emp.department}</span>
                            )}
                            {emp.department && <span>•</span>}
                            {emp.phone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone size={10} /> {emp.phone}
                              </span>
                            )}
                            {emp.phone && emp.email && <span>•</span>}
                            {emp.email && (
                              <span className="flex items-center gap-1 truncate max-w-[180px]">
                                <Mail size={10} /> {emp.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Staff Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleToggleManager(emp, selectedBranchForStaff.id)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border ${
                            emp.is_manager
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                              : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                          title={emp.is_manager ? 'Revoke manager privileges' : 'Appoint as Branch Manager'}
                        >
                          {emp.is_manager ? (isRtl ? 'إلغاء الإشراف' : 'Revoke Mgr') : (isRtl ? 'تعيين مشرف' : 'Make Mgr')}
                        </button>
                        <button
                          onClick={() => handleAssignEmployee(emp.id, null)}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-all"
                          title={isRtl ? 'إلغاء تعيين الموظف من هذا الفرع' : 'Remove employee from this branch'}
                        >
                          {isRtl ? 'إزالة من الفرع' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground">
                  {filteredBranchStaff.length} {isRtl ? 'موظف معروض' : 'employees listed'}
                </span>
                <button
                  onClick={() => {
                    setSelectedBranchForStaff(null);
                    setShowAddStaffSelector(false);
                  }}
                  className="px-5 py-2 bg-muted hover:bg-muted/70 text-foreground font-bold text-xs rounded-xl transition-all"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE BRANCH CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-syne text-base font-bold text-foreground">
                  {isRtl ? `حذف الفرع "${deletingBranch.name}"؟` : `Delete Branch "${deletingBranch.name}"?`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? `هل أنت متأكد من حذف فرع (${deletingBranch.code})؟ سيتم إلغاء تعيين جميع موظفيه وفصل ارتباط المعاملات به بشكل آمن. لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to delete ${deletingBranch.name} (${deletingBranch.code})? All assigned staff will be unassigned and jobs will be decoupled. This action cannot be undone.`}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-red-500/5 border border-red-500/20 text-[11px] text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  {isRtl ? 'تأكيد الحذف النهائي' : 'Permanent Deletion Notice'}
                </p>
                <p className="text-muted-foreground text-[10px]">
                  {isRtl
                    ? `سيتم إزالة الفرع تماماً من قوائم النظام ولوحات التحكم.`
                    : `The branch record will be permanently deleted from the database.`}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingBranch}
                  onClick={() => setDeletingBranch(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isDeletingBranch}
                  onClick={handleDeleteBranch}
                  className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white font-bold text-xs rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isDeletingBranch ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>{isDeletingBranch ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'تأكيد الحذف' : 'Delete Branch')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Branch Modal */}
      <AnimatePresence>
        {(showAddModal || editingBranch) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-border/40 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Building2 size={18} />
                  </div>
                  <h2 className="font-syne text-base font-bold text-foreground">
                    {editingBranch ? (isRtl ? 'تعديل بيانات الفرع' : 'Edit Branch') : (isRtl ? 'إضافة فرع جديد' : 'New Branch Setup')}
                  </h2>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setEditingBranch(null); }}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveBranch} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                      {isRtl ? 'اسم الفرع *' : 'Branch Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sohar Branch"
                      value={branchForm.name}
                      onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                      {isRtl ? 'رمز الفرع * (2-4 أحرف)' : 'Branch Code * (2-4 letters)'}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="e.g. SHR"
                      value={branchForm.code}
                      onChange={e => setBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono uppercase outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    {isRtl ? 'العنوان وتفاصيل الموقع' : 'Location Details / Address'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Building 12, Sohar Industrial Area, Oman"
                    value={branchForm.address}
                    onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    {isRtl ? 'رقم هاتف الفرع' : 'Branch Phone Number'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +968 2345 6789"
                    value={branchForm.phone}
                    onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                    <span>{isRtl ? 'تعيين مشرف للفرع' : 'Appoint Branch Manager'}</span>
                    <span className="text-[9px] text-purple-400 font-normal">Supervisory privileges</span>
                  </label>
                  <select
                    value={branchForm.manager_id}
                    onChange={e => setBranchForm(p => ({ ...p, manager_id: e.target.value }))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="">{isRtl ? '-- بدون مشرف فرع (غير معين) --' : '-- No Branch Manager (Unassigned) --'}</option>
                    {employees.map(emp => {
                      const curBranch = branches.find(b => b.id === emp.branch_id);
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_code || 'EMP'}) {emp.is_manager ? `• Manager (${curBranch?.name || 'Other'})` : curBranch ? `• Assigned to ${curBranch.name}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setEditingBranch(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingBranch}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {savingBranch ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    <span>{savingBranch ? 'Saving...' : (editingBranch ? 'Update Branch' : 'Create Branch')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
