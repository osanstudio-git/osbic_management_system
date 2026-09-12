import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../types/database';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Job {
  id: string;
  job_code: string;
  client_id: string;
  client_name: string;
  client_avatar?: string;
  service_category: string;
  service_name: string;
  employee_id: string;
  employee_name: string;
  employee_avatar?: string;
  assigned_by?: string | null;
  assigned_by_role?: 'admin' | 'employee' | 'client';
  status: 'active' | 'on_hold' | 'completed' | 'cancelled' | 'pending' | string;
  started_date: string;
  expected_completion: string;
  days_active: number;
  total_steps: number;
  completed_steps: number;
  total_fee: number;
  work_fee: number;
  ministry_fee: number;
  advance_paid: boolean;
  remaining_paid: boolean;
  advance_due_amount: number;
  advance_receipt_url?: string;
  remaining_due_amount: number;
  remaining_receipt_url?: string;
  notes?: string | null;
  documents?: JobDocument[];
  client_rating?: number | null;
  client_feedback?: string | null;
  ops_employee_id?: string;
  sales_employee_id?: string;
  sales_employee_name?: string;
  is_operator?: boolean;
  entry_type?: 'lead' | 'walkin' | 'direct' | 'renewal' | null;
  client_pays_ministry_fee?: boolean;
  estimated_days?: number | null;
}

export interface JobStep {
  id: string;
  job_id: string;
  step_definition_id: string;
  name_en: string;
  name_ar: string;
  order_index: number;
  assigned_to?: string | null;
  assigned_by?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'skipped';
  is_client_visible: boolean;
  started_at?: string | null;
  completed_at?: string | null;
  deadline?: string | null;           // New: SLA Deadline
  completed_by_name?: string;
  rejection_reason?: string;
  extension_reason?: string;          // New: Reason for extension
  required_docs: string[];
  estimated_hours?: number;           // New: Step Duration
  estimated_gov_fee?: number;         // New: Estimated ministry cost
  actual_gov_fee?: number;            // New: Actual recorded cost
  notes?: string | null;              // New: Completion Notes
}

export interface JobDocument {
  id: string;
  job_id: string;
  step_id?: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_by_name: string;
  uploaded_by_role?: string;
  uploaded_by?: string;
  uploaded_at: string;
  status: 'approved' | 'pending' | 'rejected';
  rejection_reason?: string;
  is_client_visible?: boolean;
  applicant_name?: string;
  service_name?: string;
  document_type?: string;
  is_checklist_doc?: boolean;
  document_category?: string;
}

export interface JobMessage {
  id: string;
  job_id: string;
  sender_id: string;
  sender_type: 'employee' | 'client' | 'admin';
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
  conversation_scope?: 'staff_client' | 'admin_client';
}

export interface JobAuditLog {
  id: string;
  job_id: string;
  action: string;
  actor_name: string;
  timestamp: string;
  details: string;
}

