// src/lib/auth.ts

/**
 * Clears the persisted user from localStorage.
 * Does NOT clear the `unizik_session` cookie (set by /api/auth/login, read only by the server).
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("unizik_user");
}