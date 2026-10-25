import axios from "axios";

export const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE || "https://hiring-dev.internal.kloudspot.com";

const TOKEN_KEY = "cms_token";
const SITE_ID_KEY = "cms_site_id";
const http = axios.create({ baseURL: BACKEND });

export type DateRange = {
  fromUtc: number;
  toUtc: number;
};

export type Site = {
  siteId: string;
  name: string;
  timezone: string;
  country: string;
  city: string;
};

export type EntryExitRequest = DateRange & {
  page: number;
  size: number;
  pageNumber: number;
  pageSize: number;
};

type ApiErrorBody = {
  message?: unknown;
};

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string) => {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
};

export const getSiteId = () =>
  typeof window === "undefined" ? null : localStorage.getItem(SITE_ID_KEY);

export const setSiteId = (siteId: string) => {
  if (typeof window !== "undefined") localStorage.setItem(SITE_ID_KEY, siteId);
};

export const clearSiteId = () => {
  if (typeof window !== "undefined") localStorage.removeItem(SITE_ID_KEY);
};

export const clearToken = () => {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  clearSiteId();
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const message = error.response?.data?.message;
  return typeof message === "string" ? message : fallback;
};

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login") &&
      typeof window !== "undefined"
    ) {
      clearToken();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export const dayRange = (daysAgo = 0): DateRange => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);

  return {
    fromUtc: start.getTime(),
    toUtc:
      daysAgo === 0
        ? Date.now()
        : new Date(start.getTime() + 86400000 - 1).getTime(),
  };
};

export const pickNumber = (
  value: unknown,
  keys: readonly string[] = []
): number => {
  if (typeof value === "number") return value;
  if (!isRecord(value)) return 0;

  for (const key of keys) {
    if (typeof value[key] === "number") return value[key];
  }

  for (const nested of Object.values(value)) {
    const number = pickNumber(nested, keys);
    if (number !== 0) return number;
  }

  return 0;
};

export const pickArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of [
    "data",
    "series",
    "buckets",
    "records",
    "entries",
    "items",
    "rows",
    "result",
  ]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
    const items = pickArray(nested);
    if (items.length) return items;
  }

  return [];
};

export const fmtTime = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "-";

  const date = new Date(
    typeof value === "number" ? value : String(value)
  );
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const fmtDateTime = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "-";

  const date = new Date(
    typeof value === "number" ? value : String(value)
  );
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

export const fmtDwell = (minutes: unknown) => {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return "-";

  const hours = Math.floor(value / 60);
  const remainingMinutes = Math.round(value % 60);
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
};

export const fmtNumber = (value: unknown) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return "-";
  }

  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);

  return Number(number.toFixed(2)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

const getLoginToken = (data: unknown) => {
  if (!isRecord(data)) return null;

  const nestedData = isRecord(data.data) ? data.data : {};
  const token =
    data.token ??
    data.accessToken ??
    data.access_token ??
    nestedData.token ??
    nestedData.accessToken;

  return typeof token === "string" && token.length > 0 ? token : null;
};

export const login = async (email: string, password: string) => {
  const { data } = await http.post("/api/auth/login", { email, password });
  const token = getLoginToken(data);
  if (!token) throw new Error("No token in login response");
  return token;
};

export const getSites = async () =>
  (await http.get<Site[]>("/api/sites")).data;

const withSiteId = <T extends object>(payload: T): T & { siteId: string } => {
  const siteId = getSiteId();
  if (!siteId) throw new Error("Select a site before requesting analytics.");
  return { ...payload, siteId };
};

const postAnalytics = async <T extends object>(path: string, payload: T) =>
  (await http.post<unknown>(`/api/analytics/${path}`, withSiteId(payload))).data;

export const getDwell = (range: DateRange) =>
  postAnalytics("dwell", range);

export const getFootfall = (range: DateRange) =>
  postAnalytics("footfall", range);

export const getOccupancy = (range: DateRange) =>
  postAnalytics("occupancy", range);

export const getDemographics = (range: DateRange) =>
  postAnalytics("demographics", range);

export const getEntries = (
  range: DateRange,
  page: number,
  size: number
) => {
  const payload: EntryExitRequest = {
    ...range,
    page,
    size,
    pageNumber: page,
    pageSize: size,
  };
  return postAnalytics("entry-exit", payload);
};
