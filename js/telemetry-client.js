(function () {
  const sessionId = Math.random().toString(36).substring(2, 15);

  const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgB+L81KMrir5Zu/dIkNBDWa
AHAnZduceSJ9faFlB9adMnxgNFzDPvh7iEZOA/vpqXRBbp6czbT569uRO+yTYFPO
vIDqQ09R0puebq2vhwdjlm9LJKUD4JIN4WD3UGJJkerqUlgcE63dDvtubSP78M9r
BXZaMYcZDKZgQQhQrz0vMRxP4ykqvqa84INw2AQ/TISXeBu6JfrzgHhxX29Zqe+W
REdOFYhsLAK8MYtGRgDiWriih/ivBu1WPjZbzClMCv7NOjrMs3bMsdW209MMHr07
vjzxm3CDr4tXn+SvWNR/Rvbz/6uIGVaJVZsz2p2929/BgsX9Sg8U4IxpvgWbpfAQ
Ba65QLUCTrmNSsDFIYIsdIbLsMeFvJPMDYqFJtfqgM7F5b7eHmg4yR+7+kykKmDZ
77QT7cRAxYnrL+oDG7ldjwAu61wOuiF3/TUDnYKRHln3E41XAtsfWr8a6rfQMptG
5w6Fns6QEeR7KrUf6wecAD8Kppb9Uy1ji89RatAu7q5DNAzlo/8FtIsyqr0Kpiy0
OCV4ndrxuO8mSAKgozLv+XeTNeE7KwU1A3MLUgK3VPSGqBhuw0PAY1tgJ4kIuZWr
m2doPro7H6tCllIJV1w1kO6z7bG2O0X4yG1y6iNS/LzqMXgXMTK+/FzGe2Zq9nSr
GGVy9NpS/3atXZzlE3gBaQIDAQAB
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