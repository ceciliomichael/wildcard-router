"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { activateTerminalRenderer } from "./terminal-renderer";
import { acquireTerminalRuntime } from "./terminal-runtime";
import { createTerminalWriteBuffer } from "./terminal-write-buffer";

interface TerminalSize {
  cols: number;
  rows: number;
}

interface TerminalPaneProps {
  onExit: (sessionId: string) => void;
  sessionId: string;
  isActive: boolean;
}

const TERMINAL_THEME = {
  background: "#000000",
  black: "#000000",
  blue: "#93c5fd",
  brightBlack: "#4b5563",
  brightBlue: "#bfdbfe",
  brightCyan: "#a5f3fc",
  brightGreen: "#bbf7d0",
  brightMagenta: "#d1d5db",
  brightRed: "#fda4af",
  brightWhite: "#ffffff",
  brightYellow: "#fde68a",
  cursor: "#e5e7eb",
  cyan: "#67e8f9",
  foreground: "#e5e7eb",
  green: "#86efac",
  magenta: "#d1d5db",
  red: "#fca5a5",
  selectionBackground: "rgba(255, 255, 255, 0.12)",
  white: "#e5e7eb",
  yellow: "#fcd34d",
};

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 30 };

interface LocalEchoState {
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

function writeOptimisticInputEcho(
  terminal: Terminal,
  state: LocalEchoState,
  data: string,
): void {
  if (!state.isEnabled || data.includes("\u001b")) {
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

function consumeOptimisticEcho(state: LocalEchoState, chunk: string): string {
  if (
    !state.isEnabled ||
    state.pendingEcho.length === 0 ||
    chunk.length === 0
  ) {
    return chunk;
  }

  const pendingEcho = state.pendingEcho;
  const maxLength = Math.min(pendingEcho.length, chunk.length);
  let matchedLength = 0;

  while (
    matchedLength < maxLength &&
    pendingEcho.charCodeAt(matchedLength) === chunk.charCodeAt(matchedLength)
  ) {
    matchedLength += 1;
  }

  if (matchedLength === 0) {
    return chunk;
  }

  state.pendingEcho = pendingEcho.slice(matchedLength);
  return chunk.slice(matchedLength);
}

function clearOptimisticEcho(state: LocalEchoState): void {
  state.pendingEcho = "";
}

function updateOptimisticEchoMode(state: LocalEchoState, chunk: string): void {
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

async function copyTextToClipboard(text: string): Promise<void> {
  if (text.length === 0) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback below for restricted clipboard permissions.
    }
  }

  const fallbackInput = document.createElement("textarea");
  fallbackInput.value = text;
  fallbackInput.setAttribute("readonly", "true");
  fallbackInput.style.position = "fixed";
  fallbackInput.style.top = "-9999px";
  fallbackInput.style.left = "-9999px";
  document.body.append(fallbackInput);
  fallbackInput.focus();
  fallbackInput.select();

  try {
    document.execCommand("copy");
  } finally {
    fallbackInput.remove();
  }
}

function getClipboardText(event: ClipboardEvent): string {
  return event.clipboardData?.getData("text/plain") ?? "";
}

function areSizesEqual(left: TerminalSize, right: TerminalSize): boolean {
  return left.cols === right.cols && left.rows === right.rows;
}

function getTerminalSize(terminal: Terminal): TerminalSize {
  if (terminal.cols > 0 && terminal.rows > 0) {
    return {
      cols: terminal.cols,
      rows: terminal.rows,
    };
  }

  return DEFAULT_TERMINAL_SIZE;
}

export function TerminalPane({
  onExit,
  sessionId,
  isActive,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const optimisticEchoRef = useRef<LocalEchoState>({
    isEnabled: true,
    pendingEcho: "",
    outputTail: "",
  });
  const lastKnownSizeRef = useRef<TerminalSize>({ cols: 0, rows: 0 });
  const isActiveRef = useRef(isActive);
  const onExitRef = useRef(onExit);

  onExitRef.current = onExit;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: false,
      convertEol: false,
      cols: DEFAULT_TERMINAL_SIZE.cols,
      cursorBlink: true,
      drawBoldTextInBrightColors: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      fontWeight: 400,
      fontWeightBold: 700,
      lineHeight: 1.25,
      rightClickSelectsWord: false,
      rows: DEFAULT_TERMINAL_SIZE.rows,
      scrollOnUserInput: true,
      scrollback: 10000,
      smoothScrollDuration: 0,
      theme: TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    const rendererActivation = activateTerminalRenderer(terminal);
    const outputWriter = createTerminalWriteBuffer(terminal);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch {
      // Ignore the first fit while the browser is still measuring layout.
    }

    const runtime = acquireTerminalRuntime(
      sessionId,
      getTerminalSize(terminal),
    );

    const sendResize = (size: TerminalSize): void => {
      if (areSizesEqual(lastKnownSizeRef.current, size)) {
        return;
      }

      lastKnownSizeRef.current = size;
      runtime.resize(size);
    };

    const fitAndResize = (): void => {
      const currentTerminal = terminalRef.current;
      const currentFitAddon = fitAddonRef.current;
      if (!currentTerminal || !currentFitAddon || !isActiveRef.current) {
        return;
      }

      try {
        currentFitAddon.fit();
        const size = {
          cols: currentTerminal.cols,
          rows: currentTerminal.rows,
        };
        if (size.cols > 0 && size.rows > 0) {
          sendResize(size);
        }
      } catch {
        // Ignore fit errors while the layout is settling.
      }
    };

    const scheduleFit = (): void => {
      window.requestAnimationFrame(() => {
        fitAndResize();
        window.setTimeout(fitAndResize, 50);
      });
    };

    scheduleFit();

    const outputAttachment = runtime.attachOutput((chunk) => {
      updateOptimisticEchoMode(optimisticEchoRef.current, chunk);
      const filteredChunk = consumeOptimisticEcho(
        optimisticEchoRef.current,
        chunk,
      );
      if (filteredChunk.length === 0) {
        return;
      }

      outputWriter.write(filteredChunk);
    });
    if (outputAttachment.snapshot.length > 0) {
      updateOptimisticEchoMode(
        optimisticEchoRef.current,
        outputAttachment.snapshot,
      );
      const filteredSnapshot = consumeOptimisticEcho(
        optimisticEchoRef.current,
        outputAttachment.snapshot,
      );
      if (filteredSnapshot.length > 0) {
        outputWriter.write(filteredSnapshot);
      }
    }

    const unsubscribeConnection = runtime.subscribeConnection((connected) => {
      if (connected) {
        fitAndResize();
      }
    });
    const unsubscribeExit = runtime.subscribeExit(() => {
      onExitRef.current(sessionId);
    });

    const inputDisposable = terminal.onData((data) => {
      writeOptimisticInputEcho(terminal, optimisticEchoRef.current, data);
      runtime.sendInput(data);
    });

    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      const selectedText = terminal.getSelection();
      if (selectedText.trim().length === 0) {
        terminal.focus();
        return;
      }

      void copyTextToClipboard(selectedText).finally(() => {
        terminal.clearSelection();
        terminal.focus();
      });
    };

    const handlePaste = (event: ClipboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      const text = getClipboardText(event);
      terminal.clearSelection();
      if (text.length > 0) {
        writeOptimisticInputEcho(terminal, optimisticEchoRef.current, text);
        runtime.sendInput(text);
      }
      terminal.focus();
    };

    container.addEventListener("contextmenu", handleContextMenu, true);
    container.addEventListener("paste", handlePaste, true);

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    resizeObserver.observe(container);
    if (container.parentElement) {
      resizeObserver.observe(container.parentElement);
    }

    const handleWindowResize = (): void => {
      fitAndResize();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      container.removeEventListener("contextmenu", handleContextMenu, true);
      container.removeEventListener("paste", handlePaste, true);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      unsubscribeExit();
      unsubscribeConnection();
      outputAttachment.detach();
      outputWriter.dispose();
      clearOptimisticEcho(optimisticEchoRef.current);
      optimisticEchoRef.current.isEnabled = true;
      optimisticEchoRef.current.outputTail = "";
      runtime.release();
      rendererActivation.dispose();
      terminal.dispose();
      fitAddonRef.current = null;
      terminalRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    isActiveRef.current = isActive;

    if (!isActive) {
      return;
    }

    const currentTerminal = terminalRef.current;
    const currentFitAddon = fitAddonRef.current;
    if (!currentTerminal || !currentFitAddon) {
      return;
    }

    try {
      currentFitAddon.fit();
      currentTerminal.focus();
      window.requestAnimationFrame(() => {
        try {
          currentFitAddon.fit();
          currentTerminal.focus();
        } catch {
          // Ignore activation fit errors.
        }
      });
    } catch {
      // Ignore activation fit errors.
    }
  }, [isActive]);

  return (
    <div
      aria-hidden={!isActive}
      className="workspace-terminal-host"
      style={{
        inset: 0,
        background: "#000000",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "0.25rem 0.5rem 0.5rem",
        minHeight: 0,
        minWidth: 0,
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? "auto" : "none",
        position: "absolute",
        visibility: isActive ? "visible" : "hidden",
      }}
    >
      <div
        ref={containerRef}
        style={{
          height: "100%",
          width: "100%",
        }}
      />
    </div>
  );
}
