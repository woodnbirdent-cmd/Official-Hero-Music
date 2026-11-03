import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", `${pathname}${search}`);
    if (pathname === "/admin/sign-in") {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!getSessionCookie(request)) {
      const signIn = new URL("/admin/sign-in", request.url);
      signIn.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
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
