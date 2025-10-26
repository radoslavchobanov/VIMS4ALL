import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { api } from "../lib/apiClient";
import { setTokens, clearTokens, getAccessToken } from "../lib/authStorage";
import { AUTH_TOKEN_ENDPOINT, AUTH_ME_ENDPOINT } from "../lib/endpoints";

type EmployeeFn = { id: string; name: string | null };
type EmployeeCard = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  function?: EmployeeFn | null;
  photo_url?: string | null;
};
type InstituteCard = {
  id: string;
  name?: string | null;
  abbr_name?: string | null;
  logo_url?: string | null;
  city?: string | null;
  country?: string | null;
};

type User = {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  institute_id?: string | null;
  employee_id?: string | null;
  employee?: EmployeeCard | null;
  institute?: InstituteCard | null;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  hasFunctionCode: (...codes: string[]) => boolean;
  refreshMe: (signal?: AbortSignal) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const hasRole = useCallback(
    (...roles: string[]) => {
      const mine = user?.roles ?? [];
      return roles.some((r) => mine.includes(r));
    },
    [user?.roles]
  );

  const login = useCallback(async (username: string, password: string) => {
    clearTokens();
    const { data } = await api.post(AUTH_TOKEN_ENDPOINT, {
      username,
      password,
    });
    setTokens({ access: data.access, refresh: data.refresh });
    const me = await api.get<User>(AUTH_ME_ENDPOINT);
    setUser(me.data);
  }, []);

  const refreshMe = useCallback(async (signal?: AbortSignal) => {
    const me = await api.get<User>(AUTH_ME_ENDPOINT, { signal });
    setUser(me.data);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const me = await api.get<User>(AUTH_ME_ENDPOINT, {
          signal: ctrl.signal,
        });
        setUser(me.data);
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      authReady,
      login,
      logout,
      hasRole,
      refreshMe,
    }),
    [user, authReady, login, logout, hasRole, refreshMe]
  );

  function hasFunctionCode(...codes: string[]) {
    if (!user) return false;
    // superuser bypass
    if (hasRole("superuser")) return true;

    const code =
      (user as any)?.employee?.function?.code ??
      (user as any)?.employee?.function_code; // tolerate legacy shapes
    if (!code) return false;

    const cur = String(code).trim().toLowerCase();
    return codes.some((c) => String(c).trim().toLowerCase() === cur);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authReady,
        login,
        logout,
        hasRole,
        hasFunctionCode,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
