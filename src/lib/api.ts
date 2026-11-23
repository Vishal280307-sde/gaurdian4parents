let memoryBearerToken: string | null = null;

export function setMemoryAuthToken(token: string | null): void {
  memoryBearerToken = token;
}

export function getMemoryAuthToken(): string | null {
  return memoryBearerToken;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 26_000, signal: externalSignal, ...fetchOpts } = options;
  const headers = new Headers(fetchOpts.headers || {});
  if (!headers.has("Content-Type") && fetchOpts.body && typeof fetchOpts.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (memoryBearerToken) {
    headers.set("Authorization", `Bearer ${memoryBearerToken}`);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const rawBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const targetUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `${rawBase}${url.startsWith("/") ? "" : "/"}${url}`;

  try {
    const res = await fetch(targetUrl, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
      credentials: "include",
    });

    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          data.error ||
            `API endpoint not found (404). Please ensure the Guardian backend server is running and VITE_API_BASE_URL is configured properly.`
        );
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (timedOut) {
      throw new Error("Request timed out while waiting for a response. Please try again.");
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request was cancelled.");
    }
    if (err instanceof TypeError) {
      throw new Error("Network connection failed. Please check your internet and try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
