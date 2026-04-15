"use client";

import { AuthGate } from "../features/auth/AuthGate";
import { useAuth } from "../features/auth/useAuth";
import { DashboardShell } from "../features/dashboard/DashboardShell";

export default function RootPage() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <AuthGate auth={auth} />;
  }

  return <DashboardShell auth={auth} />;
}
