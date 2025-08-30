// src/api/http.ts
// src/api/http.ts
const API_BASE: string = import.meta.env.VITE_API_BASE ?? "http://localhost:5001/api";

const getAccessToken = (): string | null =>
  localStorage.getItem("access_token") || localStorage.getItem("accessToken");

const getRefreshToken = (): string | null =>
  localStorage.getItem("refresh_token") || localStorage.getItem("refreshToken");

const setAccessToken = (t?: string | null): void => {
  if (!t) return;
  try {
    localStorage.setItem("access_token", t);
    localStorage.setItem("accessToken", t);
  } catch (e) {
    console.debug("setAccessToken: storage not available", e);
  }
};

const setRefreshToken = (t?: string | null): void => {
  if (!t) return;
  try {
    localStorage.setItem("refresh_token", t);
    localStorage.setItem("refreshToken", t);
  } catch (e) {
    console.debug("setRefreshToken: storage not available", e);
  }
};

export const clearTokens = (): void => {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refreshToken");
  } catch (e) {
    console.debug("clearTokens: storage not available", e);
  }
};

let refreshingPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshingPromise) return refreshingPromise;

  const rt = getRefreshToken();
  if (!rt) throw new Error("no_refresh_token");

  const url = `${API_BASE}/auth/refresh`;
  refreshingPromise = fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${rt}` },
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch (e) {
          console.debug("refreshAccessToken: cannot read body", e);
        }
        throw new Error(`refresh_${res.status}${detail ? " - " + detail : ""}`);
      }
      const data = (await res.json()) as { access_token?: string; accessToken?: string; token?: string };
      const newAccess = data?.access_token || data?.accessToken || data?.token || null;
      if (!newAccess) throw new Error("refresh_no_token");
      setAccessToken(newAccess);
      return newAccess;
    })
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
}

/**
 * authFetch: añade Authorization y reintenta una vez si hay 401 obteniendo
 * un nuevo access_token mediante refresh_token.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : (input as Request).url;
  const isRefreshCall = url.includes("/auth/refresh");

  const headers = new Headers(init.headers || {});
  const at = getAccessToken();
  if (at) headers.set("Authorization", `Bearer ${at}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const doFetch = (h: Headers) =>
    fetch(input, { ...init, headers: h, credentials: init.credentials ?? "include" });

  let res = await doFetch(headers);

  if (res.status === 401 && !isRefreshCall) {
    try {
      await refreshAccessToken();
      const headers2 = new Headers(init.headers || {});
      const at2 = getAccessToken();
      if (at2) headers2.set("Authorization", `Bearer ${at2}`);
      if (!headers2.has("Content-Type")) headers2.set("Content-Type", "application/json");
      res = await doFetch(headers2);
    } catch (e) {
      clearTokens();
      return res;
    }
  }

  return res;
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, { method: "GET" });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch (e) {
      console.debug("apiGetJson: cannot read error body", e);
    }
    throw new Error(`GET ${path} ${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export { API_BASE, setAccessToken, setRefreshToken, getAccessToken, getRefreshToken };
