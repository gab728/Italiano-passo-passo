-- Inscription ouverte : le prénom donné pendant l'accueil est enregistré dès la création du compte.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 60), '');
begin
  insert into public.profiles (user_id, email, name) values (new.id, new.email, n)
  on conflict (user_id) do nothing;
  return new;
end $$;
