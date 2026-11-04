"use server";

import { revalidatePath } from "next/cache";
import { guardAdminMutation } from "@/lib/admin";
import { deleteMemberAccount, type ActionResult } from "@/lib/admin-mutations";

export async function deleteMember(formData: FormData): Promise<ActionResult> {
  const gate = await guardAdminMutation({ recent: true });
  if (!gate.ok) return gate;
  const result = await deleteMemberAccount({
    userId: String(formData.get("userId") || ""),
    confirmEmail: String(formData.get("confirmEmail") || ""),
    cancelSubscription: formData.get("cancelSubscription") === "true",
    cancelPhrase: String(formData.get("cancelPhrase") || ""),
    deleteStripeCustomer: formData.get("deleteStripeCustomer") === "true",
    deleteCustomerPhrase: String(formData.get("deleteCustomerPhrase") || ""),
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/members");
    revalidatePath("/admin/subscriptions");
    revalidatePath("/admin/activity");
  }
  return result;
}
