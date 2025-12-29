import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SESSION_COOKIE = "ba_session";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    // If unauthenticated and accessing protected routes, redirect to sign-in
    if (pathname === "/" || pathname.startsWith("/admin") || 
        pathname.startsWith("/teacher/") || pathname === "/teacher" ||
        pathname.startsWith("/student/") || pathname === "/student" ||
        pathname.startsWith("/courses") || pathname.startsWith("/sessions") || 
        pathname.startsWith("/teachers") || pathname.startsWith("/students")) {
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

  // If authenticated user tries to access auth pages, send them to dashboard
  if (pathname === "/sign-in" || pathname === "/sign-up" || pathname.startsWith("/(auth)")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect old admin routes to root dashboard
  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Role-based gates for old role-specific routes (redirect to dashboard)
  // Only redirect singular /teacher and /student routes, not plural /teachers and /students
  // Note: pathname.startsWith("/teacher/") will NOT match "/teachers" because "/teachers" doesn't start with "/teacher/"
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname === "/student" || pathname.startsWith("/student/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Allow all other routes including /teachers and /students to pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/courses/:path*",
    "/sessions/:path*",
    "/teachers/:path*",
    "/students/:path*",
    "/sign-in",
    "/sign-up",
    "/(auth)/:path*",
  ],
};


