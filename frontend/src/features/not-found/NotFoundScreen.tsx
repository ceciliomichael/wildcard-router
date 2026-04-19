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
    <>
      <style jsx>{`
        .not-found-root {
          min-height: 100svh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 16px;
          text-align: center;
          color: var(--color-ink);
          line-height: 1.5;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top, rgba(16, 16, 17, 0.08), transparent 32%),
            linear-gradient(180deg, var(--color-surface-muted) 0%, #fbfbfd 58%, #f6f7fa 100%);
        }

        .shell {
          width: min(100%, 36rem);
          display: grid;
          justify-items: center;
          gap: 0.8rem;
        }

        .eyebrow {
          margin: 0;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-ink-muted);
        }

        .title {
          margin: 0;
          font-size: clamp(2.4rem, 8vw, 4.8rem);
          line-height: 0.98;
          letter-spacing: -0.06em;
          color: var(--color-ink);
          text-wrap: balance;
        }

        .body {
          margin: 0;
          font-size: 1rem;
          color: var(--color-ink-secondary);
        }

        .note {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-ink-muted);
        }

        @media (min-width: 640px) {
          .not-found-root {
            padding: 24px;
          }

          .shell {
            gap: 0.9rem;
          }
        }
      `}</style>

      <main className="not-found-root">
        <section className="shell" aria-labelledby="not-found-title">
          <p className="eyebrow">RouteGate</p>
          <h1 id="not-found-title" className="title">
            This page does not exist.
          </h1>
        {auth.isLoading ? (
          <p className="body">Checking your session.</p>
        ) : (
          <p className="body">We could not find a page for this request.</p>
        )}
          <p className="note">
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
    </>
  );
}
