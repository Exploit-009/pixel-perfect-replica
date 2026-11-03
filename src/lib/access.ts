export type AccessUser = { id?: string; email_confirmed_at?: string | null; is_anonymous?: boolean | null };

/** Returns the bearer token from an Authorization header, or null when absent or malformed. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header.trim());
  if (!match) return null;
  const token = match?.[1];
  return token && token.split('.').length === 3 ? token : null;
}

/** Only invited, confirmed, non-anonymous accounts may use XPLO. */
export function isAllowedUser(user: AccessUser | null | undefined): boolean {
  return Boolean(user?.id && user.email_confirmed_at && !user.is_anonymous);
}

/** Only internal paths may be used after sign-in. */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/auth') ? value : '/';
}

/** Explains a failed sign-in: rejected credentials versus a sign-in service or network problem. */
export function signInErrorMessage(error: { status?: number | undefined; code?: string | undefined } | null | undefined): string {
  if (error?.code === 'invalid_credentials' || error?.status === 400 || error?.status === 401 || error?.status === 422) return 'That email and password were not accepted. XPLO is invite-only.';
  if (error?.code === 'email_not_confirmed') return 'This account is not confirmed yet. Ask the owner to confirm it.';
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return 'Too many sign-in attempts. Wait a minute and try again.';
  return 'Sign-in is unavailable right now. Check your connection and try again; your password was not rejected.';
}
