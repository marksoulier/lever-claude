// Admin email list — configurable via ADMIN_EMAILS env var (comma-separated).
// Falls back to the owner email if not set.
// Add admin@lever.dev for Claude Code test access.
const raw = process.env.ADMIN_EMAILS ?? "marksoulkid@gmail.com,admin@lever.dev";
export const ADMIN_EMAILS: string[] = raw.split(",").map((e) => e.trim()).filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? "");
}
