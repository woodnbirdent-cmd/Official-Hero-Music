"use server";

import { normalizeEmail } from "@/lib/broadcast";
import { saveMailingSignup } from "@/lib/mailing-list";

export type FormState = {
  ok: boolean;
  message: string;
  error?: string;
};

function requireField(value: FormDataEntryValue | null, name: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function readEmail(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) throw new Error("Email is required");
  const email = normalizeEmail(raw);
  if (!email) throw new Error("Enter a valid email");
  return email;
}

async function persistSubmission(
  type: string,
  payload: Record<string, string>
): Promise<void> {
  // Log the form type only. Do not log names, emails, or messages.
  // Join and the merch waitlist are saved before this runs. Booking and prayer are not stored.
  console.log(`[#Hero form:${type}] received`);
  void payload;
  // Simulate async persistence
  await Promise.resolve();
}

export async function submitJoin(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const name = requireField(formData.get("name"), "Name");
    const email = readEmail(formData.get("email"));
    const saved = await saveMailingSignup({ email, name, source: "join" });
    if (!saved) throw new Error("Something went wrong");
    await persistSubmission("join", { name, email });
    return {
      ok: true,
      message: "You're on the list. Watch for drops and updates from #Hero.",
    };
  } catch (e) {
    return {
      ok: false,
      message: "",
      error: e instanceof Error ? e.message : "Something went wrong",
    };
  }
}

export async function submitBooking(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const name = requireField(formData.get("name"), "Name");
    const email = requireField(formData.get("email"), "Email");
    const org = String(formData.get("org") || "").trim();
    const date = String(formData.get("date") || "").trim();
    const message = requireField(formData.get("message"), "Message");
    if (!email.includes("@")) throw new Error("Enter a valid email");
    await persistSubmission("booking", { name, email, org, date, message });
    return {
      ok: true,
      message:
        "Booking request received. The team will follow up as soon as possible.",
    };
  } catch (e) {
    return {
      ok: false,
      message: "",
      error: e instanceof Error ? e.message : "Something went wrong",
    };
  }
}

export async function submitPrayer(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const name = String(formData.get("name") || "Anonymous").trim() || "Anonymous";
    const request = requireField(formData.get("request"), "Prayer request");
    await persistSubmission("prayer", { name, request });
    return {
      ok: true,
      message: "Your prayer request was received. Standing with you.",
    };
  } catch (e) {
    return {
      ok: false,
      message: "",
      error: e instanceof Error ? e.message : "Something went wrong",
    };
  }
}

export async function submitMerchWaitlist(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const email = readEmail(formData.get("email"));
    const saved = await saveMailingSignup({ email, name: "", source: "waitlist" });
    if (!saved) throw new Error("Something went wrong");
    await persistSubmission("merch-waitlist", { email });
    return {
      ok: true,
      message: "You're on the merch waitlist. We'll hit you when the shop drops.",
    };
  } catch (e) {
    return {
      ok: false,
      message: "",
      error: e instanceof Error ? e.message : "Something went wrong",
    };
  }
}
