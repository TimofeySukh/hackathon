alter table public.person_ai_notes
  add column if not exists structured_summary jsonb not null default '{}'::jsonb,
  add column if not exists error_message text;

update public.person_ai_notes
set structured_summary = jsonb_build_object(
  'summary',
  coalesce(summary, ''),
  'traits',
  '[]'::jsonb,
  'interests',
  '[]'::jsonb,
  'relationship_context',
  '[]'::jsonb,
  'open_questions',
  '[]'::jsonb
)
where structured_summary = '{}'::jsonb;

alter table public.person_ai_notes
  drop constraint if exists person_ai_notes_status_check;

alter table public.person_ai_notes
  add constraint person_ai_notes_status_check
  check (status in ('not_created', 'pending', 'created', 'error'));
