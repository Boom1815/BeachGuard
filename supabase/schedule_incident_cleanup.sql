-- ═══════════════════════════════════════════════════════════════════
-- PLANIFICATION DE LA SUPPRESSION AUTOMATIQUE (15 JOURS)
-- À exécuter dans Supabase → SQL Editor. NE PAS commiter ce fichier
-- avec la vraie valeur de <CRON_SECRET_VALUE> — remplace-la juste
-- avant de coller le script, uniquement dans l'éditeur SQL.
-- ═══════════════════════════════════════════════════════════════════

-- Extensions nécessaires pour appeler une Edge Function depuis pg_cron.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Accélère la requête de sélection des incidents expirés (non bloquant,
-- n'affecte aucune policy RLS existante).
create index if not exists idx_incidents_created_at on public.incidents(created_at);

-- Supprime une éventuelle planification précédente avant de recréer
-- (permet de relancer ce script sans erreur de doublon).
select cron.unschedule('beachguard-cleanup-old-incidents')
where exists (
  select 1 from cron.job where jobname = 'beachguard-cleanup-old-incidents'
);

select cron.schedule(
  'beachguard-cleanup-old-incidents',
  '17 3 * * *', -- tous les jours à 03:17 UTC (heure creuse, minute décalée volontairement)
  $$
  select net.http_post(
    url := 'https://fbhuswayipxafsvbvasz.supabase.co/functions/v1/cleanup-old-incidents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET_VALUE>' -- doit être identique au secret CRON_SECRET de la fonction
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Vérification : doit afficher une ligne avec le job planifié.
select jobid, jobname, schedule, active from cron.job where jobname = 'beachguard-cleanup-old-incidents';
