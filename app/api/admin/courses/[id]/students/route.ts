import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req, { params }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "teacher")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const courseId = params.id;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_students")
    .select("student:students(id, user:users(id, name, email))")
    .eq("course_id", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const students = (data ?? []).map(cs => {
    const u = cs.student?.user || {};
    return { id: cs.student?.id, name: u.name, email: u.email };
  });
  return NextResponse.json({ students });
}
