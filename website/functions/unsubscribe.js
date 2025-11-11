export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!email) {
    return new Response('Missing email parameter', { status: 400 });
  }

  // Simple token validation - same as subscription function
  const expectedToken = btoa(email.toLowerCase().trim()).slice(0, 8);
  if (token !== expectedToken) {
    return new Response('Invalid token', { status: 401 });
  }

  const EMAILIT_API_KEY = context.env.EMAILIT_API_KEY;
  const EMAILIT_AUDIENCE_ID = context.env.EMAILIT_AUDIENCE_ID;

  if (!EMAILIT_API_KEY) {
    console.error('EMAILIT_API_KEY not configured');
    return new Response('Service not configured', { status: 500 });
  }

  try {
    // Find and unsubscribe using v2 API
    let page = 1;
    let found = false;
    
    while (!found && page <= 10) {
      const listResponse = await fetch(`https://api.emailit.com/v2/audiences/${EMAILIT_AUDIENCE_ID}/subscribers?page=${page}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${EMAILIT_API_KEY}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        const subscriber = data.data?.find(sub => sub.email?.toLowerCase() === email.toLowerCase());
        
        if (subscriber) {
          // Delete the subscriber
          await fetch(`https://api.emailit.com/v2/audiences/${EMAILIT_AUDIENCE_ID}/subscribers/${subscriber.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${EMAILIT_API_KEY}`,
            },
          });
          found = true;
        } else if (!data.data || data.data.length < 100) {
          break; // End of results
        }
        page++;
      } else {
        break;
      }
    }

    return Response.redirect(`${url.origin}/unsubscribed`, 302);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return Response.redirect(`${url.origin}/unsubscribed`, 302);
  }
}

// Handle preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}