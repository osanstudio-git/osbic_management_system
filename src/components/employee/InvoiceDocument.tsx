import React, { forwardRef } from 'react';
import type { Invoice } from '../../hooks/employee/useInvoices';
import { format } from 'date-fns';

interface InvoiceDocumentProps {
  invoice: Invoice;
  isSimple?: boolean;
}

// Convert numbers to English words including Rials and Baizas for OMR
const numberToWords = (amount: number): string => {
  if (amount === 0 || isNaN(amount)) return 'Zero Rials only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result.trim();
  };

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    let result = '';
    if (n >= 1000000) {
      result += convertLessThanOneThousand(Math.floor(n / 1000000)) + ' Million ';
      n %= 1000000;
    }
    if (n >= 1000) {
      result += convertLessThanOneThousand(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      result += convertLessThanOneThousand(n);
    }
    return result.trim();
  };

  const rials = Math.floor(amount);
  const baizas = Math.round((amount - rials) * 1000);

  let output = '';
  if (rials > 0) {
    output += convertGroup(rials) + (rials === 1 ? ' Rial' : ' Rials');
  }

  if (baizas > 0) {
    if (rials > 0) output += ' and ';
    output += convertGroup(baizas) + (baizas === 1 ? ' Baiza' : ' Baizas');
  }

  return (output ? output + ' only' : 'Zero Rials only');
};

