/** Comma-separated allowlist from ADMIN_EMAILS. Empty means nobody. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Only in-app admin paths. Rejects protocol-relative and off-site targets. */
export function safeAdminPath(value: string | null | undefined): string {
  if (!value) return "/admin";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin")) return "/admin";
  if (trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("://") || trimmed.includes("..")) return "/admin";
  if (trimmed === "/admin/sign-in" || trimmed.startsWith("/admin/sign-in?") || trimmed.startsWith("/admin/sign-in/")) {
    return "/admin";
  }
  return trimmed;
}
