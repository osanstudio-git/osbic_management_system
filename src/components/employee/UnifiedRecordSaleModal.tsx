import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, DollarSign, CheckCircle2, AlertCircle, RefreshCw,
  Search, Link as LinkIcon, User, Building2, Phone, FileText,
  CreditCard, Banknote, Landmark, Upload, ChevronRight, Sparkles,
  Layers, ArrowRight, ShieldCheck, Check, Clock, Plus, MessageSquare
} from 'lucide-react';
import { format, differenceInDays, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  useUnifiedSalesEntry,
  type CandidateOpsJob,
  type ClientOrLeadOption
} from '../../hooks/employee/useUnifiedSalesEntry';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'new_sale' | 'rest_payment';
}

const COMMON_WORK_TYPES = [
  'Commercial Registration (CR) - New',
  'CR Amendment / Activity Addition',
  'ROP Visa & Residency',
  'Civil ID / Resident Card',
  'Ministry of Labour / Work Permit',
  'Sanad & PRO Services',
  'Municipality & Tenancy Contract',
  'Chamber of Commerce (OCCI)',
  'Tax Authority & VAT Filing',
  'Document & Embassy Attestation',
  'B2B Corporate Partnership',
  'Other Corporate Services',
];

interface SuccessData {
  clientName: string;
  phone?: string;
  amount: number;
  workType: string;
  paymentMode: string;
  date: string;
  reference?: string;
  remainingBalance?: number;
}

