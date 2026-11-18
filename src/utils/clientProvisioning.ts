import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

export interface EnsureClientProfileParams {
  clientId?: string | null;
  leadId?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  createdBy?: string | null;
}

/**
 * Ensures a valid client profile exists in the `profiles` table.
 * 1. Checks if clientId is provided and exists in `profiles`.
 * 2. Checks if leadId is provided and already has client_id linked or phone/email match.
 * 3. Checks if phone or email matches an existing client profile in `profiles`.
 * 4. If no profile exists, automatically provisions an auth user and client profile in the background
 *    using an isolated Supabase client (persists nothing to localStorage, leaving current employee logged in).
 * 5. Returns the resolved, guaranteed valid client UUID for use in `jobs.client_id`.
 */
export async function ensureClientProfile(params: EnsureClientProfileParams): Promise<string> {
  // 1. Direct Client ID verification
  if (params.clientId) {
    const { data: existingClient } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', params.clientId)
      .maybeSingle();

    if (existingClient?.id) {
      return existingClient.id;
    }
  }

  // 2. Lead Data Inspection (if leadId provided)
  let leadData: any = null;
  if (params.leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', params.leadId)
      .maybeSingle();
    leadData = lead;

    // If lead is already linked to a client profile
    if (leadData?.client_id) {
      const { data: linkedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', leadData.client_id)
        .maybeSingle();

      if (linkedProfile?.id) {
        return linkedProfile.id;
      }
    }
  }

  // 3. Match by phone number
  const targetPhone = (params.phone || leadData?.contact_phone || '').trim();
  if (targetPhone) {
    // Strip common spaces/dashes for comparison if needed
    const { data: matchByPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', targetPhone)
      .eq('role', 'client')
      .maybeSingle();

    if (matchByPhone?.id) {
      if (params.leadId && (!leadData?.client_id || leadData.client_id !== matchByPhone.id)) {
        await supabase
          .from('leads')
          .update({ client_id: matchByPhone.id, status: 'converted' })
          .eq('id', params.leadId);
      }
      return matchByPhone.id;
    }
  }

  // 4. Match by email
  const rawEmail = (params.email || leadData?.contact_email || '').trim();
  const hasRealEmail = rawEmail.length > 0 && rawEmail.includes('@');
  if (hasRealEmail) {
    const { data: matchByEmail } = await supabase
      .from('profiles')
      .select('id, role')
      .ilike('email', rawEmail)
      .maybeSingle();

    if (matchByEmail?.id && matchByEmail.role === 'client') {
      if (params.leadId && (!leadData?.client_id || leadData.client_id !== matchByEmail.id)) {
        await supabase
          .from('leads')
          .update({ client_id: matchByEmail.id, status: 'converted' })
          .eq('id', params.leadId);
      }
      return matchByEmail.id;
    }
  }

  // 5. Automatic Just-In-Time Provisioning
  const clientFullName = (params.fullName || leadData?.contact_name || 'Client').trim();
  const clientCompany = (params.companyName || leadData?.company_name || '').trim() || null;
  const clientCode = `CLT-${Date.now().toString().slice(-7)}`;

  const authEmail = hasRealEmail 
    ? rawEmail 
    : `clt_${Date.now()}_${Math.floor(Math.random() * 10000)}@osbic.internal`;
  const authPassword = `${crypto.randomUUID().slice(0, 8)}Aa1!`;

  // Create isolated Supabase auth client that does NOT touch localStorage
  const authClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  let userId: string | null = null;
  const { data: authData, error: authError } = await authClient.auth.signUp({
    email: authEmail,
    password: authPassword,
    options: {
      data: {
        full_name: clientFullName,
        role: 'client',
      },
    },
  });

  if (authData?.user?.id) {
    userId = authData.user.id;
  } else if (authError && hasRealEmail) {
    // If auth user existed already with this email, fetch their profile
    const { data: existingProf } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', rawEmail)
      .maybeSingle();

    if (existingProf?.id) {
      userId = existingProf.id;
    }
  }

  // Fallback safety if auth signup was denied (e.g. rate limit): lookup Walk-in Customer
  if (!userId) {
    const { data: walkin } = await supabase
      .from('profiles')
      .select('id')
      .eq('full_name', 'Walk-in Customer')
      .eq('role', 'client')
      .maybeSingle();

    if (walkin?.id) {
      if (params.leadId) {
        await supabase.from('leads').update({ client_id: walkin.id }).eq('id', params.leadId);
      }
      return walkin.id;
    }

    throw new Error(`Unable to create client account for "${clientFullName}": ${authError?.message || 'Authentication error'}`);
  }

  // Upsert profile in public.profiles table
  const { data: createdProfile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: clientFullName,
      company_name: clientCompany,
      email: hasRealEmail ? rawEmail : null,
      phone: targetPhone || null,
      role: 'client',
      client_code: clientCode,
      is_active: true,
      created_by: params.createdBy || null,
      branch_id: params.branchId || null,
    }, { onConflict: 'id' })
    .select('id')
    .single();

  if (profileError && !createdProfile) {
    // Check if profile exists despite upsert error
    const { data: checkProf } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (checkProf?.id) {
      userId = checkProf.id;
    } else {
      throw new Error(`Client profile registration failed: ${profileError.message}`);
    }
  } else if (createdProfile?.id) {
    userId = createdProfile.id;
  }

  // Link lead to the newly created profile
  if (params.leadId && userId) {
    await supabase
      .from('leads')
      .update({
        client_id: userId,
        status: 'converted',
      })
      .eq('id', params.leadId);
  }

  return userId;
}

