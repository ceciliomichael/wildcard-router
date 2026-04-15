"use client";

import { AuthenticatedPage } from "../../../features/dashboard/AuthenticatedPage";
import { UsersDashboardPage } from "../../../features/dashboard/pages/UsersDashboardPage";

export default function AdminUsersPage() {
  return (
    <AuthenticatedPage loadingLabel="Loading users..." requireAdmin>
      {(auth) => <UsersDashboardPage auth={auth} />}
    </AuthenticatedPage>
  );
}
