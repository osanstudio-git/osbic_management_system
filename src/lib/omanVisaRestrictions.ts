/**
 * Oman Visa Compliance & Country Restriction Intelligence
 * 
 * Tracks nationalities subject to Royal Oman Police (ROP) and Ministry of Labour (MOL)
 * visa restrictions, suspensions, or strict clearance requirements.
 * Used by OSBIC Marketing to detect ad targeting leaks and by Sales to filter non-viable leads.
 */

export interface RestrictedCountryRule {
  code: string;
  name: string;
  nameAr: string;
  keywords: string[];
  dialCodes: string[];
  severity: 'banned' | 'strict_approval' | 'conditional';
  statusLabelEn: string;
  statusLabelAr: string;
  ropNotice: string;
  marketingAdvice: string;
}

export const OMAN_RESTRICTED_COUNTRIES: RestrictedCountryRule[] = [
  {
    code: 'BD',
    name: 'Bangladesh',
    nameAr: 'بنغلاديش',
    keywords: ['bangladesh', 'bangladeshi', 'bengal', 'bengali', 'bd', 'بنغلاديش', 'بنغالي'],
    dialCodes: ['+880', '00880', '880'],
    severity: 'banned',
    statusLabelEn: 'Visa Suspended (ROP)',
    statusLabelAr: 'تأشيرات موقوفة رسمياً (شرطة عمان السلطانية)',
    ropNotice: 'Royal Oman Police has suspended issuance of all new work, investor, and visit visas for Bangladeshi nationals. New commercial registrations and investor visas cannot be processed.',
    marketingAdvice: 'Exclude Bangladesh, Bengali speakers, and expats of this demographic from Meta & Google Ads targeting. Every lead generated is unusable for business setup.',
  },
  {
    code: 'SD',
    name: 'Sudan',
    nameAr: 'السودان',
    keywords: ['sudan', 'sudanese', 'sd', 'السودان', 'سوداني'],
    dialCodes: ['+249', '00249', '249'],
    severity: 'strict_approval',
    statusLabelEn: 'Strict Clearance Required',
    statusLabelAr: 'تتطلب موافقة أمنية مشددة',
    ropNotice: 'Labor clearance and visa issuance require special approvals and are subject to high refusal rates under current guidelines.',
    marketingAdvice: 'Cap ad exposure. Commercial registrations can only be approved under exceptional corporate guarantees.',
  },
  {
    code: 'SY',
    name: 'Syria',
    nameAr: 'سوريا',
    keywords: ['syria', 'syrian', 'sy', 'سوريا', 'سوري'],
    dialCodes: ['+963', '00963', '963'],
    severity: 'strict_approval',
    statusLabelEn: 'Special Security Approval Required',
    statusLabelAr: 'تتطلب تصريح أمني مسبق',
    ropNotice: 'Visas and commercial registration require extensive multi-department security clearance prior to Ministry approval.',
    marketingAdvice: 'Not suitable for mass retail ad campaigns. Requires pre-qualified investors with existing residency or special clearance.',
  },
  {
    code: 'YE',
    name: 'Yemen',
    nameAr: 'اليمن',
    keywords: ['yemen', 'yemeni', 'ye', 'اليمن', 'يمني'],
    dialCodes: ['+967', '00967', '967'],
    severity: 'conditional',
    statusLabelEn: 'Special Clearance Needed',
    statusLabelAr: 'تتطلب موافقات خاصة',
    ropNotice: 'Visas for Yemeni nationals are subject to case-by-case review and clearance by relevant Oman authorities.',
    marketingAdvice: 'Filter ad messaging to high-net-worth investors only. Verify capital proof early.',
  },
  {
    code: 'PK',
    name: 'Pakistan',
    nameAr: 'باكستان',
    keywords: ['pakistan', 'pakistani', 'pk', 'باكستان', 'باكستاني'],
    dialCodes: ['+92', '0092', '92'],
    severity: 'conditional',
    statusLabelEn: 'Conditional / Scrutinized',
    statusLabelAr: 'تدقيق خاص حسب النشاط',
    ropNotice: 'Investor and partner visas are permitted with verified minimum bank deposit and commercial lease; certain general work visas remain restricted.',
    marketingAdvice: 'Target business owner & investor titles only. Disqualify general job-seekers or unsupported inquiries.',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    nameAr: 'نيجيريا',
    keywords: ['nigeria', 'nigerian', 'ng', 'نيجيريا', 'نيجيري'],
    dialCodes: ['+234', '00234', '234'],
    severity: 'banned',
    statusLabelEn: 'Visa Restricted',
    statusLabelAr: 'تأشيرات مقيدة',
    ropNotice: 'Visit and work visas from this region face strict restrictions and high refusal rates.',
    marketingAdvice: 'Exclude from global campaigns; ad spend does not yield viable business setup clients.',
  },
];

export interface LeadVisaCheckResult {
  isRestricted: boolean;
  severity: 'banned' | 'strict_approval' | 'conditional' | null;
  rule: RestrictedCountryRule | null;
  matchedBy: 'nationality' | 'phone' | 'ip' | null;
  statusBadgeText: string;
  ropNotice: string;
  marketingAdvice: string;
}

