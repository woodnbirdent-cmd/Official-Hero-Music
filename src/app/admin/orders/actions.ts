"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { setOrderArchived, setOrderFulfilled } from "@/lib/admin-data";
import { refundMerchOrder, type ActionResult } from "@/lib/admin-mutations";

function refreshOrders() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/activity");
}

export async function toggleOrderFulfilled(formData: FormData) {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId") || "");
  const fulfilled = formData.get("fulfilled") === "true";
  if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) return;
  await setOrderFulfilled(sessionId, fulfilled);
  refreshOrders();
}

export async function toggleOrderArchived(formData: FormData) {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId") || "");
  const archived = formData.get("archived") === "true";
  if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) return;
  await setOrderArchived(sessionId, archived);
  refreshOrders();
}

export async function refundOrder(sessionId: string): Promise<ActionResult> {
  await requireAdmin();
  const result = await refundMerchOrder(sessionId);
  if (result.ok) refreshOrders();
  return result;
}
