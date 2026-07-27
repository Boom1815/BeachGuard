// Jetons signés (HMAC-SHA256) donnant accès à UN rapport d'incident précis,
// sans authentification Supabase. Utilisé par send-alert-email (signature)
// et incident-report (vérification). Le secret ne doit exister que côté
// serveur (Supabase secret REPORT_SIGNING_SECRET) — jamais dans l'app mobile.

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const pad = (4 - (str.length % 4)) % 4;
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return atob(padded);
}

export async function signReportToken(incidentId: string, secret: string, ttlSeconds: number): Promise<string> {
  const payload = JSON.stringify({ id: incidentId, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const payloadB64 = base64UrlEncode(payload);
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyReportToken(token: string, secret: string): Promise<{ id: string } | null> {
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = await hmac(secret, payloadB64);
  if (expectedSig !== sig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (typeof payload.id !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id };
  } catch {
    return null;
  }
}
