// Layer UI Controller - FIXED VERSION
// Properly handles multiple layers with visibility and selection

(function () {
    'use strict';

    window.LayerUI = {
        _isRendering: false,

        /**
         * Initialize the layer UI
         */
        init: function () {
            this.layerListEl = document.getElementById('layerList');
            this.effectsSection = document.getElementById('layerEffectsSection');
            this.selectedLayerBadge = document.getElementById('selectedLayerName');
            this.addLayerBtn = document.getElementById('addLayerBtn');

            if (!this.layerListEl) {
                console.warn('[LayerUI] Layer list element not found');
                return;
            }

            this.bindEvents();
            this.updateDropzoneSize(); // Initial resize

            // Listen for layer changes
            document.addEventListener('layersChanged', () => {
                if (!this._isRendering) {
                    this.renderLayerList();
                    this.renderAllLayersToDropzone(); // Re-render all layers
                }
            });

            document.addEventListener('layerSelectionChanged', (e) => {
                // Re-render to update which element gets the #overlayImage ID
                this.renderAllLayersToDropzone();
                this.onSelectionChanged(e.detail.layer);
            });

            console.log('[LayerUI] Initialized');
        },

        /**
         * Bind UI events
         */
        bindEvents: function () {
            const self = this;

            if (this.addLayerBtn) {
                this.addLayerBtn.addEventListener('click', () => {
                    const fileInput = document.getElementById('imageFileInput');
                    if (fileInput) fileInput.click();
                });
            }

            // Export dimensions - sync dropzone size
            const exportWidth = document.getElementById('exportWidth');
            const exportHeight = document.getElementById('exportHeight');

            if (exportWidth) {
                exportWidth.addEventListener('change', () => this.updateDropzoneSize());
            }
            if (exportHeight) {
                exportHeight.addEventListener('change', () => this.updateDropzoneSize());
            }

            // Effect controls
            const opacitySlider = document.getElementById('imageOpacity');
            const blurSlider = document.getElementById('imageBlur');
            const grayscaleCheckbox = document.getElementById('imageGrayscale');

            if (opacitySlider) {
                opacitySlider.addEventListener('input', () => {
                    const value = parseInt(opacitySlider.value);
                    document.getElementById('opacityValue').textContent = value + '%';

                    if (window.LayerManager) {
                        // Silent update to state
                        window.LayerManager.updateSelectedLayerEffect('opacity', value, false);

                        // Manual DOM update for smoothness
                        const img = document.getElementById('overlayImage');
                        if (img) img.style.opacity = value / 100;

                        // Sync ImageOverlayState manually
                        if (window.ImageOverlayState) window.ImageOverlayState.imageOpacity = value;
                    }
                });

                // Trigger full update on release to ensure everything is synced
                opacitySlider.addEventListener('change', () => {
                    if (window.LayerManager) {
                        window.LayerManager.updateSelectedLayerEffect('opacity', parseInt(opacitySlider.value), true);
                    }
                });
            }

            if (blurSlider) {
                blurSlider.addEventListener('input', () => {
                    const value = parseInt(blurSlider.value);
                    document.getElementById('blurValue').textContent = value + 'px';

                    if (window.LayerManager) {
                        // Silent update to state
                        window.LayerManager.updateSelectedLayerEffect('blur', value, false);

                        // Manual DOM update for smoothness
                        const img = document.getElementById('overlayImage');
                        // We need to preserve other filters if they exist (like grayscale)
                        if (img) {
                            const grayscale = document.getElementById('imageGrayscale')?.checked ? 1 : 0;
                            img.style.filter = `blur(${value}px) grayscale(${grayscale})`;
                        }

                        if (window.ImageOverlayState) window.ImageOverlayState.imageBlur = value;
                    }
                });

                // Trigger full update on release
                blurSlider.addEventListener('change', () => {
                    if (window.LayerManager) {
                        window.LayerManager.updateSelectedLayerEffect('blur', parseInt(blurSlider.value), true);
                    }
                });
            }

            if (grayscaleCheckbox) {
                grayscaleCheckbox.addEventListener('change', () => {
                    if (window.LayerManager) {
                        window.LayerManager.updateSelectedLayerEffect('grayscale', grayscaleCheckbox.checked);
                    }
                });
            }

            // Chat Settings Controls
            const chatOpacitySlider = document.getElementById('chatOpacity');

            if (chatOpacitySlider) {
                chatOpacitySlider.addEventListener('input', () => {
                    const value = parseInt(chatOpacitySlider.value);
                    document.getElementById('chatOpacityValue').textContent = value + '%';

                    // Check if there are selected lines (multi-select supported)
                    const selectedWrappers = window.ImageOverlayState?.selectedLineWrappers || [];

                    if (selectedWrappers.length > 0) {
                        // Apply to all selected lines and save their opacity
                        selectedWrappers.forEach(wrapper => {
                            wrapper.style.opacity = value / 100;
                            const lineIndex = parseInt(wrapper.dataset.lineIndex);
                            if (window.ImageOverlayState) {
                                window.ImageOverlayState.lineOpacities[lineIndex] = value;
                            }
                        });
                    } else {
                        // No line selected - apply to all (fallback behavior)
                        const chatOverlay = document.querySelector('.chat-overlay-container');
                        if (chatOverlay) {
                            chatOverlay.style.opacity = value / 100;
                        }
                        const lines = document.querySelectorAll('.chat-line-wrapper.independent-line');
                        lines.forEach(line => {
                            line.style.opacity = value / 100;
                        });
                    }

                    if (window.ImageOverlayState) {
                        window.ImageOverlayState.chatOpacity = value;
                    }
                });
            }

            // Note: chatScaleSlider removed per user request - system handles text sizing

            // Note: chatBackgroundToggle removed per user request
        },

        /**
         * Update dropzone size based on export dimensions
         */
        updateDropzoneSize: function () {
            const dropzone = document.getElementById('imageDropzone');
            const exportWidthInput = document.getElementById('exportWidth');
            const exportHeightInput = document.getElementById('exportHeight');
            if (!dropzone) return;

            const width = parseInt(exportWidthInput?.value) || 1920;
            const height = parseInt(exportHeightInput?.value) || 1080;
            const aspectRatio = width / height;

            // Get available space (parent container)
            const container = dropzone.parentElement;
            // Fallback to a reasonable default if container is hidden/0 width
            const maxWidth = (container && container.offsetWidth > 0) ? container.offsetWidth - 40 : Math.min(window.innerWidth - 60, 1400);

            // Dynamic max height based on viewport - more flexible now that sidebar is below
            const maxHeight = Math.max(400, window.innerHeight - 350);

            let newWidth, newHeight;

            // Scale to fit within max constraints while maintaining aspect ratio
            if (width / maxWidth > height / maxHeight) {
                // Width is the limiting factor
                newWidth = Math.min(width, maxWidth);
                newHeight = Math.round(newWidth / aspectRatio);
            } else {
                // Height is the limiting factor
                newHeight = Math.min(height, maxHeight);
                newWidth = Math.round(newHeight * aspectRatio);
            }

            // Apply dimensions to DOM
            dropzone.style.width = newWidth + 'px';
            dropzone.style.height = newHeight + 'px';

            // Sync with ImageOverlayState if it exists (for dragging boundaries)
            if (window.ImageOverlayState) {
                window.ImageOverlayState.dropZoneWidth = newWidth;
                window.ImageOverlayState.dropZoneHeight = newHeight;

                // If in overlay mode, re-render chat
                if (window.ImageOverlayState.currentMode === 'overlay') {
                    window.ImageOverlayState.renderChatOverlay();
                }
            }

            // Re-render layers to fit new size
            this.renderAllLayersToDropzone();

            console.log(`[LayerUI] Dropzone resized to ${newWidth}x${newHeight} (export: ${width}x${height}, maxWidth: ${maxWidth}, maxHeight: ${maxHeight})`);
        },

        /**
         * Render ALL visible layers to the dropzone
         * Uses 'overlayImage' ID on the selected layer for drag/zoom compatibility
         */
        renderAllLayersToDropzone: function () {
            const dropzone = document.getElementById('imageDropzone');
            if (!dropzone || !window.LayerManager) return;

            // Remove ALL existing layer images
            const existingLayerImages = dropzone.querySelectorAll('.layer-image');
            existingLayerImages.forEach(img => img.remove());

            // Remove previous overlayImage if created by LayerUI
            const oldOverlay = document.getElementById('overlayImage');
            if (oldOverlay && oldOverlay.classList.contains('layer-managed')) {
                oldOverlay.remove();
            }

            // Get ALL layers sorted by zIndex
            const layers = window.LayerManager.getLayersSorted();
            const selectedId = window.LayerManager.selectedLayerId;

            // Get dropzone size (use export dimensions if set)
            const exportWidth = document.getElementById('exportWidth');
            const exportHeight = document.getElementById('exportHeight');
            const dropzoneWidth = exportWidth?.value ? parseInt(exportWidth.value) : dropzone.offsetWidth;
            const dropzoneHeight = exportHeight?.value ? parseInt(exportHeight.value) : dropzone.offsetHeight;

            layers.forEach((layer, index) => {
                if (layer.type !== 'image' || !layer.imageSrc) return;

                const imgEl = document.createElement('img');
                const isSelected = layer.id === selectedId;

                // Give selected layer the overlayImage ID for drag/zoom compatibility
                if (isSelected) {
                    imgEl.id = 'overlayImage';
                    imgEl.classList.add('layer-managed');
                }

                imgEl.className = 'layer-image image-overlay-element' + (isSelected ? ' loaded' : '');
                imgEl.src = layer.imageSrc;
                imgEl.dataset.layerId = layer.id;

                // Visibility
                imgEl.style.display = layer.visible ? 'block' : 'none';

                // Apply effects
                imgEl.style.opacity = layer.opacity / 100;
                const filters = [];
                if (layer.blur > 0) filters.push(`blur(${layer.blur}px)`);
                if (layer.grayscale) filters.push('grayscale(100%)');
                imgEl.style.filter = filters.join(' ') || 'none';

                // Z-index based on layer order
                imgEl.style.zIndex = index + 1;
                imgEl.style.position = 'absolute';

                // Apply transform from layer data (always use layer.transform for consistency)
                imgEl.style.transform = `translate(${layer.transform.x}px, ${layer.transform.y}px) scale(${layer.transform.scale})`;

                // Calculate dimensions on load
                imgEl.onload = function () {
                    const imageAspect = this.naturalWidth / this.naturalHeight;
                    const containerWidth = dropzone.offsetWidth;
                    const containerHeight = dropzone.offsetHeight;
                    const containerAspect = containerWidth / containerHeight;

                    let displayWidth, displayHeight, offsetX, offsetY;

                    if (imageAspect > containerAspect) {
                        displayWidth = containerWidth;
                        displayHeight = containerWidth / imageAspect;
                        offsetX = 0;
                        offsetY = (containerHeight - displayHeight) / 2;
                    } else {
                        displayWidth = containerHeight * imageAspect;
                        displayHeight = containerHeight;
                        offsetX = (containerWidth - displayWidth) / 2;
                        offsetY = 0;
                    }

                    this.style.width = displayWidth + 'px';
                    this.style.height = displayHeight + 'px';
                    this.style.left = offsetX + 'px';
                    this.style.top = offsetY + 'px';

                    // Store display dimensions for ImageOverlayState
                    this.dataset.displayWidth = displayWidth;
                    this.dataset.displayHeight = displayHeight;
                    this.dataset.baseX = offsetX;
                    this.dataset.baseY = offsetY;

                    // If selected, update ImageOverlayState
                    if (isSelected && window.ImageOverlayState) {
                        window.ImageOverlayState.displayDimensions = { width: displayWidth, height: displayHeight };
                        window.ImageOverlayState.basePosition = { x: offsetX, y: offsetY };
                        window.ImageOverlayState.naturalDimensions = {
                            width: this.naturalWidth,
                            height: this.naturalHeight
                        };
                        window.ImageOverlayState.imageElement = this;
                    }
                };

                // Insert before chat overlay
                const chatOverlay = dropzone.querySelector('.chat-overlay-container');
                if (chatOverlay) {
                    dropzone.insertBefore(imgEl, chatOverlay);
                } else {
                    dropzone.appendChild(imgEl);
                }
            });

            console.log('[LayerUI] Rendered', layers.length, 'layers to dropzone');
        },

        /**
         * Toggle visibility of a specific layer
         */
        toggleLayerVisibility: function (layerId) {
            if (!window.LayerManager) return;

            // Toggle in LayerManager (this will trigger layersChanged event)
            window.LayerManager.toggleLayerVisibility(layerId);
        },

        /**
         * Render the layer list
         */
        renderLayerList: function () {
            if (!this.layerListEl || !window.LayerManager) return;

            this._isRendering = true;

            const layers = window.LayerManager.layers;
            const selectedId = window.LayerManager.selectedLayerId;
            const emptyState = this.layerListEl.querySelector('.layer-empty-state');

            // Clear existing layer items
            const existingItems = this.layerListEl.querySelectorAll('.layer-item');
            existingItems.forEach(item => item.remove());

            // Render layers in reverse order (top layer first in list)
            const sortedLayers = [...layers].reverse();

            sortedLayers.forEach(layer => {
                const layerEl = this.createLayerElement(layer, layer.id === selectedId);
                if (emptyState) {
                    this.layerListEl.insertBefore(layerEl, emptyState);
                } else {
                    this.layerListEl.appendChild(layerEl);
                }
            });

            this._isRendering = false;
        },

        /**
         * Create a layer list item element
         */
        createLayerElement: function (layer, isSelected) {
            const item = document.createElement('div');
            item.className = 'layer-item' + (isSelected ? ' selected' : '') + (!layer.visible ? ' hidden-layer' : '');
            item.dataset.layerId = layer.id;

            // Thumbnail
            const thumbnail = document.createElement('div');
            thumbnail.className = 'layer-thumbnail';
            if (layer.type === 'image' && layer.imageSrc) {
                const img = document.createElement('img');
                img.src = layer.imageSrc;
                thumbnail.appendChild(img);
            } else if (layer.type === 'chat') {
                thumbnail.innerHTML = '<i class="fas fa-comment"></i>';
            } else {
                thumbnail.innerHTML = '<i class="fas fa-image"></i>';
            }

            // Info
            const info = document.createElement('div');
            info.className = 'layer-info';
            info.innerHTML = `
        <div class="layer-name">${layer.name}</div>
        <div class="layer-type">${layer.type === 'image' ? 'Görüntü' : 'Metin'}</div>
      `;

            // Actions - FIXED: Icon shows current state correctly
            const actions = document.createElement('div');
            actions.className = 'layer-actions';
            actions.innerHTML = `
        <button type="button" class="layer-action-btn visibility-btn ${!layer.visible ? 'off' : ''}" 
                title="${layer.visible ? 'Gizle' : 'Göster'}">
          <i class="fas fa-${layer.visible ? 'eye' : 'eye-slash'}"></i>
        </button>
        <button type="button" class="layer-action-btn move-up-btn" title="Yukarı taşı">
          <i class="fas fa-chevron-up"></i>
        </button>
        <button type="button" class="layer-action-btn move-down-btn" title="Aşağı taşı">
          <i class="fas fa-chevron-down"></i>
        </button>
        <button type="button" class="layer-action-btn delete-btn" title="Sil">
          <i class="fas fa-trash"></i>
        </button>
      `;

            item.appendChild(thumbnail);
            item.appendChild(info);
            item.appendChild(actions);

            // Click to select
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.layer-action-btn')) {
                    window.LayerManager.selectLayer(layer.id);
                }
            });

            // Visibility toggle - FIXED: Just call the manager, event will handle rendering
            actions.querySelector('.visibility-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.LayerManager.toggleLayerVisibility(layer.id);
            });

            // Move up
            actions.querySelector('.move-up-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.LayerManager.moveLayerUp(layer.id);
            });

            // Move down
            actions.querySelector('.move-down-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.LayerManager.moveLayerDown(layer.id);
            });

            // Delete
            actions.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.LayerManager.removeLayer(layer.id);
            });

            return item;
        },

        /**
         * Handle selection change
         */
        onSelectionChanged: function (layer) {
            const opacitySlider = document.getElementById('imageOpacity');
            const blurSlider = document.getElementById('imageBlur');
            const grayscaleCheckbox = document.getElementById('imageGrayscale');
            const opacityValue = document.getElementById('opacityValue');
            const blurValue = document.getElementById('blurValue');

            if (layer) {
                if (opacitySlider) opacitySlider.value = layer.opacity;
                if (blurSlider) blurSlider.value = layer.blur;
                if (grayscaleCheckbox) grayscaleCheckbox.checked = layer.grayscale;
                if (opacityValue) opacityValue.textContent = layer.opacity + '%';
                if (blurValue) blurValue.textContent = layer.blur + 'px';

                if (this.selectedLayerBadge) {
                    this.selectedLayerBadge.textContent = layer.name;
                }

                if (this.effectsSection) {
                    this.effectsSection.classList.remove('disabled');
                }

                // Sync with ImageOverlayState
                if (window.ImageOverlayState) {
                    window.ImageOverlayState.imageOpacity = layer.opacity;
                    window.ImageOverlayState.imageBlur = layer.blur;
                    window.ImageOverlayState.imageGrayscale = layer.grayscale;

                    // Sync transform
                    if (layer.transform) {
                        window.ImageOverlayState.imageTransform = { ...layer.transform };
                        // We use a small delay to ensure the DOM is updated (new overlayImage ID assigned)
                        // before calling updateImageTransform
                        setTimeout(() => {
                            window.ImageOverlayState.updateImageTransform();
                        }, 50);
                    }
                }
            } else {
                if (this.selectedLayerBadge) {
                    this.selectedLayerBadge.textContent = '-';
                }
                if (this.effectsSection) {
                    this.effectsSection.classList.add('disabled');
                }
            }

            // Update selection highlighting
            this.updateSelectionHighlight(layer?.id);
        },

        /**
         * Update selection highlight without full re-render
         */
        updateSelectionHighlight: function (selectedId) {
            const items = this.layerListEl?.querySelectorAll('.layer-item');
            if (!items) return;

            items.forEach(item => {
                if (item.dataset.layerId === selectedId) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.LayerUI.init());
    } else {
        window.LayerUI.init();
    }

    console.log('[LayerUI] Module loaded');
})();
