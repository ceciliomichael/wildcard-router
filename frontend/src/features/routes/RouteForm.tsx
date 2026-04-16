"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from "react";
import { Switch } from "../../components/Switch";
import type { Route, RoutePayload } from "./types";

interface RouteFormProps {
  initial?: Route | null;
  existingSubdomains: string[];
  onSubmit: (payload: RoutePayload) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function isValidUrl(value: string): boolean {
  try {
    const normalized = value.includes("://") ? value : `http://${value}`;
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isDnsSafe(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

export function RouteForm({
  initial,
  existingSubdomains,
  onSubmit,
  onClose,
  isLoading,
}: RouteFormProps) {
  const isEditing = initial != null;

  const [subdomain, setSubdomain] = useState(initial?.subdomain ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [insecureSkipTLSVerify, setInsecureSkipTLSVerify] = useState(
    initial?.insecureSkipTLSVerify ?? false,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  // Track touched state for inline validation
  const [touchedSub, setTouchedSub] = useState(false);
  const [touchedDest, setTouchedDest] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const subError = touchedSub
    ? !subdomain.trim()
      ? "Subdomain is required."
      : !isDnsSafe(subdomain.trim())
        ? "Must be a valid DNS label (letters, numbers, hyphens)."
        : !isEditing &&
            existingSubdomains.includes(subdomain.trim().toLowerCase())
          ? "Subdomain already exists."
          : null
    : null;

  const destError = touchedDest
    ? !destination.trim()
      ? "Destination is required."
      : !isValidUrl(destination.trim())
        ? "Must be a valid http:// or https:// URL, or a host:port like localhost:3068."
        : null
    : null;

  const isValid =
    subdomain.trim() !== "" &&
    isDnsSafe(subdomain.trim()) &&
    (isEditing ||
      !existingSubdomains.includes(subdomain.trim().toLowerCase())) &&
    isValidUrl(destination.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouchedSub(true);
    setTouchedDest(true);
    if (!isValid) return;
    setError(null);
    try {
      await onSubmit({
        subdomain: subdomain.trim().toLowerCase(),
        destination: destination.trim(),
        enabled,
        insecureSkipTLSVerify,
        note: note.trim() || undefined,
      });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save route.";
      setError(msg);
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
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: "700",
                margin: 0,
                color: "var(--color-ink)",
              }}
            >
              {isEditing ? "Edit route" : "Add new route"}
            </h2>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-ink-muted)",
                margin: "0.125rem 0 0",
              }}
            >
              {isEditing
                ? `Editing ${initial?.subdomain}`
                : "Set up a new subdomain proxy route"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <title>Close</title>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.125rem",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error-border)",
                borderRadius: "0.75rem",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                color: "var(--color-error)",
              }}
            >
              {error}
            </div>
          )}

          {/* Subdomain */}
          <div>
            <label htmlFor="route-subdomain" className="field-label">
              Subdomain <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <input
              id="route-subdomain"
              type="text"
              className={`field-input mono ${subError ? "error" : ""}`}
              placeholder="e.g. portfolio"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              onBlur={() => setTouchedSub(true)}
              disabled={isLoading}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {subError && <p className="field-error">{subError}</p>}
          </div>

          {/* Destination */}
          <div>
            <label htmlFor="route-destination" className="field-label">
              Destination URL{" "}
              <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <input
              id="route-destination"
              type="url"
              className={`field-input mono ${destError ? "error" : ""}`}
              placeholder="https://localhost:3000 or localhost:3000"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onBlur={() => setTouchedDest(true)}
              disabled={isLoading}
            />
            {destError && <p className="field-error">{destError}</p>}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.875rem 1rem",
              background: "var(--color-surface-muted)",
              borderRadius: "0.75rem",
              border: "1px solid var(--color-border)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "var(--color-ink)",
                }}
              >
                Skip upstream TLS verification
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-ink-muted)",
                  marginTop: "0.125rem",
                }}
              >
                Use for Proxmox or other HTTPS services with self-signed certs.
              </div>
            </div>
            <Switch
              checked={insecureSkipTLSVerify}
              disabled={isLoading}
              label="Skip upstream TLS verification"
              onChange={setInsecureSkipTLSVerify}
            />
          </div>

          {/* Enabled toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.875rem 1rem",
              background: "var(--color-surface-muted)",
              borderRadius: "0.75rem",
              border: "1px solid var(--color-border)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "var(--color-ink)",
                }}
              >
                Enable route
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-ink-muted)",
                  marginTop: "0.125rem",
                }}
              >
                Route will be active immediately
              </div>
            </div>
            <Switch
              checked={enabled}
              disabled={isLoading}
              label="Enable route"
              onChange={setEnabled}
            />
          </div>

          {/* Note */}
          <div>
            <label htmlFor="route-note" className="field-label">
              Note{" "}
              <span
                style={{ color: "var(--color-ink-muted)", fontWeight: 400 }}
              >
                (optional)
              </span>
            </label>
            <textarea
              id="route-note"
              className="field-textarea"
              placeholder="What does this route serve?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              gap: "0.625rem",
              justifyContent: "flex-end",
              paddingTop: "0.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isLoading}
              id="route-form-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !isValid}
              id="route-form-submit"
            >
              {isLoading
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save changes"
                  : "Create route"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
