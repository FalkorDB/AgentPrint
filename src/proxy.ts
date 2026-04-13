import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public paths: home, project pages, their APIs, login, auth, static assets
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api-docs") ||
    pathname.startsWith("/projects/") ||
    pathname.match(/^\/api\/projects\/[^/]+\/[^/]+\/(metrics|stars|badge)$/) ||
    (pathname === "/api/projects" && req.method === "GET") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/og-image.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png"
  ) {
    return NextResponse.next();
  }

  // API requests with Authorization header bypass middleware redirect —
  // each route validates the token inline via apiAuth()
  if (pathname.startsWith("/api/") && req.headers.get("authorization")) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
