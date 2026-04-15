"use client";

import {
  CustomDropdown,
  type DropdownOption,
} from "../../components/CustomDropdown";
import type { ManagedUser } from "./types";

interface UsersTableProps {
  users: ManagedUser[];
  totalCount: number;
  currentUserId: string | null;
  search: string;
  roleFilter: "all" | "admin" | "user";
  sortKey: "updatedAt" | "name";
  isRefreshing: boolean;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: "all" | "admin" | "user") => void;
  onSortKeyChange: (value: "updatedAt" | "name") => void;
  onRefresh: () => void;
  onAdd: () => void;
  onDelete: (user: ManagedUser) => void;
  onRegenerate: (user: ManagedUser) => void;
  isActionUserId: string | null;
}

const sortOptions: DropdownOption<"updatedAt" | "name">[] = [
  { value: "updatedAt", label: "Latest" },
  { value: "name", label: "Name" },
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

export function UsersTable({
  users,
  totalCount,
  currentUserId,
  search,
  roleFilter,
  sortKey,
  isRefreshing,
  onSearchChange,
  onRoleFilterChange,
  onSortKeyChange,
  onRefresh,
  onAdd,
  onDelete,
  onRegenerate,
  isActionUserId,
}: UsersTableProps) {
  const visibleCount = users.length;

  return (
    <>
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
              id="users-search"
              type="search"
              className="field-input"
              placeholder="Search…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              style={{
                paddingLeft: "2rem",
                height: "2.125rem",
                fontSize: "0.8125rem",
              }}
            />
          </div>

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
            {(["all", "admin", "user"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleFilterChange(role)}
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "0.5rem",
                  border: "1px solid transparent",
                  background:
                    roleFilter === role
                      ? "var(--color-surface)"
                      : "transparent",
                  color:
                    roleFilter === role
                      ? "var(--color-ink)"
                      : "var(--color-ink-muted)",
                  boxShadow:
                    roleFilter === role ? "var(--shadow-card)" : "none",
                  transition: "all 0.15s",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {role}
              </button>
            ))}
          </div>

          <CustomDropdown
            ariaLabel="Sort users"
            value={sortKey}
            options={sortOptions}
            onChange={onSortKeyChange}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <svg
              width="12"
              height="12"
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
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onAdd}
            style={{ flexShrink: 0 }}
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
            Add user
          </button>
        </div>

        <div
          style={{
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "0.75rem",
            color: "var(--color-ink-muted)",
            background: "var(--color-surface-muted)",
          }}
        >
          Showing {visibleCount} of {totalCount} user
          {totalCount === 1 ? "" : "s"}
        </div>

        {users.length === 0 ? (
          <EmptyState
            hasSearch={search.trim().length > 0}
            onClear={() => onSearchChange("")}
            onAdd={onAdd}
          />
        ) : (
          <>
            <div className="users-cards-mobile">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  currentUserId={currentUserId}
                  isActionUserId={isActionUserId}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                />
              ))}
            </div>

            <div className="users-table-desktop">
              <table className="data-table" style={{ minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      isActionUserId={isActionUserId}
                      onDelete={onDelete}
                      onRegenerate={onRegenerate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <style>{`
        .users-cards-mobile {
          display: flex;
          flex-direction: column;
        }

        .users-table-desktop {
          display: none;
        }

        @media (min-width: 640px) {
          .users-cards-mobile {
            display: none;
          }

          .users-table-desktop {
            display: block;
            overflow-x: auto;
          }
        }
      `}</style>
    </>
  );
}

interface UserCardProps {
  user: ManagedUser;
  currentUserId: string | null;
  isActionUserId: string | null;
  onDelete: (user: ManagedUser) => void;
  onRegenerate: (user: ManagedUser) => void;
}

function UserCard({
  user,
  currentUserId,
  isActionUserId,
  onDelete,
  onRegenerate,
}: UserCardProps) {
  const isCurrentUser = user.id === currentUserId;
  const busy = isActionUserId === user.id;

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
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
          style={{
            fontWeight: "700",
            fontSize: "0.9375rem",
            color: "var(--color-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user.name}
        </span>
        <span
          className={
            user.role === "admin" ? "badge badge-brand" : "badge badge-disabled"
          }
          style={{ flexShrink: 0 }}
        >
          {user.role}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-ink-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "0.5rem",
        }}
      >
        {user.username}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: "var(--color-ink-muted)" }}>
          {formatRelative(user.updatedAt)}
        </span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRegenerate(user);
            }}
            disabled={busy}
            aria-label={`Regenerate password for ${user.name}`}
            title="Regenerate password"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Regenerate</title>
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: "var(--color-error)" }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(user);
            }}
            disabled={busy || isCurrentUser}
            aria-label={`Delete ${user.name}`}
            title={isCurrentUser ? "Current account" : "Delete user"}
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
      </div>
    </div>
  );
}

interface UserRowProps {
  user: ManagedUser;
  currentUserId: string | null;
  isActionUserId: string | null;
  onDelete: (user: ManagedUser) => void;
  onRegenerate: (user: ManagedUser) => void;
}

function UserRow({
  user,
  currentUserId,
  isActionUserId,
  onDelete,
  onRegenerate,
}: UserRowProps) {
  const busy = isActionUserId === user.id;
  const isCurrentUser = user.id === currentUserId;

  return (
    <tr>
      <td style={{ fontWeight: "600", color: "var(--color-ink)" }}>
        {user.name}
      </td>
      <td className="mono" style={{ color: "var(--color-ink-secondary)" }}>
        {user.username}
      </td>
      <td>
        <span
          className={
            user.role === "admin" ? "badge badge-brand" : "badge badge-disabled"
          }
        >
          {user.role}
        </span>
      </td>
      <td style={{ whiteSpace: "nowrap", color: "var(--color-ink-muted)" }}>
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(user.createdAt),
        )}
      </td>
      <td style={{ whiteSpace: "nowrap", color: "var(--color-ink-muted)" }}>
        {formatRelative(user.updatedAt)}
      </td>
      <td onMouseDown={(event) => event.stopPropagation()}>
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
            onClick={(event) => {
              event.stopPropagation();
              onRegenerate(user);
            }}
            disabled={busy}
            aria-label={`Regenerate password for ${user.name}`}
            title="Regenerate password"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Regenerate</title>
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: "var(--color-error)" }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(user);
            }}
            disabled={busy || isCurrentUser}
            aria-label={`Delete ${user.name}`}
            title={isCurrentUser ? "Current account" : "Delete user"}
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

interface EmptyStateProps {
  hasSearch: boolean;
  onClear: () => void;
  onAdd: () => void;
}

function EmptyState({ hasSearch, onClear, onAdd }: EmptyStateProps) {
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
          <title>No users</title>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
          {hasSearch ? "No matching users" : "No users yet"}
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-ink-muted)",
            maxWidth: "280px",
          }}
        >
          {hasSearch
            ? "Try adjusting your search or role filter."
            : "Create the first managed user to get started."}
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
          Add first user
        </button>
      )}
    </div>
  );
}
