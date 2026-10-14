import type { Metadata } from "next";
import MemberFeed from "@/components/membership/MemberFeed";
import { MEMBER_CONTENT } from "@/lib/member-content";
import { requireTier } from "@/lib/members";

export const metadata: Metadata = {
  title: "Early access",
  description: "Early drops for Supporter and VIP members.",
};

export default async function EarlyAccessPage() {
  await requireTier("supporter", "/members/early-access");

  return (
    <>
      <h1 className="graffiti-heading mb-6">Early access</h1>
      <MemberFeed
        items={MEMBER_CONTENT.earlyAccess}
        empty="No early drops yet. Supporter and VIP members will see them here."
      />
    </>
  );
}
