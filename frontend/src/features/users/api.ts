import type { ApiError } from "../routes/types";
import type {
  CreateUserPayload,
  CreateUserResponse,
  ManagedUser,
  PasswordRotationResponse,
} from "./types";

const USERS_API_PATH = "/api/users";

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
      if (body) {
        message = body.trim();
      }
    }
  } catch {
    // ignore
  }
  return { message, status: res.status };
}

export async function listUsers(): Promise<ManagedUser[]> {
  const res = await fetch(USERS_API_PATH, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as { users?: ManagedUser[] };
  return Array.isArray(data.users) ? data.users : [];
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<CreateUserResponse> {
  const res = await fetch(USERS_API_PATH, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CreateUserResponse;
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${USERS_API_PATH}/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
}

export async function regenerateUserPassword(
  userId: string,
): Promise<PasswordRotationResponse> {
  const res = await fetch(`${USERS_API_PATH}/${userId}/password`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PasswordRotationResponse;
}
