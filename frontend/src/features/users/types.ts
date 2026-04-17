export type UserRole = "admin" | "user";

export interface ManagedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  isBootstrap: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  email?: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface CreateUserResponse {
  user: ManagedUser;
  generatedPassword: string;
}

export interface PasswordRotationResponse {
  user: ManagedUser;
  generatedPassword: string;
}

export interface CurrentUserProfileUpdatePayload {
  name: string;
}

export interface CurrentUserPasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

export interface CurrentUserResponse {
  user: ManagedUser;
}
