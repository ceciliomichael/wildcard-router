"use client";

import type { Route } from "../types";

interface RouteDetailsPanelProps {
  route: Route;
  onEdit: (route: Route) => void;
  onToggle: (route: Route) => void;
  onDelete: (route: Route) => void;
  onClose: () => void;
  isTogglingId: string | null;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: "600",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--color-ink-muted)",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          color: "var(--color-ink)",
          wordBreak: "break-all",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RouteDetailsPanel({
  route,
  onEdit,
  onToggle,
  onDelete,
  onClose,
  isTogglingId,
}: RouteDetailsPanelProps) {
  const isToggling = isTogglingId === route.id;

  return (
    <aside
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1rem",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: "600",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--color-ink-muted)",
              marginBottom: "0.125rem",
            }}
          >
            Route details
          </div>
          <div
            className="mono"
            style={{
              fontWeight: "700",
              color: "var(--color-ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {route.subdomain}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onClose}
          aria-label="Close panel"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <title>Close</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Panel body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            className={route.enabled ? "badge badge-enabled" : "badge badge-disabled"}
          >
            <span
              className={`dot ${route.enabled ? "dot-online" : "dot-muted"}`}
              style={{ width: "6px", height: "6px" }}
            />
            {route.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <DetailRow label="Subdomain">
          <span className="mono" style={{ fontWeight: "600" }}>
            {route.subdomain}
          </span>
        </DetailRow>

        <DetailRow label="Destination">
          <a
            href={route.destination}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--color-brand)",
              textDecoration: "none",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")
            }
          >
            {route.destination}
          </a>
        </DetailRow>

        {route.note && <DetailRow label="Note">{route.note}</DetailRow>}

        <DetailRow label="Last updated">{formatDate(route.updatedAt)}</DetailRow>
        <DetailRow label="Created">{formatDate(route.createdAt)}</DetailRow>
      </div>

      {/* Panel actions */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onEdit(route)}
          id={`edit-route-${route.id}`}
          style={{ flex: 1 }}
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
          Edit
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onToggle(route)}
          disabled={isToggling}
          id={`toggle-route-${route.id}`}
          style={{ flex: 1 }}
        >
          {isToggling ? (
            "…"
          ) : route.enabled ? (
            <>
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
              Disable
            </>
          ) : (
            <>
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
              Enable
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-icon btn-sm"
          onClick={() => onDelete(route)}
          id={`delete-route-${route.id}`}
          aria-label="Delete route"
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
    </aside>
  );
}
