import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/auth";
import { currentMember } from "@/lib/members";

export const runtime = "nodejs";

export async function GET() {
  if (!accountsConfigured()) {
    return NextResponse.json({ configured: false, member: null });
  }
  const member = await currentMember();
  if (!member) return NextResponse.json({ configured: true, member: null });
  return NextResponse.json({
    configured: true,
    member: {
      email: member.email,
      name: member.name,
      tier: member.tier,
    },
  });
}
