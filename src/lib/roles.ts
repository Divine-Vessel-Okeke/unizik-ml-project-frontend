// src/lib/roles.ts

export const ADMIN_ROLES = [
  "BURSARY_OFFICER",
  "BURSARY_DIRECTOR",
  "ICT_DIRECTOR",
  "AUDIT_OFFICER",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const STUDENT_ROLE = "STUDENT" as const;

export function isIn<T>(value: unknown, collection: readonly T[]): value is T {
  return (collection as readonly unknown[]).includes(value);
}

export function isAdminRole(role: unknown): role is AdminRole {
  return isIn(role, ADMIN_ROLES);
}

export function isStudentRole(role: unknown): role is typeof STUDENT_ROLE {
  return role === STUDENT_ROLE;
}