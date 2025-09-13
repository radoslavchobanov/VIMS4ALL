// src/components/LoginBar.tsx
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export const LoginBar: React.FC = () => {
  const { login, logout, user, isAuthenticated } = useAuth();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(username.trim(), password);
      setU(""); setP("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (isAuthenticated) {
    return (
      <div className="w-full flex items-center justify-between bg-slate-100 px-4 py-2 border-b">
        <div>Signed in as <b>{user?.username}</b>{user?.institute_id ? ` · Inst: ${user.institute_id}` : ""}</div>
        <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full flex gap-2 items-center bg-slate-100 px-4 py-2 border-b">
      <input
        className="border rounded px-2 py-1 w-48"
        placeholder="Username"
        value={username}
        onChange={(e) => setU(e.target.value)}
        autoComplete="username"
      />
      <input
        className="border rounded px-2 py-1 w-48"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setP(e.target.value)}
        autoComplete="current-password"
      />
      <button
        disabled={loading}
        className="px-4 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {loading ? "…" : "Login"}
      </button>
      {err && <span className="text-red-600 text-sm ml-2">{err}</span>}
    </form>
  );
};
