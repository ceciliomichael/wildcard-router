"use client";

import { type FormEvent, useState } from "react";
import type { AuthState } from "./useAuth";

interface AuthGateProps {
  auth: AuthState;
}

export function AuthGate({ auth }: AuthGateProps) {
  const [value, setValue] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    await auth.login(value.trim());
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background:
          "linear-gradient(135deg, #f7f8fc 0%, #f0f2f7 60%, #edeef3 100%)",
      }}
    >
      {/* Wordmark */}
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "0.75rem",
          }}
        >
          <span
            style={{
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: "0.75rem",
              background: "var(--color-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Wildcard Catcher</title>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </span>
          <span
            style={{
              fontSize: "1.125rem",
              fontWeight: "700",
              color: "var(--color-ink)",
              letterSpacing: "-0.02em",
            }}
          >
            Wildcard Catcher
          </span>
        </div>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-ink-secondary)",
            margin: 0,
          }}
        >
          Route management dashboard
        </p>
      </div>

      {/* Lock card */}
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "2.75rem",
              height: "2.75rem",
              borderRadius: "0.875rem",
              background: "var(--color-brand-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Lock</title>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "1.125rem",
              fontWeight: "700",
              margin: "0 0 0.25rem",
              color: "var(--color-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Admin access
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-ink-secondary)",
              margin: 0,
            }}
          >
            Enter your API key to continue
          </p>
        </div>

        {auth.error && (
          <div
            role="alert"
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error-border)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              color: "var(--color-error)",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <title>Error</title>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {auth.error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="api-key" className="field-label">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              autoComplete="current-password"
              className="field-input"
              placeholder="Enter your API key…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={auth.isLoading}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={auth.isLoading || !value.trim()}
            style={{ width: "100%" }}
            id="auth-submit"
          >
            {auth.isLoading ? (
              <>
                <Spinner /> Verifying…
              </>
            ) : (
              <>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <title>Unlock</title>
                  <path d="M15 3a4 4 0 0 1 4 4v4H5V7a7 7 0 0 1 7-7z" />
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                </svg>
                Unlock dashboard
              </>
            )}
          </button>
        </form>
      </div>

      <p
        style={{
          marginTop: "1.5rem",
          fontSize: "0.75rem",
          color: "var(--color-ink-muted)",
          textAlign: "center",
        }}
      >
        Key stored in session only — cleared on tab close or logout.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{
        animation: "spin 0.7s linear infinite",
      }}
    >
      <title>Loading</title>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
