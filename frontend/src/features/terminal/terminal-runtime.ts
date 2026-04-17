"use client";

interface TerminalSize {
  cols: number;
  rows: number;
}

type OutputListener = (chunk: string) => void;
type ErrorListener = (message: string) => void;
type ConnectionListener = (isConnected: boolean) => void;

interface TerminalRuntime {
  buffer: string;
  connectionListeners: Set<ConnectionListener>;
  errorListeners: Set<ErrorListener>;
  eventSource: EventSource | null;
  isConnected: boolean;
  outputListeners: Set<OutputListener>;
  refCount: number;
  sessionId: string;
}

interface RuntimeOutputAttachment {
  detach: () => void;
  snapshot: string;
}

export interface TerminalRuntimeHandle {
  attachOutput: (listener: OutputListener) => RuntimeOutputAttachment;
  isConnected: () => boolean;
  release: () => void;
  resize: (size: TerminalSize) => void;
  sendInput: (data: string) => void;
  subscribeConnection: (listener: ConnectionListener) => () => void;
  subscribeError: (listener: ErrorListener) => () => void;
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 30 };
const MAX_BUFFER_LENGTH = 1_000_000;
const TERMINAL_CONNECTION_ERROR_MESSAGE =
  "[terminal] Connection error. Check frontend server logs for terminal startup details.";

const runtimesBySessionId = new Map<string, TerminalRuntime>();

function sanitizeTerminalSize(size: TerminalSize): TerminalSize {
  const cols = Number.isFinite(size.cols) ? Math.trunc(size.cols) : 0;
  const rows = Number.isFinite(size.rows) ? Math.trunc(size.rows) : 0;

  return {
    cols: cols > 0 ? cols : DEFAULT_TERMINAL_SIZE.cols,
    rows: rows > 0 ? rows : DEFAULT_TERMINAL_SIZE.rows,
  };
}

function decodeBase64Payload(payload: string): string {
  if (payload.length === 0) {
    return "";
  }

  const binaryString = window.atob(payload);
  const bytes = Uint8Array.from(binaryString, (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

function appendToRuntimeBuffer(runtime: TerminalRuntime, chunk: string): void {
  runtime.buffer += chunk;
  if (runtime.buffer.length <= MAX_BUFFER_LENGTH) {
    return;
  }

  runtime.buffer = runtime.buffer.slice(
    runtime.buffer.length - MAX_BUFFER_LENGTH,
  );
}

function emitConnection(runtime: TerminalRuntime, isConnected: boolean): void {
  runtime.isConnected = isConnected;
  for (const listener of runtime.connectionListeners) {
    listener(isConnected);
  }
}

function emitError(runtime: TerminalRuntime, message: string): void {
  for (const listener of runtime.errorListeners) {
    listener(message);
  }
}

function emitOutput(runtime: TerminalRuntime, chunk: string): void {
  appendToRuntimeBuffer(runtime, chunk);
  for (const listener of runtime.outputListeners) {
    listener(chunk);
  }
}

function closeRuntime(runtime: TerminalRuntime): void {
  runtime.eventSource?.close();
  runtime.eventSource = null;
  emitConnection(runtime, false);
}

function openRuntimeStream(runtime: TerminalRuntime, size: TerminalSize): void {
  closeRuntime(runtime);

  const sanitized = sanitizeTerminalSize(size);
  const eventSource = new EventSource(
    `/api/terminal/stream?sessionId=${encodeURIComponent(runtime.sessionId)}&cols=${sanitized.cols}&rows=${sanitized.rows}`,
  );

  eventSource.onopen = () => {
    emitConnection(runtime, true);
  };

  eventSource.onmessage = (event) => {
    const output = decodeBase64Payload(event.data);
    if (output.length > 0) {
      emitOutput(runtime, output);
    }
  };

  eventSource.onerror = () => {
    emitConnection(runtime, false);
    emitError(runtime, TERMINAL_CONNECTION_ERROR_MESSAGE);
  };

  runtime.eventSource = eventSource;
}

function createRuntime(
  sessionId: string,
  initialSize: TerminalSize,
): TerminalRuntime {
  const runtime: TerminalRuntime = {
    sessionId,
    refCount: 0,
    eventSource: null,
    outputListeners: new Set<OutputListener>(),
    errorListeners: new Set<ErrorListener>(),
    connectionListeners: new Set<ConnectionListener>(),
    isConnected: false,
    buffer: "",
  };

  openRuntimeStream(runtime, initialSize);
  return runtime;
}

function fetchJson(pathname: string, body: unknown): Promise<Response> {
  return fetch(pathname, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

export function acquireTerminalRuntime(
  sessionId: string,
  initialSize: TerminalSize,
): TerminalRuntimeHandle {
  const existing = runtimesBySessionId.get(sessionId);
  const runtime = existing ?? createRuntime(sessionId, initialSize);
  runtime.refCount += 1;

  if (!existing) {
    runtimesBySessionId.set(sessionId, runtime);
  }

  return {
    attachOutput(listener) {
      const snapshot = runtime.buffer;
      runtime.outputListeners.add(listener);
      return {
        snapshot,
        detach() {
          runtime.outputListeners.delete(listener);
        },
      };
    },
    isConnected() {
      return runtime.isConnected;
    },
    release() {
      runtime.refCount = Math.max(0, runtime.refCount - 1);
    },
    resize(size) {
      void fetchJson("/api/terminal/resize", {
        sessionId,
        ...sanitizeTerminalSize(size),
      }).catch(() => undefined);
    },
    sendInput(data) {
      if (!runtime.isConnected) {
        return;
      }

      void fetchJson("/api/terminal/input", {
        sessionId,
        data,
      }).catch(() => undefined);
    },
    subscribeConnection(listener) {
      runtime.connectionListeners.add(listener);
      return () => {
        runtime.connectionListeners.delete(listener);
      };
    },
    subscribeError(listener) {
      runtime.errorListeners.add(listener);
      return () => {
        runtime.errorListeners.delete(listener);
      };
    },
  };
}

export function disposeTerminalRuntime(sessionId: string): void {
  const runtime = runtimesBySessionId.get(sessionId);
  if (!runtime) {
    return;
  }

  closeRuntime(runtime);
  runtime.outputListeners.clear();
  runtime.errorListeners.clear();
  runtime.connectionListeners.clear();
  runtime.buffer = "";
  runtimesBySessionId.delete(sessionId);
}
