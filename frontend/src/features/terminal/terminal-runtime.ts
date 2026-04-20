"use client";

interface TerminalSize {
  cols: number;
  rows: number;
}

type OutputListener = (chunk: string) => void;
type ErrorListener = (message: string) => void;
type ConnectionListener = (isConnected: boolean) => void;
type ExitListener = () => void;

interface TerminalRuntime {
  buffer: string;
  connectionListeners: Set<ConnectionListener>;
  connectionErrorTimer: ReturnType<typeof setTimeout> | null;
  errorListeners: Set<ErrorListener>;
  eventSource: EventSource | null;
  exitListeners: Set<ExitListener>;
  isFlushingInput: boolean;
  isConnected: boolean;
  hasExited: boolean;
  pendingInput: string[];
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
  release: () => void;
  resize: (size: TerminalSize) => void;
  sendInput: (data: string) => void;
  subscribeConnection: (listener: ConnectionListener) => () => void;
  subscribeError: (listener: ErrorListener) => () => void;
  subscribeExit: (listener: ExitListener) => () => void;
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 30 };
const CONNECTION_ERROR_DELAY_MS = 4_000;
const MAX_INPUT_CHUNK_LENGTH = 8_192;
const MAX_BUFFER_LENGTH = 1_000_000;
const TERMINAL_CONNECTION_ERROR_MESSAGE =
  "[terminal] Connection error. Check frontend server logs for terminal startup details.";
const TERMINAL_BUFFER_STORAGE_PREFIX = "wc_terminal_buffer:";

const runtimesBySessionId = new Map<string, TerminalRuntime>();

function getBufferStorageKey(sessionId: string): string {
  return `${TERMINAL_BUFFER_STORAGE_PREFIX}${sessionId}`;
}

function readStoredBuffer(sessionId: string): string {
  try {
    const raw = window.localStorage.getItem(getBufferStorageKey(sessionId));
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

function storeBuffer(sessionId: string, value: string): void {
  try {
    window.localStorage.setItem(getBufferStorageKey(sessionId), value);
  } catch {
    // Ignore storage write failures.
  }
}

function clearStoredBuffer(sessionId: string): void {
  try {
    window.localStorage.removeItem(getBufferStorageKey(sessionId));
  } catch {
    // Ignore storage delete failures.
  }
}

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
    storeBuffer(runtime.sessionId, runtime.buffer);
    return;
  }

  runtime.buffer = runtime.buffer.slice(
    runtime.buffer.length - MAX_BUFFER_LENGTH,
  );
  storeBuffer(runtime.sessionId, runtime.buffer);
}

function emitConnection(runtime: TerminalRuntime, isConnected: boolean): void {
  runtime.isConnected = isConnected;
  if (isConnected && runtime.connectionErrorTimer) {
    clearTimeout(runtime.connectionErrorTimer);
    runtime.connectionErrorTimer = null;
  }

  if (isConnected) {
    void flushPendingInput(runtime);
  }

  for (const listener of runtime.connectionListeners) {
    listener(isConnected);
  }
}

function emitError(runtime: TerminalRuntime, message: string): void {
  for (const listener of runtime.errorListeners) {
    listener(message);
  }
}

function emitExit(runtime: TerminalRuntime): void {
  for (const listener of runtime.exitListeners) {
    listener();
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
  if (runtime.connectionErrorTimer) {
    clearTimeout(runtime.connectionErrorTimer);
    runtime.connectionErrorTimer = null;
  }
  emitConnection(runtime, false);
}

function scheduleConnectionError(runtime: TerminalRuntime): void {
  if (runtime.connectionErrorTimer) {
    return;
  }

  runtime.connectionErrorTimer = setTimeout(() => {
    runtime.connectionErrorTimer = null;
    if (!runtime.isConnected) {
      emitError(runtime, TERMINAL_CONNECTION_ERROR_MESSAGE);
    }
  }, CONNECTION_ERROR_DELAY_MS);
}

function splitInputIntoChunks(data: string): string[] {
  if (data.length <= MAX_INPUT_CHUNK_LENGTH) {
    return [data];
  }

  const chunks: string[] = [];
  for (let index = 0; index < data.length; index += MAX_INPUT_CHUNK_LENGTH) {
    chunks.push(data.slice(index, index + MAX_INPUT_CHUNK_LENGTH));
  }

  return chunks;
}

async function flushPendingInput(runtime: TerminalRuntime): Promise<void> {
  if (
    !runtime.isConnected ||
    runtime.isFlushingInput ||
    runtime.pendingInput.length === 0
  ) {
    return;
  }

  runtime.isFlushingInput = true;
  try {
    while (runtime.isConnected && runtime.pendingInput.length > 0) {
      const nextInput = runtime.pendingInput[0];
      if (typeof nextInput !== "string" || nextInput.length === 0) {
        runtime.pendingInput.shift();
        continue;
      }

      try {
        const response = await fetchJson("/api/terminal/input", {
          sessionId: runtime.sessionId,
          data: nextInput,
        });

        if (!response.ok) {
          break;
        }

        runtime.pendingInput.shift();
      } catch {
        break;
      }
    }
  } finally {
    runtime.isFlushingInput = false;

    if (runtime.isConnected && runtime.pendingInput.length > 0) {
      void flushPendingInput(runtime);
    }
  }
}

function queueTerminalInput(runtime: TerminalRuntime, data: string): void {
  if (data.length === 0) {
    return;
  }

  runtime.pendingInput.push(...splitInputIntoChunks(data));
  void flushPendingInput(runtime);
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

  eventSource.addEventListener("terminal-exit", () => {
    if (runtime.hasExited) {
      return;
    }

    runtime.hasExited = true;
    closeRuntime(runtime);
    emitExit(runtime);
  });

  eventSource.onerror = () => {
    if (runtime.hasExited) {
      return;
    }

    emitConnection(runtime, false);
    scheduleConnectionError(runtime);
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
    connectionErrorTimer: null,
    exitListeners: new Set<ExitListener>(),
    hasExited: false,
    isFlushingInput: false,
    pendingInput: [],
    outputListeners: new Set<OutputListener>(),
    errorListeners: new Set<ErrorListener>(),
    connectionListeners: new Set<ConnectionListener>(),
    isConnected: false,
    buffer: readStoredBuffer(sessionId),
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
      queueTerminalInput(runtime, data);
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
    subscribeExit(listener) {
      runtime.exitListeners.add(listener);
      return () => {
        runtime.exitListeners.delete(listener);
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
  runtime.exitListeners.clear();
  runtime.pendingInput.length = 0;
  runtime.buffer = "";
  clearStoredBuffer(sessionId);
  runtimesBySessionId.delete(sessionId);
}