// ─── Admin / Branch Manager: All Jobs ──────────────────────────────────────────
export const useAdminJobs = (branchIdFilter?: string | null) => {
  return useQuery({
    queryKey: ['admin', 'jobs', branchIdFilter],
    queryFn: async (): Promise<Job[]> => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name, avatar_url),
          employee:profiles!employee_id(full_name, avatar_url),
          sales_employee:profiles!sales_employee_id(full_name),
          service:services!service_id(name_en, category, estimated_days),
          job_steps(status, actual_gov_fee, workflow_step_id, step_def:workflow_steps!workflow_step_id(estimated_gov_fee))
        `)
        .order('created_at', { ascending: false });

      if (branchIdFilter) {
        query = query.eq('branch_id', branchIdFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((j: any) => {
        const totalSteps = j.job_steps?.length || 0;
        const completedSteps = j.job_steps?.filter((s: any) => s.status === 'completed').length || 0;
        
        return {
          id: j.id,
          job_code: j.job_code || 'UNTITLED',
          client_id: j.client_id,
          client_name: j.client?.full_name || 'Anonymous Client',
          client_avatar: j.client?.avatar_url,
          service_name: j.custom_name || j.service?.name_en || 'Standard Service',
          service_category: j.service?.category || 'other',
          employee_id: j.employee_id,
          employee_name: j.employee?.full_name || 'Unassigned',
          sales_employee_name: j.sales_employee?.full_name || 'N/A',
          employee_avatar: j.employee?.avatar_url,
          status: j.status || 'pending',
          started_date: j.started_at || j.created_at,
          expected_completion: j.created_at,
          days_active: Math.ceil((Date.now() - new Date(j.created_at).getTime()) / 86400000),
          total_steps: totalSteps,
          completed_steps: completedSteps,
          total_fee: Number(j.total_fee) || 0,
          work_fee: Number(j.work_fee) || 0,
          ministry_fee: Number(j.ministry_fee) || 0,
           advance_paid: j.advance_paid ?? false,
          remaining_paid: j.remaining_paid ?? false,
          advance_due_amount: Number(j.advance_amount) || 0,
          remaining_due_amount: Number(j.remaining_amount) || 0,
          advance_receipt_url: j.advance_receipt_url,
          remaining_receipt_url: j.remaining_receipt_url,
          notes: j.notes,
          client_rating: j.client_rating,
          client_feedback: j.client_feedback,
          entry_type: j.entry_type,
          branch_id: j.branch_id,
          service_id: j.service_id,
          client_pays_ministry_fee: j.client_pays_ministry_fee ?? false,
          estimated_days: j.service?.estimated_days ?? null,
        };
      });
    },
  });
};// ─── Employee: My Jobs ────────────────────────────────────────────────────────
export const useEmployeeJobs = (employeeId: string) => {
  return useQuery({
    queryKey: ['employee', 'jobs', employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<Job[]> => {
      // 1. Fetch jobs the employee owns
      const { data: ownedData, error: ownedError } = await supabase
        .from('jobs')
        .select(`
          *,
          assigner:profiles!assigned_by(role),
          client:profiles!client_id(full_name, avatar_url),
          service:services!service_id(name_en, category, estimated_days),
          job_steps(id, status, actual_gov_fee, workflow_step_id, assigned_to, assigned_by),
          job_services(id, ops_employee_id)
        `)
        .or(`employee_id.eq.${employeeId},assigned_by.eq.${employeeId},ops_employee_id.eq.${employeeId},sales_employee_id.eq.${employeeId}`);

      if (ownedError) throw ownedError;

      // 2. Fetch steps & services assigned to the employee
      const { data: stepsData, error: stepsError } = await supabase
        .from('job_steps')
        .select('job_id')
        .eq('assigned_to', employeeId);
        
      if (stepsError) throw stepsError;

      const { data: servicesData, error: servicesError } = await supabase
        .from('job_services')
        .select('job_id')
        .eq('ops_employee_id', employeeId);

      if (servicesError) throw servicesError;

      // Find jobs they are assigned a step or service in, but DO NOT own
      let delegatedData: any[] = [];
      const delegatedJobIds = Array.from(new Set([
        ...(stepsData || []).map((s: any) => s.job_id),
        ...(servicesData || []).map((s: any) => s.job_id)
      ])).filter(id => !(ownedData || []).some((oj: any) => oj.id === id));

      if (delegatedJobIds.length > 0) {
        const { data: dJobs, error: dError } = await supabase
          .from('jobs')
          .select(`
            *,
            assigner:profiles!assigned_by(role),
            client:profiles!client_id(full_name, avatar_url),
            service:services!service_id(name_en, category, estimated_days),
            job_steps(id, status, actual_gov_fee, workflow_step_id, assigned_to, assigned_by),
            job_services(id, ops_employee_id)
          `)
          .in('id', delegatedJobIds);
          
        if (dError) throw dError;
        delegatedData = dJobs;
      }

      // 3. Combine and Map
      const allJobs = [...(ownedData || []), ...(delegatedData || [])];

      return allJobs.map((j: any) => {
        const totalSteps = j.job_steps?.length || 0;
        const completedSteps = j.job_steps?.filter((s: any) => s.status === 'completed').length || 0;
        
        // Determine the "assigner" for this context. 
        // If they own the job, the job's assigned_by is used.
        // If they only own a step, we find the step they are assigned to and use its assigned_by.
        let resolvedAssignedBy = j.assigned_by;
        let resolvedAssignedByRole = j.assigner?.role;
        
        if (j.employee_id !== employeeId) {
           const specificStep = j.job_steps?.find((s: any) => s.assigned_to === employeeId);
           if (specificStep) {
              resolvedAssignedBy = specificStep.assigned_by;
              // If the step assigner is the same as the job assigner, we know their role
              if (resolvedAssignedBy === j.assigned_by) {
                resolvedAssignedByRole = j.assigner?.role;
              } else if (resolvedAssignedBy === employeeId) {
                resolvedAssignedByRole = 'employee';
              } else {
                // Fallback: assume manager if delegated by someone else
                resolvedAssignedByRole = 'manager';
              }
           }
        }

        const isOperator = 
          j.employee_id === employeeId || 
          j.ops_employee_id === employeeId || 
          (j.job_steps && j.job_steps.some((s: any) => s.assigned_to === employeeId)) ||
          (j.job_services && j.job_services.some((s: any) => s.ops_employee_id === employeeId));

        return {
          id: j.id,
          job_code: j.job_code,
          client_id: j.client_id,
          client_name: j.client?.full_name ?? 'Unknown',
          service_name: j.custom_name || j.service?.name_en || 'Unknown',
          service_category: j.service?.category ?? 'other',
          employee_id: j.employee_id,
          employee_name: 'Me',
          assigned_by: resolvedAssignedBy,
          assigned_by_role: resolvedAssignedByRole,
          status: j.status,
          started_date: j.started_at ?? j.created_at,
          expected_completion: j.created_at,
          days_active: Math.ceil((Date.now() - new Date(j.started_at ?? j.created_at).getTime()) / 86400000),
          total_steps: totalSteps,
          completed_steps: completedSteps,
          total_fee: Number(j.total_fee) || 0,
          work_fee: Number(j.work_fee) || 0,
          ministry_fee: Number(j.ministry_fee) || 0,
          advance_paid: j.advance_paid ?? false,
          remaining_paid: j.remaining_paid ?? false,
          advance_due_amount: Number(j.advance_amount) || 0,
          remaining_due_amount: Number(j.remaining_amount) || 0,
          notes: j.notes,
          ops_employee_id: j.ops_employee_id,
          sales_employee_id: j.sales_employee_id,
          is_operator: isOperator,
          entry_type: j.entry_type,
          service_id: j.service_id,
          client_pays_ministry_fee: j.client_pays_ministry_fee ?? false,
          estimated_days: j.service?.estimated_days ?? null,
        };
      }).sort((a, b) => new Date(b.started_date).getTime() - new Date(a.started_date).getTime());
    },
  });
};

// ─── Client: My Jobs ──────────────────────────────────────────────────────────
export const useClientJobs = (clientId: string) => {
  return useQuery({
    queryKey: ['client', 'jobs', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          employee:profiles!employee_id(full_name, avatar_url),
          service:services!service_id(name_en, category, estimated_days),
          job_steps(status, actual_gov_fee, workflow_step_id)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((j: any) => {
        const totalSteps = j.job_steps?.length || 0;
        const completedSteps = j.job_steps?.filter((s: any) => s.status === 'completed').length || 0;
        
        return {
          id: j.id,
          job_code: j.job_code,
          client_id: j.client_id,
          client_name: 'Me',
          service_name: j.custom_name || j.service?.name_en || 'Unknown',
          service_category: j.service?.category ?? 'other',
          employee_id: j.employee_id,
          employee_name: j.employee?.full_name ?? 'Unassigned',
          status: j.status,
          started_date: j.started_at ?? j.created_at,
          expected_completion: j.created_at,
          days_active: Math.ceil((Date.now() - new Date(j.started_at ?? j.created_at).getTime()) / 86400000),
          total_steps: totalSteps,
          completed_steps: j.job_steps?.filter((s: any) => s.status === 'completed').length ?? 0,
          total_fee: Number(j.total_fee) || 0,
          work_fee: Number(j.work_fee) || 0,
          ministry_fee: Number(j.ministry_fee) || 0,
          advance_paid: j.advance_paid ?? false,
          remaining_paid: j.remaining_paid ?? false,
          advance_due_amount: Number(j.advance_amount) || 0,
          remaining_due_amount: Number(j.remaining_amount) || 0,
          advance_receipt_url: j.advance_receipt_url,
          remaining_receipt_url: j.remaining_receipt_url,
          client_rating: j.client_rating,
          client_feedback: j.client_feedback,
          entry_type: j.entry_type,
          client_pays_ministry_fee: j.client_pays_ministry_fee ?? false,
          estimated_days: j.service?.estimated_days ?? null,
        };
      });
    },
  });
};
export const useJobDetail = (jobId: string) => {
  return useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          client:profiles!client_id(full_name, avatar_url),
          employee:profiles!employee_id(full_name, avatar_url),
          service:services!service_id(name_en, category, estimated_days)
        `)
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      const j = jobData as any;

      const { data: stepsData } = await supabase
        .from('job_steps')
        .select(`
          *,
          step_def:workflow_steps!workflow_step_id(
            name_en, 
            name_ar, 
            is_client_visible, 
            required_documents, 
            step_order, 
            estimated_hours,
            estimated_gov_fee
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      const { data: docsData } = await supabase
        .from('documents')
        .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name, role)')
        .eq('job_id', jobId);

      const { data: serviceDocsData } = await supabase
        .from('job_service_documents')
        .select(`
          *,
          uploader:profiles!uploaded_by(full_name, role),
          job_service:job_services!job_service_id(applicant_name, service_name)
        `)
        .eq('job_id', jobId)
        .not('file_path', 'is', null);

      const { data: msgData } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(full_name, role)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      const job: Job = {
        id: j.id,
        job_code: j.job_code,
        client_id: j.client_id,
        client_name: j.client?.full_name ?? 'Unknown',
        service_name: j.custom_name || j.service?.name_en || 'Unknown',
        service_category: j.service?.category ?? 'other',
        employee_id: j.employee_id,
        employee_name: j.employee?.full_name ?? 'Unassigned',
        status: j.status,
        started_date: j.started_at ?? j.created_at,
        expected_completion: j.created_at,
        days_active: Math.ceil((Date.now() - new Date(j.started_at ?? j.created_at).getTime()) / 86400000),
        total_steps: stepsData?.length ?? 0,
        completed_steps: stepsData?.filter((s: any) => s.status === 'completed').length ?? 0,
        total_fee: Number(j.total_fee) || 0,
        work_fee: Number(j.work_fee) || 0,
        ministry_fee: Number(j.ministry_fee) || 0,
        advance_paid: j.advance_paid ?? false,
        remaining_paid: j.remaining_paid ?? false,
        advance_due_amount: Number(j.advance_amount) || 0,
        remaining_due_amount: Number(j.remaining_amount) || 0,
        advance_receipt_url: j.advance_receipt_url,
        remaining_receipt_url: j.remaining_receipt_url,
        documents: docsData || [],
        client_rating: j.client_rating,
        client_feedback: j.client_feedback,
        client_pays_ministry_fee: j.client_pays_ministry_fee ?? false,
        estimated_days: j.service?.estimated_days ?? null,
      };

      const steps: JobStep[] = (stepsData || []).map((s: any) => ({
        id: s.id,
        job_id: jobId,
        step_definition_id: s.workflow_step_id,
        name_en: s.step_def?.name_en ?? s.custom_name ?? 'Step',
        name_ar: s.step_def?.name_ar ?? s.custom_name ?? '',
        order_index: s.step_def?.step_order ?? 0,
        status: s.status,
        is_client_visible: s.is_client_visible ?? s.step_def?.is_client_visible ?? true,
        notes: s.notes,
        started_at: s.started_at,
        completed_at: s.completed_at,
        deadline: s.deadline,
        extension_reason: s.extension_reason,
        required_docs: s.step_def?.required_documents ?? [],
        estimated_hours: s.step_def?.estimated_hours ?? 0,
        estimated_gov_fee: Number(s.step_def?.estimated_gov_fee) || 0,
        actual_gov_fee: Number(s.actual_gov_fee) || 0,
      }));

      const generalDocs = (docsData || []).map((d: any) => ({
        id: d.id,
        job_id: jobId,
        file_name: d.file_name,
        file_path: d.file_path,
        file_type: d.file_type || 'document',
        uploaded_by_name: d.uploader?.full_name ?? 'Unknown',
        uploaded_by_role: d.uploader?.role ?? 'client',
        uploaded_by: d.uploaded_by,
        uploaded_at: d.created_at,
        status: d.status,
        is_client_visible: d.is_client_visible ?? true,
        is_checklist_doc: false,
      }));

      const serviceDocs = (serviceDocsData || []).map((d: any) => ({
        id: d.id,
        job_id: jobId,
        file_name: d.file_name ?? d.document_name,
        file_path: d.file_path,
        file_type: d.file_type || 'document',
        uploaded_by_name: d.uploader?.full_name ?? 'Unknown',
        uploaded_by_role: d.uploader?.role ?? 'client',
        uploaded_by: d.uploaded_by,
        uploaded_at: d.created_at,
        status: d.status,
        is_client_visible: d.is_client_visible ?? false,
        applicant_name: d.job_service?.applicant_name,
        service_name: d.job_service?.service_name,
        document_type: d.document_name,
        is_checklist_doc: true,
        document_category: d.document_category
      }));

      const documents: JobDocument[] = [...generalDocs, ...serviceDocs];

      const messages: JobMessage[] = (msgData || []).map((m: any) => ({
        id: m.id,
        job_id: jobId,
        sender_id: m.sender_id,
        sender_type: m.sender?.role || 'client',
        sender_name: m.sender?.full_name ?? 'Unknown',
        content: m.content,
        is_read: m.is_read ?? true,
        created_at: m.created_at,
        conversation_scope: m.conversation_scope ?? 'staff_client',
      }));

      return { job, steps, documents, messages, payments: [], logs: [] };
    },
  });
};

// ─── Create Job ───────────────────────────────────────────────────────────────
const _createInternalJob = async (supabase: any, jobData: any, isAdmin: boolean, profileId?: string) => {
  const jobCode = `JOB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
  const wFee = Number(jobData.work_fee) || 30;
  const mFee = Number(jobData.ministry_fee) || 20;
  const totalFee = wFee + mFee;
  const advanceAmount = (totalFee * 50) / 100;
  const remainingAmount = totalFee - advanceAmount;

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      job_code: jobCode,
      client_id: jobData.client_id,
      employee_id: jobData.employee_id,
      service_id: jobData.service_id,
      total_fee: totalFee,
      work_fee: wFee,
      ministry_fee: mFee,
      advance_amount: advanceAmount,
      remaining_amount: remainingAmount,
      status: 'active',
      advance_paid: false,
      remaining_paid: false,
      notes: jobData.notes,
    } as any)
    .select()
    .single();

  if (error) throw error;
  const job = data as any;

  const { data: blueprint } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('service_id', jobData.service_id)
    .order('step_order', { ascending: true });

  if (blueprint && blueprint.length > 0) {
    const stepsToInsert = blueprint.map((step: any) => {
      const isAutoFill = step.required_documents?.some((docType: string) => 
        jobData.auto_complete_docs?.includes(docType)
      );

      let deadline = null;
      if (step.estimated_hours) {
        const date = new Date();
        date.setHours(date.getHours() + step.estimated_hours);
        deadline = date.toISOString();
      }

      return {
        job_id: job.id,
        workflow_step_id: step.id,
        status: isAutoFill ? 'completed' : 'pending',
        started_at: isAutoFill ? new Date().toISOString() : null,
        completed_at: isAutoFill ? new Date().toISOString() : null,
        is_client_visible: step.is_client_visible ?? true,
        deadline: deadline,
        notes: isAutoFill ? 'Auto-completed via Digital Vault' : null
      };
    });

    const { error: stepsError } = await supabase.from('job_steps').insert(stepsToInsert as any);
    if (stepsError) throw new Error(`Roadmap Initialization Failed: ${stepsError.message}`);
  }

  await supabase.from('notifications').insert({
    recipient_id: jobData.employee_id,
    sender_id: isAdmin ? profileId : null,
    job_id: job.id,
    type: 'assignment',
    title_en: 'New Project Assigned',
    title_ar: 'تم تكليفك بمشروع جديد',
    body_en: `You have been assigned to job ${jobCode}.`,
    body_ar: `تم تعيينك للعمل على الطلب رقم ${jobCode}.`,
    action_url: `/employee/tasks?jobId=${job.id}`
  } as any);

  return job;
};

