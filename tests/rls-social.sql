\set ON_ERROR_STOP off
\i supabase/migrations/20261018170000_social.sql
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.activity (kind, data) values ('lesson', '{"t":"Se présenter","pct":92}');
insert into public.activity (user_id, kind, data) values ('00000000-0000-0000-0000-00000000000a', 'lesson', '{}');
insert into public.weekly (week, answers) values (current_date, 40);
select count(*) as names_visibles from public.members();
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as activite_visible_par_a from public.activity;
insert into public.cheers (activity_id) select id from public.activity limit 1;
update public.weekly set answers = 9999;
delete from public.activity;
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as activite_visible_intrus from public.activity;
select count(*) as noms_visibles_intrus from public.members();
insert into public.activity (kind) values ('lesson');
reset role;
select user_id, kind from public.activity; select * from public.cheers; select user_id, answers from public.weekly;
