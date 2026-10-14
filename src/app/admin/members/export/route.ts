import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { filterMembers, getAdminData } from "@/lib/admin-data";
import { membersToCsv } from "@/lib/admin-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdmin();
  const query = new URL(request.url).searchParams.get("q") || "";
  const data = await getAdminData();
  return new NextResponse(membersToCsv(filterMembers(data.members, query.slice(0, 100))), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hero-members.csv"',
      "Cache-Control": "no-store",
    },
  });
}
