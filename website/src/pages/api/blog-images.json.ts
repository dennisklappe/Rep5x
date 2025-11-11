import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  // Get all blog images using Astro's glob
  const blogImages = import.meta.glob('/public/blog/*.{png,jpg,jpeg,gif,svg,webp}');
  const imagePaths = Object.keys(blogImages).map(path => path.replace('/public', ''));
  
  return new Response(JSON.stringify({ images: imagePaths }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};