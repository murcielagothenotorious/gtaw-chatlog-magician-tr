// Editor Crop Tool — Sub-tool to resize the export canvas dimension visually

(function () {
  'use strict';

  window.EditorCropTool = {
    _overlay: null,
    _box: null,
    _active: false,
    _originalDims: { w: 1920, h: 1080 },
    _currentRect: null,
    _dragBound: false,
    
    init: function () {
      // Track tool changes to activate/deactivate
      document.addEventListener('click', (e) => {
        const toolBtn = e.target.closest('.tool-btn');
        if (toolBtn && toolBtn.dataset.tool === 'crop') {
          this.activate();
        } else if (toolBtn && this._active) {
          if (toolBtn.dataset.tool !== 'crop') {
            this.cancelCrop();
          }
        }
      });

      // Bind confirm/cancel buttons (they exist in the DOM from the start)
      document.addEventListener('click', (e) => {
        if (e.target.closest('#cropConfirmBtn')) {
          e.preventDefault();
          this.confirmCrop();
        }
        if (e.target.closest('#cropCancelBtn')) {
          e.preventDefault();
          this.cancelCrop();
        }
      });

      console.log('[EditorCropTool] Initialized');
    },

    /**
     * Lazy-acquire DOM refs (they may be inside a display:none container at script load)
     */
    _ensureDOM: function () {
      if (!this._overlay) {
        this._overlay = document.getElementById('cropOverlay');
      }
      if (!this._box) {
        this._box = document.getElementById('cropAreaBox');
      }
      return !!(this._overlay && this._box);
    },

    activate: function () {
      if (this._active) return;
      if (!this._ensureDOM()) {
        console.warn('[EditorCropTool] DOM elements not found');
        return;
      }

      this._active = true;
      this._overlay.classList.add('active');
      
      const widthInput = document.getElementById('exportWidth');
      const heightInput = document.getElementById('exportHeight');
      this._originalDims = {
        w: widthInput ? parseInt(widthInput.value) : 1920,
        h: heightInput ? parseInt(heightInput.value) : 1080
      };

      // Start crop box at current dimensions scaled down to dropzone
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) return;
      
      const margin = 20;
      this._currentRect = {
        top: margin,
        left: margin,
        width: dropzone.offsetWidth - (margin * 2),
        height: dropzone.offsetHeight - (margin * 2)
      };

      this.updateBoxDOM();
      
      // Bind drag handlers only once
      if (!this._dragBound) {
        this.bindDragHandlers();
        this._dragBound = true;
      }
    },

    cancelCrop: function () {
      if (!this._active) return;
      this._active = false;
      if (this._overlay) this._overlay.classList.remove('active');
      
      // Switch back to move tool
      const moveBtn = document.querySelector('.tool-btn[data-tool="move"]');
      if (moveBtn) moveBtn.click();
    },

    confirmCrop: function () {
      if (!this._active) return;
      
      const dropzone = document.getElementById('imageDropzone');
      const exportWidthInput = document.getElementById('exportWidth');
      const exportHeightInput = document.getElementById('exportHeight');
      
      if (dropzone && exportWidthInput && exportHeightInput && this._currentRect) {
        const scaleX = this._originalDims.w / dropzone.offsetWidth;
        const scaleY = this._originalDims.h / dropzone.offsetHeight;
        
        const newExpW = Math.round(this._currentRect.width * scaleX);
        const newExpH = Math.round(this._currentRect.height * scaleY);
        
        exportWidthInput.value = newExpW;
        exportHeightInput.value = newExpH;
        
        if (window.EditorHistory) {
          const oldDims = { ...this._originalDims };
          window.EditorHistory.push({
            type: 'crop',
            description: `Kırpma uygulandı (${newExpW}x${newExpH})`,
            undo: () => { 
              exportWidthInput.value = oldDims.w; 
              exportHeightInput.value = oldDims.h;
              if (window.EditorStatusBar) window.EditorStatusBar.update();
            },
            redo: () => { 
              exportWidthInput.value = newExpW; 
              exportHeightInput.value = newExpH;
              if (window.EditorStatusBar) window.EditorStatusBar.update();
            }
          });
        }
        
        if (window.EditorStatusBar) window.EditorStatusBar.update();
      }
      
      this.cancelCrop();
    },

    updateBoxDOM: function () {
      if (!this._box || !this._currentRect) return;
      const r = this._currentRect;

      this._box.style.top = r.top + 'px';
      this._box.style.left = r.left + 'px';
      this._box.style.width = r.width + 'px';
      this._box.style.height = r.height + 'px';
      
      // Update darkness masks
      const topM = this._overlay.querySelector('.crop-darkness.top');
      const botM = this._overlay.querySelector('.crop-darkness.bottom');
      const lM = this._overlay.querySelector('.crop-darkness.left');
      const rM = this._overlay.querySelector('.crop-darkness.right');
      
      if (topM) topM.style.height = r.top + 'px';
      if (botM) botM.style.top = (r.top + r.height) + 'px';
      
      if (lM) {
        lM.style.top = r.top + 'px';
        lM.style.height = r.height + 'px';
        lM.style.width = r.left + 'px';
      }
      
      if (rM) {
        rM.style.top = r.top + 'px';
        rM.style.height = r.height + 'px';
        rM.style.left = (r.left + r.width) + 'px';
      }
    },

    bindDragHandlers: function () {
      let dragging = false;
      let dragType = '';
      let startX, startY;
      let startRect;

      // Use document-level handlers so drag works even if mouse leaves the box
      document.addEventListener('mousedown', (e) => {
        if (!this._active) return;
        
        const handle = e.target.closest('.crop-handle');
        const box = e.target.closest('.crop-area-box');
        
        if (handle) {
          // Dragging a crop handle (nw, ne, sw, se, n, s, e, w)
          dragType = handle.className.split(' ').find(c => c !== 'crop-handle') || 'move';
          dragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startRect = { ...this._currentRect };
          e.preventDefault();
          e.stopPropagation();
        } else if (box && !handle) {
          // Dragging the box itself
          dragType = 'move';
          dragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startRect = { ...this._currentRect };
          e.preventDefault();
          e.stopPropagation();
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (!dragging || !this._active) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dropzone = document.getElementById('imageDropzone');
        if (!dropzone) return;
        
        const maxW = dropzone.offsetWidth;
        const maxH = dropzone.offsetHeight;

        let r = { ...startRect };

        if (dragType === 'move') {
          r.top = Math.max(0, Math.min(startRect.top + dy, maxH - r.height));
          r.left = Math.max(0, Math.min(startRect.left + dx, maxW - r.width));
        } else {
          if (dragType.includes('n')) {
            r.top = Math.min(startRect.top + dy, startRect.top + startRect.height - 20);
            r.top = Math.max(0, r.top);
            r.height = startRect.height + (startRect.top - r.top);
          }
          if (dragType.includes('s')) {
            r.height = Math.max(20, startRect.height + dy);
            if (r.top + r.height > maxH) r.height = maxH - r.top;
          }
          if (dragType.includes('w')) {
            r.left = Math.min(startRect.left + dx, startRect.left + startRect.width - 20);
            r.left = Math.max(0, r.left);
            r.width = startRect.width + (startRect.left - r.left);
          }
          if (dragType.includes('e')) {
            r.width = Math.max(20, startRect.width + dx);
            if (r.left + r.width > maxW) r.width = maxW - r.left;
          }
        }
        
        this._currentRect = r;
        this.updateBoxDOM();
      });

      document.addEventListener('mouseup', () => {
        if (dragging) {
          dragging = false;
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.EditorCropTool.init());
  } else {
    window.EditorCropTool.init();
  }
})();
