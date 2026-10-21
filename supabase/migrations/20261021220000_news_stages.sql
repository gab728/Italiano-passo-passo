-- Les notizie sont écrites pour une étape de grammaire (s1 = présent seulement … s6 = niveau B1), et non plus pour un niveau.
alter table public.news_lessons drop constraint if exists news_lessons_id_check;
alter table public.news_lessons drop constraint if exists news_lessons_level_check;
alter table public.news_lessons add constraint news_lessons_id_check check (id ~ '^n-[0-9a-f]{16}-(a2|b1|s[1-6])$');
alter table public.news_lessons add constraint news_lessons_level_check check (level in ('a2', 'b1', 's1', 's2', 's3', 's4', 's5', 's6'));
