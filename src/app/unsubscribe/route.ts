import { unsubscribeDocument } from "@/lib/broadcast-copy";
import { unsubscribeFromBroadcast } from "@/lib/broadcast-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

async function respond(request: Request, html: boolean): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") || "";
  const result = await unsubscribeFromBroadcast(token);
  const status = result === "ok" ? 200 : result === "invalid" ? 400 : 503;
  if (!html) {
    const text = result === "ok" ? "Unsubscribed" : result === "invalid" ? "Invalid link" : "Try again";
    return new Response(text, {
      status,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(unsubscribeDocument(result), {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
  });
}

/** One click from the email footer. Opening the link unsubscribes. */
export async function GET(request: Request): Promise<Response> {
  return respond(request, true);
}

/** Mail-client one-click (List-Unsubscribe-Post). */
export async function POST(request: Request): Promise<Response> {
  return respond(request, false);
}
