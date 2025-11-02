import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const BUCKET = "course-files";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; fileId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseServerClient();
  try {
    const { data: row, error: gErr } = await supabase.from("course_files").select("id, file_path").eq("id", params.fileId).maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Try to delete from storage if path is within our bucket (best effort)
    try {
      const url = new URL(row.file_path);
      const parts = url.pathname.split("/object/public/");
      const key = parts[1]?.replace(`${BUCKET}/`, "");
      if (key) {
        await supabase.storage.from(BUCKET).remove([key]);
      }
    } catch {}

    const { error: dErr } = await supabase.from("course_files").delete().eq("id", params.fileId);
    if (dErr) throw new Error(dErr.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


