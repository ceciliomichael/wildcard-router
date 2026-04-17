"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import { SegmentedField } from "../../../components/SegmentedField";
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
  const router = useRouter();

  const profileOptions = [
    {
      value: "account",
      label: user.name,
      description: user.username || user.email || "Account",
    },
    {
      value: "settings",
      label: "Settings",
      description: "Manage account and terminal configuration.",
    },
    {
      value: "signout",
      label: "Sign out",
      description: "End the current session on this device.",
      tone: "danger" as const,
    },
  ];
  const initial = getInitial(user);
  const activeNavigationValue =
    navigation.find((item) =>
      item.href === "/"
        ? currentPath === item.href
        : currentPath.startsWith(item.href),
    )?.href ??
    navigation[0]?.href ??
    "";

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
          className="dashboard-topbar-brand"
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
            <span
              className="dashboard-topbar-brand-title"
              style={{
                fontWeight: "800",
                fontSize: "0.95rem",
                color: "var(--color-ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              Wildcard Catcher
            </span>
            <span
              className="dashboard-topbar-brand-subtitle"
              style={{
                fontSize: "0.74rem",
                color: "var(--color-ink-secondary)",
                lineHeight: 1.1,
                display: "block",
              }}
            >
              {user.role === "admin"
                ? "Admin control interface"
                : "Personal route workspace"}
            </span>
          </div>
        </div>

        <div
          className="dashboard-topbar-nav"
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <SegmentedField
            ariaLabel="Dashboard navigation"
            className="dashboard-topbar-nav-segmented"
            value={activeNavigationValue}
            options={navigation.map((item) => ({
              label: item.label,
              value: item.href,
            }))}
            onChange={(value) => {
              router.push(value);
            }}
          />
        </div>

        <div
          className="dashboard-topbar-actions"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "0.625rem",
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          {actions}
          <CustomDropdown
            ariaLabel="Profile menu"
            value="account"
            options={profileOptions}
            onChange={(value) => {
              if (value === "settings") {
                router.push("/settings");
                return;
              }

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
        .dashboard-topbar-shell {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .dashboard-topbar-brand {
          order: 1;
          min-width: 0;
        }

        .dashboard-topbar-actions {
          order: 2;
          width: auto;
          justify-content: flex-end;
          flex-wrap: nowrap;
        }

        .dashboard-topbar-actions .custom-dropdown {
          width: auto;
          min-width: 0;
          margin-left: 0;
        }

        .dashboard-topbar-actions .custom-dropdown__trigger {
          min-height: 2.5rem;
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }

        .dashboard-topbar-nav {
          order: 3;
          grid-column: 1 / -1;
          min-width: 0;
          justify-content: center;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .dashboard-topbar-nav-segmented {
          flex-wrap: nowrap;
          min-width: fit-content;
        }

        @media (min-width: 768px) {
          .dashboard-topbar-shell {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          }

          .dashboard-topbar-brand,
          .dashboard-topbar-actions,
          .dashboard-topbar-nav {
            order: 0;
          }

          .dashboard-topbar-actions {
            justify-content: flex-end;
            width: auto;
            flex-wrap: nowrap;
            justify-self: end;
          }

          .dashboard-topbar-actions .custom-dropdown {
            width: auto;
            margin-left: 0;
          }

          .dashboard-topbar-nav {
            grid-column: auto;
            justify-content: flex-start;
            overflow-x: visible;
            padding-bottom: 0;
          }
        }

        @media (max-width: 767px) {
          .dashboard-topbar-nav-segmented button {
            white-space: nowrap;
          }
        }

        @media (max-width: 640px) {
          .dashboard-topbar-brand-title {
            font-size: 0.92rem;
          }

          .dashboard-topbar-brand-subtitle {
            font-size: 0.72rem;
          }

          .dashboard-topbar-profile-copy {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .dashboard-topbar-shell {
            gap: 0.6rem;
            padding: 0.75rem 0.85rem;
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
