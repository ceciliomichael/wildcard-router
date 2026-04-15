import type { AuthUser } from "../auth/types";

export interface DashboardNavItem {
  href: string;
  label: string;
}

export function getDashboardNavigation(
  user: AuthUser,
): ReadonlyArray<DashboardNavItem> {
  if (user.role === "admin") {
    return [
      { href: "/admin/routes", label: "Routes" },
      { href: "/admin/users", label: "Users" },
    ];
  }

  return [{ href: "/", label: "Routes" }];
}
