import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, FileText, CheckCircle2, FileClock, Eye, Edit, Trash2,
  Send, XCircle, Clock, Landmark, Briefcase
} from 'lucide-react';
import { useInvoices, useDeleteInvoice } from '../../hooks/employee/useInvoices';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { useAdminPackages } from '../../hooks/admin/useAdminPackages';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import Skeleton from '../../components/ui/Skeleton';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { useTranslation } from 'react-i18next';

const EmployeeInvoices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: invoices, isLoading } = useInvoices();
  const { data: allServices } = useAdminServices();
  const { data: allPackages } = useAdminPackages();
  const { mutateAsync: deleteInvoice } = useDeleteInvoice();
  const [filter, setFilter] = useState<'all' | 'invoices' | 'quotations' | 'unpaid' | 'paid'>('all');
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['all', 'invoices', 'quotations', 'unpaid', 'paid'].includes(tab)) {
      setFilter(tab as any);
    }
  }, [searchParams]);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteInvoice(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
      alert(isRtl ? 'فشل حذف المستند.' : 'Failed to delete document.');
    }
  };

  const filteredInvoices = invoices?.filter(inv => {
    // Strict Privacy Isolation: Non-manager employees only view invoices belonging to them or their jobs
    if (profile && profile.role === 'employee' && !profile.is_manager) {
      const isInvoiceOwner = inv.employee_id === profile.id;
      const isJobWorker = inv.job && (inv.job.employee_id === profile.id || inv.job.assigned_by === profile.id);
      if (!isInvoiceOwner && !isJobWorker) return false;
    }

    // Status/Type filter
    if (filter === 'invoices' && inv.type === 'quotation') return false;
    if (filter === 'quotations' && inv.type !== 'quotation') return false;
    if (filter === 'unpaid' && (inv.type === 'quotation' || inv.status === 'paid')) return false;
    if (filter === 'paid' && (inv.type === 'quotation' || inv.status !== 'paid')) return false;
    
    // Search filter: ID, client, company, proposal title, service items
    if (search) {
      const q = search.toLowerCase();
      const matchNumber = inv.invoice_number?.toLowerCase()?.includes(q);
      const matchClient = (inv.metadata?.custom_client_name || inv.client?.full_name || inv.client?.company_name || inv.lead?.contact_name || inv.lead?.company_name || '')?.toLowerCase()?.includes(q);
      const matchProposal = (inv.metadata?.proposal_title || inv.metadata?.quote_name || inv.notes || '')?.toLowerCase()?.includes(q);
      const matchItems = inv.items?.some(it => it.description?.toLowerCase()?.includes(q));
      if (!matchNumber && !matchClient && !matchProposal && !matchItems) return false;
    }
    return true;
  });

  const getStatusDisplay = (inv: any) => {
    if (inv.type === 'quotation') {
      const isAccepted = inv.status === 'accepted' || Boolean(inv.job_id || inv.job);
      if (isAccepted) {
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-emerald-500/20 whitespace-nowrap">
            <CheckCircle2 size={11} /> {isRtl ? 'مقبول' : 'Accepted'}
          </span>
        );
      }
      if (inv.status === 'sent' || inv.status === 'viewed') {
        return (
          <span className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-sky-500/20 whitespace-nowrap">
            <Send size={11} /> {isRtl ? 'مرسل' : 'Sent'}
          </span>
        );
      }
      if (inv.status === 'rejected') {
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-rose-500/20 whitespace-nowrap">
            <XCircle size={11} /> {isRtl ? 'مرفوض' : 'Rejected'}
          </span>
        );
      }
      if (inv.status === 'expired') {
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-amber-500/20 whitespace-nowrap">
            <Clock size={11} /> {isRtl ? 'منتهي' : 'Expired'}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-border whitespace-nowrap">
          <FileClock size={11} /> {isRtl ? 'مسودة' : 'Draft'}
        </span>
      );
    }

    if (inv.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-emerald-500/20 whitespace-nowrap">
          <CheckCircle2 size={11} /> {isRtl ? 'مدفوعة' : 'Paid'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-amber-500/20 whitespace-nowrap">
        <FileClock size={11} /> {isRtl ? 'غير مدفوعة' : 'Unpaid'}
      </span>
    );
  };

  const getDocumentFinancials = (inv: any) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const discount = Number(inv.discount_amount) || 0;

    // 1. Direct explicit values in metadata (highest fidelity)
    if (inv.metadata?.total_ministry_fee !== undefined && inv.metadata?.total_ministry_fee !== null && Number(inv.metadata.total_ministry_fee) > 0) {
      const govFee = Number(inv.metadata.total_ministry_fee) || 0;
      const rawProfit = inv.metadata?.total_service_fee !== undefined && inv.metadata?.total_service_fee !== null
        ? Number(inv.metadata.total_service_fee)
        : Math.max(0, totalAmount - govFee);
      return {
        govFee,
        profit: Math.max(0, rawProfit - discount)
      };
    }

    // 2. Saved items detail in metadata
    if (Array.isArray(inv.metadata?.items_detail) && inv.metadata.items_detail.length > 0) {
      const govFee = inv.metadata.items_detail.reduce((sum: number, it: any) => sum + (Number(it.ministry_fee) || 0) * (Number(it.quantity) || 1), 0);
      const srvFee = inv.metadata.items_detail.reduce((sum: number, it: any) => sum + (Number(it.service_fee) || 0) * (Number(it.quantity) || 1), 0);
      if (govFee > 0 || srvFee > 0) {
        return {
          govFee,
          profit: Math.max(0, (srvFee > 0 ? srvFee : Math.max(0, totalAmount - govFee)) - discount)
        };
      }
    }

    // 3. Match each item from invoice_items against allServices
    if (inv.items && inv.items.length > 0 && allServices && allServices.length > 0) {
      let matchedGov = 0;
      let matchedSrv = 0;

      for (const it of inv.items) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(it.unit_price) || 0;
        const desc = (it.description || '').trim().toLowerCase();

        // Check if item itself already has ministry_fee
        if (it.ministry_fee !== undefined && it.ministry_fee !== null && Number(it.ministry_fee) > 0) {
          const mFee = Number(it.ministry_fee);
          matchedGov += mFee * qty;
          const sFee = it.service_fee !== undefined && it.service_fee !== null ? Number(it.service_fee) : Math.max(0, unitPrice - mFee);
          matchedSrv += sFee * qty;
          continue;
        }

        // Match against allServices
        const matched = allServices.find((s: any) => {
          const sEn = (s.name_en || '').trim().toLowerCase();
          const sAr = (s.name_ar || '').trim();
          if (sEn && (desc === sEn || desc.includes(sEn) || sEn.includes(desc))) return true;
          if (sAr && desc === sAr) return true;
          return false;
        });

        if (matched) {
          const mFee = Number(matched.ministry_fee) || 0;
          const sFee = matched.work_fee !== undefined ? Number(matched.work_fee) : Math.max(0, unitPrice - mFee);
          matchedGov += mFee * qty;
          matchedSrv += sFee * qty;
        }
      }

      if (matchedGov > 0) {
        const govFee = Math.min(matchedGov, totalAmount * 0.95);
        return {
          govFee,
          profit: Math.max(0, (matchedSrv > 0 ? matchedSrv : Math.max(0, totalAmount - govFee)) - discount)
        };
      }
    }

    // 4. Check if linked to job with ministry_fee / work_fee
    if (inv.job && (Number(inv.job.ministry_fee) > 0 || Number(inv.job.work_fee) > 0)) {
      const govFee = Number(inv.job.ministry_fee) || 0;
      const srvFee = Number(inv.job.work_fee) || Math.max(0, totalAmount - govFee);
      return {
        govFee,
        profit: Math.max(0, srvFee - discount)
      };
    }

    // 5. Check if linked job's service has ministry_fee
    if (inv.job?.service && (Number(inv.job.service.ministry_fee) > 0 || Number(inv.job.service.work_fee) > 0)) {
      const govFee = Number(inv.job.service.ministry_fee) || 0;
      const srvFee = Number(inv.job.service.work_fee) || Math.max(0, totalAmount - govFee);
      return {
        govFee,
        profit: Math.max(0, srvFee - discount)
      };
    }

    // 6. Check if any package matches description or proposal title
    if (allPackages && allPackages.length > 0) {
      const fullText = `${inv.metadata?.proposal_title || ''} ${inv.items?.map((i: any) => i.description).join(' ') || ''}`.toLowerCase();
      const matchedPkg = allPackages.find((p: any) => {
        const pEn = (p.name_en || '').toLowerCase();
        return pEn && (fullText.includes(pEn) || pEn.includes(fullText.trim()));
      });

      if (matchedPkg && matchedPkg.services && matchedPkg.services.length > 0) {
        const pkgGov = matchedPkg.services.reduce((s: number, ps: any) => s + (Number(ps.service?.ministry_fee) || 0) * (Number(ps.default_quantity) || 1), 0);
        if (pkgGov > 0) {
          const govFee = Math.min(pkgGov, totalAmount * 0.85);
          return {
            govFee,
            profit: Math.max(0, totalAmount - govFee - discount)
          };
        }
      }
    }

    // Default fallback
    return {
      govFee: 0,
      profit: Math.max(0, totalAmount - discount)
    };
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 font-sans">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">{isRtl ? 'المالية' : 'Financials'}</p>
          <h1 className="text-3xl font-syne font-bold text-foreground tracking-tight">{isRtl ? 'الفواتير وعروض الأسعار' : 'Invoices & Quotations'}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group hidden sm:block">
            <Search size={14} className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors`} />
            <input 
              type="text"
              placeholder={isRtl ? 'البحث بالرمز أو العميل...' : 'Search by ID or Client...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border border-border rounded-xl ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-all w-full md:w-64 placeholder:text-muted-foreground/50`}
            />
          </div>
          <button 
            onClick={() => navigate('/employee/quotations/new')}
            className="px-4 py-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 text-[10px] whitespace-nowrap active:scale-95"
          >
            <Plus size={14} /> {isRtl ? 'عرض سعر جديد' : 'New Quotation'}
          </button>
          <button 
            onClick={() => navigate('/employee/invoices/new')}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all uppercase tracking-widest flex items-center gap-1.5 text-[10px] shadow-lg shadow-primary/20 whitespace-nowrap active:scale-95"
          >
            <Plus size={14} /> {isRtl ? 'فاتورة جديدة' : 'New Invoice'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 border-b border-border/30 overflow-x-auto no-scrollbar font-sans">
        {[
          { key: 'all', label: isRtl ? 'جميع المستندات' : 'All Documents' },
          { key: 'invoices', label: isRtl ? 'الفواتير' : 'Invoices' },
          { key: 'quotations', label: isRtl ? 'عروض الأسعار' : 'Quotations' },
          { key: 'unpaid', label: isRtl ? 'الفواتير غير المدفوعة' : 'Unpaid Invoices' },
          { key: 'paid', label: isRtl ? 'الفواتير المدفوعة' : 'Paid Invoices' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${filter === f.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f.label}
            {filter === f.key && (
              <motion.div layoutId="invTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3 font-sans">
        {isLoading ? (
          <>
             <Skeleton height={80} rounded="xl" />
             <Skeleton height={80} rounded="xl" />
             <Skeleton height={80} rounded="xl" />
          </>
        ) : filteredInvoices?.length === 0 ? (
           <div className="py-24 text-center border border-dashed border-border/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                 <FileText size={20} />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{isRtl ? 'لم يتم العثور على مستندات' : 'No Documents Found'}</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{isRtl ? 'قم بإنشاء عرض سعر أو فاتورة للبدء.' : 'Create a quotation or invoice to get started.'}</p>
           </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredInvoices?.map(inv => {
              const clientDisplayName = 
                inv.metadata?.custom_client_name || 
                inv.client?.company_name || 
                inv.client?.full_name || 
                inv.lead?.company_name || 
                inv.lead?.contact_name || 
                (inv.metadata?.is_custom_client ? (isRtl ? 'عميل مخصص' : 'Custom Client') : (isRtl ? 'عميل عام' : 'Client'));

              const secondaryClientInfo = 
                (inv.client?.company_name && inv.client?.company_name !== clientDisplayName ? inv.client.company_name : null) ||
                (inv.lead?.company_name && inv.lead?.company_name !== clientDisplayName ? inv.lead.company_name : null) ||
                (inv.metadata?.custom_company_name && inv.metadata?.custom_company_name !== clientDisplayName ? inv.metadata.custom_company_name : null);

              const proposalTitle = 
                inv.metadata?.proposal_title || 
                inv.metadata?.quote_name || 
                inv.notes || 
                '';

              const itemsSummary = (inv.items && inv.items.length > 0)
                ? inv.items.map((it: any) => it.description).filter(Boolean).slice(0, 2).join(' • ') + (inv.items.length > 2 ? ` (+${inv.items.length - 2})` : '')
                : '';

              const serviceOrQuoteName = proposalTitle || itemsSummary || (inv.type === 'quotation' ? (isRtl ? 'عرض سعر خدمات' : 'Services Quotation') : (isRtl ? 'فاتورة خدمات' : 'Services Invoice'));

              // Quotation & Invoice Gov Fee vs Service Fee / Profit Calculation
              const { govFee: totalGovFee, profit: netProfit } = getDocumentFinancials(inv);

              const docUrl = `/employee/${inv.type === 'quotation' ? 'quotations' : 'invoices'}/${inv.id!}`;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={inv.id}
                  className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary/40 hover:shadow-md transition-all group shadow-sm gap-4"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    <div 
                      onClick={() => navigate(docUrl)}
                      className="w-12 h-12 rounded-xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors shrink-0 cursor-pointer"
                    >
                      <FileText size={22} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top Row: Client Name (Main title) + Quote ID (small) + Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => navigate(docUrl)}
                          className="text-base font-bold text-foreground hover:text-primary transition-colors text-left truncate max-w-xs sm:max-w-md font-sans"
                        >
                          {clientDisplayName}
                        </button>

                        {secondaryClientInfo && (
                          <span className="text-xs text-muted-foreground font-medium hidden sm:inline truncate max-w-[200px]">
                            • {secondaryClientInfo}
                          </span>
                        )}

                        {/* Quote ID - Compact & Subtle */}
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted/80 border border-border text-muted-foreground tracking-tight whitespace-nowrap">
                          {inv.invoice_number || (isRtl ? 'مسودة' : 'DRAFT')}
                        </span>

                        {/* Status Badge */}
                        {getStatusDisplay(inv)}
                      </div>

                      {/* Second Row: Service / Quote Name + Job Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="text-foreground/80 font-medium truncate max-w-sm">
                          {serviceOrQuoteName}
                        </span>

                        {inv.job && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
                            {isRtl ? 'مشروع:' : 'Job:'} {inv.job?.job_code}
                          </span>
                        )}

                        {inv.items && inv.items.length > 0 && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap hidden sm:inline">
                            • {inv.items.length} {inv.items.length === 1 ? (isRtl ? 'بند' : 'item') : (isRtl ? 'بنود' : 'items')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                    <div className="text-left sm:text-right space-y-1">
                      <p className="text-lg font-black text-foreground tracking-tight leading-none">
                        {inv.total_amount.toFixed(3)} <span className="text-xs font-bold text-muted-foreground">{isRtl ? 'ر.ع.' : 'OMR'}</span>
                      </p>

                      {/* Gov Fee & Profit Badges for BOTH Quotations & Invoices */}
                      <div className="flex items-center gap-1.5 sm:justify-end flex-wrap pt-0.5">
                        <span 
                          title={isRtl ? 'رسوم الدوائر الحكومية (ROP, MOCIIP, Labour)' : 'Estimated Government pass-through fees'}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap"
                        >
                          <Landmark size={10} />
                          <span>{isRtl ? 'حكومي:' : 'Gov:'} {totalGovFee.toFixed(3)}</span>
                        </span>
                        <span 
                          title={isRtl ? 'رسوم الخدمة / ربح المكتب' : 'Service Fee / OSBIC Profit'}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap"
                        >
                          <Briefcase size={10} />
                          <span>{isRtl ? 'الربح:' : 'Profit:'} {netProfit.toFixed(3)}</span>
                        </span>
                      </div>

                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                        {format(new Date(inv.issue_date || new Date()), isRtl ? 'yyyy/MM/dd' : 'dd MMM yyyy')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => navigate(`/employee/${inv.type === 'quotation' ? 'quotations' : 'invoices'}/${inv.id!}?view=true`)}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all shadow-sm"
                        title={isRtl ? 'عرض المستند' : 'View Document'}
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => navigate(docUrl)}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-amber-500 hover:border-amber-500 hover:text-white transition-all shadow-sm"
                        title={isRtl ? 'تعديل المستند' : 'Edit Document'}
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(inv.id!)}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive hover:border-destructive hover:text-destructive-foreground transition-all shadow-sm"
                        title={isRtl ? 'حذف المستند' : 'Delete Document'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title={isRtl ? 'حذف المستند' : 'Delete Document'}
        message={isRtl ? 'هل أنت متأكد من رغبتك في حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this document? This action cannot be undone.'}
        confirmText={isRtl ? 'حذف' : 'Delete'}
        isDestructive={true}
      />
    </div>
  );
};

export default EmployeeInvoices;
