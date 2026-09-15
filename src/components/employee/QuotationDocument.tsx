import React, { forwardRef } from 'react';
import type { Invoice } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';

interface QuotationDocumentProps {
  invoice: Invoice;
  isSimple?: boolean;
}

export const QuotationDocument = forwardRef<HTMLDivElement, QuotationDocumentProps>(({ invoice, isSimple }, ref) => {
  const { profile } = useAuth();
  const themeColor = '#0088cc';
  const lightBg = '#f0f9ff'; // sky-50

  const resolvedIsSimple = isSimple !== undefined ? isSimple : !!invoice.metadata?.isSimple;
  const showQuantity = invoice.metadata?.showQuantity ?? false;
  const showTimeline = invoice.metadata?.showTimeline !== false;
  const showKycProof = invoice.metadata?.showKycProof ?? false;
  const showDocuments = invoice.metadata?.showDocuments !== false;

  // Resolve recipient display details
  const resolvedContactName = invoice.metadata?.recipient_name || invoice.client?.full_name || invoice.lead?.contact_name || '';
  const resolvedCompanyName = invoice.metadata?.company_name || invoice.client?.company_name || invoice.lead?.company_name || '';
  const resolvedPhone = invoice.metadata?.recipient_phone || invoice.client?.phone || invoice.lead?.contact_phone || 'CONTACT NUMBER';
  const displayMode = invoice.metadata?.recipient_display_mode || (resolvedCompanyName ? 'both' : 'contact');
  const customRecipient = invoice.metadata?.custom_recipient || '';

  let recipientLabel = 'Client Name';
  let recipientContent: React.ReactNode = null;

  if (displayMode === 'company' && resolvedCompanyName) {
    recipientLabel = 'Company Name';
    recipientContent = (
      <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
        {resolvedCompanyName}
      </p>
    );
  } else if (displayMode === 'both' && resolvedCompanyName && resolvedContactName) {
    recipientLabel = 'Client / Company Name';
    recipientContent = (
      <div className="leading-tight">
        <p className="font-bold text-xs uppercase text-gray-900">{resolvedCompanyName}</p>
        <p className="text-[10px] text-gray-600 font-semibold tracking-normal mt-0.5">
          Attn: {resolvedContactName}
        </p>
      </div>
    );
  } else if (displayMode === 'both' && resolvedCompanyName && !resolvedContactName) {
    recipientLabel = 'Company Name';
    recipientContent = (
      <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
        {resolvedCompanyName}
      </p>
    );
  } else if (displayMode === 'custom' && customRecipient) {
    recipientLabel = 'Client / Company Name';
    recipientContent = (
      <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
        {customRecipient}
      </p>
    );
  } else {
    recipientLabel = 'Client Name';
    recipientContent = (
      <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
        {resolvedContactName || resolvedCompanyName || 'CLIENT NAME'}
      </p>
    );
  }

  return (
    <div ref={ref} className="bg-white text-black p-10 min-h-[1056px] w-[794px] max-w-full mx-auto shadow-2xl relative overflow-hidden font-sans text-[11px] leading-relaxed print:w-[210mm] print:min-h-[297mm] print:m-0 print:shadow-none print:p-10">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black tracking-widest uppercase" style={{ color: themeColor }}>OSBIC</h1>
        <div className="text-right" style={{ color: themeColor }}>
          <p className="font-bold text-sm">OSBIC International LLC</p>
          <p className="text-[10px]">+968 9216 4213 www.osbic.net</p>
        </div>
      </div>

      {/* Main Title Bar */}
      <div className="text-center py-3 mb-6" style={{ backgroundColor: themeColor }}>
        <h2 className="text-white text-xl font-bold uppercase tracking-widest">Service Quotation</h2>
        <p className="text-white/90 text-[10px]">Oman Company Formation & Business Set Up</p>
      </div>

      {/* Client Details Grid */}
      <div className="grid grid-cols-2 border border-[#0088cc]/30 mb-8">
        <div className="p-3 border-r border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>{recipientLabel}</p>
          {recipientContent}
        </div>
        <div className="p-3 border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>Contact</p>
          <p className="font-bold text-xs uppercase">{resolvedPhone}</p>
        </div>
        <div className="p-3 border-r border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>Prepared By</p>
          <p className="font-bold text-xs uppercase">
            {invoice.metadata?.prepared_by || invoice.employee?.full_name || profile?.full_name || 'OSBIC TEAM'}
          </p>
        </div>
        <div className="p-3" style={{ backgroundColor: lightBg }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>Activity</p>
          <p className="font-bold text-xs uppercase">{invoice.notes || 'BUSINESS SETUP'}</p>
        </div>
      </div>

      {/* Package Includes Section */}
      <div className="mb-6">
        <div className="py-1 px-3 mb-3 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
          Package Includes
        </div>
        <div className="space-y-1.5 px-2 text-[10px]">
          {invoice.items && invoice.items.length > 0 ? (
            invoice.items.map((item: any, idx) => {
              const qty = Math.max(1, parseInt(item.quantity) || 1);
              const minFee = Math.max(0, parseFloat(item.ministry_fee) || 0);

              let rawSrv = 0;
              if (item.service_fee !== undefined && item.service_fee !== null) {
                rawSrv = parseFloat(item.service_fee) || 0;
              } else if (item.unit_price !== undefined && item.unit_price !== null) {
                const rawUnit = parseFloat(item.unit_price) || 0;
                const singleUnitPrice = (item.total && Math.abs(parseFloat(item.total) - rawUnit) < 0.001 && qty > 1)
                  ? rawUnit / qty
                  : rawUnit;
                rawSrv = Math.max(0, singleUnitPrice - minFee);
              }
              const srvFee = Math.max(0, rawSrv || 0);
              const unitPrice = Math.round((minFee + srvFee) * 1000) / 1000;
              const lineTotal = Math.round((qty * unitPrice) * 1000) / 1000;

              return (
                <div key={idx} className="flex justify-between items-start border-b border-gray-100 pb-1.5">
                  <div className="flex gap-2">
                    <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                    <div>
                      <span className="font-semibold text-gray-900 text-xs block">{item.description}</span>
                      {showQuantity && (
                        <span className="text-[9px] text-gray-500 font-medium block">
                          Qty: {qty} {qty > 1 && !resolvedIsSimple && `× OMR ${unitPrice.toFixed(3)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {!resolvedIsSimple && (
                    <span className="font-bold text-gray-900 font-mono text-xs text-right shrink-0 mt-0.5 ml-4">
                      OMR {lineTotal.toFixed(3)}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 italic">No package items added.</p>
          )}
        </div>

        {/* Total Package Value directly under service items */}
        <div className="mt-3 p-3 flex justify-between items-center rounded-lg" style={{ backgroundColor: lightBg }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: themeColor }}>Total Package Value</p>
          <p className="text-base font-bold text-gray-900 uppercase font-mono">OMR {invoice.total_amount.toFixed(3)}</p>
        </div>
      </div>

      {/* Documents Required Section */}
      {showDocuments && (
        <div className="mb-6">
          <div className="py-1 px-3 mb-3 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
            Documents Required
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 px-2 text-[10px] text-gray-800 font-medium">
            {(() => {
              let docs = invoice.metadata?.documents;
              if (typeof docs === 'string') {
                docs = docs.split('\n').map((s: string) => s.trim()).filter(Boolean);
              } else if (Array.isArray(docs)) {
                docs = docs.map((d: any) => typeof d === 'string' ? d.trim() : d?.name?.trim()).filter(Boolean);
              }
              
              if (!showKycProof && docs) {
                docs = docs.filter((d: string) => !d.toUpperCase().includes('SELFIE') && !d.toUpperCase().includes('PASSPORT SIZE PHOTO'));
              }

              if (!docs || docs.length === 0) return <p className="text-gray-400 italic">No documents specified.</p>;
              return docs.map((doc: string, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span> {doc}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Processing Timeline */}
      {showTimeline && (
        <div className="mb-6">
          <div className="py-1 px-3 mb-2 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
            Processing Timeline
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 px-2 text-[10px]">
            {(() => {
               let timeline = invoice.metadata?.timeline;
               let items: { task: string; days: string }[] = [];
               
               if (Array.isArray(timeline)) {
                 items = timeline.filter((item: any) => item && (item.task || item.days));
               } else if (typeof timeline === 'string') {
                 items = timeline.split('\n').filter(Boolean).map((line: string) => {
                   const [task, ...rest] = line.split(':');
                   return { task: task?.trim() || '', days: rest.join(':')?.trim() || '' };
                 });
               }
               
               if (!items || items.length === 0) return <p className="text-gray-400 italic pt-1">No timeline specified.</p>;
               
               return items.map((item: any, idx: number) => (
                 <div key={idx} className="flex justify-between border-b border-gray-100 pb-1">
                   <span className="font-medium text-gray-800">{item.task}</span>
                   <span className="font-bold" style={{ color: themeColor }}>{item.days}</span>
                 </div>
               ));
            })()}
          </div>
        </div>
      )}

      {/* Payment Schedule */}
      <div className="mb-6">
        <div className="py-1 px-3 mb-2 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
          Payment Schedule
        </div>
        {(() => {
          const scheduleType = invoice.metadata?.paymentScheduleType || '50_50';
          const advPercent = invoice.metadata?.advancePercentage !== undefined ? invoice.metadata.advancePercentage : 50;
          const balPercent = invoice.metadata?.balancePercentage !== undefined ? invoice.metadata.balancePercentage : 50;
          const advMilestone = invoice.metadata?.advanceMilestone || 'Upon signing the quotation';
          const balMilestone = invoice.metadata?.balanceMilestone || 'Upon completion of Visa';

          if (scheduleType === 'full_advance' || advPercent === 100) {
            return (
              <div className="px-2 text-[10px]">
                <p className="font-bold text-gray-800 uppercase tracking-widest text-[9px] mb-0.5">Advance Payment (100%)</p>
                <p className="text-gray-500">{advMilestone}: 100%</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 px-2 text-[10px]">
              <div>
                <p className="font-bold text-gray-800 uppercase tracking-widest text-[9px] mb-0.5">Advance Payment</p>
                <p className="text-gray-500">{advMilestone}: {advPercent}%</p>
              </div>
              {balPercent > 0 && (
                <div>
                  <p className="font-bold text-gray-800 uppercase tracking-widest text-[9px] mb-0.5">Balance Payment</p>
                  <p className="text-gray-500">{balMilestone}: {balPercent}%</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Important Notes */}
      <div className="mb-6">
        <div className="py-1 px-3 mb-2 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
          Important Notes
        </div>
        <ul className="list-disc pl-6 space-y-1 text-gray-800 text-[10px] font-medium">
          <li>All government fees are subject to change without prior notice.</li>
          <li>All external approval fees shall be paid by the client as per voucher issued.</li>
          <li>Industrial activity fees will be charged based on the specific activity selected.</li>
          <li>This quotation is issued based on a general business activity. The final price may be subject to change depending on the specific activity. Any variation in cost will be communicated before proceeding.</li>
        </ul>
      </div>

      {/* Footer */}
      <div className="absolute bottom-10 left-10 right-10 flex justify-between text-[8px] text-[#0088cc]/60 font-bold tracking-wider">
        <p>OSBIC International LLC | Ghala, Muscat, Oman | info@osangroupoman.com</p>
        <p>CONFIDENTIAL</p>
      </div>

      {/* PAGE 2 BREAK */}
      <div className="break-before-page pt-10">
        
        {/* Page 2 Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black tracking-widest uppercase opacity-50" style={{ color: themeColor }}>OSBIC</h1>
          <div className="text-right opacity-50" style={{ color: themeColor }}>
            <p className="font-bold text-sm">OSBIC International LLC</p>
            <p className="text-[10px]">+968 9216 4213 www.osbic.net</p>
          </div>
        </div>

        {/* Selfie with Passport Section (Only when showKycProof is enabled) */}
        {showKycProof && (
          <div className="mb-8">
            <div className="py-2 px-3 mb-4 font-bold text-white uppercase tracking-widest text-[11px]" style={{ backgroundColor: themeColor }}>
              Example of Acceptable Selfie With Passport
            </div>
            <div className="flex justify-center items-center h-48 w-full bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-4">
              <div className="text-center text-gray-400">
                 <img src="/selfie-guide.png" alt="Selfie Guide" className="max-h-full object-contain mx-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
                 <p className="mt-2 text-xs text-gray-500 font-medium">Valid ID & Clear Face Verification Guide</p>
              </div>
            </div>
          </div>
        )}

        {/* Bank Details Section */}
        <div className="mb-6">
          <div className="py-2 px-3 mb-6 font-bold text-white uppercase tracking-widest text-[11px]" style={{ backgroundColor: themeColor }}>
            Bank Account Details
          </div>
          
          <div className="space-y-6 max-w-xl mx-auto">
            {/* Bank Muscat */}
            <table className="w-full text-left border-collapse border border-[#0088cc]/30">
              <thead>
                <tr>
                  <th colSpan={2} className="py-2 px-4 text-center font-bold text-gray-800 border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                    BANK MUSCAT
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium w-40 border-r border-[#0088cc]/10">Customer Name</td>
                  <td className="py-2 px-4 font-bold text-gray-900">OSBIC INTERNATIONAL LLC</td>
                </tr>
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">SWIFT Code</td>
                  <td className="py-2 px-4 font-bold text-gray-900">BMUSOMRXXX</td>
                </tr>
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">IBAN</td>
                  <td className="py-2 px-4 font-bold text-gray-900">OM550270423081077790019</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">Account Number</td>
                  <td className="py-2 px-4 font-bold text-gray-900">0423081077790019</td>
                </tr>
              </tbody>
            </table>

            {/* Bank Dhofar */}
            <table className="w-full text-left border-collapse border border-[#0088cc]/30">
              <thead>
                <tr>
                  <th colSpan={2} className="py-2 px-4 text-center font-bold text-gray-800 border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                    BANK DHOFAR
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium w-40 border-r border-[#0088cc]/10">Customer Name</td>
                  <td className="py-2 px-4 font-bold text-gray-900">OSBIC INTERNATIONAL LLC</td>
                </tr>
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">SWIFT Code</td>
                  <td className="py-2 px-4 font-bold text-gray-900">BDOFOMRUXXX</td>
                </tr>
                <tr className="border-b border-[#0088cc]/10">
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">IBAN</td>
                  <td className="py-2 px-4 font-bold text-gray-900">OM390250001045788333002</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium border-r border-[#0088cc]/10">Account Number</td>
                  <td className="py-2 px-4 font-bold text-gray-900">01045788333002</td>
                </tr>
              </tbody>
            </table>

            {/* Mobile Banking */}
            <table className="w-full text-left border-collapse border border-[#0088cc]/30">
              <thead>
                <tr>
                  <th colSpan={2} className="py-2 px-4 text-center font-bold text-gray-800 border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                    MOBILE BANKING
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr>
                  <td className="py-2 px-4 text-gray-600 font-medium w-40 border-r border-[#0088cc]/10">Mobile Number</td>
                  <td className="py-2 px-4 font-bold text-gray-900">72229827</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="absolute bottom-10 left-10 right-10 flex justify-between text-[8px] text-[#0088cc]/60 font-bold tracking-wider">
          <p>OSBIC International LLC | Ghala, Muscat, Oman | info@osangroupoman.com</p>
          <p>CONFIDENTIAL</p>
        </div>

      </div>

    </div>
  );
});

QuotationDocument.displayName = 'QuotationDocument';