export const useCreateJob = () => {
  const qc = useQueryClient();
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';

  return useMutation({
    mutationFn: (jobData: any) => _createInternalJob(supabase, jobData, isAdmin, profile?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useCreatePackageJobs = () => {
  const qc = useQueryClient();
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';

  return useMutation({
    mutationFn: async (data: {
      client_id: string;
      employee_id: string;
      package_id: string;
      services: any[];
      discount_percentage: number;
      notes?: string;
      auto_complete_docs?: string[];
      custom_work_fee?: number;
      custom_ministry_fee?: number;
    }) => {
      const discountFactor = 1 - (data.discount_percentage / 100);
      
      let totalWorkFee = 0;
      let totalMinistryFee = 0;
      
      data.services.forEach(s => {
        totalWorkFee += (Number(s.work_fee) || 30);
        totalMinistryFee += (Number(s.ministry_fee) || 20);
      });

      const discountedWorkFee = data.custom_work_fee !== undefined 
        ? data.custom_work_fee 
        : Math.round(totalWorkFee * discountFactor);
      
      const finalMinistryFee = data.custom_ministry_fee !== undefined
        ? data.custom_ministry_fee
        : totalMinistryFee;
      
      const jobCode = `PKG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
      const totalFee = discountedWorkFee + finalMinistryFee;
      const advanceAmount = (totalFee * 50) / 100;
      const remainingAmount = totalFee - advanceAmount;

      // 1. Create the Master Job
      const { data: jobRes, error: jobError } = await (supabase as any)
        .from('jobs')
        .insert({
          job_code: jobCode,
          client_id: data.client_id,
          employee_id: data.employee_id,
          service_id: data.services[0]?.id,
          total_fee: totalFee,
          work_fee: discountedWorkFee,
          ministry_fee: totalMinistryFee,
          advance_amount: advanceAmount,
          remaining_amount: remainingAmount,
          status: 'active',
          advance_paid: false,
          remaining_paid: false,
          notes: `${data.notes || ''} (Bundle: ${data.package_id})`.trim(),
        })
        .select()
        .single();

      if (jobError) throw jobError;
      const job = jobRes;

      // 2. Build the Multi-Service Roadmap
      const serviceIds = data.services.map(s => s.id).filter(Boolean);
      const { data: blueprints } = await supabase
        .from('workflow_steps')
        .select('*')
        .in('service_id', serviceIds)
        .order('service_id', { ascending: true })
        .order('step_order', { ascending: true });

      if (blueprints && blueprints.length > 0) {
        const stepsToInsert = blueprints.map((step: any) => {
          const isAutoFill = step.required_documents?.some((docType: string) => 
            data.auto_complete_docs?.includes(docType)
          );

          let deadline = null;
          if (step.estimated_hours) {
            const date = new Date();
            date.setHours(date.getHours() + step.estimated_hours);
            deadline = date.toISOString();
          }

          return {
            job_id: job.id,
            workflow_step_id: step.id,
            status: isAutoFill ? 'completed' : 'pending',
            started_at: isAutoFill ? new Date().toISOString() : null,
            completed_at: isAutoFill ? new Date().toISOString() : null,
            is_client_visible: step.is_client_visible ?? true,
            deadline: deadline,
            notes: isAutoFill ? 'Auto-completed via Vault' : null
          };
        });

        const { data: insertedSteps, error: stepsError } = await (supabase as any)
          .from('job_steps')
          .insert(stepsToInsert)
          .select();

        if (stepsError) throw stepsError;

        // 3. Pointer Sync: Point the job to the first active step
        const firstActive = insertedSteps.find((s: any) => s.status === 'pending');
        if (firstActive) {
          await (supabase as any)
            .from('jobs')
            .update({ current_step_id: firstActive.id })
            .eq('id', job.id);
        }
      }

      return job;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job', data.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// ─── Last Assigned Employee ───────────────────────────────────────────────────
export const useLastAssignedEmployee = (clientId?: string) => {
  return useQuery({
    queryKey: ['client', 'last-employee', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          employee_id,
          employee:profiles!employee_id(id, full_name, avatar_url, phone)
        `)
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as any)?.employee || null;
    },
  });
};

export const useUpdateJobStepStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, status, notes, actualGovFee }: { stepId: string; status: string; notes?: string; actualGovFee?: number }) => {
      // Perform the entire transition in ONE atomic database transaction
      const { error } = await (supabase as any).rpc('finalize_job_step', {
        p_step_id: stepId,
        p_status: status,
        p_notes: notes || null,
        p_actual_gov_fee: actualGovFee || 0
      });
      
      if (error) throw error;
      return { stepId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['client', 'jobs'] }); // sync client progress bar
    },
  });
};

