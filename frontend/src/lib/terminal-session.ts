import crypto from "node:crypto";

import { Client, type ClientChannel } from "ssh2";
import { requireTerminalSshTarget } from "./terminal-ssh-target";

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
      status: "missing_target";
      message: string;
    }
  | {
      status: "forbidden";
    };

type TerminalProcessOutputListener = (chunk: string) => void;
type TerminalSessionOutputListener = (event: TerminalOutputEvent) => void;
type TerminalExitListener = () => void;

interface TerminalOutputEvent {
  id: number;
  chunk: string;
}

interface TerminalProcess {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(listener: TerminalProcessOutputListener): void;
  onExit(listener: TerminalExitListener): void;
}

interface TerminalSession {
  id: string;
  ownerUserId: string;
  exitListeners: Set<TerminalExitListener>;
  process: TerminalProcess;
  listeners: Set<TerminalSessionOutputListener>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  lastActivityAt: number;
  nextEventId: number;
  outputBuffer: string;
  outputHistory: TerminalOutputEvent[];
  outputHistoryLength: number;
}

interface TerminalEventStreamOptions {
  lastEventId: number | null;
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
export const TERMINAL_OUTPUT_REPLAY_BUFFER_MAX_LENGTH = 1_000_000;

const TERMINAL_SSE_FRAME_MAX_LENGTH = 64 * 1024;
const TERMINAL_SSE_FLUSH_DELAY_MS = 8;

const textEncoder = new TextEncoder();
const terminalSessions = new Map<string, TerminalSession>();

function createSseEvent(
  event: string,
  data: string,
  eventId?: number,
): Uint8Array {
  const idLine = typeof eventId === "number" ? `id: ${eventId}\n` : "";
  return textEncoder.encode(`${idLine}event: ${event}\ndata: ${data}\n\n`);
}

class SshTerminalProcess implements TerminalProcess {
  private readonly client = new Client();
  private readonly dataListeners = new Set<TerminalProcessOutputListener>();
  private readonly exitListeners = new Set<TerminalExitListener>();
  private readonly pendingWrites: string[] = [];
  private channel: ClientChannel | null = null;
  private hasExited = false;

  constructor(
    target: ReturnType<typeof requireTerminalSshTarget>,
    dimensions: TerminalDimensions,
  ) {
    this.client.on("ready", () => {
      this.client.shell(
        {
          term: "xterm-256color",
          cols: dimensions.cols,
          rows: dimensions.rows,
        },
        (error, channel) => {
          if (error) {
            this.emitData(
              `\r\n[ssh] Failed to open shell: ${error.message}\r\n`,
            );
            this.kill();
            return;
          }

          this.channel = channel;
          for (const pendingWrite of this.pendingWrites) {
            this.channel.write(pendingWrite);
          }
          this.pendingWrites.length = 0;

          channel.on("data", (chunk: Buffer | string) => {
            this.emitData(
              typeof chunk === "string" ? chunk : chunk.toString("utf8"),
            );
          });

          channel.on("close", () => {
            this.handleExit();
          });
        },
      );
    });

    this.client.on(
      "keyboard-interactive",
      (_name, _instructions, _lang, prompts, finish) => {
        if (target.password) {
          finish(prompts.map(() => target.password ?? ""));
          return;
        }
        finish([]);
      },
    );

    this.client.on("error", (error) => {
      this.emitData(`\r\n[ssh] ${error.message}\r\n`);
      this.handleExit();
    });

    this.client.on("close", () => {
      this.handleExit();
    });

    this.client.connect({
      host: target.host,
      port: target.port ?? 22,
      username: target.username,
      password: target.password ?? undefined,
      tryKeyboard: true,
      readyTimeout: 20_000,
      // Production default for now: accept host key automatically.
      hostVerifier: () => true,
    });
  }

  write(data: string): void {
    if (this.hasExited) {
      return;
    }

    if (!this.channel) {
      this.pendingWrites.push(data);
      return;
    }

    this.channel.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.channel || this.hasExited) {
      return;
    }

    this.channel.setWindow(rows, cols, 0, 0);
  }

  kill(): void {
    if (this.hasExited) {
      return;
    }

    this.handleExit();
    this.channel?.close();
    this.client.end();
  }

