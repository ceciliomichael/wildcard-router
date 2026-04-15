"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { type AuthState, useAuth } from "../auth/useAuth";

interface AuthenticatedPageProps {
  loadingLabel: string;
  requireAdmin?: boolean;
  unauthorizedRedirectTo?: string;
  redirectAuthenticatedTo?: (auth: AuthState) => string | null;
  children: (auth: AuthState) => ReactNode;
}

export function AuthenticatedPage({
  loadingLabel,
  requireAdmin = false,
  unauthorizedRedirectTo = "/",
  redirectAuthenticatedTo,
  children,
}: AuthenticatedPageProps) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    if (!auth.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (requireAdmin && auth.user?.role !== "admin") {
      router.replace(unauthorizedRedirectTo);
      return;
    }

    const redirectTarget = redirectAuthenticatedTo?.(auth);
    if (redirectTarget && redirectTarget !== pathname) {
      router.replace(redirectTarget);
    }
  }, [
    auth,
    pathname,
    redirectAuthenticatedTo,
    requireAdmin,
    router,
    unauthorizedRedirectTo,
  ]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return <LoadingScreen label={loadingLabel} />;
  }

  if (requireAdmin && auth.user?.role !== "admin") {
    return <LoadingScreen label={loadingLabel} />;
  }

  const redirectTarget = redirectAuthenticatedTo?.(auth);
  if (redirectTarget && redirectTarget !== pathname) {
    return <LoadingScreen label={loadingLabel} />;
  }

  return <>{children(auth)}</>;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--color-surface-muted)",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{ padding: "1.5rem 1.75rem", minWidth: "280px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "var(--color-ink-secondary)",
          }}
        >
          <div
            style={{
              width: "1rem",
              height: "1rem",
              borderRadius: "999px",
              border: "2px solid var(--color-brand-soft)",
              borderTopColor: "var(--color-brand)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span>{label}</span>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </main>
  );
}
