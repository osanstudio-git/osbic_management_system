import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

export interface EnsureClientProfileParams {
  clientId?: string | null;
  leadId?: string | null;
  fullName: string;
  phone?: string | null;
  whatsapp?: string | null;
  nationality?: string | null;
  email?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  createdBy?: string | null;
  clientCode?: string | null;
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
      if (params.nationality || params.whatsapp) {
        await supabase
          .from('profiles')
          .update({
            ...(params.nationality ? { nationality: params.nationality } : {}),
            ...(params.whatsapp ? { whatsapp: params.whatsapp } : {})
          })
          .eq('id', matchByPhone.id);
      }
      if (params.leadId && (!leadData?.client_id || leadData.client_id !== matchByPhone.id)) {
        await supabase
          .from('leads')
          .update({ client_id: matchByPhone.id, status: 'converted' })
          .eq('id', params.leadId);
      }
      return matchByPhone.id;
    }
  }

  // 4. Match by email & Staff Protection
  const rawEmail = (params.email || leadData?.contact_email || '').trim();
  const hasRealEmail = rawEmail.length > 0 && rawEmail.includes('@');
  if (hasRealEmail) {
    // Step 4a: Explicitly prevent staff emails from being registered or linked as clients
    const { data: staffMatch } = await supabase
      .from('profiles')
      .select('id, full_name, role, email')
      .ilike('email', rawEmail)
      .in('role', ['employee', 'admin', 'manager', 'accountant', 'pro'])
      .maybeSingle();

    if (staffMatch) {
      throw new Error(
        `This email (${rawEmail}) belongs to staff member "${staffMatch.full_name}" (${staffMatch.role}). Staff accounts cannot be linked or registered as clients. Please use the client's own email address or leave it empty.`
      );
    }

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
    // If auth user existed already with this email, fetch their profile ONLY if they are a client
    const { data: existingProf } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .ilike('email', rawEmail)
      .maybeSingle();

    if (existingProf) {
      if (existingProf.role && existingProf.role !== 'client') {
        throw new Error(
          `This email (${rawEmail}) is registered to staff member "${existingProf.full_name}" (${existingProf.role}). Staff accounts cannot be linked or converted to client accounts.`
        );
      }
      userId = existingProf.id;
    }
  }

  // Fallback safety if auth signup was denied (e.g. rate limit): generate fresh UUID
  if (!userId) {
    userId = crypto.randomUUID();
  }

  // Extra safety check: Ensure target userId is never an existing staff profile before upserting
  const { data: targetProfileCheck } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (targetProfileCheck && targetProfileCheck.role && targetProfileCheck.role !== 'client') {
    throw new Error(
      `Critical security block: Target user ID belongs to staff member "${targetProfileCheck.full_name}" (${targetProfileCheck.role}). Cannot overwrite staff account.`
    );
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
      whatsapp: params.whatsapp || targetPhone || null,
      nationality: params.nationality || null,
      role: 'client',
      client_code: params.clientCode || clientCode,
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

