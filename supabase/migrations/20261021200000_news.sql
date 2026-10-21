-- Leçons d'actualité : une notizia adaptée d'une dépêche, partagée entre membres.
-- Écrite une fois (par le premier membre qui l'ouvre), lue par tous, jamais modifiée depuis l'app.
create table if not exists public.news_lessons (
  id         text primary key check (id ~ '^n-[0-9a-f]{16}-(a2|b1)$'),
  theme      text not null check (char_length(theme) <= 40),
  level      text not null check (level in ('a2', 'b1')),
  title      text not null check (char_length(title) <= 200),
  link       text check (char_length(link) <= 600),
  published  timestamptz,
  doc        jsonb not null check (pg_column_size(doc) <= 60000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists news_recent on public.news_lessons (created_at desc);
alter table public.news_lessons enable row level security;

drop policy if exists "actu : lecture entre membres" on public.news_lessons;
create policy "actu : lecture entre membres" on public.news_lessons
  for select to authenticated using (public.is_member());
drop policy if exists "actu : ajout par un membre" on public.news_lessons;
create policy "actu : ajout par un membre" on public.news_lessons
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
