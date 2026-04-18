alter table public.tags
add column if not exists color text not null default '#8affd6';

alter table public.tags
drop constraint if exists tags_color_hex_check;

alter table public.tags
add constraint tags_color_hex_check
check (color ~ '^#[0-9A-Fa-f]{6}$');

insert into public.tags (user_id, name, color)
select users.id, seed.name, seed.color
from auth.users as users
cross join (
  values
    ('Work', '#ff4d4d'),
    ('Friends', '#3f7cff'),
    ('Family', '#39c795')
) as seed(name, color)
on conflict (user_id, normalized_name) do nothing;
