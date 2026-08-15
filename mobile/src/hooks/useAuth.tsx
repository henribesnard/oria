import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { api, ApiError } from '../api/client';
import * as storage from '../lib/storage';

// ---- Types ----------------------------------------------------------------

export interface User {
  user_id: string;
  email: string;
  role: string;
  display_name: string | null;
  locale: string;
  timezone: string;
  status: string;
  created_at: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  guest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  enterGuest: () => void;
}

// ---- Context --------------------------------------------------------------

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  guest: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  enterGuest: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ---- Provider component ---------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const segments = useSegments();

  // --- Persist tokens ---
  const persistTokens = useCallback(async (data: TokenResponse) => {
    const expiresAt = Date.now() + data.expires_in * 1000;
    await storage.saveTokens(data.access_token, data.refresh_token, expiresAt);
    api.setToken(data.access_token);
    return expiresAt;
  }, []);

  const clearAll = useCallback(async () => {
    await storage.clearTokens();
    api.setToken(null);
  }, []);

  // --- Schedule auto-refresh ~60 s before expiry ---
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(expiresAt - Date.now() - 60_000, 0);
    refreshTimerRef.current = setTimeout(async () => {
      const rt = await storage.getRefreshToken();
      if (!rt) return;
      try {
        const data = await api.post<TokenResponse>('/auth/refresh', { refresh_token: rt });
        const exp = await persistTokens(data);
        setToken(data.access_token);
        scheduleRefresh(exp);
      } catch {
        await clearAll();
        setUser(null);
        setToken(null);
      }
    }, delay);
  }, [persistTokens, clearAll]);

  // --- Restore session on mount ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedAccess = await storage.getAccessToken();
      const savedRefresh = await storage.getRefreshToken();
      const savedExpiry = await storage.getTokenExpiry();
      if (!savedAccess) {
        setLoading(false);
        return;
      }
      api.setToken(savedAccess);
      try {
        const profile = await api.get<User>('/me');
        if (cancelled) return;
        setUser(profile);
        setToken(savedAccess);
        if (savedExpiry) scheduleRefresh(savedExpiry);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && savedRefresh) {
          try {
            const data = await api.post<TokenResponse>('/auth/refresh', { refresh_token: savedRefresh });
            if (cancelled) return;
            const exp = await persistTokens(data);
            setToken(data.access_token);
            const profile = await api.get<User>('/me');
            if (cancelled) return;
            setUser(profile);
            scheduleRefresh(exp);
          } catch {
            if (cancelled) return;
            await clearAll();
          }
        } else {
          if (cancelled) return;
          await clearAll();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh, persistTokens, clearAll]);

  // --- Redirect based on auth state ---
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !guest && !inAuth) {
      router.replace('/(auth)/landing');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, guest, loading, segments, router]);

  // --- login ---
  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<TokenResponse>('/auth/login', { email, password });
    const exp = await persistTokens(data);
    setToken(data.access_token);
    const profile = await api.get<User>('/me');
    setUser(profile);
    scheduleRefresh(exp);
  }, [persistTokens, scheduleRefresh]);

  // --- register ---
  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const body: Record<string, string> = { email, password, locale: 'fr' };
    if (displayName) body.display_name = displayName;
    const data = await api.post<TokenResponse>('/auth/register', body);
    const exp = await persistTokens(data);
    setToken(data.access_token);
    const profile = await api.get<User>('/me');
    setUser(profile);
    scheduleRefresh(exp);
    router.replace('/(auth)/onboarding');
  }, [persistTokens, scheduleRefresh, router]);

  // --- logout ---
  const logout = useCallback(async () => {
    const rt = await storage.getRefreshToken();
    try {
      if (rt) await api.post('/auth/logout', { refresh_token: rt });
    } catch { /* ignore */ }
    await clearAll();
    setUser(null);
    setToken(null);
    setGuest(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, [clearAll]);

  // --- guest mode ---
  const enterGuest = useCallback(() => {
    setGuest(true);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, guest, login, register, logout, enterGuest }}>
      {children}
    </AuthContext.Provider>
  );
}
