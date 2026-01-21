// Image Overlay State Management and Manipulation
// Handles image positioning, scaling, and mode switching

(function () {
  'use strict';

  // Constants
  const ZOOM_MIN_SCALE = 0.1;
  const ZOOM_MAX_SCALE = 5.0;
  const _ZOOM_STEP = 0.1; // Reserved for future use
  const _ZOOM_WHEEL_SENSITIVITY = 0.001; // Reserved for future use
  const DEFAULT_SCALE = 1.0;
  const DEFAULT_DROPZONE_WIDTH = 800;
  const DEFAULT_DROPZONE_HEIGHT = 600;
  const BOUNDS_FALLBACK = { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 };

  // DOM Element IDs (for validation)
  const DOM_IDS = {
    dropzone: 'imageDropzone',
    overlayImage: 'overlayImage',
    output: 'output',
    chatModeBtn: 'chatModeBtn',
    overlayModeBtn: 'overlayModeBtn',
    resetImageBtn: 'resetImageBtn',
    resetChatBtn: 'resetChatBtn',
    clearImageBtn: 'clearImageBtn',
    downloadOverlayBtn: 'downloadOverlayBtn',
    zoomInBtn: 'zoomInBtn',
    zoomOutBtn: 'zoomOutBtn',
    resetZoomBtn: 'resetZoomBtn',
  };

  // Expose to global scope
  window.ImageOverlayState = {
    // Image manipulation state
    imageTransform: { x: 0, y: 0, scale: DEFAULT_SCALE },
    isImageDraggingEnabled: true,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    panStartImagePos: { x: 0, y: 0 },
    imageElement: null,
    naturalDimensions: { width: 0, height: 0 },
    displayDimensions: { width: 0, height: 0 },
    basePosition: { x: 0, y: 0 },

    // Chat overlay state
    chatTransform: { x: 0, y: 0, scale: DEFAULT_SCALE },
    isChatDraggingEnabled: true, // Enabled by default now
    isChatPanning: false,
    chatPanStart: { x: 0, y: 0 },
    chatPanStartPos: { x: 0, y: 0 },
    chatElement: null,

    // Per-line dragging state
    lineTransforms: {}, // { lineIndex: { x: 0, y: 0 } }
    isLineDraggingEnabled: true, // Per-line mode active
    isLinePanning: false,
    currentDragLine: null, // Currently dragged line element
    linePanStart: { x: 0, y: 0 },
    linePanStartPos: { x: 0, y: 0 },

    // Snap-to-edge settings
    snapEnabled: true,
    snapThreshold: 20, // pixels

    // Drop zone dimensions
    dropZoneWidth: DEFAULT_DROPZONE_WIDTH,
    dropZoneHeight: DEFAULT_DROPZONE_HEIGHT,

    // Current mode
    currentMode: 'chat', // 'chat' or 'overlay'

    // Cached DOM references (initialized in init())
    _domCache: {
      dropzone: null,
      output: null,
    },

    /**
     * Initialize overlay system
     */
    init: function () {
      // Cache DOM references
      this._domCache.dropzone = document.getElementById(DOM_IDS.dropzone);
      this._domCache.output = document.getElementById(DOM_IDS.output);

      // Initialize dropzone dimensions from actual element
      if (this._domCache.dropzone) {
        this.dropZoneWidth = this._domCache.dropzone.offsetWidth || DEFAULT_DROPZONE_WIDTH;
        this.dropZoneHeight = this._domCache.dropzone.offsetHeight || DEFAULT_DROPZONE_HEIGHT;
      } else {
        console.warn('[ImageOverlay] Dropzone element not found, using default dimensions');
      }

      // Load saved chat settings
      this.loadChatSettings();

      this.setupModeSwitching();
      this.setupControlButtons();
      this.setupMouseHandlers();
      this.setupDimensionControls();
      this.setupQuickPositionButtons();

      // Listen for image loaded event
      document.addEventListener('imageLoaded', (e) => {
        if (!e.detail?.image) {
          console.error('[ImageOverlay] Invalid imageLoaded event - missing image');
          return;
        }

        this.imageElement = e.detail.image;
        this.naturalDimensions = {
          width: e.detail.image.naturalWidth || 0,
          height: e.detail.image.naturalHeight || 0,
        };

        const imgEl = document.getElementById(DOM_IDS.overlayImage);
        if (imgEl) {
          this.displayDimensions = {
            width: parseFloat(imgEl.dataset.displayWidth || 0),
            height: parseFloat(imgEl.dataset.displayHeight || 0),
          };

          this.basePosition = {
            x: parseFloat(imgEl.dataset.baseX || 0),
            y: parseFloat(imgEl.dataset.baseY || 0),
          };

          // Validate dimensions
          if (this.displayDimensions.width === 0 || this.displayDimensions.height === 0) {
            console.warn('[ImageOverlay] Invalid display dimensions, using natural dimensions');
            this.displayDimensions = { ...this.naturalDimensions };
          }

          // Start at scale 1.0, but constrain to minimum if needed
          const minScale = this.calculateMinScale();
          this.imageTransform.scale = Math.max(DEFAULT_SCALE, minScale);
          this.updateImageTransform();
        } else {
          console.error('[ImageOverlay] Overlay image element not found in DOM');
        }

        // Render chat overlay when image loads
        this.renderChatOverlay();
      });

      // Listen for chat output changes - use MutationObserver instead of setTimeout
      const output = document.getElementById('output');
      if (output) {
        const observer = new MutationObserver(() => {
          if (this.currentMode === 'overlay' && this.imageElement) {
            requestAnimationFrame(() => this.renderChatOverlay());
          }
        });
        observer.observe(output, { childList: true, subtree: true });

        // Also observe class changes on output element (for background-active toggle)
        const classObserver = new MutationObserver(() => {
          if (this.currentMode === 'overlay' && this.imageElement) {
            requestAnimationFrame(() => this.renderChatOverlay());
          }
        });
        classObserver.observe(output, { attributes: true, attributeFilter: ['class'] });
      }
    },

    /**
     * Render chat overlay on top of image
     */
    renderChatOverlay: function () {
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) return;

      // Get output HTML from existing parser
      const output = document.getElementById('output');
      if (!output) return;

      // Remove existing chat overlay
      const existing = dropzone.querySelector('.chat-overlay-container');
      if (existing) {
        existing.remove();
      }

      // Remove existing independent lines
      const existingLines = dropzone.querySelectorAll('.chat-line-wrapper.independent-line');
      existingLines.forEach(line => line.remove());

      // Get generated lines
      const generatedLines = output.querySelectorAll('.generated');
      if (generatedLines.length === 0) return;

      // Get actual output width for proper wrapping
      // Temporarily show output to measure it if hidden
      const wasHidden = output.style.display === 'none';
      if (wasHidden) {
        output.style.display = 'block';
      }
      const outputWidth = output.offsetWidth || 800; // Fallback to dropzone width
      if (wasHidden) {
        output.style.display = 'none';
      }

      // Get dropzone dimensions for proper containment
      const dropzoneWidth = dropzone.offsetWidth;
      const dropzoneHeight = dropzone.offsetHeight;

      // Create chat overlay container
      const chatOverlay = document.createElement('div');
      chatOverlay.className = 'chat-overlay-container';

      // Add data attribute if background is active (use global state from chatlog-parser)
      if (ChatlogParser.backgroundActive) {
        chatOverlay.setAttribute('data-background', 'active');
      }

      // Limit chat width to dropzone - with padding for better appearance
      const maxChatWidth = Math.min(outputWidth, dropzoneWidth - 40); // 20px padding each side
      chatOverlay.style.width = 'auto';
      chatOverlay.style.maxWidth = maxChatWidth + 'px';
      chatOverlay.style.wordWrap = 'break-word';
      chatOverlay.style.overflowWrap = 'break-word';

      // Get font size for line height calculation
      const fontSizeInput = document.getElementById('font-label');
      const fontSize = fontSizeInput ? (parseInt(fontSizeInput.value) || 12) : 12;
      const lineHeight = fontSize * 1.4; // Approximate line height

      // Each line is now completely independent and can be positioned anywhere
      generatedLines.forEach((line, index) => {
        // Create a wrapper for each line - positioned absolutely on dropzone
        const lineWrapper = document.createElement('div');
        lineWrapper.className = 'chat-line-wrapper independent-line';
        lineWrapper.dataset.lineIndex = index;

        // Set default position (stacked like original) or saved position
        const savedTransform = this.lineTransforms[index];
        const defaultY = 10 + (index * lineHeight); // Stack lines vertically
        const defaultX = 10;

        if (savedTransform) {
          lineWrapper.style.left = savedTransform.x + 'px';
          lineWrapper.style.top = savedTransform.y + 'px';
        } else {
          lineWrapper.style.left = defaultX + 'px';
          lineWrapper.style.top = defaultY + 'px';
          // Store default position
          this.lineTransforms[index] = { x: defaultX, y: defaultY };
        }

        const clone = line.cloneNode(true);
        // Preserve all classes from original - they include color classes
        // Just add the overlay-specific line class
        clone.classList.add('chat-overlay-line');

        // Apply font styling to each line
        lineWrapper.style.fontSize = fontSize + 'px';

        lineWrapper.appendChild(clone);

        // Add directly to dropzone (not to container)
        dropzone.appendChild(lineWrapper);
      });

      // Container still needed for reference but not for containing lines
      dropzone.appendChild(chatOverlay);

      this.chatElement = chatOverlay;

      // Apply font size from input (reuse fontSizeInput from above)
      if (fontSizeInput) {
        chatOverlay.style.fontSize = fontSize + 'px';

        // Apply size-aware classes (same as #output)
        chatOverlay.classList.toggle('is-small', fontSize <= 12);
        chatOverlay.classList.toggle('is-large', fontSize >= 18);

        // Apply font smoothing for smaller sizes
        if (fontSize <= 13) {
          chatOverlay.classList.add('font-smoothed');
        } else {
          chatOverlay.classList.remove('font-smoothed');
        }
      }

      // Apply text padding from inputs
      const textPaddingHorizontal = document.getElementById('textPaddingHorizontal');
      const textPaddingVertical = document.getElementById('textPaddingVertical');
      if (textPaddingHorizontal && textPaddingVertical) {
        const paddingH = parseInt(textPaddingHorizontal.value) || 0;
        const paddingV = parseInt(textPaddingVertical.value) || 0;
        chatOverlay.style.padding = `${paddingV}px ${paddingH}px`;
      }

      this.updateChatTransform();
    },

    /**
     * Setup mode switching (chat vs overlay)
     */
    setupModeSwitching: function () {
      const toggleButton = document.getElementById('toggleMode');
      const overlaySection = document.getElementById('imageOverlaySection');
      const outputDiv = document.getElementById('output');
      // Get all overlay controls (includes clearImageBtn, textPaddingControl, exportDimensionsControl)
      const overlayControls = document.querySelectorAll('.overlay-control');

      // Ensure initial state matches current mode (chat mode by default)
      // Overlay controls should only be visible when NOT in chat mode
      if (this.currentMode === 'chat') {
        overlayControls.forEach((control) => control.classList.add('button-hidden'));
        if (overlaySection) overlaySection.style.display = 'none';
        if (outputDiv) outputDiv.style.display = 'block';
      }

      toggleButton?.addEventListener('click', () => {
        const newMode = this.currentMode === 'chat' ? 'overlay' : 'chat';
        this.currentMode = newMode;

        if (newMode === 'overlay') {
          toggleButton.classList.remove('active');
          const modeText = toggleButton.querySelector('.mode-text');
          if (modeText) modeText.textContent = 'Fotoğraf';
          if (overlaySection) overlaySection.style.display = 'block';
          if (outputDiv) outputDiv.style.display = 'none';
          // Show all overlay controls
          overlayControls.forEach((control) => control.classList.remove('button-hidden'));
        } else {
          toggleButton.classList.add('active');
          const modeText = toggleButton.querySelector('.mode-text');
          if (modeText) modeText.textContent = 'Sohbet';
          if (overlaySection) overlaySection.style.display = 'none';
          if (outputDiv) outputDiv.style.display = 'block';
          // Hide all overlay controls
          overlayControls.forEach((control) => control.classList.add('button-hidden'));
        }
      });
    },

    /**
     * Setup control buttons
     */
    setupControlButtons: function () {
      const clearImageBtn = document.getElementById('clearImageBtn');
      const textPaddingHorizontal = document.getElementById('textPaddingHorizontal');
      const textPaddingVertical = document.getElementById('textPaddingVertical');

      clearImageBtn?.addEventListener('click', () => {
        if (window.ImageDropZone) {
          window.ImageDropZone.clearImage();
        }
      });

      const updatePadding = () => {
        const paddingH = parseInt(textPaddingHorizontal?.value) || 0;
        const paddingV = parseInt(textPaddingVertical?.value) || 0;
        if (this.chatElement) {
          this.chatElement.style.padding = `${paddingV}px ${paddingH}px`;
        }
      };

      textPaddingHorizontal?.addEventListener('input', updatePadding);
      textPaddingVertical?.addEventListener('input', updatePadding);
    },

    /**
     * Setup quick position buttons
     */
    setupQuickPositionButtons: function () {
      // Quick position buttons
      const positionButtons = document.querySelectorAll('[data-quick-position]');
      positionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const position = btn.dataset.quickPosition;
          if (position) {
            this.setQuickPosition(position);
          }
        });
      });

      // Auto position button
      const autoPositionBtn = document.getElementById('autoPositionBtn');
      autoPositionBtn?.addEventListener('click', () => {
        this.autoPositionChat();
      });

      // Reset chat position button
      const resetChatBtn = document.getElementById('resetChatPositionBtn');
      resetChatBtn?.addEventListener('click', () => {
        this.resetChatPosition();
      });

      // Chat scale slider
      const scaleSlider = document.getElementById('chatScaleSlider');
      const scaleValue = document.getElementById('chatScaleValue');

      if (scaleSlider) {
        // Initialize slider with current scale
        scaleSlider.value = this.chatTransform.scale * 100;
        if (scaleValue) {
          scaleValue.textContent = Math.round(this.chatTransform.scale * 100) + '%';
        }

        scaleSlider.addEventListener('input', () => {
          const scale = parseInt(scaleSlider.value) / 100;
          this.setChatScale(scale);
        });
      }
    },

    /**
     * Setup mouse handlers for dragging and zooming
     */
    setupMouseHandlers: function () {
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) {
        return;
      }

      dropzone.addEventListener('mousedown', (e) => {
        // Check if image exists
        const img = document.getElementById('overlayImage');
        if (!img) {
          return;
        }

        // Intelligent target detection: check what was clicked
        const clickedElement = e.target;
        const chatOverlay = document.querySelector('.chat-overlay-container');

        // Check if click is on a specific chat line (for per-line dragging)
        const lineWrapper = clickedElement.closest('.chat-line-wrapper');

        if (lineWrapper && this.isLineDraggingEnabled) {
          // Clicked on a specific line - drag just that line
          e.preventDefault();
          this.startLinePan(e, lineWrapper);
          return;
        }

        // Check if click is on chat overlay container (but not on a line)
        const isClickOnChat = chatOverlay && (
          clickedElement === chatOverlay ||
          chatOverlay.contains(clickedElement)
        );

        if (isClickOnChat && this.isChatDraggingEnabled && !lineWrapper) {
          // Clicked on chat container (not on a line) - drag entire chat
          e.preventDefault();
          this.startChatPan(e);
        } else if (this.isImageDraggingEnabled) {
          // Clicked elsewhere - drag image
          this.startImagePan(e);
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (this.isPanning) {
          this.updateImagePan(e);
        } else if (this.isChatPanning) {
          this.updateChatPan(e);
        } else if (this.isLinePanning) {
          this.updateLinePan(e);
        }
      });

      document.addEventListener('mouseup', () => {
        if (this.isPanning || this.isChatPanning || this.isLinePanning) {
          this.stopPan();
        }
      });

      // Mouse wheel zoom - Ctrl for chat, regular for image
      dropzone.addEventListener('wheel', (e) => {
        const img = document.getElementById('overlayImage');
        if (!img) {
          return;
        }

        const isChatControl = e.ctrlKey || e.metaKey;
        e.preventDefault();

        if (isChatControl && this.isChatDraggingEnabled) {
          // Ctrl/Cmd + scroll scales chat
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          const newScale = Math.max(
            ZOOM_MIN_SCALE,
            Math.min(ZOOM_MAX_SCALE, this.chatTransform.scale * delta)
          );
          this.chatTransform.scale = newScale;
          this.updateChatTransform();
          this.saveChatSettings();
        } else if (this.isImageDraggingEnabled) {
          // Regular scroll zooms image centered on mouse position
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          const minScale = this.calculateMinScale();
          const oldScale = this.imageTransform.scale;
          const newScale = Math.max(minScale, Math.min(ZOOM_MAX_SCALE, oldScale * delta));

          // Calculate mouse position relative to dropzone
          const rect = dropzone.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // Current image center position in dropzone space (after translation)
          const imageCenterX = this.basePosition.x + this.displayDimensions.width / 2;
          const imageCenterY = this.basePosition.y + this.displayDimensions.height / 2;

          // Mouse position relative to image center (before any transform)
          const mouseRelX = mouseX - imageCenterX - this.imageTransform.x;
          const mouseRelY = mouseY - imageCenterY - this.imageTransform.y;

          // After scaling, the point under the mouse moves by this amount:
          // We want: (mouseRelX * newScale + translateX) = (mouseRelX * oldScale + oldTranslateX)
          // So: translateX = oldTranslateX + mouseRelX * (oldScale - newScale)
          this.imageTransform.x += mouseRelX * (oldScale - newScale);
          this.imageTransform.y += mouseRelY * (oldScale - newScale);

          this.imageTransform.scale = newScale;
          this.updateImageTransform();
          this.updateZoomIndicator();
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Only handle shortcuts in overlay mode
        if (this.currentMode !== 'overlay') return;

        // R key - reset positions
        if (e.key === 'r' || e.key === 'R') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const activeElement = document.activeElement;
            const isInInput = activeElement && (
              activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA'
            );
            if (!isInInput) {
              e.preventDefault();
              this.resetChatPosition();
            }
          }
        }

        // Number keys 1-9 for quick positions (numpad style)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const activeElement = document.activeElement;
          const isInInput = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA'
          );
          if (isInInput) return;

          const positionMap = {
            '7': 'top-left',
            '8': 'top-center',
            '9': 'top-right',
            '4': 'middle-left',
            '5': 'middle-center',
            '6': 'middle-right',
            '1': 'bottom-left',
            '2': 'bottom-center',
            '3': 'bottom-right',
          };

          if (positionMap[e.key]) {
            e.preventDefault();
            this.setQuickPosition(positionMap[e.key]);
          }
        }
      });
    },

    /**
     * Start image panning
     */
    startImagePan: function (e) {
      this.isPanning = true;
      this.panStart.x = e.clientX;
      this.panStart.y = e.clientY;
      this.panStartImagePos.x = this.imageTransform.x;
      this.panStartImagePos.y = this.imageTransform.y;

      const img = document.getElementById('overlayImage');
      if (img) {
        img.classList.add('dragging');
      }

      this.updateCursor();
    },

    /**
     * Update image pan during drag
     */
    updateImagePan: function (e) {
      const deltaX = e.clientX - this.panStart.x;
      const deltaY = e.clientY - this.panStart.y;

      let newX = this.panStartImagePos.x + deltaX;
      let newY = this.panStartImagePos.y + deltaY;

      // Apply bounds using calculateImageBounds
      const bounds = this.calculateImageBounds();
      const constrainedX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      const constrainedY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));

      this.imageTransform.x = constrainedX;
      this.imageTransform.y = constrainedY;

      this.updateImageTransform();
      this.updateCoordinateDisplay();
    },

    /**
     * Start chat panning
     */
    startChatPan: function (e) {
      this.isChatPanning = true;
      this.chatPanStart.x = e.clientX;
      this.chatPanStart.y = e.clientY;
      this.chatPanStartPos.x = this.chatTransform.x;
      this.chatPanStartPos.y = this.chatTransform.y;

      const chatOverlay = document.querySelector('.chat-overlay-container');
      if (chatOverlay) {
        chatOverlay.classList.add('dragging');
      }

      this.updateCursor();
    },

    /**
     * Update chat pan during drag
     */
    updateChatPan: function (e) {
      const deltaX = e.clientX - this.chatPanStart.x;
      const deltaY = e.clientY - this.chatPanStart.y;

      let newX = this.chatPanStartPos.x + deltaX;
      let newY = this.chatPanStartPos.y + deltaY;

      // Apply snap-to-edge (unless Shift is held)
      if (!e.shiftKey) {
        const snapped = this.applySnapToEdge(newX, newY);
        newX = snapped.x;
        newY = snapped.y;
      }

      this.chatTransform.x = newX;
      this.chatTransform.y = newY;

      this.updateChatTransform();
      this.updateCoordinateDisplay();
    },

    /**
     * Stop panning
     */
    stopPan: function () {
      const wasChatPanning = this.isChatPanning;
      const wasLinePanning = this.isLinePanning;

      this.isPanning = false;
      this.isChatPanning = false;
      this.isLinePanning = false;

      const img = document.getElementById('overlayImage');
      if (img) {
        img.classList.remove('dragging');
      }

      const chatOverlay = document.querySelector('.chat-overlay-container');
      if (chatOverlay) {
        chatOverlay.classList.remove('dragging');
      }

      // Remove dragging class from any line
      if (this.currentDragLine) {
        this.currentDragLine.classList.remove('line-dragging');
        this.currentDragLine = null;
      }

      // Save chat settings if we were panning chat or line
      if (wasChatPanning || wasLinePanning) {
        this.saveChatSettings();
      }

      this.updateCursor();
    },

    /**
     * Start line panning (per-line dragging)
     */
    startLinePan: function (e, lineWrapper) {
      this.isLinePanning = true;
      this.currentDragLine = lineWrapper;

      const lineIndex = parseInt(lineWrapper.dataset.lineIndex);

      // Initialize transform for this line if not exists
      if (!this.lineTransforms[lineIndex]) {
        this.lineTransforms[lineIndex] = { x: 0, y: 0 };
      }

      this.linePanStart.x = e.clientX;
      this.linePanStart.y = e.clientY;
      this.linePanStartPos.x = this.lineTransforms[lineIndex].x;
      this.linePanStartPos.y = this.lineTransforms[lineIndex].y;

      lineWrapper.classList.add('line-dragging');
      this.updateCursor();
    },

    /**
     * Update line pan during drag
     */
    updateLinePan: function (e) {
      if (!this.currentDragLine) return;

      const lineIndex = parseInt(this.currentDragLine.dataset.lineIndex);

      const deltaX = e.clientX - this.linePanStart.x;
      const deltaY = e.clientY - this.linePanStart.y;

      const newX = this.linePanStartPos.x + deltaX;
      const newY = this.linePanStartPos.y + deltaY;

      // Update line position
      this.lineTransforms[lineIndex] = { x: newX, y: newY };

      // Apply position to line wrapper (using left/top for absolute positioning)
      this.currentDragLine.style.left = newX + 'px';
      this.currentDragLine.style.top = newY + 'px';
    },

    /**
     * Calculate minimum scale to fit image in dropzone
     */
    calculateMinScale: function () {
      // Image is already rendered at correct size via object-fit: contain
      // Minimum scale is 1.0 (100% of the rendered size)
      return 1.0;
    },

    /**
     * Calculate bounds for image positioning based on current scale
     */
    calculateImageBounds: function () {
      // Get image element to read its ACTUAL displayed size
      const img = document.getElementById(DOM_IDS.overlayImage);
      if (!img) {
        console.warn('[ImageOverlay] Cannot calculate bounds - image not found');
        return BOUNDS_FALLBACK;
      }

      // Use stored base dimensions (not affected by transforms)
      const displayWidth = this.displayDimensions.width || img.offsetWidth;
      const displayHeight = this.displayDimensions.height || img.offsetHeight;

      if (!displayWidth || !displayHeight) {
        console.warn('[ImageOverlay] Cannot calculate bounds - invalid dimensions');
        return BOUNDS_FALLBACK;
      }

      // Get dropzone dimensions (use cached reference)
      const dropzone = this._domCache.dropzone || document.getElementById(DOM_IDS.dropzone);
      if (!dropzone) {
        console.warn('[ImageOverlay] Cannot calculate bounds - dropzone not found');
        return BOUNDS_FALLBACK;
      }

      const dropzoneWidth = dropzone.offsetWidth || this.dropZoneWidth;
      const dropzoneHeight = dropzone.offsetHeight || this.dropZoneHeight;

      // Image center in its initial position (without translation)
      const imageCenterX = this.basePosition.x + displayWidth / 2;
      const imageCenterY = this.basePosition.y + displayHeight / 2;

      // Scaled image dimensions at current scale (scaled from center)
      const scaledWidth = displayWidth * this.imageTransform.scale;
      const scaledHeight = displayHeight * this.imageTransform.scale;

      // Calculate bounds: the image can move so its edges don't go past dropzone edges
      // When scaled image is SMALLER than dropzone: can't move much (keep centered-ish)
      // When scaled image is LARGER than dropzone: can move a lot (pan around)

      // Left edge of scaled image: imageCenterX + translateX - scaledWidth/2
      // This should be >= 0 (not go past left edge of dropzone)
      // So: translateX >= -imageCenterX + scaledWidth/2
      // BUT if image is larger than dropzone, left edge CAN go negative
      // Left edge can be as far left as: -(scaledWidth - dropzoneWidth)
      const leftEdgeLimit = Math.min(0, -(scaledWidth - dropzoneWidth));
      const minX = leftEdgeLimit - imageCenterX + scaledWidth / 2;

      // Right edge of scaled image: imageCenterX + translateX + scaledWidth/2
      // This should be <= dropzoneWidth (not go past right edge)
      // So: translateX <= dropzoneWidth - imageCenterX - scaledWidth/2
      // When image is larger, right edge will be negative (image extends past right)
      const rightEdgeLimit = Math.max(dropzoneWidth, scaledWidth);
      const maxX = rightEdgeLimit - imageCenterX - scaledWidth / 2;

      // Same logic for Y
      const topEdgeLimit = Math.min(0, -(scaledHeight - dropzoneHeight));
      const minY = topEdgeLimit - imageCenterY + scaledHeight / 2;

      const bottomEdgeLimit = Math.max(dropzoneHeight, scaledHeight);
      const maxY = bottomEdgeLimit - imageCenterY - scaledHeight / 2;

      return { minX, maxX, minY, maxY };
    },

    /**
     * Update image transform
     */
    updateImageTransform: function () {
      const img = document.getElementById('overlayImage');
      if (!img) {
        return;
      }

      requestAnimationFrame(() => {
        // Constrain scale to minimum (fit to container) and maximum
        const minScale = this.calculateMinScale();
        const constrainedScale = Math.max(minScale, Math.min(5, this.imageTransform.scale));
        if (constrainedScale !== this.imageTransform.scale) {
          this.imageTransform.scale = constrainedScale;
        }

        // Constrain to bounding box based on actual image size
        const bounds = this.calculateImageBounds();
        const constrainedX = Math.max(bounds.minX, Math.min(bounds.maxX, this.imageTransform.x));
        const constrainedY = Math.max(bounds.minY, Math.min(bounds.maxY, this.imageTransform.y));
        this.imageTransform.x = constrainedX;
        this.imageTransform.y = constrainedY;

        // The image element is positioned at basePosition (offsetX, offsetY)
        // We want to scale from its center, so set transform-origin to the center point
        // relative to the element's top-left corner
        const transformOrigin = `${this.displayDimensions.width / 2}px ${this.displayDimensions.height / 2}px`;
        img.style.transformOrigin = transformOrigin;

        // Apply transform: translate moves the center point, then scale from that center
        const transform = `translate(${constrainedX}px, ${constrainedY}px) scale(${constrainedScale})`;
        img.style.transform = transform;

        // Update zoom indicator after transform is applied
        this.updateZoomIndicator();
      });
    },

    /**
     * Update chat transform
     */
    updateChatTransform: function () {
      const chatOverlay = document.querySelector('.chat-overlay-container');
      if (!chatOverlay) return;

      requestAnimationFrame(() => {
        // Get dropzone dimensions for dynamic bounds
        const dropzone = document.getElementById('imageDropzone');
        const dropzoneWidth = dropzone ? dropzone.offsetWidth : this.dropZoneWidth;
        const dropzoneHeight = dropzone ? dropzone.offsetHeight : this.dropZoneHeight;

        // Constrain chat to dropzone bounds (with some padding)
        const maxX = Math.max(0, dropzoneWidth - 50);
        const maxY = Math.max(0, dropzoneHeight - 50);
        const constrainedX = Math.max(-maxX, Math.min(maxX, this.chatTransform.x));
        const constrainedY = Math.max(-maxY, Math.min(maxY, this.chatTransform.y));

        // Update stored values if constrained
        if (constrainedX !== this.chatTransform.x) this.chatTransform.x = constrainedX;
        if (constrainedY !== this.chatTransform.y) this.chatTransform.y = constrainedY;

        chatOverlay.style.transform = `translate(${constrainedX}px, ${constrainedY}px) scale(${this.chatTransform.scale})`;
      });
    },

    /**
     * Update cursor based on current state
     */
    updateCursor: function () {
      const dropzone = document.getElementById('imageDropzone');
      if (!dropzone) return;

      if (this.isPanning || this.isChatPanning) {
        dropzone.style.cursor = 'grabbing';
      } else if (this.isImageDraggingEnabled || this.isChatDraggingEnabled) {
        dropzone.style.cursor = 'grab';
      } else {
        dropzone.style.cursor = 'default';
      }
    },

    /**
     * Update zoom indicator
     */
    updateZoomIndicator: function () {
      const indicator = document.getElementById('imageZoom');
      if (indicator) {
        const percent = Math.round(this.imageTransform.scale * 100);
        indicator.textContent = percent + '%';
        indicator.parentElement.style.display = 'block';
      }
    },

    /**
     * Update coordinate display
     */
    updateCoordinateDisplay: function () {
      const display = document.getElementById('imageCoords');
      if (display && (this.isPanning || this.isChatPanning)) {
        const x = this.isPanning ? this.imageTransform.x : this.chatTransform.x;
        const y = this.isPanning ? this.imageTransform.y : this.chatTransform.y;
        display.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        display.parentElement.style.display = 'block';
      } else if (display) {
        display.parentElement.style.display = 'none';
      }
    },

    /**
     * Setup dimension controls to resize dropzone
     */
    setupDimensionControls: function () {
      const exportWidthInput = document.getElementById('exportWidth');
      const exportHeightInput = document.getElementById('exportHeight');
      const exportPPIInput = document.getElementById('exportPPI');
      const textPaddingHorizontal = document.getElementById('textPaddingHorizontal');
      const textPaddingVertical = document.getElementById('textPaddingVertical');

      // Load saved settings from localStorage
      this.loadSettings();

      // Set initial dropzone dimensions
      this.updateDropzoneDimensions();

      let resizeTimeout = null;

      // Debounce resize to avoid cascading updates while typing
      const debouncedResize = () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          this.updateDropzoneDimensions();
          this.saveSettings(); // Save after resize completes
        }, 300); // Wait 300ms after user stops typing
      };

      // Save settings when changed
      const saveOnChange = () => {
        this.saveSettings();
      };

      // Update on input change
      if (exportWidthInput) {
        exportWidthInput.addEventListener('input', debouncedResize);
      }

      if (exportHeightInput) {
        exportHeightInput.addEventListener('input', debouncedResize);
      }

      if (exportPPIInput) {
        exportPPIInput.addEventListener('input', saveOnChange);
      }

      if (textPaddingHorizontal) {
        textPaddingHorizontal.addEventListener('input', saveOnChange);
      }

      if (textPaddingVertical) {
        textPaddingVertical.addEventListener('input', saveOnChange);
      }
    },

    /**
     * Load settings from localStorage
     */
    loadSettings: function () {
      try {
        const exportWidth = localStorage.getItem('overlayExportWidth');
        const exportHeight = localStorage.getItem('overlayExportHeight');
        const exportPPI = localStorage.getItem('overlayExportPPI');
        const paddingH = localStorage.getItem('overlayPaddingHorizontal');
        const paddingV = localStorage.getItem('overlayPaddingVertical');

        const exportWidthInput = document.getElementById('exportWidth');
        const exportHeightInput = document.getElementById('exportHeight');
        const exportPPIInput = document.getElementById('exportPPI');
        const textPaddingHorizontal = document.getElementById('textPaddingHorizontal');
        const textPaddingVertical = document.getElementById('textPaddingVertical');

        if (exportWidth && exportWidthInput) exportWidthInput.value = exportWidth;
        if (exportHeight && exportHeightInput) exportHeightInput.value = exportHeight;
        if (exportPPI && exportPPIInput) exportPPIInput.value = exportPPI;
        if (paddingH && textPaddingHorizontal) textPaddingHorizontal.value = paddingH;
        if (paddingV && textPaddingVertical) textPaddingVertical.value = paddingV;

        console.log('[ImageOverlay] Loaded settings from localStorage');
      } catch (e) {
        console.warn('[ImageOverlay] Could not load settings from localStorage:', e);
      }
    },

    /**
     * Save settings to localStorage
     */
    saveSettings: function () {
      try {
        const exportWidthInput = document.getElementById('exportWidth');
        const exportHeightInput = document.getElementById('exportHeight');
        const exportPPIInput = document.getElementById('exportPPI');
        const textPaddingHorizontal = document.getElementById('textPaddingHorizontal');
        const textPaddingVertical = document.getElementById('textPaddingVertical');

        if (exportWidthInput) localStorage.setItem('overlayExportWidth', exportWidthInput.value);
        if (exportHeightInput) localStorage.setItem('overlayExportHeight', exportHeightInput.value);
        if (exportPPIInput) localStorage.setItem('overlayExportPPI', exportPPIInput.value);
        if (textPaddingHorizontal)
          localStorage.setItem('overlayPaddingHorizontal', textPaddingHorizontal.value);
        if (textPaddingVertical)
          localStorage.setItem('overlayPaddingVertical', textPaddingVertical.value);
      } catch (e) {
        console.warn('[ImageOverlay] Could not save settings to localStorage:', e);
      }
    },

    /**
     * Update dropzone dimensions based on export settings
     */
    updateDropzoneDimensions: function () {
      const dropzone = this._domCache.dropzone || document.getElementById('imageDropzone');
      if (!dropzone) {
        console.warn('[ImageOverlay] Cannot update dimensions - dropzone not found');
        return;
      }

      const exportWidthInput = document.getElementById('exportWidth');
      const exportHeightInput = document.getElementById('exportHeight');

      const exportWidth = exportWidthInput ? parseInt(exportWidthInput.value) || 1600 : 1600;
      const exportHeight = exportHeightInput ? parseInt(exportHeightInput.value) || 1200 : 1200;

      // Limit maximum display size to fit on screen (scale down if needed)
      const maxDisplayWidth = Math.min(window.innerWidth - 100, 1920);
      const maxDisplayHeight = Math.min(window.innerHeight - 400, 1080);

      let displayWidth = exportWidth;
      let displayHeight = exportHeight;

      // Scale down proportionally if too large
      if (displayWidth > maxDisplayWidth || displayHeight > maxDisplayHeight) {
        const scaleX = maxDisplayWidth / displayWidth;
        const scaleY = maxDisplayHeight / displayHeight;
        const scale = Math.min(scaleX, scaleY);
        displayWidth = Math.round(displayWidth * scale);
        displayHeight = Math.round(displayHeight * scale);
      }

      // Update dropzone size
      dropzone.style.width = displayWidth + 'px';
      dropzone.style.height = displayHeight + 'px';

      // Update stored dimensions
      this.dropZoneWidth = displayWidth;
      this.dropZoneHeight = displayHeight;

      // If image is loaded, re-render it at new size
      if (window.ImageDropZone?.state?.droppedImageElement) {
        window.ImageDropZone.renderImage(window.ImageDropZone.state.droppedImageElement, () => {
          // Callback runs after renderImage completes and updateImageElement has been called
          // displayDimensions should now be updated with new values
          const minScale = this.calculateMinScale();
          this.imageTransform = { x: 0, y: 0, scale: minScale };
          this.updateImageTransform();
          // updateZoomIndicator() is now called inside updateImageTransform()
        });
      }

      // Re-render chat overlay at new size
      if (this.imageElement && this.currentMode === 'overlay') {
        this.renderChatOverlay();
      }
    },

    /**
     * Reset image position and scale
     */
    resetImagePosition: function () {
      const minScale = this.calculateMinScale();
      this.imageTransform = { x: 0, y: 0, scale: minScale };
      this.updateImageTransform();
      this.updateZoomIndicator();
      this.updateCoordinateDisplay();
    },

    /**
     * Reset chat position and scale
     */
    resetChatPosition: function () {
      this.chatTransform = { x: 0, y: 0, scale: 1 };
      this.lineTransforms = {}; // Clear per-line positions
      this.updateChatTransform();
      this.renderChatOverlay(); // Re-render to reset line positions
      this.updateCoordinateDisplay();
      this.saveChatSettings();
    },

    /**
     * Update image element reference
     */
    updateImageElement: function (imgEl) {
      this.imageElement = imgEl;
      if (imgEl) {
        this.displayDimensions = {
          width: parseFloat(imgEl.dataset.displayWidth || 0),
          height: parseFloat(imgEl.dataset.displayHeight || 0),
        };
        this.basePosition = {
          x: parseFloat(imgEl.dataset.baseX || 0),
          y: parseFloat(imgEl.dataset.baseY || 0),
        };
      }
    },

    /**
     * Reset all state (but preserve drag enabled flags)
     */
    reset: function () {
      const minScale = this.calculateMinScale();
      this.imageTransform = { x: 0, y: 0, scale: minScale };
      this.chatTransform = { x: 0, y: 0, scale: 1 };

      // DO NOT reset drag enabled flags - preserve user preferences
      // this.isImageDraggingEnabled = false;
      // this.isChatDraggingEnabled = false;

      this.isPanning = false;
      this.isChatPanning = false;
      this.imageElement = null;
      this.chatElement = null;
    },

    /**
     * Set chat to a quick position (9 positions like numpad)
     * @param {string} position - Position name: 'top-left', 'top-center', 'top-right',
     *                            'middle-left', 'middle-center', 'middle-right',
     *                            'bottom-left', 'bottom-center', 'bottom-right'
     */
    setQuickPosition: function (position) {
      const dropzone = document.getElementById('imageDropzone');
      const chatOverlay = document.querySelector('.chat-overlay-container');
      if (!dropzone || !chatOverlay) return;

      const dropzoneWidth = dropzone.offsetWidth;
      const dropzoneHeight = dropzone.offsetHeight;
      const chatWidth = chatOverlay.offsetWidth * this.chatTransform.scale;
      const chatHeight = chatOverlay.offsetHeight * this.chatTransform.scale;

      const padding = 20; // Padding from edges
      let x = 0, y = 0;

      // Calculate X position
      if (position.includes('left')) {
        x = padding;
      } else if (position.includes('right')) {
        x = dropzoneWidth - chatWidth - padding;
      } else {
        // center
        x = (dropzoneWidth - chatWidth) / 2;
      }

      // Calculate Y position
      if (position.includes('top')) {
        y = padding;
      } else if (position.includes('bottom')) {
        y = dropzoneHeight - chatHeight - padding;
      } else {
        // middle
        y = (dropzoneHeight - chatHeight) / 2;
      }

      this.chatTransform.x = x;
      this.chatTransform.y = y;
      this.updateChatTransform();
      this.saveChatSettings();
    },

    /**
     * Auto-position chat to bottom-left (default GTA style)
     */
    autoPositionChat: function () {
      this.setQuickPosition('bottom-left');
    },

    /**
     * Apply snap-to-edge when dragging
     * @param {number} x - Current X position
     * @param {number} y - Current Y position
     * @returns {Object} - Snapped {x, y} positions
     */
    applySnapToEdge: function (x, y) {
      if (!this.snapEnabled) return { x, y };

      const dropzone = document.getElementById('imageDropzone');
      const chatOverlay = document.querySelector('.chat-overlay-container');
      if (!dropzone || !chatOverlay) return { x, y };

      const threshold = this.snapThreshold;
      const dropzoneWidth = dropzone.offsetWidth;
      const dropzoneHeight = dropzone.offsetHeight;
      const chatWidth = chatOverlay.offsetWidth * this.chatTransform.scale;
      const chatHeight = chatOverlay.offsetHeight * this.chatTransform.scale;

      let snappedX = x;
      let snappedY = y;

      // Snap to left edge
      if (Math.abs(x) < threshold) {
        snappedX = 0;
      }
      // Snap to right edge
      if (Math.abs(x - (dropzoneWidth - chatWidth)) < threshold) {
        snappedX = dropzoneWidth - chatWidth;
      }
      // Snap to horizontal center
      if (Math.abs(x - (dropzoneWidth - chatWidth) / 2) < threshold) {
        snappedX = (dropzoneWidth - chatWidth) / 2;
      }

      // Snap to top edge
      if (Math.abs(y) < threshold) {
        snappedY = 0;
      }
      // Snap to bottom edge
      if (Math.abs(y - (dropzoneHeight - chatHeight)) < threshold) {
        snappedY = dropzoneHeight - chatHeight;
      }
      // Snap to vertical center
      if (Math.abs(y - (dropzoneHeight - chatHeight) / 2) < threshold) {
        snappedY = (dropzoneHeight - chatHeight) / 2;
      }

      return { x: snappedX, y: snappedY };
    },

    /**
     * Save chat settings to localStorage
     */
    saveChatSettings: function () {
      try {
        const settings = {
          chatTransform: this.chatTransform,
          snapEnabled: this.snapEnabled,
          lineTransforms: this.lineTransforms,
        };
        localStorage.setItem('overlayChatSettings', JSON.stringify(settings));
      } catch (e) {
        console.warn('[ImageOverlay] Could not save chat settings:', e);
      }
    },

    /**
     * Load chat settings from localStorage
     */
    loadChatSettings: function () {
      try {
        const saved = localStorage.getItem('overlayChatSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.chatTransform) {
            this.chatTransform = settings.chatTransform;
          }
          if (typeof settings.snapEnabled === 'boolean') {
            this.snapEnabled = settings.snapEnabled;
          }
          if (settings.lineTransforms) {
            this.lineTransforms = settings.lineTransforms;
          }
          console.log('[ImageOverlay] Loaded chat settings from localStorage');
        }
      } catch (e) {
        console.warn('[ImageOverlay] Could not load chat settings:', e);
      }
    },

    /**
     * Set chat scale
     * @param {number} scale - Scale value (0.5 to 2.0)
     */
    setChatScale: function (scale) {
      const newScale = Math.max(0.5, Math.min(2.0, scale));
      this.chatTransform.scale = newScale;
      this.updateChatTransform();
      this.saveChatSettings();

      // Update scale display
      const scaleDisplay = document.getElementById('chatScaleValue');
      if (scaleDisplay) {
        scaleDisplay.textContent = Math.round(newScale * 100) + '%';
      }
    },
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.ImageOverlayState.init();
    });
  } else {
    window.ImageOverlayState.init();
  }
})();
