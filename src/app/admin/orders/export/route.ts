import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import { ordersToCsv } from "@/lib/admin-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdmin();
  const showArchived = new URL(request.url).searchParams.get("archived") === "1";
  const data = await getAdminData();
  const orders = showArchived ? data.orders : data.orders.filter((order) => !order.archived);
  return new NextResponse(ordersToCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hero-orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
