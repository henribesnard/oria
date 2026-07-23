import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ---- LocalStorage keys ----------------------------------------------------

const LS_ACCESS = 'oria_access_token';
const LS_REFRESH = 'oria_refresh_token';
const LS_EXPIRY = 'oria_token_expiry';

// ---- Context --------------------------------------------------------------

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ---- Helpers --------------------------------------------------------------

function saveTokens(data: TokenResponse) {
  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem(LS_ACCESS, data.access_token);
  localStorage.setItem(LS_REFRESH, data.refresh_token);
  localStorage.setItem(LS_EXPIRY, String(expiresAt));
  api.setToken(data.access_token);
}

function clearTokens() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_EXPIRY);
  api.setToken(null);
}

// ---- Provider component ---------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // --- Schedule auto-refresh ~60 s before expiry ---
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const delay = Math.max((expiresAt - Date.now()) - 60_000, 0);
    refreshTimerRef.current = setTimeout(async () => {
      const rt = localStorage.getItem(LS_REFRESH);
      if (!rt) return;
      try {
        const data = await api.post<TokenResponse>('/auth/refresh', { refresh_token: rt });
        saveTokens(data);
        setToken(data.access_token);
        scheduleRefresh(Date.now() + data.expires_in * 1000);
      } catch {
        // refresh failed — force logout
        clearTokens();
        setUser(null);
        setToken(null);
      }
    }, delay);
  }, []);

  // --- Restore session on mount ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedAccess = localStorage.getItem(LS_ACCESS);
      const savedRefresh = localStorage.getItem(LS_REFRESH);
      const savedExpiry = localStorage.getItem(LS_EXPIRY);
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
        if (savedExpiry) {
          scheduleRefresh(Number(savedExpiry));
        }
      } catch (err) {
        // If 401, try refresh
        if (err instanceof ApiError && err.status === 401 && savedRefresh) {
          try {
            const data = await api.post<TokenResponse>('/auth/refresh', { refresh_token: savedRefresh });
            if (cancelled) return;
            saveTokens(data);
            setToken(data.access_token);
            const profile = await api.get<User>('/me');
            if (cancelled) return;
            setUser(profile);
            scheduleRefresh(Date.now() + data.expires_in * 1000);
          } catch {
            if (cancelled) return;
            clearTokens();
          }
        } else {
          if (cancelled) return;
          clearTokens();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // --- login ---
  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<TokenResponse>('/auth/login', { email, password });
    saveTokens(data);
    setToken(data.access_token);
    const profile = await api.get<User>('/me');
    setUser(profile);
    scheduleRefresh(Date.now() + data.expires_in * 1000);
    navigate('/app');
  }, [navigate, scheduleRefresh]);

  // --- register ---
  const register = useCallback(async (email: string, password: string) => {
    const data = await api.post<TokenResponse>('/auth/register', { email, password, locale: 'fr' });
    saveTokens(data);
    setToken(data.access_token);
    // Fetch profile so user state is set
    const profile = await api.get<User>('/me');
    setUser(profile);
    scheduleRefresh(Date.now() + data.expires_in * 1000);
    navigate('/onboarding');
  }, [navigate, scheduleRefresh]);

  // --- logout ---
  const logout = useCallback(async () => {
    const rt = localStorage.getItem(LS_REFRESH);
    try {
      if (rt) await api.post('/auth/logout', { refresh_token: rt });
    } catch {
      // ignore logout errors
    }
    clearTokens();
    setUser(null);
    setToken(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    navigate('/login');
  }, [navigate]);

  return createElement(
    AuthContext.Provider,
    { value: { user, token, loading, login, register, logout } },
    children,
  );
}
