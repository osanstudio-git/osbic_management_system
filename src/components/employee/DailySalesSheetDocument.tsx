import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import type { DailySalesSheetData } from '../../hooks/shared/useLeads';

interface Props {
  data: DailySalesSheetData;
}

export const DailySalesSheetDocument = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const themeColor = '#0088cc';
  const lightBg = '#f0f9ff';

  const formattedDate = data.date 
    ? format(new Date(data.date + 'T00:00:00'), 'EEEE, dd MMMM yyyy') 
    : format(new Date(), 'EEEE, dd MMMM yyyy');

  return (
    <div
      ref={ref}
      className="bg-white text-black p-8 min-h-[1056px] w-[794px] max-w-full mx-auto shadow-2xl relative overflow-hidden font-sans text-[11px] leading-relaxed print:w-[210mm] print:min-h-[297mm] print:m-0 print:shadow-none print:p-8 print:text-black print:bg-white"
    >
      {/* ─── Header ─── */}
      <div className="flex justify-between items-start border-b-2 pb-4 mb-4" style={{ borderColor: themeColor }}>
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase" style={{ color: themeColor }}>
            OSBIC
          </h1>
          <p className="font-bold text-xs text-gray-800">OSBIC International LLC — Management System</p>
          <p className="text-[10px] text-gray-500">Oman Company Formation & Corporate Services</p>
        </div>
        <div className="text-right">
          <div className="inline-block px-3 py-1 text-white font-bold text-[11px] uppercase tracking-wider rounded" style={{ backgroundColor: themeColor }}>
            Daily Sales Report (DSR)
          </div>
          <p className="text-[10px] text-gray-600 font-semibold mt-1">Date: {formattedDate}</p>
        </div>
      </div>

      {/* ─── Executive & Branch Bar ─── */}
      <div className="grid grid-cols-3 border border-[#0088cc]/30 rounded mb-5 text-[10px]" style={{ backgroundColor: lightBg }}>
        <div className="p-2.5 border-r border-[#0088cc]/30">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Sales Executive</span>
          <span className="font-bold text-gray-900 text-xs uppercase">{data.employee.full_name}</span>
        </div>
        <div className="p-2.5 border-r border-[#0088cc]/30">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Branch Office</span>
          <span className="font-bold text-gray-900 text-xs uppercase">{data.employee.branch_name || 'Main Branch'}</span>
        </div>
        <div className="p-2.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Generated At</span>
          <span className="font-bold text-gray-900 text-xs">{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
        </div>
      </div>

      {/* ─── Daily KPI Summary Metrics ─── */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <div className="p-2 border border-gray-200 rounded text-center bg-gray-50">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block">New Leads</span>
          <span className="text-base font-black text-gray-900">{data.metrics.newLeadsCount}</span>
        </div>
        <div className="p-2 border border-gray-200 rounded text-center bg-gray-50">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block">Touchpoints / Calls</span>
          <span className="text-base font-black text-blue-600">{data.metrics.interactionsCount}</span>
        </div>
        <div className="p-2 border border-gray-200 rounded text-center bg-gray-50">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block">Quotes Sent</span>
          <span className="text-base font-black text-amber-600">{data.metrics.quotesCount}</span>
          <span className="text-[8px] text-gray-500 block font-mono">OMR {data.metrics.quotesTotalAmount.toFixed(3)}</span>
        </div>
        <div className="p-2 border border-gray-200 rounded text-center bg-gray-50">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block">Deals Won</span>
          <span className="text-base font-black text-emerald-600">{data.metrics.convertedDealsCount}</span>
          <span className="text-[8px] text-gray-500 block font-mono">OMR {data.metrics.convertedDealsAmount.toFixed(3)}</span>
        </div>
        <div className="p-2 border border-gray-200 rounded text-center bg-gray-50">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block">Next Day Agenda</span>
          <span className="text-base font-black text-purple-600">{data.metrics.scheduledFollowUpsCount}</span>
        </div>
      </div>

      {/* ─── SECTION 1: New Leads & Inquiries ─── */}
      <div className="mb-5">
        <div className="py-1 px-2.5 font-bold text-white uppercase tracking-wider text-[9px] flex justify-between items-center rounded-t" style={{ backgroundColor: themeColor }}>
          <span>1. New Leads & Inquiries Handled ({data.newLeads.length})</span>
        </div>
        {data.newLeads.length > 0 ? (
          <table className="w-full border border-gray-200 border-t-0 text-[9px] text-left">
            <thead className="bg-gray-100 font-bold text-gray-700">
              <tr>
                <th className="p-1.5 border-b border-r w-8 text-center">#</th>
                <th className="p-1.5 border-b border-r">Lead Code</th>
                <th className="p-1.5 border-b border-r">Contact / Company</th>
                <th className="p-1.5 border-b border-r">Phone</th>
                <th className="p-1.5 border-b border-r">Source</th>
                <th className="p-1.5 border-b">Interested Services</th>
              </tr>
            </thead>
            <tbody>
              {data.newLeads.map((lead, idx) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-1.5 border-r text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r font-mono font-bold text-gray-900">{lead.lead_code || 'LD-N/A'}</td>
                  <td className="p-1.5 border-r font-semibold">
                    {lead.contact_name}
                    {lead.company_name && <span className="text-gray-500 block text-[8px]">{lead.company_name}</span>}
                  </td>
                  <td className="p-1.5 border-r font-mono">{lead.contact_phone || 'N/A'}</td>
                  <td className="p-1.5 border-r">{lead.lead_sources?.name || 'Direct'}</td>
                  <td className="p-1.5">
                    {(lead.interested_services || []).map((s: any) => s.name || s.name_en || s).join(', ') || 'General Setup'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2.5 border border-t-0 text-center text-gray-400 italic text-[9px]">No new inquiries received on this date.</div>
        )}
      </div>

      {/* ─── SECTION 2: Daily Interactions & Touchpoints ─── */}
      <div className="mb-5">
        <div className="py-1 px-2.5 font-bold text-white uppercase tracking-wider text-[9px] flex justify-between items-center rounded-t" style={{ backgroundColor: themeColor }}>
          <span>2. Calls & Client Interactions Completed ({data.interactions.length})</span>
        </div>
        {data.interactions.length > 0 ? (
          <table className="w-full border border-gray-200 border-t-0 text-[9px] text-left">
            <thead className="bg-gray-100 font-bold text-gray-700">
              <tr>
                <th className="p-1.5 border-b border-r w-8 text-center">#</th>
                <th className="p-1.5 border-b border-r w-14">Type</th>
                <th className="p-1.5 border-b border-r">Lead / Client Name</th>
                <th className="p-1.5 border-b border-r">Notes & Discussion Summary</th>
                <th className="p-1.5 border-b w-28">Outcome / Next Step</th>
              </tr>
            </thead>
            <tbody>
              {data.interactions.map((inter, idx) => (
                <tr key={inter.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-1.5 border-r text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r uppercase font-bold text-gray-700">{inter.type}</td>
                  <td className="p-1.5 border-r font-semibold">
                    {inter.lead?.contact_name || 'Client'}
                    {inter.lead?.company_name && <span className="text-gray-500 block text-[8px]">{inter.lead.company_name}</span>}
                  </td>
                  <td className="p-1.5 border-r text-gray-800">{inter.notes || 'Routine follow-up'}</td>
                  <td className="p-1.5 font-medium text-gray-700">{inter.outcome || inter.next_action || 'Completed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2.5 border border-t-0 text-center text-gray-400 italic text-[9px]">No direct touchpoints logged on this date.</div>
        )}
      </div>

      {/* ─── SECTION 3: Quotations Issued Today ─── */}
      <div className="mb-5">
        <div className="py-1 px-2.5 font-bold text-white uppercase tracking-wider text-[9px] flex justify-between items-center rounded-t" style={{ backgroundColor: themeColor }}>
          <span>3. Quotations Issued ({data.quotations.length})</span>
          <span>Total: OMR {data.metrics.quotesTotalAmount.toFixed(3)}</span>
        </div>
        {data.quotations.length > 0 ? (
          <table className="w-full border border-gray-200 border-t-0 text-[9px] text-left">
            <thead className="bg-gray-100 font-bold text-gray-700">
              <tr>
                <th className="p-1.5 border-b border-r w-8 text-center">#</th>
                <th className="p-1.5 border-b border-r">Quote Number</th>
                <th className="p-1.5 border-b border-r">Recipient / Company</th>
                <th className="p-1.5 border-b border-r">Scope / Activity</th>
                <th className="p-1.5 border-b text-right w-24">Total (OMR)</th>
              </tr>
            </thead>
            <tbody>
              {data.quotations.map((q, idx) => (
                <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-1.5 border-r text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r font-mono font-bold text-gray-900">{q.invoice_number || 'QUOTATION'}</td>
                  <td className="p-1.5 border-r font-semibold">
                    {q.metadata?.company_name || q.client?.company_name || q.lead?.company_name || q.client?.full_name || q.lead?.contact_name || 'Client'}
                  </td>
                  <td className="p-1.5 border-r text-gray-700">{q.notes || 'Business Setup'}</td>
                  <td className="p-1.5 text-right font-mono font-bold text-gray-900">
                    OMR {Number(q.total_amount || 0).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2.5 border border-t-0 text-center text-gray-400 italic text-[9px]">No quotations issued on this date.</div>
        )}
      </div>

      {/* ─── SECTION 4: Deals Won & Converted ─── */}
      <div className="mb-5">
        <div className="py-1 px-2.5 font-bold text-white uppercase tracking-wider text-[9px] flex justify-between items-center rounded-t" style={{ backgroundColor: '#10b981' }}>
          <span>4. Deals Won & Converted to Active Jobs ({data.convertedDeals.length})</span>
          <span>Value: OMR {data.metrics.convertedDealsAmount.toFixed(3)}</span>
        </div>
        {data.convertedDeals.length > 0 ? (
          <table className="w-full border border-gray-200 border-t-0 text-[9px] text-left">
            <thead className="bg-gray-100 font-bold text-gray-700">
              <tr>
                <th className="p-1.5 border-b border-r w-8 text-center">#</th>
                <th className="p-1.5 border-b border-r">Job File Code</th>
                <th className="p-1.5 border-b border-r">Client / Company Name</th>
                <th className="p-1.5 border-b border-r">Service Details</th>
                <th className="p-1.5 border-b text-right w-24">Contract Value (OMR)</th>
              </tr>
            </thead>
            <tbody>
              {data.convertedDeals.map((deal, idx) => (
                <tr key={deal.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-1.5 border-r text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r font-mono font-bold text-emerald-700">{deal.job_code}</td>
                  <td className="p-1.5 border-r font-semibold">{deal.title}</td>
                  <td className="p-1.5 border-r text-gray-700">{deal.service_name}</td>
                  <td className="p-1.5 text-right font-mono font-bold text-emerald-800">
                    OMR {Number(deal.amount || 0).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2.5 border border-t-0 text-center text-gray-400 italic text-[9px]">No deals finalized on this date.</div>
        )}
      </div>

      {/* ─── SECTION 5: Next Working Day Follow-up Commitments ─── */}
      <div className="mb-6">
        <div className="py-1 px-2.5 font-bold text-white uppercase tracking-wider text-[9px] flex justify-between items-center rounded-t" style={{ backgroundColor: '#8b5cf6' }}>
          <span>5. Next Scheduled Follow-up Commitments ({data.upcomingFollowUps.length})</span>
        </div>
        {data.upcomingFollowUps.length > 0 ? (
          <table className="w-full border border-gray-200 border-t-0 text-[9px] text-left">
            <thead className="bg-gray-100 font-bold text-gray-700">
              <tr>
                <th className="p-1.5 border-b border-r w-8 text-center">#</th>
                <th className="p-1.5 border-b border-r w-24">Scheduled Time</th>
                <th className="p-1.5 border-b border-r">Client / Company</th>
                <th className="p-1.5 border-b border-r">Phone</th>
                <th className="p-1.5 border-b">Follow-up Goal / Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingFollowUps.map((lead, idx) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-1.5 border-r text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r font-mono font-bold text-purple-700">
                    {lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), 'dd/MM HH:mm') : 'Next Day'}
                  </td>
                  <td className="p-1.5 border-r font-semibold">
                    {lead.contact_name}
                    {lead.company_name && <span className="text-gray-500 block text-[8px]">{lead.company_name}</span>}
                  </td>
                  <td className="p-1.5 border-r font-mono">{lead.contact_phone || 'N/A'}</td>
                  <td className="p-1.5 text-gray-700">{lead.follow_up_notes || 'Contract closure follow-up'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2.5 border border-t-0 text-center text-gray-400 italic text-[9px]">No upcoming follow-ups scheduled yet.</div>
        )}
      </div>

      {/* ─── Sign-off Footer ─── */}
      <div className="grid grid-cols-2 gap-8 pt-6 mt-6 border-t border-gray-300 text-[10px]">
        <div>
          <p className="text-gray-500 font-bold uppercase text-[9px] mb-8">Sales Executive Sign-off:</p>
          <div className="border-b border-gray-400 w-48 mb-1" />
          <p className="font-bold text-gray-800">{data.employee.full_name}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 font-bold uppercase text-[9px] mb-8">Branch Manager Review & Approval:</p>
          <div className="border-b border-gray-400 w-48 ml-auto mb-1" />
          <p className="font-bold text-gray-800">Verified & Approved</p>
        </div>
      </div>
    </div>
  );
});

DailySalesSheetDocument.displayName = 'DailySalesSheetDocument';
