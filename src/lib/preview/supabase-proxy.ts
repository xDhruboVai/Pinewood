// Frontend preview only: stands in for src/lib/supabase/proxy.ts when PW_PREVIEW=1. The preview is
// always signed in, so /admin pages open straight away (the login page still renders if visited).
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
