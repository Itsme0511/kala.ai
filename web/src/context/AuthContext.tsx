import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '../lib/api';
import type { Artisan } from '../types';

type AuthContextValue = {
  token: string | null;
  artisan: Artisan | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; location?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('kala_token');
  });
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('kala_token', token);
      refreshProfile().catch(() => {
        setToken(null);
        localStorage.removeItem('kala_token');
      });
    } else {
      localStorage.removeItem('kala_token');
      setArtisan(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshProfile() {
    if (!token) return;
    setLoading(true);
    try {
      const { artisan: profile } = await apiRequest<{ artisan: Artisan }>('/api/account/profile', { token });
      setArtisan(profile);
    } finally {
      setLoading(false);
    }
  }

  async function login(payload: { email: string; password: string }) {
    setLoading(true);
    try {
      const resp = await apiRequest<{ token: string; artisan: Artisan }>('/api/auth/login', {
        method: 'POST',
        body: payload,
      });
      setToken(resp.token);
      setArtisan(resp.artisan);
    } finally {
      setLoading(false);
    }
  }

  async function register(payload: { name: string; email: string; password: string; location?: string }) {
    setLoading(true);
    try {
      const resp = await apiRequest<{ token: string; artisan: Artisan }>('/api/auth/register', {
        method: 'POST',
        body: payload,
      });
      setToken(resp.token);
      setArtisan(resp.artisan);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setArtisan(null);
  }

  const value = useMemo(
    () => ({
      token,
      artisan,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [token, artisan, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

