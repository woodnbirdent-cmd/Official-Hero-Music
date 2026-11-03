import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminEmails, isAdminEmail, safeAdminPath } from "@/lib/admin-allowlist";
import { currentMember, type Member } from "@/lib/members";

export { adminEmails, isAdminEmail };

/** Signed-in admins pass. Logged-out visitors go to the admin sign-in. Everyone else gets a 404. */
export async function requireAdmin(): Promise<Member> {
  const member = await currentMember();
  if (!member) {
    const path = safeAdminPath((await headers()).get("x-pathname"));
    redirect(`/admin/sign-in?next=${encodeURIComponent(path)}`);
  }
  if (!isAdminEmail(member.email)) notFound();
  return member;
}
