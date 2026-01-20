/**
 * Vercel Serverless Function - Bug Report API
 * Sends bug reports to Discord webhook AND/OR Email (Gmail)
 * 
 * Environment Variables Required:
 * - DISCORD_WEBHOOK_URL: Your Discord webhook URL (optional but recommended)
 * 
 * Environment Variables for Email (Gmail + Nodemailer):
 * - GMAIL_USER: Your Gmail address (e.g., your_email@gmail.com)
 * - GMAIL_APP_PASSWORD: Gmail App Password (NOT your main password!)
 * - REPORT_EMAIL_TO: Recipient email for bug reports
 * 
 * Setup in Vercel Dashboard:
 * 1. Go to project Settings → Environment Variables
 * 2. Add: GMAIL_USER = your_email@gmail.com
 * 3. Add: GMAIL_APP_PASSWORD = your_app_password (from Gmail)
 * 4. Add: REPORT_EMAIL_TO = your_email@gmail.com (usually same as GMAIL_USER)
 * 5. Add: DISCORD_WEBHOOK_URL = your_webhook_url (optional)
 * 6. Redeploy the project
 * 
 * Gmail Setup Instructions:
 * 1. Enable 2-Factor Authentication on your Gmail account
 * 2. Go to https://myaccount.google.com/apppasswords
 * 3. Select "Mail" and "Windows Computer" (or other device)
 * 4. Google will generate a 16-character password
 * 5. Copy that password to GMAIL_APP_PASSWORD in Vercel
 * 
 * Install dependency:
 * npm install nodemailer
 */

import nodemailer from 'nodemailer';

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

    // Send reports (try Discord first, then email)
    let discordSent = false;
    let emailSent = false;
    let errors = [];
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
          discordSent = true;
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
          errors.push(`Discord failed: ${discordResponse.status}`);
        }
      } catch (fetchError) {
        console.error('❌ Error sending to Discord:', fetchError.message);
        return res.status(500).json({
          error: 'Failed to send to Discord',
          message: fetchError.message
        });
      }
    }

    // Try Email via Gmail + Nodemailer
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    const emailTo = process.env.REPORT_EMAIL_TO;

    if (gmailUser && gmailAppPassword && emailTo) {
      try {
        console.log('📧 Sending bug report via Gmail...');
        
        // Create transporter
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailAppPassword, // Use App Password, not your main Gmail password!
          }
        });

        // Build HTML email
        const htmlEmail = `
<html>
  <head>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
      .section h3 { margin-top: 0; color: #667eea; }
      .error { background: #ffebee; border-left: 4px solid #ff5252; padding: 15px; margin: 10px 0; border-radius: 3px; }
      .info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 10px 0; border-radius: 3px; }
      code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🐛 Bug Report - GTAW Chatlog Magician</h1>
        <p>${safeErrorCount > 0 ? `⚠️ ${safeErrorCount} error(s) detected` : 'User feedback'}</p>
      </div>

      <div class="section">
        <h3>📋 Session Information</h3>
        <div class="info">
          <strong>Session ID:</strong> <code>${sessionId}</code><br>
          <strong>Browser:</strong> ${(safeUA || 'Unknown').split(' ').pop() || 'Unknown'}<br>
          <strong>Platform:</strong> ${safePlatform || 'Unknown'}<br>
          <strong>Time:</strong> ${new Date().toISOString()}
        </div>
      </div>

      <div class="section">
        <h3>📊 Error Summary</h3>
        <div class="info">
          <strong>Total Errors:</strong> ${safeErrorCount || 0}<br>
          <strong>Total Warnings:</strong> ${safeWarningCount || 0}
        </div>
      </div>

      ${safePerf?.timing ? `
      <div class="section">
        <h3>⚡ Performance</h3>
        <div class="info">
          <strong>Load Time:</strong> ${safePerf.timing.loadTime}ms<br>
          <strong>Memory Usage:</strong> ${safePerf.memory?.usedJSHeapSize || 'N/A'}
        </div>
      </div>
      ` : ''}

      ${safeErrors && safeErrors.length > 0 ? `
      <div class="section">
        <h3>❌ Recent Errors</h3>
        ${safeErrors.slice(0, 5).map((err, i) => `
        <div class="error">
          <strong>${i + 1}. ${err.message}</strong>
          ${err.stack ? `<pre style="background: white; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;"><code>${err.stack.slice(0, 300)}</code></pre>` : ''}
        </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="section">
        <h3>📝 Full Report</h3>
        <pre style="background: white; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #ddd;">${truncatedReport}</pre>
      </div>

      <div class="footer">
        <p>This is an automated bug report from GTAW Chatlog Magician. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
        `;

        // Send email
        const mailOptions = {
          from: gmailUser,
          to: emailTo,
          subject: `🐛 Bug Report: ${safeErrorCount > 0 ? safeErrorCount + ' error(s)' : 'User feedback'} - ${sessionId}`,
          html: htmlEmail,
          text: `Bug Report from session ${sessionId}\n\nErrors: ${safeErrorCount}\nWarnings: ${safeWarningCount}\n\n${truncatedReport}`
        };

        const emailResponse = await transporter.sendMail(mailOptions);

        if (emailResponse.messageId) {
          console.log('✅ Successfully sent bug report via Gmail');
          emailSent = true;
        } else {
          console.error('❌ Email sending failed - no message ID');
          errors.push('Email sending failed - no message ID');
        }
      } catch (emailError) {
        console.error('❌ Error sending email:', emailError.message);
        errors.push(`Email error: ${emailError.message}`);
      }
    } else if (!gmailUser || !gmailAppPassword || !emailTo) {
      console.warn('⚠️ Gmail configuration incomplete. Skipping email sending.');
      if (!gmailUser) console.warn('  Missing: GMAIL_USER');
      if (!gmailAppPassword) console.warn('  Missing: GMAIL_APP_PASSWORD');
      if (!emailTo) console.warn('  Missing: REPORT_EMAIL_TO');
    }

    // Return results
    if (discordSent || emailSent) {
      return res.status(200).json({
        success: true,
        message: 'Report sent successfully',
        methods: {
          discord: discordSent,
          email: emailSent
        }
      });
    }

    // If nothing was sent, return error
    return res.status(500).json({
      error: 'Failed to send report',
      details: errors.length > 0 ? errors : 'No reporting methods configured'
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

