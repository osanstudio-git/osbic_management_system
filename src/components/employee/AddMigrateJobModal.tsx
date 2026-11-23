import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Plane, X, User, Phone, Mail, Globe, Building2,
  DollarSign, CheckCircle2, Calendar, FileText, AlertCircle,
  MessageSquare, UserPlus, Search, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ensureClientProfile } from '../../utils/clientProvisioning';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCategory?: 'golden_visa' | 'global_visa';
}

const NATIONALITIES = [
  'Oman', 'India', 'Pakistan', 'United Kingdom', 'United States',
  'Egypt', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain',
  'Kuwait', 'Jordan', 'Lebanon', 'Syria', 'Bangladesh', 'Philippines',
  'Canada', 'Australia', 'Germany', 'France', 'Italy', 'Other'
];

const SCHENGEN_COUNTRIES = [
  'France', 'Germany', 'Italy', 'Spain', 'Switzerland', 'Netherlands',
  'Austria', 'Greece', 'Portugal', 'Belgium', 'Czech Republic', 'Sweden',
  'Norway', 'Denmark', 'Finland', 'Poland', 'Hungary', 'Other Schengen'
];

export const AddMigrateJobModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCategory = 'golden_visa'
}) => {
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<'golden_visa' | 'global_visa'>(defaultCategory);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Client fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('India');

  // Attribution & Origin
  const [leadSourceType, setLeadSourceType] = useState<'social_ads' | 'branch_walkin' | 'reference' | 'direct'>('social_ads');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [referringSalesId, setReferringSalesId] = useState('');

  // Golden Visa specific
  const [goldenRoute, setGoldenRoute] = useState<'itc_property' | 'company_assets' | 'fixed_deposit' | 'omani_employees_50'>('company_assets');
  const [auditReportRequired, setAuditReportRequired] = useState(true);
  const [paymentTerms, setPaymentTerms] = useState<'50_50' | 'full'>('50_50');
  const [goldenApprovalStatus, setGoldenApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [idCardStatus, setIdCardStatus] = useState<'pending' | 'issued'>('pending');

  // Global Visa specific
  const [visaCategory, setVisaCategory] = useState<'schengen_29' | 'usa_uk' | 'gcc_visit' | 'oman_family'>('schengen_29');
  const [destinationCountry, setDestinationCountry] = useState('France');
  const [embassyFeeMode, setEmbassyFeeMode] = useState<'paid_to_osbic' | 'client_direct' | 'at_embassy'>('paid_to_osbic');
  const [travelDate, setTravelDate] = useState('');
  const [hasDummyTicket, setHasDummyTicket] = useState(false);
  const [hasDummyHotel, setHasDummyHotel] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [embassyOutcome, setEmbassyOutcome] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Financials
  const [workFee, setWorkFee] = useState<number>(category === 'golden_visa' ? 500 : 80);
  const [govtFee, setGovtFee] = useState<number>(category === 'golden_visa' ? 100 : 35);
  const [advancePaidAmount, setAdvancePaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Auto-switch default fee presets when category toggles
  const handleCategorySwitch = (cat: 'golden_visa' | 'global_visa') => {
    setCategory(cat);
    if (cat === 'golden_visa') {
      setWorkFee(500);
      setGovtFee(100);
      setAdvancePaidAmount(250);
    } else {
      setWorkFee(80);
      setGovtFee(35);
      setAdvancePaidAmount(40);
    }
  };

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['migrate_branches_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name, code').order('name');
      return data || [];
    }
  });

  // Fetch employees for referring sales rep
  const { data: employees = [] } = useQuery({
    queryKey: ['migrate_staff_lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, branch_id')
        .in('role', ['employee', 'manager', 'admin'])
        .order('full_name');
      return data || [];
    }
  });

  // Fetch existing clients
  const { data: existingClients = [] } = useQuery({
    queryKey: ['migrate_clients_lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, client_code, nationality')
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    }
  });

  // Fetch services for linking service_id
  const { data: services = [] } = useQuery({
    queryKey: ['migrate_services_lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('services')
        .select('id, name_en, name_ar')
        .order('name_en');
      return data || [];
    }
  });

  const filteredClients = existingClients.filter((c: any) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.client_code || '').toLowerCase().includes(q)
    );
  });

  const totalFee = (Number(workFee) || 0) + (Number(govtFee) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let finalClientId = selectedClientId;

      // 1. Resolve or create client
      if (clientMode === 'new') {
        if (!fullName.trim()) throw new Error('Please enter investor / client full name');
        if (!phone.trim()) throw new Error('Please enter contact phone number');

        const cleanEmail = email.trim();
        if (cleanEmail) {
          if (user?.email && cleanEmail.toLowerCase() === user.email.toLowerCase()) {
            throw new Error('You cannot enter your own staff email for a client. Please enter the client\'s personal email or leave it empty.');
          }
          if (cleanEmail.toLowerCase().endsWith('@osbic.net')) {
            throw new Error('OSBIC staff emails (@osbic.net) cannot be registered as clients. Please use the client\'s own personal email or leave it blank.');
          }
        }

        const clientCode = `CLT-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
        const finalWhatsapp = sameWhatsapp ? phone : (whatsapp || phone);

        finalClientId = await ensureClientProfile({
          fullName: fullName.trim(),
          phone: phone.trim(),
          whatsapp: finalWhatsapp.trim(),
          email: cleanEmail || null,
          nationality: nationality || 'Oman',
          branchId: selectedBranchId || profile?.branch_id || null,
          createdBy: user?.id || null,
          clientCode: clientCode
        });
      } else {
        if (!finalClientId) throw new Error('Please select an existing client');
      }

      // 2. Generate specialized Job Code
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const prefix = category === 'golden_visa' ? 'JOB-GOLD-26' : 'JOB-VISA-26';
      const jobCode = `${prefix}-${randDigits}`;

      const title = category === 'golden_visa' 
        ? `Golden Visa 10-Year (${goldenRoute.replace(/_/g, ' ').toUpperCase()})`
        : `Tourist Visa - ${destinationCountry} (${visaCategory.toUpperCase()})`;

      const advancePaidBool = advancePaidAmount >= totalFee * 0.5 && advancePaidAmount > 0;
      const remainingAmt = Math.max(0, totalFee - (Number(advancePaidAmount) || 0));

      // Resolve service_id
      const matchedService = services.find((s: any) =>
        category === 'golden_visa'
          ? (s.name_en || '').toLowerCase().includes('golden')
          : (s.name_en || '').toLowerCase().includes('visa')
      );
      const fallbackServiceId = matchedService?.id || services[0]?.id || null;

      // 3. Insert into jobs table
      const jobPayload: Record<string, any> = {
        job_code: jobCode,
        client_id: finalClientId,
        employee_id: user?.id || profile?.id,
        assigned_by: referringSalesId || user?.id,
        service_id: fallbackServiceId,
        custom_name: title,
        branch_id: selectedBranchId || profile?.branch_id || null,
        sales_employee_id: referringSalesId || (leadSourceType === 'branch_walkin' ? user?.id : null),
        ops_employee_id: user?.id,
        work_fee: Number(workFee) || 0,
        ministry_fee: Number(govtFee) || 0,
        total_fee: totalFee,
        advance_amount: Number(advancePaidAmount) || 0,
        advance_paid: advancePaidBool,
        remaining_amount: remainingAmt,
        remaining_paid: remainingAmt === 0 && totalFee > 0,
        status: 'active',
        migrate_category: category,
        lead_source_type: leadSourceType,
        notes: notes.trim() || null
      };

      if (category === 'golden_visa') {
        jobPayload.golden_route = goldenRoute;
        jobPayload.audit_report_required = goldenRoute === 'company_assets' ? true : auditReportRequired;
        jobPayload.payment_terms = paymentTerms;
        jobPayload.golden_approval_status = goldenApprovalStatus;
        jobPayload.id_card_status = idCardStatus;
        if (goldenApprovalStatus === 'approved') {
          jobPayload.golden_approved_at = new Date().toISOString();
        }
        if (idCardStatus === 'issued') {
          jobPayload.id_card_issued_at = new Date().toISOString();
        }
      } else {
        jobPayload.visa_category = visaCategory;
        jobPayload.destination_country = destinationCountry.trim();
        jobPayload.embassy_fee_mode = embassyFeeMode;
        jobPayload.travel_date = travelDate || null;
        jobPayload.has_dummy_ticket = hasDummyTicket;
        jobPayload.has_dummy_hotel = hasDummyHotel;
        jobPayload.has_insurance = hasInsurance;
        jobPayload.embassy_outcome = embassyOutcome;
      }

      const { error: jobErr } = await supabase.from('jobs').insert(jobPayload);
      if (jobErr) throw jobErr;

      toast.success(
        category === 'golden_visa'
          ? `Golden Visa file created (${jobCode})`
          : `Visa application created (${jobCode})`,
        { duration: 3000 }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create migrate record');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${category === 'golden_visa' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'}`}>
              {category === 'golden_visa' ? <Crown size={20} /> : <Plane size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {category === 'golden_visa' ? 'New Golden Visa Investor File' : 'New Global Tourist Visa Application'}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                OSBIC MIGRATE • Centralized Execution Hub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Switcher Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-border/50 bg-background/50 flex gap-2">
          <button
            type="button"
            onClick={() => handleCategorySwitch('golden_visa')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              category === 'golden_visa'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Crown size={14} />
            <span>Golden Visa (10-Year Resident)</span>
          </button>

          <button
            type="button"
            onClick={() => handleCategorySwitch('global_visa')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              category === 'global_visa'
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 shadow-sm'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plane size={14} />
            <span>Global Tourist Visa</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. Client / Investor Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User size={13} className="text-primary" />
                {category === 'golden_visa' ? 'Investor Details' : 'Applicant Information'}
              </label>

              <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                    clientMode === 'new' ? 'bg-primary text-[#0A0F1E]' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  + New Person
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                    clientMode === 'existing' ? 'bg-primary text-[#0A0F1E]' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Select Existing
                </button>
              </div>
            </div>

            {clientMode === 'existing' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search client by name, phone or CLT code..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                  required
                >
                  <option value="">-- Choose Existing Client ({filteredClients.length} found) --</option>
                  {filteredClients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} • {c.phone || 'No phone'} ({c.client_code || 'CLT'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="e.g. Salim Al-Harthy"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                      Nationality *
                    </label>
                    <select
                      value={nationality}
                      onChange={e => setNationality(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    >
                      {NATIONALITIES.map(nat => (
                        <option key={nat} value={nat}>{nat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="e.g. 96891234567"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="Leave blank if unknown"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                    />
                    <span className="text-[9px] text-muted-foreground block mt-1">Do not use staff email. Leave blank if client has none.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="sameWhatsapp"
                    checked={sameWhatsapp}
                    onChange={e => setSameWhatsapp(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-0"
                  />
                  <label htmlFor="sameWhatsapp" className="text-xs text-muted-foreground cursor-pointer">
                    WhatsApp is the same as Phone Number
                  </label>
                </div>

                {!sameWhatsapp && (
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                      Separate WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 96898765432"
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Attribution & Origin (Centralized Hub Policy) */}
          <div className="space-y-3 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 size={13} className="text-emerald-400" />
              Lead Origin & Branch Attribution
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Origin Channel *
                </label>
                <select
                  value={leadSourceType}
                  onChange={e => setLeadSourceType(e.target.value as any)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="social_ads">Meta Ads (Instagram / FB)</option>
                  <option value="branch_walkin">Branch Walk-In Referral</option>
                  <option value="reference">Client Reference</option>
                  <option value="direct">Direct Central Walk-In</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Referring Branch
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="">Central Migrate Desk (Default)</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Referring Sales Rep
                </label>
                <select
                  value={referringSalesId}
                  onChange={e => setReferringSalesId(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                >
                  <option value="">None / Self Intake</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Category Specific Specialized Fields */}
          {category === 'golden_visa' ? (
            <div className="p-4 bg-amber-500/[0.04] border border-amber-500/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Crown size={15} />
                <span className="text-xs font-bold uppercase tracking-wider">Golden Visa Investor Program</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Qualifying Route *
                  </label>
                  <select
                    value={goldenRoute}
                    onChange={e => setGoldenRoute(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-400 outline-none"
                  >
                    <option value="company_assets">Commercial Company (OMR 500k+)</option>
                    <option value="itc_property">ITC Real Estate / Property (OMR 250k+)</option>
                    <option value="fixed_deposit">Fixed Bank Deposit in Oman Bank</option>
                    <option value="omani_employees_50">50+ Omani Employees Employed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-400 outline-none"
                  >
                    <option value="50_50">50% Retainer + 50% on ID Issuance</option>
                    <option value="full">100% Full Payment Upfront</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Government Review (Invest Oman / MOCIIP)
                  </label>
                  <select
                    value={goldenApprovalStatus}
                    onChange={e => setGoldenApprovalStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-400 outline-none"
                  >
                    <option value="pending">Pending Govt Submission</option>
                    <option value="approved">Approved by Ministry</option>
                    <option value="rejected">Rejected / Incomplete</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    10-Year Resident ID Status
                  </label>
                  <select
                    value={idCardStatus}
                    onChange={e => setIdCardStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-amber-400 outline-none"
                  >
                    <option value="pending">Pending Card Issuance</option>
                    <option value="issued">10-Year Card Issued</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auditReq"
                  checked={goldenRoute === 'company_assets' ? true : auditReportRequired}
                  disabled={goldenRoute === 'company_assets'}
                  onChange={e => setAuditReportRequired(e.target.checked)}
                  className="rounded border-border text-amber-500 focus:ring-0"
                />
                <label htmlFor="auditReq" className="text-xs text-muted-foreground cursor-pointer">
                  Financial Audit Report Required {goldenRoute === 'company_assets' && '(Mandatory for Commercial Assets)'}
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-sky-500/[0.04] border border-sky-500/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-sky-400">
                <Plane size={15} />
                <span className="text-xs font-bold uppercase tracking-wider">Global Tourist Visa Logistics</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Visa Category *
                  </label>
                  <select
                    value={visaCategory}
                    onChange={e => setVisaCategory(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                  >
                    <option value="schengen_29">Schengen (29 Countries)</option>
                    <option value="usa_uk">USA / UK / Canada</option>
                    <option value="gcc_visit">GCC Tourist / Resident</option>
                    <option value="oman_family">Oman Family Joining</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Destination Country *
                  </label>
                  {visaCategory === 'schengen_29' ? (
                    <select
                      value={destinationCountry}
                      onChange={e => setDestinationCountry(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                    >
                      {SCHENGEN_COUNTRIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. United Kingdom"
                      value={destinationCountry}
                      onChange={e => setDestinationCountry(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Embassy Fee Mode
                  </label>
                  <select
                    value={embassyFeeMode}
                    onChange={e => setEmbassyFeeMode(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                  >
                    <option value="paid_to_osbic">Collected by OSBIC</option>
                    <option value="client_direct">Client Pays Directly</option>
                    <option value="at_embassy">Payable at Appointment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Target Travel Date
                  </label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={e => setTravelDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Embassy Outcome
                  </label>
                  <select
                    value={embassyOutcome}
                    onChange={e => setEmbassyOutcome(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-sky-400 outline-none"
                  >
                    <option value="pending">Pending Application</option>
                    <option value="approved">Visa Approved & Stamped</option>
                    <option value="rejected">Rejected by Embassy</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Logistics & Dummy Bookings:
                </span>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDummyTicket}
                      onChange={e => setHasDummyTicket(e.target.checked)}
                      className="rounded border-border text-sky-500 focus:ring-0"
                    />
                    <span>Dummy Flight Ticket</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDummyHotel}
                      onChange={e => setHasDummyHotel(e.target.checked)}
                      className="rounded border-border text-sky-500 focus:ring-0"
                    />
                    <span>Hotel Reservation Voucher</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasInsurance}
                      onChange={e => setHasInsurance(e.target.checked)}
                      className="rounded border-border text-sky-500 focus:ring-0"
                    />
                    <span>Travel Insurance</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. Financials */}
          <div className="space-y-3 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign size={13} className="text-primary" />
              Financial Terms (OMR)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Office Work Fee (OMR) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={workFee}
                  onChange={e => setWorkFee(parseFloat(e.target.value) || 0)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Gov / Embassy Fee (OMR) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={govtFee}
                  onChange={e => setGovtFee(parseFloat(e.target.value) || 0)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Advance Collected (OMR)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={advancePaidAmount}
                  onChange={e => setAdvancePaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl text-xs">
              <span className="text-muted-foreground font-semibold">Total Contract Value:</span>
              <span className="text-sm font-mono font-bold text-primary">
                {totalFee.toFixed(3)} OMR
              </span>
            </div>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Internal Notes / File Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Client submitted 6 months bank statement with 12,000 OMR balance..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 ${
                category === 'golden_visa'
                  ? 'bg-amber-400 hover:bg-amber-300 text-black'
                  : 'bg-primary hover:bg-primary/90 text-[#0A0F1E]'
              }`}
            >
              {isSubmitting ? (
                <span>Registering File...</span>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>
                    {category === 'golden_visa' ? 'Register Golden Visa File' : 'Register Visa Application'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
