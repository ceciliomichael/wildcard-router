"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from "react";
import {
  CustomDropdown,
  type DropdownOption,
} from "../../components/CustomDropdown";
import type { UserRole } from "./types";

export interface UserFormValues {
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

interface UserUpsertDialogProps {
  title: string;
  description: string;
  submitLabel: string;
  busyLabel: string;
  initialValues: UserFormValues;
  showEmail: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}

export function UserUpsertDialog({
  title,
  description,
  submitLabel,
  busyLabel,
  initialValues,
  showEmail,
  isLoading,
  onClose,
  onSubmit,
}: UserUpsertDialogProps) {
  const roleOptions: DropdownOption<UserRole>[] = [
    {
      value: "user",
      label: "User",
      description: "Can manage routes assigned to their own account.",
    },
    {
      value: "admin",
      label: "Admin",
      description: "Can manage all routes and create additional accounts.",
    },
  ];

  const [name, setName] = useState(initialValues.name);
  const [username, setUsername] = useState(initialValues.username);
  const [email, setEmail] = useState(initialValues.email);
  const [role, setRole] = useState<UserRole>(initialValues.role);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedUsername) {
      setError("Name and username are required.");
      return;
    }
    if (showEmail && !trimmedEmail) {
      setError("Email is required.");
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        role,
      });
    } catch (submitError) {
      if (
        submitError &&
        typeof submitError === "object" &&
        "message" in submitError
      ) {
        setError(String((submitError as { message: unknown }).message));
      } else {
        setError("Failed to save user.");
      }
    }
  }

  function handleOverlayKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    /* biome-ignore lint/a11y/useSemanticElements: backdrop click handling needs a non-semantic overlay wrapper */
    <div
      className="overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
    >
      <div
        className="modal"
        style={{ overflow: "visible" }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--color-border)",
            gap: "1rem",
          }}
        >
          <div>
            <h2
              style={{ margin: 0, fontSize: "1rem", color: "var(--color-ink)" }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: "0.15rem 0 0",
                fontSize: "0.8rem",
                color: "var(--color-ink-secondary)",
              }}
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
          >
            <svg
              width="16"
              height="16"
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

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "1rem",
            padding: "1.5rem",
            overflow: "visible",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error-border)",
                color: "var(--color-error)",
                borderRadius: "0.85rem",
                padding: "0.8rem 0.9rem",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="user-name" className="field-label">
              Full name
            </label>
            <input
              id="user-name"
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Admin"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="user-username" className="field-label">
              Username
            </label>
            <input
              id="user-username"
              className="field-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="jane-admin"
              disabled={isLoading}
            />
          </div>

          {showEmail ? (
            <div>
              <label htmlFor="user-email" className="field-label">
                Email
              </label>
              <input
                id="user-email"
                className="field-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane-admin@users.local"
                disabled={isLoading}
              />
              <span className="field-help">
                This is used for login alongside the username.
              </span>
            </div>
          ) : null}

          <div>
            <span className="field-label">Role</span>
            <CustomDropdown
              ariaLabel="Select user role"
              value={role}
              options={roleOptions}
              onChange={setRole}
              minMenuWidth="100%"
              menuAlign="left"
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? busyLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
