import type { Metadata } from "next";
import MemberFeed from "@/components/membership/MemberFeed";
import { MEMBER_CONTENT } from "@/lib/member-content";
import { requireTier } from "@/lib/members";

export const metadata: Metadata = {
  title: "Member updates",
  description: "Updates for #Hero members.",
};

export default async function MembersPage() {
  await requireTier("free", "/members");

  return (
    <>
      <h1 className="graffiti-heading mb-6">Updates</h1>
      <MemberFeed items={MEMBER_CONTENT.updates} empty="No updates yet." />
    </>
  );
}
