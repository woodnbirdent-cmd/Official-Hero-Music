import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { adminSecurityHeaders } from "@/lib/admin-security";

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function withAdminHeaders(response: NextResponse, https: boolean, nonce: string): NextResponse {
  for (const [key, value] of adminSecurityHeaders(https, nonce)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const nonce = createNonce();
    const https = request.nextUrl.protocol === "https:";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", `${pathname}${search}`);
    const csp = adminSecurityHeaders(https, nonce).find(([key]) => key === "Content-Security-Policy")?.[1];
    if (csp) requestHeaders.set("content-security-policy", csp);

    const signInFlow = pathname === "/admin/sign-in" || pathname.startsWith("/admin/sign-in/");
    if (!signInFlow && !getSessionCookie(request)) {
      const signIn = new URL("/admin/sign-in", request.url);
      signIn.searchParams.set("next", `${pathname}${search}`);
      return withAdminHeaders(NextResponse.redirect(signIn), https, nonce);
    }
    return withAdminHeaders(NextResponse.next({ request: { headers: requestHeaders } }), https, nonce);
  }

  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/members", "/members/:path*", "/account", "/admin", "/admin/:path*"],
};
