// Edge Function: send-alert-email
// Reçoit { to_email, maps_link, time, photos_link } depuis l'app (utilisateur authentifié),
// et relaie l'envoi à EmailJS en utilisant les identifiants stockés côté serveur
// (jamais exposés au bundle client). Remplace l'appel direct à api.emailjs.com
// qui exposait service_id/template_id/public_key en dur dans App.js.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID')!;
const EMAILJS_TEMPLATE_ID = Deno.env.get('EMAILJS_TEMPLATE_ID')!;
const EMAILJS_PUBLIC_KEY = Deno.env.get('EMAILJS_PUBLIC_KEY')!;
const EMAILJS_PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY')!;
const LOGO_URL = Deno.env.get('LOGO_URL')
  ?? 'https://fbhuswayipxafsvbvasz.supabase.co/storage/v1/object/public/beachguard-assets/logo.png';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérifie que la requête vient d'un utilisateur authentifié de l'app
    // (le JWT est déjà validé par la plateforme Edge Functions avant d'arriver ici ;
    // on relit l'utilisateur pour s'assurer que le token est bien celui d'un compte réel).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { to_email, maps_link, time, photos_link } = await req.json();
    if (!to_email || typeof to_email !== 'string') {
      return new Response(JSON.stringify({ error: 'to_email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email,
          maps_link: maps_link || 'Location not yet available',
          photos_link: photos_link || 'Photos being uploaded...',
          time: time || new Date().toLocaleString('en-GB'),
          name: 'BeachGuard',
          promo: 'Download BeachGuard Free to receive real-time alerts when your contacts belongings are moved. Available on App Store and Google Play.',
          logo_url: LOGO_URL,
        },
      }),
    });

    const bodyText = await emailjsResponse.text();
    return new Response(JSON.stringify({ status: emailjsResponse.status, body: bodyText }), {
      status: emailjsResponse.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
