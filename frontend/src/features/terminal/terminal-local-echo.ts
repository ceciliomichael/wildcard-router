"use client";

import type { Terminal } from "@xterm/xterm";

export interface LocalEchoState {
  pendingEcho: string;
  isEnabled: boolean;
  outputTail: string;
}

const ALTERNATE_SCREEN_ENTER_MARKERS = [
  "\u001b[?1047h",
  "\u001b[?1048h",
  "\u001b[?1049h",
];
const ALTERNATE_SCREEN_EXIT_MARKERS = [
  "\u001b[?1047l",
  "\u001b[?1048l",
  "\u001b[?1049l",
];
const OPTIMISTIC_ECHO_OUTPUT_TAIL_LENGTH = 32;
const ESCAPE_CHARACTER = "\u001b";

export function createLocalEchoState(): LocalEchoState {
  return {
    isEnabled: true,
    pendingEcho: "",
    outputTail: "",
  };
}

function getTerminalControlSequenceEnd(
  chunk: string,
  index: number,
): number | null {
  if (chunk.charAt(index) !== ESCAPE_CHARACTER) {
    return null;
  }

  const nextCharacter = chunk.charAt(index + 1);
  if (nextCharacter.length === 0) {
    return chunk.length;
  }

  if (nextCharacter === "[") {
    for (let cursor = index + 2; cursor < chunk.length; cursor += 1) {
      const codePoint = chunk.charCodeAt(cursor);
      if (codePoint >= 0x40 && codePoint <= 0x7e) {
        return cursor + 1;
      }
    }

    return chunk.length;
  }

  if (nextCharacter === "]") {
    for (let cursor = index + 2; cursor < chunk.length; cursor += 1) {
      if (chunk.charCodeAt(cursor) === 0x07) {
        return cursor + 1;
      }

      if (
        chunk.charAt(cursor) === ESCAPE_CHARACTER &&
        chunk.charAt(cursor + 1) === "\\"
      ) {
        return cursor + 2;
      }
    }

    return chunk.length;
  }

  return Math.min(index + 2, chunk.length);
}

function isRenderableOutputCharacter(character: string): boolean {
  if (character.length !== 1) {
    return false;
  }

  const codePoint = character.codePointAt(0);
  if (codePoint == null) {
    return false;
  }

  return codePoint >= 32 && codePoint !== 127;
}

function isPrintableInputCharacter(character: string): boolean {
  if (character.length !== 1) {
    return false;
  }

  const codePoint = character.codePointAt(0);
  if (codePoint == null) {
    return false;
  }

  return codePoint >= 32 && codePoint !== 127;
}

export function writeOptimisticInputEcho(
  terminal: Terminal,
  state: LocalEchoState,
  data: string,
): void {
  if (!state.isEnabled || data.includes(ESCAPE_CHARACTER)) {
    return;
  }

  let echo = "";

  for (const character of data) {
    if (character === "\r" || character === "\n") {
      echo += "\r\n";
      continue;
    }

    if (isPrintableInputCharacter(character)) {
      echo += character;
    }
  }

  if (echo.length === 0) {
    return;
  }

  state.pendingEcho += echo;
  terminal.write(echo);
}

export function consumeOptimisticEcho(
  state: LocalEchoState,
  chunk: string,
): string {
  if (
    !state.isEnabled ||
    state.pendingEcho.length === 0 ||
    chunk.length === 0
  ) {
    return chunk;
  }

  const pendingEcho = state.pendingEcho;
  let consumedLength = 0;
  let cursor = 0;
  let filteredChunk = "";
  let shouldClearStaleEcho = false;

  while (cursor < chunk.length && consumedLength < pendingEcho.length) {
    const controlSequenceEnd = getTerminalControlSequenceEnd(chunk, cursor);
    if (controlSequenceEnd != null) {
      filteredChunk += chunk.slice(cursor, controlSequenceEnd);
      cursor = controlSequenceEnd;
      continue;
    }

    const character = chunk.charAt(cursor);
    if (character === pendingEcho.charAt(consumedLength)) {
      consumedLength += 1;
      cursor += 1;
      continue;
    }

    filteredChunk += character;
    cursor += 1;

    if (isRenderableOutputCharacter(character)) {
      shouldClearStaleEcho = true;
      break;
    }
  }

  if (consumedLength === 0) {
    if (shouldClearStaleEcho) {
      clearOptimisticEcho(state);
    }

    return chunk;
  }

  if (shouldClearStaleEcho) {
    clearOptimisticEcho(state);
  } else {
    state.pendingEcho = pendingEcho.slice(consumedLength);
  }

  return `${filteredChunk}${chunk.slice(cursor)}`;
}

export function clearOptimisticEcho(state: LocalEchoState): void {
  state.pendingEcho = "";
}

export function updateOptimisticEchoMode(
  state: LocalEchoState,
  chunk: string,
): void {
  if (chunk.length === 0) {
    return;
  }

  const combinedOutput = `${state.outputTail}${chunk}`;
  const hasEnterMarker = ALTERNATE_SCREEN_ENTER_MARKERS.some((marker) =>
    combinedOutput.includes(marker),
  );
  const hasExitMarker = ALTERNATE_SCREEN_EXIT_MARKERS.some((marker) =>
    combinedOutput.includes(marker),
  );

  let nextEnabled = state.isEnabled;
  if (hasEnterMarker) {
    nextEnabled = false;
  }
  if (hasExitMarker) {
    nextEnabled = true;
  }

  state.outputTail = combinedOutput.slice(-OPTIMISTIC_ECHO_OUTPUT_TAIL_LENGTH);

  if (nextEnabled === state.isEnabled) {
    return;
  }

  state.isEnabled = nextEnabled;
  clearOptimisticEcho(state);
}
