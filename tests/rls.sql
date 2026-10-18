-- Test des règles d'accès de la migration sur un PostgreSQL local (auth de Supabase imitée).
\set ON_ERROR_STOP off
drop schema if exists auth cascade; drop schema if exists public cascade; create schema public;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x.fr'),('00000000-0000-0000-0000-00000000000b','ami@x.fr'),('00000000-0000-0000-0000-00000000000c','intrus@x.fr');
\i supabase/migrations/20261018000000_init.sql
update public.profiles set invited = true where email in ('owner@x.fr','ami@x.fr');
-- Données de départ (clé serveur)
set role service_role;
insert into public.progress values ('00000000-0000-0000-0000-00000000000a','{"secret":1}',1);
insert into public.lessons (id, owner, shared, doc) values ('it-u05-l1','00000000-0000-0000-0000-00000000000a',true,'{}'), ('perso-a','00000000-0000-0000-0000-00000000000a',false,'{}');
select public.take_call('00000000-0000-0000-0000-00000000000b', current_date, 2, 100000, 1000000, 1000) as take1;
select public.take_call('00000000-0000-0000-0000-00000000000b', current_date, 2, 100000, 1000000, 1000) as take2;
select public.take_call('00000000-0000-0000-0000-00000000000b', current_date, 2, 100000, 1000000, 1000) as take3_doit_etre_faux;
reset role;

\echo '--- en tant que l ami (b)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) as progression_visible_doit_etre_0 from public.progress;
insert into public.progress values ('00000000-0000-0000-0000-00000000000a','{"pirate":1}',2);
update public.progress set json='{"pirate":1}' where user_id='00000000-0000-0000-0000-00000000000a';
insert into public.progress values ('00000000-0000-0000-0000-00000000000b','{"moi":1}',1);
select count(*) as ma_progression_1 from public.progress;
select id from public.lessons order by id;
update public.lessons set doc='{"x":1}' where id='it-u05-l1';
delete from public.lessons where id='it-u05-l1';
insert into public.lessons (id, shared, doc) values ('it-u06-l2', false, '{}');
insert into public.lessons (id, shared, doc) values ('perso-b', true, '{}');
insert into public.lessons (id, owner, shared, doc) values ('it-u07-l1', '00000000-0000-0000-0000-00000000000a', true, '{}');
insert into public.lessons (id, shared, doc) values ('it-u07-l1', true, '{}');
update public.lessons set doc='{"y":1}' where id='it-u07-l1';
insert into public.lessons (id, shared, doc) values ('perso-b', false, '{}');
update public.lessons set doc='{"y":1}' where id='perso-b';
update public.lessons set shared=true where id='perso-b';
update public.profiles set daily_limit = 9999, invited = true;
insert into public.usage values ('00000000-0000-0000-0000-00000000000b', current_date, 0,0,0,0);
select public.take_call('00000000-0000-0000-0000-00000000000b', current_date, 999, 1, 1, 0);
select public.add_usage('00000000-0000-0000-0000-00000000000b', current_date, -5, 0, 0, 0);
reset role;

\echo '--- en tant que l intrus non invité (c)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.lessons (id, shared, doc) values ('it-u08-l1', true, '{}');
insert into public.lessons (id, shared, doc) values ('perso-c', false, '{}');
reset role;

\echo '--- anonyme'
set role anon; reset request.jwt.claim.sub;
select count(*) as anon_progress from public.progress;
select count(*) as anon_lessons from public.lessons;
reset role;
\echo '--- état final'
select user_id, json from public.progress order by user_id;
select id, owner, shared, doc from public.lessons order by id;
select user_id, daily_limit, invited from public.profiles order by email;
