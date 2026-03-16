const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://tools.rep5x.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildMetadataHtml(metadata) {
  const fields = [
    ['Filename', metadata.filename],
    ['File Size', metadata.fileSize],
    ['Shape', metadata.shape],
    ['Diameter', metadata.diameter ? `${metadata.diameter}mm` : null],
    ['Height', metadata.height ? `${metadata.height}mm` : null],
    ['Layer Height', metadata.layerHeight ? `${metadata.layerHeight}mm` : null],
    ['Wall Thickness', metadata.wallThickness ? `${metadata.wallThickness}mm` : null],
    ['Print Speed', metadata.printSpeed ? `${metadata.printSpeed}mm/s` : null],
    ['Generated On', metadata.generatedOn],
    ['Inverse Kinematics', metadata.inverseKinematics ? 'Yes' : 'No'],
    ['LC Parameter', metadata.inverseKinematics ? metadata.lcParameter : null],
    ['LB Parameter', metadata.inverseKinematics ? metadata.lbParameter : null],
    ['C-Axis Optimization', metadata.cAxisOptimization ? 'Yes' : null],
    ['Total Commands', metadata.totalCommands],
    ['Layers', metadata.layers],
    ['Print Distance', metadata.printDistance],
    ['Estimated Time', metadata.estimatedTime],
  ];

  const rows = fields
    .filter(([, value]) => value != null && value !== '')
    .map(([label, value]) =>
      `<tr><td style="padding:6px 12px;font-weight:bold;color:#4a5568;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>`
    )
    .join('');

  return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">${rows}</table>`;
}

async function sendEmail(env, payload) {
  const response = await fetch('https://api.emailit.com/v1/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.EMAILIT_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text };
}

export async function onRequestPost({ request, env }) {
  const errors = [];

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const metadataStr = formData.get('metadata');

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};
    const filename = file.name || 'unknown.gcode';
    const fileSize = file.size;
    const metadataHtml = buildMetadataHtml({ ...metadata, filename, fileSize: formatBytes(fileSize) });

    const arrayBuffer = await file.arrayBuffer();

    let emailBody;
    let attachments;

    if (fileSize < 10 * 1024 * 1024) {
      const base64 = arrayBufferToBase64(arrayBuffer);
      attachments = [{
        filename: filename + '.txt',
        content: base64,
        content_type: 'text/plain',
      }];
      emailBody = `
        <h2>New G-code File Shared</h2>
        ${metadataHtml}
        <p style="margin-top:16px;color:#718096;">File attached to this email.</p>
      `;
    } else {
      const r2Key = `${new Date().toISOString().split('T')[0]}/${Date.now()}-${filename}`;
      await env.GCODE_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: { originalName: filename }
      });

      emailBody = `
        <h2>New G-code File Shared</h2>
        ${metadataHtml}
        <p style="margin-top:16px;"><strong>File too large to attach (${formatBytes(fileSize)}).</strong></p>
        <p>Stored in R2: <code>${r2Key}</code></p>
        <p style="color:#718096;">Access via Cloudflare dashboard &rarr; R2 &rarr; rep5x-gcode-research bucket.</p>
      `;
    }

    const emailPayload = {
      from: 'Rep5x Gcode Viewer <noreply@rep5x.com>',
      to: 'dennis@rep5x.com',
      subject: `[Gcode Share] ${filename}`,
      html: emailBody,
    };
    if (attachments) {
      emailPayload.attachments = attachments;
    }

    const result = await sendEmail(env, emailPayload);

    if (!result.ok && attachments) {
      errors.push(`attachment email failed (${result.status}): ${result.body}`);

      // Fallback: upload to R2 and send without attachment
      const r2Key = `${new Date().toISOString().split('T')[0]}/${Date.now()}-${filename}`;
      await env.GCODE_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: { originalName: filename }
      });

      const fallbackResult = await sendEmail(env, {
        from: 'Rep5x Gcode Viewer <noreply@rep5x.com>',
        to: 'dennis@rep5x.com',
        subject: `[Gcode Share] ${filename}`,
        html: `
          <h2>New G-code File Shared</h2>
          ${metadataHtml}
          <p style="margin-top:16px;"><strong>Attachment failed, file stored in R2.</strong></p>
          <p>Stored in R2: <code>${r2Key}</code></p>
          <p style="color:#718096;">Access via Cloudflare dashboard &rarr; R2 &rarr; rep5x-gcode-research bucket.</p>
        `
      });

      if (!fallbackResult.ok) {
        errors.push(`fallback email failed (${fallbackResult.status}): ${fallbackResult.body}`);
      }
    } else if (!result.ok) {
      errors.push(`email failed (${result.status}): ${result.body}`);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        emailStatus: result.status,
        emailResponse: result.body,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message, errors }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
