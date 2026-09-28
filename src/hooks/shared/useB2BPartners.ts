import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface B2BPartner {
  id: string;
  name: string;
  country: 'KSA' | 'OMN' | 'OTHER';
  partner_type: 'execution' | 'sales_referral' | 'hybrid';
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  commission_rate?: number;
  status: 'active' | 'inactive';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export function useB2BPartners() {
  return useQuery({
    queryKey: ['b2b_partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('b2b_partners')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error fetching B2B partners (table may need migration):', error);
        return [];
      }
      return (data || []) as B2BPartner[];
    },
  });
}

export function useCreateB2BPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partner: Partial<B2BPartner>) => {
      const { data, error } = await supabase
        .from('b2b_partners')
        .insert([partner])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_partners'] });
    },
  });
}

export function useUpdateB2BPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<B2BPartner> & { id: string }) => {
      const { data, error } = await supabase
        .from('b2b_partners')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_partners'] });
    },
  });
}
