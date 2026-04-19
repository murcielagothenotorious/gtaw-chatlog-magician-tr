// Editor Text Tool — Adds custom text directly to the canvas

(function () {
  'use strict';

  window.EditorTextTool = {
    _activeInput: null,
    
    init: function () {
      // Use event delegation on document to catch dblclick even when dropzone starts hidden
      document.addEventListener('dblclick', (e) => {
        const dropzone = document.getElementById('imageDropzone');
        if (!dropzone || !dropzone.contains(e.target)) return;
        this.handleDoubleClick(e);
      });

      console.log('[EditorTextTool] Initialized');
    },

    handleDoubleClick: function (e) {
      if (!window.ImageOverlayState) return;
      if (window.ImageOverlayState.currentMode !== 'overlay') return;
      if (window.ImageOverlayState.activeTool !== 'text') return;
      
      // Don't create text on crop overlay elements
      if (e.target.closest('.crop-overlay')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) return;
      
      const rect = dropzone.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.createInput(x, y);
    },

    createInput: function (x, y) {
      this.commitActiveInput(); // Commit any existing input

      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) return;

      const input = document.createElement('div');
      input.className = 'text-tool-input';
      input.contentEditable = 'true';
      input.style.position = 'absolute';
      input.style.left = x + 'px';
      input.style.top = y + 'px';
      input.style.fontSize = (document.getElementById('font-label')?.value || 12) + 'px';
      input.style.fontFamily = window.ChatlogParser?.currentFontFamily || 'Arial';
      input.style.zIndex = '50';

      dropzone.appendChild(input);
      
      // Focus after append
      requestAnimationFrame(() => {
        input.focus();
      });

      this._activeInput = input;

      input.addEventListener('blur', () => {
        // Small delay to allow click events to fire before committing
        setTimeout(() => this.commitActiveInput(), 100);
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.commitActiveInput();
          // Switch back to move tool
          const moveBtn = document.querySelector('.tool-btn[data-tool="move"]');
          if (moveBtn) moveBtn.click();
        } else if (e.key === 'Escape') {
          input.remove();
          this._activeInput = null;
          const moveBtn = document.querySelector('.tool-btn[data-tool="move"]');
          if (moveBtn) moveBtn.click();
        }
        // Stop propagation so tool shortcuts (V, C, etc.) don't fire while typing
        e.stopPropagation();
      });
    },

    commitActiveInput: function () {
      if (!this._activeInput) return;
      
      const input = this._activeInput;
      const text = input.innerText.trim();
      
      this._activeInput = null;
      
      if (!text) {
        input.remove();
        return;
      }

      // Convert to a chat line element
      const lineWrapper = document.createElement('div');
      lineWrapper.className = 'chat-line-wrapper independent-line custom-text-line';
      lineWrapper.dataset.lineIndex = 'custom_' + Date.now();
      lineWrapper.style.position = 'absolute';
      lineWrapper.style.left = input.style.left;
      lineWrapper.style.top = input.style.top;
      lineWrapper.style.zIndex = '5';
      
      const innerLine = document.createElement('span');
      innerLine.className = 'colorable lightgrey';
      innerLine.style.fontSize = input.style.fontSize;
      innerLine.style.fontFamily = input.style.fontFamily;
      innerLine.style.fontWeight = '700';
      innerLine.innerText = text;
      
      lineWrapper.appendChild(innerLine);
      
      // Find the right container to append to
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) {
        input.remove();
        return;
      }

      let targetContainer = dropzone.querySelector('.chat-overlay-container');
      
      if (!targetContainer) {
        // Create chat overlay container if it doesn't exist
        targetContainer = document.createElement('div');
        targetContainer.className = 'chat-overlay-container';
        targetContainer.style.position = 'absolute';
        targetContainer.style.top = '0';
        targetContainer.style.left = '0';
        targetContainer.style.zIndex = '50';
        dropzone.appendChild(targetContainer);
      }
      
      targetContainer.appendChild(lineWrapper);
      input.remove();

      // Track position in ImageOverlayState
      if (window.ImageOverlayState) {
        const idx = lineWrapper.dataset.lineIndex;
        window.ImageOverlayState.lineTransforms[idx] = { 
          x: parseFloat(lineWrapper.style.left), 
          y: parseFloat(lineWrapper.style.top) 
        };
        
        // Allow double-click to edit again when text tool is active
        lineWrapper.addEventListener('dblclick', (e) => {
          if (!window.ImageOverlayState || window.ImageOverlayState.activeTool !== 'text') return;
          e.stopPropagation();
          e.preventDefault();
          
          const currentText = innerLine.innerText;
          const lx = parseFloat(lineWrapper.style.left) || 0;
          const ly = parseFloat(lineWrapper.style.top) || 0;
          lineWrapper.remove();
          this.createInput(lx, ly);
          if (this._activeInput) this._activeInput.innerText = currentText;
        });
      }

      // Record History
      if (window.EditorHistory) {
        const wrapperRef = lineWrapper;
        const containerRef = targetContainer;
        window.EditorHistory.push({
          type: 'add-text',
          description: 'Metin eklendi: "' + text.substring(0, 20) + (text.length > 20 ? '...' : '') + '"',
          undo: () => wrapperRef.remove(),
          redo: () => containerRef.appendChild(wrapperRef)
        });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.EditorTextTool.init());
  } else {
    window.EditorTextTool.init();
  }
})();
