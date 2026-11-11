-- Abonnements pris dans les applications (App Store, Google Play), suivis par RevenueCat.
-- store : d'où vient l'abonnement. Les lignes existantes viennent du web (Stripe) ou sont offertes.
alter table public.subscriptions add column if not exists store text not null default 'stripe';
do $$ begin
  alter table public.subscriptions add constraint subscriptions_store_check check (store in ('stripe', 'app_store', 'play_store'));
exception when duplicate_object then null; end $$;
