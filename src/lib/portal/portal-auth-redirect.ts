/** Shared portal return detection for Clerk sign-in / sign-up. */

export function isPortalReturn(value: string | null): boolean {
  if (!value) return false;
  try {
    if (value.startsWith("/portal")) return true;
    const url = new URL(value, "http://localhost");
    return url.pathname === "/portal" || url.pathname.startsWith("/portal/");
  } catch {
    return value.includes("/portal");
  }
}

/** Portal → /portal; otherwise /after-auth (broker vs portal router). */
export function afterAuthRedirectUrl(redirectParam: string | null): string {
  if (isPortalReturn(redirectParam)) {
    return redirectParam!.startsWith("/") ? redirectParam! : "/portal";
  }
  return "/after-auth";
}
