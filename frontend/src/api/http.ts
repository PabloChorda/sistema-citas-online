// src/api/http.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5001/api";

const getAccessToken = () =>
  localStorage.getItem("access_token") || localStorage.getItem("accessToken");

const getRefreshToken = () =>
  localStorage.getItem("refresh_token") || localStorage.getItem("refreshToken");

const setAccessToken = (t?: string | null) => {
  if (!t) return;
  localStorage.setItem("access_token", t);
  localStorage.setItem("accessToken", t);
};

const setRefreshToken = (t?: string | null) => {
  if (!t) return;
  localStorage.setItem("refresh_token", t);
  localStorage.setItem("refreshToken", t);
};

export const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userRole");
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
        try { detail = await res.text(); } catch {}
        throw new Error(`refresh_${res.status}${detail ? " - " + detail : ""}`);
      }
      const data = await res.json();
      const newAccess =
        data?.access_token || data?.accessToken || data?.token || null;
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
 * authFetch: añade Authorization y reintenta una vez si hay 401
 * haciendo refresh del access_token.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const url = typeof input === "string" ? input : (input as Request).url;
  const isRefreshCall = url.includes("/auth/refresh");

  const headers = new Headers(init.headers || {});
  const at = getAccessToken();
  if (at) headers.set("Authorization", `Bearer ${at}`);
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const doFetch = (h: Headers) =>
    fetch(input, {
      ...init,
      headers: h,
      credentials: init.credentials ?? "include",
    });

  let res = await doFetch(headers);

  if (res.status === 401 && !isRefreshCall) {
    try {
      await refreshAccessToken();
      const headers2 = new Headers(init.headers || {});
      const at2 = getAccessToken();
      if (at2) headers2.set("Authorization", `Bearer ${at2}`);
      if (!headers2.has("Content-Type") && init.method && init.method !== "GET") {
        headers2.set("Content-Type", "application/json");
      }
      res = await doFetch(headers2);
    } catch {
      clearTokens();
      return res; // deja que el caller decida (redirigir a /login, etc.)
    }
  }

  return res;
}

/**
 * apiClient: pequeño wrapper para usar authFetch y devolver JSON
 * o lanzar Error con un mensaje legible.
 */
export async function apiClient<T = any>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any,
  init?: RequestInit
): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, {
    method,
    body: body != null ? JSON.stringify(body) : undefined,
    ...init,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // puede ser 204 o respuesta vacía
  }

  if (!res.ok) {
    // intenta usar msg del backend si existe
    const msg = data?.msg || data?.error || res.statusText || "Request failed";
    throw new Error(`${method} ${path} ${res.status}: ${msg}`);
  }

  return data as T;
}

// Helpers JSON "simples" si los necesitas sueltos
export async function apiGetJson<T>(path: string): Promise<T> {
  return apiClient<T>(path, "GET");
}

export {
  API_BASE,
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
};
