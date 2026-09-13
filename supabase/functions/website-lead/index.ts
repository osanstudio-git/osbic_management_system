import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      interested_services,
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

    // Initialize Supabase Admin Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Standardize Phone formatting
    let cleanPhone = (contact_phone || '').trim().replace(/\s+/g, '');
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('968') || cleanPhone.startsWith('971') || cleanPhone.startsWith('966')) {
        cleanPhone = `+${cleanPhone}`;
      } else if (cleanPhone.length === 8 && (cleanPhone.startsWith('7') || cleanPhone.startsWith('9'))) {
        cleanPhone = `+968${cleanPhone}`; // Default Oman mobile
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    // Determine Source ID
    let sourceName = 'Website (setup.osbic.net)';
    if (gclid || utm_source?.toLowerCase().includes('google')) {
      sourceName = 'Google Ads';
    } else if (fbclid || utm_source?.toLowerCase().includes('meta') || utm_source?.toLowerCase().includes('facebook') || utm_source?.toLowerCase().includes('instagram')) {
      sourceName = 'Meta Ads (FB/IG)';
    }

    const { data: matchedSource } = await supabase
      .from('lead_sources')
      .select('id')
      .ilike('name', `%${sourceName}%`)
      .limit(1)
      .maybeSingle();

    // Insert Lead Record
    const leadRecord = {
      contact_name: contact_name.trim(),
      contact_phone: cleanPhone || null,
      contact_whatsapp: cleanPhone || null,
      contact_email: contact_email?.trim() || null,
      company_name: company_name?.trim() || 'Company Formation in Oman',
      source_id: matchedSource?.id || null,
      status: 'new',
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null,
      gclid: gclid || null,
      fbclid: fbclid || null,
      landing_page_url: landing_page_url || 'https://setup.osbic.net',
      notes: notes || `Direct Inbound Submission from ${landing_page_url || 'https://setup.osbic.net'}`,
      interested_services: interested_services || [
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

    if (insertError) {
      console.error('Failed to insert lead:', insertError);
      throw insertError;
    }

    // Log Interaction
    await supabase.from('lead_interactions').insert([{
      lead_id: insertedLead.id,
      type: 'note',
      direction: 'inbound',
      notes: `Inbound form submission via ${sourceName}. Campaign: ${utm_campaign || 'Direct'}. GCLID: ${gclid ? 'Present' : 'None'}.`
    }]);

    // Optional: Notify all sales staff & managers
    const { data: staffToNotify } = await supabase
      .from('profiles')
      .select('id')
      .or('can_do_sales.eq.true,is_manager.eq.true,role.eq.admin');

    if (staffToNotify && staffToNotify.length > 0) {
      const notifications = staffToNotify.map((staff: any) => ({
        recipient_id: staff.id,
        type: 'alert',
        title: `⚡ New Inbound Lead: ${contact_name}`,
        body: `New lead from ${sourceName} (${cleanPhone || contact_email}). Click to follow up immediately.`,
        metadata: { lead_id: insertedLead.id, source: sourceName, campaign: utm_campaign },
        is_read: false
      }));
      await supabase.from('notifications').insert(notifications);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead received successfully",
        lead_id: insertedLead.id,
        lead_code: insertedLead.lead_code
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("Error processing website lead:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
