export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, details, sessionId, userAgent } = req.body;

    // Optional: Send to a Discord Webhook if configured in Vercel
    // Environment Variable: DISCORD_TELEMETRY_WEBHOOK
    const webhookUrl = process.env.DISCORD_TELEMETRY_WEBHOOK;

    if (webhookUrl) {
      const embed = {
        title: '📊 Telemetry Event',
        color: 0x3498db,
        fields: [
          { name: 'Action', value: action || 'Unknown', inline: true },
          { name: 'Session ID', value: sessionId || 'Unknown', inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      if (details) {
        embed.fields.push({ name: 'Details', value: JSON.stringify(details).slice(0, 1000), inline: false });
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }

    // In a real database scenario, you would insert the data into Supabase, MongoDB, or Vercel KV here.
    
    return res.status(200).json({ success: true, message: 'Telemetry logged.' });
  } catch (error) {
    console.error('Telemetry error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
