import "server-only";
import { notFound } from "next/navigation";
import { currentMember, type Member } from "@/lib/members";

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

/** Signed-in admins pass. Everyone else, including logged-out visitors, gets a 404. */
export async function requireAdmin(): Promise<Member> {
  const member = await currentMember();
  if (!member || !isAdminEmail(member.email)) notFound();
  return member;
}
