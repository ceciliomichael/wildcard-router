export const RESERVED_ROUTE_SUBDOMAIN = "router";

export function isReservedRouteSubdomain(value: string): boolean {
  return value.trim().toLowerCase() === RESERVED_ROUTE_SUBDOMAIN;
}

export function filterReservedRoutes<T extends { subdomain: string }>(
  routes: T[],
): T[] {
  return routes.filter((route) => !isReservedRouteSubdomain(route.subdomain));
}
