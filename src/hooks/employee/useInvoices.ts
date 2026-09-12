import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id?: string;
  invoice_number?: string;
  client_id?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  employee_id?: string;
  type: 'quotation' | 'invoice';
  status: 'draft' | 'unpaid' | 'paid' | 'cancelled';
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  terms?: string;
  metadata?: any;
  items?: InvoiceItem[];
  client?: any;
  lead?: any;
  job?: any;
}

export const useInvoices = (clientId?: string) => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['invoices', clientId, profile?.id, profile?.is_manager],
    queryFn: async () => {
      const isRegularEmployee = profile && !profile.is_manager && profile.role === 'employee';

      // Step 1: For regular employees, first get the list of their client IDs
      // (clients they created or whose jobs are assigned to them)
      let employeeClientIds: string[] = [];
      if (isRegularEmployee && !clientId) {
        const { data: jobClients } = await supabase
          .from('jobs')
          .select('client_id')
          .eq('employee_id', profile.id);
        
        const { data: createdClients } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'client')
          .eq('created_by', profile.id);

        const jobClientIds = (jobClients ?? []).map((j: any) => j.client_id).filter(Boolean);
        const createdClientIds = (createdClients ?? []).map((c: any) => c.id).filter(Boolean);
        employeeClientIds = [...new Set([...jobClientIds, ...createdClientIds])];
      }

      // Step 2: Build the invoice query
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:profiles!client_id(*),
          lead:leads!lead_id(*),
          job:jobs!job_id(job_code, employee_id, assigned_by, service:services(name_en)),
          items:invoice_items(*)
        `)
        .order('created_at', { ascending: false });

      if (clientId) {
        // Viewing invoices for a specific client
        query = query.eq('client_id', clientId);
      } else if (isRegularEmployee) {
        if (employeeClientIds.length > 0) {
          // Filter: invoices where employee_id matches OR client_id is in employee's client list
          query = (query as any).or(`employee_id.eq.${profile.id},client_id.in.(${employeeClientIds.join(',')})`);
        } else {
          // No clients found — show only invoices explicitly created by this employee
          query = query.eq('employee_id', profile.id);
        }
      } else if (profile?.is_manager && profile?.branch_id) {
        // Branch Manager: see all invoices within their branch
        query = query.eq('branch_id', profile.branch_id);
      }
      // Super Admin: no branch filter — see all invoices

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!profile
  });
};

export const useNextInvoiceNumber = () => {
  return useQuery({
    queryKey: ['next_invoice_number'],
    queryFn: async () => {
      const yearPrefix = `INV-${new Date().getFullYear()}-`;
      const { data, error } = await (supabase.from('invoices') as any)
        .select('invoice_number')
        .like('invoice_number', `${yearPrefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(error);
      }

      let nextSeq = 1000; // Starting sequence
      if (data && data.invoice_number) {
        const parts = data.invoice_number.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }

      return `${yearPrefix}${nextSeq.toString().padStart(4, '0')}`;
    }
  });
};

export const useInvoice = (id?: string) => {
  return useQuery({
    queryKey: ['invoices', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:profiles!client_id(*),
          lead:leads!lead_id(*),
          job:jobs!job_id(job_code, service:services(name_en)),
          items:invoice_items(*)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Invoice;
    }
  });
};

export const useSaveInvoice = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (invoice: Invoice) => {
      const { items, client, lead, job, ...invoiceData } = invoice;

      invoiceData.employee_id = profile?.id;

      if (!invoiceData.job_id) invoiceData.job_id = null;
      if (!invoiceData.client_id) invoiceData.client_id = null;
      if (!invoiceData.lead_id) invoiceData.lead_id = null;
      if (!invoiceData.invoice_number) delete invoiceData.invoice_number;
      if (!invoiceData.issue_date) delete invoiceData.issue_date;

      let invoiceId = invoice.id;

      if (!invoiceId) {
        // Create new
        const { data, error } = await (supabase.from('invoices') as any)
          .insert([invoiceData])
          .select('id')
          .single();
        if (error) throw error;
        invoiceId = data.id;
      } else {
        // Update existing
        const { error } = await (supabase.from('invoices') as any)
          .update(invoiceData)
          .eq('id', invoiceId);
        if (error) throw error;
      }

      // Handle items
      if (items && invoiceId) {
        // Delete old items
        await (supabase.from('invoice_items') as any).delete().eq('invoice_id', invoiceId);

        // Insert new items
        if (items.length > 0) {
          const itemsToInsert = items.map(item => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total
          }));
          const { error: itemsError } = await (supabase.from('invoice_items') as any).insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      return invoiceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
};

export const useUpdateInvoiceStatus = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, terms }: { id: string; status: string; terms?: string }) => {
      const updateData: any = { status };
      if (status === 'paid') {
        updateData.paid_date = new Date().toISOString();
        if (terms) {
          updateData.terms = terms;
        }
      } else if (status === 'unpaid') {
        updateData.paid_date = null;
        updateData.terms = 'Payment is due within 10 days.';
      }

      const { error } = await (supabase.from('invoices') as any)
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('invoices') as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
};
