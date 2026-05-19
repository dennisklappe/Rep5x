/**
 * Rep5x Firmware Builder - Cloudflare Worker
 *
 * Handles firmware build requests by triggering GitHub Actions
 * and serving completed builds from R2 storage.
 *
 * Required bindings:
 * - KV: BUILDS (for storing build status)
 * - R2: FIRMWARE (for storing compiled firmware)
 * - Secret: GITHUB_TOKEN (for triggering workflows)
 */

const GITHUB_OWNER = 'dennisklappe';
const GITHUB_REPO = 'Rep5x';
const GITHUB_WORKFLOW = 'firmware-build.yml';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // POST /build - Start a new build
      if (url.pathname === '/build' && request.method === 'POST') {
        return await handleBuildRequest(request, env, corsHeaders);
      }

      // GET /status/:buildId - Check build status
      if (url.pathname.startsWith('/status/') && request.method === 'GET') {
        const buildId = url.pathname.split('/status/')[1];
        return await handleStatusRequest(buildId, env, corsHeaders);
      }

      // GET /download/:buildId - Download firmware
      if (url.pathname.startsWith('/download/') && request.method === 'GET') {
        const buildId = url.pathname.split('/download/')[1];
        return await handleDownloadRequest(buildId, env, corsHeaders);
      }

      // POST /webhook - GitHub Actions callback (internal)
      if (url.pathname === '/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env, corsHeaders);
      }

      // GET /config/:buildId - Get config files (for GitHub Actions)
      if (url.pathname.startsWith('/config/') && request.method === 'GET') {
        const buildId = url.pathname.split('/config/')[1];
        return await handleConfigRequest(buildId, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle new build request
 */
async function handleBuildRequest(request, env, corsHeaders) {
  const body = await request.json();

  // Generate unique build ID
  const buildId = generateBuildId();

  // Store build customizations and status in KV
  const buildData = {
    id: buildId,
    status: 'pending',
    board: body.board || 'octopus_v1.1',
    // Dimensions
    xBedSize: body.xBedSize,
    yBedSize: body.yBedSize,
    zMaxPos: body.zMaxPos,
    // Homing directions
    xHomeDir: body.xHomeDir,
    yHomeDir: body.yHomeDir,
    zHomeDir: body.zHomeDir,
    // Display
    display: body.display,
    neopixelColor: body.neopixelColor,
    // Drivers
    driverX: body.driverX,
    driverY: body.driverY,
    driverZ: body.driverZ,
    driverC: body.driverC,
    driverB: body.driverB,
    driverE: body.driverE,
    // Motor sockets
    socketX: body.socketX,
    socketY: body.socketY,
    socketZ: body.socketZ,
    socketC: body.socketC,
    socketB: body.socketB,
    socketE: body.socketE,
    // Steps per unit
    stepsX: body.stepsX,
    stepsY: body.stepsY,
    stepsZ: body.stepsZ,
    stepsC: body.stepsC,
    stepsB: body.stepsB,
    stepsE: body.stepsE,
    // Motor directions
    invertX: body.invertX,
    invertY: body.invertY,
    invertZ: body.invertZ,
    invertC: body.invertC,
    invertB: body.invertB,
    invertE: body.invertE,
    // Endstop hit states
    endstopX: body.endstopX,
    endstopY: body.endstopY,
    endstopZ: body.endstopZ,
    endstopC: body.endstopC,
    endstopB: body.endstopB,
    // Sensorless XY homing
    xyHomingMode: body.xyHomingMode,
    stallSensitivityX: body.stallSensitivityX,
    stallSensitivityY: body.stallSensitivityY,
    // Case light LED
    caseLightEnabled: body.caseLightEnabled,
    caseLightBrightness: body.caseLightBrightness,
    caseLightPin: body.caseLightPin,
    // Advanced pin assignments (resolved MCU pins)
    pinOverrides: body.pinOverrides,
    // Dual Z steppers
    dualZ: body.dualZ,
    zMultiEndstops: body.zMultiEndstops,
    // Motor socket overrides
    motorOverrides: body.motorOverrides,
    // IK parameters
    ikLC: body.ikLC,
    ikLB: body.ikLB,
    cHomePos: body.cHomePos,
    bRange: body.bRange,
    segmentsPerSecond: body.segmentsPerSecond,
    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await env.BUILDS.put(`build:${buildId}`, JSON.stringify(buildData), {
    expirationTtl: 86400 // 24 hours
  });

  // Trigger GitHub Actions workflow
  const triggered = await triggerGitHubWorkflow(env, buildId, buildData);

  if (!triggered) {
    buildData.status = 'failed';
    buildData.error = 'Failed to trigger build workflow';
    await env.BUILDS.put(`build:${buildId}`, JSON.stringify(buildData));

    return new Response(JSON.stringify({ error: 'Failed to trigger build' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Update status to building
  buildData.status = 'building';
  await env.BUILDS.put(`build:${buildId}`, JSON.stringify(buildData));

  return new Response(JSON.stringify({
    buildId,
    status: 'building',
    message: 'Build started. Poll /status/:buildId for updates.',
    estimatedTime: '2-3 minutes'
  }), {
    status: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle build status request
 */
async function handleStatusRequest(buildId, env, corsHeaders) {
  const buildData = await env.BUILDS.get(`build:${buildId}`, 'json');

  if (!buildData) {
    return new Response(JSON.stringify({ error: 'Build not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const response = {
    buildId: buildData.id,
    status: buildData.status,
    createdAt: buildData.createdAt,
    updatedAt: buildData.updatedAt
  };

  if (buildData.status === 'complete') {
    response.downloadUrl = `/download/${buildId}`;
  }

  if (buildData.status === 'failed') {
    response.error = buildData.error || 'Build failed';
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle firmware download request
 */
async function handleDownloadRequest(buildId, env, corsHeaders) {
  // Check build status
  const buildData = await env.BUILDS.get(`build:${buildId}`, 'json');

  if (!buildData) {
    return new Response('Build not found', { status: 404, headers: corsHeaders });
  }

  if (buildData.status !== 'complete') {
    return new Response('Build not ready', { status: 400, headers: corsHeaders });
  }

  // Get firmware from R2
  const firmware = await env.FIRMWARE.get(`${buildId}/firmware.bin`);

  if (!firmware) {
    return new Response('Firmware file not found', { status: 404, headers: corsHeaders });
  }

  return new Response(firmware.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="firmware.bin"`
    }
  });
}

/**
 * Handle config request (for GitHub Actions to fetch config files)
 */
async function handleConfigRequest(buildId, env, corsHeaders) {
  const buildData = await env.BUILDS.get(`build:${buildId}`, 'json');

  if (!buildData) {
    return new Response(JSON.stringify({ error: 'Build not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return customization values for the workflow to apply
  return new Response(JSON.stringify({
    // Dimensions
    xBedSize: buildData.xBedSize,
    yBedSize: buildData.yBedSize,
    zMaxPos: buildData.zMaxPos,
    // Homing directions
    xHomeDir: buildData.xHomeDir,
    yHomeDir: buildData.yHomeDir,
    zHomeDir: buildData.zHomeDir,
    // Display
    display: buildData.display,
    neopixelColor: buildData.neopixelColor,
    // Drivers
    driverX: buildData.driverX,
    driverY: buildData.driverY,
    driverZ: buildData.driverZ,
    driverC: buildData.driverC,
    driverB: buildData.driverB,
    driverE: buildData.driverE,
    // Motor sockets
    socketX: buildData.socketX,
    socketY: buildData.socketY,
    socketZ: buildData.socketZ,
    socketC: buildData.socketC,
    socketB: buildData.socketB,
    socketE: buildData.socketE,
    // Steps per unit
    stepsX: buildData.stepsX,
    stepsY: buildData.stepsY,
    stepsZ: buildData.stepsZ,
    stepsC: buildData.stepsC,
    stepsB: buildData.stepsB,
    stepsE: buildData.stepsE,
    // Motor directions
    invertX: buildData.invertX,
    invertY: buildData.invertY,
    invertZ: buildData.invertZ,
    invertC: buildData.invertC,
    invertB: buildData.invertB,
    invertE: buildData.invertE,
    // Endstop hit states
    endstopX: buildData.endstopX,
    endstopY: buildData.endstopY,
    endstopZ: buildData.endstopZ,
    endstopC: buildData.endstopC,
    endstopB: buildData.endstopB,
    // Sensorless XY homing
    xyHomingMode: buildData.xyHomingMode,
    stallSensitivityX: buildData.stallSensitivityX,
    stallSensitivityY: buildData.stallSensitivityY,
    // Case light LED
    caseLightEnabled: buildData.caseLightEnabled,
    caseLightBrightness: buildData.caseLightBrightness,
    caseLightPin: buildData.caseLightPin,
    // Advanced pin assignments (resolved MCU pins)
    pinOverrides: buildData.pinOverrides,
    // Dual Z steppers
    dualZ: buildData.dualZ,
    zMultiEndstops: buildData.zMultiEndstops,
    // Motor socket overrides
    motorOverrides: buildData.motorOverrides,
    // IK parameters
    ikLC: buildData.ikLC,
    ikLB: buildData.ikLB,
    cHomePos: buildData.cHomePos,
    bRange: buildData.bRange,
    segmentsPerSecond: buildData.segmentsPerSecond
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle webhook from GitHub Actions
 */
async function handleWebhook(request, env, corsHeaders) {
  const body = await request.json();
  const { buildId, status, error } = body;

  if (!buildId) {
    return new Response('Missing buildId', { status: 400, headers: corsHeaders });
  }

  const buildData = await env.BUILDS.get(`build:${buildId}`, 'json');

  if (!buildData) {
    return new Response('Build not found', { status: 404, headers: corsHeaders });
  }

  // Update build status
  buildData.status = status;
  buildData.updatedAt = new Date().toISOString();

  if (error) {
    buildData.error = error;
  }

  await env.BUILDS.put(`build:${buildId}`, JSON.stringify(buildData), {
    expirationTtl: 86400
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Trigger GitHub Actions workflow
 */
async function triggerGitHubWorkflow(env, buildId, buildData) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Rep5x-Firmware-Builder'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            build_id: buildId,
            board: buildData.board,
            // Config files are too large for workflow inputs,
            // the workflow will fetch them from the worker
          }
        })
      }
    );

    console.log('GitHub API response status:', response.status);
    if (response.status !== 204) {
      const text = await response.text();
      console.log('GitHub API response body:', text);
    }

    return response.status === 204;
  } catch (error) {
    console.error('Failed to trigger GitHub workflow:', error);
    return false;
  }
}

/**
 * Generate unique build ID
 */
function generateBuildId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}