// ─── Request Deadline Extension ─────────────────────────────────────────────
export const useRequestExtension = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ jobId, stepId, newDeadline, reason }: { 
      jobId: string; 
      stepId: string; 
      newDeadline: string; 
      reason: string 
    }) => {
      // 1. Create the request with metadata
      const { data, error } = await supabase
        .from('employee_requests')
        .insert({
          employee_id: profile?.id,
          job_id: jobId,
          type: 'deadline_extension',
          description: `EXTEND_STEP::${reason}`,
          status: 'pending',
          metadata: {
            proposed_deadline: newDeadline,
            step_id: stepId,
            reason: reason
          }
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 2. Track the pending reason on the step itself for UI visibility
      await (supabase as any)
        .from('job_steps')
        .update({ extension_reason: reason })
        .eq('id', stepId);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['employee', 'requests'] });
    },
  });
};

export const useUpdateJobPayment = () => {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      jobId, 
      type, 
      paid, 
      amount,
      receiptUrl,
      file
    }: { 
      jobId: string; 
      type: 'advance' | 'remaining'; 
      paid: boolean;
      amount?: number;
      receiptUrl?: string;
      file?: File;
    }) => {
      const now = new Date().toISOString();
      const updates: any = {};
      let finalReceiptUrl = receiptUrl;

      // 1. Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `receipts/${jobId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('job-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('job-documents')
          .getPublicUrl(filePath);

        finalReceiptUrl = publicUrl;
      }
      
      // Fetch current job fees to perform smart re-balancing
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('total_fee, advance_amount, remaining_amount')
        .eq('id', jobId)
        .single();
      
      if (fetchError) throw fetchError;
      const jobInfo = data as any;
      const totalFee = Number(jobInfo.total_fee) || 0;

      if (type === 'advance') {
        updates.advance_paid = paid;
        updates.advance_paid_at = paid ? now : null;
        if (amount !== undefined) {
          updates.advance_amount = amount;
          // Invariant: Total Fee = Advance + Remaining
          updates.remaining_amount = Math.max(0, totalFee - amount);
        }
        if (finalReceiptUrl) updates.advance_receipt_url = finalReceiptUrl;
      } else {
        updates.remaining_paid = paid;
        updates.remaining_paid_at = paid ? now : null;
        if (amount !== undefined) {
          updates.remaining_amount = amount;
          // If they update the remaining amount directly, we must ensure the sum still matches.
          // Usually, the Remaining is the 'slack' variable, but if they forced it, we adjust advance.
          updates.advance_amount = Math.max(0, totalFee - amount);
        }
        if (finalReceiptUrl) updates.remaining_receipt_url = finalReceiptUrl;
      }

        // 1. Perform primary job financial update
        const { data: updatedJob, error: updateError } = await (supabase as any)
          .from('jobs')
          .update(updates)
          .eq('id', jobId)
          .select()
          .single();

        if (updateError) throw updateError;

        // 2. Insert verified payment record into job_payments
        const { error: pError } = await supabase
          .from('job_payments')
          .insert({
            job_id: jobId,
            amount: amount !== undefined ? amount : (type === 'advance' ? (Number(jobInfo.advance_due_amount) || 0) : (Number(jobInfo.remaining_due_amount) || 0)),
            payment_method: 'bank_transfer',
            reference_number: `REC-${Date.now().toString().slice(-6)}`,
            notes: `Confirmed via Financials Ledger. Receipt Auto-Generated.`,
            status: 'verified',
            verified_by: profile?.id,
            verified_at: now
          } as any);
        if (pError) console.error("Could not insert payment log:", pError);

        // 2. If Advance Payment confirmed, start the first step automatically
        if (type === 'advance' && paid) {
           // Find first pending step
           const { data: firstStep, error: fetchError } = await supabase
             .from('job_steps')
             .select('id, step_def:workflow_steps(estimated_hours, step_order)')
             .eq('job_id', jobId)
             .eq('status', 'pending')
             .order('step_order', { foreignTable: 'workflow_steps', ascending: true })
             .limit(1)
             .maybeSingle();

           if (fetchError) throw fetchError;

           if (firstStep) {
             let deadline = null;
             const estHours = (firstStep as any).step_def?.estimated_hours;
             if (estHours) {
               const date = new Date();
               date.setHours(date.getHours() + estHours);
               deadline = date.toISOString();
             }

             // Update step status and job's current step pointer sequentially to avoid 409
             const { error: sError } = await (supabase as any)
               .from('job_steps')
               .update({ 
                 status: 'in_progress', 
                 started_at: now,
                 deadline: deadline 
               })
               .eq('id', (firstStep as any).id);
             
             if (sError) throw sError;

             const { error: jError } = await (supabase as any)
               .from('jobs')
               .update({ current_step_id: (firstStep as any).id })
               .eq('id', jobId);
             
             if (jError) throw jError;
           }
        }

      return null;
    },
    onSuccess: (_data, variables) => {
      const typeLabel = variables.type === 'advance' ? 'Advance' : 'Final';
      toast.success(`${typeLabel} payment verified successfully`);
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// ─── Operational Requests (Admin) ─────────────────────────────────────────
export const useOperationalRequests = () => {
  return useQuery({
    queryKey: ['admin', 'operational-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_requests')
        .select(`
          id,
          job_id,
          employee_id,
          type,
          description,
          status,
          created_at,
          metadata,
          employee:profiles!employee_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
};

export const useResolveOperationalRequest = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, action, type, jobId, metadata }: {
      requestId: string;
      action: 'approved' | 'rejected';
      type: string;
      jobId?: string;
      metadata?: any;
    }) => {
      // 1. Resolve the request record
      const { error: reqError } = await (supabase as any)
        .from('employee_requests')
        .update({
          status: action,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (reqError) throw reqError;

      // 2. Perform side effects if approved
      if (action === 'approved') {
        if (type === 'deadline_extension' && metadata?.newDeadline && metadata?.step_id) {
           await (supabase as any)
            .from('job_steps')
            .update({ deadline: metadata.newDeadline, extension_reason: null })
            .eq('id', metadata.step_id);
        } else if (type === 'job_deletion' && jobId) {
           // DEEP CLEAN: Purge all dependencies before deleting the job
           // IMPORTANT: We do this in a specific order to avoid FK issues
           
           // 1. Delete associated steps
           const { error: stepsError } = await supabase.from('job_steps').delete().eq('job_id', jobId);
           if (stepsError) throw stepsError;

           // 2. Delete associated documents
           const { error: docsError } = await supabase.from('documents').delete().eq('job_id', jobId);
           if (docsError) throw docsError;

           // 3. Delete associated messages
           const { error: msgError } = await supabase.from('messages').delete().eq('job_id', jobId);
           if (msgError) throw msgError;

           // 4. Delete other requests for this job
           const { error: otherReqsError } = await supabase.from('employee_requests').delete().eq('job_id', jobId);
           if (otherReqsError) throw otherReqsError;

           // 5. UNLINK & PURGE Notifications
           // We first try to unlink notifications to satisfy FK even if RLS blocks deletion of others' notifs
           await (supabase as any).from('notifications').update({ job_id: null }).eq('job_id', jobId);
           
           // Then we try to delete notifications we have access to
           const { error: notifError } = await supabase.from('notifications').delete().eq('job_id', jobId);
           // We don't THROW here because unlinking already satisfied the FK constraint, 
           // and RLS might block deletion of employee notifications which is okay as long as they are unlinked.

           // 6. Finally delete the job itself
           const { error: jobError } = await supabase.from('jobs').delete().eq('id', jobId);
           if (jobError) throw jobError;
        }
      }

      return action;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['admin', 'operational-requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'requests'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// ─── Upload Job Document ─────────────────────────────────────────────────────
export const useUploadJobDocument = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ jobId, stepId, fileName, fileUrl, file, docType }: { 
      jobId: string; 
      stepId?: string; 
      fileName: string; 
      fileUrl?: string; 
      file?: File;
      docType: string 
    }) => {
      let finalUrl = fileUrl;

      // 1. If a physical file is provided, upload to Supabase Storage
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${jobId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const storagePath = `documents/${filePath}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        finalUrl = publicUrl;
      }

      if (!finalUrl) throw new Error('File URL or Physical File is required');

      // 2. Save metadata to database
      const { error } = await supabase
        .from('documents')
        .insert({
          job_id: jobId,
          job_step_id: stepId || null,
          uploaded_by: profile?.id,
          file_name: fileName,
          file_path: finalUrl,
          document_type: docType,
          status: 'pending'
        } as any);

      if (error) throw error;
      return { success: true, jobId };
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['job', variables.jobId] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
};

export const useUpdateDocumentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, status, rejectionReason }: { docId: string; status: 'approved' | 'rejected' | 'pending'; rejectionReason?: string }) => {
      // 1. Fetch document metadata to find the job_id and file name
      const { data: docData, error: docErr } = await (supabase as any)
        .from('documents')
        .select('job_id, file_name')
        .eq('id', docId)
        .single();
      if (docErr) throw docErr;

      const jobId = docData.job_id;
      const fileName = docData.file_name;

      // 2. Fetch client_id from the job
      const { data: jobData, error: jobErr } = await (supabase as any)
        .from('jobs')
        .select('client_id, job_code')
        .eq('id', jobId)
        .single();
      if (jobErr) throw jobErr;

      const clientId = jobData.client_id;
      const jobCode = jobData.job_code;

      // 3. Update the document status and keep it visible if approved/rejected so the client can inspect it
      const { error } = await (supabase as any)
        .from('documents')
        .update({ 
          status, 
          rejection_reason: rejectionReason || null,
          is_client_visible: status === 'approved' || status === 'rejected'
        })
        .eq('id', docId);
      
      if (error) throw error;

      // 4. Create Notification for the client
      const titleEn = status === 'approved' ? 'Document Approved' : 'Document Rejected';
      const titleAr = status === 'approved' ? 'تم قبول المستند' : 'تم رفض المستند';
      
      const bodyEn = status === 'approved' 
        ? `Your document "${fileName}" for job ${jobCode} has been approved.` 
        : `Your document "${fileName}" for job ${jobCode} was rejected. Reason: ${rejectionReason || 'No reason specified'}`;
      const bodyAr = status === 'approved'
        ? `تمت الموافقة على المستند الخاص بك "${fileName}" للمشروع ${jobCode}.`
        : `تم رفض المستند الخاص بك "${fileName}" للمشروع ${jobCode}. السبب: ${rejectionReason || 'لم يتم تحديد سبب'}`;

      await supabase.from('notifications').insert({
        recipient_id: clientId,
        job_id: jobId,
        type: status === 'approved' ? 'system' : 'action_required',
        title_en: titleEn,
        title_ar: titleAr,
        body_en: bodyEn,
        body_ar: bodyAr,
        action_required: status === 'rejected',
        action_url: `/portal/jobs/${jobId}`
      } as any);

      return { docId, jobId };
    },
    onSuccess: (data) => {
      if (data?.jobId) {
        qc.invalidateQueries({ queryKey: ['job', data.jobId] });
      }
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['client', 'documents'] }); // sync client documents page
    },
  });
};

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const { data: docData } = await (supabase as any)
        .from('documents')
        .select('job_id')
        .eq('id', docId)
        .single();
      const jobId = docData?.job_id;

      const { error } = await (supabase.from('documents') as any).delete().eq('id', docId);
      if (error) throw error;
      return { docId, jobId };
    },
    onSuccess: (data) => {
      if (data?.jobId) {
        qc.invalidateQueries({ queryKey: ['job', data.jobId] });
      }
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
};

