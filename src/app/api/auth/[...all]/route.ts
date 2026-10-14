import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { accountsConfigured, auth } from "@/lib/auth";
import { ensureSchema } from "@/lib/members";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);

function unconfigured() {
  return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
}

async function ready(request: Request) {
  if (!accountsConfigured()) return unconfigured();
  try {
    await ensureSchema();
  } catch (error) {
    console.error("Account schema setup failed", error);
    return NextResponse.json({ error: "Accounts are not ready." }, { status: 503 });
  }
  return request;
}

export async function GET(request: Request) {
  const prepared = await ready(request);
  if (prepared instanceof NextResponse) return prepared;
  return handler.GET(prepared);
}

export async function POST(request: Request) {
  const prepared = await ready(request);
  if (prepared instanceof NextResponse) return prepared;
  return handler.POST(prepared);
}
