import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { showOrdersToCsv } from "@/lib/show-csv";
import { listShowOrders } from "@/lib/show-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const csv = showOrdersToCsv(await listShowOrders());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="set-apart-backup.csv"',
      "Cache-Control": "no-store",
    },
  });
}
