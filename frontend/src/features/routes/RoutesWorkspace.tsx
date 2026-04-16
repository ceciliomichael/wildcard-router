"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { AuthState } from "../auth/useAuth";
import { createRoute, deleteRoute, listRoutes, updateRoute } from "./api";
import { RouteDetailsPanel } from "./components/RouteDetailsPanel";
import { StatusBanner } from "./components/StatusBanner";
import { SummaryStrip } from "./components/SummaryStrip";
import { RouteForm } from "./RouteForm";
import { RouteTable } from "./RouteTable";
import { filterReservedRoutes, RESERVED_ROUTE_SUBDOMAIN } from "./reserved";
import type { Route, RoutePayload } from "./types";

interface RoutesWorkspaceProps {
  auth: AuthState;
  showOwner: boolean;
}

export function RoutesWorkspace({ auth, showOwner }: RoutesWorkspaceProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null | "new">(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const hasFetchedRef = useRef(false);
  const handleUnauthorized = auth.handleUnauthorized;

  const fetchRoutes = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsFetching(true);
      } else {
        setIsRefreshing(true);
      }
      setFetchError(null);
      try {
        const data = await listRoutes();
        setRoutes(filterReservedRoutes(data));
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "status" in err &&
          Number((err as { status: unknown }).status) === 401
        ) {
          await handleUnauthorized();
          return;
        }

        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to fetch routes.";

        if (silent) {
          setBannerError(message);
        } else {
          setFetchError(message);
        }
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsFetching(false);
        }
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    if (!auth.user || hasFetchedRef.current) {
      return;
    }

    hasFetchedRef.current = true;
    void fetchRoutes();
  }, [auth.user, fetchRoutes]);

  async function handleSaveRoute(payload: RoutePayload) {
    setIsFormLoading(true);
    try {
      if (editingRoute && editingRoute !== "new") {
        const updated = await updateRoute(editingRoute.id, payload);
        if (
          payload.subdomain.trim().toLowerCase() === RESERVED_ROUTE_SUBDOMAIN
        ) {
          setRoutes((prev) => prev.filter((route) => route.id !== updated.id));
          if (selectedRoute?.id === updated.id) {
            setSelectedRoute(null);
          }
        } else {
          setRoutes((prev) =>
            prev.map((route) => (route.id === updated.id ? updated : route)),
          );
          if (selectedRoute?.id === updated.id) {
            setSelectedRoute(updated);
          }
        }
      } else {
        const created = await createRoute(payload);
        if (created.subdomain.toLowerCase() !== RESERVED_ROUTE_SUBDOMAIN) {
          setRoutes((prev) => [created, ...prev]);
        }
      }
      setEditingRoute(null);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        Number((err as { status: unknown }).status) === 401
      ) {
        await handleUnauthorized();
        return;
      }
      throw err;
    } finally {
      setIsFormLoading(false);
    }
  }

  async function handleToggle(route: Route) {
    setIsTogglingId(route.id);
    try {
      const updated = await updateRoute(route.id, {
        subdomain: route.subdomain,
        destination: route.destination,
        enabled: !route.enabled,
        insecureSkipTLSVerify: route.insecureSkipTLSVerify,
        note: route.note,
      });
      setRoutes((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      if (selectedRoute?.id === updated.id) {
        setSelectedRoute(updated);
      }
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        Number((err as { status: unknown }).status) === 401
      ) {
        await handleUnauthorized();
        return;
      }
      setBannerError("Failed to update route status.");
    } finally {
      setIsTogglingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingRoute) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteRoute(deletingRoute.id);
      setRoutes((prev) =>
        prev.filter((route) => route.id !== deletingRoute.id),
      );
      if (selectedRoute?.id === deletingRoute.id) {
        setSelectedRoute(null);
      }
      setDeletingRoute(null);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        Number((err as { status: unknown }).status) === 401
      ) {
        await handleUnauthorized();
        return;
      }
      setBannerError("Failed to delete route.");
      setDeletingRoute(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const existingSubdomains = routes.map((route) =>
    route.subdomain.toLowerCase(),
  );

  return (
    <>
      {fetchError && !isFetching ? (
        <StatusBanner
          message={`Backend unavailable. ${fetchError}`}
          kind="warning"
          onDismiss={() => setFetchError(null)}
        />
      ) : null}
      {bannerError ? (
        <StatusBanner
          message={bannerError}
          kind="error"
          onDismiss={() => setBannerError(null)}
        />
      ) : null}

      {!isFetching ? <SummaryStrip routes={routes} /> : null}

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
        {isFetching ? (
          <LoadingSkeleton />
        ) : (
          <RouteTable
            routes={routes}
            selectedId={selectedRoute?.id ?? null}
            onSelect={(route) =>
              setSelectedRoute((prev) => (prev?.id === route.id ? null : route))
            }
            onEdit={(route) => setEditingRoute(route)}
            onToggle={(route) => void handleToggle(route)}
            onDelete={(route) => setDeletingRoute(route)}
            onAdd={() => setEditingRoute("new")}
            isTogglingId={isTogglingId}
            showOwner={showOwner}
            onRefresh={() => void fetchRoutes(true)}
            isRefreshing={isRefreshing}
          />
        )}

        {selectedRoute && !isFetching ? (
          <RouteDetailsPanel
            route={selectedRoute}
            onEdit={(route) => setEditingRoute(route)}
            onToggle={(route) => void handleToggle(route)}
            onDelete={(route) => setDeletingRoute(route)}
            onClose={() => setSelectedRoute(null)}
            isTogglingId={isTogglingId}
            showOwner={showOwner}
          />
        ) : null}
      </div>

      {editingRoute !== null ? (
        <RouteForm
          initial={editingRoute === "new" ? null : editingRoute}
          existingSubdomains={
            editingRoute === "new"
              ? existingSubdomains
              : existingSubdomains.filter(
                  (subdomain) =>
                    subdomain !==
                    (editingRoute as Route).subdomain.toLowerCase(),
                )
          }
          onSubmit={handleSaveRoute}
          onClose={() => setEditingRoute(null)}
          isLoading={isFormLoading}
        />
      ) : null}

      {deletingRoute ? (
        <ConfirmDialog
          title="Delete route?"
          message={`This will permanently remove the subdomain "${deletingRoute.subdomain}" and its proxy configuration. This cannot be undone.`}
          confirmLabel="Delete route"
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeletingRoute(null)}
          isLoading={isDeleting}
        />
      ) : null}

      <style>{`
        @media (min-width: 768px) {
          .dashboard-content-grid.with-panel {
            grid-template-columns: minmax(0, 1fr) 320px;
          }
        }
      `}</style>
    </>
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
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            height: "2.5rem",
            borderRadius: "0.625rem",
            background:
              "linear-gradient(90deg, var(--color-surface-subtle) 25%, var(--color-brand-soft) 50%, var(--color-surface-subtle) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s ease-in-out infinite",
            animationDelay: `${index * 0.1}s`,
            opacity: 1 - index * 0.15,
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
