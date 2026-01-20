/**
 * Vercel Serverless Function - Bug Report API
 * Sends bug reports to Discord via webhook
 * 
 * Environment Variables Required:
 * - DISCORD_WEBHOOK_URL: Your Discord webhook URL
 * 
 * Environment Variables Optional:
 * - DEVELOPER_EMAIL: Fallback email for notifications
 * 
 * Setup in Vercel Dashboard:
 * 1. Go to project Settings → Environment Variables
 * 2. Add: DISCORD_WEBHOOK_URL = your_webhook_url
 * 3. Redeploy the project
 */

// Naive in-memory rate limiter (best-effort within a single function instance)
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 5;
const requestLog = new Map(); // key -> [timestamps]

function allowRequest(key) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const arr = (requestLog.get(key) || []).filter((t) => t > windowStart);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  requestLog.set(key, arr);
  return true;
}

export default async (req, res) => {
  // CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if webhook URL is configured
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('❌ DISCORD_WEBHOOK_URL environment variable is not set');
      return res.status(500).json({ 
        error: 'Webhook not configured',
        message: 'DISCORD_WEBHOOK_URL environment variable is missing'
      });
    }

    // Parse request body
    let body;
    try {
      body = req.body || {};
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    // Basic rate limit by session or IP
    const clientIP = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = body?.sessionId || clientIP;
    if (!allowRequest(String(key))) {
      return res.status(429).json({ error: 'Too many reports. Please wait and try again.' });
    }

    const {
      sessionId,
      userAgent,
      platform,
      errorCount,
      warningCount,
      errors,
      performance,
      fullReport
    } = body;

    // Basic validation
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({ error: 'Missing or invalid sessionId' });
    }
    if (typeof fullReport !== 'string' || !fullReport.trim()) {
      return res.status(400).json({ error: 'Missing or invalid fullReport' });
    }

    // Sanitize/limit payload sizes
    const safeErrorCount = Number.isFinite(errorCount) ? Math.min(errorCount, 1000) : 0;
    const safeWarningCount = Number.isFinite(warningCount) ? Math.min(warningCount, 1000) : 0;
    const safeUA = (typeof userAgent === 'string' ? userAgent : '').slice(0, 256);
    const safePlatform = (typeof platform === 'string' ? platform : '').slice(0, 64);
    const safeErrors = Array.isArray(errors) ? errors.slice(0, 10).map(e => ({
      message: (e && typeof e.message === 'string' ? e.message.slice(0, 300) : ''),
      stack: (e && typeof e.stack === 'string' ? e.stack.slice(0, 500) : undefined)
    })) : [];
    const safePerf = performance && typeof performance === 'object' ? performance : undefined;
    // Discord content field has 2000 char limit, leave room for markdown formatting
    const truncatedReport = fullReport.slice(0, 1800);

    const developerEmail = process.env.DEVELOPER_EMAIL;

    // Try Discord first
    if (webhookUrl) {
      console.log(`📤 Sending bug report for session: ${sessionId}`);
      
      const embed = {
        title: '🐛 Bug Report - Chatlog Magician',
        description: safeErrorCount > 0 ? `**${safeErrorCount} error(s) detected**` : 'No errors (user feedback)',
        color: safeErrorCount > 0 ? 0xff0000 : 0xffa500,
        fields: [
          {
            name: '📋 Session Info',
            value: `**ID:** ${sessionId}\n**Browser:** ${(safeUA || '').split(' ').pop() || 'Unknown'}\n**Platform:** ${safePlatform || 'Unknown'}`,
            inline: false
          },
          {
            name: '⚡ Performance',
            value: safePerf?.timing ? 
              `Load: ${safePerf.timing.loadTime}ms\nMemory: ${safePerf.memory?.usedJSHeapSize || 'N/A'}` :
              'Not available',
            inline: true
          },
          {
            name: '📊 Summary',
            value: `Errors: ${safeErrorCount || 0}\nWarnings: ${safeWarningCount || 0}`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'GTAW Chatlog Magician Error Reporter'
        }
      };

      // Add errors if any
      if (safeErrors && safeErrors.length > 0) {
        const errorSummary = safeErrors.slice(0, 3).map((err, i) =>
          `${i + 1}. ${err.message}`
        ).join('\n');
        // Discord field value limit is 1024 chars
        const truncatedErrorSummary = errorSummary.slice(0, 1000);
        embed.fields.push({
          name: '❌ Recent Errors',
          value: '```\n' + truncatedErrorSummary + '\n```',
          inline: false
        });
      }

      // Build content field respecting Discord's 2000 char limit
      let content = '**New bug report received!**\n\n';
      if (truncatedReport) {
        // Calculate remaining space for report
        const headerLength = content.length;
        const codeBlockFormatting = '```\n...\n```'.length;
        const maxReportLength = 2000 - headerLength - codeBlockFormatting;
        const finalReport = truncatedReport.slice(0, maxReportLength);
        content += '```\n' + finalReport + '\n```';
      }

      const payload = {
        username: 'Bug Reporter',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
        embeds: [embed],
        content: content
      };

      // Validate Discord limits before sending
      if (content.length > 2000) {
        console.warn('⚠️ Content exceeds Discord limit, truncating:', content.length);
        // Truncate further if needed
        payload.content = content.slice(0, 1990) + '...```';
      }

      // Send to Discord
      try {
        console.log('📡 Sending to Discord webhook...');
        const discordResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        console.log(`Discord response: ${discordResponse.status} ${discordResponse.statusText}`);

        if (discordResponse.ok) {
          console.log('✅ Successfully sent bug report to Discord');
          return res.status(200).json({
            success: true,
            message: 'Report sent to Discord',
            method: 'discord'
          });
        } else {
          const errorText = await discordResponse.text().catch(() => 'Unable to read error');
          console.error('❌ Discord webhook failed:', {
            status: discordResponse.status,
            statusText: discordResponse.statusText,
            error: errorText,
            contentLength: content.length,
            embedFieldsCount: embed.fields.length,
            payloadSize: JSON.stringify(payload).length
          });
          
          // Return the Discord error for debugging
          return res.status(discordResponse.status).json({
            error: 'Discord webhook failed',
            discordStatus: discordResponse.status,
            discordError: errorText
          });
        }
      } catch (fetchError) {
        console.error('❌ Error sending to Discord:', fetchError.message);
        return res.status(500).json({
          error: 'Failed to send to Discord',
          message: fetchError.message
        });
      }
    }

    // If we get here, Discord sending failed or wasn't configured
    console.error('❌ No reporting method succeeded');
    return res.status(500).json({ 
      error: 'No reporting method configured or all failed',
      fallback: 'manual'
    });

  } catch (error) {
    console.error('❌ Uncaught error in bug report handler:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      fallback: 'manual'
    });
  }
};

