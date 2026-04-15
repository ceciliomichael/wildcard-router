"use client";

import { useMemo, useState } from "react";
import {
  CustomDropdown,
  type DropdownOption,
} from "../../components/CustomDropdown";
import type { Route } from "./types";

interface RouteTableProps {
  routes: Route[];
  selectedId: string | null;
  onSelect: (route: Route) => void;
  onEdit: (route: Route) => void;
  onToggle: (route: Route) => void;
  onDelete: (route: Route) => void;
  onAdd: () => void;
  isTogglingId: string | null;
}

type FilterState = "all" | "enabled" | "disabled";
type SortKey = "updatedAt" | "subdomain";
const sortOptions: DropdownOption<SortKey>[] = [
  { value: "updatedAt", label: "Latest" },
  { value: "subdomain", label: "A-Z" },
];

function formatRelative(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  } catch {
    return iso;
  }
}

function shortDest(destination: string): string {
  try {
    const u = new URL(destination);
    return u.hostname + (u.port ? `:${u.port}` : "");
  } catch {
    return destination;
  }
}

export function RouteTable({
  routes,
  selectedId,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
  onAdd,
  isTogglingId,
}: RouteTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [sort, setSort] = useState<SortKey>("updatedAt");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return routes
      .filter((r) => {
        if (filter === "enabled" && !r.enabled) return false;
        if (filter === "disabled" && r.enabled) return false;
        if (!q) return true;
        return (
          r.subdomain.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          (r.note ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === "subdomain") return a.subdomain.localeCompare(b.subdomain);
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [routes, search, filter, sort]);

  const toolbar = (
    <div
      style={{
        padding: "0.875rem 1rem",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        gap: "0.625rem",
        flexWrap: "wrap",
        alignItems: "center",
        background: "var(--color-surface-muted)",
      }}
    >
      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 160px", minWidth: 0 }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-ink-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "absolute",
            left: "0.7rem",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        >
          <title>Search</title>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="routes-search"
          type="search"
          className="field-input"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            paddingLeft: "2rem",
            height: "2.125rem",
            fontSize: "0.8125rem",
          }}
        />
      </div>

      {/* Filter pills */}
      <div
        style={{
          display: "flex",
          gap: "0.2rem",
          background: "var(--color-surface-subtle)",
          padding: "0.2rem",
          borderRadius: "0.75rem",
          border: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        {(["all", "enabled", "disabled"] as FilterState[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              fontSize: "0.75rem",
              fontWeight: "600",
              padding: "0.2rem 0.6rem",
              borderRadius: "0.5rem",
              border: "1px solid transparent",
              background: filter === f ? "var(--color-surface)" : "transparent",
              color:
                filter === f ? "var(--color-ink)" : "var(--color-ink-muted)",
              boxShadow: filter === f ? "var(--shadow-card)" : "none",
              transition: "all 0.15s",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <CustomDropdown
        ariaLabel="Sort routes"
        value={sort}
        options={sortOptions}
        onChange={setSort}
      />

      {/* Add */}
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onAdd}
        id="add-route"
        style={{ flexShrink: 0, marginLeft: "auto" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <title>Add</title>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add route
      </button>
    </div>
  );

  const footer = routes.length > 0 && (
    <div
      style={{
        padding: "0.5rem 1rem",
        borderTop: "1px solid var(--color-border)",
        fontSize: "0.75rem",
        color: "var(--color-ink-muted)",
        background: "var(--color-surface-muted)",
      }}
    >
      Showing {filtered.length} of {routes.length} route
      {routes.length !== 1 ? "s" : ""}
    </div>
  );

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1rem",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {toolbar}

      {filtered.length === 0 ? (
        <EmptyState
          hasRoutes={routes.length > 0}
          hasSearch={!!search}
          onAdd={onAdd}
          onClear={() => {
            setSearch("");
            setFilter("all");
          }}
        />
      ) : (
        <>
          {/* ── Mobile card list (< 640px) ── */}
          <div className="route-cards-mobile">
            {filtered.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={route.id === selectedId}
                isToggling={isTogglingId === route.id}
                onSelect={onSelect}
                onEdit={onEdit}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>

          {/* ── Desktop table (≥ 640px) ── */}
          <div className="route-table-desktop">
            <table className="data-table" style={{ minWidth: "520px" }}>
              <thead>
                <tr>
                  <th>Subdomain</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    isSelected={route.id === selectedId}
                    isToggling={isTogglingId === route.id}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {footer}

      <style>{`
        .route-cards-mobile { display: flex; flex-direction: column; }
        .route-table-desktop { display: none; }
        @media (min-width: 640px) {
          .route-cards-mobile { display: none; }
          .route-table-desktop { display: block; overflow-x: auto; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Mobile card component ────────────────────── */

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  isToggling: boolean;
  onSelect: (r: Route) => void;
  onEdit: (r: Route) => void;
  onToggle: (r: Route) => void;
  onDelete: (r: Route) => void;
}

function RouteCard({
  route,
  isSelected,
  isToggling,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: RouteCardProps) {
  return (
    <div
      onClick={() => onSelect(route)}
      style={{
        padding: "1rem",
        borderBottom: "1px solid var(--color-border)",
        background: isSelected
          ? "var(--color-surface-subtle)"
          : "var(--color-surface)",
        cursor: "pointer",
        transition: "background 0.1s",
        borderLeft: isSelected
          ? `3px solid var(--color-brand)`
          : "3px solid transparent",
      }}
    >
      {/* Top row: subdomain + status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginBottom: "0.375rem",
        }}
      >
        <span
          className="mono"
          style={{
            fontWeight: "700",
            fontSize: "0.9375rem",
            color: "var(--color-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {route.subdomain}
        </span>
        <span
          className={
            route.enabled ? "badge badge-enabled" : "badge badge-disabled"
          }
          style={{ flexShrink: 0 }}
        >
          <span
            className={`dot ${route.enabled ? "dot-online" : "dot-muted"}`}
            style={{ width: "6px", height: "6px" }}
          />
          {route.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {/* Destination */}
      <div
        className="mono"
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-ink-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "0.75rem",
        }}
        title={route.destination}
      >
        {shortDest(route.destination)}
      </div>

      {/* Bottom row: time + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--color-ink-muted)",
          }}
        >
          {formatRelative(route.updatedAt)}
        </span>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onEdit(route)}
            aria-label={`Edit ${route.subdomain}`}
            id={`edit-card-${route.id}`}
            title="Edit"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <title>Edit</title>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onToggle(route)}
            disabled={isToggling}
            aria-label={`${route.enabled ? "Disable" : "Enable"} ${route.subdomain}`}
            id={`toggle-card-${route.id}`}
            title={route.enabled ? "Disable" : "Enable"}
          >
            {isToggling ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: "spin 0.7s linear infinite" }}
              >
                <title>Loading</title>
                <path d="M21 12a9 9 0 1 1-9-9" />
              </svg>
            ) : route.enabled ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <title>Disable</title>
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <title>Enable</title>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: "var(--color-error)" }}
            onClick={() => onDelete(route)}
            aria-label={`Delete ${route.subdomain}`}
            id={`delete-card-${route.id}`}
            title="Delete"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <title>Delete</title>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Desktop table row ────────────────────────── */

interface RouteRowProps {
  route: Route;
  isSelected: boolean;
  isToggling: boolean;
  onSelect: (r: Route) => void;
  onEdit: (r: Route) => void;
  onToggle: (r: Route) => void;
  onDelete: (r: Route) => void;
}

function RouteRow({
  route,
  isSelected,
  isToggling,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: RouteRowProps) {
  return (
    <tr
      className={isSelected ? "selected" : ""}
      onClick={() => onSelect(route)}
      style={{ cursor: "pointer" }}
    >
      <td>
        <span
          className="mono"
          style={{ fontWeight: "600", color: "var(--color-ink)" }}
        >
          {route.subdomain}
        </span>
      </td>
      <td style={{ maxWidth: "200px" }}>
        <span
          className="mono"
          style={{
            color: "var(--color-ink-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
          title={route.destination}
        >
          {shortDest(route.destination)}
        </span>
      </td>
      <td>
        <span
          className={
            route.enabled ? "badge badge-enabled" : "badge badge-disabled"
          }
        >
          <span
            className={`dot ${route.enabled ? "dot-online" : "dot-muted"}`}
            style={{ width: "6px", height: "6px" }}
          />
          {route.enabled ? "Enabled" : "Disabled"}
        </span>
      </td>
      <td style={{ whiteSpace: "nowrap", color: "var(--color-ink-muted)" }}>
        {formatRelative(route.updatedAt)}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onEdit(route)}
            aria-label={`Edit ${route.subdomain}`}
            id={`edit-row-${route.id}`}
            title="Edit"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <title>Edit</title>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onToggle(route)}
            disabled={isToggling}
            aria-label={`${route.enabled ? "Disable" : "Enable"} ${route.subdomain}`}
            id={`toggle-row-${route.id}`}
            title={route.enabled ? "Disable" : "Enable"}
          >
            {isToggling ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: "spin 0.7s linear infinite" }}
              >
                <title>Loading</title>
                <path d="M21 12a9 9 0 1 1-9-9" />
              </svg>
            ) : route.enabled ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <title>Disable</title>
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <title>Enable</title>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: "var(--color-error)" }}
            onClick={() => onDelete(route)}
            aria-label={`Delete ${route.subdomain}`}
            id={`delete-row-${route.id}`}
            title="Delete"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <title>Delete</title>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Empty state ──────────────────────────────── */

interface EmptyStateProps {
  hasRoutes: boolean;
  hasSearch: boolean;
  onAdd: () => void;
  onClear: () => void;
}

function EmptyState({ hasRoutes, hasSearch, onAdd, onClear }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: "3rem 1.5rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "1rem",
          background: "var(--color-surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.25rem",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-ink-muted)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>No routes</title>
          <path d="M9 17H5a2 2 0 0 0-2 2" />
          <path d="M15 17h4a2 2 0 0 1 2 2" />
          <circle cx="12" cy="9" r="3" />
          <path d="M6.1 20a6 6 0 0 1 11.8 0" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: "700",
            color: "var(--color-ink)",
            marginBottom: "0.25rem",
          }}
        >
          {hasSearch || hasRoutes ? "No matching routes" : "No routes yet"}
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-ink-muted)",
            maxWidth: "280px",
          }}
        >
          {hasSearch || hasRoutes
            ? "Try adjusting your search or filter."
            : "Create your first subdomain proxy route to get started."}
        </div>
      </div>
      {hasSearch ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onAdd}
          id="empty-add-route"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <title>Add</title>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add first route
        </button>
      )}
    </div>
  );
}
