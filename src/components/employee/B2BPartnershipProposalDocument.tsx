import React, { forwardRef } from 'react';
import type { Invoice } from '../../hooks/employee/useInvoices';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrencyConfig } from '../../hooks/shared/useCurrencyRates';
import { 
  Zap, FileText, Briefcase, DollarSign, Users, ShieldCheck, Phone, Mail, Globe, MapPin
} from 'lucide-react';

interface B2BProposalDocumentProps {
  invoice: Invoice;
  activePagePreview?: 'all' | '1' | '2' | '3' | '4';
}

export const B2BPartnershipProposalDocument = forwardRef<HTMLDivElement, B2BProposalDocumentProps>(
  ({ invoice, activePagePreview = 'all' }, ref) => {
    const { profile } = useAuth();
    const meta = invoice.metadata || {};

    // Standard OSBIC Quotation Brand Colors (Matching Normal Quotation)
    const themeColor = '#0088cc';
    const lightBg = '#f0f9ff'; // sky-50
    const borderColor = '#0088cc/30';

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
    const bankMuscatName = meta.bank_muscat_name || 'OSBIC INTERNATIONAL LLC';
    const bankMuscatSwift = meta.bank_muscat_swift || 'BMUSOMRXXX';
    const bankMuscatIban = meta.bank_muscat_iban || 'OM550270423081077790019';
    const bankMuscatAccount = meta.bank_muscat_account || '0423081077790019';

    const bankDhofarName = meta.bank_dhofar_name || 'OSBIC INTERNATIONAL LLC';
    const bankDhofarSwift = meta.bank_dhofar_swift || 'BDOFOMRUXXX';
    const bankDhofarIban = meta.bank_dhofar_iban || 'OM390250001045788333002';
    const bankDhofarAccount = meta.bank_dhofar_account || '01045788333002';

    const mobileBankingNumber = meta.mobile_banking_number || '72229827';

    // Page 4: Selfie Guide
    const showSelfieGuide = meta.show_selfie_guide !== false;
    const hideTotals = !!meta.hide_totals || !!meta.hideTotal;

    // Helper to determine if a page should be shown in preview
    const showP1 = activePagePreview === 'all' || activePagePreview === '1';
    const showP2 = activePagePreview === 'all' || activePagePreview === '2';
    const showP3 = (activePagePreview === 'all' || activePagePreview === '3') && showBankDetails;
    const showP4 = activePagePreview === 'all' || activePagePreview === '4' || (!showBankDetails && activePagePreview === '3');

    // Page numbering helper
    const pageNumBank = 3;
    const pageNumContact = showBankDetails ? 4 : 3;

    // Helper: Shared Top Header Component (Matches Normal Quotation Exactly)
    const renderHeader = (pageTag?: string) => (
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-widest uppercase" style={{ color: themeColor }}>
            OSBIC
          </h1>
        </div>
        <div className="text-right" style={{ color: themeColor }}>
          <p className="font-bold text-sm">OSBIC International LLC</p>
          <p className="text-[10px] text-gray-500 font-medium">+968 9216 4213 • www.osbic.net</p>
          {pageTag && (
            <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-[#0088cc]/20" style={{ backgroundColor: lightBg, color: themeColor }}>
              {pageTag}
            </span>
          )}
        </div>
      </div>
    );

    // Helper: Shared Footer Component
    const renderFooter = (pageNumber: number | string) => (
      <div className="pt-3 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center font-medium">
        <span>OSBIC International LLC • Muscat, Sultanate of Oman</span>
        <span className="font-semibold" style={{ color: themeColor }}>www.osbic.net</span>
        <span>Page {pageNumber}</span>
      </div>
    );

    return (
      <div 
        ref={ref} 
        className="bg-white text-gray-900 w-[794px] max-w-full mx-auto shadow-2xl font-sans text-[11px] leading-relaxed print:w-[210mm] print:m-0 print:shadow-none print:p-0 print:border-none print:bg-white"
      >
        
        {/* ========================================================================= */}
        {/* ================================= PAGE 1 ================================ */}
        {/* ========================================================================= */}
        {showP1 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-gray-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              {renderHeader('CONFIDENTIAL B2B')}

              {/* Main Title Bar (Matches Normal Quotation) */}
              <div className="text-center py-2.5 mb-5" style={{ backgroundColor: themeColor }}>
                <h2 className="text-white text-xl font-bold uppercase tracking-widest">
                  Strategic Partnership Proposal
                </h2>
                <p className="text-white/90 text-[10px] font-medium tracking-wide">
                  {proposalTitle || 'Oman Company Formation & Business Set Up'}
                </p>
              </div>

              {/* Client & Partner Details Grid (Matches Normal Quotation 4-Box Grid) */}
              <div className="grid grid-cols-2 border border-[#0088cc]/30 mb-5">
                <div className="p-3 border-r border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    Submitted To
                  </p>
                  <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
                    {submittedTo}
                  </p>
                  {clientPhone && (
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                      Contact: {clientPhone}
                    </p>
                  )}
                </div>

                <div className="p-3 border-b border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    Submitted By
                  </p>
                  <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
                    {submittedBy}
                  </p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                    {ourPhone}
                  </p>
                </div>

                <div className="p-3 border-r border-[#0088cc]/30" style={{ backgroundColor: lightBg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    Prepared By
                  </p>
                  <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
                    {preparedBy}
                  </p>
                </div>

                <div className="p-3" style={{ backgroundColor: lightBg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    Activity / Scope
                  </p>
                  <p className="font-bold text-xs uppercase text-gray-900 leading-tight">
                    {proposalTitle}
                  </p>
                </div>
              </div>

              {/* INTRODUCTION Section */}
              <div className="mb-5">
                <div className="py-1 px-3 mb-2 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
                  Introduction
                </div>
                <p className="text-[11px] text-gray-800 leading-relaxed mb-1.5 text-justify font-normal">
                  {introP1}
                </p>
                <p className="text-[11px] text-gray-800 leading-relaxed text-justify font-normal">
                  {introP2}
                </p>
              </div>

              {/* SCOPE OF SERVICES Section */}
              <div className="mb-4">
                <div className="py-1 px-3 mb-2.5 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
                  Scope of Services
                </div>

                {/* 2-Column Clean Comparison Table */}
                <div className="border border-[#0088cc]/30 rounded-lg overflow-hidden text-xs bg-white shadow-xs">
                  {/* Table Headers */}
                  <div className="grid grid-cols-2 text-white font-bold text-center py-2 px-3 tracking-wider text-[10px] divide-x divide-white/20 uppercase" style={{ backgroundColor: themeColor }}>
                    <div>NEW COMPANY REGISTRATION (CR)</div>
                    <div>EXISTING COMPANY (CR) PACKAGE</div>
                  </div>

                  {/* Table Body */}
                  <div className="grid grid-cols-2 divide-x divide-[#0088cc]/30 bg-white">
                    
                    {/* LEFT COLUMN: NEW CR */}
                    <div className="p-3 space-y-3">
                      {/* Tier 1 */}
                      <div>
                        <ul className="space-y-1 text-[11px]">
                          {pkgNewCrServicesT1.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                              <span className="font-medium text-gray-900">{item}</span>
                            </li>
                          ))}
                        </ul>

                        {!hideTotals && (
                          <div className="my-2 p-2.5 flex justify-between items-center rounded-lg border border-[#0088cc]/20" style={{ backgroundColor: lightBg }}>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: themeColor }}>
                              Total (No Attestation)
                            </span>
                            <span className="text-xs font-bold text-gray-900 font-mono">
                              {Number(pkgNewCrNoAttest).toLocaleString()} {currSym}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tier 2 */}
                      <div>
                        <ul className="space-y-1 text-[11px]">
                          {pkgNewCrServicesT2.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                              <span className="font-medium text-gray-900">{item}</span>
                            </li>
                          ))}
                        </ul>

                        {!hideTotals && (
                          <div className="my-2 p-2.5 flex justify-between items-center rounded-lg border border-[#0088cc]/20" style={{ backgroundColor: lightBg }}>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: themeColor }}>
                              Total (With Attestation)
                            </span>
                            <span className="text-xs font-bold text-gray-900 font-mono">
                              {Number(pkgNewCrWithAttest).toLocaleString()} {currSym}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Required Documents */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: themeColor }}>
                          Documents Required
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-gray-800">
                          {pkgNewCrDocs.map((doc, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                              <span className="font-medium">{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Processing Timeline */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: themeColor }}>
                          Processing Timeline
                        </div>
                        <ul className="space-y-0.5 text-[10.5px]">
                          {pkgNewCrTimeline.map((item, idx) => {
                            const parts = item.split(':');
                            const task = parts[0]?.trim();
                            const days = parts.slice(1).join(':')?.trim();
                            return (
                              <li key={idx} className="flex justify-between border-b border-gray-100 pb-0.5 text-[10px]">
                                <span className="font-medium text-gray-800">{task}</span>
                                <span className="font-bold" style={{ color: themeColor }}>{days || task}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: EXISTING CR PACKAGE */}
                    <div className="p-3 space-y-3">
                      <div>
                        <ul className="space-y-1 text-[11px]">
                          {pkgExistingCrServices.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                              <span className="font-medium text-gray-900">{item}</span>
                            </li>
                          ))}
                        </ul>

                        {!hideTotals && (
                          <div className="my-2 p-2.5 flex justify-between items-center rounded-lg border border-[#0088cc]/20" style={{ backgroundColor: lightBg }}>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: themeColor }}>
                              Total Package Value
                            </span>
                            <span className="text-xs font-bold text-gray-900 font-mono">
                              {Number(pkgExistingCr).toLocaleString()} {currSym}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Required Documents */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: themeColor }}>
                          Documents Required
                        </div>
                        <ul className="space-y-0.5 text-[10.5px] text-gray-800">
                          {pkgExistingCrDocs.map((doc, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold" style={{ color: themeColor }}>{idx + 1}.</span>
                              <span className="font-medium">{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Processing Timeline */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: themeColor }}>
                          Processing Timeline
                        </div>
                        <ul className="space-y-0.5 text-[10.5px]">
                          {pkgExistingCrTimeline.map((item, idx) => {
                            const parts = item.split(':');
                            const task = parts[0]?.trim();
                            const days = parts.slice(1).join(':')?.trim();
                            return (
                              <li key={idx} className="flex justify-between border-b border-gray-100 pb-0.5 text-[10px]">
                                <span className="font-medium text-gray-800">{task}</span>
                                <span className="font-bold" style={{ color: themeColor }}>{days || task}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Page 1 Footer */}
            {renderFooter(1)}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ================================= PAGE 2 ================================ */}
        {/* ========================================================================= */}
        {showP2 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-gray-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              {renderHeader('CONFIDENTIAL B2B')}

              {/* Surcharge Notice */}
              <div className="mb-5 p-3 rounded-lg border border-[#0088cc]/30 flex items-start gap-2.5" style={{ backgroundColor: lightBg }}>
                <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: themeColor }}>
                  Please Note:
                </span>
                <p className="text-[11px] text-gray-800 leading-relaxed font-medium">
                  {surchargeNote}
                </p>
              </div>

              {/* PARTNERSHIP MODEL Section */}
              {(showOptionA || showOptionB) && (
                <div className="mb-6">
                  <div className="py-1 px-3 mb-3 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
                    Partnership Models
                  </div>

                  <div className="space-y-2.5">
                    {showOptionA && (
                      <div className="p-3.5 rounded-lg border border-[#0088cc]/25" style={{ backgroundColor: lightBg }}>
                        <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: themeColor }}>
                          Option A
                        </div>
                        <h4 className="font-bold text-gray-900 text-xs mb-1">
                          {optionATitle}
                        </h4>
                        <p className="text-[11px] text-gray-700 leading-relaxed font-normal">
                          {optionADesc}
                        </p>
                      </div>
                    )}

                    {showOptionB && (
                      <div className="p-3.5 rounded-lg border border-[#0088cc]/25" style={{ backgroundColor: lightBg }}>
                        <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: themeColor }}>
                          Option B
                        </div>
                        <h4 className="font-bold text-gray-900 text-xs mb-1">
                          {optionBTitle}
                        </h4>
                        <p className="text-[11px] text-gray-700 leading-relaxed font-normal">
                          {optionBDesc}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* WHY PARTNER WITH OSBIC? Section */}
              <div className="mb-6">
                <div className="py-1 px-3 mb-3 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
                  Why Partner With OSBIC?
                </div>

                {/* 6 Grid Cards */}
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  {/* Card 1: Solid Brand Blue */}
                  <div className="p-3.5 rounded-lg flex flex-col justify-center text-center text-white shadow-xs" style={{ backgroundColor: themeColor }}>
                    <Zap className="w-5 h-5 text-cyan-200 mx-auto mb-1.5" />
                    <h5 className="font-bold text-xs mb-1">Fast & Reliable</h5>
                    <p className="text-[10px] text-white/90 leading-relaxed font-normal">
                      Same-day processing for name approvals and CR issuance, ensuring your clients move quickly.
                    </p>
                  </div>

                  {/* Card 2: Light Blue */}
                  <div className="p-3.5 rounded-lg border border-[#0088cc]/25 flex flex-col justify-center text-center" style={{ backgroundColor: lightBg }}>
                    <FileText className="w-5 h-5 mx-auto mb-1.5" style={{ color: themeColor }} />
                    <h5 className="font-bold text-xs text-gray-900 mb-1">End-to-End Support</h5>
                    <p className="text-[10px] text-gray-600 leading-relaxed font-normal">
                      Complete documentation assistance from initial filing through to final attestation.
                    </p>
                  </div>

                  {/* Card 3: Light Blue */}
                  <div className="p-3.5 rounded-lg border border-[#0088cc]/25 flex flex-col justify-center text-center" style={{ backgroundColor: lightBg }}>
                    <Briefcase className="w-5 h-5 mx-auto mb-1.5" style={{ color: themeColor }} />
                    <h5 className="font-bold text-xs text-gray-900 mb-1">Market Expertise</h5>
                    <p className="text-[10px] text-gray-600 leading-relaxed font-normal">
                      Proven track record and deep knowledge of the Omani regulatory landscape.
                    </p>
                  </div>

                  {/* Card 4: Light Blue */}
                  <div className="p-3.5 rounded-lg border border-[#0088cc]/25 flex flex-col justify-center text-center" style={{ backgroundColor: lightBg }}>
                    <DollarSign className="w-5 h-5 mx-auto mb-1.5" style={{ color: themeColor }} />
                    <h5 className="font-bold text-xs text-gray-900 mb-1">Competitive Pricing</h5>
                    <p className="text-[10px] text-gray-600 leading-relaxed font-normal">
                      Transparent, fixed-fee pricing with no hidden charges — making budgeting straightforward.
                    </p>
                  </div>

                  {/* Card 5: Solid Brand Blue */}
                  <div className="p-3.5 rounded-lg flex flex-col justify-center text-center text-white shadow-xs" style={{ backgroundColor: themeColor }}>
                    <Users className="w-5 h-5 text-cyan-200 mx-auto mb-1.5" />
                    <h5 className="font-bold text-xs mb-1">Dedicated Team</h5>
                    <p className="text-[10px] text-white/90 leading-relaxed font-normal">
                      A dedicated client service team ready to support every step of your journey.
                    </p>
                  </div>

                  {/* Card 6: Light Blue */}
                  <div className="p-3.5 rounded-lg border border-[#0088cc]/25 flex flex-col justify-center text-center" style={{ backgroundColor: lightBg }}>
                    <ShieldCheck className="w-5 h-5 mx-auto mb-1.5" style={{ color: themeColor }} />
                    <h5 className="font-bold text-xs text-gray-900 mb-1">Fully Compliant</h5>
                    <p className="text-[10px] text-gray-600 leading-relaxed font-normal">
                      All formations completed in strict accordance with Omani commercial and legal requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 2 Footer */}
            {renderFooter(2)}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ======================= PAGE 3: BANK ACCOUNT DETAILS ==================== */}
        {/* ========================================================================= */}
        {showP3 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between border-b border-gray-200 print:border-none print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              {renderHeader('PAYMENT INFO')}

              {/* Main Banner */}
              <div className="text-center py-2.5 mb-6" style={{ backgroundColor: themeColor }}>
                <h2 className="text-white text-lg font-bold uppercase tracking-widest">
                  Bank Account Details
                </h2>
              </div>

              <div className="space-y-4">
                {/* CARD 1: BANK MUSCAT */}
                <div className="rounded-xl p-4 border border-[#0088cc]/30 shadow-xs" style={{ backgroundColor: lightBg }}>
                  <h3 className="text-center font-bold text-xs tracking-widest uppercase mb-2.5" style={{ color: themeColor }}>
                    BANK MUSCAT
                  </h3>
                  
                  <div className="bg-white border border-[#0088cc]/20 rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-12 divide-y divide-[#0088cc]/15 text-[11px]">
                      
                      {/* Customer Name */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        Customer Name
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 uppercase tracking-wide">
                        {bankMuscatName}
                      </div>

                      {/* SWIFT Code */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        SWIFT Code
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono">
                        {bankMuscatSwift}
                      </div>

                      {/* IBAN */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        IBAN
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono text-[11.5px]">
                        {bankMuscatIban}
                      </div>

                      {/* Account Number */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        Account Number
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono text-[11.5px]">
                        {bankMuscatAccount}
                      </div>

                    </div>
                  </div>
                </div>

                {/* CARD 2: BANK DHOFAR */}
                <div className="rounded-xl p-4 border border-[#0088cc]/30 shadow-xs" style={{ backgroundColor: lightBg }}>
                  <h3 className="text-center font-bold text-xs tracking-widest uppercase mb-2.5" style={{ color: themeColor }}>
                    BANK DHOFAR
                  </h3>
                  
                  <div className="bg-white border border-[#0088cc]/20 rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-12 divide-y divide-[#0088cc]/15 text-[11px]">
                      
                      {/* Customer Name */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        Customer Name
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 uppercase tracking-wide">
                        {bankDhofarName}
                      </div>

                      {/* SWIFT Code */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        SWIFT Code
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono">
                        {bankDhofarSwift}
                      </div>

                      {/* IBAN */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        IBAN
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono text-[11.5px]">
                        {bankDhofarIban}
                      </div>

                      {/* Account Number */}
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        Account Number
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono text-[11.5px]">
                        {bankDhofarAccount}
                      </div>

                    </div>
                  </div>
                </div>

                {/* CARD 3: MOBILE BANKING */}
                <div className="rounded-xl p-4 border border-[#0088cc]/30 shadow-xs" style={{ backgroundColor: lightBg }}>
                  <h3 className="text-center font-bold text-xs tracking-widest uppercase mb-2.5" style={{ color: themeColor }}>
                    MOBILE BANKING
                  </h3>
                  
                  <div className="bg-white border border-[#0088cc]/20 rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-12 text-[11px]">
                      <div className="col-span-4 p-2.5 font-bold uppercase tracking-wider border-r border-[#0088cc]/20 text-[10px]" style={{ color: themeColor, backgroundColor: lightBg }}>
                        Mobile Number
                      </div>
                      <div className="col-span-8 p-2.5 font-bold text-gray-900 tracking-wider font-mono text-[11.5px]">
                        {mobileBankingNumber}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 3 Footer */}
            {renderFooter(pageNumBank)}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ===================== PAGE 4: CONTACT & SELFIE GUIDE ==================== */}
        {/* ========================================================================= */}
        {showP4 && (
          <div className="p-8 md:p-10 min-h-[1120px] relative flex flex-col justify-between print:min-h-[297mm] print:break-after-page print:m-0">
            <div>
              {/* Header */}
              {renderHeader('NEXT STEPS')}

              {/* CONTACT INFORMATION Section */}
              <div className="mb-6">
                <div className="py-1 px-3 mb-3 font-bold text-white uppercase tracking-widest text-[10px]" style={{ backgroundColor: themeColor }}>
                  Contact Information
                </div>

                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  {/* Left Solid Brand Box */}
                  <div className="rounded-xl p-4 text-white space-y-2 shadow-xs" style={{ backgroundColor: themeColor }}>
                    <h4 className="font-bold text-sm uppercase tracking-wide border-b border-white/20 pb-1">
                      OSBIC INTERNATIONAL LLC
                    </h4>
                    <div className="space-y-1.5 text-[11px] text-white/95">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                        <span>Sultanate of Oman</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                        <span>{ourPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                        <span>{ourEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                        <span>www.osbic.net</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Light Blue Box */}
                  <div className="rounded-xl p-4 border border-[#0088cc]/25 flex flex-col justify-between" style={{ backgroundColor: lightBg }}>
                    <div>
                      <h4 className="font-bold text-sm mb-1.5" style={{ color: themeColor }}>
                        Ready to Partner?
                      </h4>
                      <p className="text-[11px] text-gray-700 leading-relaxed mb-3 font-normal">
                        Contact our business development team today to begin the discussion and formalize your preferred partnership model.
                      </p>
                    </div>
                    <p className="text-[11px] font-bold italic" style={{ color: themeColor }}>
                      We look forward to a long and prosperous collaboration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-Banner */}
              <div className="text-center text-[10px] text-gray-500 font-medium italic mb-5">
                — OSBIC International LLC • Established in Oman • www.osbic.net
              </div>

              {/* Selfie Guide Section */}
              {showSelfieGuide && (
                <div className="border border-[#0088cc]/30 rounded-xl overflow-hidden mb-6 shadow-xs">
                  <div className="text-white text-center py-1.5 px-4 font-bold text-[10px] tracking-wider uppercase" style={{ backgroundColor: themeColor }}>
                    Example of Acceptable Selfie With Passport
                  </div>
                  <div className="p-4 bg-white flex justify-center items-center">
                    <img 
                      src="/selfie-guide.png" 
                      alt="Example of Acceptable Selfie With Passport" 
                      className="max-h-[320px] w-auto object-contain mx-auto rounded"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Page 4 Footer */}
            {renderFooter(pageNumContact)}
          </div>
        )}

      </div>
    );
  }
);