function openWhatsAppReceipt(data: SuccessData) {
  let p = (data.phone || '').replace(/[^0-9]/g, '');
  if (!p) {
    toast.error('No client phone number available for WhatsApp');
    return;
  }
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 8) p = '968' + p;
  else if (p.startsWith('0') && p.length === 9) p = '968' + p.slice(1);

  const lines = [
    `*OSBIC INTERNATIONAL LLC — Official Payment Voucher*`,
    `----------------------------------------`,
    `*Dear ${data.clientName},*`,
    `We gratefully confirm receipt of your payment:`,
    ``,
    `• *Amount Received:* ${data.amount.toFixed(3)} OMR`,
    `• *Service / Work:* ${data.workType}`,
    `• *Transaction Date:* ${data.date}`,
    `• *Payment Method:* ${data.paymentMode.toUpperCase()}`,
    data.reference ? `• *Reference #:* ${data.reference}` : '',
    data.remainingBalance != null && data.remainingBalance > 0
      ? `• *Remaining Balance Due:* ${data.remainingBalance.toFixed(3)} OMR`
      : `• *Account Status:* Settled / Fully Paid`,
    ``,
    `Your transaction has been registered in our official management system. Thank you for choosing OSBIC International LLC!`,
    `----------------------------------------`,
    `Muscat, Sultanate of Oman | www.osbic.net`,
  ].filter(Boolean).join('\n');

  window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(lines)}`, '_blank', 'noopener,noreferrer');
}

export const UnifiedRecordSaleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultTab = 'new_sale'
}) => {
  const [activeTab, setActiveTab] = useState<'new_sale' | 'rest_payment'>(defaultTab);

  const {
    clientOptions,
    isLoadingClients,
    fetchClientQuotations,
    fetchCandidateOpsJobs,
    jobsWithBalance,
    isLoadingJobsWithBalance,
    recordNewSale,
    isRecordingSale,
    recordRestPayment,
    isRecordingRestPayment,
  } = useUnifiedSalesEntry();

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: NEW SALE & ADVANCE STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [transactionDate, setTransactionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClientOption, setSelectedClientOption] = useState<ClientOrLeadOption | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState<boolean>(false);
  const [manualClientMode, setManualClientMode] = useState<boolean>(false);

  // Manual Client Fields
  const [manualName, setManualName] = useState<string>('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualCompany, setManualCompany] = useState<string>('');

  // Work & Quotation Fields
  const [workType, setWorkType] = useState<string>(COMMON_WORK_TYPES[0]);
  const [workDescription, setWorkDescription] = useState<string>('');
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');

  // Ops Candidate Alignment State
  const [candidateOpsJobs, setCandidateOpsJobs] = useState<CandidateOpsJob[]>([]);
  const [selectedExistingJobId, setSelectedExistingJobId] = useState<string | null>(null);
  const [isLoadingCandidateJobs, setIsLoadingCandidateJobs] = useState<boolean>(false);

  // Financials
  const [totalDealAmount, setTotalDealAmount] = useState<string>('');
  const [governmentFeeEstimate, setGovernmentFeeEstimate] = useState<string>('0');
  const [paymentType, setPaymentType] = useState<'advance' | 'full' | 'custom'>('advance');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'bank_transfer'>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 2: REST PAYMENT STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [restJobSearch, setRestJobSearch] = useState<string>('');
  const [selectedJobForRest, setSelectedJobForRest] = useState<any | null>(null);
  const [restPaymentDate, setRestPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [restAmount, setRestAmount] = useState<string>('');
  const [restPaymentMode, setRestPaymentMode] = useState<'cash' | 'card' | 'bank_transfer'>('bank_transfer');
  const [restReference, setRestReference] = useState<string>('');
  const [restNotes, setRestNotes] = useState<string>('');
  const [restReceiptFile, setRestReceiptFile] = useState<File | null>(null);

  // Success Confirmation State
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Days difference for backlog indicator
  const daysAgoNewSale = differenceInDays(new Date(), new Date(transactionDate));
  const daysAgoRest = differenceInDays(new Date(), new Date(restPaymentDate));

  // Sync default tab if prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // When Client Option Selected: Fetch open quotes & check for candidate Ops jobs
  useEffect(() => {
    if (!selectedClientOption) {
      setCandidateOpsJobs([]);
      setSelectedExistingJobId(null);
      setAvailableQuotes([]);
      setSelectedQuoteId('');
      return;
    }

    const clientId = selectedClientOption.type === 'client' ? selectedClientOption.id : null;
    const leadId = selectedClientOption.type === 'lead' ? selectedClientOption.id : null;

    // Fetch quotes
    fetchClientQuotations(clientId, leadId).then(quotes => {
      setAvailableQuotes(quotes);
    });

    // Check existing Ops jobs
    setIsLoadingCandidateJobs(true);
    fetchCandidateOpsJobs(clientId, selectedClientOption.phone).then(jobs => {
      setCandidateOpsJobs(jobs);
      setIsLoadingCandidateJobs(false);
      // Auto-select first matching job if one exists
      if (jobs.length > 0) {
        setSelectedExistingJobId(jobs[0].id);
        // Pre-fill total deal if job has fee
        if (jobs[0].total_fee) {
          setTotalDealAmount(jobs[0].total_fee.toString());
          setGovernmentFeeEstimate((jobs[0].ministry_fee || 0).toString());
        }
      } else {
        setSelectedExistingJobId(null);
      }
    });
  }, [selectedClientOption]);

  // Auto-fill amount based on Payment Type (50% or Full)
  useEffect(() => {
    const total = parseFloat(totalDealAmount) || 0;
    if (paymentType === 'advance') {
      setAmountReceived((total * 0.5).toFixed(3));
    } else if (paymentType === 'full') {
      setAmountReceived(total.toFixed(3));
    }
  }, [totalDealAmount, paymentType]);

  // When Quotation is Selected, auto-fill details
  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    const quote = availableQuotes.find(q => q.id === quoteId);
    if (quote) {
      setTotalDealAmount((quote.total_amount || 0).toString());
      if (quote.items && quote.items.length > 0) {
        const govFee = quote.items.reduce((s: number, it: any) => s + (Number(it.ministry_fee) || 0), 0);
        setGovernmentFeeEstimate(govFee.toString());
        setWorkType(quote.items[0].description || COMMON_WORK_TYPES[0]);
      }
      toast.success(`Loaded details from Quotation #${quote.invoice_number || quote.id.slice(0, 8)}`);
    }
  };

  // Filter Clients in autocomplete
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientOptions.slice(0, 15);
    const q = clientSearchQuery.toLowerCase();
    return clientOptions.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.companyName && c.companyName.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [clientOptions, clientSearchQuery]);

  // Filter Jobs with Balance in Tab 2
  const filteredJobsWithBalance = useMemo(() => {
    if (!restJobSearch.trim()) return jobsWithBalance;
    const q = restJobSearch.toLowerCase();
    return jobsWithBalance.filter((j: any) =>
      (j.job_code && j.job_code.toLowerCase().includes(q)) ||
      (j.custom_name && j.custom_name.toLowerCase().includes(q)) ||
      (j.client?.full_name && j.client.full_name.toLowerCase().includes(q)) ||
      (j.client?.company_name && j.client.company_name.toLowerCase().includes(q)) ||
      (j.client?.phone && j.client.phone.includes(q))
    );
  }, [jobsWithBalance, restJobSearch]);

  // Select Job for Rest Payment
  const handleSelectJobForRest = (job: any) => {
    setSelectedJobForRest(job);
    const remaining = Number(job.remaining_amount) || Math.max(0, Number(job.total_fee || 0) - Number(job.advance_amount || 0));
    setRestAmount(remaining > 0 ? remaining.toFixed(3) : (Number(job.total_fee || 0) * 0.5).toFixed(3));
  };

  // Submit New Sale
  const handleSubmitNewSale = async (e: React.FormEvent) => {
    e.preventDefault();

    const clientName = manualClientMode ? manualName.trim() : (selectedClientOption?.name || '');
    if (!clientName) {
      return toast.error('Please select an existing client or enter client name');
    }

    const total = parseFloat(totalDealAmount);
    if (isNaN(total) || total <= 0) {
      return toast.error('Please enter a valid Total Deal Amount');
    }

    const received = parseFloat(amountReceived);
    if (isNaN(received) || received < 0) {
      return toast.error('Please enter a valid Amount Received');
    }

    try {
      await recordNewSale({
        transactionDate,
        clientId: !manualClientMode && selectedClientOption?.type === 'client' ? selectedClientOption.id : null,
        leadId: !manualClientMode && selectedClientOption?.type === 'lead' ? selectedClientOption.id : null,
        clientName,
        clientPhone: manualClientMode ? manualPhone : (selectedClientOption?.phone || ''),
        companyName: manualClientMode ? manualCompany : (selectedClientOption?.companyName || ''),
        workType,
        workDescription,
        totalDealAmount: total,
        governmentFeeEstimate: parseFloat(governmentFeeEstimate) || 0,
        paymentMode,
        paymentType,
        amountReceived: received,
        referenceNumber,
        notes,
        receiptFile,
        linkToExistingJobId: selectedExistingJobId,
        quotationId: selectedQuoteId || null,
      });

      const remainingBalance = Math.max(0, total - received);
      setSuccessData({
        clientName,
        phone: manualClientMode ? manualPhone : (selectedClientOption?.phone || ''),
        amount: received,
        workType,
        paymentMode,
        date: transactionDate,
        reference: referenceNumber,
        remainingBalance,
      });
    } catch (err) {
      // Error handled in hook
    }
  };

  // Submit Rest Payment
  const handleSubmitRestPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedJobForRest) {
      return toast.error('Please select an active job with remaining balance');
    }

    const amount = parseFloat(restAmount);
    if (isNaN(amount) || amount <= 0) {
      return toast.error('Please enter a valid Rest Payment Amount');
    }

    try {
      await recordRestPayment({
        jobId: selectedJobForRest.id,
        paymentDate: restPaymentDate,
        amount,
        paymentMode: restPaymentMode,
        referenceNumber: restReference,
        notes: restNotes,
        receiptFile: restReceiptFile,
      });

      const newRemaining = Math.max(0, (Number(selectedJobForRest.remaining_amount) || 0) - amount);
      setSuccessData({
        clientName: selectedJobForRest.client?.full_name || selectedJobForRest.custom_name || 'Client',
        phone: selectedJobForRest.client?.phone || '',
        amount,
        workType: selectedJobForRest.custom_name || 'Rest Balance Payment',
        paymentMode: restPaymentMode,
        date: restPaymentDate,
        reference: restReference,
        remainingBalance: newRemaining,
      });
    } catch (err) {
      // Error handled in hook
    }
  };

  if (!isOpen) return null;

  const estimatedProfit = Math.max(0, (parseFloat(totalDealAmount) || 0) - (parseFloat(governmentFeeEstimate) || 0));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold font-syne text-foreground flex items-center gap-2">
                  Unified Sales & Payment Hub
                </h2>
                <p className="text-xs text-muted-foreground">
                  Record real-time or backlog deals, advance receipts & rest milestone payments
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSuccessData(null);
                onClose();
              }}
              className="w-9 h-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* If Success: Render WhatsApp Voucher Card */}
          {successData ? (
            <div className="p-8 text-center space-y-6 flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-2xl font-syne font-bold text-foreground">Payment Recorded Successfully!</h3>
                <p className="text-xs text-muted-foreground mt-1">Transaction registered and synchronized with active jobs and ledgers</p>
              </div>

              {/* Summary Card */}
              <div className="w-full max-w-md p-5 rounded-2xl bg-muted/20 border border-border text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Client Name:</span>
                  <span className="font-bold text-foreground">{successData.clientName}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Service / Work:</span>
                  <span className="font-bold text-foreground">{successData.workType}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Transaction Date:</span>
                  <span className="font-mono font-bold text-foreground">{successData.date}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Amount Received:</span>
                  <span className="font-syne font-extrabold text-base text-emerald-400">{successData.amount.toFixed(3)} OMR</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Remaining Balance:</span>
                  <span className={`font-mono font-bold ${successData.remainingBalance && successData.remainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {successData.remainingBalance ? `${successData.remainingBalance.toFixed(3)} OMR` : '0.000 OMR (Settled)'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                {successData.phone && (
                  <button
                    type="button"
                    onClick={() => openWhatsAppReceipt(successData)}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    <MessageSquare size={16} /> Send WhatsApp Receipt
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSuccessData(null);
                    onClose();
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs transition-all"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 px-6 pt-4 pb-2 bg-muted/10 border-b border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('new_sale')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === 'new_sale'
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <DollarSign size={16} /> New Deal / Advance Payment
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('rest_payment')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === 'rest_payment'
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <CheckCircle2 size={16} /> Collect Remaining Balance ({jobsWithBalance.length})
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {activeTab === 'new_sale' ? (
              <form id="new-sale-form" onSubmit={handleSubmitNewSale} className="space-y-6">
                {/* 1. Transaction Date & Backlog Selector */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar size={14} className="text-primary" /> Transaction Date (Backlog Friendly)
                    </label>

                    {/* Quick Date Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setTransactionDate(format(new Date(), 'yyyy-MM-dd'))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          transactionDate === format(new Date(), 'yyyy-MM-dd')
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          transactionDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          transactionDate === format(subDays(new Date(), 7), 'yyyy-MM-dd')
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        1 Week Ago
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={e => setTransactionDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:border-primary focus:outline-none"
                    />

                    {daysAgoNewSale > 0 && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-xl">
                        <Clock size={13} /> Backlogging sale: {daysAgoNewSale} days ago
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Client Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User size={14} className="text-primary" /> Client or Lead Information
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setManualClientMode(!manualClientMode);
                        setSelectedClientOption(null);
                      }}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      {manualClientMode ? '← Search Existing Clients/Leads' : '+ Enter New / Walk-in Client'}
                    </button>
                  </div>

                  {!manualClientMode ? (
                    <div className="relative">
                      <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder={isLoadingClients ? 'Loading clients...' : 'Search by client name, company, or phone number...'}
                          value={clientSearchQuery}
                          onChange={e => {
                            setClientSearchQuery(e.target.value);
                            setIsClientDropdownOpen(true);
                          }}
                          onFocus={() => setIsClientDropdownOpen(true)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:outline-none"
                        />
                      </div>

                      {/* Selected Client Card */}
                      {selectedClientOption && (
                        <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {selectedClientOption.type === 'client' ? 'CLI' : 'LEAD'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{selectedClientOption.name}</p>
                              <p className="text-xs text-muted-foreground">{selectedClientOption.phone || 'No phone provided'}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedClientOption(null)}
                            className="text-xs text-muted-foreground hover:text-foreground p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Autocomplete Dropdown */}
                      {isClientDropdownOpen && !selectedClientOption && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsClientDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-20 divide-y divide-border/40">
                            {filteredClients.map(c => (
                              <button
                                key={`${c.type}-${c.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedClientOption(c);
                                  setClientSearchQuery('');
                                  setIsClientDropdownOpen(false);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-foreground text-sm">{c.name}</span>
                                  {c.phone && <span className="text-muted-foreground ml-2">({c.phone})</span>}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  c.type === 'client' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {c.type}
                                </span>
                              </button>
                            ))}
                            {filteredClients.length === 0 && (
                              <div className="p-4 text-center text-xs text-muted-foreground">
                                No clients found. Switch to "Enter New / Walk-in Client".
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">Client Name *</label>
                        <input
                          type="text"
                          required
                          value={manualName}
                          onChange={e => setManualName(e.target.value)}
                          placeholder="e.g. Salim Al-Harthy"
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">Phone Number</label>
                        <input
                          type="text"
                          value={manualPhone}
                          onChange={e => setManualPhone(e.target.value)}
                          placeholder="+968 9XXXXXXX"
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">Company Name</label>
                        <input
                          type="text"
                          value={manualCompany}
                          onChange={e => setManualCompany(e.target.value)}
                          placeholder="Company LLC"
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Smart Ops Work Auto-Alignment Card */}
                {selectedClientOption && candidateOpsJobs.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Existing Ops Work Found ({candidateOpsJobs.length} active)
                        </h4>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Avoid duplicate records by linking
                      </span>
                    </div>

                    <div className="space-y-2">
                      {candidateOpsJobs.map(job => {
                        const isSelected = selectedExistingJobId === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedExistingJobId(isSelected ? null : job.id)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                                : 'bg-background/80 border-border hover:border-amber-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                isSelected ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check size={12} />}
                              </div>
                              <div>
                                <p className="font-bold text-foreground">
                                  {job.job_code} — {job.custom_name || job.service?.name_en || 'Active Job'}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Started by Ops: {job.ops_employee?.full_name || 'Ops Team'} • Gov Fees Spent: {job.total_expenses_spent?.toFixed(3) || '0.000'} OMR
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-syne font-bold text-foreground">{job.total_fee} OMR</span>
                              <p className="text-[10px] text-muted-foreground">Total Fee</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {selectedExistingJobId
                        ? '✅ This sale payment will merge directly into the existing Ops job ledger.'
                        : 'Creating a brand new job for this client.'}
                    </p>
                  </div>
                )}

                {/* 4. Open Quotations for Client */}
                {availableQuotes.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                    <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <FileText size={14} /> Open Quotation Detected
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {availableQuotes.map(q => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleSelectQuote(q.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selectedQuoteId === q.id
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-background border-border text-foreground hover:bg-muted/50'
                          }`}
                        >
                          Quote #{q.invoice_number || q.id.slice(0, 6)} ({q.total_amount} OMR)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Work Type & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Service Type *</label>
                    <select
                      value={workType}
                      onChange={e => setWorkType(e.target.value)}
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:border-primary focus:outline-none"
                    >
                      {COMMON_WORK_TYPES.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Details / Notes</label>
                    <input
                      type="text"
                      value={workDescription}
                      onChange={e => setWorkDescription(e.target.value)}
                      placeholder="e.g. 1 Year investor visa, CR activities..."
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* 6. Financials Split & Payment */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <DollarSign size={14} className="text-primary" /> Financials & Payment Terms
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Total Deal Amount (OMR) *</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={totalDealAmount}
                        onChange={e => setTotalDealAmount(e.target.value)}
                        placeholder="0.000"
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground font-syne font-bold text-base focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Estimated Gov Fee (OMR)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={governmentFeeEstimate}
                        onChange={e => setGovernmentFeeEstimate(e.target.value)}
                        placeholder="0.000"
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground font-syne font-bold text-base focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-center">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Estimated Profit</span>
                      <span className="text-lg font-syne font-extrabold text-emerald-400">
                        {estimatedProfit.toFixed(3)} OMR
                      </span>
                    </div>
                  </div>

                  {/* Payment Type Selection */}
                  <div className="pt-2 border-t border-border/50">
                    <label className="text-xs font-semibold text-muted-foreground">Payment Received Today</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentType('advance')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          paymentType === 'advance'
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        50% Advance
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('full')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          paymentType === 'full'
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        100% Full Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('custom')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          paymentType === 'custom'
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Custom Amount
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Amount Received (OMR) *</label>
                        <input
                          type="number"
                          step="0.001"
                          required
                          value={amountReceived}
                          onChange={e => setAmountReceived(e.target.value)}
                          placeholder="0.000"
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground font-syne font-bold text-base focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Payment Mode</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => setPaymentMode('bank_transfer')}
                            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border ${
                              paymentMode === 'bank_transfer'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground'
                            }`}
                          >
                            <Landmark size={12} /> Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMode('cash')}
                            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border ${
                              paymentMode === 'cash'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground'
                            }`}
                          >
                            <Banknote size={12} /> Cash
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMode('card')}
                            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border ${
                              paymentMode === 'card'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground'
                            }`}
                          >
                            <CreditCard size={12} /> Card
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reference & Proof Receipt */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Bank Reference / Cheque #</label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={e => setReferenceNumber(e.target.value)}
                        placeholder="e.g. TRN-984723"
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Payment Proof Receipt (Optional)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-background border border-dashed border-border hover:border-primary cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          <Upload size={14} />
                          {receiptFile ? receiptFile.name.slice(0, 18) + '...' : 'Upload receipt file'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {receiptFile && (
                          <button
                            type="button"
                            onClick={() => setReceiptFile(null)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isRecordingSale}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRecordingSale ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Recording Sale...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Record Sale & Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: COLLECT REMAINING BALANCE */
              <form id="rest-payment-form" onSubmit={handleSubmitRestPayment} className="space-y-6">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Search size={14} className="text-primary" /> Select Active Job with Pending Balance
                  </label>

                  <input
                    type="text"
                    placeholder="Search by Job code, client name, or phone..."
                    value={restJobSearch}
                    onChange={e => setRestJobSearch(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:outline-none"
                  />

                  {/* List of Jobs */}
                  <div className="max-h-52 overflow-y-auto space-y-2 pt-1">
                    {isLoadingJobsWithBalance ? (
                      <div className="text-center py-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin" /> Loading jobs...
                      </div>
                    ) : filteredJobsWithBalance.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No active jobs with remaining balance found.
                      </div>
                    ) : (
                      filteredJobsWithBalance.map((job: any) => {
                        const isSelected = selectedJobForRest?.id === job.id;
                        const remaining = Number(job.remaining_amount) || Math.max(0, Number(job.total_fee || 0) - Number(job.advance_amount || 0));

                        return (
                          <div
                            key={job.id}
                            onClick={() => handleSelectJobForRest(job)}
                            className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-background border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check size={12} />}
                              </div>
                              <div>
                                <p className="font-bold text-foreground">
                                  {job.job_code} — {job.client?.full_name || job.custom_name || 'Client Work'}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Work: {job.custom_name || 'Standard'} • Total Billed: {job.total_fee} OMR • Advance Paid: {job.advance_amount || 0} OMR
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-syne font-extrabold text-amber-400 text-sm">{remaining.toFixed(3)} OMR</span>
                              <p className="text-[10px] text-muted-foreground">Remaining Balance</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected Job Card Preview */}
                {selectedJobForRest && (
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">
                          {selectedJobForRest.job_code} — {selectedJobForRest.client?.full_name || selectedJobForRest.custom_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Collecting final milestone payment to close balance
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                        Job In Progress
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Calendar size={13} className="text-primary" /> Rest Payment Date
                        </label>
                        <input
                          type="date"
                          value={restPaymentDate}
                          onChange={e => setRestPaymentDate(e.target.value)}
                          max={format(new Date(), 'yyyy-MM-dd')}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:border-primary focus:outline-none"
                        />
                        {daysAgoRest > 0 && (
                          <span className="text-[10px] text-amber-400 mt-1 block">
                            Backdating: {daysAgoRest} days ago
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Rest Amount to Collect (OMR) *</label>
                        <input
                          type="number"
                          step="0.001"
                          required
                          value={restAmount}
                          onChange={e => setRestAmount(e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground font-syne font-bold text-base focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Payment Mode</label>
                        <select
                          value={restPaymentMode}
                          onChange={e => setRestPaymentMode(e.target.value as any)}
                          className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:border-primary focus:outline-none"
                        >
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="card">Card / POS</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Bank Reference / Cheque #</label>
                        <input
                          type="text"
                          value={restReference}
                          onChange={e => setRestReference(e.target.value)}
                          placeholder="e.g. TRN-REST-091"
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Rest Payment Receipt</label>
                        <label className="mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-background border border-dashed border-border hover:border-primary cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          <Upload size={14} />
                          {restReceiptFile ? restReceiptFile.name.slice(0, 18) + '...' : 'Upload receipt proof'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => setRestReceiptFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Rest Payment */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isRecordingRestPayment || !selectedJobForRest}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRecordingRestPayment ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Recording Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm Rest Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </motion.div>
      </div>
    </AnimatePresence>
  );
};
