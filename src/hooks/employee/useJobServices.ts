import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

// Types

export type JobServiceStatus =
  | "pending"
  | "in_progress"
  | "applied"
  | "assigned_to_pro"
  | "gov_approved"
  | "gov_rejected"
  | "completed"
  | "on_hold"
  | "cancelled";

export type JobServiceStepStatus =
  | "pending"
  | "in_progress"
  | "applied"
  | "assigned_to_pro"
  | "gov_approved"
  | "gov_rejected"
  | "completed"
  | "skipped"
  | "on_hold"
  | "cancelled";

export interface JobServiceDocument {
  id: string;
  job_service_id: string;
  job_service_step_id: string | null;
  job_id: string;
  document_name: string;
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  upload_source: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  rejection_reason: string | null;
  is_client_visible: boolean;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobServiceStep {
  id: string;
  job_service_id: string;
  step_name: string;
  step_name_ar: string | null;
  display_order: number;
  assigned_to: string | null;
  assigned_by: string | null;
  status: JobServiceStepStatus;
  pending_reason: string | null;
  rejection_reason: string | null;
  pro_id: string | null;
  pro_shared_at: string | null;
  pro_status: string | null;
  government_ref: string | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  started_at: string | null;
  completed_at: string | null;
  is_client_visible: boolean;
  notes: string | null;
  requires_step_id?: string | null;
  is_locked?: boolean;
  created_at: string;
  assigned_employee?: { full_name: string } | null;
  pro_agent?: { full_name: string } | null;
}

export interface JobService {
  id: string;
  job_id: string;
  service_id: string;
  service_name: string;
  display_order: number;
  quantity: number;
  item_number: number;
  applicant_name: string | null;
  applicant_details: Record<string, any> | null;
  ops_employee_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  assignment_model?: 'direct' | 'pool';
  pool_posted_at?: string | null;
  pool_claimed_at?: string | null;
  pool_claimed_by?: string | null;
  status: JobServiceStatus;
  pending_reason: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  pro_id: string | null;
  pro_shared_at: string | null;
  pro_status: string | null;
  pro_notes: string | null;
  government_ref: string | null;
  government_approved_at: string | null;
  work_fee: number;
  ministry_fee: number;
  total_fee: number;
  started_at: string | null;
  completed_at: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  service?: { name_en: string; name_ar: string; category: string; icon: string; requires_pro: boolean } | null;
  ops_employee?: { full_name: string } | null;
  pro_agent?: { full_name: string } | null;
  steps?: JobServiceStep[];
  documents?: JobServiceDocument[];
}

// Fetch hooks

export const useJobServices = (jobId: string | undefined) => {
  return useQuery({
    queryKey: ["job_services", jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<JobService[]> => {
      const { data, error } = await (supabase
        .from("job_services")
        .select(`
          *,
          service:services(name_en, name_ar, category, icon, requires_pro),
          ops_employee:profiles!job_services_ops_employee_id_fkey(full_name),
          pro_agent:profiles!job_services_pro_id_fkey(full_name),
          steps:job_service_steps(
            *,
            assigned_employee:profiles!job_service_steps_assigned_to_fkey(full_name),
            pro_agent:profiles!job_service_steps_pro_id_fkey(full_name)
          ),
          documents:job_service_documents(*)
        `)
        .eq("job_id", jobId!)
        .order("display_order", { ascending: true }) as any);

      if (error) throw error;

      return (data || []).map((js: any) => ({
        ...js,
        steps: (js.steps || []).sort((a: any, b: any) => a.display_order - b.display_order),
        documents: js.documents || [],
      }));
    },
  });
};

// Mutation hooks

export const useUpdateJobService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobId, updates }: { id: string; jobId: string; updates: Partial<JobService> }) => {
      const { error } = await (supabase
        .from("job_services")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
    },
  });
};

