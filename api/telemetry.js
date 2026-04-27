import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'telemetry-fulltext';

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

function safeJson(value) {
  return JSON.stringify(value, null, 2);
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
      details = {},
      sessionId,
      userAgent,
      timestamp,
    } = decryptedPayload;

    const fullText = details.text || '';
    const textLength = details.textLength || fullText.length || 0;
    const lineCount =
      details.lineCount ||
      fullText.split('\n').filter((line) => line.trim()).length;

    const eventId = crypto.randomUUID();

    let storagePath = null;

    if (fullText) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      storagePath = `${year}/${month}/${day}/${eventId}.json`;

      const fileBody = safeJson({
        eventId,
        action,
        sessionId,
        userAgent,
        timestamp,
        text: fullText,
        textLength,
        lineCount,
        createdAt: new Date().toISOString(),
      });

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBody, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }
    }

    const detailsForDb = {
      ...details,
      text: undefined,
    };

    const { error: insertError } = await supabase
      .from('telemetry_events')
      .insert({
        id: eventId,
        action,
        session_id: sessionId,
        user_agent: userAgent,
        text_length: textLength,
        line_count: lineCount,
        storage_path: storagePath,
        details: detailsForDb,
      });

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({
      success: true,
      message: 'Telemetry saved.',
      id: eventId,
    });
  } catch (error) {
    console.error('Telemetry error:', {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      error: 'Invalid telemetry payload',
      reason: error.message,
    });
  }
}