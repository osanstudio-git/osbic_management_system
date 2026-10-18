import React, { forwardRef } from 'react';
import type { Invoice } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrencyConfig } from '../../hooks/shared/useCurrencyRates';
import { 
  Zap, FileText, Briefcase, DollarSign, Users, ShieldCheck, Phone, Mail, Globe, MapPin, Landmark, Smartphone 
} from 'lucide-react';

interface B2BProposalDocumentProps {
  invoice: Invoice;
  activePagePreview?: 'all' | '1' | '2' | '3' | '4';
}

export const B2BPartnershipProposalDocument = forwardRef<HTMLDivElement, B2BProposalDocumentProps>(
  ({ invoice, activePagePreview = 'all' }, ref) => {
    const { profile } = useAuth();
    const meta = invoice.metadata || {};

    // Currency configuration
    const currencyCode = invoice.currency || 'SAR';
    const currencyCfg = getCurrencyConfig(currencyCode);
    const currSym = currencyCfg.symbol;

    // Recipient & Presenter fields
    const submittedTo = meta.b2b_submitted_to || invoice.client?.company_name || invoice.client?.full_name || invoice.lead?.company_name || invoice.lead?.contact_name || 'A C H';
    const submittedBy = meta.b2b_submitted_by || 'OSBIC International LLC';
    const preparedBy = meta.b2b_prepared_by || invoice.employee?.full_name || profile?.full_name || 'ANSAR NV';
    const proposalTitle = meta.b2b_proposal_title || 'Oman Company Formation Services';

    const clientPhone = meta.b2b_submitted_phone || meta.recipient_phone || invoice.client?.phone || invoice.lead?.contact_phone || '';
    const ourPhone = meta.b2b_our_phone || '+968 72596531, +968 72229827';
    const ourEmail = 'info@osbic.net';

    // Page 1: Introduction text
    const introP1 = meta.b2b_intro_p1 || 'OSBIC International LLC is pleased to present this proposal for a strategic partnership to deliver professional Oman company formation and acquisition services to your clients. With deep expertise in Omani business regulations and a commitment to efficient, compliant service delivery, we are well-positioned to support your clients in establishing a credible corporate presence in the Sultanate of Oman.';
    const introP2 = meta.b2b_intro_p2 || 'We believe this collaboration presents a valuable opportunity for both organizations to expand service offerings, generate additional revenue streams, and deliver tangible value to mutual clients.';

    // Page 1: Column Headers
    const pkgNewCrTitle = meta.pkg_new_cr_title || 'NEW COMPANY REGISTRATION (CR)';
    const pkgExistingCrTitle = meta.pkg_existing_cr_title || 'EXISTING COMPANY (CR) PACKAGE';

    // Page 1: New CR Package Details
    const pkgNewCrServicesT1: string[] = meta.pkg_new_cr_services_t1 
      ? (typeof meta.pkg_new_cr_services_t1 === 'string' ? meta.pkg_new_cr_services_t1.split('\n').filter(Boolean) : meta.pkg_new_cr_services_t1)
      : ['New commercial registration'];

    const pkgNewCrNoAttest = meta.pkg_new_cr_no_attest ?? 2000;

    const pkgNewCrServicesT2: string[] = meta.pkg_new_cr_services_t2
      ? (typeof meta.pkg_new_cr_services_t2 === 'string' ? meta.pkg_new_cr_services_t2.split('\n').filter(Boolean) : meta.pkg_new_cr_services_t2)
      : [
          'New commercial registration',
          'Attestation of CR with MOFA & SAUDI EMBASSY.'
        ];

    const pkgNewCrWithAttest = meta.pkg_new_cr_with_attest ?? 4000;

    const pkgNewCrDocs: string[] = meta.pkg_new_cr_docs
      ? (typeof meta.pkg_new_cr_docs === 'string' ? meta.pkg_new_cr_docs.split('\n').filter(Boolean) : meta.pkg_new_cr_docs)
      : [
          'Passport copy & Passport with selfie',
          'Email address',
          'Phone number',
          'Business activity list',
          'Proposed company name(s)'
        ];

    const pkgNewCrTimeline: string[] = meta.pkg_new_cr_timeline
      ? (typeof meta.pkg_new_cr_timeline === 'string' ? meta.pkg_new_cr_timeline.split('\n').filter(Boolean) : meta.pkg_new_cr_timeline)
      : [
          'Name approval: Same day',
          'CR issuance: Same day (post-approval)',
          'Attestation: Within 4 working days'
        ];

    // Page 1: Existing CR Package Details
    const pkgExistingCrServices: string[] = meta.pkg_existing_cr_services
      ? (typeof meta.pkg_existing_cr_services === 'string' ? meta.pkg_existing_cr_services.split('\n').filter(Boolean) : meta.pkg_existing_cr_services)
      : [
          'Commercial registration with MOFA & Saudi embassy attestation',
          'MOA with MOFA & Saudi attestation',
          'Audit report with MOFA & Saudi embassy attestation',
          '1 POA for Saudi client, with MOFA & Saudi attestation.'
        ];

    const pkgExistingCr = meta.pkg_existing_cr ?? 13000;

    const pkgExistingCrDocs: string[] = meta.pkg_existing_cr_docs
      ? (typeof meta.pkg_existing_cr_docs === 'string' ? meta.pkg_existing_cr_docs.split('\n').filter(Boolean) : meta.pkg_existing_cr_docs)
      : [
          'Passport copy & Iqama copy',
          'Passport with selfie',
          'Email address',
          'Phone number',
          'Power of Attorney (POA)'
        ];

    const pkgExistingCrTimeline: string[] = meta.pkg_existing_cr_timeline
      ? (typeof meta.pkg_existing_cr_timeline === 'string' ? meta.pkg_existing_cr_timeline.split('\n').filter(Boolean) : meta.pkg_existing_cr_timeline)
      : [
          'Complete documentation: Within 10-15 working days.'
        ];

    // Page 2: Surcharge & Models
    const surchargeNote = meta.b2b_surcharge_note || 'An additional fee of OMR 250 will apply, subject to the IQAMA & POA are not available as per the conditions mentioned above.';
    const showOptionA = meta.show_option_a !== false;
    const showOptionB = meta.show_option_b !== false;
    const optionATitle = meta.b2b_option_a_title || 'B2B Partnership';
    const optionADesc = meta.b2b_option_a_desc || 'Direct business cooperation with structured agreements, defined service levels, and formalized billing arrangements between both organizations.';
    const optionBTitle = meta.b2b_option_b_title || 'Reference-Based Partnership';
    const optionBDesc = meta.b2b_option_b_desc || 'Commission-based model where your organization refers clients to OSBIC and receives a competitive commission for each successful company formation.';

    // Page 3: Bank Account Details
    const showBankDetails = meta.show_bank_details !== false;
    const bankMuscatCustomer = meta.bank_muscat_customer || 'OSBIC INTERNATIONAL LLC';
    const bankMuscatSwift = meta.bank_muscat_swift || 'BMUSOMRXXX';
    const bankMuscatIban = meta.bank_muscat_iban || 'OM550270423081077790019';
    const bankMuscatAcc = meta.bank_muscat_acc || '0423081077790019';

    const bankDhofarCustomer = meta.bank_dhofar_customer || 'OSBIC INTERNATIONAL LLC';
    const bankDhofarSwift = meta.bank_dhofar_swift || 'BDOFOMRUXXX';
    const bankDhofarIban = meta.bank_dhofar_iban || 'OM390250001045788333002';
    const bankDhofarAcc = meta.bank_dhofar_acc || '01045788333002';

    const mobileBankingNum = meta.mobile_banking_num || '72229827';

    // Page 4: Selfie Guide & Contact
    const showSelfieGuide = meta.show_selfie_guide !== false;

    // Helper to determine if a page should be shown in preview
    const showP1 = activePagePreview === 'all' || activePagePreview === '1';
    const showP2 = activePagePreview === 'all' || activePagePreview === '2';
    const showP3 = (activePagePreview === 'all' && showBankDetails) || activePagePreview === '3';
    const showP4 = activePagePreview === 'all' || activePagePreview === '4';

    return (
      <div 
        ref={ref} 
        className="bg-white text-slate-900 w-[794px] max-w-full mx-auto shadow-2xl font-sans print:w-[210mm] print:m-0 print:shadow-none print:p-0 print:border-none"
      >
        
        {/* ========================================================================= */}
        {/* ================================= PAGE 1 ================================ */}
        {/* ========================================================================= */}
        {showP1 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-slate-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#0288d1] uppercase tracking-widest">
                    CONFIDENTIAL
                  </span>
                </div>
              </div>

              {/* Blue divider bar */}
              <div className="w-full h-[2px] bg-[#0288d1] mb-5" />

              {/* Main Banner */}
              <div className="bg-[#0073b7] text-white py-3.5 px-6 text-center rounded-sm shadow-sm mb-5">
                <h2 className="text-xl md:text-2xl font-extrabold uppercase tracking-wider">
                  STRATEGIC PARTNERSHIP PROPOSAL
                </h2>
                <p className="text-sm font-medium text-cyan-100 mt-0.5">
                  {proposalTitle}
                </p>
              </div>

              {/* Submitted To / Submitted By Box */}
              <div className="bg-[#ebf8ff] border border-[#bee3f8] rounded-sm p-4 mb-5 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#0073b7] mb-1">
                    SUBMITTED TO
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                    {submittedTo}
                  </div>
                  {clientPhone && (
                    <div className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#0073b7]" />
                      <span>{clientPhone}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#0073b7] mb-1">
                    SUBMITTED BY
                  </div>
                  <div className="font-bold text-slate-900 text-sm uppercase">
                    {submittedBy}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#0073b7]" />
                    <span>{ourPhone}</span>
                  </div>
                  {preparedBy && (
                    <div className="text-[10px] font-semibold text-slate-700 mt-1 uppercase">
                      <span className="text-[#0073b7] font-bold">PREPARED BY:</span> {preparedBy}
                    </div>
                  )}
                </div>
              </div>

              {/* INTRODUCTION Section */}
              <div className="mb-5">
                <div className="border-b border-[#0288d1] pb-1 mb-2.5">
                  <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                    INTRODUCTION
                  </h3>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed mb-2 text-justify">
                  {introP1}
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed text-justify">
                  {introP2}
                </p>
              </div>

              {/* SCOPE OF SERVICES Section - Attention-Rich Corporate Table */}
              <div className="mb-4">
                <div className="border-b border-[#0288d1] pb-1 mb-3">
                  <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                    SCOPE OF SERVICES
                  </h3>
                </div>

                {/* 2-Column Exact Model Table Matching Image 2 */}
                <div className="border border-[#0073b7] rounded-sm overflow-hidden text-xs shadow-xs">
                  {/* Table Headers */}
                  <div className="grid grid-cols-2 bg-[#0088cc] text-white font-extrabold text-center py-2.5 px-3 tracking-wide">
                    <div className="border-r border-cyan-200/40 uppercase text-[11px]">
                      {pkgNewCrTitle}
                    </div>
                    <div className="uppercase text-[11px]">
                      {pkgExistingCrTitle}
                    </div>
                  </div>

                  {/* Table Body - Soft Cyan Tone */}
                  <div className="grid grid-cols-2 divide-x divide-[#0073b7]/30 bg-[#ebf8ff]/70 text-slate-900">
                    
                    {/* LEFT COLUMN: NEW CR */}
                    <div className="p-3.5 space-y-3">
                      {/* Tier 1 */}
                      <div>
                        <ul className="space-y-1 text-[11px] text-slate-800">
                          {pkgNewCrServicesT1.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Total Amount Box with Crisp Border */}
                        <div className="my-2.5 border border-slate-700 bg-white grid grid-cols-12 text-center text-xs font-bold divide-x divide-slate-700 rounded-[2px] shadow-2xs">
                          <div className="col-span-6 py-1.5 px-2 uppercase text-slate-900 text-[11px] tracking-wider font-extrabold flex items-center justify-center">
                            TOTAL AMOUNT
                          </div>
                          <div className="col-span-6 py-1.5 px-2 text-slate-950 text-[11.5px] font-black tracking-wide flex items-center justify-center font-mono">
                            {Number(pkgNewCrNoAttest).toLocaleString()} {currSym}
                          </div>
                        </div>
                      </div>

                      {/* Tier 2 */}
                      <div>
                        <ul className="space-y-1 text-[11px] text-slate-800">
                          {pkgNewCrServicesT2.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Total Amount Box with Crisp Border */}
                        <div className="my-2.5 border border-slate-700 bg-white grid grid-cols-12 text-center text-xs font-bold divide-x divide-slate-700 rounded-[2px] shadow-2xs">
                          <div className="col-span-6 py-1.5 px-2 uppercase text-slate-900 text-[11px] tracking-wider font-extrabold flex items-center justify-center">
                            TOTAL AMOUNT
                          </div>
                          <div className="col-span-6 py-1.5 px-2 text-slate-950 text-[11.5px] font-black tracking-wide flex items-center justify-center font-mono">
                            {Number(pkgNewCrWithAttest).toLocaleString()} {currSym}
                          </div>
                        </div>
                      </div>

                      {/* Required Documents */}
                      <div className="pt-2 border-t border-[#bee3f8]">
                        <div className="font-extrabold text-[#0073b7] text-[11px] mb-1">
                          Required Documents
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-slate-700">
                          {pkgNewCrDocs.map((doc, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Processing Timeline */}
                      <div className="pt-2 border-t border-[#bee3f8]">
                        <div className="font-extrabold text-[#0073b7] text-[11px] mb-1">
                          Processing Timeline
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-slate-700">
                          {pkgNewCrTimeline.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: EXISTING CR PACKAGE */}
                    <div className="p-3.5 space-y-3">
                      <div>
                        <ul className="space-y-1 text-[11px] text-slate-800">
                          {pkgExistingCrServices.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Total Amount Box with Crisp Border */}
                        <div className="my-2.5 border border-slate-700 bg-white grid grid-cols-12 text-center text-xs font-bold divide-x divide-slate-700 rounded-[2px] shadow-2xs">
                          <div className="col-span-6 py-1.5 px-2 uppercase text-slate-900 text-[11px] tracking-wider font-extrabold flex items-center justify-center">
                            TOTAL AMOUNT
                          </div>
                          <div className="col-span-6 py-1.5 px-2 text-slate-950 text-[11.5px] font-black tracking-wide flex items-center justify-center font-mono">
                            {Number(pkgExistingCr).toLocaleString()} {currSym}
                          </div>
                        </div>
                      </div>

                      {/* Required Documents */}
                      <div className="pt-2 border-t border-[#bee3f8]">
                        <div className="font-extrabold text-[#0073b7] text-[11px] mb-1">
                          Required Documents
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-slate-700">
                          {pkgExistingCrDocs.map((doc, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Processing Timeline */}
                      <div className="pt-2 border-t border-[#bee3f8]">
                        <div className="font-extrabold text-[#0073b7] text-[11px] mb-1">
                          Processing Timeline
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-slate-700">
                          {pkgExistingCrTimeline.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-slate-900 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Page 1 Footer */}
            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <span>OSBIC International LLC</span>
              <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
              <span>Page 1</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ================================= PAGE 2 ================================ */}
        {/* ========================================================================= */}
        {showP2 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-slate-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#0288d1] uppercase tracking-widest">
                    CONFIDENTIAL
                  </span>
                </div>
              </div>

              <div className="w-full h-[2px] bg-[#0288d1] mb-6" />

              {/* Surcharge Notice with Accent Line */}
              <div className="mb-6 pl-3.5 border-l-4 border-[#0288d1] py-1 text-xs text-slate-800">
                <span className="font-bold text-[#0073b7]">Please Note: </span>
                <span>{surchargeNote}</span>
              </div>

              {/* PARTNERSHIP MODEL Section */}
              {(showOptionA || showOptionB) && (
                <div className="mb-6">
                  <div className="border-b border-[#0288d1] pb-1 mb-3">
                    <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                      PARTNERSHIP MODEL
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {showOptionA && (
                      <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm">
                        <div className="text-[10px] font-bold text-[#0288d1] uppercase tracking-wide">
                          Option A
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                          {optionATitle}
                        </h4>
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          {optionADesc}
                        </p>
                      </div>
                    )}

                    {showOptionB && (
                      <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm">
                        <div className="text-[10px] font-bold text-[#0288d1] uppercase tracking-wide">
                          Option B
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                          {optionBTitle}
                        </h4>
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          {optionBDesc}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* WHY PARTNER WITH OSBIC? Section */}
              <div className="mb-6">
                <div className="border-b border-[#0288d1] pb-1 mb-4">
                  <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                    WHY PARTNER WITH OSBIC?
                  </h3>
                </div>

                {/* 6 Grid Cards Matching Model (2 Rows of 3) */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {/* Card 1: Solid Blue */}
                  <div className="bg-[#0073b7] text-white p-4 rounded-sm flex flex-col justify-center text-center shadow-sm">
                    <Zap className="w-5 h-5 text-cyan-200 mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">Fast & Reliable</h5>
                    <p className="text-[10px] text-cyan-50 leading-relaxed">
                      Same-day processing for name approvals and CR issuance, ensuring your clients move quickly.
                    </p>
                  </div>

                  {/* Card 2: Light Blue */}
                  <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-4 rounded-sm flex flex-col justify-center text-center">
                    <FileText className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">End-to-End Support</h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Complete documentation assistance from initial filing through to final attestation.
                    </p>
                  </div>

                  {/* Card 3: Light Blue */}
                  <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-4 rounded-sm flex flex-col justify-center text-center">
                    <Briefcase className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">Market Expertise</h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Proven track record and deep knowledge of the Omani regulatory landscape.
                    </p>
                  </div>

                  {/* Card 4: Light Blue */}
                  <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-4 rounded-sm flex flex-col justify-center text-center">
                    <DollarSign className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">Competitive Pricing</h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Transparent, fixed-fee pricing with no hidden charges — making budgeting straightforward.
                    </p>
                  </div>

                  {/* Card 5: Solid Blue */}
                  <div className="bg-[#0073b7] text-white p-4 rounded-sm flex flex-col justify-center text-center shadow-sm">
                    <Users className="w-5 h-5 text-cyan-200 mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">Dedicated Team</h5>
                    <p className="text-[10px] text-cyan-50 leading-relaxed">
                      A dedicated client service team ready to support every step of your journey.
                    </p>
                  </div>

                  {/* Card 6: Light Blue */}
                  <div className="bg-[#ebf8ff] border border-[#bee3f8] text-slate-900 p-4 rounded-sm flex flex-col justify-center text-center">
                    <ShieldCheck className="w-5 h-5 text-[#0073b7] mx-auto mb-1.5" />
                    <h5 className="font-extrabold text-xs mb-1">Fully Compliant</h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      All formations completed in strict accordance with Omani commercial and legal requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 2 Footer */}
            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <span>OSBIC International LLC</span>
              <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
              <span>Page 2</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ======================= PAGE 3: BANK ACCOUNT DETAILS ==================== */}
        {/* ========================================================================= */}
        {showP3 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-slate-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#0288d1] uppercase tracking-widest">
                    CONFIDENTIAL
                  </span>
                </div>
              </div>

              <div className="w-full h-[2px] bg-[#0288d1] mb-6" />

              {/* Bank Account Details Banner (Matching Image 1) */}
              <div className="bg-[#0088cc] text-white py-2.5 px-6 text-center rounded-sm shadow-sm mb-6 font-extrabold text-base md:text-lg tracking-wider">
                Bank Account Details
              </div>

              {/* Bank Cards Container */}
              <div className="space-y-6">

                {/* 1. BANK MUSCAT */}
                <div className="border border-[#bee3f8] rounded-sm overflow-hidden bg-white shadow-xs">
                  <div className="bg-[#ebf8ff] text-[#0073b7] font-extrabold text-xs tracking-wider uppercase text-center py-2.5 border-b border-[#bee3f8]">
                    BANK MUSCAT
                  </div>
                  <div className="divide-y divide-[#ebf8ff] text-xs">
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        Customer Name
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-extrabold text-slate-900 uppercase">
                        {bankMuscatCustomer}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        SWIFT Code
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900">
                        {bankMuscatSwift}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        IBAN
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {bankMuscatIban}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        Account Number
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {bankMuscatAcc}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BANK DHOFAR */}
                <div className="border border-[#bee3f8] rounded-sm overflow-hidden bg-white shadow-xs">
                  <div className="bg-[#ebf8ff] text-[#0073b7] font-extrabold text-xs tracking-wider uppercase text-center py-2.5 border-b border-[#bee3f8]">
                    BANK DHOFAR
                  </div>
                  <div className="divide-y divide-[#ebf8ff] text-xs">
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        Customer Name
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-extrabold text-slate-900 uppercase">
                        {bankDhofarCustomer}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        SWIFT Code
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900">
                        {bankDhofarSwift}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        IBAN
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {bankDhofarIban}
                      </div>
                    </div>
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        Account Number
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {bankDhofarAcc}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. MOBILE BANKING */}
                <div className="border border-[#bee3f8] rounded-sm overflow-hidden bg-white shadow-xs">
                  <div className="bg-[#ebf8ff] text-[#0073b7] font-extrabold text-xs tracking-wider uppercase text-center py-2.5 border-b border-[#bee3f8]">
                    MOBILE BANKING
                  </div>
                  <div className="text-xs">
                    <div className="grid grid-cols-12">
                      <div className="col-span-4 py-2.5 px-4 font-bold text-slate-800 bg-[#f7fbfe] border-r border-[#ebf8ff] border-l-2 border-[#0073b7]">
                        Mobile Number
                      </div>
                      <div className="col-span-8 py-2.5 px-4 font-mono font-extrabold text-slate-900 tracking-wider">
                        {mobileBankingNum}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Page 3 Footer */}
            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <span>OSBIC International LLC</span>
              <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
              <span>Page 3</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ================== PAGE 4: CONTACT & ACCEPTABLE SELFIE ================== */}
        {/* ========================================================================= */}
        {showP4 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-[#0288d1]">OSBIC</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#0288d1] uppercase tracking-widest">
                    CONFIDENTIAL
                  </span>
                </div>
              </div>

              <div className="w-full h-[2px] bg-[#0288d1] mb-6" />

              {/* CONTACT INFORMATION Section */}
              <div className="mb-6">
                <div className="border-b border-[#0288d1] pb-1 mb-4">
                  <h3 className="text-sm font-extrabold text-[#0288d1] uppercase tracking-wider">
                    CONTACT INFORMATION
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Left Solid Blue Box */}
                  <div className="bg-[#0073b7] text-white p-4 rounded-sm space-y-2">
                    <h4 className="font-extrabold text-sm uppercase tracking-wide border-b border-cyan-400/30 pb-1">
                      OSBIC INTERNATIONAL LLC
                    </h4>
                    <div className="space-y-1.5 text-[11px] text-cyan-50">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        <span>Muscat, Sultanate of Oman</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        <span>{ourPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        <span>{ourEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        <span>www.osbic.net</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Light Blue Box */}
                  <div className="bg-[#ebf8ff] border border-[#bee3f8] p-4 rounded-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-[#0073b7] text-sm mb-1.5">
                        Ready to Partner?
                      </h4>
                      <p className="text-[11px] text-slate-700 leading-relaxed mb-3">
                        Contact our business development team today to begin the discussion and formalize your preferred partnership model.
                      </p>
                    </div>
                    <p className="text-[11px] font-bold italic text-[#0073b7]">
                      We look forward to a long and prosperous collaboration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-Banner */}
              <div className="text-center text-[10.5px] text-slate-600 font-semibold italic mb-4">
                — OSBIC International LLC | Established in Oman | www.osbic.net
              </div>

              {/* Selfie Guide Section (Matching Image 4) */}
              {showSelfieGuide && (
                <div className="border border-[#0073b7] rounded-sm overflow-hidden mb-6">
                  <div className="bg-[#0073b7] text-white text-center py-2 px-4 font-extrabold text-xs tracking-wider uppercase">
                    Example of Acceptable Selfie With Passport
                  </div>
                  <div className="p-4 bg-white flex justify-center items-center">
                    <img 
                      src="/selfie-guide.png" 
                      alt="Example of Acceptable Selfie With Passport" 
                      className="max-h-[340px] w-auto object-contain mx-auto"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Page 4 Footer */}
            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <span>OSBIC International LLC</span>
              <span className="font-semibold text-[#0073b7]">www.osbic.net</span>
              <span>Page {showBankDetails ? '4' : '3'}</span>
            </div>
          </div>
        )}

      </div>
    );
  }
);