export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(({ invoice, isSimple = false }, ref) => {
  const isPaid = invoice.status === 'paid';
  const isQuotation = invoice.type === 'quotation';
  const themeColor = '#0088cc'; // OSBIC brand blue color

  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [];
  const subtotal = Number(invoice.subtotal) || 0;
  const taxRate = Number(invoice.tax_percentage) || 0;
  const taxAmount = Number(invoice.tax_amount) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const totalAmount = Number(invoice.total_amount) || (subtotal - discountAmount + taxAmount);
  const totalQuantity = isSimple ? 1 : items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div 
      ref={ref} 
      className="bg-white text-gray-900 p-8 sm:p-10 w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl relative overflow-hidden font-sans text-[11px] leading-relaxed box-border print:w-full print:min-h-0 print:h-auto print:shadow-none print:p-6 print:m-0 print:overflow-visible"
    >
      
      {/* PAID Watermark Sticker */}
      {isPaid && (
        <div style={{ position: 'absolute', top: '35%', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', transform: 'rotate(-12deg)', opacity: 0.12, pointerEvents: 'none', zIndex: 0 }}>
          <svg width="360" height="150" viewBox="0 0 360 150" style={{ overflow: 'visible' }}>
            <rect x="8" y="8" width="344" height="134" rx="28" ry="28" fill="none" stroke="#16a34a" strokeWidth="8" />
            <text x="180" y="75" textAnchor="middle" dominantBaseline="central" fill="#16a34a" fontSize="80" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="6">PAID</text>
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start relative z-10 pb-4 border-b border-gray-200 print:pb-2">
        <div className="space-y-0.5">
          <h1 className="text-sm font-black text-gray-900 tracking-tight">OSBIC INTERNATIONAL LLC (OMAN)</h1>
          <p className="text-gray-600 text-[10.5px]">Building No: 271, Office No: 8, 99 Street, Al Jami Al Akbar Street,</p>
          <p className="text-gray-600 text-[10.5px]">Muscat, Oman. Landmark: ASAS SERVICE CENTER</p>
          <p className="text-gray-600 text-[10.5px]">Ghala Industrial Area, Muscat, Sultanate of Oman</p>
          <p className="text-gray-700 text-[10.5px] font-medium pt-1">Phone: +968 72596531, +968 72229827</p>
          <p className="text-gray-700 text-[10.5px] font-medium">Email: Ayoob@osangroupoman.com</p>
        </div>
        
        {/* Blue OSBIC Box */}
        <div className="w-20 h-20 bg-[#0088cc] rounded-lg flex items-center justify-center text-white text-xs font-black tracking-widest shadow-sm shrink-0">
          OSBIC
        </div>
      </div>

      {/* Title */}
      <div className="text-center relative z-10 my-5 print:my-3">
        <h2 className="text-xl font-bold uppercase tracking-wider" style={{ color: themeColor }}>
          {isQuotation ? 'Quotation' : 'Invoice'}
        </h2>
      </div>

      {/* Client Info & Invoice Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-100 print:mb-4 relative z-10">
        <div>
          <h3 className="font-bold text-gray-500 uppercase tracking-widest text-[9.5px] mb-1">Bill To</h3>
          <p className="font-bold text-gray-900 text-sm">{invoice.client?.full_name || invoice.lead?.contact_name || 'Client Name'}</p>
          {invoice.client?.company_name && (
            <p className="text-gray-600 text-[10.5px] font-medium">{invoice.client.company_name}</p>
          )}
          {invoice.client?.phone && (
            <p className="text-gray-500 text-[10px] mt-0.5">{invoice.client.phone}</p>
          )}
        </div>
        <div className="text-right">
          <h3 className="font-bold text-gray-500 uppercase tracking-widest text-[9.5px] mb-1">Invoice Details</h3>
          <p className="text-[11px]"><span className="text-gray-500">Invoice No:</span> <span className="font-bold text-gray-900">{invoice.invoice_number || 'DRAFT'}</span></p>
          <p className="text-[11px]"><span className="text-gray-500">Issue Date:</span> <span className="font-medium text-gray-900">{format(new Date(invoice.issue_date || new Date()), 'dd-MM-yyyy')}</span></p>
        </div>
      </div>

      {/* Items Table */}
      <div className="relative z-10 mb-6 print:mb-4">
        <table className="w-full text-left border-collapse table-fixed text-[11px] print:text-[10px]">
          <thead>
            <tr className="text-white font-bold" style={{ backgroundColor: themeColor }}>
              <th className="py-2.5 px-3 w-[6%] text-center align-middle rounded-l-md">#</th>
              <th className="py-2.5 px-3 w-[46%] text-left align-middle">Service Name</th>
              <th className="py-2.5 px-3 w-[12%] text-center align-middle">Quantity</th>
              <th className="py-2.5 px-3 w-[18%] text-right align-middle">Price / Unit</th>
              <th className="py-2.5 px-3 w-[8%] text-center align-middle">VAT %</th>
              <th className="py-2.5 px-3 w-[18%] text-right align-middle rounded-r-md">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isSimple ? (
              <tr className="border-b border-gray-200">
                <td className="py-3 px-3 text-center align-middle text-gray-500">1</td>
                <td className="py-3 px-3 text-left align-middle font-semibold text-gray-900">
                  {items[0]?.description || invoice.metadata?.service_name || 'Professional Services'}
                </td>
                <td className="py-3 px-3 text-center align-middle font-medium">1</td>
                <td className="py-3 px-3 text-right align-middle font-mono font-medium">OMR {subtotal.toFixed(3)}</td>
                <td className="py-3 px-3 text-center align-middle text-gray-600">{taxRate}%</td>
                <td className="py-3 px-3 text-right align-middle font-mono font-bold text-gray-900">OMR {subtotal.toFixed(3)}</td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-3 text-center align-middle text-gray-500">{idx + 1}</td>
                  <td className="py-3 px-3 text-left align-middle font-semibold text-gray-900 break-words">{item.description}</td>
                  <td className="py-3 px-3 text-center align-middle font-medium">{item.quantity}</td>
                  <td className="py-3 px-3 text-right align-middle font-mono font-medium">OMR {Number(item.unit_price || 0).toFixed(3)}</td>
                  <td className="py-3 px-3 text-center align-middle text-gray-600">{taxRate}%</td>
                  <td className="py-3 px-3 text-right align-middle font-mono font-bold text-gray-900">OMR {Number(item.total || 0).toFixed(3)}</td>
                </tr>
              ))
            )}
            {items.length === 0 && !isSimple && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400 italic">No services added yet.</td>
              </tr>
            )}
            {/* Total Summary Table Row */}
            <tr className="border-b-2 border-gray-900 font-bold bg-gray-50/60">
              <td className="py-2.5 px-3 text-center align-middle"></td>
              <td className="py-2.5 px-3 text-left align-middle font-bold text-gray-900 uppercase tracking-wider text-[10px]">Total</td>
              <td className="py-2.5 px-3 text-center align-middle font-bold">{totalQuantity}</td>
              <td className="py-2.5 px-3 text-right align-middle"></td>
              <td className="py-2.5 px-3 text-center align-middle"></td>
              <td className="py-2.5 px-3 text-right align-middle font-mono font-bold text-gray-900">OMR {subtotal.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Description & Financial Summary Grid */}
      <div className="grid grid-cols-2 gap-8 relative z-10 mb-6 print:mb-4 text-[11px] print:text-[10px]">
        
        {/* Left Side: Description & Words */}
        <div className="space-y-4 print:space-y-2">
           {invoice.notes && (
             <div>
               <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[9.5px] mb-1">Description / Reference</h4>
               <p className="text-gray-800 uppercase font-medium bg-gray-50 p-2.5 rounded-lg border border-gray-100">{invoice.notes}</p>
             </div>
           )}
           <div>
             <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[9.5px] mb-1">Invoice Amount In Words</h4>
             <p className="text-gray-800 font-semibold italic bg-gray-50 p-2.5 rounded-lg border border-gray-100">{numberToWords(totalAmount)}</p>
           </div>
        </div>

        {/* Right Side: Totals Table */}
        <div className="w-full flex justify-end">
           <table className="w-full max-w-[280px] text-right border-collapse text-[11px] print:text-[10px]">
             <tbody>
               <tr>
                 <td className="py-2 px-3 align-middle text-gray-600 font-medium">Sub Total</td>
                 <td className="py-2 px-3 align-middle font-mono font-bold text-gray-900">OMR {subtotal.toFixed(3)}</td>
               </tr>
               {discountAmount > 0 && (
                 <tr>
                   <td className="py-1.5 px-3 align-middle text-emerald-600 font-medium">Discount</td>
                   <td className="py-1.5 px-3 align-middle font-mono font-bold text-emerald-600">-OMR {discountAmount.toFixed(3)}</td>
                 </tr>
               )}
               {taxRate > 0 && (
                 <tr>
                   <td className="py-1.5 px-3 align-middle text-gray-600 font-medium">VAT ({taxRate}%)</td>
                   <td className="py-1.5 px-3 align-middle font-mono font-bold text-gray-900">OMR {taxAmount.toFixed(3)}</td>
                 </tr>
               )}
               <tr className="text-white font-bold rounded-lg" style={{ backgroundColor: themeColor }}>
                 <td className="py-2.5 px-3 align-middle rounded-l-md font-bold uppercase tracking-wider text-[10px]">Total</td>
                 <td className="py-2.5 px-3 align-middle rounded-r-md font-mono font-black text-sm">OMR {totalAmount.toFixed(3)}</td>
               </tr>
               <tr>
                 <td className="py-2 px-3 align-middle text-gray-600 border-b border-gray-200 font-medium">Received</td>
                 <td className="py-2 px-3 align-middle border-b border-gray-200 font-mono font-bold text-gray-900">OMR {(isPaid ? totalAmount : 0).toFixed(3)}</td>
               </tr>
               <tr>
                 <td className="py-2 px-3 align-middle text-gray-600 border-b border-gray-200 font-medium">Balance</td>
                 <td className={`py-2 px-3 align-middle border-b border-gray-200 font-mono font-bold ${isPaid ? 'text-gray-900' : 'text-rose-600'}`}>
                   OMR {(isPaid ? 0 : totalAmount).toFixed(3)}
                 </td>
               </tr>
               <tr>
                 <td className="py-2 px-3 align-middle text-gray-600 border-b border-gray-200 font-medium">
                   {isPaid ? 'Payment Mode' : 'Payment Terms'}
                 </td>
                 <td className="py-2 px-3 align-middle border-b border-gray-200 font-bold text-gray-900 text-[10.5px]">
                   {invoice.terms || (isPaid ? 'Bank Transfer' : 'Payment is due within 10 days.')}
                 </td>
               </tr>
             </tbody>
           </table>
        </div>

      </div>

      {/* Terms and Conditions */}
      <div className="relative z-10 space-y-2 mb-6 print:mb-3 text-[10px] print:text-[8.5px] border-t border-gray-100 pt-3">
        <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[9.5px]">Terms and Conditions</h4>
        <p className="text-gray-600">Thanks for doing business with us!</p>
        
        <div className="space-y-0.5 leading-tight text-[10px] print:text-[8.5px] text-gray-700" dir="rtl" style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
          <p className="font-bold text-gray-900">ملاحظة: تم إنجاز المعاملة</p>
          <p>- عدم تحمل الشركة أي قرارات وزارية مفاجئة.</p>
          <p>- لن تتحمل الشركة أي تأخير صدر من قبل العميل.</p>
          <p>- لن يتم إسترجاع مبلغ المكتب إذا تم البدء في المعاملة.</p>
          <p>- لن يتحمل المكتب أي رسوم إضافية تفرض من قبل الحكومة.</p>
        </div>

        <div className="space-y-0.5 mt-2 leading-tight text-[10px] print:text-[8.5px] text-gray-700">
          <p>The company shall not bear responsibility for any sudden ministerial decisions.</p>
          <p>- The company shall not be held liable for any delays caused by the client.</p>
          <p>- The clearance fee is non-refundable once the transaction has commenced.</p>
          <p>- The office will not bear any additional fees imposed by the government.</p>
        </div>
      </div>

      {/* Pay To & Signature Block */}
      <div className="grid grid-cols-2 gap-8 relative z-10 text-[10px] print:text-[8.5px] border-t border-gray-100 pt-3">
        <div>
          <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[9.5px] mb-1">Pay To:</h4>
          <div className="space-y-0.5 text-gray-700">
            <p><span className="text-gray-500 font-medium">Bank Name:</span> BANK MUSCAT</p>
            <p><span className="text-gray-500 font-medium">Bank Account No:</span> 0423081077790019</p>
            <p><span className="text-gray-500 font-medium">Bank SWIFT code:</span> BMUSOMRXXX</p>
            <p><span className="text-gray-500 font-medium">Account holder:</span> OSBIC INTERNATIONAL LLC</p>
            <p><span className="text-gray-500 font-medium">IBAN:</span> OM550270423081077790019</p>
          </div>
        </div>
        
        <div className="text-right flex flex-col justify-end">
          <p className="font-bold text-gray-900">For: OSBIC INTERNATIONAL LLC (OMAN)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 mt-10 print:mt-6 relative z-10 text-center font-bold text-[10px] print:text-[8.5px] text-gray-800">
        <div className="border-t border-gray-400 mx-8 pt-2">Customer Signatory</div>
        <div className="border-t border-gray-400 mx-8 pt-2">Authorized Signatory</div>
      </div>

    </div>
  );
});

InvoiceDocument.displayName = 'InvoiceDocument';

