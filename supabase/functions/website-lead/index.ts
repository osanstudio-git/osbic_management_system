import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wyzwpmwspvksgkmesaah.supabase.co';
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || 
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5endwbXdzcHZrc2drbWVzYWFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk2NDQyNiwiZXhwIjoyMDkwNTQwNDI2fQ.SxQCYGN6L_yHkC93Wyum6ZnYu4ekBPbCFnhrIItSKk8';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    const {
      contact_name,
      contact_phone,
      contact_email,
      company_name,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      gclid,
      fbclid,
      landing_page_url,
      notes,
    } = payload;

    if (!contact_name || (!contact_phone && !contact_email)) {
      return new Response(
        JSON.stringify({ error: "Missing required contact details (name and phone/email required)" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase Admin Client using Service Role Key
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // Clean phone number
    let cleanPhone = (contact_phone || '').trim().replace(/\s+/g, '');
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('968') || cleanPhone.startsWith('971') || cleanPhone.startsWith('966')) {
        cleanPhone = `+${cleanPhone}`;
      } else if (cleanPhone.length === 8 && (cleanPhone.startsWith('7') || cleanPhone.startsWith('9'))) {
        cleanPhone = `+968${cleanPhone}`;
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    // Detect source
    let sourceName = 'Website (setup.osbic.net)';
    if (gclid || utm_source?.toLowerCase().includes('google')) {
      sourceName = 'Google Ads';
    } else if (fbclid || utm_source?.toLowerCase().includes('meta') || utm_source?.toLowerCase().includes('facebook')) {
      sourceName = 'Meta Ads (FB/IG)';
    }

    let matchedSourceId = null;
    try {
      const { data: matchedSource } = await supabase
        .from('lead_sources')
        .select('id')
        .ilike('name', `%${sourceName}%`)
        .limit(1)
        .maybeSingle();
      if (matchedSource?.id) matchedSourceId = matchedSource.id;
    } catch (e) {
      console.warn("Source lookup warning:", e);
    }

    // Insert Lead Record
    const { data: insertedLead, error: insertError } = await supabase
      .from('leads')
      .insert([{
        contact_name: contact_name.trim(),
        contact_phone: cleanPhone || null,
        contact_whatsapp: cleanPhone || null,
        contact_email: contact_email?.trim() || null,
        company_name: company_name?.trim() || 'Company Formation in Oman',
        source_id: matchedSourceId,
        status: 'new',
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_term: utm_term || null,
        utm_content: utm_content || null,
        gclid: gclid || null,
        fbclid: fbclid || null,
        landing_page_url: landing_page_url || 'https://setup.osbic.net',
        notes: notes || `Direct Inbound Lead from ${landing_page_url || 'https://setup.osbic.net'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Database lead insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message, details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log interaction (safely non-blocking)
    try {
      await supabase.from('lead_interactions').insert([{
        lead_id: insertedLead.id,
        type: 'note',
        direction: 'inbound',
        notes: `Inbound form submission via ${sourceName}. Campaign: ${utm_campaign || 'Direct'}. GCLID: ${gclid ? 'Yes' : 'No'}.`
      }]);
    } catch (intErr) {
      console.warn("Interaction log non-fatal error:", intErr);
    }

    // Notify staff (safely non-blocking)
    try {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id')
        .or('can_do_sales.eq.true,is_manager.eq.true,role.eq.admin');

      if (staff && staff.length > 0) {
        await supabase.from('notifications').insert(
          staff.map((s: any) => ({
            recipient_id: s.id,
            type: 'alert',
            title: `⚡ New Lead: ${contact_name}`,
            body: `From ${sourceName} (${cleanPhone || contact_email})`,
            metadata: { lead_id: insertedLead.id, source: sourceName },
            is_read: false
          }))
        );
      }
    } catch (notifErr) {
      console.warn("Notification non-fatal error:", notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead received successfully",
        lead_id: insertedLead.id,
        lead_code: insertedLead.lead_code || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("General Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
