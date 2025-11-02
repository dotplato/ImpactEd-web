import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const BUCKET = "course-files";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = params.id;
  const supabase = getSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from("course_files")
      .select("id, file_name, file_path, mime, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ files: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = params.id;
  const supabase = getSupabaseServerClient();
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    // Ensure bucket exists and is public (best effort)
    try {
      // createBucket is idempotent for our purposes; ignore error if it already exists
      // @ts-ignore - types may not include admin methods
      await supabase.storage.createBucket(BUCKET, { public: true });
    } catch {}
    const ext = file.name.split(".").pop();
    const key = `${courseId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, new Uint8Array(arrayBuffer), { upsert: false, contentType: file.type || undefined });
    if (upErr) throw new Error(upErr.message);
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(key).publicUrl;
    const { error: insErr } = await supabase.from("course_files").insert({ course_id: courseId, file_name: file.name, file_path: publicUrl, mime: file.type || null });
    if (insErr) throw new Error(insErr.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


