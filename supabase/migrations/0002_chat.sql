-- Chat feature schema

-- Enum for conversation types
create type public.conversation_type as enum ('direct', 'group');

-- Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  course_id uuid references public.courses(id) on delete cascade, -- For course groups
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_conversations_course on public.conversations(course_id);

-- Conversation participants (mainly for DMs, but can be used for groups if needed for specific overrides, 
-- though course groups are dynamic based on enrollment)
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_participants_user on public.conversation_participants(user_id);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Policies will be handled via application logic for now as per plan, 
-- or we can add basic ones. Since we are using server-side logic with Supabase client 
-- that might bypass RLS if using service role, but for client-side we need them.
-- For this implementation, we will rely on server actions which verify roles.