  onData(listener: TerminalProcessOutputListener): void {
    this.dataListeners.add(listener);
  }

  onExit(listener: TerminalExitListener): void {
    this.exitListeners.add(listener);
  }

  private emitData(chunk: string): void {
    for (const listener of this.dataListeners) {
      listener(chunk);
    }
  }

  private handleExit(): void {
    if (this.hasExited) {
      return;
    }

    this.hasExited = true;
    for (const listener of this.exitListeners) {
      listener();
    }
  }
}

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

function createSseFrame(chunk: string, eventId?: number): Uint8Array {
  const idLine = typeof eventId === "number" ? `id: ${eventId}\n` : "";
  return textEncoder.encode(`${idLine}data: ${encodeBase64Chunk(chunk)}\n\n`);
}

function createSseComment(comment: string, eventId?: number): Uint8Array {
  const idLine = typeof eventId === "number" ? `id: ${eventId}\n` : "";
  return textEncoder.encode(`${idLine}: ${comment}\n\n`);
}

function appendTerminalOutputBuffer(
  session: TerminalSession,
  chunk: string,
): TerminalOutputEvent | null {
  if (chunk.length === 0) {
    return null;
  }

  const event: TerminalOutputEvent = {
    id: session.nextEventId,
    chunk,
  };
  session.nextEventId += 1;
  session.outputBuffer += chunk;
  session.outputHistory.push(event);
  session.outputHistoryLength += chunk.length;

  if (session.outputBuffer.length <= TERMINAL_OUTPUT_REPLAY_BUFFER_MAX_LENGTH) {
    return event;
  }

  const trimLength =
    session.outputBuffer.length - TERMINAL_OUTPUT_REPLAY_BUFFER_MAX_LENGTH;
  session.outputBuffer = session.outputBuffer.slice(trimLength);

  while (
    session.outputHistory.length > 0 &&
    session.outputHistoryLength > TERMINAL_OUTPUT_REPLAY_BUFFER_MAX_LENGTH
  ) {
    const removedEvent = session.outputHistory.shift();
    if (!removedEvent) {
      break;
    }
    session.outputHistoryLength -= removedEvent.chunk.length;
  }

  return event;
}

function enqueueSseFrame(
  controller: ReadableStreamDefaultController<Uint8Array>,
  frame: Uint8Array,
): boolean {
  try {
    controller.enqueue(frame);
    return true;
  } catch {
    return false;
  }
}

function enqueueTerminalOutput(
  controller: ReadableStreamDefaultController<Uint8Array>,
  chunk: string,
  eventId?: number,
): boolean {
  for (
    let index = 0;
    index < chunk.length;
    index += TERMINAL_SSE_FRAME_MAX_LENGTH
  ) {
    const frame = createSseFrame(
      chunk.slice(index, index + TERMINAL_SSE_FRAME_MAX_LENGTH),
      eventId,
    );
    if (!enqueueSseFrame(controller, frame)) {
      return false;
    }
  }

  return true;
}

