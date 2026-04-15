"use client";

import { LoginScreen } from "../../features/auth/LoginScreen";
import { useAuth } from "../../features/auth/useAuth";

export default function LoginPage() {
  const auth = useAuth();
  return <LoginScreen auth={auth} />;
}