// ─── Admin: Delete Job ────────────────────────────────────────────────────────
export const useAdminDeleteJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      // DEEP CLEAN: Purge all dependencies before deleting the job
      
      // 1. Delete Documents first (depends on job_steps & job_sub_tasks)
      const { error: dE } = await supabase.from('documents').delete().eq('job_id', jobId);
      if (dE) throw dE;

      // 2. Find and delete Sub Tasks (depends on job_steps)
      const { data: steps } = await supabase.from('job_steps').select('id').eq('job_id', jobId);
      if (steps && steps.length > 0) {
         const stepIds = steps.map(s => s.id);
         await supabase.from('job_sub_tasks').delete().in('job_step_id', stepIds);
      }

      // 3. Clean up financials and invoices
      await supabase.from('job_additional_charges').delete().eq('job_id', jobId);
      await supabase.from('job_payments').delete().eq('job_id', jobId);
      await supabase.from('invoices').delete().eq('job_id', jobId);

      // 4. Delete Job Steps
      const { error: sE } = await supabase.from('job_steps').delete().eq('job_id', jobId);
      if (sE) throw sE;
      
      // 5. Delete Messages & Requests
      const { error: mE } = await supabase.from('messages').delete().eq('job_id', jobId);
      if (mE) throw mE;

      const { error: rE } = await supabase.from('employee_requests').delete().eq('job_id', jobId);
      if (rE) throw rE;

      // 6. UNLINK & PURGE Notifications (Defensive against RLS)
      await (supabase as any).from('notifications').update({ job_id: null }).eq('job_id', jobId);
      await supabase.from('notifications').delete().eq('job_id', jobId);
      
      // Finally, delete the job itself
      const { error: jobError } = await supabase.from('jobs').delete().eq('id', jobId);
      if (jobError) throw jobError;
      return jobId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['employee', 'jobs'] });
    },
  });
};

