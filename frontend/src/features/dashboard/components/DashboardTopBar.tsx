"use client";

interface DashboardTopBarProps {
  isOffline: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export function DashboardTopBar({
  isOffline,
  isRefreshing,
  onRefresh,
  onLogout,
}: DashboardTopBarProps) {
  return (
    <header
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              width: "1.875rem",
              height: "1.875rem",
              borderRadius: "0.625rem",
              background: "var(--color-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Wildcard Catcher</title>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: "700",
                fontSize: "0.9375rem",
                color: "var(--color-ink)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Wildcard Catcher
            </div>
            <span className="badge badge-brand dashboard-topbar-admin">
              Admin
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          <div
            className="dashboard-topbar-status"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.45rem",
              border: "1px solid var(--color-border)",
              borderRadius: "9999px",
              fontSize: "0.6875rem",
              lineHeight: 1,
              fontWeight: 600,
              color: isOffline ? "var(--color-error)" : "var(--color-success)",
              background: isOffline
                ? "var(--color-error-bg)"
                : "var(--color-success-bg)",
              minHeight: "1.75rem",
              minWidth: 0,
            }}
          >
            <span
              className={
                isOffline
                  ? "dashboard-topbar-status-dot dot dot-offline"
                  : "dashboard-topbar-status-dot dot dot-online"
              }
            />
            <span className="dashboard-topbar-status-text">
              {isOffline ? "Offline" : "Connected"}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh routes"
            title="Refresh"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                isRefreshing
                  ? { animation: "spin 0.7s linear infinite" }
                  : undefined
              }
            >
              <title>Refresh</title>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm dashboard-topbar-logout"
            onClick={onLogout}
            id="logout"
            aria-label="Logout"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Logout</title>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
      <style>{`
        .dashboard-topbar-admin {
          padding: 0.14rem 0.45rem;
          line-height: 1.1;
        }

        .dashboard-topbar-status-dot {
          width: 0.5rem;
          height: 0.5rem;
        }

        .dashboard-topbar-status-text {
          white-space: nowrap;
        }

        @media (max-width: 480px) {
          .dashboard-topbar-admin {
            display: none;
          }

          .dashboard-topbar-status {
            padding: 0.2rem 0.4rem;
          }

          .dashboard-topbar-logout {
            padding: 0 0.7rem;
          }

          .dashboard-topbar-logout span {
            display: none;
          }

          .dashboard-topbar-status-text {
            display: none;
          }

          .dashboard-topbar-status-dot {
            width: 0.4rem;
            height: 0.4rem;
          }
        }
      `}</style>
    </header>
  );
}
