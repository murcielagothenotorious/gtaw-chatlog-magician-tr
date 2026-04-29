/**
 * UI Utilities and Minor Feature Logic
 * Includes: Toast notifications, Firefox warning, Support nudge (popup after exports), 
 * Includes: Toast notifications, Firefox warning, Support nudge (popup after exports), 
 * Feedback category selection, and various DOM listeners.
 */
(function () {
  'use strict';
  /* ── 1. Toast Notification Logic ── */
  function showToast(msg, icon) {
    const t = document.getElementById('cmToast');
    const m = document.getElementById('cmToastMsg');
    const ic = t ? t.querySelector('.toast-icon') : null;
    
    if (!t) return;
    
    if (m) m.textContent = msg || 'Panoya kopyalandı';
    if (ic) ic.className = 'fas ' + (icon || 'fa-check-circle') + ' toast-icon';
    
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { 
      t.classList.remove('show'); 
    }, 2200);
  }
  window.showToast = showToast;

  /* ── 2. Feedback Category Selection ── */
  window._fbSetCat = function (btn) {
    var cat = btn.getAttribute('data-cat');
    var input = document.getElementById('feedbackCategory');
    if (input) input.value = cat;
    
    var btns = document.querySelectorAll('#feedbackCategoryBtns button');
    btns.forEach(function (b) {
      b.style.background = 'rgba(255,255,255,0.04)';
      b.style.borderColor = 'rgba(255,255,255,0.08)';
      b.style.color = 'rgba(255,255,255,0.5)';
    });
    
    btn.style.background = 'rgba(52,152,219,0.15)';
    btn.style.borderColor = 'rgba(52,152,219,0.4)';
    btn.style.color = '#3498db';
    
    var hint = document.getElementById('translationHint');
    if (hint) hint.style.display = cat === 'translation' ? 'block' : 'none';
  };

  /* ── 3. Translation Feedback Helper ── */
  window.openTranslationFeedback = function () {
    var modal = document.getElementById('feedbackModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    setTimeout(function () {
      var select = document.getElementById('feedbackCategory');
      if (select) {
        select.value = 'translation';
        var btn = document.querySelector('#feedbackCategoryBtns button[data-cat="translation"]');
        if (btn) window._fbSetCat(btn);
      }
    }, 50);
  };

  /* ── 3. Support Nudge (Popup every 4-5 exports) ── */
  const NudgeSystem = (function() {
    var COUNTER_KEY = 'cm_export_count';
    var NUDGE_INTERVAL = 4 + Math.floor(Math.random() * 2); // 4 veya 5

    function getCount() {
      return parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
    }

    function showNudgePopup() {
      var el = document.getElementById('supportNudge');
      if (!el) return;
      setTimeout(function () {
        el.classList.add('show');
        clearTimeout(el._autoHide);
        el._autoHide = setTimeout(function () {
          el.classList.remove('show');
        }, 8000);
      }, 1800);
    }

    return {
      onExport: function() {
        var count = getCount() + 1;
        localStorage.setItem(COUNTER_KEY, count.toString());

        // Her 4-5 exportta bir support nudge popup göster
        if (count % NUDGE_INTERVAL === 0) {
          showNudgePopup();
        }
      },
      dismissNudge: function() {
        // Sadece o anki popup'ı kapat, bir daha göstermemeyi kaydetme
        var el = document.getElementById('supportNudge');
        if (el) el.classList.remove('show');
      }
    };
  })();

  /* ── 4. Info Box Persistence ── */
  const INFO_BOX_KEY = 'cm_infobox_closed';


  window.closeInfoBox = function () {
    var el = document.getElementById('infoBox');
    if (el) el.style.display = 'none';
    localStorage.setItem(INFO_BOX_KEY, '1');
  };

  function initInfoBox() {
    if (localStorage.getItem(INFO_BOX_KEY)) {
      var el = document.getElementById('infoBox');
      if (el) el.style.display = 'none';
    }
  }

  /* ── 5. Firefox Warning Logic ── */
  function initFirefoxWarning() {
    setTimeout(function () {
      var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
      var hasSeenWarning = localStorage.getItem('cm_firefox_warning_seen');
      if (isFirefox && !hasSeenWarning) {
        var modal = document.getElementById('firefoxModal');
        if (modal) modal.style.display = 'flex';
      }
    }, 500);
  }

  function closeFirefoxWarning() {
    var modal = document.getElementById('firefoxModal');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('cm_firefox_warning_seen', '1');
  }

  /* ── 6. Main Initialization ── */
  document.addEventListener('DOMContentLoaded', function () {
    // Firefox warning listeners
    var understoodBtn = document.getElementById('understoodFirefoxBtn');
    var ffBackdrop = document.getElementById('firefoxModal');
    if (understoodBtn) understoodBtn.addEventListener('click', closeFirefoxWarning);
    if (ffBackdrop) ffBackdrop.addEventListener('click', function (e) {
      if (e.target === ffBackdrop) closeFirefoxWarning();
    });
    initFirefoxWarning();

    // Export listeners (for nudge)
    // Export listeners (for nudge)
    var copyBtn = document.getElementById('copyOutputImage');
    var dlBtn = document.getElementById('downloadOutputTransparent');
    if (copyBtn) copyBtn.addEventListener('click', () => setTimeout(NudgeSystem.onExport, 500));
    if (dlBtn) dlBtn.addEventListener('click', () => setTimeout(NudgeSystem.onExport, 500));

    // Nudge dismissal
    var nudgeClose = document.getElementById('supportNudgeClose');
    if (nudgeClose) nudgeClose.addEventListener('click', NudgeSystem.dismissNudge);

    // Toast triggers
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        setTimeout(() => showToast('Panoya kopyalandı', 'fa-check-circle'), 300);
      });
    }
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        setTimeout(() => showToast('Görsel indiriliyor...', 'fa-download'), 200);
      });
    }

    // Changelog badge dot logic
    var SEEN_KEY = 'cm_changelog_seen_v1_4_1';
    var badge = document.getElementById('changelogBadge');
    var openChangelogBtn = document.getElementById('openChangelogBtn');
    var closeChangelogModal = document.getElementById('closeChangelogModal');
    if (badge && !localStorage.getItem(SEEN_KEY)) {
      badge.style.display = 'block';
    }
    function markChangelogSeen() {
      localStorage.setItem(SEEN_KEY, '1');
      if (badge) badge.style.display = 'none';
    }
    if (openChangelogBtn) openChangelogBtn.addEventListener('click', markChangelogSeen);
    if (closeChangelogModal) closeChangelogModal.addEventListener('click', markChangelogSeen);
    
    // InfoBox init
    initInfoBox();

    // infoBox feedback button fallback
    document.querySelectorAll('.openFeedbackBtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = document.getElementById('feedbackModal');
        if (m) m.style.display = 'flex';
      });
    });

    // Feedback prefix logic
    var submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    if (submitFeedbackBtn) {
      submitFeedbackBtn.addEventListener('click', function () {
        var cat = document.getElementById('feedbackCategory');
        var summary = document.getElementById('feedbackSummary');
        if (!cat || !summary) return;
        var labels = { suggestion: '[İstek]', bug: '[Hata]', translation: '[Çeviri]' };
        var label = labels[cat.value] || '';
        var val = summary.value.trim();
        if (label && !val.startsWith('[')) {
          summary.value = label + ' ' + val;
        }
      }, true);
    }

    // Floating button sync (changelog/history)
    var floatingBtn = document.getElementById('floatingSysMsgToggle');
    var drawer = document.getElementById('changelogDrawer');
    var historyPanel = document.getElementById('historyPanel');
    function syncFloating() {
      if (!floatingBtn) return;
      var hidden = (drawer && drawer.classList.contains('open')) ||
                   (historyPanel && historyPanel.classList.contains('open'));
      floatingBtn.style.transition = 'opacity 0.2s';
      floatingBtn.style.opacity = hidden ? '0' : '';
      floatingBtn.style.pointerEvents = hidden ? 'none' : '';
    }
    if (drawer) new MutationObserver(syncFloating).observe(drawer, { attributes: true, attributeFilter: ['class'] });
    if (historyPanel) new MutationObserver(syncFloating).observe(historyPanel, { attributes: true, attributeFilter: ['class'] });
  });
})();