import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { setTokens, clearTokens, getAccessToken } from "../lib/authStorage";

type User = {
  id: string;
  username: string;
  roles: string[]; // e.g., ["superuser"] or ["institute_admin"]
  institute_id?: string; // used by your APIs
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  async function login(username: string, password: string) {
    const res = await api.post("/api/auth/token/", { username, password });
    setTokens({ access: res.data.access, refresh: res.data.refresh });
    // Fetch profile/claims
    const me = await api.get("/api/auth/me/");
    setUser(me.data as User);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  function hasRole(...roles: string[]) {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  }

  // try to hydrate session if a token exists
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    api
      .get("/api/auth/me/")
      .then((r) => setUser(r.data))
      .catch(() => clearTokens());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, hasRole, isAuthenticated: !!user }}
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
