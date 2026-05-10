"use client";

import type { Terminal } from "@xterm/xterm";

interface TerminalWriteBuffer {
  dispose: () => void;
  write: (chunk: string) => void;
}

const MAX_BATCH_LENGTH = 128 * 1024;

function takeBatch(chunks: string[], targetLength: number): string {
  let batch = "";

  while (chunks.length > 0 && batch.length < targetLength) {
    const nextChunk = chunks[0];
    if (!nextChunk) {
      chunks.shift();
      continue;
    }

    const remainingLength = targetLength - batch.length;
    if (nextChunk.length <= remainingLength) {
      batch += nextChunk;
      chunks.shift();
      continue;
    }

    batch += nextChunk.slice(0, remainingLength);
    chunks[0] = nextChunk.slice(remainingLength);
  }

  return batch;
}

export function createTerminalWriteBuffer(
  terminal: Terminal,
): TerminalWriteBuffer {
  const pendingChunks: string[] = [];
  let flushTimeoutId: number | null = null;
  let isDisposed = false;
  let isWriting = false;
  let pendingLength = 0;

  const cancelScheduledFlush = (): void => {
    if (flushTimeoutId === null) {
      return;
    }

    window.clearTimeout(flushTimeoutId);
    flushTimeoutId = null;
  };

  const scheduleFlush = (): void => {
    if (isDisposed || flushTimeoutId !== null) {
      return;
    }

    flushTimeoutId = window.setTimeout(flush, 0);
  };

  const finishWrite = (): void => {
    isWriting = false;
    if (pendingLength > 0) {
      scheduleFlush();
    }
  };

  function flush(): void {
    flushTimeoutId = null;
    if (isDisposed || isWriting || pendingLength === 0) {
      return;
    }

    const batch = takeBatch(pendingChunks, MAX_BATCH_LENGTH);
    pendingLength -= batch.length;

    if (batch.length === 0) {
      return;
    }

    isWriting = true;
    terminal.write(batch, finishWrite);
  }

  return {
    dispose() {
      isDisposed = true;
      cancelScheduledFlush();
      pendingChunks.length = 0;
      pendingLength = 0;
    },
    write(chunk) {
      if (isDisposed || chunk.length === 0) {
        return;
      }

      pendingChunks.push(chunk);
      pendingLength += chunk.length;
      scheduleFlush();
    },
  };
}
