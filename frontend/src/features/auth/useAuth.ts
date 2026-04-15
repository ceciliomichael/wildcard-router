"use client";

import { useCallback, useState } from "react";
import { validateKey } from "../routes/api";

const SESSION_KEY = "wc_api_key";

function readSessionKey(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionKey(key: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, key);
  } catch {
    // sessionStorage unavailable — keep in memory only
  }
}

function clearSessionKey(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (key: string) => Promise<void>;
  logout: () => void;
  /** Call when the backend returns 401 during a data request */
  handleUnauthorized: () => void;
}

export function useAuth(): AuthState {
  const [apiKey, setApiKey] = useState<string | null>(() => readSessionKey());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await validateKey(key);
      writeSessionKey(key);
      setApiKey(key);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Invalid API key";
      setError(msg.includes("401") ? "Invalid API key." : msg);
      setApiKey(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSessionKey();
    setApiKey(null);
    setError(null);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearSessionKey();
    setApiKey(null);
    setError("Session expired. Please re-enter your API key.");
  }, []);

  return {
    apiKey,
    isAuthenticated: apiKey !== null,
    isLoading,
    error,
    login,
    logout,
    handleUnauthorized,
  };
}
