import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { adminSecurityHeaders } from "@/lib/admin-security";

function applyAdminSecurityHeaders(response: NextResponse, request: NextRequest): void {
  const { pathname } = request.nextUrl;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return;
  for (const [key, value] of adminSecurityHeaders(request.nextUrl.protocol === "https:")) {
    response.headers.set(key, value);
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", `${pathname}${search}`);
    if (pathname === "/admin/sign-in") {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      applyAdminSecurityHeaders(response, request);
      return response;
    }
    if (!getSessionCookie(request)) {
      const signIn = new URL("/admin/sign-in", request.url);
      signIn.searchParams.set("next", `${pathname}${search}`);
      const response = NextResponse.redirect(signIn);
      applyAdminSecurityHeaders(response, request);
      return response;
    }
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applyAdminSecurityHeaders(response, request);
    return response;
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
