"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { acquireTerminalRuntime } from "./terminal-runtime";

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

function areSizesEqual(left: TerminalSize, right: TerminalSize): boolean {
  return left.cols === right.cols && left.rows === right.rows;
}

export function TerminalPane({
  onExit,
  sessionId,
  isActive,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastKnownSizeRef = useRef<TerminalSize>({ cols: 0, rows: 0 });
  const isActiveRef = useRef(isActive);
  const hasRequestedExitRef = useRef(false);
  const onExitRef = useRef(onExit);

  onExitRef.current = onExit;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: false,
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const runtime = acquireTerminalRuntime(sessionId, {
      cols: terminal.cols,
      rows: terminal.rows,
    });

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

    fitAndResize();

    const outputAttachment = runtime.attachOutput((chunk) => {
      terminal.write(chunk);
    });
    if (outputAttachment.snapshot.length > 0) {
      terminal.write(outputAttachment.snapshot);
    }

    const unsubscribeConnection = runtime.subscribeConnection((connected) => {
      if (connected) {
        fitAndResize();
      }
    });
    const unsubscribeError = runtime.subscribeError((message) => {
      terminal.writeln("");
      terminal.writeln(`\u001b[31m${message}\u001b[0m`);
    });

    const unsubscribeExit = runtime.subscribeExit(() => {
      if (hasRequestedExitRef.current) {
        return;
      }

      hasRequestedExitRef.current = true;
      onExitRef.current(sessionId);
    });

    const inputDisposable = terminal.onData((data) => {
      runtime.sendInput(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAndResize();
    });
    resizeObserver.observe(container);

    const handleWindowResize = (): void => {
      fitAndResize();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      unsubscribeExit();
      unsubscribeError();
      unsubscribeConnection();
      outputAttachment.detach();
      runtime.release();
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
