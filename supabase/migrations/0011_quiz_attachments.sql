-- Quiz Attachments
create table if not exists public.quiz_attachments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_attachments_quiz on public.quiz_attachments(quiz_id);

-- Quiz Submission Attachments
create table if not exists public.quiz_submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_submission_attachments_submission on public.quiz_submission_attachments(submission_id);

-- RLS
alter table public.quiz_attachments enable row level security;
alter table public.quiz_submission_attachments enable row level security;

-- Policies for Quiz Attachments
create policy "Teachers can manage quiz_attachments"
  on public.quiz_attachments for all
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
      and q.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

create policy "Students can view quiz_attachments for assigned quizzes"
  on public.quiz_attachments for select
  using (
    exists (
      select 1 from public.quiz_students qs
      where qs.quiz_id = quiz_id
      and qs.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

-- Policies for Quiz Submission Attachments
create policy "Students can manage their quiz_submission_attachments"
  on public.quiz_submission_attachments for all
  using (
    exists (
      select 1 from public.quiz_submissions s
      where s.id = submission_id
      and s.student_id = (select id from public.students where user_id = auth.uid())
    )
  );

create policy "Teachers can view quiz_submission_attachments for their quizzes"
  on public.quiz_submission_attachments for select
  using (
    exists (
      select 1 from public.quiz_submissions s
      join public.quizzes q on q.id = s.quiz_id
      where s.id = submission_id
      and q.created_by = (select id from public.teachers where user_id = auth.uid())
    )
  );

-- Storage buckets (reusing existing buckets or creating new ones if needed)
-- We'll reuse 'assignment-attachments' and 'submission-attachments' buckets for simplicity, 
-- or create new ones if strict separation is desired. 
-- Let's create specific buckets for quizzes to be clean.

insert into storage.buckets (id, name, public)
values ('quiz-attachments', 'quiz-attachments', true)
on conflict (id) do nothing;

create policy "Anyone can upload quiz attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'quiz-attachments' );

create policy "Anyone can read quiz attachments"
on storage.objects for select
to public
using ( bucket_id = 'quiz-attachments' );

insert into storage.buckets (id, name, public)
values ('quiz-submission-attachments', 'quiz-submission-attachments', true)
on conflict (id) do nothing;

create policy "Anyone can upload quiz submission attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'quiz-submission-attachments' );

create policy "Anyone can read quiz submission attachments"
on storage.objects for select
to public
using ( bucket_id = 'quiz-submission-attachments' );
