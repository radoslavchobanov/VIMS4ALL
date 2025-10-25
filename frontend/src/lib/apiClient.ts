import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./authStorage";

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false, // we use Authorization header, not cookies
});

// ---- Attach Authorization on every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Single-flight refresh controller
let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token");
  // IMPORTANT: use bare axios to avoid interceptor recursion
  const url = (api.defaults.baseURL ?? "") + "/api/auth/token/refresh/";
  const res = await axios.post(
    url,
    { refresh },
    {
      withCredentials: false, // <— FIX: must be false unless you enable CORS credentials server-side
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    }
  );
  const nextAccess: string = res.data.access;
  const nextRefresh: string | undefined = res.data.refresh ?? refresh; // handle rotation or non-rotation
  setTokens({ access: nextAccess, refresh: nextRefresh });
  return nextAccess;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const resp = error.response;
    const original = error.config as RetriableConfig | undefined;

    if (!resp || !original) return Promise.reject(error);

    const status = resp.status;
    const url = (original.url || "").toString();
    const isAuthRefresh = url.endsWith("/api/auth/token/refresh/");

    if (status !== 401 || original._retry || isAuthRefresh) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshing) {
        refreshing = refreshAccess()
          .catch((e) => {
            clearTokens();
            throw e;
          })
          .finally(() => { refreshing = null; });
      }
      const newAccess = await refreshing;
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch {
      return Promise.reject(error);
    }
  }
);
