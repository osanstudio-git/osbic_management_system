import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Landmark, Search, Filter, Download, Building2, 
  Calendar, FileText, CheckCircle2, AlertTriangle, AlertCircle,
  Eye, RefreshCw, ArrowUpRight, ArrowDownRight, Upload, X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useBranch } from '../../../contexts/BranchContext';
import { AccountsNavHeader } from '../../../components/employee/accounts/AccountsNavHeader';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import toast from 'react-hot-toast';

export default function GovFeesAudit() {
  const { branches } = useBranch();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [timePreset, setTimePreset] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'variance_only' | 'matched'>('all');

  // Fetch Government Services & Fees
  const { data: rawServices = [], isLoading, refetch } = useQuery({
    queryKey: ['accounts_gov_fees_audit', selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from('job_services')
        .select(`
          id, job_id, service_name, ministry_fee, gov_fee_actual_paid, 
          gov_payment_status, gov_paid_at, gov_receipt_url, supplier_name,
          job:jobs!job_id(
            id, job_code, created_at, client_pays_ministry_fee, branch_id,
            branch:branches!branch_id(name),
            client:profiles!client_id(full_name, company_name, phone),
            ops_rep:profiles!ops_employee_id(full_name)
          ),
          payer:profiles!gov_paid_by(full_name)
        `)
        .gt('ministry_fee', 0)
        .order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) {
        console.warn('Could not fetch gov fees audit:', error);
        return [];
      }
      return data || [];
    }
  });

  // Calculate Variance & Format Data
  const processedGovItems = useMemo(() => {
    return rawServices.map((item: any) => {
      const clientPaysMin = item.job?.client_pays_ministry_fee === true;
      const estFee = Number(item.ministry_fee) || 0;
      const actualPaid = Number(item.gov_fee_actual_paid) || (item.gov_payment_status === 'paid' ? estFee : 0);
      const variance = actualPaid > 0 ? (actualPaid - estFee) : 0;
      const hasReceipt = Boolean(item.gov_receipt_url);

      const targetEntity = item.supplier_name || (
        (item.service_name || '').toLowerCase().includes('cr') || (item.service_name || '').toLowerCase().includes('activity')
          ? 'MOCIIP (Commerce)'
          : (item.service_name || '').toLowerCase().includes('visa')
          ? 'ROP (Immigration)'
          : (item.service_name || '').toLowerCase().includes('chamber') || (item.service_name || '').toLowerCase().includes('occi')
          ? 'OCCI (Chamber)'
          : (item.service_name || '').toLowerCase().includes('tax')
          ? 'Tax Authority'
          : 'Ministry / Supplier'
      );

      const dateStr = item.gov_paid_at 
        ? item.gov_paid_at.split('T')[0] 
        : (item.job?.created_at ? item.job.created_at.split('T')[0] : format(new Date(), 'yyyy-MM-dd'));

      return {
        ...item,
        clientPaysMin,
        estFee,
        actualPaid,
        variance,
        hasReceipt,
        targetEntity,
        dateStr
      };
    });
  }, [rawServices]);

  // Filtered List
  const filteredGovItems = useMemo(() => {
    const now = new Date();
    return processedGovItems.filter(item => {
      if (selectedBranchId && item.job?.branch_id !== selectedBranchId) return false;

      // Entity filter
      if (entityFilter !== 'all' && !item.targetEntity.toLowerCase().includes(entityFilter.toLowerCase())) {
        return false;
      }

      // Variance filter
      if (varianceFilter === 'variance_only' && Math.abs(item.variance) <= 0.001) return false;
      if (varianceFilter === 'matched' && Math.abs(item.variance) > 0.001) return false;

      // Time preset
      if (timePreset === 'today') {
        const todayStr = format(now, 'yyyy-MM-dd');
        if (item.dateStr !== todayStr) return false;
      } else if (timePreset === 'week') {
        const start = startOfWeek(now, { weekStartsOn: 6 });
        const end = endOfWeek(now, { weekStartsOn: 6 });
        try {
          if (!isWithinInterval(parseISO(item.dateStr), { start, end })) return false;
        } catch { /* ignore */ }
      } else if (timePreset === 'month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        try {
          if (!isWithinInterval(parseISO(item.dateStr), { start, end })) return false;
        } catch { /* ignore */ }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (item.job?.client?.full_name || '').toLowerCase();
        const clientComp = (item.job?.client?.company_name || '').toLowerCase();
        const jobCode = (item.job?.job_code || '').toLowerCase();
        const sName = (item.service_name || '').toLowerCase();
        if (!clientName.includes(q) && !clientComp.includes(q) && !jobCode.includes(q) && !sName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [processedGovItems, selectedBranchId, entityFilter, varianceFilter, timePreset, searchQuery]);

  // Executive KPI Rollup
  const kpis = useMemo(() => {
    const totalEst = filteredGovItems.reduce((sum, i) => sum + (i.clientPaysMin ? 0 : i.estFee), 0);
    const totalActual = filteredGovItems.reduce((sum, i) => sum + i.actualPaid, 0);
    const netVariance = totalActual - totalEst;
    const missingReceipts = filteredGovItems.filter(i => i.actualPaid > 0 && !i.hasReceipt).length;

    return { totalEst, totalActual, netVariance, missingReceipts };
  }, [filteredGovItems]);

  const handleOpenReceipt = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      toast.error('Could not preview slip: ' + e.message);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Job Code', 'Client', 'Service', 'Target Entity', 'Estimated Gov Fee (OMR)', 'Actual Paid (OMR)', 'Variance (OMR)', 'Has Slip', 'Paid By', 'Branch'];
    const rows = filteredGovItems.map(i => [
      i.dateStr,
      i.job?.job_code || '',
      `"${(i.job?.client?.full_name || 'Client').replace(/"/g, '""')}"`,
      `"${(i.service_name || 'Service').replace(/"/g, '""')}"`,
      `"${i.targetEntity}"`,
      i.estFee.toFixed(3),
      i.actualPaid.toFixed(3),
      i.variance.toFixed(3),
      i.hasReceipt ? 'YES' : 'NO',
      `"${i.payer?.full_name || i.job?.ops_rep?.full_name || 'Staff'}"`,
      `"${i.job?.branch?.name || 'All'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `OSBIC_Gov_Fees_Audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Shared Accounts Header */}
      <AccountsNavHeader
        title="Government Fees Audit & Variance Radar"
        description="Comprehensive audit of official ministry card debits (MOCIIP, ROP, MOL, Municipality) comparing quotes vs actual charges and debit slips."
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      >
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all border border-border flex items-center gap-1.5"
        >
          <Download size={14} />
          <span>Export Audit</span>
        </button>
      </AccountsNavHeader>

      {/* ─── Executive KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Estimated Gov Fees */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Estimated Gov Fees</span>
            <Building2 size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-mono font-black text-foreground">
            {kpis.totalEst.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Standard ministry catalog values</p>
        </div>

        {/* Total Actual Paid */}
        <div className="bg-card border border-blue-500/30 rounded-3xl p-5 shadow-sm space-y-1 bg-blue-500/[0.02]">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">Actual Paid (Treasury Debited)</span>
            <Landmark size={18} />
          </div>
          <p className="text-3xl font-mono font-black text-blue-400">
            {kpis.totalActual.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">Official bank card swipes</p>
        </div>

        {/* Net Treasury Variance */}
        <div className={`bg-card border rounded-3xl p-5 shadow-sm space-y-1 ${
          kpis.netVariance > 0.001 
            ? 'border-amber-500/30 bg-amber-500/[0.02]' 
            : 'border-emerald-500/30 bg-emerald-500/[0.02]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              kpis.netVariance > 0.001 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              Net Fee Variance
            </span>
            {kpis.netVariance > 0.001 ? (
              <ArrowUpRight size={18} className="text-amber-400" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400" />
            )}
          </div>
          <p className={`text-3xl font-mono font-black ${
            kpis.netVariance > 0.001 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {kpis.netVariance > 0 ? `+${kpis.netVariance.toFixed(3)}` : kpis.netVariance.toFixed(3)} <span className="text-xs font-normal opacity-50">OMR</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">
            {kpis.netVariance > 0.001 ? '⚠ Ministry charged higher than quote' : '✓ Reconciled within estimates'}
          </p>
        </div>

        {/* Missing Slips Radar */}
        <div className={`bg-card border rounded-3xl p-5 shadow-sm space-y-1 ${
          kpis.missingReceipts > 0 ? 'border-rose-500/30 bg-rose-500/[0.02]' : 'border-border'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              kpis.missingReceipts > 0 ? 'text-rose-400' : 'text-muted-foreground'
            }`}>
              Voucher Compliance
            </span>
            <FileText size={18} className={kpis.missingReceipts > 0 ? 'text-rose-400' : 'text-muted-foreground'} />
          </div>
          <p className={`text-3xl font-mono font-black ${kpis.missingReceipts > 0 ? 'text-rose-400' : 'text-foreground'}`}>
            {kpis.missingReceipts} <span className="text-xs font-normal opacity-50">Missing</span>
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">
            {kpis.missingReceipts > 0 ? 'Transactions without uploaded slip' : '✓ 100% slips verified'}
          </p>
        </div>
      </div>

      {/* ─── Filters & Search ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border/70 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Presets */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border text-xs">
            {(['today', 'week', 'month', 'all'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => setTimePreset(preset)}
                className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                  timePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Variance Filter */}
          <select
            value={varianceFilter}
            onChange={e => setVarianceFilter(e.target.value as any)}
            className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Fees</option>
            <option value="variance_only">Variances Only (Discrepancies)</option>
            <option value="matched">Matched Only</option>
          </select>

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Government Entities</option>
            <option value="mociip">MOCIIP (Ministry of Commerce)</option>
            <option value="rop">ROP (Police & Visas)</option>
            <option value="occi">OCCI (Chamber of Commerce)</option>
            <option value="tax">Tax Authority</option>
            <option value="municipality">Municipality (Baladiya)</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search job code, client, service..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* ─── Gov Fees Audit Table ─── */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Job Code</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Entity</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Estimated Fee</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actual Paid</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Variance</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Gov Receipt</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Paid By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Auditing ministry debits and vouchers...
                  </td>
                </tr>
              ) : filteredGovItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    No government fee records matching selected criteria.
                  </td>
                </tr>
              ) : (
                filteredGovItems.map(item => {
                  const hasDiscrepancy = Math.abs(item.variance) > 0.001;

                  return (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-muted-foreground whitespace-nowrap">
                        {item.dateStr}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-primary text-xs">
                          {item.job?.job_code}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                          {item.service_name}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground text-sm">
                          {item.job?.client?.full_name || 'Individual'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {item.job?.client?.company_name || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-foreground/90">
                        <span className="px-2 py-0.5 rounded-md bg-muted/40 border border-border text-[10px]">
                          {item.targetEntity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-muted-foreground">
                        {item.clientPaysMin ? (
                          <span className="line-through text-muted-foreground/50">{item.estFee.toFixed(3)}</span>
                        ) : (
                          item.estFee.toFixed(3)
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-blue-400">
                        {item.actualPaid.toFixed(3)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-black">
                        {hasDiscrepancy ? (
                          <span className={item.variance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                            {item.variance > 0 ? `+${item.variance.toFixed(3)}` : item.variance.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">0.000</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {item.gov_receipt_url ? (
                          <button
                            onClick={() => handleOpenReceipt(item.gov_receipt_url)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Eye size={12} /> View Slip
                          </button>
                        ) : (
                          <span className="text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/20">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {item.payer?.full_name || item.job?.ops_rep?.full_name || 'Staff'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
