"use server";

import { revalidatePath } from "next/cache";
import { guardAdminMutation } from "@/lib/admin";
import { recordActivity } from "@/lib/admin-store";
import { getPool } from "@/lib/auth";
import {
  parseAudiences,
  runBroadcast,
  validateBroadcast,
  type AudienceCounts,
  type BroadcastResult,
} from "@/lib/broadcast";
import {
  BROADCAST_CONFIRM_REQUIRED,
  BROADCAST_COUNT_FAILED,
  BROADCAST_NOT_CONFIGURED,
  BROADCAST_RATE_LIMITED,
} from "@/lib/broadcast-copy";
import {
  broadcastDeliveryConfig,
  claimBroadcast,
  completeBroadcast,
  consumeBroadcastRateLimit,
  loadAudienceGroups,
  previewAudience,
  releaseBroadcast,
} from "@/lib/broadcast-store";

const RECENT_ERROR = "Sign in again before sending email.";

export type BroadcastPreviewResult =
  | { ok: true; counts: AudienceCounts; total: number }
  | { ok: false; error: string };

/** Counts only. Does not send mail. */
export async function previewBroadcast(audiences: string[]): Promise<BroadcastPreviewResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const parsed = parseAudiences(audiences);
  if (!parsed.ok) return parsed;
  try {
    const preview = await previewAudience(parsed.audiences);
    if (!preview.databaseConfigured) return { ok: false, error: "Database is not configured." };
    return {
      ok: true,
      counts: preview.counts,
      total: preview.total,
    };
  } catch {
    console.error("Broadcast preview failed");
    return { ok: false, error: BROADCAST_COUNT_FAILED };
  }
}

/** Sends only when confirm is "send". One message per recipient. */
export async function sendBroadcast(formData: FormData): Promise<BroadcastResult> {
  const gate = await guardAdminMutation({ recent: true, recentError: RECENT_ERROR });
  if (!gate.ok) return gate;
  if (String(formData.get("confirm") || "") !== "send") {
    return { ok: false, error: BROADCAST_CONFIRM_REQUIRED };
  }

  const validated = validateBroadcast(
    String(formData.get("subject") || ""),
    String(formData.get("body") || ""),
    formData.getAll("audience").map((value) => String(value)),
  );
  if (!validated.ok) return validated;

  const { from, configured } = broadcastDeliveryConfig();
  if (!configured || !from) return { ok: false, error: BROADCAST_NOT_CONFIGURED };
  if (!getPool()) return { ok: false, error: "Database is not configured." };

  const rate = await consumeBroadcastRateLimit(gate.member.id);
  if (!rate.allowed) {
    return { ok: false, error: rate.reason === "limited" ? BROADCAST_RATE_LIMITED : "Could not confirm this request." };
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const secret = process.env.BETTER_AUTH_SECRET || "";
  try {
    const result = await runBroadcast({
      subject: validated.subject,
      body: validated.body,
      audiences: validated.audiences,
      sentBy: gate.member.email,
      from,
      apiKey,
      secret,
      rateAllowed: true,
      fetchImpl: fetch,
      store: {
        recipients: async () => {
          const loaded = await loadAudienceGroups();
          return {
            groups: loaded.groups,
            unsubscribed: loaded.unsubscribed,
          };
        },
        claim: claimBroadcast,
        release: releaseBroadcast,
        complete: completeBroadcast,
      },
    });
    if (result.ok) {
      try {
        await recordActivity(gate.member, "Sent email", validated.subject, `${result.recipientCount} recipients`);
      } catch {
        console.error("Broadcast activity record failed");
      }
      revalidatePath("/admin/email");
      revalidatePath("/admin/unreleased");
      revalidatePath("/admin/activity");
    }
    return result;
  } catch {
    console.error("Broadcast send failed");
    return { ok: false, error: "Could not send the email. Nothing was delivered." };
  }
}
