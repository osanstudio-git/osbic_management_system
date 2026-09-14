import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, name, role, isUpdate } = await req.json();

    if (!email || !name) {
      throw new Error('Missing required fields (email and name are required)');
    }

    if (!isUpdate && (!password || !role)) {
      throw new Error('Missing required fields for new account creation');
    }

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable');
    }

    const htmlContent = isUpdate ? `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #0A0F1E;">OSBIC Account Update</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your official login email for the <strong>OSBIC Management System</strong> has been updated.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Your Updated Login Details:</strong></p>
          <p style="margin: 0 0 5px 0;"><strong>New Username / Email:</strong> <span style="font-family: monospace; font-weight: bold;">${email}</span></p>
          <p style="margin: 0;"><strong>Password:</strong> Use your existing account password</p>
        </div>
        
        <p style="color: #666; font-size: 13px;">All your existing leads, customer jobs, and history remain intact and accessible under this updated email.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://connect.osbic.net/login" style="background-color: #d4af37; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            Login to OSBIC Connect
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from OSBIC. If you did not request this change, please contact your administrator.</p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #0A0F1E;">Welcome to OSBIC!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your ${role === 'employee' ? 'employee' : 'client'} account has been successfully created in the OSBIC Management System.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Here are your temporary login credentials:</strong></p>
          <p style="margin: 0 0 5px 0;"><strong>Username:</strong> ${email}</p>
          <p style="margin: 0;"><strong>Password:</strong> <span style="font-family: monospace;">${password}</span></p>
        </div>
        
        <p style="color: #d9534f; font-size: 12px;"><em>Please log in and change your password as soon as possible for security purposes.</em></p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${role === 'employee' ? 'https://connect.osbic.net/login' : 'https://connect.osbic.net/portal/login'}" style="background-color: #d4af37; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            ${role === 'employee' ? 'Login to Employee Portal' : 'Login to Client Portal'}
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from the OSBIC System. Please do not reply.</p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'OSBIC System <noreply@system.osbic.net>',
        to: email,
        subject: isUpdate ? 'OSBIC Account - Your Login Email Has Been Updated' : 'Welcome to OSBIC - Your Account Credentials',
        html: htmlContent,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      const errorText = await res.text();
      return new Response(JSON.stringify({ error: errorText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
