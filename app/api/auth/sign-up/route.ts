import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SignUpSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "teacher", "student"]).default("student"),
});

const SESSION_COOKIE = "ba_session";
const SESSION_TTL_DAYS = 14;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password, name, role } = parsed.data;
    const supabase = getSupabaseServerClient();

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error: userErr } = await supabase
      .from("users")
      .insert({ email, name, role })
      .select("id, email, role")
      .single();
    if (userErr || !user) return NextResponse.json({ error: userErr?.message || "Failed to create user" }, { status: 400 });

    const { error: credErr } = await supabase
      .from("password_credentials")
      .insert({ user_id: user.id, password_hash: passwordHash });
    if (credErr) return NextResponse.json({ error: credErr.message }, { status: 400 });

    if (role === "teacher") {
      await supabase.from("teachers").insert({ user_id: user.id }).select("id");
    } else if (role === "student") {
      await supabase.from("students").insert({ user_id: user.id }).select("id");
    }

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


