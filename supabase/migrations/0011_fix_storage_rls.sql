
-- Re-create policies with 'to public' to allow anonymous uploads (needed for better-auth)
-- If you get "must be owner" errors, try running these one by one in the Supabase SQL Editor.
-- Note: We assume RLS is already enabled on storage.objects (it is by default).

-- Assignment Attachments
DO $$ BEGIN
    drop policy if exists "Anyone can upload assignment attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload assignment attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can upload assignment attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'assignment-attachments' );

DO $$ BEGIN
    drop policy if exists "Anyone can read assignment attachments" on storage.objects;
    drop policy if exists "Authenticated users can read assignment attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can read assignment attachments"
on storage.objects for select
to public
using ( bucket_id = 'assignment-attachments' );

-- Submission Attachments
DO $$ BEGIN
    drop policy if exists "Anyone can upload submission attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload submission attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can upload submission attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'submission-attachments' );

DO $$ BEGIN
    drop policy if exists "Anyone can read submission attachments" on storage.objects;
    drop policy if exists "Authenticated users can read submission attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can read submission attachments"
on storage.objects for select
to public
using ( bucket_id = 'submission-attachments' );

-- Chat Attachments
DO $$ BEGIN
    drop policy if exists "Anyone can upload chat attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can upload chat attachments"
on storage.objects for insert
to public
with check ( bucket_id = 'chat-attachments' );

DO $$ BEGIN
    drop policy if exists "Anyone can read chat attachments" on storage.objects;
    drop policy if exists "Authenticated users can read chat attachments" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can read chat attachments"
on storage.objects for select
to public
using ( bucket_id = 'chat-attachments' );

-- Avatars
DO $$ BEGIN
    drop policy if exists "Anyone can upload avatars" on storage.objects;
    drop policy if exists "Authenticated users can upload avatars" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can upload avatars"
on storage.objects for insert
to public
with check ( bucket_id = 'avatars' );

DO $$ BEGIN
    drop policy if exists "Anyone can read avatars" on storage.objects;
    drop policy if exists "Authenticated users can read avatars" on storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

create policy "Anyone can read avatars"
on storage.objects for select
to public
using ( bucket_id = 'avatars' );
