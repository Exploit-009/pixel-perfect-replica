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
