import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Verify Google Ads Webhook Key
    const expectedKey = Deno.env.get('GOOGLE_ADS_WEBHOOK_KEY') || 'osbic_google_leads_secret_2026';
    if (payload.google_key && payload.google_key !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized Google key" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Google Ads sends user_column_data as an array of { column_id: string, string_value: string }
    let fullName = '';
    let email = '';
    let phone = '';
    let company = '';

    if (Array.isArray(payload.user_column_data)) {
      for (const col of payload.user_column_data) {
        const id = (col.column_id || '').toUpperCase();
        const val = col.string_value || '';
        if (id.includes('FULL_NAME') || id.includes('NAME')) {
          fullName = val;
        } else if (id.includes('EMAIL')) {
          email = val;
        } else if (id.includes('PHONE') || id.includes('NUMBER')) {
          phone = val;
        } else if (id.includes('COMPANY') || id.includes('BUSINESS')) {
          company = val;
        }
      }
    }

    // Fallbacks if mapped directly
    fullName = fullName || payload.full_name || payload.name || 'Google Ads Prospect';
    email = email || payload.email || '';
    phone = phone || payload.phone_number || payload.phone || '';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Standardize phone
    let cleanPhone = phone.trim().replace(/\s+/g, '');
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 8 && (cleanPhone.startsWith('7') || cleanPhone.startsWith('9'))) {
        cleanPhone = `+968${cleanPhone}`;
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    const { data: matchedSource } = await supabase
      .from('lead_sources')
      .select('id')
      .ilike('name', '%Google Ads%')
      .limit(1)
      .maybeSingle();

    const leadRecord = {
      contact_name: fullName,
      contact_phone: cleanPhone || null,
      contact_whatsapp: cleanPhone || null,
      contact_email: email || null,
      company_name: company || 'Company Setup (Google Ads Lead Form)',
      source_id: matchedSource?.id || null,
      status: 'new',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: payload.campaign_id ? `Campaign_${payload.campaign_id}` : 'Google Ads Form Asset',
      gclid: payload.gclid || null,
      form_id: payload.form_id ? String(payload.form_id) : null,
      notes: `Google Ads Lead Form Submission. Campaign ID: ${payload.campaign_id || 'N/A'}. Form ID: ${payload.form_id || 'N/A'}`,
      interested_services: [
        { type: 'service', name: 'Company Registration in Oman', price: 0 }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedLead, error: insertError } = await supabase
      .from('leads')
      .insert([leadRecord])
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, lead_id: insertedLead.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error("Error processing Google lead:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
