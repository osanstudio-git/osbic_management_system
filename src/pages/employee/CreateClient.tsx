import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, ChevronLeft, ArrowRight, Upload,
  CheckCircle2, FileText, Lock
} from 'lucide-react';
import { useCreateClient } from '../../hooks/employee/useEmployeeClients';
import { useAdminServices } from '../../hooks/admin/useAdminServices'; // Reusing for mock services
import CredentialRevealCard from '../../components/ui/CredentialRevealCard';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NATIONALITIES = [
  'Oman', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait',
  'United Kingdom', 'United States', 'India', 'Pakistan', 'Egypt', 'Other'
];

type ClientFormData = {
  fullNameEn: string;
  fullNameAr: string;
  email: string;
  phone: string;
  nationality: string;
  idNumber: string;
  idExpiry: string;
  dateOfBirth: string;
  gender: string;
  address: string;
};

type PricingData = {
  serviceId: string;
  totalClientFee: string;
  ourWorkFee: string;
  useMinistryPercentage: boolean;
  ministryPercentage: string;
  advancePaymentPercent: number;
  advanceDueDate: string;
  expectedStartDate: string;
  serviceExpiryMonths: string;
};

const CreateClient = () => {
  const navigate = useNavigate();
  const { data: services } = useAdminServices();
  const { mutate: createClient, isPending, data: createdResponse } = useCreateClient();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Stepper state
  const [clientData, setClientData] = useState<ClientFormData>({
    fullNameEn: '', fullNameAr: '', email: '', phone: '', nationality: 'Oman',
    idNumber: '', idExpiry: '', dateOfBirth: '', gender: 'Male', address: ''
  });

  const [pricingData, setPricingData] = useState<PricingData>({
    serviceId: '', totalClientFee: '', ourWorkFee: '', 
    useMinistryPercentage: false, ministryPercentage: '0',
    advancePaymentPercent: 50, advanceDueDate: '', 
    expectedStartDate: new Date().toISOString().split('T')[0], serviceExpiryMonths: ''
  });

  const [termsAgreed, setTermsAgreed] = useState(false);

  // Derived Pricing Math
  const totalClientFeeParsed = parseFloat(pricingData.totalClientFee) || 0;
  const ourWorkFeeParsed = parseFloat(pricingData.ourWorkFee) || 0;
  
  let ministryFee = 0;
  if (pricingData.useMinistryPercentage) {
    const pct = parseFloat(pricingData.ministryPercentage) || 0;
    ministryFee = totalClientFeeParsed * (pct / 100);
  } else {
    ministryFee = totalClientFeeParsed - ourWorkFeeParsed;
  }
  // Prevent negative ministry fee natively
  ministryFee = Math.max(0, ministryFee);

  const selectedService = services?.find(s => s.id === pricingData.serviceId);

  const advanceDueAmount = totalClientFeeParsed * (pricingData.advancePaymentPercent / 100);
  const remainingAmount = totalClientFeeParsed - advanceDueAmount;

  // Validation
  const validateStep1 = () => {
    if (!clientData.fullNameEn || !clientData.email || !clientData.phone || !clientData.nationality || !clientData.idNumber || !clientData.idExpiry) {
      toast.error('Please fill all required fields (*) in Step 1');
      return false;
    }
    if (!clientData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!pricingData.serviceId) {
      toast.error('Please select a service');
      return false;
    }
    if (totalClientFeeParsed <= 0) {
      toast.error('Total Client Fee must be greater than 0');
      return false;
    }
    if (!pricingData.useMinistryPercentage && ourWorkFeeParsed > totalClientFeeParsed) {
      toast.error('Our Work Fee cannot be greater than Total Client Fee');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = () => {
    if (!termsAgreed) {
      toast.error('You must confirm the pricing has been agreed with the client.');
      return;
    }

    createClient({ clientData, pricingData }, {
      onSuccess: () => {
        toast.success('Client onboarding complete');
        setShowSuccess(true);
      }
    });
  };

  // ─── RENDERERS ───

  const renderStep1 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6 max-w-3xl">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Photo Upload area */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold hover:text-primary text-[#475569] transition-colors bg-white/[0.02]">
            <Upload size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Upload<br/>Photo</span>
          </div>
          <p className="text-[10px] text-[#475569]">Optional</p>
        </div>

        {/* Core Form */}
        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Full Name (English) *</label>
              <input type="text" value={clientData.fullNameEn} onChange={e => setClientData({...clientData, fullNameEn: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none" placeholder="Same as passport" />
            </div>
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block text-right">Full Name (Arabic)</label>
              <input type="text" dir="rtl" value={clientData.fullNameAr} onChange={e => setClientData({...clientData, fullNameAr: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none text-right" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Email Address *</label>
              <input type="email" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none" placeholder="client@example.com" />
            </div>
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Phone Number *</label>
              <div className="flex gap-2">
                <div className="w-24 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground flex items-center justify-center font-mono pointer-events-none">+968</div>
                <input type="tel" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none" placeholder="9123 4567" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Nationality *</label>
              <select value={clientData.nationality} onChange={e => setClientData({...clientData, nationality: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none appearance-none">
                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Gender</label>
                 <select value={clientData.gender} onChange={e => setClientData({...clientData, gender: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none appearance-none">
                   <option>Male</option><option>Female</option>
                 </select>
               </div>
               <div>
                 <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Date of Birth</label>
                 <input type="date" value={clientData.dateOfBirth} onChange={e => setClientData({...clientData, dateOfBirth: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none [&::-webkit-calendar-picker-indicator]:invert" />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">ID / Passport Number *</label>
              <input type="text" value={clientData.idNumber} onChange={e => setClientData({...clientData, idNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none uppercase font-mono" />
            </div>
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">ID / Passport Expiry *</label>
              <input type="date" value={clientData.idExpiry} onChange={e => setClientData({...clientData, idExpiry: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground focus:border-gold outline-none [&::-webkit-calendar-picker-indicator]:invert" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      
      {/* Left Column: Service Setup */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-lg font-syne font-bold text-foreground mb-1">Service Selection</h3>
          <p className="text-xs text-[#94A3B8] mb-4">Choose the primary service to onboard</p>
          
          <select 
            value={pricingData.serviceId} 
            onChange={e => {
              const sid = e.target.value;
              const svc = services?.find(s => s.id === sid);
              setPricingData({...pricingData, serviceId: sid, serviceExpiryMonths: svc?.expiry_months?.toString() || ''});
            }} 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:border-gold outline-none appearance-none"
          >
            <option value="" disabled>-- Select a Service --</option>
            {services?.map(s => (
              <option key={s.id} value={s.id}>{s.name_en}</option>
            ))}
          </select>
        </div>

        {selectedService && (
          <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
             <div className="flex items-start gap-3">
               <div className="w-10 h-10 rounded-lg bg-primary/10 border border-gold/20 flex items-center justify-center text-primary shrink-0">
                  <Building2 size={20} />
               </div>
               <div>
                  <h4 className="text-sm font-bold text-foreground">{selectedService.name_en}</h4>
                  <p className="text-xs text-[#94A3B8] mt-1">{selectedService.description_en}</p>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest">Est. Duration</p>
                  <p className="text-sm font-bold text-foreground">{selectedService.estimated_days} days</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest">Workflow</p>
                  <p className="text-sm font-bold text-foreground">{selectedService.steps?.length || 11} steps</p>
                </div>
             </div>
          </div>
        )}

        {selectedService && (
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-xs font-bold text-foreground mb-3 uppercase tracking-widest">Assigned Employee</h3>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl">
               <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs uppercase">Me</div>
               <div className="flex-1">
                 <p className="text-sm font-bold text-foreground">Current User (Me)</p>
               </div>
               <button className="text-xs text-[#94A3B8] hover:text-foreground transition-colors underline">Reassign</button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Pricing Setup */}
      <div className={cn("bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6 transition-all", selectedService ? "border-gold/30" : "border-border/40 opacity-50 pointer-events-none")}>
         <div>
          <h3 className="text-lg font-syne font-bold text-foreground mb-1">Financial Setup</h3>
          <p className="text-xs text-[#94A3B8] mb-4">Define total fees and OSBIC profit bounds</p>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">Total Client Fee (OMR) *</label>
              <div className="relative">
                <input type="number" min="0" value={pricingData.totalClientFee} onChange={e => setPricingData({...pricingData, totalClientFee: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-2.5 text-foreground focus:border-gold outline-none font-mono text-lg" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] font-bold text-xs">OMR</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#94A3B8]">OSBIC Work Fee (Revenue) *</label>
                <div className="flex items-center gap-1.5" title="Calculate ministry fee automatically by subtracting this from total">
                  <input type="checkbox" checked={!pricingData.useMinistryPercentage} onChange={e => setPricingData({...pricingData, useMinistryPercentage: !e.target.checked})} className="accent-gold" />
                  <span className="text-[10px] text-[#475569]">Fixed</span>
                </div>
              </div>
              <div className="relative">
                <input type="number" min="0" disabled={pricingData.useMinistryPercentage} value={pricingData.ourWorkFee} onChange={e => setPricingData({...pricingData, ourWorkFee: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-2.5 text-amber-500 focus:border-amber-500 outline-none font-mono text-lg disabled:opacity-50" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] font-bold text-xs">OMR</span>
              </div>
            </div>
         </div>

         {pricingData.useMinistryPercentage && (
            <div className="pt-2">
              <label className="text-muted-foreground/60 transition-colors uppercase tracking-widest font-bold text-[10px] mb-1.5 block">% Ministry Fee Deduction</label>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="100" value={pricingData.ministryPercentage} onChange={e => setPricingData({...pricingData, ministryPercentage: e.target.value})} className="w-full accent-gold" />
                <span className="text-foreground font-mono">{pricingData.ministryPercentage}%</span>
              </div>
            </div>
         )}

         {/* Visual Breakdown */}
         <div className="bg-black/30 border border-white/5 rounded-xl p-4 font-mono text-sm">
            <div className="flex justify-between text-foreground font-bold mb-3 border-b border-white/10 pb-2">
              <span>Total Client Fee:</span>
              <span className="text-emerald-400">{totalClientFeeParsed.toLocaleString()} OMR</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 relative">
               <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10" />
               <div className="pr-2">
                  <p className="text-[10px] text-amber-500/80 uppercase tracking-widest mb-1">Work Fee (OSBIC)</p>
                  <p className="text-lg text-amber-500">{ourWorkFeeParsed.toLocaleString()} OMR</p>
               </div>
               <div className="pl-4">
                  <p className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Ministry Fee</p>
                  <p className="text-lg text-[#94A3B8]">{ministryFee.toLocaleString()} OMR</p>
               </div>
            </div>
         </div>

         {/* Payment Terms */}
         <div className="pt-2 border-t border-white/5">
            <h3 className="text-sm font-bold text-foreground mb-4">Payment Terms</h3>
            
            <label className="block text-xs font-medium text-[#94A3B8] mb-2">Advance Payment Required: {pricingData.advancePaymentPercent}%</label>
            <div className="flex items-center gap-4 mb-4">
              <input type="range" value={pricingData.advancePaymentPercent} min="0" max="100" step="10" onChange={e => setPricingData({...pricingData, advancePaymentPercent: Number(e.target.value)})} className="w-full accent-emerald-500" />
            </div>

            <div className="flex justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm font-mono mb-4">
              <div>
                <span className="text-emerald-500/70 text-xs block uppercase">Advance Due</span>
                <span className="text-emerald-400 font-bold">{advanceDueAmount.toLocaleString()} OMR</span>
              </div>
              <div className="text-right">
                <span className="text-[#475569] text-xs block uppercase">Remaining</span>
                <span className="text-foreground font-bold">{remainingAmount.toLocaleString()} OMR</span>
              </div>
            </div>
         </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 max-w-4xl mx-auto">
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Review & Confirm</h2>
        <p className="text-[#94A3B8]">Please review the final details before initiating the job pipeline.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card p-6 rounded-2xl shadow-xl border border-border">
         
         <div className="space-y-5">
           <h3 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2"><UserCircle2 size={16} className="text-primary" /> Client Identity</h3>
           
           <div className="space-y-3">
             <div>
               <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest mb-0.5">Full Name</p>
               <p className="text-sm text-foreground font-medium">{clientData.fullNameEn}</p>
             </div>
             <div>
               <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest mb-0.5">Contact</p>
               <p className="text-sm text-foreground">{clientData.email} • {clientData.phone}</p>
             </div>
             <div>
               <p className="text-[10px] text-[#475569] uppercase font-bold tracking-widest mb-0.5">Identification</p>
               <p className="text-sm text-foreground font-mono">{clientData.idNumber} <span className="text-[#94A3B8] font-sans">({clientData.nationality})</span></p>
             </div>
           </div>
         </div>

         <div className="space-y-5">
           <h3 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2"><FileText size={16} className="text-accent" /> Service & Pricing</h3>
           
           <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-4">
             <div>
               <p className="text-foreground font-bold">{selectedService?.name_en}</p>
               <p className="text-[10px] text-accent mt-1 bg-accent/10 px-2 py-0.5 rounded border border-accent/20 inline-block font-bold">Total Client Fee: {totalClientFeeParsed.toLocaleString()} OMR</p>
             </div>
             
             <div className="flex justify-between items-center text-xs pt-3 border-t border-white/5 text-[#94A3B8] font-mono">
                <span>Advance Required:</span>
                <span className="text-emerald-400">{advanceDueAmount.toLocaleString()} OMR ({pricingData.advancePaymentPercent}%)</span>
             </div>
           </div>

           <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-3 text-left items-start mt-4">
              <Lock size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">Credential Generation</p>
                <p className="text-xs text-blue-200/80">A portal access account will be automatically generated and emailed to the client alongside the initial invoice.</p>
              </div>
           </div>
         </div>

      </div>

      <div className="bg-background border border-border p-4 rounded-xl flex items-center gap-4 cursor-pointer" onClick={() => setTermsAgreed(!termsAgreed)}>
        <div className={cn("w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors", termsAgreed ? "bg-primary border-gold text-[#0A0F1E]" : "border-white/20")}>
          {termsAgreed && <CheckCircle2 size={16} />}
        </div>
        <p className="text-sm text-[#94A3B8]">I confirm the pricing structure of <strong className="text-foreground">{totalClientFeeParsed} OMR</strong> has been explicitly agreed upon with the client.</p>
      </div>

    </motion.div>
  );

  const UserCircle2 = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>;

  // SUCCESS UI
  if (showSuccess && createdResponse) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
           
           <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
              <CheckCircle2 size={40} />
           </div>
           
           <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Onboarding Complete</h2>
           <p className="text-[#94A3B8] mb-6">Client profile created and assigned to job <span className="font-mono text-foreground">JOB-{new Date().getFullYear()}091</span></p>

           <div className="text-left mb-6">
             <CredentialRevealCard 
               username={createdResponse.username} 
               password={createdResponse.password} 
             />
           </div>

           <p className="text-sm text-[#475569] mb-8">Welcome email securely dispatched to <span className="text-foreground">{createdResponse.email}</span></p>

           <div className="flex gap-4">
              <button onClick={() => navigate('/admin/clients')} className="flex-1 py-3 px-4 bg-white/5 text-foreground font-bold border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm">Return Home</button>
              <button className="flex-1 py-3 px-4 bg-primary text-[#0A0F1E] font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-gold/20 text-sm">View Job Profile</button>
           </div>
        </motion.div>
      </div>
    );
  }

  // WIZARD RENDERER
  return (
    <div className="pb-16 max-w-5xl mx-auto w-full">
      {/* Header & Stepper */}
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#94A3B8] hover:text-foreground transition-colors text-sm mb-6 w-fit font-medium">
          <ChevronLeft size={16} /> Back to Directory
        </button>
        <h1 className="text-2xl font-syne font-bold text-foreground mb-6">Create New Client</h1>
        
        <div className="flex items-center">
          {[
            { id: 1, label: 'Client Identity' },
            { id: 2, label: 'Service Flow' },
            { id: 3, label: 'Verification' }
          ].map((s) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none relative">
              <div className="flex flex-col items-center gap-2 z-10 relative bg-background pr-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2",
                  step > s.id ? "bg-emerald-500 border-emerald-500 text-[#0A0F1E]" : 
                  step === s.id ? "border-gold text-primary bg-primary/10" : "border-white/10 text-[#475569] bg-[#0A0F1E]"
                )}>
                  {step > s.id ? <CheckCircle2 size={20} /> : s.id}
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest whitespace-nowrap absolute top-12", step >= s.id ? "text-foreground" : "text-[#475569]")}>{s.label}</span>
              </div>
              {s.id !== 3 && (
                <div className="h-[2px] bg-white/5 flex-1 w-full absolute left-10 right-0 top-5 -z-0">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: step > s.id ? '100%' : '0%' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20">
        <AnimatePresence mode="wait">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </AnimatePresence>
      </div>

      {/* Persistent Footer Actions */}
      <div className="bg-card/80 backdrop-blur-md border-t border-border z-40 fixed bottom-0 left-0 sm:left-[80px] lg:left-[280px] right-0 p-4">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
           {step > 1 ? (
             <button onClick={handleBack} className="px-6 py-2.5 rounded-xl text-foreground font-medium hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">← Back</button>
           ) : <div />}

           {step < 3 ? (
             <button onClick={handleNext} className="bg-white text-[#0A0F1E] px-8 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/10">
               Next Step <ArrowRight size={18} />
             </button>
           ) : (
             <button onClick={handleSubmit} disabled={isPending || !termsAgreed} className="bg-primary text-[#0A0F1E] px-8 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-gold/20 disabled:opacity-50">
               {isPending ? 'Processing Onboarding...' : 'Create Client & Start Job'}
             </button>
           )}
         </div>
      </div>
    </div>
  );
};

export default CreateClient;
