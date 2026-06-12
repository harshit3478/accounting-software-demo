const AUTH_API_SKIP_PATHS = [
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/logout",
  "/api/login",
];

let isLoggingOut = false;
let fetchInterceptorInstalled = false;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function shouldHandleAuthFailure(url: string): boolean {
  if (!url.includes("/api/")) return false;
  return !AUTH_API_SKIP_PATHS.some((path) => url.includes(path));
}

export function clearClientAuthSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0; samesite=lax";
}

export function forceLogoutAndRedirect() {
  if (typeof window === "undefined" || isLoggingOut) return;

  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/forgot-password") || path.startsWith("/reset-password")) {
    return;
  }

  isLoggingOut = true;
  clearClientAuthSession();

  void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});

  window.location.replace("/login");
}

export function handleUnauthorizedApiResponse(status: number, url: string) {
  if (status !== 401 && status !== 403) return;
  if (!shouldHandleAuthFailure(url)) return;

  forceLogoutAndRedirect();
}

export function installApiAuthInterceptor() {
  if (typeof window === "undefined" || fetchInterceptorInstalled) return;

  fetchInterceptorInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = getRequestUrl(args[0]);

    handleUnauthorizedApiResponse(response.status, url);

    return response;
  };
}

if (typeof window !== "undefined") {
  installApiAuthInterceptor();
}
