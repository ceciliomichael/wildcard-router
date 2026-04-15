const FALLBACK_BACKEND_API_BASE = "http://localhost:3067";

function trimTrailingSlash(pathname: string): string {
  if (pathname === "/") {
    return "";
  }
  return pathname.replace(/\/+$/g, "");
}

function stripKnownApiSuffix(pathname: string): string {
  const normalized = trimTrailingSlash(pathname);
  if (normalized.endsWith("/api/routes")) {
    return normalized.slice(0, -"/api/routes".length);
  }
  if (normalized.endsWith("/api")) {
    return normalized.slice(0, -"/api".length);
  }
  return normalized;
}

export function getBackendApiBase(): string {
  const configured =
    process.env.BACKEND_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE?.trim() ||
    FALLBACK_BACKEND_API_BASE;
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("Invalid backend API base URL");
  }
  const normalizedPath = stripKnownApiSuffix(parsed.pathname);
  return `${parsed.origin}${normalizedPath}`;
}

export function buildBackendRoutesUrl(
  pathSegments: string[],
  search: string,
): string {
  const base = getBackendApiBase();
  const suffix =
    pathSegments.length > 0
      ? `/${pathSegments.map((part) => encodeURIComponent(part)).join("/")}`
      : "";
  return `${base}/api/routes${suffix}${search}`;
}
