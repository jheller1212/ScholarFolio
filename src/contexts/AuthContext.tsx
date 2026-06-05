import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  credits: number | null;
  loading: boolean;
  showWelcome: boolean;
  dismissWelcome: () => void;
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
  const dismissWelcome = () => setShowWelcome(false);

  const fetchCredits = async (userId: string) => {
    // Try to claim a free monthly credit if eligible (0 credits, >30 days since last grant)
    await supabase.rpc('claim_monthly_credit', { p_user_id: userId }).catch(() => {});

    const { data, error } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setCredits(data.credits_remaining);
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
          // Detect new Google sign-up (user just created, signed in via OAuth)
          if (event === 'SIGNED_IN') {
            const createdAt = new Date(session.user.created_at).getTime();
            const now = Date.now();
            // If account was created within the last 30 seconds, it's a new sign-up
            if (now - createdAt < 30000 && session.user.app_metadata?.provider === 'google') {
              setShowWelcome(true);
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
    <AuthContext.Provider value={{ user, session, credits, loading, showWelcome, dismissWelcome, signIn, signUp, signInWithGoogle, signOut, refreshCredits }}>
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
