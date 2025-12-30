-- Add last_read_at to conversation_participants
alter table public.conversation_participants 
add column if not exists last_read_at timestamptz not null default now();
