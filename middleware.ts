import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SESSION_COOKIE = "ba_session";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    // If unauthenticated and accessing protected routes, redirect to sign-in
    if (pathname.startsWith("/admin") || pathname.startsWith("/teacher") || pathname.startsWith("/student")) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    return NextResponse.next();
  }

  // Fetch user + role
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("user_id, users:users(id, role)")
    .eq("session_token", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data?.users) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const role = (data.users as any).role as "admin" | "teacher" | "student";

  // If authenticated user tries to access auth pages, send them to their role home
  if (pathname === "/sign-in" || pathname === "/sign-up" || pathname.startsWith("/(auth)")) {
    const redirectTo = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // Role-based gates
  if (pathname.startsWith("/admin") && role !== "admin") {
    const redirectTo = role === "teacher" ? "/teacher" : "/student";
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }
  if (pathname.startsWith("/teacher") && role !== "teacher") {
    const redirectTo = role === "admin" ? "/admin" : "/student";
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }
  if (pathname.startsWith("/student") && role !== "student") {
    const redirectTo = role === "admin" ? "/admin" : "/teacher";
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // No generic (dashboard) route; role-specific routes only

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    
    "/sign-in",
    "/sign-up",
    "/(auth)/:path*",
  ],
};


