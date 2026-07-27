// Edge Function: incident-report
// Page HTML publique et imprimable pour UN incident précis, accessible
// uniquement via un token signé (voir _shared/report-token.ts) envoyé par
// email au propriétaire du compte. Aucune authentification Supabase requise
// côté destinataire : le proche qui reçoit le lien n'a pas besoin de compte.
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

function escapeHtml(str: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function page(bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BeachGuard — Rapport d'incident</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1424; margin: 0; padding: 24px; min-height: 100vh; box-sizing: border-box; }
  .sheet { max-width: 700px; margin: 0 auto; background: #fff; color: #16213a; border-radius: 12px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
  .field { margin-bottom: 16px; }
  .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
  .value { font-size: 16px; }
  .value a { color: #1a73e8; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-top: 8px; }
  .photos img { width: 100%; border-radius: 8px; display: block; }
  .hint { color: #888; font-size: 14px; font-style: italic; }
  .print-btn { margin-top: 24px; padding: 10px 20px; background: #1a2540; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .error-wrap { max-width: 480px; margin: 15vh auto; text-align: center; color: #fff; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function errorPage(message: string, status: number): Response {
  const html = page(`<div class="error-wrap"><h1>⚠️ ${escapeHtml(message)}</h1></div>`);
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return errorPage('Lien invalide.', 400);

  const payload = await verifyReportToken(token, REPORT_SIGNING_SECRET);
  if (!payload) return errorPage('Lien invalide ou expiré.', 403);

  const { data: incident, error } = await admin
    .from('incidents')
    .select('id, lat, lng, created_at')
    .eq('id', payload.id)
    .maybeSingle();

  if (error || !incident) {
    return errorPage("Aucune donnée disponible pour cet incident (il a peut-être déjà été supprimé).", 404);
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
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const timeLabel = new Date(incident.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' });

  const photosHtml = photoUrls.length > 0
    ? photoUrls.map((u) => `<img src="${escapeHtml(u)}" alt="Photo de l'incident">`).join('')
    : `<p class="hint">Aucune photo disponible — les photos sont automatiquement supprimées 15 jours après l'incident.</p>`;

  const html = page(`
  <div class="sheet">
    <h1>🛡️ BeachGuard — Rapport d'incident</h1>
    <div class="subtitle">Généré automatiquement par l'application BeachGuard</div>

    <div class="field">
      <div class="label">Horodatage</div>
      <div class="value">${escapeHtml(timeLabel)}</div>
    </div>

    <div class="field">
      <div class="label">Localisation</div>
      <div class="value"><a href="${escapeHtml(mapsLink)}" target="_blank" rel="noopener">${lat.toFixed(6)}, ${lng.toFixed(6)} — Voir sur Google Maps</a></div>
    </div>

    <div class="field">
      <div class="label">Photos</div>
      <div class="photos">${photosHtml}</div>
    </div>

    <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  </div>`);

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
