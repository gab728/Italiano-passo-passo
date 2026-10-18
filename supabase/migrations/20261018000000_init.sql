-- Italiano passo passo : schéma de la base.
-- À coller une fois dans l'éditeur SQL de Supabase (ou appliqué par le déploiement automatique).
-- Chaque table est protégée par des règles (RLS) : une personne ne lit et n'écrit que ses propres données.

-- Profil de chaque membre : nom affiché et plafond quotidien éventuel (fixé par le propriétaire).
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text check (char_length(name) <= 60),
  daily_limit integer check (daily_limit >= 0),
  invited     boolean not null default false,  -- vrai pour les personnes invitées depuis l'app (et le propriétaire)
  created_at  timestamptz not null default now()
);

-- Progression : un document par personne, au même format que l'app d'origine (texte JSON + horodatage).
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  json       text not null check (char_length(json) <= 2000000),
  t          bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Leçons écrites dans l'app. Une leçon du programme (it-u07-l2…) est partagée : préparée une fois, elle sert à tous.
-- Une leçon à la carte reste privée à la personne qui l'a demandée.
create table if not exists public.lessons (
  id         text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  course     text not null default 'it',
  owner      uuid references auth.users(id) on delete set null default auth.uid(),
  shared     boolean not null default false,
  doc        jsonb not null check (pg_column_size(doc) <= 400000),
  created_at timestamptz not null default now()
);

-- Consommation par personne et par jour (écrite uniquement par les fonctions du serveur).
create table if not exists public.usage (
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null,
  calls         integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  stt_seconds   integer not null default 0,
  primary key (user_id, day)
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.lessons  enable row level security;
alter table public.usage    enable row level security;

-- Profil : chacun lit le sien ; le nom se change par la fonction admin.
drop policy if exists "profil lisible par son titulaire" on public.profiles;
create policy "profil lisible par son titulaire" on public.profiles
  for select to authenticated using (user_id = auth.uid());

-- Progression : chacun lit et écrit uniquement la sienne.
drop policy if exists "progression : lecture" on public.progress;
drop policy if exists "progression : création" on public.progress;
drop policy if exists "progression : mise à jour" on public.progress;
create policy "progression : lecture" on public.progress
  for select to authenticated using (user_id = auth.uid());
create policy "progression : création" on public.progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "progression : mise à jour" on public.progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Membre invité ? (protège les leçons partagées même si les inscriptions libres restaient ouvertes par erreur)
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select invited from public.profiles where user_id = auth.uid()), false);
$$;

-- Leçons : lecture des leçons partagées et des siennes ; création à son nom ;
-- une leçon partagée doit correspondre à une place du programme ; on ne modifie que ses propres leçons.
drop policy if exists "leçons : lecture" on public.lessons;
drop policy if exists "leçons : création" on public.lessons;
drop policy if exists "leçons : mise à jour" on public.lessons;
drop policy if exists "leçons : suppression" on public.lessons;
create policy "leçons : lecture" on public.lessons
  for select to authenticated using (shared or owner = auth.uid());
create policy "leçons : création" on public.lessons
  for insert to authenticated
  with check (owner = auth.uid() and public.is_member() and (not shared or id ~ '^[a-z]{2}-u[0-9]{2}-l[0-9]{1,2}$'));
create policy "leçons : mise à jour" on public.lessons
  for update to authenticated using (owner = auth.uid())
  with check (owner = auth.uid() and public.is_member() and (not shared or id ~ '^[a-z]{2}-u[0-9]{2}-l[0-9]{1,2}$'));
create policy "leçons : suppression" on public.lessons
  for delete to authenticated using (owner = auth.uid() and not shared);

-- Consommation : chacun voit la sienne.
drop policy if exists "consommation lisible par son titulaire" on public.usage;
create policy "consommation lisible par son titulaire" on public.usage
  for select to authenticated using (user_id = auth.uid());

-- Horodatage de la progression.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();

-- Un profil est créé pour chaque nouveau compte.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ajout atomique à la consommation du jour (appelé par les fonctions avec la clé serveur uniquement).
create or replace function public.add_usage(p_user uuid, p_day date, p_calls integer, p_in bigint, p_out bigint, p_stt integer)
returns public.usage language sql security definer set search_path = public as $$
  insert into public.usage as u (user_id, day, calls, input_tokens, output_tokens, stt_seconds)
  values (p_user, p_day, p_calls, p_in, p_out, p_stt)
  on conflict (user_id, day) do update set
    calls = u.calls + excluded.calls,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    stt_seconds = u.stt_seconds + excluded.stt_seconds
  returning u.*;
$$;
revoke all on function public.add_usage(uuid, date, integer, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.add_usage(uuid, date, integer, bigint, bigint, integer) to service_role;

-- Les comptes déjà créés avant ce script reçoivent leur profil.
insert into public.profiles (user_id, email)
  select id, email from auth.users on conflict (user_id) do nothing;
