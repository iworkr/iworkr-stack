/**
 * @middleware RootMiddleware
 * @status COMPLETE
 * @description Next.js root middleware — multi-tenant site routing + Supabase session refresh
 * @risk P2 — Non–iWorkr hosts (not *.vercel.app) rewrite to /site-render/* without updateSession — intentional public surface; dashboard hosts must stay in IWORKR_HOSTS.
 * @lastAudit 2026-03-28
 */
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const IWORKR_HOSTS = new Set([
  "iworkrapp.com",
  "www.iworkrapp.com",
  "localhost",
]);

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.replace(/:\d+$/, "") ?? "";

  if (
    hostname &&
    !IWORKR_HOSTS.has(hostname) &&
    !hostname.endsWith(".vercel.app")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/site-render/${hostname}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
