-- LMS core schema

-- Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tenure_start date,
  tenure_end date,
  teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_courses_teacher on public.courses(teacher_id);

-- Course enrollments
create table if not exists public.course_students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(course_id, student_id)
);
create index if not exists idx_course_students_course on public.course_students(course_id);
create index if not exists idx_course_students_student on public.course_students(student_id);

-- Course outline
create table if not exists public.course_outline_topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);
create index if not exists idx_outline_topics_course on public.course_outline_topics(course_id);

create table if not exists public.course_outline_subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.course_outline_topics(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);
create index if not exists idx_outline_subtopics_topic on public.course_outline_subtopics(topic_id);

-- Course schedules (simple weekly rule JSON)
create table if not exists public.course_schedules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  rule jsonb not null,
  timezone text not null,
  start_time text not null, -- HH:mm
  duration_minutes int not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_course_schedules_course on public.course_schedules(course_id);

-- Course sessions (avoid collision with auth.sessions)
create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  course_id uuid references public.courses(id) on delete set null,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null,
  status text not null default 'upcoming', -- upcoming/completed/cancelled
  created_at timestamptz not null default now()
);
create index if not exists idx_course_sessions_teacher on public.course_sessions(teacher_id);
create index if not exists idx_course_sessions_course on public.course_sessions(course_id);
create index if not exists idx_course_sessions_scheduled_at on public.course_sessions(scheduled_at);

create table if not exists public.session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  unique(session_id, student_id)
);
create index if not exists idx_session_students_session on public.session_students(session_id);
create index if not exists idx_session_students_student on public.session_students(student_id);

-- Assignments
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description_richjson jsonb,
  due_at timestamptz,
  created_by uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_assignments_course on public.assignments(course_id);

create table if not exists public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime text
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  content_richjson jsonb,
  submitted_at timestamptz,
  grade numeric,
  unique(assignment_id, student_id)
);
create index if not exists idx_assignment_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_assignment_submissions_student on public.assignment_submissions(student_id);

create table if not exists public.submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime text
);

-- Course files and lesson videos
create table if not exists public.course_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime text,
  created_at timestamptz not null default now()
);
create index if not exists idx_course_files_course on public.course_files(course_id);

create table if not exists public.lesson_videos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  file_path text not null,
  duration_seconds int,
  created_at timestamptz not null default now()
);
create index if not exists idx_lesson_videos_course on public.lesson_videos(course_id);

-- Enable RLS (policies to be added separately)
alter table public.courses enable row level security;
alter table public.course_students enable row level security;
alter table public.course_outline_topics enable row level security;
alter table public.course_outline_subtopics enable row level security;
alter table public.course_schedules enable row level security;
alter table public.course_sessions enable row level security;
alter table public.session_students enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_attachments enable row level security;
alter table public.course_files enable row level security;
alter table public.lesson_videos enable row level security;


