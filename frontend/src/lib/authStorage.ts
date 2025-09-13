type Tokens = { access: string; refresh?: string };

let mem: Tokens | null = null;
const ACC = "vims:access";
const REF = "vims:refresh";

export function setTokens(t: Tokens) {
  mem = t;
  sessionStorage.setItem(ACC, t.access);
  if (t.refresh) sessionStorage.setItem(REF, t.refresh);
}
export function getAccessToken(): string | null {
  return mem?.access ?? sessionStorage.getItem(ACC);
}
export function getRefreshToken(): string | null {
  return mem?.refresh ?? sessionStorage.getItem(REF);
}
export function clearTokens() {
  mem = null;
  sessionStorage.removeItem(ACC);
  sessionStorage.removeItem(REF);
}
