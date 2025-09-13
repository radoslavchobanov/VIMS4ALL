import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./authStorage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  withCredentials: false, // if you later move to httpOnly cookies
});

// Inject access token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh on 401 once
let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!refreshing) {
        refreshing = (async () => {
          const refresh = getRefreshToken();
          if (!refresh) throw error;
          const res = await axios.post(
            `${api.defaults.baseURL}/api/auth/token/refresh/`,
            { refresh },
            { withCredentials: true }
          );
          setTokens({ access: res.data.access, refresh: refresh }); // some backends return only access
        })()
          .catch((e) => {
            clearTokens();
            throw e;
          })
          .finally(() => (refreshing = null));
      }
      await refreshing;
      return api(original);
    }
    return Promise.reject(error);
  }
);
