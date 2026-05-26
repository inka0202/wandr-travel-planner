import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/api/axios';
import { TOKEN_KEY } from '@/lib/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: only call /auth/me if a token is actually present
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get('/auth/me')
      .then((r) => {
        if (!cancelled) setUser(r.data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for 401s fired by the axios interceptor
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const { data } = await api.post('/auth/register', { email, password, displayName });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the server call fails (token expired etc.), we still log out locally
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
