"use server";

import { revalidatePath } from "next/cache";
import { guardAdminMutation } from "@/lib/admin";
import { recordActivity } from "@/lib/admin-store";
import type { Member } from "@/lib/members";
import { deletePrivateAudio } from "@/lib/private-audio";
import {
  createUnreleasedTrack,
  getUnreleasedTrackById,
  moveUnreleasedTrack,
  removeUnreleasedTrack,
  setUnreleasedTrackHidden,
  UnreleasedInputError,
  updateUnreleasedTrack,
} from "@/lib/unreleased-store";
import { cleanTrackDuration, cleanTrackNote, cleanTrackTitle } from "@/lib/unreleased-tracks";

export type UnreleasedActionResult = { ok: true } | { ok: false; error: string };

export type CreateUnreleasedResult = { ok: true; id: string; pathname: string } | { ok: false; error: string };

function refreshUnreleased() {
  revalidatePath("/admin/unreleased");
  revalidatePath("/members/early-access");
}

async function note(member: Member, action: string, target: string, detail: string) {
  try {
    await recordActivity(member, action, target, detail);
  } catch {
    console.error("Unreleased activity log failed");
  }
}

function rejected(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof UnreleasedInputError) return { ok: false, error: error.message };
  console.error(fallback);
  return { ok: false, error: fallback };
}

function detailsFrom(formData: FormData): { title: string; note: string; duration: string } | { error: string } {
  const title = cleanTrackTitle(String(formData.get("title") || ""));
  const note = cleanTrackNote(String(formData.get("note") || ""));
  const duration = cleanTrackDuration(String(formData.get("duration") || ""));
  if (!title) return { error: "Enter a title." };
  if (note === null) return { error: "Shorten the note." };
  if (duration === null) return { error: "Use a duration like 3:00." };
  return { title, note, duration };
}

export async function createUnreleasedSong(formData: FormData): Promise<CreateUnreleasedResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const details = detailsFrom(formData);
  if ("error" in details) return { ok: false, error: details.error };
  try {
    const created = await createUnreleasedTrack(details);
    await note(gate.member, "unreleased.create", created.id, details.title);
    refreshUnreleased();
    return { ok: true, id: created.id, pathname: created.pathname };
  } catch (error) {
    return rejected(error, "Could not add that song.");
  }
}

export async function updateUnreleasedSong(formData: FormData): Promise<UnreleasedActionResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const id = String(formData.get("id") || "");
  const details = detailsFrom(formData);
  if ("error" in details) return { ok: false, error: details.error };
  try {
    await updateUnreleasedTrack(id, details);
    await note(gate.member, "unreleased.update", id, details.title);
    refreshUnreleased();
    return { ok: true };
  } catch (error) {
    return rejected(error, "Could not save that song.");
  }
}

export async function setUnreleasedHidden(formData: FormData): Promise<UnreleasedActionResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const id = String(formData.get("id") || "");
  const hidden = formData.get("hidden") === "true";
  try {
    await setUnreleasedTrackHidden(id, hidden);
    await note(gate.member, hidden ? "unreleased.hide" : "unreleased.show", id, hidden ? "hidden" : "visible");
    refreshUnreleased();
    return { ok: true };
  } catch (error) {
    return rejected(error, "Could not update that song.");
  }
}

export async function moveUnreleasedSong(formData: FormData): Promise<UnreleasedActionResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const id = String(formData.get("id") || "");
  const direction = formData.get("direction") === "up" ? "up" : formData.get("direction") === "down" ? "down" : null;
  if (!direction) return { ok: false, error: "Could not reorder that song." };
  try {
    await moveUnreleasedTrack(id, direction);
    await note(gate.member, "unreleased.reorder", id, direction);
    refreshUnreleased();
    return { ok: true };
  } catch (error) {
    return rejected(error, "Could not reorder that song.");
  }
}

export async function removeUnreleasedSong(formData: FormData): Promise<UnreleasedActionResult> {
  const gate = await guardAdminMutation();
  if (!gate.ok) return gate;
  const id = String(formData.get("id") || "");
  const confirm = String(formData.get("confirm") || "").trim();
  try {
    const existing = await getUnreleasedTrackById(id);
    if (!existing) return { ok: false, error: "That song was not found." };
    if (confirm !== existing.title) return { ok: false, error: "Type the song title to remove it." };
    const removed = await removeUnreleasedTrack(id);
    try {
      await deletePrivateAudio(removed.pathname);
    } catch {
      console.error("Unreleased audio delete failed");
    }
    await note(gate.member, "unreleased.remove", id, removed.title);
    refreshUnreleased();
    return { ok: true };
  } catch (error) {
    return rejected(error, "Could not remove that song.");
  }
}
