-- Add attachments column to messages table
alter table messages
add column attachments jsonb[] default null;

-- Attempt to create storage bucket for chat attachments
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- RLS Policies for storage
create policy "Anyone can upload chat attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'chat-attachments' );

create policy "Anyone can read chat attachments"
on storage.objects for select
to public
using ( bucket_id = 'chat-attachments' );
