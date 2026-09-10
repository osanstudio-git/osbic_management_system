import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ChevronLeft, Briefcase, AlertCircle, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PackageGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Guard access
  if (profile && !profile.can_do_sales) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-20 h-20 bg-red-400/10 rounded-3xl flex items-center justify-center text-red-400 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-8 max-w-sm">You do not have permission to view this page.</p>
      </div>
    );
  }

  // Fetch package job group details
  const { data: group, isLoading: isGroupLoading } = useQuery({
    queryKey: ['package_job_group', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_job_groups')
        .select('*, client:profiles!client_id(full_name), package:service_packages!package_id(name_en)')
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch jobs in the group
  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['package_job_group_jobs', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, service:services!service_id(name_en), ops:profiles!ops_employee_id(full_name)')
        .eq('package_group_id', id!);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch operations employees
  const { data: opsEmployees } = useQuery({
    queryKey: ['operations_employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee')
        .eq('can_do_ops', true);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Assign ops employee mutation
  const assignOpsMutation = useMutation({
    mutationFn: async ({ jobId, opsEmployeeId }: { jobId: string, opsEmployeeId: string | null }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          ops_employee_id: opsEmployeeId || null,
          status: opsEmployeeId ? 'active' : 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package_job_group_jobs', id] });
      toast.success('Operations employee assigned successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Assignment failed');
    }
  });

  const isLoading = isGroupLoading || isJobsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Package Group Not Found</h2>
        <Link to="/employee/leads" className="text-primary hover:underline">Back to Leads</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link to="/employee/leads" className="p-2 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <span className="text-sm text-muted-foreground">Back to Workspace</span>
      </div>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Zap size={150} className="text-primary" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-primary/20">
              Package Job Group
            </span>
            <span className="text-xs font-mono text-muted-foreground font-medium bg-muted/40 px-2.5 py-0.5 rounded border border-border">
              {group.group_code}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold text-foreground mb-1">
              {group.package?.name_en || 'Custom Bundle Package'}
            </h1>
            <p className="text-sm text-muted-foreground">Client: <span className="text-foreground font-bold">{group.client?.full_name}</span></p>
          </div>
        </div>
      </div>

      {/* Jobs Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-syne font-bold text-foreground flex items-center gap-2">
          <Briefcase size={20} className="text-primary" />
          <span>Services in Bundle ({jobs?.length || 0})</span>
        </h2>

        <div className="space-y-4">
          {jobs?.map((job) => (
            <div 
              key={job.id} 
              className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-gold/10 transition-colors"
            >
              {/* Job Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded">
                    {job.job_code}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    job.status === 'draft' ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground">{job.service?.name_en}</h3>
              </div>

              {/* Assignment Form */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap md:flex-nowrap">
                <div className="relative min-w-[200px]">
                  <select
                    value={job.ops_employee_id || ''}
                    onChange={e => {
                      const empId = e.target.value || null;
                      const targetName = opsEmployees?.find(emp => emp.id === empId)?.full_name || 'Unassigned';
                      if (window.confirm(`Are you sure you want to assign this job to ${targetName}?`)) {
                        assignOpsMutation.mutate({ jobId: job.id, opsEmployeeId: empId });
                      }
                    }}
                    className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-gold transition-colors appearance-none pr-8 cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground">Unassigned (Draft)</option>
                    {opsEmployees?.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-card text-foreground">{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                
                <span className="text-xs font-medium text-muted-foreground">
                  {job.ops?.full_name ? `Assigned to: ${job.ops.full_name}` : 'Unassigned'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
