import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const CreateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  teacherId: z.string().uuid().nullable().optional(),
  tenureStart: z.string().optional(),
  tenureEnd: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, description, teacherId, tenureStart, tenureEnd } = parsed.data;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description,
      teacher_id: teacherId ?? null,
      tenure_start: tenureStart || null,
      tenure_end: tenureEnd || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}


