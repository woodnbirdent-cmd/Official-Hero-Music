"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { deleteMemberAccount, type ActionResult } from "@/lib/admin-mutations";

export async function deleteMember(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const result = await deleteMemberAccount({
    userId: String(formData.get("userId") || ""),
    confirmEmail: String(formData.get("confirmEmail") || ""),
    deleteStripeCustomer: formData.get("deleteStripeCustomer") === "true",
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/members");
    revalidatePath("/admin/subscriptions");
    revalidatePath("/admin/activity");
  }
  return result;
}
