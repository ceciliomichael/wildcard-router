"use client";

interface TerminalSize {
  cols: number;
  rows: number;
}

type OutputListener = (chunk: string) => void;
type ConnectionListener = (isConnected: boolean) => void;
type ExitListener = () => void;

interface TerminalRuntime {
  buffer: string;
  connectionListeners: Set<ConnectionListener>;
  eventSource: EventSource | null;
  exitListeners: Set<ExitListener>;
  isFlushingInput: boolean;
  isConnected: boolean;
  hasExited: boolean;
  pendingInput: string[];
  pendingInputFlushTimer: number | null;
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
  subscribeExit: (listener: ExitListener) => () => void;
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 30 };
const MAX_INPUT_BATCH_LENGTH = 16_384;
const INPUT_FLUSH_DELAY_MS = 10;
const MAX_BUFFER_LENGTH = 1_000_000;
const LEGACY_TERMINAL_BUFFER_STORAGE_PREFIX = "wc_terminal_buffer:";

const runtimesBySessionId = new Map<string, TerminalRuntime>();

function clearLegacyStoredBuffer(sessionId: string): void {
  try {
    window.localStorage.removeItem(
      `${LEGACY_TERMINAL_BUFFER_STORAGE_PREFIX}${sessionId}`,
    );
  } catch {
    // Ignore cleanup failures for stale browser-persisted terminal output.
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
    return;
  }

  runtime.buffer = runtime.buffer.slice(
    runtime.buffer.length - MAX_BUFFER_LENGTH,
  );
}

function emitConnection(runtime: TerminalRuntime, isConnected: boolean): void {
  runtime.isConnected = isConnected;

  if (isConnected) {
    void flushPendingInput(runtime);
  }

  for (const listener of runtime.connectionListeners) {
    listener(isConnected);
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
  clearPendingInputFlushTimer(runtime);
  emitConnection(runtime, false);
}

function splitInputIntoChunks(data: string): string[] {
  if (data.length <= MAX_INPUT_BATCH_LENGTH) {
    return [data];
  }

  const chunks: string[] = [];
  for (let index = 0; index < data.length; index += MAX_INPUT_BATCH_LENGTH) {
    chunks.push(data.slice(index, index + MAX_INPUT_BATCH_LENGTH));
  }

  return chunks;
}

function takePendingInputBatch(runtime: TerminalRuntime): string {
  let batch = "";

  while (
    runtime.pendingInput.length > 0 &&
    batch.length < MAX_INPUT_BATCH_LENGTH
  ) {
    const nextInput = runtime.pendingInput[0];
    if (typeof nextInput !== "string" || nextInput.length === 0) {
      runtime.pendingInput.shift();
      continue;
    }

    const remainingLength = MAX_INPUT_BATCH_LENGTH - batch.length;
    if (nextInput.length <= remainingLength) {
      batch += nextInput;
      runtime.pendingInput.shift();
      continue;
    }

    batch += nextInput.slice(0, remainingLength);
    runtime.pendingInput[0] = nextInput.slice(remainingLength);
  }

  return batch;
}

function clearPendingInputFlushTimer(runtime: TerminalRuntime): void {
  if (runtime.pendingInputFlushTimer === null) {
    return;
  }

  window.clearTimeout(runtime.pendingInputFlushTimer);
  runtime.pendingInputFlushTimer = null;
}

function scheduleInputFlush(runtime: TerminalRuntime): void {
  if (
    runtime.hasExited ||
    runtime.pendingInput.length === 0 ||
    runtime.isFlushingInput ||
    runtime.pendingInputFlushTimer !== null
  ) {
    return;
  }

  runtime.pendingInputFlushTimer = window.setTimeout(() => {
    runtime.pendingInputFlushTimer = null;
    void flushPendingInput(runtime);
  }, INPUT_FLUSH_DELAY_MS);
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
  let inputBatch = "";
  clearPendingInputFlushTimer(runtime);
  try {
    inputBatch = takePendingInputBatch(runtime);
    if (inputBatch.length === 0) {
      return;
    }

    const response = await fetchJson("/api/terminal/input", {
      sessionId: runtime.sessionId,
      data: inputBatch,
    });

    if (!response.ok) {
      if (shouldDropPendingInput(response.status)) {
        runtime.pendingInput.length = 0;
      } else {
        runtime.pendingInput.unshift(inputBatch);
      }
    }
  } catch {
    if (inputBatch.length > 0) {
      runtime.pendingInput.unshift(inputBatch);
    }
  } finally {
    runtime.isFlushingInput = false;

    if (runtime.isConnected && runtime.pendingInput.length > 0) {
      scheduleInputFlush(runtime);
    }
  }
}

function queueTerminalInput(runtime: TerminalRuntime, data: string): void {
  if (runtime.hasExited || data.length === 0) {
    return;
  }

  runtime.pendingInput.push(...splitInputIntoChunks(data));
  scheduleInputFlush(runtime);
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
  };

  runtime.eventSource = eventSource;
}

function createRuntime(
  sessionId: string,
  initialSize: TerminalSize,
): TerminalRuntime {
  clearLegacyStoredBuffer(sessionId);

  const runtime: TerminalRuntime = {
    sessionId,
    refCount: 0,
    eventSource: null,
    exitListeners: new Set<ExitListener>(),
    hasExited: false,
    isFlushingInput: false,
    pendingInput: [],
    pendingInputFlushTimer: null,
    outputListeners: new Set<OutputListener>(),
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

function shouldDropPendingInput(status: number): boolean {
  return status >= 400 && status < 500;
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
  runtime.connectionListeners.clear();
  runtime.exitListeners.clear();
  runtime.pendingInput.length = 0;
  clearPendingInputFlushTimer(runtime);
  runtime.buffer = "";
  clearLegacyStoredBuffer(sessionId);
  runtimesBySessionId.delete(sessionId);
}
