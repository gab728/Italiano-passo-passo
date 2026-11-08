-- Notizie : étapes du français (f1…f6) et de l'anglais (g1…g6), langues apprises par les élèves anglophones ou hispanophones.
alter table public.news_lessons drop constraint if exists news_lessons_id_check;
alter table public.news_lessons drop constraint if exists news_lessons_level_check;
alter table public.news_lessons add constraint news_lessons_id_check check (id ~ '^n-[0-9a-f]{16}-(a2|b1|s[1-6]|h[0-4]|e[1-6]|f[1-6]|g[1-6])(-(en|es))?$');
alter table public.news_lessons add constraint news_lessons_level_check check (level in ('a2', 'b1', 's1', 's2', 's3', 's4', 's5', 's6', 'h0', 'h1', 'h2', 'h3', 'h4', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'));
