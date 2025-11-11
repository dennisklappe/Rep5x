// Rate limiting store (in production, use KV storage)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 3;

function getRateLimitKey(request) {
  // Use IP address for rate limiting
  const forwarded = request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown';
  return ip;
}

function isRateLimited(key) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => time > windowStart);
  rateLimitStore.set(key, validRequests);
  
  // Check if limit exceeded
  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  
  return false;
}

function validateInput(name, email, message) {
  // Basic validation
  if (!name || !email || !message) {
    return 'All fields are required';
  }
  
  if (name.length > 100 || email.length > 100) {
    return 'Name and email must be under 100 characters';
  }
  
  if (message.length < 10 || message.length > 2000) {
    return 'Message must be between 10 and 2000 characters';
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  
  // Spam detection
  const spamKeywords = ['crypto', 'bitcoin', 'investment', 'loan', 'casino', 'viagra', 'click here', 'free money'];
  const hasSpam = spamKeywords.some(keyword => 
    message.toLowerCase().includes(keyword) || 
    name.toLowerCase().includes(keyword)
  );
  
  if (hasSpam) {
    return 'Message contains prohibited content';
  }
  
  // Check for excessive capitals
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.3) {
    return 'Too many capital letters';
  }
  
  // Check for URLs in short messages (suspicious)
  const hasUrls = /https?:\/\//.test(message);
  if (hasUrls && message.length < 50) {
    return 'Suspicious content detected';
  }
  
  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    if (isRateLimited(rateLimitKey)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
        { 
          status: 429,
          headers: corsHeaders
        }
      );
    }
    
    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const message = formData.get('message')?.toString().trim();
    const turnstileToken = formData.get('cf-turnstile-response')?.toString();

    // Verify Turnstile token
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Security verification required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${env.TURNSTILE_SECRET_KEY}&response=${turnstileToken}`
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Security verification failed' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate input
    const validationError = validateInput(name, email, message);
    if (validationError) {
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Send notification email to Rep5x team
    const notificationResponse = await fetch('https://api.emailit.com/v1/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.EMAILIT_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Rep5x <noreply@rep5x.com>',
        to: 'hello@rep5x.com',
        reply_to: email,
        subject: `Contact Form: Message from ${name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
              .header { background: #1a202c; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f7fafc; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #4a5568; }
              .value { margin-top: 5px; padding: 10px; background: white; border-radius: 5px; }
              .message-content { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3182ce; }
              .footer { text-align: center; padding: 15px; font-size: 12px; color: #718096; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>New Contact Form Submission</h2>
              <p>Rep5x Contact Form</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${email}</div>
              </div>
              <div class="field">
                <div class="label">Message:</div>
                <div class="message-content">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <div class="footer">
              <p>You can reply directly to this email to respond to ${name}</p>
              <p>Sent via Rep5x Contact Form</p>
            </div>
          </body>
          </html>
        `
      })
    });

    // Send confirmation email to user
    const confirmationResponse = await fetch('https://api.emailit.com/v1/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.EMAILIT_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Rep5x <noreply@rep5x.com>',
        to: email,
        reply_to: 'hello@rep5x.com',
        subject: 'Thank you for contacting Rep5x',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
              .header { background: #1a202c; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f7fafc; }
              .message-summary { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #48bb78; margin: 15px 0; }
              .footer { text-align: center; padding: 15px; font-size: 12px; color: #718096; }
              .links { text-align: center; margin: 20px 0; }
              .links a { color: #3182ce; text-decoration: none; margin: 0 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Thank you for contacting Rep5x!</h2>
              <p>Your message has been received</p>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Thank you for reaching out to the Rep5x team! We've received your message and will get back to you as soon as possible.</p>
              
              <div class="message-summary">
                <h3>Your message:</h3>
                <p>${message.replace(/\n/g, '<br>')}</p>
              </div>
              
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
              <p>University of Twente | hello@rep5x.com</p>
            </div>
          </body>
          </html>
        `
      })
    });

    
    if (notificationResponse.ok && confirmationResponse.ok) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message sent successfully! Check your email for confirmation.' }),
        { 
          status: 200,
          headers: corsHeaders
        }
      );
    } else {
      const notificationError = notificationResponse.ok ? null : await notificationResponse.text();
      const confirmationError = confirmationResponse.ok ? null : await confirmationResponse.text();
      throw new Error('Failed to send one or more emails');
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        debug: error.message 
      }),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}