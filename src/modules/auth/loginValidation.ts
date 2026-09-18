// src/modules/auth/loginValidation.ts
// Client-side login checks — run before the network call so the form fails
// fast with clear field messages and never posts empty/garbage payloads.

export type LoginFieldErrors = {
  username?: string;
  password?: string;
  form?: string;
};

export type LoginValidationResult =
  | { ok: true; username: string; password: string }
  | { ok: false; errors: LoginFieldErrors };

const USERNAME_MAX = 100;
const PASSWORD_MAX = 1024;

export function validateLoginForm(rawUsername: string, rawPassword: string): LoginValidationResult {
  const username = rawUsername.trim();
  const password = rawPassword; // passwords may intentionally include leading/trailing spaces
  const errors: LoginFieldErrors = {};

  if (!username) {
    errors.username = "Enter your username.";
  } else if (username.length > USERNAME_MAX) {
    errors.username = `Username must be at most ${USERNAME_MAX} characters.`;
  } else if (/\s/.test(username)) {
    errors.username = "Username cannot contain spaces.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length > PASSWORD_MAX) {
    errors.password = "Password is too long.";
  }

  if (errors.username || errors.password) {
    return { ok: false, errors };
  }
  return { ok: true, username, password };
}

/** Map API / network failures to a single user-facing login message. */
export function loginErrorMessage(cause: unknown, fallback = "Sign in failed."): string {
  const status = (cause as { status?: number } | null)?.status;
  const message = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";

  if (status === 401) return "Invalid username or password.";
  if (status === 403) return message || "This account cannot sign in right now.";
  if (status === 409) {
    return message?.trim() || "This account is already signed in elsewhere. Sign out there first.";
  }
  if (status === 429) return "Too many sign-in attempts. Please wait a few minutes and try again.";
  if (status === 503) return "Sign-in is temporarily unavailable. Try again shortly.";
  if (status && status >= 500) return "Server error while signing in. Please try again.";

  const code = (cause as { code?: string } | null)?.code;
  if (code === "NETWORK_ERROR" || /unable to reach|network/i.test(message)) {
    return "Unable to reach the server. Check that the backend is running.";
  }
  if (code === "TIMEOUT" || /timed out/i.test(message)) {
    return "Sign-in timed out. Please try again.";
  }

  return message?.trim() || fallback;
}
