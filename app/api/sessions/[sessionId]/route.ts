import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { NextRequest } from "next/server";
import { deleteDailyRoom } from "@/lib/integrations/daily";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;
  const body = await req.json();
  const updateSchema = z.object({
    title: z.string().optional(),
    scheduledAt: z.string().optional(),
    durationMinutes: z.number().int().min(1).optional(),
  });
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = getSupabaseServerClient();
  // Session lookup & permissions
  const { data: session, error } = await supabase.from("course_sessions").select("id, teacher_id").eq("id", sessionId).maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let canUpdate = false;
  if (user.role === "admin") canUpdate = true;
  if (user.role === "teacher") {
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if ((teacher as any)?.id && (teacher as any).id === (session as any).teacher_id) canUpdate = true;
  }
  if (!canUpdate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Update fields
  const updateObj: any = {};
  if (parsed.data.title !== undefined) updateObj.title = parsed.data.title;
  if (parsed.data.scheduledAt !== undefined) updateObj.scheduled_at = new Date(parsed.data.scheduledAt).toISOString();
  if (parsed.data.durationMinutes !== undefined) updateObj.duration_minutes = parsed.data.durationMinutes;
  const { error: updErr } = await supabase.from("course_sessions").update(updateObj).eq("id", sessionId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase.from("course_sessions").select("id, teacher_id").eq("id", sessionId).maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let canDelete = false;
  if (user.role === "admin") canDelete = true;
  if (user.role === "teacher") {
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if ((teacher as any)?.id && (teacher as any).id === (session as any).teacher_id) canDelete = true;
  }
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get Daily.co room ID before deleting session
  const { data: sessionToDelete } = await supabase
    .from("course_sessions")
    .select("daily_room_id")
    .eq("id", sessionId)
    .maybeSingle();

  const { error: delErr } = await supabase.from("course_sessions").delete().eq("id", sessionId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Clean up Daily.co room if it exists
  if (sessionToDelete?.daily_room_id) {
    try {
      await deleteDailyRoom(sessionToDelete.daily_room_id);
    } catch (cleanupError) {
      // Log but don't fail - room might already be deleted or expired
      console.error("Failed to cleanup Daily.co room:", cleanupError);
    }
  }

  return NextResponse.json({ ok: true });
}
