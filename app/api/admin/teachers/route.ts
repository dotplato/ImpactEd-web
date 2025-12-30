import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';

const CreateTeacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  joinDate: z.string().min(4), // ISO
  phone: z.string().optional(),
  qualification: z.string().optional(),
  profile_pic: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateTeacherSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, email, password, joinDate, phone, qualification, profile_pic } = parsed.data;
  const supabase = getSupabaseServerClient();

  // Check for existing email
  const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

  // 1. Insert user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .insert({ email: email.toLowerCase(), name, role: 'teacher', phone: phone || null, image_url: profile_pic || null })
    .select('id')
    .single();
  if (userErr || !user) return NextResponse.json({ error: userErr?.message || 'Could not create user' }, { status: 400 });

  // 2. Password
  const hash = await bcrypt.hash(password, 10);
  const { error: credErr } = await supabase.from('password_credentials').insert({ user_id: user.id, password_hash: hash });
  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 400 });

  // 3. Insert teacher row
  const { error: tErr } = await supabase.from('teachers').insert({
    user_id: user.id,
    join_date: joinDate,
    phone: phone || null,
    qualification: qualification || null,
  });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Also GET for table, show all fields
export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, join_date, phone, qualification, user:users(id, email, name, image_url)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ teachers: data ?? [] });
}


