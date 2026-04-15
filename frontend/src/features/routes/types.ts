export interface Route {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  subdomain: string;
  destination: string;
  enabled: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutePayload {
  subdomain: string;
  destination: string;
  enabled: boolean;
  note?: string;
}

export interface RoutesRegistry {
  version: number;
  updatedAt: string;
  routes: Route[];
}

export type ApiError = {
  message: string;
  status: number;
};
