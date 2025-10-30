import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';

const EditStudentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  studentId: z.string().min(1),
  feeStatus: z.string().min(1),
  gender: z.enum(['Male','Female','Other']),
  joinDate: z.string().min(4),
  phone: z.string().optional(),
});

export async function PATCH(req, { params }) {
  const body = await req.json();
  const parsed = EditStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, studentId, feeStatus, gender, joinDate, phone } = parsed.data;
  const supabase = getSupabaseServerClient();

  // Find the student + user IDs for update
  const { data: stu, error: findErr } = await supabase.from('students').select('id,user_id').eq('id', params.id).maybeSingle();
  if (findErr || !stu) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  // Update users table
  const { error: userErr } = await supabase.from('users').update({ name, email: email.toLowerCase(), phone: phone || null }).eq('id', stu.user_id);
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 400 });
  // Update students
  const { error: stuErr } = await supabase.from('students').update({
    student_id: studentId,
    fee_status: feeStatus,
    gender,
    join_date: joinDate,
    phone: phone || null,
  }).eq('id', params.id);
  if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const supabase = getSupabaseServerClient();
  // Optionally: also remove user row (cascade deletes student row)
  // First, get student and user_id
  const { data: stu, error } = await supabase.from('students').select('user_id').eq('id', params.id).maybeSingle();
  if (error || !stu) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  const { error: delErr } = await supabase.from('users').delete().eq('id', stu.user_id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