/**
 * Checks a lead against Oman visa restrictions by nationality, phone country code, or IP.
 */
export function checkOmanVisaEligibility(lead: {
  nationality?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  ip_country?: string | null;
}): LeadVisaCheckResult {
  const nationalityClean = (lead.nationality || '').toLowerCase().trim();
  const phoneClean = (lead.contact_phone || lead.phone || '').replace(/[\s\-\(\)]/g, '');
  const ipClean = (lead.ip_country || '').toLowerCase().trim();

  for (const rule of OMAN_RESTRICTED_COUNTRIES) {
    // 1. Check nationality keywords
    if (nationalityClean) {
      for (const kw of rule.keywords) {
        if (nationalityClean.includes(kw) || nationalityClean === kw) {
          return {
            isRestricted: true,
            severity: rule.severity,
            rule,
            matchedBy: 'nationality',
            statusBadgeText: rule.statusLabelEn,
            ropNotice: rule.ropNotice,
            marketingAdvice: rule.marketingAdvice,
          };
        }
      }
    }

    // 2. Check phone dial code
    if (phoneClean) {
      for (const dial of rule.dialCodes) {
        if (phoneClean.startsWith(dial) || phoneClean.startsWith('+' + dial.replace('+', ''))) {
          return {
            isRestricted: true,
            severity: rule.severity,
            rule,
            matchedBy: 'phone',
            statusBadgeText: `${rule.statusLabelEn} (${rule.name})`,
            ropNotice: rule.ropNotice,
            marketingAdvice: rule.marketingAdvice,
          };
        }
      }
    }

    // 3. Check IP country code
    if (ipClean && (ipClean === rule.code.toLowerCase() || ipClean === rule.name.toLowerCase())) {
      return {
        isRestricted: true,
        severity: rule.severity,
        rule,
        matchedBy: 'ip',
        statusBadgeText: `${rule.statusLabelEn} (IP: ${rule.name})`,
        ropNotice: rule.ropNotice,
        marketingAdvice: rule.marketingAdvice,
      };
    }
  }

  return {
    isRestricted: false,
    severity: null,
    rule: null,
    matchedBy: null,
    statusBadgeText: 'Eligible / Open',
    ropNotice: '',
    marketingAdvice: '',
  };
}

/**
 * Standardized Disqualification Reasons for Marketing & Sales Analytics
 */
export interface DisqualificationReasonDef {
  key: string;
  labelEn: string;
  labelAr: string;
  category: 'targeting_ad_waste' | 'contact_issue' | 'unqualified' | 'other';
  description: string;
}

export const DISQUALIFICATION_REASONS: DisqualificationReasonDef[] = [
  {
    key: 'oman_visa_ban',
    labelEn: 'Oman Visa Ban / Restricted Nationality',
    labelAr: 'حظر / قيود التأشيرات في سلطنة عُمان',
    category: 'targeting_ad_waste',
    description: 'Lead is from a country where Oman ROP has suspended or restricted visas (e.g. Bangladesh). Wrong ad targeting.',
  },
  {
    key: 'no_answer',
    labelEn: 'No Response / Did Not Answer Call',
    labelAr: 'لا يوجد رد / لم يرد على الاتصال',
    category: 'contact_issue',
    description: 'Sales consultant called multiple times without response or WhatsApp message was ignored.',
  },
  {
    key: 'wrong_number',
    labelEn: 'Wrong / Invalid Number',
    labelAr: 'رقم غير صحيح أو وهمي',
    category: 'contact_issue',
    description: 'Phone number does not exist, belongs to wrong person, or has invalid format.',
  },
  {
    key: 'job_seeker',
    labelEn: 'Job Seeker (Looking for Employment)',
    labelAr: 'باحث عن عمل (ليس عميل تأسيس)',
    category: 'targeting_ad_waste',
    description: 'Inquired looking for a job instead of business setup or migration services. Creative ad messaging issue.',
  },
  {
    key: 'no_budget',
    labelEn: 'No Budget / Capital Ineligible',
    labelAr: 'لا تتوفر لديه ميزانية / غير مؤهل مالياً',
    category: 'unqualified',
    description: 'Cannot afford government fees, capital deposits, or professional service charges.',
  },
  {
    key: 'wrong_service',
    labelEn: 'Wrong Service / Out of OSBIC Scope',
    labelAr: 'طلب خدمة خارج نطاق اختصاص أوسبك',
    category: 'unqualified',
    description: 'Requires personal immigration to non-supported destinations or unlicensed civil disputes.',
  },
  {
    key: 'language_barrier',
    labelEn: 'Language Barrier / Communication Failed',
    labelAr: 'حاجز لغوي / تعذر التواصل',
    category: 'contact_issue',
    description: 'Does not speak Arabic, English, Urdu, or Hindi.',
  },
  {
    key: 'competitor',
    labelEn: 'Competitor / Spam Lead',
    labelAr: 'منافس أو رسالة مزعجة (اسبام)',
    category: 'other',
    description: 'Competitor price checking or automated bot submission.',
  },
  {
    key: 'other',
    labelEn: 'Other Reason',
    labelAr: 'سبب آخر',
    category: 'other',
    description: 'Other non-viable lead reason documented in consultant notes.',
  },
];

