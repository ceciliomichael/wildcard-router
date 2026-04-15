"use client";

import type { AuthState } from "../../auth/useAuth";
import { UsersWorkspace } from "../../users/UsersWorkspace";
import { DashboardFrame } from "../components/DashboardFrame";

interface UsersDashboardPageProps {
  auth: AuthState;
}

export function UsersDashboardPage({ auth }: UsersDashboardPageProps) {
  return (
    <DashboardFrame auth={auth}>
      <UsersWorkspace auth={auth} />
    </DashboardFrame>
  );
}
