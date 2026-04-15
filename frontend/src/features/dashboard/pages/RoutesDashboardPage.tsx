"use client";

import type { AuthState } from "../../auth/useAuth";
import { RoutesWorkspace } from "../../routes/RoutesWorkspace";
import { DashboardFrame } from "../components/DashboardFrame";

interface RoutesDashboardPageProps {
  auth: AuthState;
  showOwner: boolean;
}

export function RoutesDashboardPage({
  auth,
  showOwner,
}: RoutesDashboardPageProps) {
  return (
    <DashboardFrame auth={auth}>
      <RoutesWorkspace auth={auth} showOwner={showOwner} />
    </DashboardFrame>
  );
}
