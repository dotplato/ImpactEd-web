-- Prevent duplicate group conversations for the same course
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_course_unique ON public.conversations (course_id) WHERE (type = 'group');
