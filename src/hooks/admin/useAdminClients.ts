import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;


// ─── Types ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  client_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  company_name?: string | null;
  nationality?: string;
  id_number?: string;
  id_expiry?: string;
  active_jobs: number;
  total_paid: number;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
  total_ministry_spent?: number;
  created_by?: string;
  jobs?: any[];
}

// ─── List All Clients (with optional branch filter) ───────────────────────────
export const useAdminClients = (branchIdFilter?: string | null) => {
  return useQuery({
    queryKey: ['admin', 'clients', branchIdFilter],
    queryFn: async (): Promise<Client[]> => {
      let query = db
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (branchIdFilter) {
        query = query.eq('branch_id', branchIdFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data ?? []).map((p: any) => ({
        id: p.id,
        client_code: p.client_code,
        full_name: p.full_name ?? 'Unknown',
        company_name: p.company_name,
        email: p.email ?? '',
        phone: p.phone,
        is_active: p.is_active ?? true,
        created_at: p.created_at ?? new Date().toISOString(),
        avatar_url: p.avatar_url,
        created_by: p.created_by,
        active_jobs: 0,
        total_paid: 0,
      }));
    },
  });
};

// ─── List Employee-Specific Clients ──────────────────────────────────────────
export const useEmployeeClients = (employeeId?: string) => {
  return useQuery({
    queryKey: ['employee', 'clients', employeeId],
    enabled: !!employeeId,
    staleTime: 3 * 60 * 1000,   // 3 min — page shows instantly on revisit
    gcTime:   10 * 60 * 1000,   // keep in memory 10 min
    queryFn: async (): Promise<Client[]> => {
      // Step A: Get all client_ids linked to this employee via jobs (sales or ops)
      const { data: jobLinks } = await db
        .from('jobs')
        .select('client_id')
        .or(`employee_id.eq.${employeeId},sales_employee_id.eq.${employeeId},ops_employee_id.eq.${employeeId}`);

      const linkedClientIds = Array.from(
        new Set((jobLinks ?? []).map((j: any) => j.client_id).filter(Boolean))
      ) as string[];

      // Step B: Single profiles query — clients created by OR assigned via jobs
      let query = db
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (linkedClientIds.length > 0) {
        // "created_by me" OR "linked via a job"
        query = query.or(`created_by.eq.${employeeId},id.in.(${linkedClientIds.join(',')})`);
      } else {
        query = query.eq('created_by', employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((p: any) => ({
        id: p.id,
        client_code: p.client_code,
        full_name: p.full_name ?? 'Unknown',
        company_name: p.company_name,
        email: p.email ?? '',
        phone: p.phone,
        nationality: p.nationality,
        id_number: p.id_number,
        id_expiry: p.id_expiry,
        is_active: p.is_active ?? true,
        created_at: p.created_at ?? new Date().toISOString(),
        avatar_url: p.avatar_url,
        created_by: p.created_by,
        active_jobs: 0,
        total_paid: 0,
      }));
    },
  });
};

// ─── Single Client ────────────────────────────────────────────────────────────

export const useAdminClient = (id?: string) => {
  return useQuery({
    queryKey: ['admin', 'client', id],
    enabled: !!id,
    queryFn: async (): Promise<Client & { assigned_employee_name?: string; assigned_employee_id?: string; status: string }> => {
      // 1. Fetch profile
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .single();

      if (profileError) throw profileError;

      // 2. Fetch active job count and total fees
      const { data: jobs, error: jobsError } = await db
        .from('jobs')
        .select(`
          id, 
          status, 
          total_fee, 
          advance_amount,
          advance_paid,
          remaining_amount,
          remaining_paid,
          employee_id,
          employee:profiles!employee_id(full_name, avatar_url)
        `)
        .eq('client_id', id!);

      if (jobsError) throw jobsError;

      // 3. Fetch all step expenses for these jobs
      const jobIds = jobs?.map((j: any) => j.id) || [];
      let totalMinistrySpent = 0;
      
      if (jobIds.length > 0) {
        const { data: stepExpenses } = await db
          .from('job_steps')
          .select('actual_gov_fee')
          .in('job_id', jobIds);
        
        totalMinistrySpent = stepExpenses?.reduce((sum: number, s: any) => sum + (Number(s.actual_gov_fee) || 0), 0) || 0;
      }

      const activeJobsCount = jobs?.filter((j: any) => j.status === 'active').length || 0;
      const totalAmountPaid = jobs?.reduce((sum: number, j: any) => {
        const advance = j.advance_paid ? (j.advance_amount || 0) : 0;
        const remaining = j.remaining_paid ? (j.remaining_amount || 0) : 0;
        return sum + advance + remaining;
      }, 0) || 0;
      
      // 3. Find latest assigned employee
      const latestJob = jobs && jobs.length > 0 ? jobs[0] : null;

      return {
        id: profile.id,
        client_code: profile.client_code,
        full_name: profile.full_name ?? 'Unknown',
        company_name: profile.company_name,
        email: profile.email ?? '',
        phone: profile.phone,
        is_active: profile.is_active ?? true,
        status: profile.is_active ? 'active' : 'archived',
        created_at: profile.created_at ?? new Date().toISOString(),
        created_by: profile.created_by,
        avatar_url: profile.avatar_url,
        active_jobs: activeJobsCount,
        total_paid: totalAmountPaid,
        total_ministry_spent: totalMinistrySpent,
        assigned_employee_name: latestJob?.employee?.full_name || 'No Assignment',
        assigned_employee_id: latestJob?.employee_id,
        jobs: jobs || []
      };
    },
  });
};

// ─── Create Client ────────────────────────────────────────────────────────────
export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newClient: {
      email: string;
      full_name: string;
      phone?: string;
      whatsapp?: string;
      nationality?: string;
      company_name?: string;
      password: string;
      created_by?: string;
      branch_id?: string;
    }) => {
      // Step A: Create a temporary Supabase client that DOES NOT save to localStorage.
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      // Step B: Create the auth user
      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: newClient.email,
        password: newClient.password,
        options: {
          data: { 
            full_name: newClient.full_name, 
            role: 'client' 
          }
        }
      });

      // Handle case where user is already registered in Auth or profiles
      if (authError) {
        const errorMsg = authError.message.toLowerCase();
        if (
          errorMsg.includes('already registered') || 
          errorMsg.includes('already exists') ||
          errorMsg.includes('email address is already assigned') ||
          errorMsg.includes('user already exists')
        ) {
          // Check if profile exists in database
          const { data: existingProfile } = await db
            .from('profiles')
            .select('*')
            .ilike('email', newClient.email.trim())
            .maybeSingle();

          if (existingProfile) {
            const updates: any = {};
            if (newClient.phone && !existingProfile.phone) updates.phone = newClient.phone;
            if (newClient.whatsapp && !existingProfile.whatsapp) updates.whatsapp = newClient.whatsapp;
            if (newClient.company_name && !existingProfile.company_name) updates.company_name = newClient.company_name;
            if (Object.keys(updates).length > 0) {
              await db.from('profiles').update(updates).eq('id', existingProfile.id);
            }
            return {
              ...existingProfile,
              ...updates,
              _isExisting: true
            };
          }
        }
        throw new Error(authError.message);
      }

      // Check for Supabase identity check behavior (empty identities array when already registered)
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        const { data: existingProfile } = await db
          .from('profiles')
          .select('*')
          .ilike('email', newClient.email.trim())
          .maybeSingle();

        if (existingProfile) {
          return {
            ...existingProfile,
            _isExisting: true
          };
        }
      }

      if (!authData.user) throw new Error('Client creation failed');

      const userId = authData.user.id;
      const clientCode = `CLT-${Date.now().toString().slice(-7)}`;

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .upsert({
          id: userId,
          full_name: newClient.full_name,
          company_name: newClient.company_name ?? null,
          email: newClient.email,
          phone: newClient.phone ?? null,
          whatsapp: newClient.whatsapp ?? null,
          nationality: newClient.nationality ?? null,
          role: 'client',
          client_code: clientCode,
          is_active: true,
          created_by: newClient.created_by,
          branch_id: newClient.branch_id,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (profileError) throw new Error(profileError.message);

      // Send the credentials via Edge Function (Resend)
      const { error: invokeError } = await supabase.functions.invoke('send-credentials', {
        body: {
          email: newClient.email,
          password: newClient.password,
          name: newClient.full_name,
          role: 'client'
        }
      });
      
      if (invokeError) {
        console.error('Failed to send credentials email:', invokeError);
        if (invokeError.context) {
          try {
            const errorBody = await invokeError.context.json();
            console.error('Edge Function Error Body:', errorBody);
          } catch (e) {
            const errorText = await invokeError.context.text();
            console.error('Edge Function Error Text:', errorText);
          }
        }
      }

      return { ...profile, password: newClient.password }; // Return password for one-time display
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['employee', 'clients'] });
    },
  });
};

