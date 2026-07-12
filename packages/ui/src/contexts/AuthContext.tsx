'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, User, RegisterResponse } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'rd_access_token';
const USER_KEY  = 'rd_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user   : null,
    token  : null,
    loading: true,
  });

  // Rehydrate from localStorage on mount, then attempt a silent token refresh
  // so a page reload after a long pause doesn't immediately expire the session.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const userRaw = localStorage.getItem(USER_KEY);
        const user = userRaw ? (JSON.parse(userRaw) as User) : null;

        if (!cancelled) setState({ user, token, loading: false });

        // If we have a stored session, silently try to get a fresh access token
        // using the HttpOnly refresh-token cookie. This covers the case where the
        // page is reloaded after the access token has already expired.
        if (token && user) {
          try {
            const refreshed = await auth.refresh();
            if (!cancelled) {
              localStorage.setItem(TOKEN_KEY, refreshed.access_token);
              setState((prev) => ({ ...prev, token: refreshed.access_token }));
            }
          } catch (err) {
            // Only force logout on a definitive 401 — keep the existing session
            // if refresh fails due to network issues or any other transient error.
            const status = (err as { status?: number })?.status;
            if (status === 401) {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              if (!cancelled) setState({ user: null, token: null, loading: false });
            }
            // Otherwise keep the localStorage token — it may still be valid
          }
        }
      } catch {
        if (!cancelled) setState({ user: null, token: null, loading: false });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Proactive silent refresh every 7 hours while the tab is open
  // (access token lifetime is 8h, so this keeps sessions alive indefinitely)
  useEffect(() => {
    if (!state.token) return;

    const SEVEN_HOURS = 7 * 60 * 60 * 1000;
    const id = setInterval(async () => {
      try {
        const refreshed = await auth.refresh();
        localStorage.setItem(TOKEN_KEY, refreshed.access_token);
        setState((prev) => ({ ...prev, token: refreshed.access_token }));
      } catch (err) {
        // Only clear session on definitive 401, not transient errors
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setState({ user: null, token: null, loading: false });
        }
      }
    }, SEVEN_HOURS);

    return () => clearInterval(id);
  }, [state.token]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, token: access_token, loading: false });
    router.push('/dashboard');
  }, [router]);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const payload: { name: string; email: string; password: string; phone_number?: string } = { name, email, password };
    if (phone && phone.trim()) payload.phone_number = phone.trim();
    // Registration now returns {message, email_sent, user_id} — no token until email verified.
    const result = await auth.register(payload);
    return result;
  }, []);

  const setSession = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, token, loading: false });
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { ...prev, user: updated };
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (state.token) await auth.logout(state.token);
    } catch {
      // ignore — clear local state regardless
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, token: null, loading: false });
    router.push('/');
  }, [state.token, router]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
