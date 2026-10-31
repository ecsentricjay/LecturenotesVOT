/**
 * Vercel Edge Function proxy for Groq Whisper API.
 * Securely forwards /groq/* and /api/groq/* to https://api.groq.com
 * injecting Authorization: Bearer ${GROQ_API_KEY}.
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(request.url);

  // Extract downstream Groq path: handles both /api/groq and /groq prefixes,
  // as well as Vercel Edge dynamic route [...path] parameter handling
  let cleanPath = url.pathname.replace(/^\/api\/groq/, '').replace(/^\/groq/, '');

  // If Vercel Edge route passed literal [...path] or empty string, extract path segments from search params
  if (cleanPath.includes('[...path]') || cleanPath === '/' || cleanPath === '') {
    const pathSegments = url.searchParams.getAll('path');
    if (pathSegments.length > 0) {
      // Could be an array of segments or a single joined string
      const joined = pathSegments.join('/');
      cleanPath = joined.startsWith('/') ? joined : '/' + joined;
    } else {
      // Default to Whisper audio transcriptions endpoint
      cleanPath = '/openai/v1/audio/transcriptions';
    }
  }

  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }

  // Remove the internal 'path' param if it was injected by Vercel's rewrite
  const forwardParams = new URLSearchParams(url.search);
  forwardParams.delete('path');
  const queryString = forwardParams.toString() ? `?${forwardParams.toString()}` : '';

  const targetUrl = `https://api.groq.com${cleanPath}${queryString}`;

  // Prioritize Vercel project environment variable, then client override header
  const groqApiKey =
    process.env.GROQ_API_KEY ||
    request.headers.get('x-groq-api-key') ||
    '';

  if (!groqApiKey) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'MISSING_GROQ_KEY',
          message:
            'GROQ_API_KEY is not configured on Vercel. Please set GROQ_API_KEY in your Vercel Dashboard -> Settings -> Environment Variables, or enter your API key directly in the app settings.',
        },
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Build clean request headers without forbidden headers like 'host'
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${groqApiKey}`);

  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  try {
    const bodyBuffer =
      request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined;

    const groqResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: bodyBuffer,
    });

    const resBody = await groqResponse.arrayBuffer();

    const responseHeaders = new Headers();
    const resContentType = groqResponse.headers.get('content-type');
    if (resContentType) {
      responseHeaders.set('Content-Type', resContentType);
    }
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(resBody, {
      status: groqResponse.status,
      statusText: groqResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Failed to proxy audio transcription to Groq',
        },
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
