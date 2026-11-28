import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText, Building2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { type AssetAssignment } from '../../../hooks/employee/useAssets';

interface AssetCustodyVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  assignments: AssetAssignment[];
}

export const AssetCustodyVoucherModal: React.FC<AssetCustodyVoucherModalProps> = ({
  isOpen,
  onClose,
  employee,
  assignments
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const today = format(new Date(), 'dd/MM/yyyy');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Top Bar (Non-printable) */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 print:hidden">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <FileText size={16} className="text-primary" />
              <span>Official Equipment Custody Voucher • إقرار استلام عهدة</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Printer size={14} /> Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="p-8 overflow-y-auto max-h-[80vh] bg-white text-gray-900 font-sans print:p-0 print:m-0 print:max-h-none">
            <div ref={printRef} className="space-y-6 max-w-2xl mx-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
                <div>
                  <h1 className="text-xl font-black font-syne uppercase tracking-wider text-black">
                    OSBIC OMAN
                  </h1>
                  <p className="text-xs text-gray-600 font-medium">Osan Business & Investment Consultancy</p>
                  <p className="text-[11px] text-gray-500 font-mono">Sultanate of Oman • Muscat / Salalah / Sohar</p>
                </div>
                <div className="text-right" dir="rtl">
                  <h2 className="text-lg font-black text-black">إقرار استلام عهدة ومعدات</h2>
                  <p className="text-xs text-gray-600">نموذج تسليم الأجهزة والتقنيات للموظف</p>
                  <p className="text-[11px] text-gray-500 font-mono">التاريخ: {today}</p>
                </div>
              </div>

              {/* Employee Info Grid */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Employee Name / اسم الموظف:</span>
                  <strong className="text-gray-900 text-sm block mt-0.5">{employee.full_name}</strong>
                  <span className="text-gray-600 font-mono text-[11px]">Code: {employee.employee_code || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Department / Branch:</span>
                  <strong className="text-gray-900 text-sm block mt-0.5">
                    {employee.department?.toUpperCase() || 'Operations'} • {employee.branch?.name || 'Muscat HQ'}
                  </strong>
                  <span className="text-gray-600 font-mono text-[11px]">Handover Date: {today}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Assigned Hardware & IT Equipment Inventory ({assignments.length} items)
                </h3>
                <table className="w-full text-left border-collapse text-xs border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 text-[10px] font-bold text-gray-700 uppercase border-b border-gray-200">
                      <th className="p-2.5">Asset Tag</th>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Serial Number</th>
                      <th className="p-2.5">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {assignments.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="p-2.5 font-mono font-bold text-black">{item.asset?.asset_tag || '-'}</td>
                        <td className="p-2.5 font-semibold text-gray-900">{item.asset?.name || '-'}</td>
                        <td className="p-2.5 text-gray-600 uppercase text-[10px] font-medium">
                          {item.asset?.category.replace('_', ' ') || '-'}
                        </td>
                        <td className="p-2.5 font-mono text-gray-600 text-[10px]">{item.asset?.serial_number || 'N/A'}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-800">
                            {item.handover_condition || 'Good'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legal Terms (Bilingual) */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-[10px] text-gray-600 leading-relaxed">
                <p>
                  <strong>Acknowledgment:</strong> I hereby acknowledge the receipt of the equipment listed above in working condition. I undertake to maintain these assets with due care, use them exclusively for company business, and return them immediately upon resignation, termination, or formal request by management.
                </p>
                <p dir="rtl" className="text-right">
                  <strong>إقرار وتعهد:</strong> أقر أنا الموظف المذكور أعلاه باستلامي لكافة الأجهزة والمعدات الموضحة في هذا الكشف بحالة جيدة وصالحة للعمل، وأتعهد بالمحافظة عليها واستخدامها لأغراض العمل فقط، وإعادتها فور انتهاء علاقة العمل أو عند طلب الإدارة.
                </p>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-xs font-bold text-gray-900">Employee Signature / توقيع الموظف</p>
                    <p className="text-[10px] text-gray-500 mt-1">Date: ________________________</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-t border-gray-400 pt-2 text-right" dir="rtl">
                    <p className="text-xs font-bold text-gray-900">اعتماد إدارة الموارد البشرية والتقنية / HR & IT</p>
                    <p className="text-[10px] text-gray-500 mt-1">الختم والتاريخ: __________________</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
