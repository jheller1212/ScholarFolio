import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';
import { trackEvent } from '../lib/analytics';

interface AuthState {
  user: User | null;
  session: Session | null;
  credits: number | null;
  loading: boolean;
  showWelcome: boolean;
  showPasswordReset: boolean;
  dismissWelcome: () => void;
  dismissPasswordReset: () => void;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const dismissWelcome = () => setShowWelcome(false);
  const dismissPasswordReset = () => setShowPasswordReset(false);

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    setShowPasswordReset(false);
    return { error: null };
  };

  const fetchCredits = async (userId: string) => {
    // Fire-and-forget: try to claim a free monthly credit (don't block credit fetch)
    supabase.rpc('claim_monthly_credit', { p_user_id: userId }).then(() => {}).catch(() => {});

    const { data, error } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setCredits(data.credits_remaining);
    } else {
      if (error) {
        logError({ category: 'auth', message: `Credit fetch failed: ${error.message}`, component: 'AuthContext', action: 'fetch-credits', context: { code: error.code } });
      }
      setCredits(0);
    }
  };

  const refreshCredits = async () => {
    if (user) {
      await fetchCredits(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCredits(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchCredits(session.user.id);
          // Show password reset modal when user clicks recovery link
          if (event === 'PASSWORD_RECOVERY') {
            setShowPasswordReset(true);
          }
          // Detect new sign-up (account created within last 30 seconds)
          if (event === 'SIGNED_IN') {
            const createdAt = new Date(session.user.created_at).getTime();
            const now = Date.now();
            const isNewUser = now - createdAt < 30000;
            const provider = session.user.app_metadata?.provider || 'email';
            if (isNewUser) {
              trackEvent('signup', { provider });
              if (provider === 'google') {
                setShowWelcome(true);
              }
            }
          }
        } else {
          setCredits(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('duplicate') || msg.includes('unique constraint')) {
        return { error: 'This email is already registered. If you signed up with Google, please use "Continue with Google" to sign in.' };
      }
      return { error: error.message };
    }
    trackEvent('signup', { provider: 'email' });
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCredits(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, credits, loading, showWelcome, showPasswordReset, dismissWelcome, dismissPasswordReset, updatePassword, signIn, signUp, signInWithGoogle, signOut, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
