import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

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
  referral_name?: string | null;
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
  outcome_type?: 'positive' | 'negative' | 'neutral';
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
      referral_name?: string;
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['daily_sales_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
    }
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      // 1. Clean up associated interactions & services
      await supabase.from('lead_interactions').delete().eq('lead_id', leadId);
      await supabase.from('lead_services').delete().eq('lead_id', leadId);

      // 2. Delete lead record
      const { data, error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .select();

      if (error) throw error;
      return leadId;
    },
    onSuccess: (deletedLeadId) => {
      // Optimistically remove from all cached lists immediately
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: any) => item.id !== deletedLeadId);
      });
      queryClient.setQueriesData({ queryKey: ['admin', 'leads'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: any) => item.id !== deletedLeadId);
      });
      queryClient.setQueriesData({ queryKey: ['marketing', 'leads'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item: any) => item.id !== deletedLeadId);
      });

      // Refetch all related queries to keep server sync
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing'] });
      queryClient.invalidateQueries({ queryKey: ['daily_sales_sheet'] });
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
      outcome_type?: 'positive' | 'negative' | 'neutral';
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

export interface DailySalesSheetData {
  date: string;
  employee: {
    id: string;
    full_name: string;
    email: string;
    branch_name?: string;
  };
  metrics: {
    newLeadsCount: number;
    interactionsCount: number;
    positiveCallsCount: number;
    negativeCallsCount: number;
    quotesCount: number;
    quotesTotalAmount: number;
    convertedDealsCount: number;
    convertedDealsAmount: number;
    scheduledFollowUpsCount: number;
  };
  newLeads: Lead[];
  interactions: (LeadInteraction & { lead?: Lead | null })[];
  quotations: any[];
  convertedDeals: any[];
  upcomingFollowUps: Lead[];
}

export const useDailySalesSheetData = (employeeId?: string, targetDateStr?: string) => {
  const effectiveDate = targetDateStr || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['daily_sales_sheet', employeeId, effectiveDate],
    enabled: !!employeeId,
    queryFn: async (): Promise<DailySalesSheetData> => {
      // Calculate local start and end bounds of the target date
      const [year, month, day] = effectiveDate.split('-').map(Number);
      const startOfDayIso = new Date(year, month - 1, day, 0, 0, 0).toISOString();
      const endOfDayIso = new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();

      // 1. Fetch employee profile & branch
      const { data: empProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, branch_id, branches:branch_id(name, code)')
        .eq('id', employeeId!)
        .single();

      const employee = {
        id: employeeId!,
        full_name: empProfile?.full_name || 'Sales Representative',
        email: empProfile?.email || '',
        branch_name: (empProfile?.branches as any)?.name || 'Head Office'
      };

      // 2. Fetch new leads assigned/created on this day
      const { data: newLeadsData } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name)')
        .eq('assigned_to', employeeId!)
        .gte('created_at', startOfDayIso)
        .lte('created_at', endOfDayIso)
        .order('created_at', { ascending: false });

      // 3. Fetch interactions logged on this day
      const { data: interactionsData } = await supabase
        .from('lead_interactions')
        .select('*, lead:leads!lead_id(id, lead_code, contact_name, company_name, contact_phone, status)')
        .eq('employee_id', employeeId!)
        .gte('created_at', startOfDayIso)
        .lte('created_at', endOfDayIso)
        .order('created_at', { ascending: false });

      // 4. Fetch quotations issued on this day
      const { data: quotationsData } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*), client:profiles!client_id(full_name, company_name), lead:leads!lead_id(contact_name, company_name, lead_code)')
        .eq('type', 'quotation')
        .or(`employee_id.eq.${employeeId},metadata->>prepared_by_employee_id.eq.${employeeId}`)
        .gte('created_at', startOfDayIso)
        .lte('created_at', endOfDayIso)
        .order('created_at', { ascending: false });

      // 5. Fetch deals won / converted on this day
      const { data: convertedLeadsData } = await supabase
        .from('leads')
        .select('*, converted_job:jobs!converted_job_id(*)')
        .eq('assigned_to', employeeId!)
        .eq('status', 'converted')
        .gte('converted_at', startOfDayIso)
        .lte('converted_at', endOfDayIso)
        .order('converted_at', { ascending: false });

      // Also check jobs created on this day with sales_employee_id
      const { data: convertedJobsData } = await supabase
        .from('jobs')
        .select('*, client:profiles!client_id(full_name, company_name), service:services!service_id(name_en, name_ar)')
        .eq('sales_employee_id', employeeId!)
        .gte('created_at', startOfDayIso)
        .lte('created_at', endOfDayIso)
        .order('created_at', { ascending: false });

      // Merge won deals
      const convertedDeals = [
        ...(convertedLeadsData || []).map((l: any) => ({
          id: l.id,
          title: l.contact_name + (l.company_name ? ` (${l.company_name})` : ''),
          job_code: l.converted_job?.job_code || 'JOB-CONVERTED',
          amount: Number(l.converted_job?.total_fee || 0),
          advance: Number(l.converted_job?.advance_paid || 0),
          service_name: l.converted_job?.service_name || 'Business Service',
          converted_at: l.converted_at || l.updated_at
        })),
        ...(convertedJobsData || []).filter((j: any) => !convertedLeadsData?.some((l: any) => l.converted_job_id === j.id)).map((j: any) => ({
          id: j.id,
          title: j.client?.full_name + (j.client?.company_name ? ` (${j.client.company_name})` : ''),
          job_code: j.job_code || 'JOB',
          amount: Number(j.total_fee || 0),
          advance: Number(j.advance_paid || 0),
          service_name: j.service?.name_en || j.service_name || 'Service',
          converted_at: j.created_at
        }))
      ];

      // 6. Fetch upcoming follow-ups scheduled for tomorrow / next working days
      const tomorrowStart = new Date(year, month - 1, day + 1, 0, 0, 0).toISOString();
      const nextDaysEnd = new Date(year, month - 1, day + 3, 23, 59, 59, 999).toISOString();
      const { data: upcomingFollowUpsData } = await supabase
        .from('leads')
        .select('*, lead_sources:source_id(name)')
        .eq('assigned_to', employeeId!)
        .gte('next_follow_up_at', tomorrowStart)
        .lte('next_follow_up_at', nextDaysEnd)
        .order('next_follow_up_at', { ascending: true })
        .limit(10);

      const newLeads = (newLeadsData || []) as Lead[];
      const interactions = (interactionsData || []) as (LeadInteraction & { lead?: Lead | null })[];
      const quotations = quotationsData || [];
      const quotesTotalAmount = quotations.reduce((sum: number, q: any) => sum + Number(q.total_amount || 0), 0);
      const convertedDealsAmount = convertedDeals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      const positiveCallsCount = interactions.filter(i => i.outcome_type === 'positive').length;
      const negativeCallsCount = interactions.filter(i => i.outcome_type === 'negative').length;

      return {
        date: effectiveDate,
        employee,
        metrics: {
          newLeadsCount: newLeads.length,
          interactionsCount: interactions.length,
          positiveCallsCount,
          negativeCallsCount,
          quotesCount: quotations.length,
          quotesTotalAmount,
          convertedDealsCount: convertedDeals.length,
          convertedDealsAmount,
          scheduledFollowUpsCount: (upcomingFollowUpsData || []).length
        },
        newLeads,
        interactions,
        quotations,
        convertedDeals,
        upcomingFollowUps: (upcomingFollowUpsData || []) as Lead[]
      };
    }
  });
};

