-- Abonnement Premium (paiement Stripe sur le web) et rappels sur le téléphone (notifications push).
-- Ces tables ne sont écrites que par la fonction serveur (clé serveur) ; un élève ne lit que son propre abonnement.

-- Abonnement : une ligne par élève qui en a eu un. Pas de ligne = formule gratuite.
--   status : trialing (essai), active, past_due (paiement en retard, accès gardé pendant les relances de Stripe),
--            canceled, comp (offert : membres fondateurs), none
create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'free' check (plan in ('free', 'monthly', 'yearly', 'founder')),
  status               text not null default 'none' check (status in ('trialing', 'active', 'past_due', 'canceled', 'comp', 'none')),
  trial_end            timestamptz,
  period_end           timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_used           boolean not null default false,
  customer             text,
  subscription         text,
  updated_at           timestamptz not null default now()
);
create index if not exists subscriptions_customer on public.subscriptions (customer);
alter table public.subscriptions enable row level security;
drop policy if exists "abonnement lisible par son titulaire" on public.subscriptions;
create policy "abonnement lisible par son titulaire" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- Membres fondateurs : les personnes déjà inscrites gardent tout, offert.
insert into public.subscriptions (user_id, plan, status)
  select user_id, 'founder', 'comp' from public.profiles where invited
  on conflict (user_id) do nothing;

-- Téléphones abonnés aux notifications (un élève peut en avoir plusieurs).
create table if not exists public.push_subs (
  endpoint   text primary key check (char_length(endpoint) <= 1000),
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;

-- Rappels : réglages de l'élève et ce que le serveur doit savoir pour choisir le bon message.
create table if not exists public.reminders (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  enabled    boolean not null default true,
  hour       integer not null default 19 check (hour between 0 and 23),
  tz         text not null default 'Europe/Paris' check (char_length(tz) <= 60),
  ui         text not null default 'fr' check (ui in ('fr', 'en', 'es')),
  course     text not null default 'it' check (char_length(course) <= 4),
  name       text check (char_length(name) <= 60),
  last_day   date,                 -- dernier jour d'entraînement (date locale de l'élève)
  streak     integer not null default 0 check (streak between 0 and 100000),
  paused     boolean not null default false,  -- vrai après le message « on fait une pause » ; repasse à faux dès qu'il revient
  sent_day   date,                 -- jour local des derniers envois
  sent       text not null default '' check (char_length(sent) <= 200),  -- types envoyés ce jour-là (daily,saver…)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reminders enable row level security;

-- Réglages du serveur : clés des notifications (VAPID), adresse et jeton du rappel automatique.
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

-- Toutes les 15 minutes, la base appelle la fonction serveur, qui envoie les rappels de l'heure.
-- L'adresse et le jeton sont enregistrés par la fonction elle-même (table app_config). Si pg_cron ou pg_net
-- ne sont pas disponibles, la migration continue : on peut alors programmer l'appel depuis Supabase (Integrations → Cron).
do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'ipp-rappels';
  perform cron.schedule('ipp-rappels', '*/15 * * * *', $job$
    select net.http_post(
      url := value->>'url',
      body := '{"action":"run"}'::jsonb,
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron', value->>'token'),
      timeout_milliseconds := 55000)
    from public.app_config where key = 'cron' and value ? 'url'
  $job$);
exception when others then
  raise notice 'Rappels : programmation automatique impossible ici (%). Programme l''appel depuis Supabase.', sqlerrm;
end $$;
