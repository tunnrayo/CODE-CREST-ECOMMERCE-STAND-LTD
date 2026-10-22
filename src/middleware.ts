import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge pre-check for the admin area: no session cookie → login page.
 * This is only a convenience redirect; every admin page, server action and
 * API route performs a full server-side session + role check.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.get("cc_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (pathname.startsWith("/admin")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