// ─── Weekly Sales Sheet ───────────────────────────────────────────────────────

export interface WeeklySalesSheetDayData {
  date: string;
  dayLabel: string;
  newLeadsCount: number;
  interactionsCount: number;
  positiveCallsCount: number;
  negativeCallsCount: number;
  quotesCount: number;
  quotesTotalAmount: number;
  convertedDealsCount: number;
  convertedDealsAmount: number;
  newLeads: Lead[];
  interactions: (LeadInteraction & { lead?: Lead | null })[];
  quotations: any[];
  convertedDeals: any[];
}

export interface WeeklySalesSheetData {
  weekStart: string;
  weekEnd: string;
  employee: {
    id: string;
    full_name: string;
    email: string;
    branch_name?: string;
  };
  days: WeeklySalesSheetDayData[];
  totals: {
    newLeadsCount: number;
    interactionsCount: number;
    positiveCallsCount: number;
    negativeCallsCount: number;
    quotesCount: number;
    quotesTotalAmount: number;
    convertedDealsCount: number;
    convertedDealsAmount: number;
  };
}

export const useWeeklySalesSheetData = (employeeId?: string, weekStartDate?: string) => {
  return useQuery({
    queryKey: ['weekly_sales_sheet', employeeId, weekStartDate],
    enabled: !!employeeId && !!weekStartDate,
    queryFn: async (): Promise<WeeklySalesSheetData> => {
      const [yr, mo, dy] = weekStartDate!.split('-').map(Number);
      const weekStart = new Date(yr, mo - 1, dy);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startIso = new Date(yr, mo - 1, dy, 0, 0, 0).toISOString();
      const endIso = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999).toISOString();

      const { data: empProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, branch_id, branches:branch_id(name, code)')
        .eq('id', employeeId!)
        .single();

      const employee = {
        id: employeeId!,
        full_name: empProfile?.full_name || 'Sales Representative',
        email: empProfile?.email || '',
        branch_name: (empProfile?.branches as any)?.name || 'Head Office'
      };

      const [leadsRes, interactionsRes, quotationsRes, convertedLeadsRes, convertedJobsRes] = await Promise.all([
        supabase.from('leads').select('*, lead_sources:source_id(name)').eq('assigned_to', employeeId!).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }),
        supabase.from('lead_interactions').select('*, lead:leads!lead_id(id, lead_code, contact_name, company_name, contact_phone, status)').eq('employee_id', employeeId!).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*, items:invoice_items(*), client:profiles!client_id(full_name, company_name), lead:leads!lead_id(contact_name, company_name, lead_code)').eq('type', 'quotation').or(`employee_id.eq.${employeeId},metadata->>prepared_by_employee_id.eq.${employeeId}`).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }),
        supabase.from('leads').select('*, converted_job:jobs!converted_job_id(*)').eq('assigned_to', employeeId!).eq('status', 'converted').gte('converted_at', startIso).lte('converted_at', endIso).order('converted_at', { ascending: false }),
        supabase.from('jobs').select('*, client:profiles!client_id(full_name, company_name), service:services!service_id(name_en, name_ar)').eq('sales_employee_id', employeeId!).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }),
      ]);

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const days: WeeklySalesSheetDayData[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
        const inDay = (dt: string) => dt >= dayStart && dt <= dayEnd;

        const dayLeads = ((leadsRes.data || []) as Lead[]).filter(l => inDay(l.created_at));
        const dayInteractions = ((interactionsRes.data || []) as (LeadInteraction & { lead?: Lead | null })[]).filter(item => inDay(item.created_at));
        const dayQuotations = (quotationsRes.data || []).filter((q: any) => inDay(q.created_at));
        const dayConvertedLeads = (convertedLeadsRes.data || []).filter((l: any) => l.converted_at && inDay(l.converted_at));
        const dayConvertedJobs = (convertedJobsRes.data || []).filter((j: any) => inDay(j.created_at));

        const convertedDeals = [
          ...dayConvertedLeads.map((l: any) => ({
            id: l.id,
            title: l.contact_name + (l.company_name ? ` (${l.company_name})` : ''),
            job_code: l.converted_job?.job_code || 'JOB-CONVERTED',
            amount: Number(l.converted_job?.total_fee || 0),
            service_name: l.converted_job?.service_name || 'Business Service',
          })),
          ...dayConvertedJobs
            .filter((j: any) => !dayConvertedLeads.some((l: any) => l.converted_job_id === j.id))
            .map((j: any) => ({
              id: j.id,
              title: (j.client?.full_name || '') + (j.client?.company_name ? ` (${j.client.company_name})` : ''),
              job_code: j.job_code || 'JOB',
              amount: Number(j.total_fee || 0),
              service_name: j.service?.name_en || 'Service',
            }))
        ];

        return {
          date: dateStr,
          dayLabel: dayNames[d.getDay()],
          newLeadsCount: dayLeads.length,
          interactionsCount: dayInteractions.length,
          positiveCallsCount: dayInteractions.filter(inter => inter.outcome_type === 'positive').length,
          negativeCallsCount: dayInteractions.filter(inter => inter.outcome_type === 'negative').length,
          quotesCount: dayQuotations.length,
          quotesTotalAmount: dayQuotations.reduce((s, q: any) => s + Number(q.total_amount || 0), 0),
          convertedDealsCount: convertedDeals.length,
          convertedDealsAmount: convertedDeals.reduce((s, dl: any) => s + Number(dl.amount || 0), 0),
          newLeads: dayLeads,
          interactions: dayInteractions,
          quotations: dayQuotations,
          convertedDeals,
        };
      });

      const totals = days.reduce((acc, day) => ({
        newLeadsCount: acc.newLeadsCount + day.newLeadsCount,
        interactionsCount: acc.interactionsCount + day.interactionsCount,
        positiveCallsCount: acc.positiveCallsCount + day.positiveCallsCount,
        negativeCallsCount: acc.negativeCallsCount + day.negativeCallsCount,
        quotesCount: acc.quotesCount + day.quotesCount,
        quotesTotalAmount: acc.quotesTotalAmount + day.quotesTotalAmount,
        convertedDealsCount: acc.convertedDealsCount + day.convertedDealsCount,
        convertedDealsAmount: acc.convertedDealsAmount + day.convertedDealsAmount,
      }), {
        newLeadsCount: 0, interactionsCount: 0, positiveCallsCount: 0, negativeCallsCount: 0,
        quotesCount: 0, quotesTotalAmount: 0, convertedDealsCount: 0, convertedDealsAmount: 0,
      });

      return {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        employee,
        days,
        totals,
      };
    }
  });
};

// ─── Submit / Check Daily Report ─────────────────────────────────────────────

export const useSubmitDailyReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      report_date: string;
      metrics: any;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('daily_reports')
        .upsert([{
          employee_id: payload.employee_id,
          report_date: payload.report_date,
          submitted_at: new Date().toISOString(),
          metrics: payload.metrics,
          notes: payload.notes || null,
        }], { onConflict: 'employee_id,report_date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_reports'] });
    }
  });
};

export const useCheckDailyReport = (employeeId?: string, date?: string) => {
  return useQuery({
    queryKey: ['daily_reports', employeeId, date],
    enabled: !!employeeId && !!date,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_reports')
          .select('id, submitted_at, report_date')
          .eq('employee_id', employeeId!)
          .eq('report_date', date!)
          .maybeSingle();
        if (error) return null;
        return data;
      } catch {
        return null;
      }
    }
  });
};
