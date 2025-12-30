import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';

const CreateStudentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  studentId: z.string().min(1),
  joinDate: z.string().min(4), // ISO date
  feeStatus: z.string().min(1),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().optional(),
  image_url: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, studentId, joinDate, feeStatus, gender, phone, image_url } = parsed.data;
  const supabase = getSupabaseServerClient();

  // 1. Ensure email not used
  const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

  // 2. Create user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .insert({ email: email.toLowerCase(), name, role: 'student', phone: phone || null, image_url: image_url || null })
    .select('id')
    .single();
  if (userErr || !user) return NextResponse.json({ error: userErr?.message || 'Could not create user' }, { status: 400 });

  // 3. Hash password and insert
  const hash = await bcrypt.hash(password, 10);
  const { error: credErr } = await supabase.from('password_credentials').insert({ user_id: user.id, password_hash: hash });
  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 400 });

  // 4. Create students row
  const { error: stuErr } = await supabase.from('students').insert({
    user_id: user.id,
    student_id: studentId,
    join_date: joinDate,
    fee_status: feeStatus,
    gender,
    phone: phone || null,
  });
  if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  // For admin UI table: all students, and for course creation (list all actual student users)
  // If ?all=true is query, return all student users
  const search = (typeof window === 'undefined') ? '' : window.location?.search;
  // Always just return all students for now (all rows with users)
  const { data, error } = await supabase
    .from("students")
    .select("id, user_id, student_id, gender, user:users(id, email, name, image_url)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ students: data ?? [] });
}
