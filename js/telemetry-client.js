/**
 * Standard Analytics & Telemetry Client
 * Tracks anonymous usage statistics to improve the application.
 * Does NOT collect personal chat data or private information.
 */
(function() {
  // Generate a simple random session ID for grouping events
  const sessionId = Math.random().toString(36).substring(2, 15);
  
  // Helper to send telemetry data
  function sendTelemetry(action, details = {}) {
    // We use navigator.sendBeacon for fast, non-blocking requests if available, otherwise fetch
    const payload = JSON.stringify({
      action,
      details,
      sessionId,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });

    const endpoint = '/api/telemetry';

    try {
      if (navigator.sendBeacon) {
        // Blob is used to set the content-type to application/json
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {}); // Silent catch
      }
    } catch (e) {
      // Ignore telemetry errors
    }
  }

  // 1. Log Page Visit
  window.addEventListener('DOMContentLoaded', () => {
    sendTelemetry('page_visit', { 
      resolution: `${window.innerWidth}x${window.innerHeight}` 
    });
  });

  // 2. Track Feature Usage (Button clicks)
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const actionId = target.id || target.getAttribute('aria-label') || target.textContent.trim();
    if (actionId) {
      // Only track major actions to prevent spam
      const trackedActions = ['downloadOutputTransparent', 'copyOutputImage', 'toggleMode', 'openFeaturesBtn', 'openFeedbackBtn'];
      
      if (trackedActions.includes(target.id) || target.classList.contains('tool-btn')) {
        sendTelemetry('button_click', { button: target.id || 'tool-button', label: actionId.substring(0, 30) });
      }
    }
  });

  // 3. Track Chatlog Formatting (Statistical)
  // We attach to the debounce function or listen to input
  let typingTimer;
  const chatlogInput = document.getElementById('chatlogInput');
  if (chatlogInput) {
    chatlogInput.addEventListener('input', () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        const text = chatlogInput.value;
        const lineCount = text.split('\\n').filter(line => line.trim().length > 0).length;
        if (lineCount > 0) {
          sendTelemetry('chatlog_formatted', { lineCount: lineCount });
        }
      }, 2000); // Wait 2 seconds after user stops typing
    });
  }

  // Expose to window for manual triggering
  window.Telemetry = { send: sendTelemetry };
})();
