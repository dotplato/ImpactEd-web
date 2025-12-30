-- Function to check if a direct conversation exists between two users
create or replace function get_direct_chat_id(user1_id uuid, user2_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  conv_id uuid;
begin
  select c.id into conv_id
  from conversations c
  join conversation_participants cp1 on c.id = cp1.conversation_id
  join conversation_participants cp2 on c.id = cp2.conversation_id
  where c.type = 'direct'
    and cp1.user_id = user1_id
    and cp2.user_id = user2_id
  limit 1;
  
  return conv_id;
end;
$$;
