import net from "node:net";

export interface TerminalSshTarget {
  username: string;
  host: string;
  port: number | null;
  password: string | null;
}

export interface TerminalSshTargetPublic {
  username: string;
  host: string;
  port: number | null;
}

export interface TerminalSshTargetInput {
  username: string;
  hostOrUrl: string;
  port?: number | null;
  password?: string | null;
}

const terminalSshTargets = new Map<string, TerminalSshTarget>();

function parsePort(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }

  return value;
}

function normalizeHostFromInput(rawHost: string): { host: string; port: number | null } {
  const trimmedHost = rawHost.trim();
  if (trimmedHost.length === 0) {
    throw new Error("Host is required.");
  }

  if (trimmedHost.includes("://")) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedHost);
    } catch {
      throw new Error("Host/link is not a valid URL.");
    }

    if (!parsedUrl.hostname || parsedUrl.hostname.trim().length === 0) {
      throw new Error("Host/link does not include a valid hostname.");
    }

    return {
      host: parsedUrl.hostname.trim(),
      port: parsedUrl.port ? parsePort(Number(parsedUrl.port)) : null,
    };
  }

  if (trimmedHost.includes("/") || trimmedHost.includes("@")) {
    throw new Error("Host must be a plain hostname/IP or URL.");
  }

  return { host: trimmedHost, port: null };
}

function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.length === 0) {
    throw new Error("Host is required.");
  }

  const bracketless = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  const ipVersion = net.isIP(bracketless);
  if (ipVersion === 4 || ipVersion === 6) {
    return bracketless;
  }

  if (bracketless.toLowerCase() === "localhost") {
    return "localhost";
  }

  const isValidHostname = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/.test(
    bracketless,
  );
  if (!isValidHostname) {
    throw new Error("Host must be a valid hostname or IP address.");
  }

  return bracketless.toLowerCase();
}

function normalizeUsername(rawUsername: string): string {
  const username = rawUsername.trim();
  if (username.length === 0) {
    throw new Error("Username is required.");
  }

  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username)) {
    throw new Error(
      "Username must be 1-64 chars and use only letters, numbers, dot, underscore, or dash.",
    );
  }

  return username;
}

function normalizePassword(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const password = value.trim();
  if (password.length === 0) {
    return null;
  }

  if (password.length > 256) {
    throw new Error("Password is too long.");
  }

  return password;
}

export function getTerminalSshTarget(userId: string): TerminalSshTarget | null {
  return terminalSshTargets.get(userId) ?? null;
}

export function getTerminalSshTargetPublic(
  userId: string,
): TerminalSshTargetPublic | null {
  const target = getTerminalSshTarget(userId);
  if (!target) {
    return null;
  }

  return {
    username: target.username,
    host: target.host,
    port: target.port,
  };
}

export function requireTerminalSshTarget(userId: string): TerminalSshTarget {
  const target = getTerminalSshTarget(userId);
  if (!target) {
    throw new Error(
      "SSH target is not configured. Connect with username and host before opening terminals.",
    );
  }

  return target;
}

export function setTerminalSshTarget(
  userId: string,
  input: TerminalSshTargetInput,
): TerminalSshTarget {
  const username = normalizeUsername(input.username);
  const parsedHost = normalizeHostFromInput(input.hostOrUrl);
  const normalizedHost = normalizeHost(parsedHost.host);
  const inputPort = parsePort(input.port);
  const password = normalizePassword(input.password);
  const port = inputPort ?? parsedHost.port ?? null;

  const target: TerminalSshTarget = {
    username,
    host: normalizedHost,
    port,
    password,
  };

  terminalSshTargets.set(userId, target);
  return target;
}

export function clearTerminalSshTarget(userId: string): void {
  terminalSshTargets.delete(userId);
}
