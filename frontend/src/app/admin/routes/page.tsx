"use client";

import { AuthenticatedPage } from "../../../features/dashboard/AuthenticatedPage";
import { RoutesDashboardPage } from "../../../features/dashboard/pages/RoutesDashboardPage";

export default function AdminRoutesPage() {
  return (
    <AuthenticatedPage loadingLabel="Loading routes..." requireAdmin>
      {(auth) => <RoutesDashboardPage auth={auth} showOwner />}
    </AuthenticatedPage>
  );
}
