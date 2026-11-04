import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

// ─── DEV MODE ───────────────────────────────────────────────────────────────
// Set to false to use real Supabase authentication. Set to true for quick dev access.
const DEV_MODE = false;

const DEV_PROFILES: Record<string, Partial<Profile>> = {
  admin: {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Dev Admin',
    email: 'admin@osbic.om',
    role: 'admin',
    is_active: true,
  } as Profile,
  employee: {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Dev Employee',
    email: 'employee@osbic.om',
    role: 'employee',
    is_active: true,
  } as Profile,
  client: {
    id: '00000000-0000-0000-0000-000000000003',
    full_name: 'Dev Client',
    email: 'client@osbic.om',
    role: 'client',
    is_active: true,
  } as Profile,
};
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  role: 'admin' | 'employee' | 'client' | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: string }>;
  signOut: () => Promise<void>;
  devLogin?: (role: 'admin' | 'employee' | 'client') => void;
  isDevMode: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for dev session first
    if (DEV_MODE) {
      const savedRole = localStorage.getItem('dev_role') as 'admin' | 'employee' | 'client' | null;
      if (savedRole && DEV_PROFILES[savedRole]) {
        setProfile(DEV_PROFILES[savedRole] as Profile);
        setUser({ id: DEV_PROFILES[savedRole].id } as User);
        setLoading(false);
        return;
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        // If profile doesn't exist but user does, it's a broken session or an incomplete test account.
        // We suppress the PGRST116 "0 rows" error to avoid console spam during password resets.
        if (error.code !== 'PGRST116') {
          console.error('Profile fetch failed:', error);
        }
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Critical Auth Error:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    
    // Fetch the role immediately for the caller
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    return { error: null, role: (profileData as any)?.role };
  };

  const devLogin = (role: 'admin' | 'employee' | 'client') => {
    if (!DEV_MODE) return;
    localStorage.setItem('dev_role', role);
    setProfile(DEV_PROFILES[role] as Profile);
    setUser({ id: DEV_PROFILES[role].id } as User);
  };

  const signOut = async () => {
    if (DEV_MODE && localStorage.getItem('dev_role')) {
      localStorage.removeItem('dev_role');
      setProfile(null);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    session,
    loading,
    role: profile?.role as 'admin' | 'employee' | 'client' | null ?? null,
    signIn,
    signOut,
    devLogin: DEV_MODE ? devLogin : undefined,
    isDevMode: DEV_MODE,
    refreshProfile: async () => {
      if (user?.id) await fetchProfile(user.id);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
