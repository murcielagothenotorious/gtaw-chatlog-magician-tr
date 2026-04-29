/**
 * UI Utilities and Minor Feature Logic
 * Includes: Toast notifications, Firefox warning, Support nudge (milestones), 
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
    
    // Set category to translation
    setTimeout(function () {
      var select = document.getElementById('feedbackCategory');
      if (select) {
        select.value = 'translation';
        // Trigger visual update
        var btn = document.querySelector('#feedbackCategoryBtns button[data-cat="translation"]');
        if (btn) window._fbSetCat(btn);
      }
    }, 50);
  };

  /* ── 3. Support Nudge (Milestones) Logic ── */
  const NudgeSystem = (function() {
    var COUNTER_KEY = 'cm_export_count';
    var DISMISS_KEY = 'cm_nudge_dismissed';
    var NUDGE_FIRST = 4;
    var NUDGE_REPEAT = 8;
    var NUDGE_MS = 8000;

    var MILESTONES = [
      { at: 3, msg: 'Hattrick! 3. export tamam', icon: 'fa-hat-wizard' },
      { at: 5, msg: 'High five! 5. export', icon: 'fa-hand-sparkles' },
      { at: 10, msg: '10 oldu, artık profesyonelsin!', icon: 'fa-star' },
      { at: 15, msg: 'Rakip üçledi! 15. export', icon: 'fa-basketball' },
      { at: 20, msg: '20 export... GTA World seni tanıyor artık', icon: 'fa-trophy' },
      { at: 25, msg: 'Çeyrek yüz! Sihirbaz olma yolundasın', icon: 'fa-wand-magic-sparkles' },
      { at: 30, msg: '30! Bu chatlog makinesi durdurulamıyor', icon: 'fa-fire' },
      { at: 42, msg: 'Hayatın, evrenin ve her şeyin cevabı: 42', icon: 'fa-infinity' },
      { at: 50, msg: 'Yarım yüz! Efsane statüsüne ulaştın', icon: 'fa-crown' },
      { at: 69, msg: 'Nice.', icon: 'fa-face-grin-wink' },
      { at: 75, msg: '75 export, bu ciddi bir bağımlılık', icon: 'fa-pills' },
      { at: 100, msg: '100! YÜZÜNCÜ EXPORT! Sen bir efsanesin', icon: 'fa-meteor' },
      { at: 150, msg: '150... Tamam sen başka bir seviyesin', icon: 'fa-rocket' },
      { at: 200, msg: '200 export. Artık Blanco sana teşekkür borçlu', icon: 'fa-gem' },
      { at: 250, msg: '250! Bu noktada chatlog seni kullanıyor', icon: 'fa-robot' },
      { at: 300, msg: '300 Spartalı değil ama 300 export!', icon: 'fa-shield-halved' },
      { at: 365, msg: 'Günde bir export, doktoru uzak tutar', icon: 'fa-calendar-check' },
      { at: 404, msg: '404: Hayatın bulunamadı (ama export bulundu)', icon: 'fa-ghost' },
      { at: 500, msg: '500! Yarım bin export. Efsaneler unutulmaz', icon: 'fa-landmark' },
      { at: 666, msg: 'Şeytani bir rakam ama helal olsun', icon: 'fa-skull' },
      { at: 777, msg: 'Jackpot! Şanslı üçlü yediler', icon: 'fa-dice' },
      { at: 1000, msg: '1000! BİN! Tanrı seviyesi açıldı', icon: 'fa-bolt' }
    ];

    var FLAVOR_POOL = [
      { msg: 'Bir chatlog daha kurtarıldı!', icon: 'fa-wand-magic-sparkles' },
      { msg: 'Sihirbaz iş başında', icon: 'fa-hat-wizard' },
      { msg: 'Chatlog sihri uygulandı', icon: 'fa-magic' },
      { msg: 'RP kalitesi +10 arttı', icon: 'fa-arrow-up' },
      { msg: 'Temiz iş, patron', icon: 'fa-thumbs-up' },
      { msg: 'Screenshot game: strong', icon: 'fa-camera' },
      { msg: 'Profesyonel dokunuş eklendi', icon: 'fa-paintbrush' },
      { msg: 'Bu chatlog başka güzel oldu', icon: 'fa-face-smile-beam' },
      { msg: 'Forum paylaşımına hazır!', icon: 'fa-share-from-square' },
      { msg: '*alkışlar*', icon: 'fa-hands-clapping' }
    ];

    function getCount() {
      return parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
    }

    function showNudge() {
      var el = document.getElementById('supportNudge');
      if (!el) return;
      setTimeout(function () {
        el.classList.add('show');
        clearTimeout(el._autoHide);
        el._autoHide = setTimeout(function () {
          el.classList.remove('show');
        }, NUDGE_MS);
      }, 1800);
    }

    return {
      onExport: function() {
        var count = getCount() + 1;
        localStorage.setItem(COUNTER_KEY, count.toString());

        // Milestone check
        var milestone = MILESTONES.find(m => m.at === count);
        if (milestone && !localStorage.getItem('cm_milestone_' + milestone.at)) {
          localStorage.setItem('cm_milestone_' + milestone.at, '1');
          setTimeout(() => showToast(milestone.msg, milestone.icon), 2600);
          return;
        }

        // Flavor toast (20% chance)
        if (count > 8 && Math.random() < 0.20) {
          var pick = FLAVOR_POOL[Math.floor(Math.random() * FLAVOR_POOL.length)];
          setTimeout(() => showToast(pick.msg, pick.icon), 2600);
        }

        // Support nudge
        if (!localStorage.getItem(DISMISS_KEY)) {
          if (count === NUDGE_FIRST || (count > NUDGE_FIRST && (count - NUDGE_FIRST) % NUDGE_REPEAT === 0)) {
            showNudge();
          }
        }
      },
      dismissNudge: function() {
        var el = document.getElementById('supportNudge');
        if (el) el.classList.remove('show');
        localStorage.setItem(DISMISS_KEY, '1');
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

    // Export listeners (for milestones/nudge)
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
