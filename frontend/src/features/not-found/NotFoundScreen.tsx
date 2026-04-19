"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";

export function NotFoundScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    const target = auth.isAuthenticated ? "/" : "/login";
    setSecondsLeft(3);

    const countdown = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    const redirect = window.setTimeout(() => {
      router.replace(target);
    }, 3000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [auth.isAuthenticated, auth.isLoading, router]);

  const destination = auth.isAuthenticated ? "routes" : "login";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "16px",
        background:
          "radial-gradient(circle at top, rgba(16, 16, 17, 0.08), transparent 32%), linear-gradient(180deg, var(--color-surface-muted) 0%, #fbfbfd 58%, #f6f7fa 100%)",
        color: "var(--color-ink)",
        lineHeight: 1.5,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        textAlign: "center",
      }}
    >
      <section
        style={{
          width: "min(100%, 36rem)",
          display: "grid",
          justifyItems: "center",
          gap: "0.8rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-muted)",
          }}
        >
          RouteGate
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.4rem, 8vw, 4.8rem)",
            lineHeight: 0.98,
            letterSpacing: "-0.06em",
            color: "var(--color-ink)",
            textWrap: "balance",
          }}
        >
          This page does not exist.
        </h1>
        {auth.isLoading ? (
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              color: "var(--color-ink-secondary)",
            }}
          >
            Checking your session.
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              color: "var(--color-ink-secondary)",
            }}
          >
            We could not find a page for this request.
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--color-ink-muted)",
          }}
        >
          {auth.isLoading ? (
            "Waiting before redirecting."
          ) : (
            <>
              Redirecting to {destination} in {secondsLeft}{" "}
              {secondsLeft === 1 ? "second" : "seconds"}.
            </>
          )}
        </p>
      </section>
    </main>
  );
}
