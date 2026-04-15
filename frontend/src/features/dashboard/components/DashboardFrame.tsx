"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AuthState } from "../../auth/useAuth";
import { getDashboardNavigation } from "../navigation";
import { DashboardTopBar } from "./DashboardTopBar";

interface DashboardFrameProps {
  auth: AuthState;
  topBarActions?: ReactNode;
  children: ReactNode;
}

export function DashboardFrame({
  auth,
  topBarActions,
  children,
}: DashboardFrameProps) {
  const pathname = usePathname();

  if (!auth.user) {
    return null;
  }

  const navigation = getDashboardNavigation(auth.user);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-muted)",
      }}
    >
      <DashboardTopBar
        user={auth.user}
        currentPath={pathname}
        navigation={navigation}
        actions={topBarActions}
        onLogout={auth.logout}
      />

      <main
        style={{
          flex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          width: "100%",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
