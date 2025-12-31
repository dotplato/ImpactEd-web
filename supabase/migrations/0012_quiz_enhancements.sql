-- Add attachment_required to quizzes
alter table public.quizzes add column if not exists attachment_required boolean default false;
