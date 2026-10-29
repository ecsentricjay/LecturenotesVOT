/**
 * Vercel Edge Function proxy for Groq Whisper API.
 * This ensures that when deployed to Vercel, requests to /groq/* are securely
 * forwarded to https://api.groq.com with the GROQ_API_KEY header injected,
 * exactly matching the local Vite dev proxy behavior.
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  // Extract path following /groq
  const groqPath = url.pathname.replace(/^\/groq/, '');
  const targetUrl = `https://api.groq.com${groqPath}${url.search}`;

  const groqApiKey = process.env.GROQ_API_KEY || '';

  const headers = new Headers(request.headers);
  headers.set('host', 'api.groq.com');
  if (groqApiKey) {
    headers.set('authorization', `Bearer ${groqApiKey}`);
  }

  try {
    const groqResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-ignore - duplex is supported in Edge runtime
      duplex: 'half',
    });

    const responseHeaders = new Headers(groqResponse.headers);
    // Allow CORS if needed
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(groqResponse.body, {
      status: groqResponse.status,
      statusText: groqResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: { message: error.message || 'Failed to proxy request to Groq' } }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
