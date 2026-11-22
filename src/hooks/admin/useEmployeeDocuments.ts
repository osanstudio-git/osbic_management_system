import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: 'civil_id' | 'passport' | 'visa' | 'labor_contract' | 'academic_cert' | 'driving_license' | 'other';
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export const useEmployeeDocuments = (employeeId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['employee_documents', employeeId],
    queryFn: async (): Promise<EmployeeDocument[]> => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch employee documents:', error);
        return [];
      }
      return data as EmployeeDocument[];
    },
    enabled: Boolean(employeeId),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      employeeId,
      documentType,
      title,
      file,
      expiryDate,
      notes,
      uploadedBy,
    }: {
      employeeId: string;
      documentType: EmployeeDocument['document_type'];
      title: string;
      file: File;
      expiryDate?: string | null;
      notes?: string | null;
      uploadedBy?: string | null;
    }) => {
      const fileExt = file.name.split('.').pop();
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fileName = `${Date.now()}_${safeTitle}.${fileExt}`;
      const filePath = `employee_docs/${employeeId}/${fileName}`;

      // Upload file to documents bucket
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Insert metadata into employee_documents table
      const { data, error: insertError } = await (supabase.from('employee_documents') as any)
        .insert({
          employee_id: employeeId,
          document_type: documentType,
          title,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          expiry_date: expiryDate || null,
          notes: notes || null,
          uploaded_by: uploadedBy || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      toast.success('Document uploaded to employee vault');
      queryClient.invalidateQueries({ queryKey: ['employee_documents', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath?: string }) => {
      if (filePath) {
        await supabase.storage.from('documents').remove([filePath]);
      }
      const { error } = await supabase.from('employee_documents').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast.success('Document removed');
      queryClient.invalidateQueries({ queryKey: ['employee_documents', employeeId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete document');
    },
  });

  return {
    documents: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    uploadDocument: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};
