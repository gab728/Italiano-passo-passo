-- Italiano passo passo : la partie sociale, entre membres invités seulement.
-- Ce qui est partagé : le prénom, les leçons terminées (titre et score), les bravos, le nombre de réponses de la semaine.
-- La progression détaillée, le carnet et les conversations restent privés.

-- Activité : « Luca a terminé Se présenter avec 92 % ».
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('lesson', 'unit', 'streak')),
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists activity_recent on public.activity (created_at desc);

-- Bravos : un par personne et par activité.
create table if not exists public.cheers (
  activity_id bigint not null references public.activity(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- Chiffres de la semaine (lundi = début), pour le classement entre amis.
create table if not exists public.weekly (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week       date not null,
  answers    integer not null default 0 check (answers between 0 and 100000),
  streak     integer not null default 0 check (streak between 0 and 100000),
  words      integer not null default 0 check (words between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.activity enable row level security;
alter table public.cheers   enable row level security;
alter table public.weekly   enable row level security;

drop policy if exists "activité : lecture entre membres" on public.activity;
drop policy if exists "activité : publication" on public.activity;
drop policy if exists "activité : suppression" on public.activity;
create policy "activité : lecture entre membres" on public.activity for select to authenticated using (public.is_member());
create policy "activité : publication" on public.activity for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "activité : suppression" on public.activity for delete to authenticated using (user_id = auth.uid());

drop policy if exists "bravos : lecture entre membres" on public.cheers;
drop policy if exists "bravos : envoi" on public.cheers;
drop policy if exists "bravos : retrait" on public.cheers;
create policy "bravos : lecture entre membres" on public.cheers for select to authenticated using (public.is_member());
create policy "bravos : envoi" on public.cheers for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "bravos : retrait" on public.cheers for delete to authenticated using (user_id = auth.uid());

drop policy if exists "semaine : lecture entre membres" on public.weekly;
drop policy if exists "semaine : création" on public.weekly;
drop policy if exists "semaine : mise à jour" on public.weekly;
create policy "semaine : lecture entre membres" on public.weekly for select to authenticated using (public.is_member());
create policy "semaine : création" on public.weekly for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "semaine : mise à jour" on public.weekly for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prénoms des membres invités (jamais leur e-mail), lisibles par les membres seulement.
create or replace function public.members()
returns table (user_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.user_id, coalesce(nullif(trim(p.name), ''), '') as name
  from public.profiles p
  where p.invited and public.is_member();
$$;
revoke all on function public.members() from public, anon;
grant execute on function public.members() to authenticated;
