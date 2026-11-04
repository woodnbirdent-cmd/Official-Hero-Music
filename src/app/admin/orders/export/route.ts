import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ordersToCsv } from "@/lib/admin-csv";
import { getAdminData } from "@/lib/admin-data";
import { filterOrders, isOrderType } from "@/lib/admin-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const type = isOrderType(url.searchParams.get("type")) ? url.searchParams.get("type") || "" : "";
  const query = (url.searchParams.get("q") || "").slice(0, 100);
  const data = await getAdminData();
  const orders = filterOrders(data.orders, type, query);
  return new NextResponse(ordersToCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hero-orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
