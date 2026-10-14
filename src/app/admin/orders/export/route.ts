import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import { ordersToCsv } from "@/lib/admin-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const data = await getAdminData();
  return new NextResponse(ordersToCsv(data.orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hero-orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
