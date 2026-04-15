"use client";

import { AuthenticatedPage } from "../features/dashboard/AuthenticatedPage";
import { RoutesDashboardPage } from "../features/dashboard/pages/RoutesDashboardPage";

export default function RootPage() {
  return (
    <AuthenticatedPage
      loadingLabel="Loading routes..."
      redirectAuthenticatedTo={(auth) =>
        auth.user?.role === "admin" ? "/admin/routes" : null
      }
    >
      {(auth) => <RoutesDashboardPage auth={auth} showOwner={false} />}
    </AuthenticatedPage>
  );
}
