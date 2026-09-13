import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);

  // 1. Meta Webhook Handshake (GET Request)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const expectedToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'osbic_meta_verify_secret_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('Meta Webhook verified successfully.');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Meta Lead Notification (POST Request)
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Check if leadgen change
      if (body.object === 'page') {
        const entries = body.entry || [];
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        const metaAccessToken = Deno.env.get('META_PAGE_ACCESS_TOKEN');

        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value?.leadgen_id;
              const formId = change.value?.form_id;
              const createdTime = change.value?.created_time;

              if (leadgenId && metaAccessToken) {
                // Fetch full lead details from Meta Graph API
                try {
                  const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${metaAccessToken}`;
                  const graphRes = await fetch(graphUrl);
                  const graphData = await graphRes.json();

                  if (graphData && graphData.field_data) {
                    let fullName = '';
                    let email = '';
                    let phone = '';
                    let company = '';

                    for (const f of graphData.field_data) {
                      const name = (f.name || '').toLowerCase();
                      const val = (f.values && f.values[0]) || '';
                      if (name.includes('full_name') || name.includes('name')) fullName = val;
                      else if (name.includes('email')) email = val;
                      else if (name.includes('phone')) phone = val;
                      else if (name.includes('company')) company = val;
                    }

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
                      .ilike('name', '%Meta Ads%')
                      .limit(1)
                      .maybeSingle();

                    await supabase.from('leads').insert([{
                      contact_name: fullName || 'Meta Ads Prospect',
                      contact_phone: cleanPhone || null,
                      contact_whatsapp: cleanPhone || null,
                      contact_email: email || null,
                      company_name: company || 'Company Setup (Meta Lead Ad)',
                      source_id: matchedSource?.id || null,
                      status: 'new',
                      utm_source: 'facebook',
                      utm_medium: 'paid_social',
                      leadgen_id: String(leadgenId),
                      form_id: String(formId || ''),
                      notes: `Meta Lead Ad Form Submission. Form ID: ${formId}. Created: ${createdTime}`,
                      interested_services: [{ type: 'service', name: 'Company Registration in Oman', price: 0 }]
                    }]);
                  }
                } catch (graphErr) {
                  console.error(`Failed to fetch Meta lead details for ${leadgenId}:`, graphErr);
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      console.error('Error handling Meta webhook:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});
