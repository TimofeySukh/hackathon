update public.tags as tags
set color = seed.color
from (
  values
    ('work', '#ff4d4d'),
    ('friends', '#3f7cff'),
    ('family', '#39c795')
) as seed(normalized_name, color)
where tags.normalized_name = seed.normalized_name
  and tags.color = '#8affd6';
