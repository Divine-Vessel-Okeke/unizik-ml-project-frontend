// src/lib/messages.ts

/**
 * Centralized user-facing message strings.
 * Any message used in more than one place lives here.
 * If the cause of an error is unknown, use GENERIC_ERROR — never invent specificity.
 */
export const MSG = {
  GENERIC_ERROR: "An error occurred.",
} as const;