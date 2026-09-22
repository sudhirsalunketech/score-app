import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bindTokenStore } from '@/lib/api';
import { clearTokens, fetchMe, getAccessToken, getRefreshToken, login as doLogin, loginWithGoogle as doLoginWithGoogle, logout as doLogout, persistTokens, register as doRegister, verifyLoginOtp as doVerifyOtp } from '@/lib/auth';
import { setLocale, type Locale } from '@/i18n';
import type { User } from '@/types/api';

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (identifier: string, code: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bindTokenStore({
      getAccess: getAccessToken,
      getRefresh: getRefreshToken,
      setTokens: persistTokens,
      clear: clearTokens,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    const me = await fetchMe();
    setUser(me);
    if (me.locale === 'hi' || me.locale === 'mr' || me.locale === 'en') {
      setLocale(me.locale as Locale);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    await doLogin(email, password);
    await refreshUser();
  }, [refreshUser]);

  const loginWithOtp = useCallback(async (identifier: string, code: string) => {
    await doVerifyOtp(identifier, code);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    await doRegister(email, password, name, phone);
    await refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    await doLoginWithGoogle(credential);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await doLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user && getAccessToken()),
      login,
      loginWithOtp,
      loginWithGoogle,
      register,
      logout,
      refreshUser,
    }),
    [user, ready, login, loginWithOtp, loginWithGoogle, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
