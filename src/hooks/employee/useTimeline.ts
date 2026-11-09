import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  job_service_id: string;
  job_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_by_role: 'ops' | 'pro' | 'sales' | 'admin' | 'manager' | null;
  days_in_previous_stage: number | null;
  changed_at: string;
  reason: string | null;
  government_ref: string | null;
  is_delay_event: boolean;
  is_client_caused: boolean;
  service_name?: string | null;  // snapshot of service name at time of change
}

export interface StatusUpdatePayload {
  jobServiceId: string;
  jobId: string;
  fromStatus: string;
  toStatus: string;
  serviceName?: string;        // for snapshot in timeline
  reason?: string;
  governmentRef?: string;
  isDelayEvent?: boolean;
  isClientCaused?: boolean;
  applicantName?: string;
  proId?: string;
  proNotes?: string;
  holdReason?: string;
  rejectionReason?: string;
  notes?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
}

// ─── Fetch timeline for a job_service ────────────────────────────────────────

export function useJobServiceTimeline(jobServiceId: string | null) {
  return useQuery({
    queryKey: ['job_service_timeline', jobServiceId],
    queryFn: async () => {
      if (!jobServiceId) return [];
      const { data, error } = await (supabase
        .from('job_service_timeline')
        .select('*')
        .eq('job_service_id', jobServiceId)
        .order('changed_at', { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as TimelineEntry[];
    },
    enabled: !!jobServiceId,
  });
}

// ─── Fetch all timeline entries for a job (manager accountability view) ───────

export function useJobTimeline(jobId: string | null) {
  return useQuery({
    queryKey: ['job_timeline', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await (supabase
        .from('job_service_timeline')
        .select(`
          *,
          changer:profiles!job_service_timeline_changed_by_fkey(full_name, role, is_pro, can_do_ops, can_do_sales),
          service:job_services!job_service_timeline_job_service_id_fkey(service_name)
        `)
        .eq('job_id', jobId)
        .order('changed_at', { ascending: true }) as any);
      if (error) throw error;
      // Merge service_name onto each entry for easy access
      return (data || []).map((row: any) => ({
        ...row,
        service_name: row.service?.service_name || row.service_name || null
      })) as (TimelineEntry & { changer: any })[];
    },
    enabled: !!jobId,
  });
}

// ─── Main mutation: update status + write timeline row ────────────────────────

export function useUpdateServiceStatus() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StatusUpdatePayload) => {
      const now = new Date().toISOString();

      // 1. Calculate days_in_previous_stage
      const { data: currentService } = await (supabase
        .from('job_services')
        .select('status, started_at, updated_at, created_at')
        .eq('id', payload.jobServiceId)
        .single() as any);

      let daysInPrevStage: number | null = null;
      const prevTimestamp = currentService?.updated_at || currentService?.created_at;
      if (prevTimestamp) {
        const diff = (Date.now() - new Date(prevTimestamp).getTime()) / (1000 * 60 * 60 * 24);
        daysInPrevStage = Math.round(diff * 10) / 10;
      }

      // 2. Determine changer role
      let changerRole: string = 'ops';
      if (profile?.role === 'admin') changerRole = 'admin';
      else if (profile?.is_manager) changerRole = 'manager';
      else if (profile?.is_pro) changerRole = 'pro';
      else if (profile?.can_do_sales && !profile?.can_do_ops) changerRole = 'sales';
      else changerRole = 'ops';

      // 3. Build job_service update payload
      const serviceUpdate: any = {
        status: payload.toStatus,
        updated_at: now,
        notes: payload.notes || undefined,
      };
      if (payload.applicantName) serviceUpdate.applicant_name = payload.applicantName;
      if (payload.governmentRef) serviceUpdate.government_ref = payload.governmentRef;
      if (payload.proId) {
        serviceUpdate.pro_id = payload.proId;
        serviceUpdate.pro_shared_at = now;
        serviceUpdate.assigned_by = profile?.id;
      }
      if (payload.proNotes) serviceUpdate.pro_notes = payload.proNotes;
      if (payload.holdReason) {
        serviceUpdate.pending_reason = payload.holdReason;
        serviceUpdate.is_delayed = true;
        serviceUpdate.delay_reason = payload.holdReason;
        serviceUpdate.delay_updated_at = now;
        serviceUpdate.delay_updated_by = profile?.id;
      }
      if (payload.rejectionReason) serviceUpdate.rejection_reason = payload.rejectionReason;
      if (payload.toStatus === 'in_progress' && !currentService?.started_at) {
        serviceUpdate.started_at = now;
      }
      if (payload.toStatus === 'completed') {
        serviceUpdate.completed_at = now;
        serviceUpdate.is_delayed = false;
      }
      if (payload.toStatus === 'gov_approved') {
        serviceUpdate.government_approved_at = now;
      }
      if (payload.toStatus === 'cancelled' && payload.reason) {
        serviceUpdate.cancellation_reason = payload.reason;
      }
      if (payload.toStatus === 'gov_approved' || payload.toStatus === 'completed') {
        if (payload.issueDate !== undefined) serviceUpdate.issue_date = payload.issueDate;
        if (payload.expiryDate !== undefined) serviceUpdate.expiry_date = payload.expiryDate;
      }

      // 4. Update job_service
      const { error: updateError } = await (supabase
        .from('job_services')
        .update(serviceUpdate)
        .eq('id', payload.jobServiceId) as any);
      if (updateError) throw updateError;

      // 5. Write timeline entry
      const timelineRow: any = {
        job_service_id: payload.jobServiceId,
        job_id: payload.jobId,
        from_status: payload.fromStatus,
        to_status: payload.toStatus,
        changed_by: profile?.id || null,
        changed_by_name: profile?.full_name || null,
        changed_by_role: changerRole,
        days_in_previous_stage: daysInPrevStage,
        changed_at: now,
        reason: payload.reason || payload.holdReason || payload.rejectionReason || null,
        government_ref: payload.governmentRef || null,
        is_delay_event: payload.isDelayEvent || payload.toStatus === 'on_hold' || false,
        is_client_caused: payload.isClientCaused || false,
      };
      // Include service_name snapshot if passed
      if (payload.serviceName) {
        timelineRow.service_name = payload.serviceName;
      }
      const { error: timelineError } = await (supabase
        .from('job_service_timeline')
        .insert(timelineRow) as any);
      if (timelineError) throw timelineError;

      return { success: true };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['job_services', variables.jobId] });
      qc.invalidateQueries({ queryKey: ['job_service_timeline', variables.jobServiceId] });
      qc.invalidateQueries({ queryKey: ['job_timeline', variables.jobId] });
      qc.invalidateQueries({ queryKey: ['ops_my_tasks'] });
      qc.invalidateQueries({ queryKey: ['pro_queue'] });
    },
  });
}

