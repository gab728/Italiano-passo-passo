-- Voix naturelles : consommation de synthèse vocale par jour, réservée d'avance, et cache partagé des phrases des leçons.
alter table public.usage add column if not exists tts_chars bigint not null default 0;

create or replace function public.take_tts(p_user uuid, p_day date, p_chars bigint, p_max bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into public.usage (user_id, day) values (p_user, p_day) on conflict (user_id, day) do nothing;
  update public.usage set tts_chars = tts_chars + p_chars
    where user_id = p_user and day = p_day and tts_chars + p_chars <= p_max
    returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.take_tts(uuid, date, bigint, bigint) from public, anon, authenticated;
grant execute on function public.take_tts(uuid, date, bigint, bigint) to service_role;

-- Fichiers audio : privés, lus et écrits par la fonction serveur seulement.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('tts', 'tts', false) on conflict (id) do nothing;
  end if;
end $$;
