# OSBIC Landing Page (`setup.osbic.net`) & Ad Ingestion Integration Guide

This guide contains everything required to connect **`https://setup.osbic.net/`**, **Google Ads Lead Form Assets**, and **Meta (FB/IG) Lead Ads** directly into your OSBIC CRM system.

---

## 1. Astro Landing Page (`setup.osbic.net`) Setup

### A. Server Endpoint: `src/pages/api/submit-lead.ts`
Create this file in your Astro repository (`setup.osbic.net`). It receives form submissions server-side, extracts UTM tracking data, and forwards it to the OSBIC Supabase backend.

```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();

    // Extract Form Fields
    const fullName = formData.get('fullName')?.toString() || '';
    const email = formData.get('email')?.toString() || '';
    const phone = formData.get('phone')?.toString() || '';
    const company = formData.get('company')?.toString() || 'Company Formation in Oman';

    // Extract Attribution / Tracking
    const utmSource = formData.get('utm_source')?.toString() || 'website';
    const utmMedium = formData.get('utm_medium')?.toString() || 'organic';
    const utmCampaign = formData.get('utm_campaign')?.toString() || 'setup_landing_page';
    const utmTerm = formData.get('utm_term')?.toString() || '';
    const utmContent = formData.get('utm_content')?.toString() || '';
    const gclid = formData.get('gclid')?.toString() || '';
    const fbclid = formData.get('fbclid')?.toString() || '';

    // Forward to OSBIC Edge Function Ingestion Endpoint
    const OSBIC_ENDPOINT = 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/website-lead';
    const OSBIC_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

    const response = await fetch(OSBIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': OSBIC_ANON_KEY,
        'Authorization': `Bearer ${OSBIC_ANON_KEY}`
      },
      body: JSON.stringify({
        contact_name: fullName,
        contact_email: email,
        contact_phone: phone,
        company_name: company,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
        gclid: gclid,
        fbclid: fbclid,
        landing_page_url: 'https://setup.osbic.net',
        notes: `Inbound form on setup.osbic.net. Campaign: ${utmCampaign}`
      })
    });

    if (!response.ok) {
      console.error('Failed to submit lead to OSBIC CRM', await response.text());
    }

    // Redirect to Thank-You Page for Google Ads Conversion Tracking
    return redirect('/thank-you', 303);

  } catch (error) {
    console.error('Lead Submission Error:', error);
    return redirect('/thank-you', 303);
  }
};
```

---

### B. Form Component on `setup.osbic.net` (With Hidden UTM Capture)

Add hidden inputs to capture URL query parameters (`?utm_source=google&utm_campaign=...&gclid=...`):

```html
<form action="/api/submit-lead" method="POST" id="leadForm" class="space-y-4">
  <!-- Hidden UTM Fields -->
  <input type="hidden" name="utm_source" id="utm_source" value="" />
  <input type="hidden" name="utm_medium" id="utm_medium" value="" />
  <input type="hidden" name="utm_campaign" id="utm_campaign" value="" />
  <input type="hidden" name="utm_term" id="utm_term" value="" />
  <input type="hidden" name="utm_content" id="utm_content" value="" />
  <input type="hidden" name="gclid" id="gclid" value="" />
  <input type="hidden" name="fbclid" id="fbclid" value="" />

  <div>
    <label class="block text-xs font-bold uppercase tracking-wider mb-1">Full Name *</label>
    <input type="text" name="fullName" required placeholder="e.g. John Doe" class="w-full p-3 border rounded-xl" />
  </div>

  <div>
    <label class="block text-xs font-bold uppercase tracking-wider mb-1">Email *</label>
    <input type="email" name="email" required placeholder="e.g. john@company.com" class="w-full p-3 border rounded-xl" />
  </div>

  <div>
    <label class="block text-xs font-bold uppercase tracking-wider mb-1">Phone / WhatsApp Number *</label>
    <input type="tel" name="phone" required placeholder="+968 7259 6531" class="w-full p-3 border rounded-xl" />
  </div>

  <button type="submit" class="w-full py-4 bg-primary text-white font-bold rounded-xl text-center shadow-lg">
    Request Free Consultation →
  </button>
</form>

<script>
  // Auto-populate hidden tracking inputs from URL query params
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(key => {
      const val = params.get(key);
      const el = document.getElementById(key);
      if (val && el) (el as HTMLInputElement).value = val;
    });
  });
</script>
```

---

### C. Google Ads Conversion Tag (`src/pages/thank-you.astro`)

On the thank-you page, include the Google Ads conversion event:

```html
---
// src/pages/thank-you.astro
import Layout from '../layouts/Layout.astro';
---

<Layout title="Thank You | OSBIC">
  <!-- Google Ads Conversion Tracking Snippet -->
  <script is:inline>
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        'send_to': 'AW-XXXXXXXXXX/AbCdEfGhIjKlMnOp',
        'value': 1.0,
        'currency': 'OMR'
      });
    }
  </script>

  <div class="max-w-xl mx-auto py-24 text-center px-4">
    <div class="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
      ✓
    </div>
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
    <p class="text-gray-600 mb-6">
      Your consultation request has been received. One of our bilingual business consultants will contact you within 5–10 minutes.
    </p>
    <a href="https://wa.me/96872596531" class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl">
      Chat with us on WhatsApp
    </a>
  </div>
</Layout>
```

---

## 2. Google Ads Lead Form Asset Webhook Setup

1. Open your **Google Ads Account** ➔ **Assets** ➔ **Lead Form**.
2. Scroll to **Lead Delivery (Webhook)**.
3. Enter the Webhook URL:
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/google-lead-webhook
   ```
4. Enter the Key:
   ```
   osbic_google_leads_secret_2026
   ```
5. Click **"Send test data"** and verify that a test lead appears in your **OSBIC Marketing Hub** (`/employee/marketing`).

---

## 3. Meta (Facebook / Instagram) Lead Ads Webhook Setup

1. Open **developers.facebook.com** ➔ Select your Meta App.
2. Go to **Webhooks** ➔ Select **Page** object.
3. Subscribe to the **`leadgen`** field.
4. Callback URL:
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/meta-lead-webhook
   ```
5. Verify Token:
   ```
   osbic_meta_verify_secret_2026
   ```
6. Set Supabase Secret:
   ```bash
   supabase secrets set META_PAGE_ACCESS_TOKEN="EAA..."
   ```
