 import React, { useState } from 'react';
import { User, Mail, Phone, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onSuccess: (client: { id: string; full_name: string }) => void;
}

const QuickRegisterForm = ({ onSuccess }: Props) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      const db = supabase as any;
      // Step A: Create a temporary Supabase client to avoid logging out current user
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const clientCode = `CLT-${Date.now().toString().slice(-4)}`;
      const tempPassword = `Quick!${Math.random().toString(36).slice(-8)}`;
      const cleanEmail = formData.email?.trim();

      if (cleanEmail) {
        const { data: staffMatch } = await db
          .from('profiles')
          .select('id, full_name, role')
          .ilike('email', cleanEmail)
          .in('role', ['employee', 'admin', 'manager', 'accountant', 'pro'])
          .maybeSingle();

        if (staffMatch) {
          throw new Error(`Email ${cleanEmail} belongs to staff member "${staffMatch.full_name}". Cannot register staff as a client.`);
        }
      }

      const email = cleanEmail || `${clientCode.toLowerCase()}@osbic.placeholder`;

      // Step B: Create the auth user
      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: email,
        password: tempPassword,
        options: {
          data: { 
            full_name: formData.fullName, 
            role: 'client' 
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Auth creation failed');

      // Step C: Update or create the profile using the main client, using the id from auth
      const { data, error: profileError } = await db
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: formData.fullName,
          email: email,
          phone: formData.phone,
          role: 'client',
          client_code: clientCode,
          is_active: true,
          branch_id: profile?.branch_id || null
        }, { onConflict: 'id' })
        .select()
        .single();

      if (profileError) throw profileError;
      
      toast.success('Client registered and linked to vault');
      onSuccess({ id: data.id, full_name: data.full_name });
    } catch (error: any) {
      toast.error(error.message || 'Failed to register client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary text-sm">
          <Plus size={16} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">New Client Registration</h4>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Minimal Data Entry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-muted border border-border rounded-xl px-9 py-2.5 text-sm text-foreground focus:border-primary outline-none transition-all"
              placeholder="e.g. Salim Al Hashmi"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Phone</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-muted border border-border rounded-xl px-9 py-2.5 text-sm text-foreground focus:border-primary outline-none transition-all"
                placeholder="9123 4567"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Email (Opt)</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-muted border border-border rounded-xl px-9 py-2.5 text-sm text-foreground focus:border-primary outline-none transition-all"
                placeholder="client@mail.com"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>Register & Proceed</>
          )}
        </button>
      </form>
    </div>
  );
};

export default QuickRegisterForm;
