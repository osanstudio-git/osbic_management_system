import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface QuotationConversionData {
  quotationId: string;
  clientId: string;
  leadId?: string | null;
  salesEmployeeId?: string | null;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  client_pays_ministry_fee?: boolean;
  assignments: {
    serviceId: string | null;
    serviceName: string;
    opsEmployeeId: string;
    workFee?: number;
    ministryFee?: number;
  }[];
}

export const useConvertQuotation = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: QuotationConversionData) => {
      const { quotationId, clientId, leadId, salesEmployeeId, totalAmount, subtotal, taxAmount, client_pays_ministry_fee, assignments } = data;

      // 1. Generate unique Job code
      const yearPrefix = `JOB-${new Date().getFullYear()}-`;
      const { data: latestJob } = await supabase
        .from('jobs')
        .select('job_code')
        .like('job_code', `${yearPrefix}%`)
        .order('job_code', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextJobSeq = 1;
      if (latestJob && latestJob.job_code) {
        const parts = latestJob.job_code.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextJobSeq = lastSeq + 1;
      }
      const job_code = `${yearPrefix}${nextJobSeq.toString().padStart(4, '0')}`;

      // Fetch quotation details to get the package/reference name
      const { data: quotation } = await supabase
        .from('invoices')
        .select('notes')
        .eq('id', quotationId)
        .single();

      // 2. Insert master Client Job
      let mainServiceId = assignments[0]?.serviceId || null;
      if (!mainServiceId) {
        const { data: fallbackS } = await supabase
          .from('services')
          .select('id')
          .eq('name_en', 'Quick Task (POS)')
          .maybeSingle();
        
        if (fallbackS) {
          mainServiceId = fallbackS.id;
        } else {
          const { data: anyS } = await supabase
            .from('services')
            .select('id')
            .limit(1)
            .maybeSingle();
          mainServiceId = anyS?.id || null;
        }
      }

      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert([{
          job_code,
          quotation_id: quotationId,
          lead_id: leadId || null,
          client_id: clientId,
          employee_id: assignments[0]?.opsEmployeeId || profile?.id || salesEmployeeId || '',
          sales_employee_id: salesEmployeeId || null,
          ops_employee_id: assignments[0]?.opsEmployeeId || null,
          service_id: mainServiceId,
          status: 'active',
          total_fee: totalAmount,
          work_fee: subtotal,
          custom_name: quotation?.notes || 'Business Setup Package',
          ministry_fee: taxAmount,
          client_pays_ministry_fee: client_pays_ministry_fee || false,
          advance_percentage: 100,
          started_at: new Date().toISOString(),
          entry_type: leadId ? 'lead' : 'direct',
          branch_id: profile?.branch_id || null
        }])
        .select()
        .single();

      if (jobErr) throw jobErr;

      // Fetch service fees to populate job_services columns
      const serviceIds = assignments.map(a => a.serviceId).filter(Boolean);
      const { data: dbServices } = await supabase
        .from('services')
        .select('id, work_fee, ministry_fee')
        .in('id', serviceIds);

      const serviceFeesMap = (dbServices || []).reduce((acc: any, s: any) => {
        acc[s.id] = {
          work_fee: Number(s.work_fee) || 0,
          ministry_fee: Number(s.ministry_fee) || 0
        };
        return acc;
      }, {});

      // 3. Insert individual Job Services (pending coworker acceptance)
      const jobServicesRows = assignments.map((asg, idx) => {
        const fees = asg.serviceId 
          ? (serviceFeesMap[asg.serviceId] || { work_fee: asg.workFee || 0, ministry_fee: asg.ministryFee || 0 })
          : { work_fee: asg.workFee || 0, ministry_fee: asg.ministryFee || 0 };
        return {
          job_id: newJob.id,
          service_id: asg.serviceId || mainServiceId,
          service_name: asg.serviceName,
          display_order: idx + 1,
          quantity: 1,
          ops_employee_id: asg.opsEmployeeId || null,
          assigned_by: profile?.id || null,
          assigned_at: new Date().toISOString(),
          status: 'pending',
          acceptance_status: 'accepted',
          work_fee: fees.work_fee,
          ministry_fee: fees.ministry_fee,
          total_fee: fees.work_fee + fees.ministry_fee
        };
      });

      const { error: servicesErr } = await supabase
        .from('job_services')
        .insert(jobServicesRows as any);

      if (servicesErr) throw servicesErr;

      // 4. Create workflow steps roadmap inside job_steps (if mapped to template)
      if (serviceIds.length > 0) {
        const { data: blueprints } = await supabase
          .from('workflow_steps')
          .select('*')
          .in('service_id', serviceIds)
          .order('service_id', { ascending: true })
          .order('step_order', { ascending: true });

        if (blueprints && blueprints.length > 0) {
          const stepsToInsert = blueprints.map((step: any) => {
            let deadline = null;
            if (step.estimated_hours) {
              const date = new Date();
              date.setHours(date.getHours() + step.estimated_hours);
              deadline = date.toISOString();
            }

            return {
              job_id: newJob.id,
              workflow_step_id: step.id,
              status: 'pending',
              started_at: null,
              completed_at: null,
              is_client_visible: step.is_client_visible ?? true,
              deadline: deadline
            };
          });

          const { data: insertedSteps, error: stepsErr } = await supabase
            .from('job_steps')
            .insert(stepsToInsert as any)
            .select();

          if (stepsErr) throw stepsErr;

          // Sync first pending step to current_step_id
          const firstActive = insertedSteps.find((s: any) => s.status === 'pending');
          if (firstActive) {
            await supabase
              .from('jobs')
              .update({ current_step_id: firstActive.id })
              .eq('id', newJob.id);
          }
        }
      }

      // 5. Set quotation status to accepted and link client_id
      const { data: quoteData, error: quoteErr } = await supabase
        .from('invoices')
        .update({
          client_id: clientId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          converted_job_ids: [newJob.id]
        })
        .eq('id', quotationId)
        .select()
        .single();

      if (quoteErr) throw quoteErr;

      // 5.5 Auto-generate Invoice from Quotation
      if (quoteData) {
        // Generate new invoice number
        const invPrefix = `INV-${new Date().getFullYear()}-`;
        const { data: latestInv } = await supabase
          .from('invoices')
          .select('invoice_number')
          .like('invoice_number', `${invPrefix}%`)
          .order('invoice_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextInvSeq = 1;
        if (latestInv && latestInv.invoice_number) {
          const parts = latestInv.invoice_number.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) nextInvSeq = lastSeq + 1;
        }
        const invoice_number = `${invPrefix}${nextInvSeq.toString().padStart(4, '0')}`;

        const { data: newInvoice, error: invCreateErr } = await supabase
          .from('invoices')
          .insert({
            invoice_number,
            client_id: clientId || quoteData.client_id,
            lead_id: quoteData.lead_id,
            job_id: newJob.id,
            employee_id: profile?.id || salesEmployeeId,
            type: 'invoice',
            status: 'unpaid',
            subtotal: quoteData.subtotal,
            tax_percentage: quoteData.tax_percentage,
            tax_amount: quoteData.tax_amount,
            discount_amount: quoteData.discount_amount,
            total_amount: quoteData.total_amount,
            issue_date: new Date().toISOString().split('T')[0],
            notes: quoteData.notes,
            terms: quoteData.terms,
            metadata: { generated_from_quote: quotationId }
          })
          .select()
          .single();

        if (invCreateErr) console.error("Auto-invoice generation failed:", invCreateErr);
        else if (newInvoice) {
          // Copy items
          const { data: oldItems } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', quotationId);

          if (oldItems && oldItems.length > 0) {
            const newItems = oldItems.map(item => ({
              invoice_id: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total
            }));
            await supabase.from('invoice_items').insert(newItems as any);
          }
        }
      }

      // 6. Set associated Lead to converted and link client_id (if applicable)
      if (leadId) {
        await supabase
          .from('leads')
          .update({
            client_id: clientId,
            status: 'converted',
            converted_at: new Date().toISOString(),
            converted_job_id: newJob.id
          })
          .eq('id', leadId);
      }

      return newJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });
};
