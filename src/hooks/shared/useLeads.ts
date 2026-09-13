import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface Lead {
  id: string;
  lead_code?: string;
  client_id?: string;
  contact_name: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  company_name?: string;
  nationality?: string;
  source_id?: string;
  assigned_to?: string;
  assigned_by?: string;
  status: 'new' | 'contacted' | 'interested' | 'on_progress' | 'qualified' | 'quoted' | 'negotiating' | 'converted' | 'cancelled' | 'lost' | 'on_hold';
  lost_reason?: string;
  next_follow_up_at?: string;
  follow_up_notes?: string;
  converted_at?: string;
  converted_job_id?: string;
  notes?: string;
  interested_services?: any[] | null;
  branch_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  leadgen_id?: string | null;
  landing_page_url?: string | null;
  form_id?: string | null;
  ip_country?: string | null;
  created_at: string;
  updated_at: string;
  lead_sources?: {
    name: string;
  } | null;
  assigned_to_profile?: {
    full_name: string;
    avatar_url?: string;
    branch_id?: string;
  } | null;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  employee_id: string;
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note';
  direction: 'inbound' | 'outbound';
  duration_mins?: number;
  outcome?: string;
  notes: string;
  next_action?: string;
  created_at: string;
}

export const useLeads = (employeeId?: string) => {
  const useLeadsList = () => {
    return useQuery({
      queryKey: ['leads', employeeId],
      enabled: !!employeeId,
      queryFn: async (): Promise<Lead[]> => {
        const { data, error } = await supabase
          .from('leads')
          .select('*, lead_sources:source_id(name)')
          .eq('assigned_to', employeeId!)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((l: any) => ({
          ...l,
          lead_sources: l.lead_sources
        })) as Lead[];
      }
    });
  };

  const useLeadSourcesList = () => {
    return useQuery({
      queryKey: ['lead_sources'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('lead_sources')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        return data;
      }
    });
  };

  return {
    useLeadsList,
    useLeadSourcesList,
  };
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (leadData: {
      contact_name: string;
      contact_phone: string;
      contact_whatsapp: string;
      source_id: string;
      services: string[];
      contact_email?: string;
      company_name?: string;
      nationality?: string;
      notes?: string;
      next_follow_up_at?: string;
    }) => {
      const { services, ...leadPayload } = leadData;
      const finalPayload = {
        ...leadPayload,
        lead_code: null, // Let database trigger generate LD-[BRANCH]-[YY]-[0000] safely
        assigned_to: profile?.id,
        assigned_by: profile?.id,
        branch_id: profile?.branch_id || null,
        status: 'new',
        updated_at: new Date().toISOString()
      };

      // 2. Insert lead
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert([finalPayload])
        .select()
        .single();

      if (leadError) throw leadError;

      // 3. Insert lead services interested in
      if (services && services.length > 0) {
        const servicesPayload = services.map(serviceId => ({
          lead_id: newLead.id,
          service_id: serviceId
        }));
        const { error: servicesError } = await supabase
          .from('lead_services')
          .insert(servicesPayload);

        if (servicesError) throw servicesError;
      }

      return newLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });
};

export const useLeadInteractions = (leadId?: string) => {
  return useQuery({
    queryKey: ['lead_interactions', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadInteraction[]> => {
      const { data, error } = await supabase
        .from('lead_interactions')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadInteraction[];
    }
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
    }
  });
};

export const useCreateInteraction = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      lead_id: string;
      type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note';
      direction: 'inbound' | 'outbound';
      notes: string;
      outcome?: string;
      next_action?: string;
    }) => {
      const { data, error } = await supabase
        .from('lead_interactions')
        .insert([{
          ...payload,
          employee_id: profile?.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead_interactions', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });
};

export const useAdminLeads = (branchIdFilter?: string | null) => {
  const queryClient = useQueryClient();

  const useAllLeadsList = (explicitBranchId?: string | null) => {
    const activeBranch = explicitBranchId !== undefined ? explicitBranchId : branchIdFilter;
    return useQuery({
      queryKey: ['admin', 'leads', activeBranch],
      queryFn: async (): Promise<Lead[]> => {
        let query = supabase
          .from('leads')
          .select('*, lead_sources:source_id(name), assigned_to_profile:profiles!assigned_to(full_name, avatar_url, branch_id), assigned_by_profile:profiles!assigned_by(full_name)')
          .order('created_at', { ascending: false });

        if (activeBranch) {
          query = query.eq('branch_id', activeBranch);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data as any[];
      }
    });
  };

  const useReassignLead = () => {
    return useMutation({
      mutationFn: async ({ leadId, employeeId }: { leadId: string; employeeId: string }) => {
        const { data, error } = await supabase
          .from('leads')
          .update({ assigned_to: employeeId, updated_at: new Date().toISOString() })
          .eq('id', leadId)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'employee'] });
      }
    });
  };

  return {
    useAllLeadsList,
    useReassignLead
  };
};

export const useMarketingLeads = () => {
  return useQuery({
    queryKey: ['marketing', 'leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_sources:source_id(id, name),
          assigned_to_profile:profiles!assigned_to(id, full_name, avatar_url, branch_id),
          assigned_by_profile:profiles!assigned_by(id, full_name),
          interactions:lead_interactions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (Lead & {
        lead_sources?: { id: string; name: string } | null;
        interactions?: LeadInteraction[];
      })[];
    }
  });
};

