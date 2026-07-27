// Edge Function: incident-report
// Renvoie en JSON les données d'UN incident précis, accessible uniquement via
// un token signé (voir _shared/report-token.ts) envoyé par email au
// propriétaire du compte. Aucune authentification Supabase requise côté
// destinataire : le proche qui reçoit le lien n'a pas besoin de compte.
//
// Renvoie du JSON et non du HTML directement : sur le domaine partagé
// *.supabase.co (plan gratuit), Supabase force le Content-Type de toute
// réponse HTML vers text/plain (mesure anti-abus), rendant impossible de
// servir une vraie page ici. La page imprimable (docs/report.html, servie
// via GitHub Pages) appelle cette fonction en fetch() et affiche le résultat.
//
// Garantie de conception : cette fonction ne lit JAMAIS plus d'un incident —
// elle n'expose aucune liste, aucune recherche, aucun moyen de parcourir les
// incidents d'un autre utilisateur. Le seul point d'entrée est l'`id` encodé
// dans un token valide (signé avec REPORT_SIGNING_SECRET, jamais exposé au
// client). Ce n'est pas une garantie cryptographique de "zéro accès admin" —
// l'accès administrateur Supabase reste techniquement possible côté
// infrastructure — c'est un engagement de conception de l'application.
//
// Déployée avec --no-verify-jwt : le token maison remplace la vérification
// JWT Supabase habituelle, puisque le destinataire n'est pas un utilisateur
// authentifié de l'app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyReportToken } from '../_shared/report-token.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REPORT_SIGNING_SECRET = Deno.env.get('REPORT_SIGNING_SECRET')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Appelée en fetch() cross-origin depuis GitHub Pages : CORS nécessaire.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return jsonResponse({ ok: false, error: 'Lien invalide.' }, 400);

  const payload = await verifyReportToken(token, REPORT_SIGNING_SECRET);
  if (!payload) return jsonResponse({ ok: false, error: 'Lien invalide ou expiré.' }, 403);

  const { data: incident, error } = await admin
    .from('incidents')
    .select('id, lat, lng, created_at')
    .eq('id', payload.id)
    .maybeSingle();

  if (error || !incident) {
    return jsonResponse({ ok: false, error: "Aucune donnée disponible pour cet incident (il a peut-être déjà été supprimé)." }, 404);
  }

  const { data: files } = await admin.storage
    .from('beachguard-photos')
    .list(payload.id, { sortBy: { column: 'name', order: 'asc' } });

  const photoUrls: string[] = [];
  if (files && files.length > 0) {
    for (const file of files) {
      const { data: signed } = await admin.storage
        .from('beachguard-photos')
        .createSignedUrl(`${payload.id}/${file.name}`, 3600);
      if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
    }
  }

  const lat = Number(incident.lat);
  const lng = Number(incident.lng);

  return jsonResponse({
    ok: true,
    timestamp: incident.created_at,
    lat,
    lng,
    maps_link: `https://maps.google.com/?q=${lat},${lng}`,
    photos: photoUrls,
  }, 200);
});
