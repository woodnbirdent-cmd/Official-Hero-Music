"use server";

import { revalidatePath } from "next/cache";
import { setOrderFulfilled } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";

export async function toggleOrderFulfilled(formData: FormData) {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId") || "");
  const fulfilled = formData.get("fulfilled") === "true";
  if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) return;
  await setOrderFulfilled(sessionId, fulfilled);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}
