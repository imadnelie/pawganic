import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api("/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    if (data?.requiresTwoFactor) {
      return { requiresTwoFactor: true, twoFactorToken: data.twoFactorToken };
    }
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const verifyTwoFactor = useCallback(async (twoFactorToken, code) => {
    const data = await api("/auth/verify-2fa", {
      method: "POST",
      body: { twoFactorToken, code },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, verifyTwoFactor, logout, refresh }),
    [user, loading, login, verifyTwoFactor, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
