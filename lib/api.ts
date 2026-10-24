import axios from "axios";

export const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE || "https://hiring-dev.internal.kloudspot.com";
export const TOKEN_KEY = "cms_token";
export const SITE_ID_KEY = "cms_site_id";

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const getSiteId = () =>
  typeof window === "undefined" ? null : localStorage.getItem(SITE_ID_KEY);
export const setSiteId = (siteId: string) => localStorage.setItem(SITE_ID_KEY, siteId);
export const clearSiteId = () => localStorage.removeItem(SITE_ID_KEY);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  clearSiteId();
};

export type Site = {
  siteId: string;
  name: string;
  timezone: string;
  country: string;
  city: string;
};

const http = axios.create({ baseURL: BACKEND });

http.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLogin = err?.config?.url?.includes("/auth/login");
    if (err?.response?.status === 401 && !isLogin && typeof window !== "undefined") {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/* ---------- time helpers ---------- */
// ASSUMPTION: body uses { fromUtc, toUtc } in epoch ms. Check Swagger and rename if needed.
export const dayRange = (daysAgo = 0) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = daysAgo === 0 ? new Date() : new Date(start.getTime() + 86400000 - 1);
  return { fromUtc: start.getTime(), toUtc: end.getTime() };
};

/* ---------- response normalisers (tolerant of different shapes) ---------- */
export const pickNumber = (obj: any, keys: string[] = []): number => {
  if (typeof obj === "number") return obj;
  if (!obj || typeof obj !== "object") return 0;
  for (const k of keys) if (typeof obj[k] === "number") return obj[k];
  for (const v of Object.values(obj)) {
    if (typeof v === "number") return v;
    if (v && typeof v === "object") {
      const n = pickNumber(v, keys);
      if (n) return n;
    }
  }
  return 0;
};

export const pickArray = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== "object") return [];
  for (const k of ["data", "series", "buckets", "records", "entries", "items", "rows", "result"]) {
    if (Array.isArray(res[k])) return res[k];
    if (res[k] && typeof res[k] === "object") {
      const inner = pickArray(res[k]);
      if (inner.length) return inner;
    }
  }
  return [];
};

export const fmtTime = (v: any) => {
  if (v === undefined || v === null || v === "") return "-";
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const fmtDateTime = (v: any) => {
  if (v === undefined || v === null || v === "") return "-";
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

// ASSUMPTION: dwell values are in minutes. Change here if Swagger says seconds/ms.
export const fmtDwell = (m: any) => {
  const n = Number(m);
  if (!isFinite(n) || n <= 0) return "-";
  const h = Math.floor(n / 60);
  const mm = Math.round(n % 60);
  return h ? `${h}h ${mm}m` : `${mm}m`;
};

/* ---------- API calls ---------- */
export const login = async (email: string, password: string) => {
  const { data } = await http.post("/api/auth/login", { email, password });
  const token =
    data?.token || data?.accessToken || data?.access_token || data?.data?.token || data?.data?.accessToken;
  if (!token) throw new Error("No token in login response");
  return token as string;
};

export const getSites = async () => (await http.get<Site[]>("/api/sites")).data;

const withSiteId = <T extends object>(params: T): T & { siteId: string } => {
  const siteId = getSiteId();
  if (!siteId) throw new Error("Select a site before requesting analytics.");
  return { ...params, siteId };
};

export const getDwell = async (range: any) =>
  (await http.post("/api/analytics/dwell", withSiteId(range))).data;
export const getFootfall = async (range: any) =>
  (await http.post("/api/analytics/footfall", withSiteId(range))).data;
export const getOccupancy = async (range: any) =>
  (await http.post("/api/analytics/occupancy", withSiteId(range))).data;
export const getDemographics = async (range: any) =>
  (await http.post("/api/analytics/demographics", withSiteId(range))).data;

// ASSUMPTION: pagination body { page, size }. Check Swagger (could be pageNumber/pageSize/limit/offset).
export const getEntries = async (range: any, page: number, size: number) =>
  (await http.post(
    "/api/analytics/entry-exit",
    withSiteId({ ...range, page, size, pageNumber: page, pageSize: size })
  )).data;
