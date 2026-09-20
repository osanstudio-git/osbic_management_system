import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, Shield, Zap, Briefcase, 
  Search, Filter, Plus, ArrowRightLeft, CheckCircle2, 
  Clock, Phone, Mail, Building2, ChevronRight, UserPlus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { useAdminJobs } from '../../hooks/shared/useJobs';
import { useAdminLeads } from '../../hooks/shared/useLeads';
import { WorkloadAllocationModal } from '../../components/employee/WorkloadAllocationModal';
import { RoundRobinDistributionModal } from '../../components/employee/RoundRobinDistributionModal';
import CreateEmployeeSlideOver from '../../components/admin/CreateEmployeeSlideOver';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const BranchTeam: React.FC = () => {
  const { profile } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const branchId = profile?.branch_id || selectedBranchId;

  const { data: employees = [], isLoading: loadingEmployees, refetch: refetchEmployees } = useAdminEmployees(branchId);
  const { data: allJobs = [], isLoading: loadingJobs } = useAdminJobs(branchId);
  const { useAllLeadsList } = useAdminLeads(branchId);
  const { data: leads = [], isLoading: loadingLeads } = useAllLeadsList();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'all' | 'sales' | 'marketing' | 'operations' | 'accounts' | 'pro'>('all');
  const [selectedStaffForAllocation, setSelectedStaffForAllocation] = useState<any>(null);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRoundRobinOpen, setIsRoundRobinOpen] = useState(false);

  // Quick Lead Assignment state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [isAssigningLead, setIsAssigningLead] = useState(false);

  const unassignedLeads = leads.filter(l => !l.assigned_to && l.status !== 'converted' && l.status !== 'lost');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const handleQuickLeadAssign = async () => {
    if (!selectedLeadId || !assigneeId) {
      toast.error('Please select both a lead and an employee');
      return;
    }

    setIsAssigningLead(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          assigned_to: assigneeId,
          assigned_by: profile?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLeadId);

      if (error) throw error;
      toast.success('Lead successfully assigned to staff member');
      setSelectedLeadId(null);
      setAssigneeId('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to assign lead');
    } finally {
      setIsAssigningLead(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
            <Building2 size={14} />
            <span>{selectedBranch?.name || 'Branch'} Staff & Delegation</span>
          </div>
          <h1 className="text-3xl font-syne font-bold text-foreground">
            Team Supervision & Workload
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your branch workforce, delegate customer jobs, and balance operational responsibilities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <UserPlus size={14} />
            Add Employee
          </button>
          <button
            onClick={() => {
              setSelectedStaffForAllocation(employees[0] || null);
              setIsAllocationModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-muted border border-border text-foreground rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <ArrowRightLeft size={14} />
            Re-Allocate Jobs & Tasks
          </button>
        </div>
      </div>

      {/* ─── Unassigned Branch Leads Delegation Banner (if any) ─── */}
      {unassignedLeads.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Action Required: {unassignedLeads.length} Unassigned Leads in this Branch
              </h3>
            </div>
            
            <button
              type="button"
              onClick={() => setIsRoundRobinOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Zap size={14} />
              <span>Smart Auto-Distribute ({unassignedLeads.length})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center pt-1 border-t border-amber-500/20">
            <select
              value={selectedLeadId || ''}
              onChange={e => setSelectedLeadId(e.target.value)}
              className="w-full sm:w-1/2 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-500 outline-none"
            >
              <option value="">-- Or Assign Individual Lead Manually --</option>
              {unassignedLeads.map(l => (
                <option key={l.id} value={l.id}>
                  {l.contact_name} ({l.company_name || 'Individual'}) - {l.contact_phone || 'No phone'}
                </option>
              ))}
            </select>

            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full sm:w-1/3 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-500 outline-none"
            >
              <option value="">-- Select Staff Member --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
            </select>

            <button
              onClick={handleQuickLeadAssign}
              disabled={isAssigningLead || !selectedLeadId || !assigneeId}
              className="w-full sm:w-auto px-5 py-2 bg-muted hover:bg-card border border-border text-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0"
            >
              {isAssigningLead ? 'Assigning...' : 'Assign Single'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Search and Department Filters ─── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-foreground focus:border-primary outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
          {(['all', 'sales', 'marketing', 'operations', 'accounts', 'pro'] as const).map(dept => (
            <button
              key={dept}
              onClick={() => setDepartmentFilter(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                departmentFilter === dept 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {dept === 'all' ? 'All Staff' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Employees Directory Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground text-xs bg-card border border-border rounded-2xl">
            No employees found matching your filters.
          </div>
        ) : (
          filteredEmployees.map(emp => {
            const empActiveJobs = allJobs.filter(j => 
              (j.employee_id === emp.id || j.ops_employee_id === emp.id) && 
              j.status !== 'completed' && j.status !== 'cancelled'
            );
            const empCompletedJobs = allJobs.filter(j => 
              (j.employee_id === emp.id || j.ops_employee_id === emp.id) && 
              j.status === 'completed'
            );

            return (
              <div 
                key={emp.id}
                className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-6 group"
              >
                {/* Top: Avatar & Info */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base shrink-0 group-hover:scale-105 transition-transform">
                        {emp.full_name?.slice(0, 2).toUpperCase() || 'EM'}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          {emp.full_name}
                          {emp.is_manager && (
                            <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.2 rounded font-bold uppercase">
                              Manager
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize">{emp.department || emp.role}</p>
                      </div>
                    </div>

                    <span className={`w-2.5 h-2.5 rounded-full ${emp.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} title={emp.is_active ? 'Active' : 'Inactive'} />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={13} className="shrink-0 text-muted-foreground/80" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="shrink-0 text-muted-foreground/80" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Workload Metrics */}
                <div className="grid grid-cols-2 gap-3 py-3 px-4 rounded-xl bg-muted/20 border border-border/40">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Active Jobs</span>
                    <span className="text-base font-bold text-foreground font-mono">{empActiveJobs.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Completed</span>
                    <span className="text-base font-bold text-emerald-500 font-mono">{empCompletedJobs.length}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <button
                    onClick={() => {
                      setSelectedStaffForAllocation(emp);
                      setIsAllocationModalOpen(true);
                    }}
                    className="flex-1 py-2 bg-muted hover:bg-card border border-border hover:border-primary/40 rounded-xl text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft size={13} />
                    Delegate / Re-assign
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Workload Allocation / Delegation Modal */}
      {isAllocationModalOpen && (
        <WorkloadAllocationModal
          isOpen={isAllocationModalOpen}
          onClose={() => setIsAllocationModalOpen(false)}
          activeJobs={allJobs}
          employees={employees}
          selectedEmployeeId={selectedStaffForAllocation?.id}
          onSuccess={() => setIsAllocationModalOpen(false)}
        />
      )}

      {/* Create Employee SlideOver */}
      <CreateEmployeeSlideOver
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          refetchEmployees();
        }}
      />

      {/* Smart Round-Robin Distribution Modal */}
      <RoundRobinDistributionModal
        isOpen={isRoundRobinOpen}
        onClose={() => setIsRoundRobinOpen(false)}
        unassignedLeads={unassignedLeads}
        employees={employees}
        allJobs={allJobs}
        allLeads={leads}
      />

    </div>
  );
};

export default BranchTeam;