// ─── Employee: Request Deletion ──────────────────────────────────────────────
export const useRequestJobDeletion = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('employee_requests')
        .insert({
          employee_id: profile?.id,
          job_id: jobId,
          type: 'job_deletion', // Mapping to the new type
          description: reason,
          status: 'pending'
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 2. Insert Notification for Admin
      // Fetch Master Admin ID (or just use a known role-based targeting if we had it)
      // For now, we'll fetch the first admin profile
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (adminProfiles && adminProfiles.length > 0) {
        const adminId = (adminProfiles as any[])[0].id;
        await supabase.from('notifications').insert({
          recipient_id: adminId,
          sender_id: profile?.id,
          job_id: jobId,
          type: 'action_required',
          title_en: 'Job Deletion Request',
          title_ar: 'طلب حذف عمل',
          body_en: `Staff requested deletion of job ${(data as any).id}. Reason: ${reason}`,
          body_ar: `طلب الموظف حذف العمل ${(data as any).id}. السبب: ${reason}`,
          action_required: true,
          action_url: `job_request://${(data as any).id}|${jobId}|job_deletion`
        } as any);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', 'requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'operational-requests'] });
    },
  });
};

// ─── Messaging ─────────────────────────────────────────────────────────────
export const useSendMessage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ jobId, content, scope = 'staff_client' }: { jobId: string; content: string; scope?: 'staff_client' | 'admin_client' }) => {
      if (!profile) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          job_id: jobId,
          sender_id: profile.id,
          content: content,
          is_read: false,
          conversation_scope: scope
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate the job detail and messages queries to show the new message
      qc.invalidateQueries({ queryKey: ['job', (data as any).job_id] });
      qc.invalidateQueries({ queryKey: ['job_messages', (data as any).job_id] });
      qc.invalidateQueries({ queryKey: ['employee_jobs_latest_messages'] });
      qc.invalidateQueries({ queryKey: ['client_jobs_latest_messages'] });
    },
  });
};