function notifyTerminalSessionExit(session: TerminalSession): void {
  for (const listener of session.exitListeners) {
    listener();
  }
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
  const target = requireTerminalSshTarget(ownerUserId);
  const process = new SshTerminalProcess(target, dimensions);

  const session: TerminalSession = {
    id: sessionId,
    ownerUserId,
    exitListeners: new Set<TerminalExitListener>(),
    listeners: new Set<TerminalSessionOutputListener>(),
    cleanupTimer: null,
    lastActivityAt: Date.now(),
    nextEventId: 1,
    outputBuffer: "",
    outputHistory: [],
    outputHistoryLength: 0,
    process,
  };

  session.process.onData((chunk) => {
    touchSession(session);
    const event = appendTerminalOutputBuffer(session, chunk);
    if (!event) {
      return;
    }
    for (const listener of session.listeners) {
      listener(event);
    }
  });

  session.process.onExit(() => {
    notifyTerminalSessionExit(session);
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

    existing.process.resize(cols, rows);
    touchSession(existing);
    return { status: "ok", session: existing, created: false };
  }

  try {
    return {
      status: "ok",
      session: createTerminalSession(sessionId, ownerUserId, { cols, rows }),
      created: true,
    };
  } catch (error) {
    return {
      status: "missing_target",
      message:
        error instanceof Error
          ? error.message
          : "SSH target is not configured.",
    };
  }
}

export function createTerminalEventStream(
  session: TerminalSession,
  options: TerminalEventStreamOptions = { lastEventId: null },
): ReadableStream<Uint8Array> {
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let pendingOutputEvents: TerminalOutputEvent[] = [];
  let outputFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null;

  const clearHeartbeat = (): void => {
    if (!heartbeat) {
      return;
    }

    clearInterval(heartbeat);
    heartbeat = null;
  };

  const clearOutputFlushTimer = (): void => {
    if (!outputFlushTimer) {
      return;
    }

    clearTimeout(outputFlushTimer);
    outputFlushTimer = null;
  };

  function detachStream(shouldScheduleCleanup: boolean): void {
    clearHeartbeat();
    clearOutputFlushTimer();
    streamController = null;
    pendingOutputEvents = [];
    session.listeners.delete(forwardOutput);
    session.exitListeners.delete(forwardExit);

    if (shouldScheduleCleanup) {
      scheduleSessionCleanup(session);
    }
  }

  const flushOutput = (): void => {
    outputFlushTimer = null;
    if (!streamController || pendingOutputEvents.length === 0) {
      return;
    }

    const events = pendingOutputEvents;
    pendingOutputEvents = [];
    for (const event of events) {
      if (!enqueueTerminalOutput(streamController, event.chunk, event.id)) {
        detachStream(true);
        return;
      }
    }
  };

  const scheduleOutputFlush = (): void => {
    if (outputFlushTimer || !streamController) {
      return;
    }

    outputFlushTimer = setTimeout(flushOutput, TERMINAL_SSE_FLUSH_DELAY_MS);
  };

  const forwardOutput: TerminalSessionOutputListener = (event) => {
    if (!streamController) {
      return;
    }

    pendingOutputEvents.push(event);
    const pendingOutputLength = pendingOutputEvents.reduce(
      (totalLength, pendingEvent) => totalLength + pendingEvent.chunk.length,
      0,
    );
    if (pendingOutputLength >= TERMINAL_SSE_FRAME_MAX_LENGTH) {
      flushOutput();
      return;
    }

    scheduleOutputFlush();
  };
  const forwardExit: TerminalExitListener = () => {
    if (!streamController) {
      return;
    }

    flushOutput();
    const controller = streamController;
    if (!controller) {
      return;
    }

    const exitEventId = session.nextEventId;
    session.nextEventId += 1;
    enqueueSseFrame(
      controller,
      createSseEvent("terminal-exit", "exit", exitEventId),
    );

    detachStream(false);
    try {
      controller.close();
    } catch {
      // Ignore close races with an already closed stream.
    }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      session.listeners.add(forwardOutput);
      session.exitListeners.add(forwardExit);
      touchSession(session);

      controller.enqueue(createSseComment("connected"));
      if (options.lastEventId === null && session.outputBuffer.length > 0) {
        const latestOutputEventId = session.nextEventId - 1;
        if (
          !enqueueTerminalOutput(
            controller,
            session.outputBuffer,
            latestOutputEventId,
          )
        ) {
          detachStream(true);
          return;
        }
      }

      if (options.lastEventId !== null) {
        for (const event of session.outputHistory) {
          if (event.id <= options.lastEventId) {
            continue;
          }
          if (!enqueueTerminalOutput(controller, event.chunk, event.id)) {
            detachStream(true);
            return;
          }
        }
      }

      heartbeat = setInterval(() => {
        if (!streamController) {
          clearHeartbeat();
          return;
        }

        if (
          !enqueueSseFrame(streamController, createSseComment("keep-alive"))
        ) {
          detachStream(true);
        }
      }, 15_000);
    },
    cancel() {
      detachStream(true);
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

  session.process.write(data);
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
  session.process.resize(cols, rows);
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

  session.exitListeners.clear();
  session.listeners.clear();
  terminalSessions.delete(sessionId);
  session.process.kill();
}

export function destroyTerminalSessionsByOwner(ownerUserId: string): void {
  const sessionIds = [...terminalSessions.values()]
    .filter((session) => session.ownerUserId === ownerUserId)
    .map((session) => session.id);

  for (const sessionId of sessionIds) {
    destroyTerminalSession(sessionId);
  }
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
