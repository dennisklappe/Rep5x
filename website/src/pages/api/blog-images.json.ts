import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const images = [
    '/images/blog/cad-model-rw2-print-head.webp',
    '/images/blog/ender-5-pro-rw2-retrofit.webp',
    '/images/blog/github-repo-screenshot.webp',
    '/images/blog/offset-cone.webp',
    '/images/blog/offset-graph-a-axis.webp',
    '/images/blog/offset-graph-b-axis.webp'
  ];

  return new Response(JSON.stringify({ images }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};