// ─── Fetch ops employee's assigned tasks (My Tasks queue) ─────────────────────

export function useMyOpsTasks(employeeId: string | null) {
  return useQuery({
    queryKey: ['ops_my_tasks', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await (supabase
        .from('job_services')
        .select(`
          *,
          job:jobs(
            id, job_code, status,
            client:profiles!jobs_client_id_fkey(id, full_name, phone, is_trusted),
            assigned_by_profile:profiles!jobs_assigned_by_fkey(full_name)
          ),
          service:services(name_en, name_ar, requires_pro, estimated_days),
          ops_employee:profiles!job_services_ops_employee_id_fkey(full_name),
          assigner:profiles!job_services_assigned_by_fkey(full_name),
          documents:job_service_documents(*),
          expenses:job_expenses(*)
        `)
        .eq('ops_employee_id', employeeId)
        .order('target_completion_date', { ascending: true, nullsFirst: false }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
    refetchInterval: 30000, // refresh every 30s
  });
}

// ─── Fetch PRO agent's assigned items ─────────────────────────────────────────

export function useProQueue(proId: string | null) {
  return useQuery<any[]>({
    queryKey: ['pro_queue', proId],
    queryFn: async () => {
      if (!proId) return [];
      const { data, error } = await (supabase
        .from('job_services')
        .select(`
          *,
          job:jobs(
            id, job_code,
            client:profiles!jobs_client_id_fkey(id, full_name, phone)
          ),
          service:services(name_en, name_ar, requires_pro),
          assigner:profiles!job_services_assigned_by_fkey(full_name),
          documents:job_service_documents(*)
        `)
        .eq('pro_id', proId)
        .order('pro_shared_at', { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!proId,
    refetchInterval: 30000,
  });
}

// ─── Assign service to ops employee (sales use) ───────────────────────────────

export function useAssignServiceToOps() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobServiceId,
      jobId,
      opsEmployeeId,
      targetDate,
      estimatedDays,
    }: {
      jobServiceId: string;
      jobId: string;
      opsEmployeeId: string;
      targetDate?: string;
      estimatedDays?: number;
    }) => {
      const now = new Date().toISOString();
      const { error } = await (supabase
        .from('job_services')
        .update({
          ops_employee_id: opsEmployeeId,
          assigned_by: profile?.id,
          assigned_at: now,
          target_completion_date: targetDate || null,
          estimated_days: estimatedDays || null,
          updated_at: now,
        })
        .eq('id', jobServiceId) as any);
      if (error) throw error;

      // Write timeline entry for assignment
      await (supabase.from('job_service_timeline').insert({
        job_service_id: jobServiceId,
        job_id: jobId,
        from_status: null,
        to_status: 'assigned',
        changed_by: profile?.id,
        changed_by_name: profile?.full_name,
        changed_by_role: 'sales',
        reason: `Assigned to ops employee`,
        changed_at: now,
        is_delay_event: false,
        is_client_caused: false,
      } as any) as any);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['job_services', variables.jobId] });
      qc.invalidateQueries({ queryKey: ['ops_my_tasks'] });
    },
  });
}
