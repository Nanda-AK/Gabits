import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  guest: boolean;
  continueAsGuest: () => void;
  clearGuest: () => void;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string } | void>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string } | void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem("guest") === "1";
    } catch {
      return false;
    }
  });

  // Initialize session and subscribe to auth changes
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession) {
        // If the user logs in, disable guest mode automatically
        try { localStorage.removeItem("guest"); } catch {}
        setGuest(false);
        // Mark that onboarding may be needed (checked by OnboardingGate)
        try {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            sessionStorage.setItem('onboarding:trigger', '1');
          }
        } catch {}
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const continueAsGuest = useCallback(() => {
    try { localStorage.setItem("guest", "1"); } catch {}
    setGuest(true);
  }, []);

  const clearGuest = useCallback(() => {
    try { localStorage.removeItem("guest"); } catch {}
    setGuest(false);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    try { sessionStorage.setItem('onboarding:trigger', '1'); } catch {}
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // For email confirmation flows, this flag will be consumed on next SIGNED_IN
    try { sessionStorage.setItem('onboarding:trigger', '1'); } catch {}
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ session, user, loading, guest, continueAsGuest, clearGuest, signInWithPassword, signUpWithPassword, signOut }),
    [session, user, loading, guest, continueAsGuest, clearGuest, signInWithPassword, signUpWithPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
