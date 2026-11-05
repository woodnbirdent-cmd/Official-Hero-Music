"use server";

import { headers } from "next/headers";
import { guardAdminMutation } from "@/lib/admin";
import type { Member } from "@/lib/members";
import {
  PASSWORD_CURRENT_REQUIRED,
  PASSWORD_MISMATCH,
  PASSWORD_SAVED,
  PASSWORD_SAVED_REVOKE_FAILED,
  PASSWORD_UPDATE_FAILED,
  adminPasswordIssue,
} from "@/lib/admin-password-policy";
import {
  adminHasPassword,
  authFailureMessage,
  enforceAdminPasswordChange,
  revokeOtherAdminSessions,
  withAdminPasswordAttempt,
} from "@/lib/admin-password";
import { ensureAdminTables, writeActivity } from "@/lib/admin-store";
import { auth, getPool } from "@/lib/auth";

export type PasswordActionResult = { ok: true; message: string } | { ok: false; error: string };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Set or change the signed-in admin's own password. Arguments are never logged. */
export async function updateAdminPassword(formData: FormData): Promise<PasswordActionResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;

  const currentPassword = field(formData, "currentPassword");
  const newPassword = field(formData, "newPassword");
  const confirmPassword = field(formData, "confirmPassword");
  if (newPassword !== confirmPassword) return { ok: false, error: PASSWORD_MISMATCH };

  const issue = adminPasswordIssue(newPassword, gate.member.email);
  if (issue) return { ok: false, error: issue };

  const hasPassword = await adminHasPassword(gate.member.id);
  if (hasPassword === null) return { ok: false, error: PASSWORD_UPDATE_FAILED };

  try {
    return await withAdminPasswordAttempt(async () => {
      if (hasPassword) {
        if (!currentPassword) return { ok: false, error: PASSWORD_CURRENT_REQUIRED };
        await enforceAdminPasswordChange({
          userId: gate.member.id,
          sessionEmail: gate.member.email,
          sessionCreatedAt: gate.sessionCreatedAt,
          newPassword,
          currentPassword,
        });
        await auth.api.changePassword({
          body: { currentPassword, newPassword, revokeOtherSessions: true },
          headers: await headers(),
        });
        await recordPasswordActivity(gate.member, "change-password", true);
        return { ok: true, message: PASSWORD_SAVED };
      }

      await enforceAdminPasswordChange({
        userId: gate.member.id,
        sessionEmail: gate.member.email,
        sessionCreatedAt: gate.sessionCreatedAt,
        newPassword,
        currentPassword: "",
      });
      await auth.api.setPassword({
        body: { newPassword },
        headers: await headers(),
      });
      const revoked = await revokeOtherAdminSessions(gate.member.id);
      await recordPasswordActivity(gate.member, "set-password", revoked);
      return { ok: true, message: revoked ? PASSWORD_SAVED : PASSWORD_SAVED_REVOKE_FAILED };
    });
  } catch (error) {
    console.error("Admin password update failed");
    return { ok: false, error: authFailureMessage(error) };
  }
}

async function recordPasswordActivity(
  member: Member,
  action: "set-password" | "change-password",
  revoked: boolean,
): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) return;
    await ensureAdminTables();
    await writeActivity(pool, member, action, "own account", revoked ? "Other sessions revoked." : "Session revoke failed.");
  } catch {
    console.error("Admin password activity record failed");
  }
}
