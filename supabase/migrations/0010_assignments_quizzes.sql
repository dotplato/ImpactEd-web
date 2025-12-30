-- Update assignments table
alter table public.assignments add column if not exists total_marks numeric;
alter table public.assignments add column if not exists min_pass_marks numeric;

-- Assignment students (for selective assignment)
create table if not exists public.assignment_students (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  unique(assignment_id, student_id)
);
create index if not exists idx_assignment_students_assignment on public.assignment_students(assignment_id);
create index if not exists idx_assignment_students_student on public.assignment_students(student_id);

-- Quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  total_marks numeric,
  min_pass_marks numeric,
  created_by uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_quizzes_course on public.quizzes(course_id);

-- Quiz questions
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice', -- multiple_choice, short_answer, etc.
  options jsonb, -- for multiple choice
  correct_answer text,
  points numeric default 1,
  sort_order int default 0
);
create index if not exists idx_quiz_questions_quiz on public.quiz_questions(quiz_id);

-- Quiz students (for selective assignment)
create table if not exists public.quiz_students (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  unique(quiz_id, student_id)
);
create index if not exists idx_quiz_students_quiz on public.quiz_students(quiz_id);
create index if not exists idx_quiz_students_student on public.quiz_students(student_id);

-- Quiz submissions
create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb,
  score numeric,
  submitted_at timestamptz not null default now(),
  unique(quiz_id, student_id)
);
create index if not exists idx_quiz_submissions_quiz on public.quiz_submissions(quiz_id);
create index if not exists idx_quiz_submissions_student on public.quiz_submissions(student_id);

-- RLS
alter table public.assignment_students enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_students enable row level security;
alter table public.quiz_submissions enable row level security;

-- Policies

-- Assignment Students policies
create policy "Teachers can manage assignment_students"
  on public.assignment_students for all
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
      and a.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

create policy "Students can view their assignment_students"
  on public.assignment_students for select
  using (
    student_id = (select id from public.students where user_id = auth.uid())
  );

-- Quizzes policies
create policy "Teachers can manage their quizzes"
  on public.quizzes for all
  using (created_by = (select id from public.teachers where user_id = auth.uid()));

create policy "Students can view assigned quizzes"
  on public.quizzes for select
  using (
    exists (
      select 1 from public.quiz_students qs
      where qs.quiz_id = id
      and qs.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

-- Quiz Questions policies
create policy "Teachers can manage quiz questions"
  on public.quiz_questions for all
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
      and q.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

create policy "Students can view quiz questions for assigned quizzes"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.quiz_students qs
      where qs.quiz_id = quiz_id
      and qs.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

-- Quiz Students policies
create policy "Teachers can manage quiz_students"
  on public.quiz_students for all
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
      and q.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

create policy "Students can view their quiz_students"
  on public.quiz_students for select
  using (
    student_id = (select id from public.students where user_id = auth.uid())
  );

-- Quiz Submissions policies
create policy "Students can manage their quiz submissions"
  on public.quiz_submissions for all
  using (student_id = (select id from public.students where user_id = auth.uid()));

create policy "Teachers can view submissions for their quizzes"
  on public.quiz_submissions for select
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
      and q.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

-- Update Assignments policies to restrict student view to assigned ones
-- (Assuming base policies might exist or need to be added)
create policy "Students can view assigned assignments"
  on public.assignments for select
  using (
    exists (
      select 1 from public.assignment_students as_table
      where as_table.assignment_id = id
      and as_table.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

create policy "Teachers can manage their assignments"
  on public.assignments for all
  using (created_by = (select id from public.teachers where user_id = auth.uid()));

-- Assignment Attachments policies
create policy "Teachers can manage assignment_attachments"
  on public.assignment_attachments for all
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
      and a.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

create policy "Students can view assigned assignment_attachments"
  on public.assignment_attachments for select
  using (
    exists (
      select 1 from public.assignment_students as_table
      where as_table.assignment_id = assignment_id
      and as_table.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

-- Assignment Submissions policies
create policy "Students can manage their assignment_submissions"
  on public.assignment_submissions for all
  using (student_id = (select id from public.students where user_id = auth.uid()));

create policy "Teachers can view submissions for their assignments"
  on public.assignment_submissions for select
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
      and a.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

-- Submission Attachments policies
create policy "Students can manage their submission_attachments"
  on public.submission_attachments for all
  using (
    exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id
      and s.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

create policy "Teachers can view submission_attachments for their assignments"
  on public.submission_attachments for select
  using (
    exists (
      select 1 from public.assignment_submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = submission_id
      and a.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

-- Storage for assignment attachments
insert into storage.buckets (id, name, public)
values ('assignment-attachments', 'assignment-attachments', true)
on conflict (id) do nothing;

create policy "Anyone can upload assignment attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'assignment-attachments' );

create policy "Anyone can read assignment attachments"
on storage.objects for select
to public
using ( bucket_id = 'assignment-attachments' );

-- Storage for submission attachments
insert into storage.buckets (id, name, public)
values ('submission-attachments', 'submission-attachments', true)
on conflict (id) do nothing;

create policy "Anyone can upload submission attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'submission-attachments' );

create policy "Anyone can read submission attachments"
on storage.objects for select
to public
using ( bucket_id = 'submission-attachments' );