export const useAddJobService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      jobId: string;
      serviceId: string;
      serviceName: string;
      quantity?: number;
      workFee?: number;
      ministryFee?: number;
      opsEmployeeId?: string;
      applicantName?: string;
      displayOrderStart?: number;
    }) => {
      const qty = payload.quantity || 1;
      const startOrder = payload.displayOrderStart || 1;
      const rows = Array.from({ length: qty }, (_: any, i: number) => ({
        job_id: payload.jobId,
        service_id: payload.serviceId,
        service_name: payload.serviceName,
        display_order: startOrder + i,
        quantity: qty,
        item_number: i + 1,
        applicant_name: qty === 1 ? (payload.applicantName || null) : null,
        status: "pending",
        work_fee: payload.workFee || 0,
        ministry_fee: payload.ministryFee || 0,
        total_fee: (payload.workFee || 0) + (payload.ministryFee || 0),
        ops_employee_id: payload.opsEmployeeId || null,
      }));
      const { error } = await (supabase.from("job_services").insert(rows as any) as any);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
    },
  });
};

export const useAddJobServiceStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobServiceId,
      jobId,
      stepName,
      displayOrder,
    }: {
      jobServiceId: string;
      jobId: string;
      stepName: string;
      displayOrder: number;
    }) => {
      const { error } = await (supabase.from("job_service_steps").insert({
        job_service_id: jobServiceId,
        step_name: stepName,
        display_order: displayOrder,
        status: "pending",
        is_client_visible: false,
      } as any) as any);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
    },
  });
};

export const useUpdateJobServiceStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobId, updates }: { id: string; jobId: string; updates: Partial<JobServiceStep> }) => {
      const { error } = await (supabase
        .from("job_service_steps")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
    },
  });
};

export const useDeleteJobServiceStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await (supabase.from("job_service_steps").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
    },
  });
};

export const useSeedJobServiceDocuments = () => {
  return useMutation({
    mutationFn: async ({
      jobServiceId,
      jobId,
      serviceId,
    }: {
      jobServiceId: string;
      jobId: string;
      serviceId: string;
    }) => {
      const { data: reqs, error: reqErr } = await (supabase
        .from("service_document_requirements")
        .select("*")
        .eq("service_id", serviceId)
        .order("display_order", { ascending: true }) as any);
      if (reqErr) throw reqErr;
      if (!reqs || reqs.length === 0) return;

      const placeholders = (reqs as any[]).map((r: any) => ({
        job_service_id: jobServiceId,
        job_id: jobId,
        document_name: r.document_name,
        status: "pending",
        is_client_visible: r.is_client_upload || false,
        notes: r.notes || null,
      }));

      const { error } = await (supabase.from("job_service_documents").insert(placeholders as any) as any);
      if (error) throw error;
    },
  });
};

export const useUploadMultipleServiceDocuments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobServiceId,
      jobId,
      uploadedBy,
      files,
    }: {
      jobServiceId: string;
      jobId: string;
      uploadedBy: string;
      files: { file: File; category: 'input' | 'output' }[];
    }) => {
      const uploadPromises = files.map(async ({ file, category }) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${jobId}/${jobServiceId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase
          .from('job_service_documents')
          .insert({
            job_service_id: jobServiceId,
            job_id: jobId,
            document_name: file.name.replace(/\.[^/.]+$/, ""),
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: uploadedBy,
            upload_source: 'ops',
            document_category: category,
            status: 'approved',
            is_client_visible: true,
            created_at: new Date().toISOString()
          } as any);

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job_services", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["client", "documents"] });
    },
  });
};

export const useDeleteJobServiceDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string | null }) => {
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([filePath]);
        if (storageError) {
          console.error("Storage delete warning:", storageError.message);
        }
      }

      const { data: doc } = await supabase
        .from('job_service_documents')
        .select('document_category')
        .eq('id', id)
        .single();

      if (doc?.document_category === 'output') {
        const { error: dbError } = await supabase
          .from('job_service_documents')
          .delete()
          .eq('id', id);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('job_service_documents')
          .update({
            file_name: null,
            file_path: null,
            file_size: null,
            file_type: null,
            uploaded_by: null,
            upload_source: null,
            status: 'pending',
          } as any)
          .eq('id', id);
        if (dbError) throw dbError;
      }
    },
    onSuccess: (_data, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["job_services"] });
      queryClient.invalidateQueries({ queryKey: ["client", "documents"] });
    },
  });
};

