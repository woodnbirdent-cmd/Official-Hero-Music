import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/members", "/members/:path*", "/account"],
};
