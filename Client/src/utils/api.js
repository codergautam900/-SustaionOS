const trimSlash = (value = "") => String(value || "").replace(/\/$/, "");

const getWindowOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return trimSlash(window.location.origin);
  }
  return "";
};

const isRenderOneLinkHost = () => {
  if (typeof window === "undefined") return false;
  const hostname = String(window.location?.hostname || "").toLowerCase();
  return hostname === "sustainos-api.onrender.com" || hostname.startsWith("sustainos-api-");
};

const resolveApiBase = () => {
  const currentOrigin = getWindowOrigin();
  const configuredBase = trimSlash(import.meta.env.VITE_API_URL || "");

  if (import.meta.env.DEV) return configuredBase || "http://localhost:5000";
  if (isRenderOneLinkHost() && currentOrigin) return currentOrigin;
  return configuredBase || currentOrigin;
};

const resolveSocketBase = () => {
  const currentOrigin = getWindowOrigin();
  const configuredBase = trimSlash(import.meta.env.VITE_SOCKET_URL || "");

  if (import.meta.env.DEV) return configuredBase || resolveApiBase();
  if (isRenderOneLinkHost() && currentOrigin) return currentOrigin;
  return configuredBase || resolveApiBase();
};

const API_BASE = resolveApiBase();
const SOCKET_BASE = resolveSocketBase();

export const getApiBase = () => API_BASE;
export const getSocketBase = () => SOCKET_BASE;
export const apiUrl = (path = "") => `${API_BASE}${path}`;

export const fetchJson = async (path, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1500, timeoutMs || 15000));

  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      signal: options.signal || controller.signal,
    });

    const raw = await response.text();
    let data = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please check that the backend is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};