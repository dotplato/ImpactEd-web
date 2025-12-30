-- Change attachments column from jsonb[] to jsonb for better compatibility with JSON arrays
alter table public.messages 
alter column attachments type jsonb using to_jsonb(attachments);

comment on column public.messages.attachments is 'Stored as a JSON array of attachment objects';
