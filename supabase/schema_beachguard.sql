-- ═══════════════════════════════════════════════════════════════════
-- BEACHGUARD — Schéma Supabase : comptes, relations Free/Payant, push
-- À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. PROFILS
-- Étend auth.users (créé automatiquement par Supabase Auth lors de
-- la vérification SMS). On stocke ici les infos additionnelles.
-- ───────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,          -- format E.164, ex: +32470123456
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un utilisateur voit et modifie uniquement son propre profil"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Crée automatiquement un profil dès qu'un compte est vérifié par SMS
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ───────────────────────────────────────────────────────────────────
-- 2. RELATIONS (qui a ajouté qui comme contact d'alerte)
-- Un payant ajoute un numéro de téléphone dans ses réglages.
-- contact_user_id reste NULL tant que ce numéro ne s'est jamais
-- inscrit dans l'app — il se remplit automatiquement à l'inscription
-- (voir trigger plus bas), ce qui permet d'envoyer les push même
-- pour les contacts ajoutés AVANT qu'ils n'ouvrent l'app.
-- ───────────────────────────────────────────────────────────────────
create table public.relations (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references auth.users(id) on delete cascade,
  contact_phone text not null,         -- format E.164
  contact_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payer_id, contact_phone)     -- pas de doublon pour un même payant
);

create index idx_relations_contact_phone on public.relations(contact_phone);
create index idx_relations_contact_user on public.relations(contact_user_id);
create index idx_relations_payer on public.relations(payer_id);

alter table public.relations enable row level security;

-- Un payant gère ses propres contacts
create policy "Un payant gère les relations qu'il a créées"
  on public.relations for all
  using (auth.uid() = payer_id)
  with check (auth.uid() = payer_id);

-- Un contact peut voir qui l'a ajouté (utile pour l'affichage "à côté de qui tu es protégé")
create policy "Un contact voit les relations où il est ajouté"
  on public.relations for select
  using (auth.uid() = contact_user_id);

-- Relie automatiquement les relations en attente dès qu'un numéro s'inscrit
create function public.link_pending_relations()
returns trigger as $$
begin
  update public.relations
  set contact_user_id = new.id
  where contact_phone = new.phone
    and contact_user_id is null;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_link_relations
  after insert on public.profiles
  for each row execute procedure public.link_pending_relations();


-- ───────────────────────────────────────────────────────────────────
-- 3. TOKENS PUSH (Expo Push Notifications)
-- Un utilisateur peut avoir plusieurs appareils.
-- ───────────────────────────────────────────────────────────────────
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  device_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "Un utilisateur gère ses propres tokens push"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────────────
-- 4. ABONNEMENTS (cache local, synchronisé par webhook RevenueCat)
-- Évite d'appeler l'API RevenueCat à chaque vérification du statut
-- payant/Free — l'app lit simplement cette table.
-- ───────────────────────────────────────────────────────────────────
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'free',   -- 'free' | 'active' | 'grace_period' | 'expired'
  product_id text,                       -- ex: 'beachguard_annual'
  platform text,                         -- 'ios' | 'android'
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Lecture seule pour l'utilisateur concerné ; écriture réservée au
-- service_role (utilisé par la fonction webhook RevenueCat, jamais
-- exposée au client)
create policy "Un utilisateur voit uniquement son propre abonnement"
  on public.subscriptions for select
  using (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────────────
-- 5. VUE UTILE : est-ce que l'utilisateur peut activer sa protection ?
-- Combine payant direct + statut par défaut Free
-- ───────────────────────────────────────────────────────────────────
create view public.user_access as
select
  p.id as user_id,
  p.phone,
  coalesce(s.status = 'active' or s.status = 'grace_period', false) as can_activate_protection
from public.profiles p
left join public.subscriptions s on s.user_id = p.id;
