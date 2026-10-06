// src/modules/auth/resetValidation.ts
// Client-side checks for the forgot-password flow — fail fast with clear
// field messages and never post empty/garbage payloads.

export type ResetRequestValidation =
  | { ok: true; username: string }
  | { ok: false; error: string };

export function validateResetRequest(rawUsername: string): ResetRequestValidation {
  const username = rawUsername.trim();
  if (!username) return { ok: false, error: "Enter your username." };
  if (username.length > 100) return { ok: false, error: "Username must be at most 100 characters." };
  return { ok: true, username };
}

export type ResetCompleteValidation =
  | { ok: true; token: string; newPassword: string }
  | { ok: false; errors: { token?: string; password?: string; confirm?: string } };

export function validateResetComplete(
  rawToken: string,
  newPassword: string,
  confirm: string,
): ResetCompleteValidation {
  const errors: { token?: string; password?: string; confirm?: string } = {};
  const token = rawToken.trim();
  if (!token) errors.token = "Reset link is missing. Open the full reset link again.";
  if (!newPassword) errors.password = "Enter a new password.";
  else if (newPassword.length < 12) errors.password = "New password must be at least 12 characters.";
  else if (newPassword.length > 1024) errors.password = "Password is too long.";
  if (confirm !== newPassword) errors.confirm = "New password and confirmation do not match.";
  if (errors.token || errors.password || errors.confirm) return { ok: false, errors };
  return { ok: true, token, newPassword };
}
