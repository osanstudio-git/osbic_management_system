import React, { forwardRef } from 'react';
import type { Invoice } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrencyConfig } from '../../hooks/shared/useCurrencyRates';
import { 
  Zap, FileText, Briefcase, DollarSign, Users, ShieldCheck, Phone, Mail, Globe, MapPin 
} from 'lucide-react';

interface B2BProposalDocumentProps {
  invoice: Invoice;
}

export const B2BPartnershipProposalDocument = forwardRef<HTMLDivElement, B2BProposalDocumentProps>(
  ({ invoice }, ref) => {
    const { profile } = useAuth();

    // Currency configuration
    const currencyCode = invoice.currency || 'SAR';
    const currencyCfg = getCurrencyConfig(currencyCode);
    const currSym = currencyCfg.symbol;

    // Recipient & Presenter fields from metadata or relations
    const submittedTo = invoice.metadata?.b2b_submitted_to || invoice.client?.company_name || invoice.client?.full_name || invoice.lead?.company_name || invoice.lead?.contact_name || 'PARTNER COMPANY NAME';
    const preparedBy = invoice.metadata?.b2b_prepared_by || invoice.employee?.full_name || profile?.full_name || 'ANSAR NV';
    const proposalTitle = invoice.metadata?.b2b_proposal_title || 'Oman Company Formation Services';

    // Pricing package values (defaulting to image values if not customized)
    const pkgNewCrNoAttest = invoice.metadata?.pkg_new_cr_no_attest ?? 2000;
    const pkgNewCrWithAttest = invoice.metadata?.pkg_new_cr_with_attest ?? 4000;
    const pkgExistingCr = invoice.metadata?.pkg_existing_cr ?? 12250;
    const surchargeNote = invoice.metadata?.b2b_surcharge_note || 'Please note: In cases where an Iqama or Power of Attorney is unavailable, Additional 2000 SAR will be charged.';

    return (
      <div ref={ref} className="bg-white text-slate-900 w-[794px] max-w-full mx-auto shadow-2xl font-sans print:w-[210mm] print:m-0 print:shadow-none">
        
        {/* ================= PAGE 1 ================= */}
        <div className="p-8 md:p-10 min-h-[1080px] relative flex flex-col justify-between border-b border-slate-200 print:border-none print:min-h-[297mm] print:break-after-page">
          
          <div>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-4xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-[#0288d1] uppercase tracking-widest">
                  CONFIDENTIAL
                </span>
              </div>
            </div>

            <div className="w-full h-[2px] bg-[#0288d1] mb-6" />

            {/* Banner */}
            <div className="bg-[#0073b7] text-white py-4 px-6 text-center rounded-sm shadow-sm mb-6">
              <h2 className="text-xl md:text-2xl font-extrabold uppercase tracking-wider">
                STRATEGIC PARTNERSHIP PROPOSAL
              </h2>
              <p className="text-sm font-medium text-cyan-100 mt-0.5">
                {proposalTitle}
              </p>
            </div>

            {/* Submitted To / By Box */}
            <div className="bg-[#ebf8ff] border border-[#bee3f8] rounded-sm p-4 mb-6 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#0073b7] mb-1">
                  SUBMITTED TO
                </div>
                <div className="font-bold text-slate-900 text-sm uppercase">
                  {submittedTo}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#0073b7] mb-1">
                  SUBMITTED BY
                </div>
                <div className="font-bold text-slate-900 text-sm uppercase">
                  OSBIC International LLC
                </div>
                
                <div className="mt-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#0073b7] mr-1">
                    PREPARED BY:
                  </span>
                  <span className="font-bold text-slate-900 uppercase">{preparedBy}</span>
                </div>
              </div>
            </div>

            {/* Introduction Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[#0288d1]">
                <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                  INTRODUCTION
                </h3>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed mb-2">
                OSBIC International LLC is pleased to present this proposal for a strategic partnership to deliver professional Oman company formation services to your clients. With deep expertise in Omani business regulations and a commitment to efficient, compliant service delivery, we are well-positioned to support your clients in establishing a credible corporate presence in the Sultanate of Oman.
              </p>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                We believe this collaboration presents a valuable opportunity for both organizations to expand service offerings, generate additional revenue streams, and deliver tangible value to mutual clients.
              </p>
            </div>

            {/* Services & Pricing Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-[#0288d1]">
                <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                  SERVICES & PRICING
                </h3>
              </div>

              {/* 2-Column Table Grid */}
              <div className="border border-[#0073b7] rounded-sm overflow-hidden text-xs">
                {/* Table Header */}
                <div className="grid grid-cols-2 bg-[#0073b7] text-white font-bold text-center py-2 px-3 tracking-wide">
                  <div className="border-r border-cyan-300/30">NEW COMPANY REGISTRATION (CR)</div>
                  <div>EXISTING COMPANY (CR) PACKAGE</div>
                </div>

                {/* Price Row */}
                <div className="grid grid-cols-2 bg-[#ebf8ff] border-b border-[#0073b7]/30 text-slate-900 p-3">
                  {/* New CR Column */}
                  <div className="border-r border-[#0073b7]/30 pr-3 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#0073b7] uppercase block">Without Attestation</span>
                      <span className="text-lg font-black text-[#0073b7]">{currSym} {pkgNewCrNoAttest.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#0073b7] uppercase block">With Attestation</span>
                      <span className="text-lg font-black text-[#0073b7]">{currSym} {pkgNewCrWithAttest.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Existing CR Column */}
                  <div className="pl-3 space-y-1">
                    <span className="text-[10px] font-bold text-[#0073b7] uppercase block">All-Inclusive Package</span>
                    <span className="text-xl font-black text-[#0073b7]">{currSym} {pkgExistingCr.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-600 font-medium">Includes Audit, MOA & Attestation</p>
                  </div>
                </div>

                {/* Required Documents Row */}
                <div className="grid grid-cols-2 bg-white border-b border-[#0073b7]/30 p-3 text-[10.5px]">
                  <div className="border-r border-[#0073b7]/30 pr-3">
                    <div className="font-bold text-[#0073b7] mb-1">Required Documents</div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      <li>Passport copy</li>
                      <li>Passport with selfie</li>
                      <li>Email address</li>
                      <li>Phone number</li>
                      <li>Business activity list</li>
                      <li>Proposed company name(s)</li>
                    </ul>
                  </div>

                  <div className="pl-3">
                    <div className="font-bold text-[#0073b7] mb-1">Required Documents</div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      <li>Passport copy & Iqama copy</li>
                      <li>Passport with selfie</li>
                      <li>Email address</li>
                      <li>Phone number</li>
                      <li>Power of Attorney (POA)</li>
                    </ul>
                  </div>
                </div>

                {/* Timeline Row */}
                <div className="grid grid-cols-2 bg-[#ebf8ff] p-3 text-[10.5px]">
                  <div className="border-r border-[#0073b7]/30 pr-3">
                    <div className="font-bold text-[#0073b7] mb-1">Processing Timeline</div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      <li>Name approval: Same day</li>
                      <li>CR issuance: Same day (post-approval)</li>
                      <li>Attestation: Within 2 business days</li>
                    </ul>
                  </div>

                  <div className="pl-3">
                    <div className="font-bold text-[#0073b7] mb-1">Processing Timeline</div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      <li>Complete documentation: Within 10 working days</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Surcharge Note */}
              <div className="mt-3 text-[10px] text-slate-700 italic border-l-2 border-[#0073b7] pl-3 py-0.5">
                {surchargeNote}
              </div>
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="pt-4 border-t border-slate-200 text-[9.5px] text-slate-500 flex justify-between items-center">
            <span>OSBIC International LLC • Ghala, Muscat, Oman</span>
            <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
            <span>Page 1</span>
          </div>

        </div>


        {/* ================= PAGE 2 ================= */}
        <div className="p-8 md:p-10 min-h-[1080px] relative flex flex-col justify-between print:min-h-[297mm]">
          
          <div>
            {/* Header Page 2 */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-[#0288d1] uppercase tracking-widest">
                  CONFIDENTIAL
                </span>
              </div>
            </div>

            <div className="w-full h-[2px] bg-[#0288d1] mb-6" />

            {/* Partnership Model Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-[#0288d1]">
                <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                  PARTNERSHIP MODEL
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm">
                  <div className="text-[10px] font-bold text-[#0288d1] uppercase">Option A</div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">B2B Partnership</h4>
                  <p className="text-[10.5px] text-slate-700 leading-relaxed">
                    Direct business cooperation with structured agreements, defined service levels, and formalized billing arrangements between both organizations.
                  </p>
                </div>

                <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm">
                  <div className="text-[10px] font-bold text-[#0288d1] uppercase">Option B</div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">Reference-Based Partnership</h4>
                  <p className="text-[10.5px] text-slate-700 leading-relaxed">
                    Commission-based model where your organization refers clients to OSBIC and receives a competitive commission for each successful company formation.
                  </p>
                </div>
              </div>

              <p className="text-[10.5px] text-slate-700 leading-relaxed italic">
                Both partnership models are available and terms can be tailored to meet the needs of your organisation. We welcome an open discussion to identify the most suitable arrangement.
              </p>
            </div>

            {/* Why Partner With OSBIC Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-[#0288d1]">
                <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                  WHY PARTNER WITH OSBIC?
                </h3>
              </div>

              {/* 6 Grid Box */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                {/* 1 */}
                <div className="bg-[#0073b7] text-white p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <Zap className="w-5 h-5 text-cyan-300 mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">Fast & Reliable</h5>
                  <p className="text-[9.5px] text-cyan-100 leading-tight">
                    Same-day processing for name approvals and CR issuance, ensuring your clients move quickly.
                  </p>
                </div>

                {/* 2 */}
                <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <FileText className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">End-to-End Support</h5>
                  <p className="text-[9.5px] text-slate-600 leading-tight">
                    Complete documentation assistance from initial filing through to final attestation.
                  </p>
                </div>

                {/* 3 */}
                <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <Briefcase className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">Market Expertise</h5>
                  <p className="text-[9.5px] text-slate-600 leading-tight">
                    Proven track record and deep knowledge of the Omani regulatory landscape.
                  </p>
                </div>

                {/* 4 */}
                <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <DollarSign className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">Competitive Pricing</h5>
                  <p className="text-[9.5px] text-slate-600 leading-tight">
                    Transparent, fixed-fee pricing with no hidden charges — making budgeting straightforward.
                  </p>
                </div>

                {/* 5 */}
                <div className="bg-[#0073b7] text-white p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <Users className="w-5 h-5 text-cyan-300 mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">Dedicated Team</h5>
                  <p className="text-[9.5px] text-cyan-100 leading-tight">
                    A dedicated client service team ready to support every step of your journey.
                  </p>
                </div>

                {/* 6 */}
                <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-3.5 rounded-sm flex flex-col justify-center text-center">
                  <ShieldCheck className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                  <h5 className="font-bold text-xs mb-1">Fully Compliant</h5>
                  <p className="text-[9.5px] text-slate-600 leading-tight">
                    All formations completed in strict accordance with Omani commercial and legal requirements.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-[#0288d1]">
                <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                  CONTACT INFORMATION
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Left Blue Box */}
                <div className="bg-[#0073b7] text-white p-4 rounded-sm space-y-2">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide border-b border-cyan-400/30 pb-1">
                    OSBIC INTERNATIONAL LLC
                  </h4>
                  <div className="space-y-1 text-[11px] text-cyan-50">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span>Ghala, Muscat, Sultanate of Oman</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span>+968 9216 4213</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span>info@osangroupoman.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span>www.osbic.net</span>
                    </div>
                  </div>
                </div>

                {/* Right Light Box */}
                <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-[#0073b7] text-sm mb-1">
                      Ready to Partner?
                    </h4>
                    <p className="text-[10.5px] text-slate-700 leading-relaxed mb-2">
                      Contact our business development team today to begin the discussion and formalize your preferred partnership model.
                    </p>
                  </div>
                  <p className="text-[10.5px] font-semibold italic text-[#0073b7]">
                    We look forward to a long and prosperous collaboration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div>
            <div className="text-center text-[10px] text-slate-600 font-medium italic mb-2">
              — OSBIC International LLC | Established in Oman | www.osbic.net
            </div>
            
            <div className="pt-3 border-t border-slate-200 text-[9.5px] text-slate-500 flex justify-between items-center">
              <span>OSBIC International LLC • Ghala, Muscat, Oman</span>
              <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
              <span>Page 2</span>
            </div>
          </div>

        </div>
      </div>
    );
  }
);
