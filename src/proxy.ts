import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (["/admin/login", "/admin/owners", "/admin/branch-menu"].includes(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
