-- ═══════════════════════════════════════════════════════════════════
-- CONSENTEMENT CAPTURE PHOTO — à exécuter dans Supabase → SQL Editor
-- N'ajoute qu'une colonne, ne touche à aucune policy RLS existante.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists photo_consent_accepted_at timestamptz;
