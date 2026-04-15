"use client";

import type { ManagedUser } from "./types";

interface UserManagementPanelProps {
  users: ManagedUser[];
  isLoading: boolean;
  error: string | null;
  latestPassword: {
    userName: string;
    password: string;
  } | null;
  onAddUser: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function UserManagementPanel({
  users,
  isLoading,
  error,
  latestPassword,
  onAddUser,
  onRefresh,
  isRefreshing,
}: UserManagementPanelProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "1fr",
      }}
      className="admin-users-grid"
    >
      <article
        className="card"
        style={{
          padding: "1.25rem",
          background:
            "linear-gradient(180deg, var(--color-surface) 0%, var(--color-brand-soft) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <span
              className="badge badge-brand"
              style={{ width: "fit-content" }}
            >
              Admin controls
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: "1.2rem",
                letterSpacing: "-0.03em",
                color: "var(--color-ink)",
              }}
            >
              Manage user accounts
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--color-ink-secondary)",
                maxWidth: "34rem",
              }}
            >
              Create users, assign roles, and hand off generated passwords.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAddUser}
            >
              Add user
            </button>
          </div>
        </div>

        {latestPassword && (
          <div
            style={{
              marginTop: "1rem",
              borderRadius: "1rem",
              border: "1px solid var(--color-brand-border)",
              background: "var(--color-surface)",
              padding: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--color-ink-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Generated password
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--color-ink-secondary)",
              }}
            >
              {latestPassword.userName}
            </div>
            <div
              className="mono"
              style={{
                marginTop: "0.35rem",
                fontSize: "0.95rem",
                color: "var(--color-ink)",
              }}
            >
              {latestPassword.password}
            </div>
          </div>
        )}
      </article>

      <article className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{ margin: 0, fontSize: "1rem", color: "var(--color-ink)" }}
            >
              Users
            </h3>
            <p
              style={{
                margin: "0.15rem 0 0",
                fontSize: "0.8rem",
                color: "var(--color-ink-secondary)",
              }}
            >
              {users.length} managed account{users.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              margin: "1rem",
              borderRadius: "0.85rem",
              border: "1px solid var(--color-error-border)",
              background: "var(--color-error-bg)",
              color: "var(--color-error)",
              padding: "0.85rem 0.95rem",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div
            style={{ padding: "1.25rem", color: "var(--color-ink-secondary)" }}
          >
            Loading users...
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: "580px" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td className="mono">{user.username}</td>
                    <td>
                      <span className="badge badge-brand">{user.role}</span>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                      }).format(new Date(user.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <style>{`
        @media (min-width: 1024px) {
          .admin-users-grid {
            grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          }
        }
      `}</style>
    </section>
  );
}