// ─── Unread Message Count (Client) ───────────────────────────────────────────────────
export const useUnreadMessageCount = (clientId?: string) => {
  return useQuery({
    queryKey: ['client', 'unread-messages', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // 1. Get all job IDs for this client
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('client_id', clientId!);

      if (jobsError) throw jobsError;
      if (!jobs || jobs.length === 0) return 0;

      const jobIds = (jobs as any[]).map((j: any) => j.id);

      // 2. Count messages in those jobs that are not from this client and are unread
      // Note: We use head: true to only get count, not data.
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('job_id', jobIds)
        .eq('is_read', false)
        .neq('sender_id', clientId!);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30s for the badge
  });
};

// ─── Client Feedback ────────────────────────────────────────────────────────
export const useSubmitJobFeedback = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      rating, 
      feedback,
      jobCode
    }: { 
      jobId: string; 
      rating: number; 
      feedback: string;
      jobCode: string;
    }) => {
      if (!profile) throw new Error('Not authenticated');

      // 1. Update the jobs table
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          client_rating: rating,
          client_feedback: feedback
        } as any)
        .eq('id', jobId);

      if (jobError) throw jobError;

      // 2. Insert record in audit_logs
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          actor_id: profile.id,
          action: 'CLIENT_FEEDBACK_SUBMITTED',
          entity_type: 'job',
          entity_id: jobId,
          new_values: {
            rating,
            feedback,
            job_code: jobCode
          }
        } as any);

      if (auditError) {
        console.error('Failed to write to audit log:', auditError);
      }

      return { jobId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job', data.jobId] });
      qc.invalidateQueries({ queryKey: ['client', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    }
  });
};

