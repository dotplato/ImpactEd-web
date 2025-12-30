-- Add status to assignment_submissions
alter table public.assignment_submissions add column if not exists status text default 'pending';

-- Update existing submissions to 'graded' if they have a grade
update public.assignment_submissions set status = 'graded' where grade is not null;
