export interface SshTerminalTarget {
  username: string;
  host: string;
  port: number | null;
}

interface TerminalTargetResponse {
  target: SshTerminalTarget | null;
  error?: string;
}

interface TerminalTargetMutationResponse {
  target?: SshTerminalTarget;
  ok?: boolean;
  error?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolveErrorMessage(
  fallbackMessage: string,
  payload: { error?: string } | null,
): string {
  return payload?.error && payload.error.length > 0
    ? payload.error
    : fallbackMessage;
}

export async function fetchSshTerminalTarget(): Promise<SshTerminalTarget | null> {
  const response = await fetch("/api/terminal/target", {
    method: "GET",
    cache: "no-store",
  });

  const payload = await parseJsonResponse<TerminalTargetResponse>(response);
  if (!response.ok) {
    throw new Error(
      resolveErrorMessage("Failed to load SSH terminal target.", payload),
    );
  }

  return payload?.target ?? null;
}

export async function saveSshTerminalTarget(input: {
  username: string;
  host: string;
  port: number | null;
  password: string | null;
}): Promise<SshTerminalTarget> {
  const response = await fetch("/api/terminal/target", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await parseJsonResponse<TerminalTargetMutationResponse>(response);
  if (!response.ok || !payload?.target) {
    throw new Error(
      resolveErrorMessage("Failed to configure SSH terminal target.", payload),
    );
  }

  return payload.target;
}

export async function clearSshTerminalTarget(): Promise<void> {
  const response = await fetch("/api/terminal/target", {
    method: "DELETE",
  });

  const payload = await parseJsonResponse<TerminalTargetMutationResponse>(response);
  if (!response.ok) {
    throw new Error(
      resolveErrorMessage("Failed to clear SSH terminal target.", payload),
    );
  }
}
