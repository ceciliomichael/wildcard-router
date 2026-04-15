import type { ApiError } from "../routes/types";
import type { AuthResponse, LoginPayload } from "./types";

const AUTH_API_BASE = "/api/auth";

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

export async function fetchCurrentUser(): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_API_BASE}/me`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AuthResponse;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_API_BASE}/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AuthResponse;
}

export async function logout(): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
}
