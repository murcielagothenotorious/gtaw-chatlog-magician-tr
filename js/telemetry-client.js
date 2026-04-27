(function () {
  const sessionId = Math.random().toString(36).substring(2, 15);

  const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAgiEyadxqCsHcL6aSTpWw
MxiXy0nXSFicU7dJMv8CSsc5LvHNe1tvKcmhIxmVYBmb84Ma82nOFv3o8hudqPAN
KGfvvfzvXoMV6+zhEtuaaFV4oX7RYHn3EAoQV1ANTPXrm6ly6BgBd3WY4/z4pYpr
acQr8GnIXR4kwIt6TVxVzRt7dZkemTi0Iyn926QYRMJjXtNdZtcdo+ZhEmt86rC8
9Fffye7e5+MJE8nzWu/t3pp3tRj/+rP3sd8c04q7pHfpA56ZBCgAoYKlAgM4KLgi
2JaWoLv8lLYVm02cqH2+toCabEkeQvleUIOd6QqFjgPPOTiZunxMctKdM5Tv0qVb
QL++z8rk3wYDH14SnA9VSGP67xOYwynLPCBjJZRfMRDpNLEhALLNGb8Gwns4Mjlr
pvBrvUwP9A+gc4egLWVyrZ9R9FVv1Oc8ablfTi9UqrPD4tN3eWYECrf2uBJeVBC4
hBbNyNPGLQ0qAhvMxq9Y881t/qigo0nLMQ7YbMqzPBdgrbB8LmGNr917ir+vdUKf
IXUpc6mR1qqjKajZVWkPAx7CZBdvV0VCOPyXB9fVNnzRemN7mdemSv1W0LglVF6x
Fy642tKghznb8UJWHz8xiQ3oYreONLWkJKUExBrD/8oF72GjjnDJiiJ5Xalu4RZe
ktAhUSY4Zx2ZWW+FwBXORE0CAwEAAQ==
-----END PUBLIC KEY-----`;

  const endpoint = '/api/telemetry';

  let lastText = '';

  function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }

  async function importPublicKey(pem) {
    const cleanPem = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    return crypto.subtle.importKey(
      'spki',
      base64ToArrayBuffer(cleanPem),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }

  async function encryptPayload(payload) {
    const publicKey = await importPublicKey(PUBLIC_KEY_PEM);

    const aesKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      encodedPayload
    );

    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    const encryptedKey = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      rawAesKey
    );

    return {
      encryptedKey: arrayBufferToBase64(encryptedKey),
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(encryptedData)
    };
  }

  async function sendTelemetry(action, details = {}) {
    try {
      const plainPayload = {
        action,
        details,
        sessionId,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };

      const encryptedPayload = await encryptPayload(plainPayload);
      const body = JSON.stringify(encryptedPayload);

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch(() => { });
      }
    } catch (e) {
      console.warn('Telemetry failed:', e);
    }
  }

  const chatlogInput = document.getElementById('chatlogInput');

  if (chatlogInput) {
    chatlogInput.addEventListener('input', () => {
      lastText = chatlogInput.value;
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    sendTelemetry('page_visit', {
      resolution: `${window.innerWidth}x${window.innerHeight}`
    });
  });

  window.Telemetry = {
    send: sendTelemetry,

    setInput(value) {
      lastText = value || '';
    },

    sendActionWithInput(action, value) {
      const text = (value || lastText || '').trim();
      if (!text) return;

      sendTelemetry('action_with_input', {
        action,
        textPreview: text.substring(0, 500),
        textLength: text.length,
        lineCount: text.split('\n').filter(l => l.trim()).length
      });
    }
  };
})();