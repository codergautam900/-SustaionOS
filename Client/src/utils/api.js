const resolveDefaultBase = () => {
  if (import.meta.env.DEV) return "http://localhost:5000";
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
};

const API_BASE = (import.meta.env.VITE_API_URL || resolveDefaultBase()).replace(/\/$/, "");
const SOCKET_BASE = (import.meta.env.VITE_SOCKET_URL || API_BASE || resolveDefaultBase()).replace(/\/$/, "");

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
