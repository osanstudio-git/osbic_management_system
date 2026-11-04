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
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('osbic_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  // If we already have a cached profile, we do not need to block the UI with an authenticating spinner
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('osbic_cached_profile');
    } catch {
      return true;
    }
  });

  // Keep track of active fetch to prevent duplicate simultaneous queries and Web Lock queues
  const activeFetchRef = React.useRef<{ userId: string; promise: Promise<void> } | null>(null);

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

    let isMounted = true;

    // Safety fallback: only if the user is truly waiting without a cached profile
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 6000);

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error('Session get error:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        localStorage.removeItem('osbic_cached_profile');
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        localStorage.removeItem('osbic_cached_profile');
        setLoading(false);
      }
    }).catch((err) => {
      console.error('getSession catch error:', err);
      if (isMounted) setLoading(false);
    });

    // 2. Auth state change listener (skip INITIAL_SESSION to avoid duplicate calls)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
        localStorage.removeItem('osbic_cached_profile');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string): Promise<void> => {
    // Deduplicate: If this user's profile is already being fetched, reuse the in-flight promise
    if (activeFetchRef.current && activeFetchRef.current.userId === userId) {
      return activeFetchRef.current.promise;
    }

    const queryPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) {
          // If profile doesn't exist (PGRST116 = 0 rows returned), user account was removed
          if (error.code === 'PGRST116') {
            try {
              await supabase.auth.signOut();
            } catch {
              // ignore
            }
            setUser(null);
            setSession(null);
            setProfile(null);
            localStorage.removeItem('osbic_cached_profile');
          } else {
            console.warn('Profile fetch note:', error.message);
          }
        } else if (data) {
          setProfile(data);
          try {
            localStorage.setItem('osbic_cached_profile', JSON.stringify(data));
          } catch {
            // ignore storage quota issues
          }
        }
      } catch (error: any) {
        console.warn('Profile sync delayed:', error?.message || error);
      } finally {
        setLoading(false);
        activeFetchRef.current = null;
      }
    })();

    activeFetchRef.current = { userId, promise: queryPromise };
    return queryPromise;
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role?: string }> => {
    try {
      const signInPromise = supabase.auth.signInWithPassword({ email: email.trim(), password });
      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Server timed out. Supabase database is not responding.')), 12000)
      );

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
      if (error) return { error: error.message };
      if (!data?.user) return { error: 'No user returned from login.' };

      // Fetch role with 6s timeout
      try {
        const profilePromise = supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        const profileTimeout = new Promise<{ data: any; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Profile load timeout')), 6000)
        );
        const { data: profileData } = await Promise.race([profilePromise, profileTimeout]);
        return { error: null, role: (profileData as any)?.role };
      } catch {
        return { error: null, role: undefined };
      }
    } catch (err: any) {
      return { error: err?.message || 'Login request timed out. Please check server status.' };
    }
  };

  const devLogin = (role: 'admin' | 'employee' | 'client') => {
    if (!DEV_MODE) return;
    localStorage.setItem('dev_role', role);
    setProfile(DEV_PROFILES[role] as Profile);
    setUser({ id: DEV_PROFILES[role].id } as User);
  };

  const signOut = async () => {
    localStorage.removeItem('osbic_cached_profile');
    if (DEV_MODE && localStorage.getItem('dev_role')) {
      localStorage.removeItem('dev_role');
      setProfile(null);
      setUser(null);
      return;
    }
    setProfile(null);
    setUser(null);
    setSession(null);
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
