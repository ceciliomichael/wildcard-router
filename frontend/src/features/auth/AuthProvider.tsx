"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "./api";
import type { AuthUser } from "./types";

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  handleUnauthorized: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function toMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchCurrentUser();
      setUser(response.user);
      setError(null);
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: unknown }).status)
          : 0;
      if (status === 401) {
        setUser(null);
        setError(null);
      } else {
        setError(toMessage(err, "Failed to load session."));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginRequest({ username, password });
      setUser(response.user);
    } catch (err) {
      setUser(null);
      setError(toMessage(err, "Invalid username or password."));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutRequest();
    } catch {
      // ignore logout race with expired sessions
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const handleUnauthorized = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setError("Session expired. Please sign in again.");
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      error,
      login,
      logout,
      refresh,
      clearError: () => setError(null),
      handleUnauthorized,
    }),
    [error, handleUnauthorized, isLoading, login, logout, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
