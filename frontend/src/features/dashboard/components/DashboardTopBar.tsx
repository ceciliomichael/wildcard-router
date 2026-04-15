"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import type { AuthUser } from "../../auth/types";
import type { DashboardNavItem } from "../navigation";

interface DashboardTopBarProps {
  user: AuthUser;
  currentPath: string;
  navigation: ReadonlyArray<DashboardNavItem>;
  actions?: ReactNode;
  onLogout: () => Promise<void>;
}

export function DashboardTopBar({
  user,
  currentPath,
  navigation,
  actions,
  onLogout,
}: DashboardTopBarProps) {
  const profileOptions = [
    {
      value: "account",
      label: user.name,
      description: user.username || user.email || "Account",
    },
    {
      value: "signout",
      label: "Sign out",
      description: "End the current session on this device.",
      tone: "danger" as const,
    },
  ];
  const initial = getInitial(user);

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
        className="dashboard-topbar-shell"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0.9rem 1rem",
          display: "grid",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: "2.4rem",
              height: "2.4rem",
              borderRadius: "0.85rem",
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
                fontWeight: "800",
                fontSize: "0.98rem",
                color: "var(--color-ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Wildcard Catcher
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-ink-secondary)",
                marginTop: "0.1rem",
              }}
            >
              {user.role === "admin"
                ? "Admin control surface"
                : "Personal route workspace"}
            </div>
          </div>
        </div>

        <div
          className="dashboard-topbar-nav"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flexWrap: "wrap",
          }}
        >
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? currentPath === item.href
                : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "dashboard-topbar-link active"
                    : "dashboard-topbar-link"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          className="dashboard-topbar-actions"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.625rem",
            minWidth: 0,
          }}
        >
          {actions}
          <CustomDropdown
            ariaLabel="Profile menu"
            value="account"
            options={profileOptions}
            onChange={(value) => {
              if (value === "signout") {
                void onLogout();
              }
            }}
            minMenuWidth="15rem"
            renderTrigger={() => (
              <div
                className="dashboard-topbar-profile"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "999px",
                    background: "var(--color-brand)",
                    color: "var(--color-surface)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </span>
                <span
                  className="dashboard-topbar-profile-copy"
                  style={{
                    display: "grid",
                    minWidth: 0,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--color-ink)",
                      lineHeight: 1.1,
                    }}
                  >
                    {user.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--color-ink-secondary)",
                      lineHeight: 1.1,
                    }}
                  >
                    {user.username || user.email || "Account"}
                  </span>
                </span>
              </div>
            )}
          />
        </div>
      </div>
      <style>{`
        .dashboard-topbar-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 2.4rem;
          padding: 0 0.95rem;
          border-radius: 999px;
          border: 1px solid transparent;
          color: var(--color-ink-secondary);
          font-size: 0.8125rem;
          font-weight: 600;
          text-decoration: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .dashboard-topbar-link:hover {
          background: var(--color-brand-lighter);
          color: var(--color-ink);
        }

        .dashboard-topbar-link.active {
          background: var(--color-brand-light);
          border-color: var(--color-brand-border);
          color: var(--color-ink);
        }

        @media (min-width: 960px) {
          .dashboard-topbar-shell {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          }
        }

        @media (max-width: 959px) {
          .dashboard-topbar-nav {
            order: 3;
          }

          .dashboard-topbar-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 480px) {
          .dashboard-topbar-profile-copy {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}

function getInitial(user: AuthUser): string {
  const source = user.name.trim() || user.username.trim() || user.email.trim();
  return source.charAt(0).toUpperCase() || "R";
}
