-- Add image_url to users table
alter table public.users add column if not exists image_url text;

-- Migrate existing teacher profile pictures to users table
update public.users u
set image_url = t.profile_pic
from public.teachers t
where t.user_id = u.id
and t.profile_pic is not null;

-- Note: We keep teachers.profile_pic for now to avoid breaking existing code, 
-- but we should eventually phase it out.
