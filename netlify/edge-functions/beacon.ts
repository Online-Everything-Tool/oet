// FILE: netlify/edge-functions/analytics-beacon.ts
import type { Config, Context } from '@netlify/functions';

// The Deno global is available in Netlify's edge runtime.
// This line is just for TypeScript to know about the Deno global.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export default async (request: Request, context: Context) => {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow POST requests for the main logic
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    const dataToIngest = {
      timestamp: new Date().toISOString(),
      event_type: body.event || 'unknown',
      path: body.path || 'unknown',
      duration_sec: body.duration_sec || 0,
      country_code: context.geo.country?.code || 'unknown',
      city: context.geo.city || 'unknown',
      client_ip: context.ip || 'unknown',
    };

    const TINYBIRD_INGEST_ENDPOINT = Deno.env.get('TINYBIRD_INGEST_ENDPOINT');
    const TINYBIRD_API_KEY = Deno.env.get('TINYBIRD_API_KEY');

    if (TINYBIRD_INGEST_ENDPOINT && TINYBIRD_API_KEY) {
      fetch(TINYBIRD_INGEST_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TINYBIRD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToIngest),
      }).catch((e) => context.log('Tinybird ingest failed:', e));
    } else {
      context.log('Tinybird environment variables are not set.');
    }

    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    context.log('[Analytics Beacon Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const config: Config = {
  path: '/api/beacon',
};
