import type { ApiError, Route, RoutePayload } from "./types";

const ROUTES_API_PATH = "/api/routes";

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
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

export async function validateKey(apiKey: string): Promise<void> {
  const res = await fetch(ROUTES_API_PATH, {
    headers: buildHeaders(apiKey),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
}

export async function listRoutes(apiKey: string): Promise<Route[]> {
  const res = await fetch(ROUTES_API_PATH, {
    headers: buildHeaders(apiKey),
    cache: "no-store",
  });
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  // Backend may return the registry wrapper or a plain array
  if (Array.isArray(data)) return data as Route[];
  if (Array.isArray(data?.routes)) return data.routes as Route[];
  return [];
}

export async function createRoute(
  apiKey: string,
  payload: RoutePayload,
): Promise<Route> {
  const res = await fetch(ROUTES_API_PATH, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<Route>;
}

export async function updateRoute(
  apiKey: string,
  id: string,
  payload: RoutePayload,
): Promise<Route> {
  const res = await fetch(`${ROUTES_API_PATH}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<Route>;
}

export async function deleteRoute(apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${ROUTES_API_PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: buildHeaders(apiKey),
  });
  if (!res.ok) throw await parseError(res);
}
