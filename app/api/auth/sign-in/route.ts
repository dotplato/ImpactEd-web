import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const SESSION_COOKIE = "ba_session";
const SESSION_TTL_DAYS = 14;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SignInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const supabase = getSupabaseServerClient();

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (userErr || !user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const { data: cred, error: credErr } = await supabase
      .from("password_credentials")
      .select("password_hash")
      .eq("user_id", user.id)
      .maybeSingle();
    if (credErr || !cred) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const valid = await bcrypt.compare(password, cred.password_hash);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const sessionToken = crypto.randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
    const ua = req.headers.get("user-agent") ?? undefined;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;

    const { error: sessErr } = await supabase.from("sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      user_agent: ua,
      ip_address: ip,
      expires_at: expires.toISOString(),
    });
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

    const store = await cookies();
    store.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires,
    });

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


