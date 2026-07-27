// Edge Function: cleanup-old-incidents
// Supprime définitivement les photos et les lignes `incidents` vieilles de
// plus de 15 jours. Déclenchée quotidiennement par pg_cron (voir
// supabase/schedule_incident_cleanup.sql), jamais appelée par l'app mobile.
//
// ⚠️ C'est la SEULE tâche automatisée du projet qui accède aux données de
// TOUS les utilisateurs (via la service_role key, qui contourne les
// policies RLS par nature — nécessaire ici puisque le nettoyage doit
// balayer l'ensemble des incidents, pas seulement ceux d'un utilisateur
// connecté). Son unique action est de SUPPRIMER des données expirées :
// elle ne lit, n'expose, ni ne transmet à personne le contenu des photos
// ou des positions. La service_role key ne quitte jamais cette fonction
// (elle n'est ni renvoyée dans la réponse, ni journalisée, ni accessible
// depuis l'app mobile).
//
// Rappel de portée : l'accès administrateur Supabase (dashboard, service
// role) reste techniquement possible côté infrastructure — ce n'est pas
// une garantie cryptographique de "zéro accès" — c'est un engagement de
// conception : aucune fonctionnalité de l'app ne permet de lister ou
// parcourir les photos d'un autre utilisateur.
//
// Protection d'accès : cette fonction est déployée avec --no-verify-jwt
// (pg_cron/pg_net n'envoient pas de JWT utilisateur) et vérifie à la place
// un secret partagé (CRON_SECRET) transmis dans l'en-tête x-cron-secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const RETENTION_DAYS = 15;
const BUCKET = 'beachguard-photos';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const providedSecret = req.headers.get('x-cron-secret');
  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: oldIncidents, error: selectError } = await admin
      .from('incidents')
      .select('id')
      .lt('created_at', cutoff)
      .limit(500); // borne défensive par exécution ; le cron quotidien rattrape le reste au prochain passage

    if (selectError) throw selectError;
    if (!oldIncidents || oldIncidents.length === 0) {
      return new Response(JSON.stringify({ deleted_incidents: 0, deleted_files: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let deletedFiles = 0;
    const errors: string[] = [];

    for (const incident of oldIncidents) {
      try {
        const { data: files } = await admin.storage.from(BUCKET).list(incident.id);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${incident.id}/${f.name}`);
          const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
          if (removeError) errors.push(`storage ${incident.id}: ${removeError.message}`);
          else deletedFiles += paths.length;
        }
      } catch (e) {
        errors.push(`storage ${incident.id}: ${String(e)}`);
      }
    }

    const ids = oldIncidents.map((i) => i.id);
    const { error: deleteError } = await admin.from('incidents').delete().in('id', ids);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({
      deleted_incidents: ids.length,
      deleted_files: deletedFiles,
      errors,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
