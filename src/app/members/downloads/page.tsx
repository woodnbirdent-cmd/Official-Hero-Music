import type { Metadata } from "next";
import MemberFeed from "@/components/membership/MemberFeed";
import { MEMBER_CONTENT } from "@/lib/member-content";
import { requireTier } from "@/lib/members";

export const metadata: Metadata = {
  title: "Downloads",
  description: "VIP member downloads.",
};

export default async function DownloadsPage() {
  await requireTier("vip", "/members/downloads");

  return (
    <>
      <h1 className="graffiti-heading mb-6">Downloads</h1>
      <MemberFeed
        items={MEMBER_CONTENT.downloads}
        empty="No free downloads right now. VIP files will show up here."
      />
    </>
  );
}
