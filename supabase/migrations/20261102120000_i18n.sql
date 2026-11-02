-- Élèves anglophones et hispanophones.
-- Une leçon écrite pour eux (explications et traductions dans leur langue) est rangée sous un identifiant préfixé :
-- « uen-it-u07-l2 », « ues-he-u03-l1 »… Une place du programme reste partagée, préfixe ou non.
drop policy if exists "leçons : création" on public.lessons;
drop policy if exists "leçons : mise à jour" on public.lessons;
create policy "leçons : création" on public.lessons
  for insert to authenticated
  with check (owner = auth.uid() and public.is_member() and shared = (id ~ '^(u[a-z]{2}-)?[a-z]{2}-u[0-9]{2}-l[0-9]{1,2}$'));
create policy "leçons : mise à jour" on public.lessons
  for update to authenticated using (owner = auth.uid() and not shared)
  with check (owner = auth.uid() and not shared and id !~ '^(u[a-z]{2}-)?[a-z]{2}-u[0-9]{2}-l[0-9]{1,2}$');

-- Notizie : étapes de l'hébreu (h0…h4) et de l'espagnol (e1…e6), et version anglaise ou espagnole (suffixe -en / -es).
alter table public.news_lessons drop constraint if exists news_lessons_id_check;
alter table public.news_lessons drop constraint if exists news_lessons_level_check;
alter table public.news_lessons add constraint news_lessons_id_check check (id ~ '^n-[0-9a-f]{16}-(a2|b1|s[1-6]|h[0-4]|e[1-6])(-(en|es))?$');
alter table public.news_lessons add constraint news_lessons_level_check check (level in ('a2', 'b1', 's1', 's2', 's3', 's4', 's5', 's6', 'h0', 'h1', 'h2', 'h3', 'h4', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'));
