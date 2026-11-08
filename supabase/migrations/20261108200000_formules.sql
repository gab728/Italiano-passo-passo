-- Trois formules (gratuit, Premium, Expert) et conversation comptée en caractères des répliques du prof, par jour.
alter table public.subscriptions add column if not exists tier text not null default 'premium' check (tier in ('premium', 'expert'));
alter table public.usage add column if not exists talk_chars bigint not null default 0;

-- Ajout atomique aux caractères de conversation du jour (appelé par la fonction serveur seulement) ; rend le nouveau total.
create or replace function public.add_talk(p_user uuid, p_day date, p_chars bigint)
returns bigint language sql security definer set search_path = public as $$
  insert into public.usage as u (user_id, day, talk_chars) values (p_user, p_day, greatest(p_chars, 0))
  on conflict (user_id, day) do update set talk_chars = u.talk_chars + greatest(excluded.talk_chars, 0)
  returning u.talk_chars;
$$;
revoke all on function public.add_talk(uuid, date, bigint) from public, anon, authenticated;
grant execute on function public.add_talk(uuid, date, bigint) to service_role;
