import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./authStorage";
import { AUTH_REFRESH_ENDPOINT } from "../lib/endpoints";

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: false,
});

// ---- Attach Authorization on every request
api.interceptors.request.use((config) => {
  // auth
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isFormData) {
    if (config.headers) {
      delete (config.headers as any)["Content-Type"];
    }
  } else if (
    !config.headers?.["Content-Type"] &&
    ["post", "put", "patch"].includes((config.method || "").toLowerCase())
  ) {
    // for JSON bodies only; axios also does this automatically
    (config.headers as any)["Content-Type"] = "application/json";
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

    if (!resp || !original) {
      // network error or no config -> bubble up
      return Promise.reject(error);
    }

    // Do not try to refresh if this is the refresh call itself
    const originalUrl = (original.url || "").toString();
    const isAuthRefresh = originalUrl.endsWith("/api/auth/token/refresh/");

    if (resp.status === 401 && !original._retry && !isAuthRefresh) {
      original._retry = true;

      if (!refreshing) {
        refreshing = refreshAccess()
          .catch((e) => {
            clearTokens();
            throw e;
          })
          .finally(() => {
            // allow the next refresh attempt after this one completes
            setTimeout(() => (refreshing = null), 0);
          });
      }

      try {
        const newAccess = await refreshing;
        // Ensure the retried request carries the fresh token
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        // refresh failed -> propagate original error
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
