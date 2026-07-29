'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, User, RegisterResponse } from '../lib/api';

/**
 * Access tokens are short-lived (30m by default; the server reports the exact
 * lifetime as `expires_in`). This used to be a fixed 7-hour interval based on
 * an assumed 8h token, while the server actually issued 15m tokens — so
 * sessions died a quarter of an hour in and nothing renewed them.
 *
 * We now refresh at 75% of the real lifetime, with a floor so a
 * misconfigured TTL can't spin the timer.
 */
const DEFAULT_TTL_SECONDS = 1800;   // matches the server default of 30m
const MIN_REFRESH_MS      = 60_000; // never poll faster than once a minute

function refreshDelayMs(expiresIn?: number) {
  const ttl = (expiresIn && expiresIn > 0 ? expiresIn : DEFAULT_TTL_SECONDS) * 1000;
  return Math.max(MIN_REFRESH_MS, Math.floor(ttl * 0.75));
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Seconds the current access token was issued for. */
  expiresIn?: number;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, workspaceName?: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  setSession: (token: string, user: User, expiresIn?: number) => void;
  /** Hydrate a session that already exists as a refresh cookie (OAuth return). */
  hydrateFromCookie: () => Promise<boolean>;
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
              if (refreshed.user) localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
              setState((prev) => ({
                ...prev,
                token    : refreshed.access_token,
                user     : refreshed.user ?? prev.user,
                expiresIn: refreshed.expires_in,
              }));
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

  // Proactive silent refresh at 75% of the token's actual lifetime.
  useEffect(() => {
    if (!state.token) return;

    const id = setInterval(async () => {
      try {
        const refreshed = await auth.refresh();
        localStorage.setItem(TOKEN_KEY, refreshed.access_token);
        if (refreshed.user) localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
        setState((prev) => ({
          ...prev,
          token    : refreshed.access_token,
          user     : refreshed.user ?? prev.user,
          expiresIn: refreshed.expires_in,
        }));
      } catch (err) {
        // Only clear session on a definitive 401, not on transient errors.
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setState({ user: null, token: null, loading: false });
        }
      }
    }, refreshDelayMs(state.expiresIn));

    return () => clearInterval(id);
  }, [state.token, state.expiresIn]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user, expires_in } = await auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, token: access_token, loading: false, expiresIn: expires_in });
    router.push('/dashboard');
  }, [router]);

  /**
   * Completes an OAuth sign-in. The provider callback sets only the HttpOnly
   * refresh cookie and redirects with nothing sensitive in the URL, so we trade
   * that cookie for an access token and the user profile here.
   */
  const hydrateFromCookie = useCallback(async () => {
    try {
      const { access_token, user, expires_in } = await auth.refresh();
      if (!access_token || !user) return false;
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({ user, token: access_token, loading: false, expiresIn: expires_in });
      return true;
    } catch {
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string, workspaceName?: string) => {
    const payload: { name: string; email: string; password: string; phone_number?: string; workspace_name?: string } = { name, email, password };
    if (phone && phone.trim()) payload.phone_number = phone.trim();
    if (workspaceName && workspaceName.trim()) payload.workspace_name = workspaceName.trim();
    // Registration now returns {message, email_sent, user_id} — no token until email verified.
    const result = await auth.register(payload);
    return result;
  }, []);

  const setSession = useCallback((token: string, user: User, expiresIn?: number) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, token, loading: false, expiresIn });
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
    <AuthContext.Provider
      value={{ ...state, login, register, logout, updateUser, setSession, hydrateFromCookie }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
