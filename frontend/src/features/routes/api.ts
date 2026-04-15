import type { ApiError, Route, RoutePayload } from "./types";

const ROUTES_API_PATH = "/api/routes";

function buildHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`;
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as {
        error?: unknown;
        message?: unknown;
      } | null;
      if (body && typeof body.error === "string") {
        message = body.error.trim();
      } else if (body && typeof body.message === "string") {
        message = body.message.trim();
      }
    } else {
      const body = await res.text();
      if (body) message = body.trim();
    }
  } catch {
    // ignore
  }
  return { message, status: res.status };
}

export async function listRoutes(): Promise<Route[]> {
  const res = await fetch(ROUTES_API_PATH, {
    headers: buildHeaders(),
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  // Backend may return the registry wrapper or a plain array
  if (Array.isArray(data)) return data as Route[];
  if (Array.isArray(data?.routes)) return data.routes as Route[];
  return [];
}

export async function createRoute(payload: RoutePayload): Promise<Route> {
  const res = await fetch(ROUTES_API_PATH, {
    method: "POST",
    credentials: "include",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<Route>;
}

export async function updateRoute(
  id: string,
  payload: RoutePayload,
): Promise<Route> {
  const res = await fetch(`${ROUTES_API_PATH}/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<Route>;
}

export async function deleteRoute(id: string): Promise<void> {
  const res = await fetch(`${ROUTES_API_PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: buildHeaders(),
  });
  if (!res.ok) throw await parseError(res);
}
