// Editor Status Bar — Bottom info bar with zoom controls and coordinates
// Photopea/VSCode-style status bar

(function () {
  'use strict';

  window.EditorStatusBar = {
    _el: null,
    _zoomValueEl: null,
    _zoomSliderEl: null,
    _coordsEl: null,
    _canvasSizeEl: null,
    _selectionInfoEl: null,
    _toolInfoEl: null,

    /**
     * Initialize the status bar
     */
    init: function () {
      this._el = document.getElementById('editorStatusBar');
      if (!this._el) return;

      this._zoomValueEl = this._el.querySelector('.zoom-value');
      this._zoomSliderEl = this._el.querySelector('.zoom-slider');
      this._coordsEl = this._el.querySelector('.status-coords');
      this._canvasSizeEl = this._el.querySelector('.status-canvas-size');
      this._selectionInfoEl = this._el.querySelector('.status-selection');
      this._toolInfoEl = this._el.querySelector('.status-tool');

      this.bindEvents();
      this.update();

      console.log('[EditorStatusBar] Initialized');
    },

    /**
     * Bind interactive events
     */
    bindEvents: function () {
      // Zoom slider
      if (this._zoomSliderEl) {
        this._zoomSliderEl.addEventListener('input', () => {
          const zoom = parseInt(this._zoomSliderEl.value);
          this.setZoom(zoom / 100);
        });
      }

      // Zoom buttons
      this._el.querySelectorAll('.zoom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.zoomAction;
          const state = window.ImageOverlayState;
          if (!state) return;

          if (action === 'in') {
            state.imageTransform.scale = Math.min(5, state.imageTransform.scale * 1.25);
          } else if (action === 'out') {
            state.imageTransform.scale = Math.max(0.1, state.imageTransform.scale / 1.25);
          } else if (action === 'fit') {
            state.imageTransform = { x: 0, y: 0, scale: 1 };
          } else if (action === 'actual') {
            state.imageTransform.scale = 1;
          }

          state.updateImageTransform();
          this.update();
        });
      });

      // Zoom presets from click on zoom value
      if (this._zoomValueEl) {
        this._zoomValueEl.addEventListener('click', () => {
          const state = window.ImageOverlayState;
          if (!state) return;

          // Cycle preset zooms: 50% → 100% → 200% → 50%
          const current = Math.round(state.imageTransform.scale * 100);
          let next;
          if (current < 75) next = 100;
          else if (current < 150) next = 200;
          else next = 50;

          state.imageTransform.scale = next / 100;
          state.updateImageTransform();
          this.update();
        });
      }

      // Track mouse position on the dropzone
      const dropzone = document.getElementById('imageDropzone');
      if (dropzone) {
        dropzone.addEventListener('mousemove', (e) => {
          const rect = dropzone.getBoundingClientRect();
          const x = Math.round(e.clientX - rect.left);
          const y = Math.round(e.clientY - rect.top);
          this.updateCoords(x, y);
        });

        dropzone.addEventListener('mouseleave', () => {
          this.updateCoords(null, null);
        });
      }

      // Listen for history changes
      if (window.EditorHistory) {
        window.EditorHistory.onChange((state) => {
          this.updateHistoryInfo(state);
        });
      }

      // Listen for layer/selection changes
      document.addEventListener('layerSelectionChanged', () => this.update());
      document.addEventListener('layersChanged', () => this.update());
    },

    /**
     * Set zoom level
     */
    setZoom: function (scale) {
      const state = window.ImageOverlayState;
      if (!state) return;

      state.imageTransform.scale = Math.max(0.1, Math.min(5, scale));
      state.updateImageTransform();
      this.update();
    },

    /**
     * Update all status bar info
     */
    update: function () {
      const state = window.ImageOverlayState;

      // Zoom
      if (state && this._zoomValueEl) {
        const zoom = Math.round(state.imageTransform.scale * 100);
        this._zoomValueEl.textContent = zoom + '%';

        if (this._zoomSliderEl) {
          this._zoomSliderEl.value = zoom;
        }
      }

      // Canvas size
      if (this._canvasSizeEl) {
        const w = document.getElementById('exportWidth')?.value || '1920';
        const h = document.getElementById('exportHeight')?.value || '1080';
        this._canvasSizeEl.textContent = `${w} × ${h}`;
      }

      // Tool
      if (this._toolInfoEl && state) {
        const toolNames = {
          'move': 'Taşıma',
          'color': 'Renk',
          'pan': 'Kaydırma',
          'text': 'Metin',
          'crop': 'Kırpma',
          'eraser': 'Silgi'
        };
        this._toolInfoEl.textContent = toolNames[state.activeTool] || state.activeTool;
      }

      // Selection
      if (this._selectionInfoEl && state) {
        const selected = state.selectedLineWrappers?.length || 0;
        if (selected > 0) {
          this._selectionInfoEl.textContent = `${selected} satır seçili`;
        } else if (state.selectedElement === 'chat') {
          this._selectionInfoEl.textContent = 'Sohbet seçili';
        } else {
          this._selectionInfoEl.textContent = '';
        }
      }
    },

    /**
     * Update coordinates display
     */
    updateCoords: function (x, y) {
      if (!this._coordsEl) return;

      if (x === null || y === null) {
        this._coordsEl.textContent = '';
      } else {
        this._coordsEl.textContent = `X: ${x}  Y: ${y}`;
      }
    },

    /**
     * Update history info in status bar
     */
    updateHistoryInfo: function (historyState) {
      // Update undo/redo buttons in topbar
      const undoBtn = document.getElementById('editorUndoBtn');
      const redoBtn = document.getElementById('editorRedoBtn');
      const undoCount = document.getElementById('undoCountBadge');
      const redoCount = document.getElementById('redoCountBadge');

      if (undoBtn) undoBtn.disabled = !historyState.undoCount;
      if (redoBtn) redoBtn.disabled = !historyState.redoCount;
      if (undoCount) undoCount.textContent = historyState.undoCount || '';
      if (redoCount) redoCount.textContent = historyState.redoCount || '';
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.EditorStatusBar.init());
  } else {
    window.EditorStatusBar.init();
  }
})();
