"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";

interface PasswordRevealDialogProps {
  title: string;
  userName: string;
  password: string;
  onClose: () => void;
}

export function PasswordRevealDialog({
  title,
  userName,
  password,
  onClose,
}: PasswordRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function handleOverlayKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    /* biome-ignore lint/a11y/useSemanticElements: backdrop click handling needs a non-semantic overlay wrapper */
    <div
      className="overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
    >
      <div
        className="modal"
        style={{ maxWidth: "460px", padding: "1.75rem" }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}
          >
            <div
              style={{
                width: "2.75rem",
                height: "2.75rem",
                borderRadius: "0.875rem",
                background: "var(--color-brand-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Password</title>
                <path d="M4 10V8a8 8 0 0 1 16 0v2" />
                <rect x="3" y="10" width="18" height="10" rx="2" />
                <path d="M12 14v2" />
              </svg>
            </div>

            <div>
              <div
                style={{
                  display: "grid",
                  gap: "0.1rem",
                  minWidth: 0,
                  textAlign: "left",
                }}
              >
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: "700",
                    margin: 0,
                    color: "var(--color-ink)",
                    lineHeight: 1.1,
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-ink-secondary)",
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  {userName}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          style={{
            position: "relative",
            width: "100%",
            padding: "0.65rem 2.25rem 0.65rem 1rem",
            borderRadius: "1rem",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.95rem",
            wordBreak: "break-all",
            marginBottom: "1rem",
            minHeight: "2.6rem",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
            textAlign: "left",
            color: "var(--color-ink)",
          }}
          type="button"
          onClick={handleCopy}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void handleCopy();
            }
          }}
          tabIndex={0}
          aria-label={copied ? "Password copied" : "Copy password"}
          title={copied ? "Copied" : "Copy password"}
        >
          {password}

          <span
            style={{
              position: "absolute",
              right: "0.55rem",
              top: "50%",
              transform: "translateY(-50%)",
              width: "1.1rem",
              height: "1.1rem",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-ink)",
              pointerEvents: "none",
            }}
          >
            {copied ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Copied</title>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Copy password</title>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </span>
        </button>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            style={{ flexShrink: 0 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
