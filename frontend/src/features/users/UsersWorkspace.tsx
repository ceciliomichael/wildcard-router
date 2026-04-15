"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { AuthState } from "../auth/useAuth";
import {
  createUser,
  deleteUser,
  listUsers,
  regenerateUserPassword,
} from "./api";
import { CreateUserDialog } from "./CreateUserDialog";
import { PasswordRevealDialog } from "./PasswordRevealDialog";
import type { ManagedUser } from "./types";
import { UsersTable } from "./UsersTable";

interface UsersWorkspaceProps {
  auth: AuthState;
}

type SortKey = "updatedAt" | "name";
type RoleFilter = "all" | "admin" | "user";

export function UsersWorkspace({ auth }: UsersWorkspaceProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActionUserId, setIsActionUserId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [passwordModal, setPasswordModal] = useState<{
    title: string;
    userName: string;
    password: string;
  } | null>(null);

  const hasFetchedRef = useRef(false);
  const handleUnauthorized = auth.handleUnauthorized;
  const currentUserId = auth.user?.id ?? null;
  const isAdmin = auth.user?.role === "admin";

  const fetchUsers = useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await listUsers();
        setUsers(data);
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

        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to load users.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    if (!auth.user || hasFetchedRef.current) {
      return;
    }

    hasFetchedRef.current = true;
    void fetchUsers();
  }, [auth.user, fetchUsers]);

  const filteredUsers = users
    .filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const query = search.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  async function handleCreateUser(payload: {
    name: string;
    username: string;
    role: "admin" | "user";
  }) {
    setIsCreatingUser(true);
    try {
      const response = await createUser(payload);
      setUsers((prev) => [response.user, ...prev]);
      setPasswordModal({
        title: "Password generated",
        userName: response.user.username,
        password: response.generatedPassword,
      });
      setCreatingOpen(false);
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
      setIsCreatingUser(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingUser) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      setUsers((prev) => prev.filter((user) => user.id !== deletingUser.id));
      setDeletingUser(null);
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
      setBannerError("Failed to delete user.");
      setDeletingUser(null);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRegeneratePassword(user: ManagedUser) {
    setIsActionUserId(user.id);
    try {
      const response = await regenerateUserPassword(user.id);
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === response.user.id ? response.user : entry,
        ),
      );
      setPasswordModal({
        title: "Password regenerated",
        userName: response.user.username,
        password: response.generatedPassword,
      });
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
      setBannerError("Failed to regenerate the password.");
    } finally {
      setIsActionUserId(null);
    }
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {error ? (
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error-border)",
              color: "var(--color-error)",
              borderRadius: "0.9rem",
              padding: "0.9rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        </div>
      ) : null}

      {bannerError ? (
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error-border)",
              color: "var(--color-error)",
              borderRadius: "0.9rem",
              padding: "0.9rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            {bannerError}
          </div>
        </div>
      ) : null}

      <div
        className="dashboard-content-grid"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "1fr",
        }}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <UsersTable
            users={filteredUsers}
            totalCount={users.length}
            currentUserId={currentUserId}
            search={search}
            roleFilter={roleFilter}
            sortKey={sortKey}
            isRefreshing={isRefreshing}
            onSearchChange={setSearch}
            onRoleFilterChange={setRoleFilter}
            onSortKeyChange={setSortKey}
            onRefresh={() => void fetchUsers(true)}
            onAdd={() => setCreatingOpen(true)}
            onDelete={(user) => setDeletingUser(user)}
            onRegenerate={(user) => void handleRegeneratePassword(user)}
            isActionUserId={isActionUserId}
          />
        )}
      </div>

      {creatingOpen ? (
        <CreateUserDialog
          isLoading={isCreatingUser}
          onClose={() => setCreatingOpen(false)}
          onSubmit={handleCreateUser}
        />
      ) : null}

      {passwordModal ? (
        <PasswordRevealDialog
          title={passwordModal.title}
          userName={passwordModal.userName}
          password={passwordModal.password}
          onClose={() => setPasswordModal(null)}
        />
      ) : null}

      {deletingUser ? (
        <ConfirmDialog
          title="Delete user?"
          message={`This will permanently remove ${deletingUser.name} and revoke their active sessions. This cannot be undone.`}
          confirmLabel="Delete user"
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeletingUser(null)}
          isLoading={isDeleting}
        />
      ) : null}
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
