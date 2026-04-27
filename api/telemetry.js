import crypto from 'crypto';

function getPrivateKey() {
  const key = process.env.TELEMETRY_PRIVATE_KEY;

  if (!key) {
    throw new Error('TELEMETRY_PRIVATE_KEY is missing');
  }

  return key.replace(/\\n/g, '\n');
}

function decryptTelemetry(body) {
  if (!body?.encryptedKey || !body?.iv || !body?.data) {
    throw new Error('Missing encrypted payload fields');
  }

  const privateKey = getPrivateKey();

  const encryptedKey = Buffer.from(body.encryptedKey, 'base64');
  const iv = Buffer.from(body.iv, 'base64');
  const encryptedData = Buffer.from(body.data, 'base64');

  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedKey
  );

  const authTag = encryptedData.subarray(encryptedData.length - 16);
  const ciphertext = encryptedData.subarray(0, encryptedData.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

    const decryptedPayload = decryptTelemetry(body);

    const {
      action,
      details,
      sessionId,
      userAgent,
      timestamp,
    } = decryptedPayload;

    const webhookUrl = process.env.DISCORD_TELEMETRY_WEBHOOK;

    if (webhookUrl) {
      const embed = {
        title: '📊 Telemetry Event',
        color: 0x3498db,
        fields: [
          {
            name: 'Action',
            value: action || 'Unknown',
            inline: true,
          },
          {
            name: 'Session ID',
            value: sessionId || 'Unknown',
            inline: true,
          },
          {
            name: 'Timestamp',
            value: timestamp
              ? new Date(timestamp).toISOString()
              : new Date().toISOString(),
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      if (userAgent) {
        embed.fields.push({
          name: 'User Agent',
          value: String(userAgent).slice(0, 500),
          inline: false,
        });
      }

      if (details) {
        embed.fields.push({
          name: 'Details',
          value: '```json\n' + JSON.stringify(details, null, 2).slice(0, 900) + '\n```',
          inline: false,
        });
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Encrypted telemetry logged.',
    });
  } catch (error) {
    console.error('Telemetry decrypt/error:', {
      message: error.message,
      stack: error.stack,
      bodyType: typeof req.body,
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
      rawBody: typeof req.body === 'string' ? req.body.slice(0, 300) : null,
    });

    return res.status(400).json({
      success: false,
      error: 'Invalid telemetry payload',
      reason: error.message,
    });
  }
}