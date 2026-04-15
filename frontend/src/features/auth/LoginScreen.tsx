"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import type { AuthState } from "./useAuth";

interface LoginScreenProps {
  auth: AuthState;
}

export function LoginScreen({ auth }: LoginScreenProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/");
    }
  }, [auth.isAuthenticated, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      return;
    }

    try {
      await auth.login(username.trim(), password);
      router.replace("/");
    } catch {
      // handled in auth state
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        alignItems: "stretch",
        background:
          "linear-gradient(180deg, var(--color-surface-muted) 0%, var(--color-brand-soft) 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin: "0 auto",
          padding: "1.25rem 1rem",
          display: "grid",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <section
          style={{
            display: "grid",
            gap: "1rem",
            minHeight: "calc(100dvh - 2.5rem)",
          }}
          className="login-layout"
        >
          <div
            style={{
              display: "grid",
              gap: "1rem",
              alignContent: "center",
              padding: "1rem 0.25rem",
            }}
          >
            <span
              className="badge badge-brand"
              style={{ width: "fit-content" }}
            >
              Account access
            </span>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2rem, 7vw, 4.25rem)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.06em",
                  color: "var(--color-ink)",
                }}
              >
                Wildcard operations for every managed route.
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: "34rem",
                  fontSize: "1rem",
                  color: "var(--color-ink-secondary)",
                }}
              >
                Sign in with your assigned account. Admins can create users and
                oversee all routes. Standard users manage only the routes they
                own.
              </p>
            </div>
            <div className="login-highlights">
              <FeatureCard
                title="Session-secure"
                description="HTTP-only sessions replace the shared backend API key."
              />
              <FeatureCard
                title="Role-aware"
                description="Admin access and standard user access now follow separate permissions."
              />
              <FeatureCard
                title="Mongo-backed"
                description="Users, sessions, and route ownership live in MongoDB."
              />
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: "1.5rem",
              display: "grid",
              gap: "1.25rem",
              alignSelf: "center",
            }}
          >
            <div style={{ display: "grid", gap: "0.4rem" }}>
              <div
                style={{
                  width: "3rem",
                  height: "3rem",
                  borderRadius: "1rem",
                  background: "var(--color-brand-soft)",
                  display: "grid",
                  placeItems: "center",
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
                  <title>Secure login</title>
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                </svg>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.35rem",
                  letterSpacing: "-0.03em",
                  color: "var(--color-ink)",
                }}
              >
                Sign in
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--color-ink-secondary)",
                  fontSize: "0.9rem",
                }}
              >
                Use the credentials generated for your account.
              </p>
            </div>

            {auth.error && (
              <div
                role="alert"
                style={{
                  background: "var(--color-error-bg)",
                  border: "1px solid var(--color-error-border)",
                  color: "var(--color-error)",
                  borderRadius: "1rem",
                  padding: "0.85rem 1rem",
                  fontSize: "0.875rem",
                }}
              >
                {auth.error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: "grid", gap: "1rem" }}
              noValidate
            >
              <div>
                <label htmlFor="login-username" className="field-label">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  className="field-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  disabled={auth.isLoading}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="field-label">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="field-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={auth.isLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", height: "3rem", borderRadius: "999px" }}
                disabled={
                  auth.isLoading || !username.trim() || !password.trim()
                }
              >
                {auth.isLoading ? "Signing in..." : "Open dashboard"}
              </button>
            </form>
          </div>
        </section>
      </div>

      <style>{`
        .login-layout {
          grid-template-columns: 1fr;
        }

        .login-highlights {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }

        @media (min-width: 900px) {
          .login-layout {
            grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
            gap: 1.5rem;
          }

          .login-highlights {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1.2rem",
        padding: "1rem",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.3rem",
          fontSize: "0.95rem",
          color: "var(--color-ink)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "0.82rem",
          color: "var(--color-ink-secondary)",
        }}
      >
        {description}
      </p>
    </article>
  );
}
