import React, { forwardRef } from 'react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { RepPerformanceData } from '../../hooks/employee/useSalesTeamReports';

export type ReportContentType = 'both' | 'sales_revenue' | 'leads_quotes';

interface Props {
  rep: RepPerformanceData;
  reportType: ReportContentType;
  timeframeLabel: string;
  dateFilter: 'all' | 'today' | 'week' | 'month' | 'custom';
  customStart?: string;
  customEnd?: string;
  branchName?: string;
  orientation?: 'landscape' | 'portrait';
}

export const SalesEmployeeReportDocument = forwardRef<HTMLDivElement, Props>(({
  rep,
  reportType,
  timeframeLabel,
  dateFilter,
  customStart,
  customEnd,
  branchName,
  orientation = 'landscape',
}, ref) => {
  const brandColor = '#0f172a'; // Deep slate navy
  const accentColor = '#0284c7'; // Primary blue
  const isPortrait = orientation === 'portrait';

  // Date filtering helper
  const isInDateRange = (dateStr?: string | null) => {
    if (!dateStr || dateFilter === 'all') return true;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const now = new Date();

      if (dateFilter === 'today') {
        return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
      }
      if (dateFilter === 'week') {
        return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
      }
      if (dateFilter === 'month') {
        return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
      }
      if (dateFilter === 'custom') {
        if (customStart && customEnd) {
          const s = startOfDay(parseISO(customStart));
          const e = endOfDay(parseISO(customEnd));
          return isWithinInterval(d, { start: s, end: e });
        }
      }
      return true;
    } catch {
      return true;
    }
  };

  // Filtered Leads (personal pipeline handled)
  const filteredLeads = (rep.leads || []).filter(l => isInDateRange(l.created_at || l.conversion_date));

  // Filtered Distributed Leads (leads passed to team members by this sales lead/manager)
  const filteredDistributedLeads = (rep.distributedLeads || []).filter(l => isInDateRange(l.created_at || l.conversion_date));
  const distributedCount = filteredDistributedLeads.length || rep.assignedByMeCount || 0;
  const isSalesLeadOrManager = Boolean(rep.isSalesHead || distributedCount > 0);
  const assignedInCount = filteredLeads.filter(l => l.assigned_to === rep.employeeId && l.assigned_by && l.assigned_by !== rep.employeeId).length;
  const directAddedCount = filteredLeads.filter(l => !l.assigned_by || l.assigned_by === rep.employeeId).length;

  // Filtered Sales (Both Walkin and Converted Jobs/Leads)
  // Consolidate rep.sales and rep.assignedJobs without duplication
  const filteredSales = React.useMemo(() => {
    const list: any[] = [];
    const seenJobIds = new Set<string>();

    // 1. From assigned jobs (operational jobs closed / handled)
    (rep.assignedJobs || []).forEach(j => {
      if (j.status !== 'cancelled' && isInDateRange(j.createdAt)) {
        seenJobIds.add(j.id);
        list.push({
          id: j.id,
          date: j.createdAt,
          client: j.companyName || j.clientName || 'Client',
          service: j.serviceName || 'Corporate Service',
          amount: Number(j.totalFee) || 0,
          gov: Number(j.ministryFee) || 0,
          profit: Number(j.workFee) || 0,
          balance: Number(j.balance) || 0,
          modeOfPayment: j.paymentMode || 'bank_transfer',
          remark: j.jobCode ? `${j.jobCode}${j.notes ? ` - ${j.notes}` : ''}` : (j.notes || 'Job File'),
        });
      }
    });

    // 2. From combined sales (walkin sales + won leads not already represented)
    (rep.sales || []).forEach(s => {
      if (s.status !== 'cancelled' && !seenJobIds.has(s.id) && isInDateRange(s.date || s.createdAt)) {
        list.push({
          id: s.id,
          date: s.date || s.createdAt,
          client: s.companyName || s.clientName || 'Client',
          service: s.serviceName || s.workType || 'Direct Sale',
          amount: Number(s.amount) || 0,
          gov: Number(s.govtFee) || 0,
          profit: Number(s.profit) || 0,
          balance: Number(s.balance) || 0,
          modeOfPayment: s.modeOfPayment || 'cash',
          remark: s.remarks || (s.source === 'walkin' ? 'Walk-in Sale' : 'Converted Lead'),
        });
      }
    });

    return list;
  }, [rep.assignedJobs, rep.sales, dateFilter, customStart, customEnd]);

  // Aggregate Totals for Sales Table
  const totalSalesAmount = filteredSales.reduce((acc, item) => acc + item.amount, 0);
  const totalGovFee = filteredSales.reduce((acc, item) => acc + item.gov, 0);
  const totalProfit = filteredSales.reduce((acc, item) => acc + item.profit, 0);
  const totalBalance = filteredSales.reduce((acc, item) => acc + item.balance, 0);

  // Aggregate Totals for Leads Table
  const totalQuotedInLeads = filteredLeads.reduce((acc, l) => acc + (Number(l.quoted_amount) || 0), 0);
  const totalExpectedProfitInLeads = filteredLeads.reduce((acc, l) => acc + (Number(l.expected_profit) || 0), 0);
  const wonLeadsCount = filteredLeads.filter(l => l.status === 'converted').length;
  const newLeadsCount = filteredLeads.filter(l => l.status === 'new').length;
  const inProgressLeadsCount = filteredLeads.filter(l => !['new', 'converted', 'lost', 'cancelled'].includes(l.status)).length;

  return (
    <div
      ref={ref}
      className={`bg-white text-slate-900 p-8 mx-auto shadow-xl relative font-sans leading-relaxed print:m-0 print:shadow-none print:p-6 print:text-black print:bg-white ${
        isPortrait 
          ? 'w-[794px] min-h-[1122px] print:w-[210mm] print:min-h-[297mm] text-[10px]' 
          : 'w-[1122px] min-h-[794px] print:w-[297mm] print:min-h-[210mm] text-[11px]'
      }`}
      style={{ boxSizing: 'border-box' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${isPortrait ? 'portrait' : 'landscape'};
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* ─── Top Header ─── */}
      <div className="flex justify-between items-start border-b-2 pb-4 mb-4" style={{ borderColor: accentColor }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-wider uppercase text-slate-900">
              OSBIC INTERNATIONAL
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase bg-slate-100 text-slate-700 tracking-wider">
              {branchName || rep.branchName || 'Sultanate of Oman'}
            </span>
          </div>
          <p className="font-bold text-xs text-slate-600 mt-0.5">Corporate Services & Business Formation Management</p>
          <p className="text-[10px] text-slate-400">Official Executive & Sales Performance Record</p>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 text-white font-extrabold text-[11px] uppercase tracking-wider rounded" style={{ backgroundColor: accentColor }}>
            {reportType === 'both' && 'Comprehensive Sales & Leads Report'}
            {reportType === 'sales_revenue' && 'Sales, Revenue & Collections Sheet'}
            {reportType === 'leads_quotes' && 'Leads Pipeline & Quotations Report'}
          </div>
          <p className="text-[10px] text-slate-600 font-bold mt-1">Period: <span className="text-slate-900 uppercase font-black">{timeframeLabel}</span></p>
          <p className="text-[9px] text-slate-400">Generated: {format(new Date(), 'dd MMM yyyy, HH:mm')}</p>
        </div>
      </div>

      {/* ─── Consultant Profile & Quick Stats Bar ─── */}
      <div className="grid grid-cols-5 border border-slate-200 rounded-lg p-3 mb-5 bg-slate-50/80 gap-3 text-[11px]">
        <div className="border-r border-slate-200 pr-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isSalesLeadOrManager ? 'Sales Lead / Head' : 'Sales Consultant'}
          </span>
          <span className="font-black text-slate-900 text-sm">{rep.fullName}</span>
          <span className="text-[10px] text-slate-500 font-mono block">{rep.employeeCode || 'EMP'}</span>
        </div>

        <div className="border-r border-slate-200 pr-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isSalesLeadOrManager ? 'Pipeline & Delegation' : 'Assigned / Pipeline'}
          </span>
          <span className="font-black text-slate-800 text-sm">{filteredLeads.length} Leads</span>
          <span className="text-[10px] text-slate-500 block">
            <span>{assignedInCount} assigned • {directAddedCount} direct</span>
            {isSalesLeadOrManager && distributedCount > 0 && (
              <span className="block font-bold text-indigo-700 mt-0.5">
                ✦ {distributedCount} passed to team
              </span>
            )}
          </span>
        </div>

        <div className="border-r border-slate-200 pr-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Quoted Volume</span>
          <span className="font-black text-sky-700 text-sm">{totalQuotedInLeads.toFixed(3)} OMR</span>
          <span className="text-[10px] text-slate-500 block">Exp. Profit: {totalExpectedProfitInLeads.toFixed(3)} OMR</span>
        </div>

        <div className="border-r border-slate-200 pr-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Sales Won</span>
          <span className="font-black text-emerald-700 text-sm">{totalSalesAmount.toFixed(3)} OMR</span>
          <span className="text-[10px] text-slate-500 block">{filteredSales.length} closed deals</span>
        </div>

        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Center Net Profit</span>
          <span className="font-black text-emerald-600 text-sm">{totalProfit.toFixed(3)} OMR</span>
          <span className="text-[10px] text-slate-500 block">
            Pending Balance: <strong className={totalBalance > 0 ? "text-rose-600 font-mono" : "text-slate-600 font-mono"}>{totalBalance.toFixed(3)} OMR</strong>
          </span>
        </div>
      </div>

      {/* ─── SECTION 1: Closed Sales & Revenue (Excel Format) ─── */}
      {(reportType === 'both' || reportType === 'sales_revenue') && (
        <div className="mb-6">
          <div className="flex items-center justify-between bg-slate-800 text-white px-3 py-1.5 rounded-t text-[10px] font-extrabold uppercase tracking-wider">
            <span>Sales & Revenue Sheet ({filteredSales.length} Transactions)</span>
            <span>All values in OMR</span>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-[10px]">
            <thead>
              <tr className="bg-slate-100 font-extrabold text-slate-700 text-left border-b border-slate-200 uppercase tracking-wider text-[9px]">
                <th className="p-1.5 border-r border-slate-200 w-10 text-center">sl no</th>
                <th className="p-1.5 border-r border-slate-200 w-24">date</th>
                <th className="p-1.5 border-r border-slate-200 min-w-[140px]">client</th>
                <th className="p-1.5 border-r border-slate-200 min-w-[130px]">service</th>
                <th className="p-1.5 border-r border-slate-200 w-24 text-right">amount</th>
                <th className="p-1.5 border-r border-slate-200 w-20 text-right">gov</th>
                <th className="p-1.5 border-r border-slate-200 w-20 text-right">profit</th>
                <th className="p-1.5 border-r border-slate-200 w-20 text-right">balance</th>
                <th className="p-1.5 border-r border-slate-200 w-24 text-center">mode of payment</th>
                <th className="p-1.5 text-slate-600">remark</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((item, idx) => {
                const rowDate = item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-';
                return (
                  <tr key={item.id || idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                    <td className="p-1.5 border-r border-slate-200 text-slate-700 whitespace-nowrap">{rowDate}</td>
                    <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">{item.client}</td>
                    <td className="p-1.5 border-r border-slate-200 text-slate-700">{item.service}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono font-extrabold text-slate-900">{Number(item.amount).toFixed(3)}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono text-amber-700">{Number(item.gov).toFixed(3)}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">{Number(item.profit).toFixed(3)}</td>
                    <td className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${item.balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {Number(item.balance).toFixed(3)}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center uppercase tracking-wider text-[9px] text-slate-700 font-semibold">
                      {String(item.modeOfPayment || 'bank_transfer').replace('_', ' ')}
                    </td>
                    <td className="p-1.5 text-slate-600 font-mono text-[9px] truncate max-w-[180px]">
                      {item.remark || '-'}
                    </td>
                  </tr>
                );
              })}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-slate-400 italic">
                    No sales recorded for this employee in the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={4} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[10px]">
                    Total (OMR):
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-xs font-black text-slate-900">
                    {totalSalesAmount.toFixed(3)}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-xs text-amber-800">
                    {totalGovFee.toFixed(3)}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-xs text-emerald-800">
                    {totalProfit.toFixed(3)}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-xs text-rose-700">
                    {totalBalance.toFixed(3)}
                  </td>
                  <td colSpan={2} className="p-2 text-slate-500 text-[9px] text-center italic">
                    {filteredSales.length} Transactions Verified
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ─── SECTION 2: Leads & Quotations Pipeline ─── */}
      {(reportType === 'both' || reportType === 'leads_quotes') && (
        <div className="mb-6">
          <div className="flex items-center justify-between bg-sky-900 text-white px-3 py-1.5 rounded-t text-[10px] font-extrabold uppercase tracking-wider">
            <span>
              Leads & Quotations Pipeline ({filteredLeads.length} Direct Leads
              {distributedCount > 0 ? ` • ${distributedCount} Distributed to Team` : ''})
            </span>
            <span>Won: {wonLeadsCount} • Active: {inProgressLeadsCount} • New: {newLeadsCount}</span>
          </div>

          <table className="w-full border-collapse border border-slate-200 text-[10px]">
            <thead>
              <tr className="bg-slate-100 font-extrabold text-slate-700 text-left border-b border-slate-200 uppercase tracking-wider text-[9px]">
                <th className="p-1.5 border-r border-slate-200 w-10 text-center">sl no</th>
                <th className="p-1.5 border-r border-slate-200 w-24">date</th>
                <th className="p-1.5 border-r border-slate-200 min-w-[140px]">contact name</th>
                <th className="p-1.5 border-r border-slate-200 min-w-[130px]">company / organization</th>
                <th className="p-1.5 border-r border-slate-200 w-24">source</th>
                <th className="p-1.5 border-r border-slate-200 w-24 text-center">status</th>
                <th className="p-1.5 border-r border-slate-200 w-24 text-right">quoted amount</th>
                <th className="p-1.5 text-right w-24">expected profit</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, idx) => {
                const leadDate = lead.created_at ? format(new Date(lead.created_at), 'dd MMM yyyy') : '-';
                const quotedVal = Number(lead.quoted_amount) || 0;
                const profitVal = Number(lead.expected_profit) || 0;
                const isAssigned = Boolean(lead.assigned_by && lead.assigned_by !== rep.employeeId);
                return (
                  <tr key={lead.id || idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                    <td className="p-1.5 border-r border-slate-200 text-slate-700 whitespace-nowrap">{leadDate}</td>
                    <td className="p-1.5 border-r border-slate-200">
                      <div className="font-bold text-slate-900">{lead.contact_name || 'Client'}</div>
                      {isAssigned ? (
                        <span className="text-[8px] text-amber-800 bg-amber-100/80 border border-amber-300/80 px-1.5 py-0.5 rounded font-bold inline-block">
                          Assigned by {lead.assignedByName || 'Manager'}
                        </span>
                      ) : (
                        <span className="text-[8px] text-slate-500 inline-block">
                          Self-Added
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-slate-700">{lead.company_name || '-'}</td>
                    <td className="p-1.5 border-r border-slate-200 text-slate-600 text-[9px] uppercase tracking-wider">
                      {(lead.lead_sources as any)?.name || 'Direct'}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-extrabold uppercase text-[9px]">
                      <span className={`px-1.5 py-0.5 rounded ${
                        lead.status === 'converted' ? 'bg-emerald-100 text-emerald-800' :
                        lead.status === 'quoted' ? 'bg-amber-100 text-amber-800' :
                        lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                        lead.status === 'lost' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                      {quotedVal > 0 ? quotedVal.toFixed(3) : '-'}
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold text-sky-800">
                      {profitVal > 0 ? profitVal.toFixed(3) : '-'}
                    </td>
                  </tr>
                );
              })}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                    No leads registered for this employee in the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredLeads.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={6} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[10px]">
                    Pipeline Totals (OMR):
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-xs font-black text-slate-900">
                    {totalQuotedInLeads.toFixed(3)}
                  </td>
                  <td className="p-2 text-right font-mono text-xs font-black text-sky-800">
                    {totalExpectedProfitInLeads.toFixed(3)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
});

SalesEmployeeReportDocument.displayName = 'SalesEmployeeReportDocument';

