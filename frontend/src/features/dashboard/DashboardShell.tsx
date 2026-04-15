"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { AuthState } from "../auth/useAuth";
import {
  createRoute,
  deleteRoute,
  listRoutes,
  updateRoute,
} from "../routes/api";
import { RouteDetailsPanel } from "../routes/components/RouteDetailsPanel";
import { StatusBanner } from "../routes/components/StatusBanner";
import { SummaryStrip } from "../routes/components/SummaryStrip";
import { RouteForm } from "../routes/RouteForm";
import { RouteTable } from "../routes/RouteTable";
import type { Route, RoutePayload } from "../routes/types";
import { DashboardPageHeader } from "./components/DashboardPageHeader";
import { DashboardTopBar } from "./components/DashboardTopBar";

interface DashboardShellProps {
  auth: AuthState;
}

export function DashboardShell({ auth }: DashboardShellProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null | "new">(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const apiKey = auth.apiKey as string;
  const hasFetchedRef = useRef(false);

  const fetchRoutes = useCallback(
    async (silent = false) => {
      if (!silent) setIsFetching(true);
      setFetchError(null);
      try {
        const data = await listRoutes(apiKey);
        setRoutes(data);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "status" in err &&
          (err as { status: number }).status === 401
        ) {
          auth.handleUnauthorized();
          return;
        }
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to fetch routes";
        if (silent) {
          setBannerError(msg);
        } else {
          setFetchError(msg);
        }
      } finally {
        setIsFetching(false);
      }
    },
    [apiKey, auth],
  );

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchRoutes();
    }
  }, [fetchRoutes]);

  async function handleSaveRoute(payload: RoutePayload) {
    setIsFormLoading(true);
    try {
      if (editingRoute && editingRoute !== "new") {
        const updated = await updateRoute(apiKey, editingRoute.id, payload);
        setRoutes((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        );
        if (selectedRoute?.id === updated.id) setSelectedRoute(updated);
      } else {
        const created = await createRoute(apiKey, payload);
        setRoutes((prev) => [created, ...prev]);
      }
      setEditingRoute(null);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 401
      ) {
        auth.handleUnauthorized();
        return;
      }
      throw err; // RouteForm will show the error
    } finally {
      setIsFormLoading(false);
    }
  }

  async function handleToggle(route: Route) {
    setIsTogglingId(route.id);
    try {
      const updated = await updateRoute(apiKey, route.id, {
        subdomain: route.subdomain,
        destination: route.destination,
        enabled: !route.enabled,
        note: route.note,
      });
      setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedRoute?.id === updated.id) setSelectedRoute(updated);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 401
      ) {
        auth.handleUnauthorized();
        return;
      }
      setBannerError("Failed to update route status.");
    } finally {
      setIsTogglingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingRoute) return;
    setIsDeleting(true);
    try {
      await deleteRoute(apiKey, deletingRoute.id);
      setRoutes((prev) => prev.filter((r) => r.id !== deletingRoute.id));
      if (selectedRoute?.id === deletingRoute.id) setSelectedRoute(null);
      setDeletingRoute(null);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 401
      ) {
        auth.handleUnauthorized();
        return;
      }
      setBannerError("Failed to delete route.");
      setDeletingRoute(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const existingSubdomains = routes.map((r) => r.subdomain.toLowerCase());

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
        isOffline={Boolean(fetchError)}
        isRefreshing={isFetching}
        onRefresh={() => fetchRoutes(true)}
        onLogout={auth.logout}
      />

      {/* Main content */}
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
        <DashboardPageHeader />

        {/* Banners */}
        {fetchError && !isFetching && (
          <StatusBanner
            message={`Backend unavailable — showing last known state. ${fetchError}`}
            kind="warning"
            onDismiss={() => setFetchError(null)}
          />
        )}
        {bannerError && (
          <StatusBanner
            message={bannerError}
            kind="error"
            onDismiss={() => setBannerError(null)}
          />
        )}

        {/* Summary strip */}
        {!isFetching && <SummaryStrip routes={routes} />}

        {/* Main grid */}
        <div
          className={
            selectedRoute
              ? "dashboard-content-grid with-panel"
              : "dashboard-content-grid"
          }
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "1fr",
          }}
        >
          {/* Route table */}
          {isFetching ? (
            <LoadingSkeleton />
          ) : (
            <RouteTable
              routes={routes}
              selectedId={selectedRoute?.id ?? null}
              onSelect={(r) =>
                setSelectedRoute((prev) => (prev?.id === r.id ? null : r))
              }
              onEdit={(r) => setEditingRoute(r)}
              onToggle={handleToggle}
              onDelete={(r) => setDeletingRoute(r)}
              onAdd={() => setEditingRoute("new")}
              isTogglingId={isTogglingId}
            />
          )}

          {/* Detail panel */}
          {selectedRoute && !isFetching && (
            <RouteDetailsPanel
              route={selectedRoute}
              onEdit={(r) => setEditingRoute(r)}
              onToggle={handleToggle}
              onDelete={(r) => setDeletingRoute(r)}
              onClose={() => setSelectedRoute(null)}
              isTogglingId={isTogglingId}
            />
          )}
        </div>
      </main>

      {/* Route form modal */}
      {editingRoute !== null && (
        <RouteForm
          initial={editingRoute === "new" ? null : editingRoute}
          existingSubdomains={
            editingRoute === "new"
              ? existingSubdomains
              : existingSubdomains.filter(
                  (s) => s !== (editingRoute as Route).subdomain.toLowerCase(),
                )
          }
          onSubmit={handleSaveRoute}
          onClose={() => setEditingRoute(null)}
          isLoading={isFormLoading}
        />
      )}

      {/* Delete confirm dialog */}
      {deletingRoute && (
        <ConfirmDialog
          title="Delete route?"
          message={`This will permanently remove the subdomain "${deletingRoute.subdomain}" and its proxy configuration. This cannot be undone.`}
          confirmLabel="Delete route"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingRoute(null)}
          isLoading={isDeleting}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .dashboard-content-grid.with-panel {
            grid-template-columns: minmax(0, 1fr) 300px;
          }
        }
      `}</style>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1rem",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: "2.5rem",
            borderRadius: "0.625rem",
            background: `linear-gradient(90deg, var(--color-surface-subtle) 25%, var(--color-surface-muted) 50%, var(--color-surface-subtle) 75%)`,
            backgroundSize: "200% 100%",
            animation: `shimmer 1.5s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