// ─── Update Client ────────────────────────────────────────────────────────────
export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      const { data, error } = await db
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'client', id] });
    },
  });
};

// ─── Delete Client ────────────────────────────────────────────────────────────
export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Try atomic PostgreSQL RPC function first
      try {
        const { data: rpcRes, error: rpcErr } = await db.rpc('delete_client_safely', { p_client_id: id });
        if (!rpcErr && rpcRes) {
          if (rpcRes.success === false) {
            throw new Error(rpcRes.error || 'Cannot delete client with active jobs or invoices');
          }
          return true;
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Cannot delete client') || err.message.includes('active job') || err.message.includes('paid/recorded'))) {
          throw err;
        }
        // If RPC function not yet created in Supabase, proceed with client-side cascade
        console.warn('RPC delete_client_safely failed or unavailable, running client-side cascade:', err);
      }

      // 2. Pre-check: Check if client has active jobs
      const { data: activeJobs, error: jobsErr } = await db
        .from('jobs')
        .select('id, status')
        .eq('client_id', id)
        .not('status', 'in', '("cancelled","draft")');

      if (!jobsErr && activeJobs && activeJobs.length > 0) {
        throw new Error(`Cannot delete client: They have ${activeJobs.length} active job(s) in progress. Please cancel or complete the jobs first.`);
      }

      // 3. Pre-check: Check if client has paid invoices
      const { data: paidInvoices, error: invErr } = await db
        .from('invoices')
        .select('id, status')
        .eq('client_id', id)
        .in('status', ['paid', 'partially_paid']);

      if (!invErr && paidInvoices && paidInvoices.length > 0) {
        throw new Error(`Cannot delete client: They have ${paidInvoices.length} paid invoice(s). Please deactivate/archive the client instead to preserve financial records.`);
      }

      // 4. Cascade cleanup of safe dependent rows
      await db.from('leads').update({ client_id: null }).eq('client_id', id);
      await db.from('client_requests').delete().eq('client_id', id);
      await db.from('client_packages').delete().eq('client_id', id);
      await db.from('client_feedbacks').delete().eq('client_id', id);
      await db.from('invoices').delete().eq('client_id', id);

      // Clean up draft/cancelled jobs if any
      const { data: draftJobs } = await db.from('jobs').select('id').eq('client_id', id);
      if (draftJobs && draftJobs.length > 0) {
        const jobIds = draftJobs.map((j: any) => j.id);
        await db.from('job_service_documents').delete().in('job_id', jobIds);
        await db.from('job_services').delete().in('job_id', jobIds);
        await db.from('jobs').delete().eq('client_id', id);
      }

      // 5. Delete profile
      const { error } = await db
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['employee', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      toast.success('Client deleted successfully');
    },
    onError: (err: any) => {
      console.error('Delete client error:', err);
      toast.error(err.message || 'Failed to delete client');
    },
  });
};
