// Attach UI behaviors previously defined inline in index.html

document.addEventListener('DOMContentLoaded', function () {
  // Initialize ColorPalette after scripts have loaded
  const initPalette = () => {
    if (typeof window.ColorPalette !== 'undefined' && typeof window.ColorPalette.init === 'function') {
      window.ColorPalette.init();
    }
  };
  if (typeof window.ColorPalette === 'undefined') {
    setTimeout(initPalette, 100);
  } else {
    initPalette();
  }

  // Wire up Clear History button (CSP-safe)
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.clearHistory === 'function') {
        window.clearHistory();
      }
    });
  }

  // Wire up history tab to global toggle if present
  const historyTab = document.querySelector('.history-tab');
  if (historyTab) {
    const handler = () => {
      if (typeof window.toggleHistoryPanel === 'function') {
        window.toggleHistoryPanel();
      }
    };
    historyTab.addEventListener('click', handler);
  }

  // ── Donate modal ────────────────────────────────────────────────────────────
  document.getElementById('donateBtn')?.addEventListener('click', function () {
    document.getElementById('donateModal').style.display = 'flex';
  });
  document.getElementById('closeDonateModal')?.addEventListener('click', function () {
    document.getElementById('donateModal').style.display = 'none';
  });
  document.getElementById('donateModal')?.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  // ── Help modal ───────────────────────────────────────────────────────────────
  function showHelpModal() {
    document.getElementById('helpModal').style.display = 'flex';
  }
  function hideHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
  }
  document.getElementById('showHelpBtn')?.addEventListener('click', showHelpModal);
  document.getElementById('showHelpBtn2')?.addEventListener('click', showHelpModal);
  document.getElementById('closeHelpModal')?.addEventListener('click', hideHelpModal);
  document.getElementById('closeHelpModalBtn')?.addEventListener('click', hideHelpModal);
  document.querySelector('.help-modal-backdrop')?.addEventListener('click', hideHelpModal);

  // ── Features modal ───────────────────────────────────────────────────────────
  const featuresModal = document.getElementById('featuresModal');
  const openFeaturesBtn = document.getElementById('openFeaturesBtn');
  const closeFeaturesModal = document.getElementById('closeFeaturesModal');
  const closeFeaturesBtn = document.getElementById('closeFeaturesBtn');
  const featuresBackdrop = document.getElementById('featuresBackdrop');

  function showFeaturesModal() {
    if (featuresModal) {
      featuresModal.style.display = 'flex';
      featuresModal.querySelectorAll('video').forEach(v => v.play().catch(() => {}));
    }
  }
  function hideFeaturesModal() {
    if (featuresModal) {
      featuresModal.style.display = 'none';
      featuresModal.querySelectorAll('video').forEach(v => { v.pause(); v.currentTime = 0; });
    }
  }
  if (openFeaturesBtn) openFeaturesBtn.addEventListener('click', showFeaturesModal);
  if (closeFeaturesModal) closeFeaturesModal.addEventListener('click', hideFeaturesModal);
  if (closeFeaturesBtn) closeFeaturesBtn.addEventListener('click', hideFeaturesModal);
  if (featuresBackdrop) featuresBackdrop.addEventListener('click', hideFeaturesModal);

  // ── Changelog drawer ─────────────────────────────────────────────────────────
  const changelogDrawer = document.getElementById('changelogDrawer');
  const openChangelogBtn = document.getElementById('openChangelogBtn');
  const closeChangelogModal = document.getElementById('closeChangelogModal');
  const changelogBackdrop = document.getElementById('changelogBackdrop');

  function showChangelogModal() {
    if (changelogDrawer) changelogDrawer.classList.add('open');
    if (changelogBackdrop) changelogBackdrop.classList.add('open');
  }
  function hideChangelogModal() {
    if (changelogDrawer) changelogDrawer.classList.remove('open');
    if (changelogBackdrop) changelogBackdrop.classList.remove('open');
  }
  if (openChangelogBtn) openChangelogBtn.addEventListener('click', showChangelogModal);
  if (closeChangelogModal) closeChangelogModal.addEventListener('click', hideChangelogModal);
  if (changelogBackdrop) changelogBackdrop.addEventListener('click', hideChangelogModal);

  // ── Feedback modal ───────────────────────────────────────────────────────────
  const feedbackModalEl = document.getElementById('feedbackModal');
  const openFeedbackBtnEl = document.getElementById('openFeedbackBtn');
  const closeFeedbackModalEl = document.getElementById('closeFeedbackModal');
  const closeFeedbackBtnEl = document.getElementById('closeFeedbackBtn');
  const submitFeedbackBtnEl = document.getElementById('submitFeedbackBtn');
  const feedbackBackdropEl = document.getElementById('feedbackBackdrop');
  const feedbackStatusEl = document.getElementById('feedbackStatus');

  function showFeedbackModal() {
    if (feedbackModalEl) feedbackModalEl.style.display = 'flex';
    if (feedbackStatusEl) {
      feedbackStatusEl.style.display = 'none';
      feedbackStatusEl.className = '';
      feedbackStatusEl.textContent = '';
    }
  }
  function hideFeedbackModal() {
    if (feedbackModalEl) feedbackModalEl.style.display = 'none';
  }

  if (openFeedbackBtnEl) openFeedbackBtnEl.onclick = showFeedbackModal;
  if (closeFeedbackModalEl) closeFeedbackModalEl.onclick = hideFeedbackModal;
  if (closeFeedbackBtnEl) closeFeedbackBtnEl.onclick = hideFeedbackModal;
  if (feedbackBackdropEl) feedbackBackdropEl.onclick = hideFeedbackModal;

  if (submitFeedbackBtnEl) {
    submitFeedbackBtnEl.onclick = async function () {
      const summary = document.getElementById('feedbackSummary')?.value.trim() || '';
      const desc = document.getElementById('feedbackDescription')?.value.trim() || '';
      const priority = document.getElementById('feedbackPriority')?.value || 'Low';
      const discord = document.getElementById('feedbackDiscord')?.value.trim() || '';

      if (!summary || !desc) {
        if (feedbackStatusEl) {
          feedbackStatusEl.style.display = 'block';
          feedbackStatusEl.className = 'alert';
          feedbackStatusEl.textContent = 'Lütfen Summary ve Description alanlarını zorunlu olarak doldurun.';
          feedbackStatusEl.style.backgroundColor = '#ff5252';
          feedbackStatusEl.style.color = 'white';
        }
        return;
      }

      submitFeedbackBtnEl.disabled = true;
      submitFeedbackBtnEl.textContent = 'Gönderiliyor...';

      try {
        const response = await fetch('/api/report-bug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            errorCount: 0,
            warningCount: 0,
            errors: [],
            fullReport: `[${priority}] ${summary}\n\nDescription:\n${desc}\n\nDiscord: ${discord || 'Not provided'}`
          })
        });

        if (response.ok) {
          feedbackStatusEl.style.display = 'block';
          feedbackStatusEl.style.backgroundColor = '#4caf50';
          feedbackStatusEl.style.color = 'white';
          feedbackStatusEl.textContent = 'Geri bildiriminiz başarıyla gönderildi. Teşekkürler!';
          document.getElementById('feedbackSummary').value = '';
          document.getElementById('feedbackDescription').value = '';
          document.getElementById('feedbackDiscord').value = '';
          setTimeout(hideFeedbackModal, 3000);
        } else {
          throw new Error('Sunucu hatası');
        }
      } catch (error) {
        feedbackStatusEl.style.display = 'block';
        feedbackStatusEl.style.backgroundColor = '#ff5252';
        feedbackStatusEl.style.color = 'white';
        feedbackStatusEl.textContent = 'Bir hata oluştu, lütfen daha sonra tekrar deneyin.';
      } finally {
        submitFeedbackBtnEl.disabled = false;
        submitFeedbackBtnEl.textContent = 'Gönder';
      }
    };
  }
});
