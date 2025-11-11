export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const { name, email, 'cf-turnstile-response': turnstileToken } = requestData;

    // Verify Turnstile token first
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ error: 'Security verification required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${context.env.TURNSTILE_SECRET_KEY}&response=${turnstileToken}`
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      return new Response(
        JSON.stringify({ error: 'Security verification failed' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate input
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Check if EMAILIT_AUDIENCE_ID is configured
    if (!context.env.EMAILIT_AUDIENCE_ID) {
      return new Response(
        JSON.stringify({ error: 'Subscription service not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get API key first
    const EMAILIT_API_KEY = context.env.EMAILIT_API_KEY;
    
    // Subscribe to EmailIt using v2 API
    const subscribeUrl = `https://api.emailit.com/v2/audiences/${context.env.EMAILIT_AUDIENCE_ID}/subscribers`;
    
    const response = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAILIT_API_KEY}`,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        first_name: name.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Check if already subscribed (v2 API returns 409 for existing subscribers)
      if (response.status === 409 || errorText.includes('already subscribed') || errorText.includes('already exists')) {
        return new Response(
          JSON.stringify({ message: 'You are already subscribed!' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to subscribe. Please try again later.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Send emails
    if (EMAILIT_API_KEY) {
      try {
        // Generate simple token for unsubscribe URL
        const unsubscribeToken = btoa(email.toLowerCase().trim()).slice(0, 8);
        const unsubscribeUrl = `https://rep5x.com/unsubscribe?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${unsubscribeToken}`;

        // Send confirmation email to subscriber
        await fetch('https://api.emailit.com/v1/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMAILIT_API_KEY}`,
          },
          body: JSON.stringify({
            to: email.toLowerCase().trim(),
            from: 'Rep5x <noreply@rep5x.com>',
            reply_to: 'hello@rep5x.com',
            subject: 'Welcome to Rep5x Updates!',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
                  .header { background: #1a202c; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background: #f7fafc; }
                  .footer { text-align: center; padding: 15px; font-size: 12px; color: #718096; }
                  .links { text-align: center; margin: 20px 0; }
                  .links a { color: #3182ce; text-decoration: none; margin: 0 10px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>Welcome to Rep5x Updates!</h2>
                  <p>Thank you for subscribing</p>
                </div>
                <div class="content">
                  <p>Hi ${name},</p>
                  <p>You've successfully subscribed to updates from the Rep5x blog! You'll receive email notifications when we publish new posts about the 5-axis printer retrofit project.</p>
                  
                  <p>In the meantime, feel free to:</p>
                  <div class="links">
                    <a href="https://github.com/dennisklappe/rep5x">Visit our GitHub</a> |
                    <a href="https://discord.gg/75Hy5dMwTJ">Join our Discord</a> |
                    <a href="https://rep5x.com/blog">Read our Blog</a>
                  </div>
                  
                  <p>Best regards,<br>The Rep5x Team</p>
                </div>
                <div class="footer">
                  <p>Rep5x - Open-source 5-axis 3D printing</p>
                  <p>University of Twente | <a href="${unsubscribeUrl}">Unsubscribe</a></p>
                </div>
              </body>
              </html>
            `,
          }),
        });

        // Send notification email to admin
        await fetch('https://api.emailit.com/v1/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMAILIT_API_KEY}`,
          },
          body: JSON.stringify({
            to: 'hello@rep5x.com',
            from: 'Rep5x <noreply@rep5x.com>',
            reply_to: email.toLowerCase().trim(),
            subject: `New newsletter subscriber: ${name}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
                  .header { background: #1a202c; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background: #f7fafc; }
                  .subscriber-info { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3182ce; margin: 15px 0; }
                  .footer { text-align: center; padding: 15px; font-size: 12px; color: #718096; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>New Newsletter Subscriber</h2>
                  <p>Rep5x Blog Subscription</p>
                </div>
                <div class="content">
                  <p>Someone just subscribed to the Rep5x newsletter:</p>
                  
                  <div class="subscriber-info">
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB', {
                      timeZone: 'Europe/Amsterdam',
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}</p>
                  </div>
                  
                  <p>They will now receive updates when new blog posts are published.</p>
                </div>
                <div class="footer">
                  <p>Rep5x Newsletter Notifications</p>
                </div>
              </body>
              </html>
            `,
          }),
        });
      } catch (error) {
        // Don't fail the subscription if email fails
      }
    }

    return new Response(
      JSON.stringify({ message: 'Successfully subscribed!' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// Handle preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}