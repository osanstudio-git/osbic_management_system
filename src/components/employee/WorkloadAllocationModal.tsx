import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Briefcase, ArrowRightLeft, CheckCircle2, 
  AlertCircle, Shield, ArrowRight, UserCheck, Search, Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Job } from '../../hooks/shared/useJobs';

interface WorkloadAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeJobs: Job[];
  employees: any[];
  selectedEmployeeId?: string;
  onSuccess?: () => void;
}

export const WorkloadAllocationModal: React.FC<WorkloadAllocationModalProps> = ({
  isOpen,
  onClose,
  activeJobs,
  employees,
  selectedEmployeeId,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [sourceEmployeeId, setSourceEmployeeId] = useState<string>(selectedEmployeeId || 'all');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update source employee if selectedEmployeeId prop changes
  React.useEffect(() => {
    if (selectedEmployeeId) {
      setSourceEmployeeId(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Available jobs to reallocate
  const candidateJobs = useMemo(() => {
    return activeJobs.filter(job => {
      // Must be non-completed
      if (job.status === 'completed' || job.status === 'cancelled') return false;

      // Filter by source employee if not 'all'
      if (sourceEmployeeId !== 'all' && job.employee_id !== sourceEmployeeId) {
        return false;
      }

      // Search match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeMatch = job.job_code?.toLowerCase().includes(term);
        const clientMatch = job.client_name?.toLowerCase().includes(term);
        const serviceMatch = job.service_name?.toLowerCase().includes(term);
        const staffMatch = job.employee_name?.toLowerCase().includes(term);
        return codeMatch || clientMatch || serviceMatch || staffMatch;
      }

      return true;
    });
  }, [activeJobs, sourceEmployeeId, searchTerm]);

  const toggleSelectJob = (id: string) => {
    setSelectedJobIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedJobIds.length === candidateJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(candidateJobs.map(j => j.id));
    }
  };

  const handleReassign = async () => {
    if (!targetEmployeeId) {
      toast.error('Please choose a target staff member to assign the jobs to');
      return;
    }
    if (selectedJobIds.length === 0) {
      toast.error('Please select at least one job to reallocate');
      return;
    }

    const targetEmp = employees.find(e => e.id === targetEmployeeId);
    if (!targetEmp) {
      toast.error('Target employee not found');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          employee_id: targetEmployeeId,
          assigned_by: profile?.id,
          assigned_by_role: profile?.role === 'admin' ? 'admin' : 'employee',
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedJobIds);

      if (error) throw error;

      toast.success(
        `Successfully transferred ${selectedJobIds.length} job${selectedJobIds.length > 1 ? 's' : ''} to ${targetEmp.full_name || 'selected employee'}`
      );

      // Invalidate queries to refresh state across the app
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });

      setSelectedJobIds([]);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Job reassignment error:', err);
      toast.error(err.message || 'Failed to reallocate jobs');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const targetEmpObj = employees.find(e => e.id === targetEmployeeId);
  const sourceEmpObj = employees.find(e => e.id === sourceEmployeeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-syne font-bold text-foreground">
                Staff Workload & Job Delegation
              </h2>
              <p className="text-xs text-muted-foreground">
                Reassign active jobs to balance operational capacity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Filter & Transfer Route */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
            {/* Source Employee Filter */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Filter From (Current Handler)
              </label>
              <select
                value={sourceEmployeeId}
                onChange={(e) => {
                  setSourceEmployeeId(e.target.value);
                  setSelectedJobIds([]);
                }}
                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-primary"
              >
                <option value="all">All Staff Members / Any Active Job</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Employee Selector */}
            <div>
              <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <UserCheck size={14} /> Assign Selected Jobs To (New Handler) *
              </label>
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-primary/50 focus:border-primary rounded-xl text-sm font-medium text-foreground focus:outline-none ring-1 ring-primary/20"
              >
                <option value="">-- Select Target Employee --</option>
                {employees
                  .filter(emp => emp.id !== sourceEmployeeId)
                  .map(emp => {
                    const currentLoad = activeJobs.filter(j => j.employee_id === emp.id && j.status !== 'completed' && j.status !== 'cancelled').length;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} — ({currentLoad} active jobs currently)
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Job Selection Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Select Jobs to Reassign ({selectedJobIds.length} of {candidateJobs.length} selected)
                </h3>
                {candidateJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-primary font-semibold hover:underline ml-2"
                  >
                    {selectedJobIds.length === candidateJobs.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search code, client, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Candidate Jobs List */}
            <div className="border border-border rounded-xl divide-y divide-border/60 max-h-72 overflow-y-auto bg-card">
              {candidateJobs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No active jobs found for the selected filter.
                </div>
              ) : (
                candidateJobs.map((job) => {
                  const isSelected = selectedJobIds.includes(job.id);
                  return (
                    <div
                      key={job.id}
                      onClick={() => toggleSelectJob(job.id)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by row onClick
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-primary">
                              {job.job_code}
                            </span>
                            <span className="text-[10px] uppercase font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {job.status?.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-foreground mt-0.5">
                            {job.client_name} — <span className="text-muted-foreground font-normal">{job.service_name}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <span className="text-muted-foreground block text-[10px]">Current Handler</span>
                        <span className="font-semibold text-foreground">
                          {job.employee_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Transfer Summary Preview */}
          {selectedJobIds.length > 0 && targetEmpObj && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">Ready to Reallocate</h4>
                  <p className="text-xs text-muted-foreground">
                    Transferring <span className="font-bold text-foreground">{selectedJobIds.length}</span> active job(s) to{' '}
                    <span className="font-bold text-emerald-500">{targetEmpObj.full_name}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-border hover:bg-muted rounded-xl text-xs font-bold text-muted-foreground transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleReassign}
            disabled={isSubmitting || selectedJobIds.length === 0 || !targetEmployeeId}
            className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Updating assignments...</span>
            ) : (
              <>
                <ArrowRightLeft size={14} />
                <span>Confirm Delegation ({selectedJobIds.length})</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
