import crypto from "node:crypto";

import pty from "node-pty";
import { resolveTerminalSpawnTarget } from "./terminal-target";

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

export type TerminalOperationResult = "ok" | "missing" | "forbidden";
export type TerminalOpenResult =
  | {
      status: "ok";
      session: TerminalSession;
      created: boolean;
    }
  | {
      status: "forbidden";
    };

type TerminalOutputListener = (chunk: string) => void;

interface TerminalSession {
  id: string;
  ownerUserId: string;
  pty: pty.IPty;
  listeners: Set<TerminalOutputListener>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  lastActivityAt: number;
}

export interface TerminalSessionCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

export const TERMINAL_SESSION_COOKIE = "wc_terminal_session";
export const TERMINAL_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;
export const DEFAULT_TERMINAL_COLUMNS = 120;
export const DEFAULT_TERMINAL_ROWS = 30;
export const TERMINAL_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const textEncoder = new TextEncoder();
const terminalSessions = new Map<string, TerminalSession>();

function sanitizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.trunc(value);
  if (rounded < 10 || rounded > 500) {
    return fallback;
  }

  return rounded;
}

function encodeBase64Chunk(chunk: string): string {
  return Buffer.from(chunk, "utf8").toString("base64");
}

function createSseFrame(chunk: string): Uint8Array {
  return textEncoder.encode(`data: ${encodeBase64Chunk(chunk)}\n\n`);
}

function createSseComment(comment: string): Uint8Array {
  return textEncoder.encode(`: ${comment}\n\n`);
}

function touchSession(session: TerminalSession): void {
  session.lastActivityAt = Date.now();
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
}

function scheduleSessionCleanup(session: TerminalSession): void {
  if (session.listeners.size > 0 || session.cleanupTimer) {
    return;
  }

  session.cleanupTimer = setTimeout(() => {
    const existing = terminalSessions.get(session.id);
    if (!existing || existing.listeners.size > 0) {
      return;
    }

    const idleFor = Date.now() - existing.lastActivityAt;
    if (idleFor < TERMINAL_IDLE_TIMEOUT_MS) {
      scheduleSessionCleanup(existing);
      return;
    }

    destroyTerminalSession(existing.id);
  }, TERMINAL_IDLE_TIMEOUT_MS);
}

function createTerminalSession(
  sessionId: string,
  ownerUserId: string,
  dimensions: TerminalDimensions,
): TerminalSession {
  const target = resolveTerminalSpawnTarget();
  let spawnedPty: pty.IPty;
  try {
    spawnedPty = pty.spawn(target.command, target.args, {
      cols: dimensions.cols,
      rows: dimensions.rows,
      cwd: target.cwd,
      name: "xterm-256color",
      env: target.env,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown terminal spawn error.";
    throw new Error(
      `Failed to spawn terminal process "${target.command} ${target.args.join(" ")}": ${errorMessage}`,
    );
  }

  const session: TerminalSession = {
    id: sessionId,
    ownerUserId,
    listeners: new Set<TerminalOutputListener>(),
    cleanupTimer: null,
    lastActivityAt: Date.now(),
    pty: spawnedPty,
  };

  session.pty.onData((chunk) => {
    touchSession(session);
    for (const listener of session.listeners) {
      listener(chunk);
    }
  });

  session.pty.onExit(() => {
    destroyTerminalSession(session.id);
  });

  terminalSessions.set(sessionId, session);
  return session;
}

function getExistingSession(sessionId: string): TerminalSession | null {
  return terminalSessions.get(sessionId) ?? null;
}

function getOrCreateTerminalSession(
  sessionId: string,
  ownerUserId: string,
  dimensions: TerminalDimensions,
): TerminalOpenResult {
  const cols = sanitizeDimension(dimensions.cols, DEFAULT_TERMINAL_COLUMNS);
  const rows = sanitizeDimension(dimensions.rows, DEFAULT_TERMINAL_ROWS);

  const existing = getExistingSession(sessionId);
  if (existing) {
    if (existing.ownerUserId !== ownerUserId) {
      return { status: "forbidden" };
    }

    existing.pty.resize(cols, rows);
    touchSession(existing);
    return { status: "ok", session: existing, created: false };
  }

  return {
    status: "ok",
    session: createTerminalSession(sessionId, ownerUserId, { cols, rows }),
    created: true,
  };
}

export function createTerminalEventStream(
  session: TerminalSession,
): ReadableStream<Uint8Array> {
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null;

  const forwardOutput: TerminalOutputListener = (chunk) => {
    streamController?.enqueue(createSseFrame(chunk));
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      session.listeners.add(forwardOutput);
      touchSession(session);

      controller.enqueue(createSseComment("connected"));

      heartbeat = setInterval(() => {
        controller.enqueue(createSseComment("keep-alive"));
      }, 15_000);
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }

      streamController = null;
      session.listeners.delete(forwardOutput);
      scheduleSessionCleanup(session);
    },
  });
}

export function openTerminalSession(
  sessionId: string,
  ownerUserId: string,
  dimensions: TerminalDimensions,
): TerminalOpenResult {
  return getOrCreateTerminalSession(sessionId, ownerUserId, dimensions);
}

export function writeTerminalInput(
  sessionId: string,
  ownerUserId: string,
  data: string,
): TerminalOperationResult {
  const session = getExistingSession(sessionId);
  if (!session) {
    return "missing";
  }

  if (session.ownerUserId !== ownerUserId) {
    return "forbidden";
  }

  session.pty.write(data);
  touchSession(session);
  return "ok";
}

export function resizeTerminalSession(
  sessionId: string,
  ownerUserId: string,
  dimensions: TerminalDimensions,
): TerminalOperationResult {
  const session = getExistingSession(sessionId);
  if (!session) {
    return "missing";
  }

  if (session.ownerUserId !== ownerUserId) {
    return "forbidden";
  }

  const cols = sanitizeDimension(dimensions.cols, DEFAULT_TERMINAL_COLUMNS);
  const rows = sanitizeDimension(dimensions.rows, DEFAULT_TERMINAL_ROWS);
  session.pty.resize(cols, rows);
  touchSession(session);
  return "ok";
}

export function destroyTerminalSession(sessionId: string): void {
  const session = terminalSessions.get(sessionId);
  if (!session) {
    return;
  }

  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }

  session.listeners.clear();
  terminalSessions.delete(sessionId);
  session.pty.kill();
}

export function hasTerminalSession(sessionId: string): boolean {
  return terminalSessions.has(sessionId);
}

export function createTerminalSessionId(): string {
  return crypto.randomUUID();
}

export function getTerminalSessionCookieOptions(): TerminalSessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TERMINAL_SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
