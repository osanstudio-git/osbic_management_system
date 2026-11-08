import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';

export interface SalesAuditItem {
  id: string;
  jobCode: string;
  clientName: string;
  clientPhone?: string | null;
  companyName?: string | null;
  serviceType: string;
  date: string;
  salesRepName: string;
  salesRepAvatar?: string | null;
  branchName?: string | null;
  branchId?: string | null;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'pending';
  hasReceipt: boolean;
  receiptUrl?: string | null;
  receiptSource?: 'job_payment' | 'invoice' | 'walkin';
  verifiedStatus?: 'verified' | 'pending' | 'unverified';
  workFee: number;
  ministryFee: number;
}

export interface GovOutflowItem {
  id: string;
  jobId: string;
  jobCode: string;
  clientName: string;
  serviceName: string;
  supplierName: string; // e.g. MOCIIP, ROP, MOL, OCCI, Sanad
  date: string;
  dealFee: number;
  estimatedGovFee: number;
  actualPaidGovFee: number;
  workFeeMargin: number; // Deal Fee - Gov Fee
  hasGovReceipt: boolean;
  govReceiptUrl?: string | null;
  opsRepName: string;
  branchName?: string | null;
  branchId?: string | null;
  status: string;
}

export const useHRAdminAudit = (filters?: {
  branchId?: string | null;
  startDate?: string;
  endDate?: string;
}) => {
  const queryClient = useQueryClient();

  // ── Live Realtime Sync: Instant refresh when sales/ops record payments, jobs, or walk-ins ──
  useEffect(() => {
    const channel = supabase
      .channel('hr-admin-audit-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walkin_sales' }, () => {
        queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_services' }, () => {
        queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['hr_admin_audit', filters],
    queryFn: async () => {
      // 1. Fetch Jobs with Sales & Client Info
      let jobsQuery = supabase
        .from('jobs')
        .select(`
          id,
          job_code,
          created_at,
          total_fee,
          work_fee,
          ministry_fee,
          advance_amount,
          remaining_amount,
          advance_paid,
          remaining_paid,
          advance_receipt_url,
          remaining_receipt_url,
          status,
          branch_id,
          sales_employee_id,
          ops_employee_id,
          custom_name,
          service:services!service_id(name_en),
          client:profiles!client_id(id, full_name, phone, company_name),
          sales_rep:profiles!sales_employee_id(id, full_name, avatar_url),
          ops_rep:profiles!ops_employee_id(id, full_name, avatar_url),
          branch:branches!branch_id(id, name),
          payments:job_payments(
            id, amount, payment_method, proof_url, status, created_at, reference_number, notes
          ),
          job_services(
            id, service_name, work_fee, ministry_fee, total_fee, supplier_name,
            gov_fee_actual_paid, gov_payment_status, gov_paid_at, gov_receipt_url,
            documents:job_service_documents(id, document_name, file_path, document_category, notes)
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.branchId) {
        jobsQuery = jobsQuery.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
      }

      const { data: jobsData, error: jobsError } = await jobsQuery;
      if (jobsError) {
        console.error('Error fetching jobs for HR audit:', jobsError);
      }

      // 2. Fetch Walkin Sales
      let walkinQuery = supabase
        .from('walkin_sales')
        .select(`
          *,
          employee:profiles!employee_id(id, full_name, avatar_url),
          branch:branches!branch_id(id, name)
        `)
        .order('date', { ascending: false });

      if (filters?.branchId) {
        walkinQuery = walkinQuery.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
      }

      const { data: walkinData, error: walkinError } = await walkinQuery;
      if (walkinError) {
        console.error('Error fetching walkin sales for HR audit:', walkinError);
      }

      const salesList: SalesAuditItem[] = [];
      const govList: GovOutflowItem[] = [];

      // Process Jobs into Sales Audit
      (jobsData || []).forEach((j: any) => {
        const payments = j.payments || [];
        const verifiedPayments = payments.filter((p: any) => p.status === 'verified');
        const paymentsTotal = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        const totalAmount = Number(j.total_fee) || (Number(j.work_fee || 0) + Number(j.ministry_fee || 0));

        // Advance collected from job_payments or fallback to advance_amount / advance_paid on job
        const advanceAmount = paymentsTotal > 0
          ? paymentsTotal
          : (Number(j.advance_amount) || (j.advance_paid ? totalAmount : 0));
        const remainingAmount = Math.max(0, totalAmount - advanceAmount);

        // Find proof receipt from job_payments, notes [RECEIPT:...], or job receipt fields
        let receiptUrl: string | null = null;
        for (const p of payments) {
          if (p.proof_url) {
            receiptUrl = p.proof_url;
            break;
          }
          if (p.notes) {
            const match = p.notes.match(/\[RECEIPT:(.*?)\|/);
            if (match && match[1]) {
              receiptUrl = match[1];
              break;
            }
          }
        }
        if (!receiptUrl) {
          receiptUrl = j.advance_receipt_url || j.remaining_receipt_url || null;
        }

        const hasReceipt = Boolean(receiptUrl);

        let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'pending' = 'unpaid';
        if (advanceAmount >= totalAmount && totalAmount > 0) {
          paymentStatus = 'paid';
        } else if (advanceAmount > 0) {
          paymentStatus = 'partial';
        }

        const dateStr = payments[0]?.created_at || j.created_at;
        const serviceName = j.custom_name || j.service?.name_en || 'Standard Service';

        salesList.push({
          id: j.id,
          jobCode: j.job_code || 'JOB-N/A',
          clientName: j.client?.full_name || 'Direct Client',
          clientPhone: j.client?.phone || null,
          companyName: j.client?.company_name || null,
          serviceType: serviceName,
          date: dateStr,
          salesRepName: j.sales_rep?.full_name || 'Unassigned / Direct',
          salesRepAvatar: j.sales_rep?.avatar_url || null,
          branchName: j.branch?.name || 'Main Branch',
          branchId: j.branch_id || null,
          totalAmount,
          advanceAmount,
          remainingAmount,
          paymentStatus,
          hasReceipt,
          receiptUrl,
          receiptSource: 'job_payment',
          verifiedStatus: verifiedPayments.length > 0 ? 'verified' : (payments.length > 0 || advanceAmount > 0 ? 'pending' : 'unverified'),
          workFee: Number(j.work_fee) || 0,
          ministryFee: Number(j.ministry_fee) || 0
        });

        // Process Job Services for Gov / Supplier Outflows
        (j.job_services || []).forEach((js: any) => {
          const estimatedFee = Number(js.ministry_fee) || 0;
          if (estimatedFee > 0 || js.gov_fee_actual_paid > 0) {
            // Find uploaded government receipts in documents
            const docs = js.documents || [];
            const govDoc = docs.find((d: any) => 
              d.document_category === 'gov_receipt' || 
              d.notes === 'gov_receipt' ||
              d.document_name?.toLowerCase().includes('government') ||
              d.file_path?.toLowerCase().includes('gov_receipt')
            );

            const hasGovReceipt = Boolean(js.gov_receipt_url || govDoc);
            const govReceiptUrl = js.gov_receipt_url || (govDoc ? govDoc.file_path : null);

            // Infer supplier / ministry from service name if not specified
            let supplier = js.supplier_name;
            if (!supplier) {
              const nameLower = (js.service_name || '').toLowerCase();
              if (nameLower.includes('visa') || nameLower.includes('rop') || nameLower.includes('police')) {
                supplier = 'Royal Oman Police (ROP)';
              } else if (nameLower.includes('labor') || nameLower.includes('labour') || nameLower.includes('sanad')) {
                supplier = 'Ministry of Labour (MOL)';
              } else if (nameLower.includes('cr') || nameLower.includes('company') || nameLower.includes('moci') || nameLower.includes('investor')) {
                supplier = 'MOCIIP (Invest in Oman)';
              } else if (nameLower.includes('chamber') || nameLower.includes('occi')) {
                supplier = 'Oman Chamber (OCCI)';
              } else {
                supplier = 'Official Ministry / Portal';
              }
            }

            const dealFee = (Number(js.work_fee) || 0) + estimatedFee;
            const actualPaidGovFee = Number(js.gov_fee_actual_paid) || estimatedFee;
            const workFeeMargin = Math.max(0, dealFee - actualPaidGovFee);

            govList.push({
              id: js.id,
              jobId: j.id,
              jobCode: j.job_code || 'JOB-N/A',
              clientName: j.client?.full_name || 'Client',
              serviceName: js.service_name || 'Ministry Service',
              supplierName: supplier,
              date: js.gov_paid_at || j.created_at,
              dealFee,
              estimatedGovFee: estimatedFee,
              actualPaidGovFee,
              workFeeMargin,
              hasGovReceipt,
              govReceiptUrl,
              opsRepName: j.ops_rep?.full_name || 'Operations Team',
              branchName: j.branch?.name || 'Main Branch',
              branchId: j.branch_id || null,
              status: js.gov_payment_status || (hasGovReceipt ? 'paid' : 'pending')
            });
          }
        });

        // Fallback: If no job_services rows exist but the parent job has a ministry_fee
        if ((!j.job_services || j.job_services.length === 0) && Number(j.ministry_fee) > 0) {
          const estimatedFee = Number(j.ministry_fee) || 0;
          let supplier = 'Official Ministry / Portal';
          const nameLower = (j.custom_name || j.service_name || '').toLowerCase();
          if (nameLower.includes('visa') || nameLower.includes('rop') || nameLower.includes('police')) {
            supplier = 'Royal Oman Police (ROP)';
          } else if (nameLower.includes('labor') || nameLower.includes('labour') || nameLower.includes('sanad')) {
            supplier = 'Ministry of Labour (MOL)';
          } else if (nameLower.includes('cr') || nameLower.includes('company') || nameLower.includes('moci') || nameLower.includes('investor')) {
            supplier = 'MOCIIP (Invest in Oman)';
          } else if (nameLower.includes('chamber') || nameLower.includes('occi')) {
            supplier = 'Oman Chamber (OCCI)';
          }

          const dealFee = (Number(j.work_fee) || 0) + estimatedFee;
          govList.push({
            id: `job-gov-${j.id}`,
            jobId: j.id,
            jobCode: j.job_code || 'JOB-N/A',
            clientName: j.client?.full_name || 'Client',
            serviceName: j.custom_name || j.service_name || 'Ministry Service',
            supplierName: supplier,
            date: j.created_at,
            dealFee,
            estimatedGovFee: estimatedFee,
            actualPaidGovFee: estimatedFee,
            workFeeMargin: Math.max(0, dealFee - estimatedFee),
            hasGovReceipt: false,
            govReceiptUrl: null,
            opsRepName: j.ops_rep?.full_name || 'Operations Team',
            branchName: j.branch?.name || 'Main Branch',
            branchId: j.branch_id || null,
            status: 'pending'
          });
        }
      });

      // Process Walkin Sales
      (walkinData || []).forEach((w: any) => {
        const total = Number(w.total_amount) || 0;
        const govFee = Number(w.government_fee) || 0;
        const workFee = Number(w.profit) || (total - govFee);

        if (govFee > 0) {
          govList.push({
            id: `walkin-gov-${w.id}`,
            jobId: `walkin-${w.id}`,
            jobCode: `WALK-${w.id.slice(0, 5).toUpperCase()}`,
            clientName: w.client_name || 'Walk-in Client',
            serviceName: w.work_type || 'Walk-in Ministry Service',
            supplierName: 'Sanad / Gov Portal',
            date: w.date || w.created_at,
            dealFee: total,
            estimatedGovFee: govFee,
            actualPaidGovFee: govFee,
            workFeeMargin: workFee,
            hasGovReceipt: Boolean(w.receipt_url || w.client_receipt_url),
            govReceiptUrl: w.receipt_url || w.client_receipt_url || null,
            opsRepName: w.employee?.full_name || 'Operations Counter',
            branchName: w.branch?.name || 'Main Branch',
            branchId: w.branch_id || null,
            status: 'paid'
          });
        }

        salesList.push({
          id: `walkin-${w.id}`,
          jobCode: `WALK-${w.id.slice(0, 5).toUpperCase()}`,
          clientName: w.client_name || 'Walk-in Client',
          clientPhone: w.client_phone || null,
          companyName: null,
          serviceType: w.work_type || 'Walk-in Service',
          date: w.date || w.created_at,
          salesRepName: w.employee?.full_name || 'Walk-in Counter',
          salesRepAvatar: w.employee?.avatar_url || null,
          branchName: w.branch?.name || 'Main Branch',
          branchId: w.branch_id || null,
          totalAmount: total,
          advanceAmount: total,
          remainingAmount: 0,
          paymentStatus: 'paid',
          hasReceipt: Boolean(w.client_receipt_url),
          receiptUrl: w.client_receipt_url || null,
          receiptSource: 'walkin',
          verifiedStatus: 'verified',
          workFee,
          ministryFee: govFee
        });
      });

      // Filter by Date Range if provided
      let filteredSales = salesList;
      let filteredGov = govList;

      if (filters?.startDate && filters?.endDate) {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));

        filteredSales = salesList.filter(s => {
          try {
            const d = parseISO(s.date);
            return isWithinInterval(d, { start, end });
          } catch {
            return true;
          }
        });

        filteredGov = govList.filter(g => {
          try {
            const d = parseISO(g.date);
            return isWithinInterval(d, { start, end });
          } catch {
            return true;
          }
        });
      }

      // Compute Top-Level KPIs
      const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalAdvanceCollected = filteredSales.reduce((sum, s) => sum + s.advanceAmount, 0);
      const totalWorkFees = filteredSales.reduce((sum, s) => sum + s.workFee, 0);
      const totalGovFeesCollected = filteredSales.reduce((sum, s) => sum + s.ministryFee, 0);
      const totalGovFeesPaid = filteredGov.reduce((sum, g) => sum + g.actualPaidGovFee, 0);

      const salesWithReceipt = filteredSales.filter(s => s.hasReceipt).length;
      const salesMissingReceipt = filteredSales.filter(s => !s.hasReceipt).length;

      const govWithReceipt = filteredGov.filter(g => g.hasGovReceipt).length;
      const govMissingReceipt = filteredGov.filter(g => !g.hasGovReceipt).length;

      return {
        sales: filteredSales,
        govOutflows: filteredGov,
        kpis: {
          totalSalesCount: filteredSales.length,
          totalSalesRevenue,
          totalAdvanceCollected,
          totalWorkFees,
          totalGovFeesCollected,
          totalGovFeesPaid,
          netOperatingMargin: totalWorkFees,
          salesWithReceipt,
          salesMissingReceipt,
          govWithReceipt,
          govMissingReceipt
        }
      };
    }
  });
};
