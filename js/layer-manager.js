// Layer Manager - Paint.NET/Photoshop-style layer system
// Handles multiple image layers with individual effects

(function () {
    'use strict';

    // Generate unique layer ID
    let layerIdCounter = 0;
    const generateLayerId = () => `layer_${Date.now()}_${layerIdCounter++}`;

    // Expose to global scope
    window.LayerManager = {
        // Layer storage
        layers: [],
        selectedLayerId: null,

        // Event callbacks
        _onLayerChange: null,
        _onSelectionChange: null,

        /**
         * Initialize the layer manager
         */
        init: function () {
            console.log('[LayerManager] Initialized');
            this.layers = [];
            this.selectedLayerId = null;
        },

        /**
         * Create a new layer object
         * @param {string} type - 'image' or 'chat'
         * @param {Object} options - Layer options
         * @returns {Object} Layer object
         */
        createLayer: function (type, options = {}) {
            const layer = {
                id: generateLayerId(),
                name: options.name || `Katman ${this.layers.length + 1}`,
                type: type, // 'image' or 'chat'

                // Image data (for image layers)
                imageSrc: options.imageSrc || null,
                imageElement: options.imageElement || null,

                // Visibility
                visible: true,
                locked: false,

                // Effects
                opacity: 100,      // 0-100
                blur: 0,           // 0-20px
                grayscale: false,

                // Transform
                transform: {
                    x: 0,
                    y: 0,
                    scale: 1
                },

                // Layer order (higher = on top)
                zIndex: this.layers.length
            };

            return layer;
        },

        /**
         * Add a new image layer
         * @param {string} imageSrc - Image data URL
         * @param {HTMLImageElement} imageElement - Image element
         * @param {string} name - Optional layer name
         * @returns {Object} The created layer
         */
        addImageLayer: function (imageSrc, imageElement, name) {
            const layer = this.createLayer('image', {
                imageSrc,
                imageElement,
                name: name || `Görüntü ${this.layers.filter(l => l.type === 'image').length + 1}`
            });

            this.layers.push(layer);
            this.selectedLayerId = layer.id;

            this._notifyLayerChange();
            this._notifySelectionChange();

            console.log('[LayerManager] Added image layer:', layer.name);
            return layer;
        },

        /**
         * Add a chat layer (text overlay)
         * @returns {Object} The created layer
         */
        addChatLayer: function () {
            // Check if chat layer already exists
            const existingChat = this.layers.find(l => l.type === 'chat');
            if (existingChat) {
                return existingChat;
            }

            const layer = this.createLayer('chat', {
                name: 'Sohbet Metni'
            });

            this.layers.push(layer);
            this._notifyLayerChange();

            console.log('[LayerManager] Added chat layer');
            return layer;
        },

        /**
         * Remove a layer by ID
         * @param {string} id - Layer ID
         */
        removeLayer: function (id) {
            const index = this.layers.findIndex(l => l.id === id);
            if (index === -1) return;

            this.layers.splice(index, 1);

            // Update zIndex for remaining layers
            this.layers.forEach((layer, i) => {
                layer.zIndex = i;
            });

            // Select another layer if the removed one was selected
            if (this.selectedLayerId === id) {
                this.selectedLayerId = this.layers.length > 0 ? this.layers[this.layers.length - 1].id : null;
                this._notifySelectionChange();
            }

            this._notifyLayerChange();
            console.log('[LayerManager] Removed layer:', id);
        },

        /**
         * Select a layer
         * @param {string} id - Layer ID
         */
        selectLayer: function (id) {
            const layer = this.layers.find(l => l.id === id);
            if (!layer) return;

            this.selectedLayerId = id;
            this._notifySelectionChange();
            console.log('[LayerManager] Selected layer:', layer.name);
        },

        /**
         * Get the currently selected layer
         * @returns {Object|null} Selected layer or null
         */
        getSelectedLayer: function () {
            if (!this.selectedLayerId) return null;
            return this.layers.find(l => l.id === this.selectedLayerId) || null;
        },

        /**
         * Get a layer by ID
         * @param {string} id - Layer ID
         * @returns {Object|null} Layer or null
         */
        getLayer: function (id) {
            return this.layers.find(l => l.id === id) || null;
        },

        /**
         * Update a layer's effect property
         * @param {string} id - Layer ID
         * @param {string} property - Property name (opacity, blur, grayscale, visible)
         * @param {*} value - New value
         * @param {boolean} emitEvent - Whether to emit change event (default: true)
         */
        updateLayerEffect: function (id, property, value, emitEvent = true) {
            const layer = this.getLayer(id);
            if (!layer) return;

            if (property in layer) {
                layer[property] = value;

                if (emitEvent) {
                    this._notifyLayerChange();
                }
                console.log(`[LayerManager] Updated ${layer.name}.${property} = ${value}`);
            }
        },

        /**
         * Update the selected layer's effect
         * @param {string} property - Property name
         * @param {*} value - New value
         * @param {boolean} emitEvent - Whether to emit change event (default: true)
         */
        updateSelectedLayerEffect: function (property, value, emitEvent = true) {
            if (this.selectedLayerId) {
                this.updateLayerEffect(this.selectedLayerId, property, value, emitEvent);
            }
        },

        /**
         * Update a layer's transform
         * @param {string} id - Layer ID
         * @param {Object} transform - Transform object {x, y, scale}
         * @param {boolean} emitEvent - Whether to emit change event (default: true)
         */
        updateLayerTransform: function (id, transform, emitEvent = true) {
            const layer = this.getLayer(id);
            if (!layer) return;

            layer.transform = { ...layer.transform, ...transform };

            if (emitEvent) {
                this._notifyLayerChange();
            }
        },

        /**
         * Toggle layer visibility
         * @param {string} id - Layer ID
         */
        toggleLayerVisibility: function (id) {
            const layer = this.getLayer(id);
            if (!layer) return;

            layer.visible = !layer.visible;
            this._notifyLayerChange();
            console.log(`[LayerManager] ${layer.name} visibility: ${layer.visible}`);
        },

        /**
         * Move layer up in stack (increase zIndex)
         * @param {string} id - Layer ID
         */
        moveLayerUp: function (id) {
            const index = this.layers.findIndex(l => l.id === id);
            if (index === -1 || index >= this.layers.length - 1) return;

            // Swap with layer above
            [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];

            // Update zIndex
            this.layers.forEach((layer, i) => {
                layer.zIndex = i;
            });

            this._notifyLayerChange();
            console.log('[LayerManager] Moved layer up:', this.getLayer(id)?.name);
        },

        /**
         * Move layer down in stack (decrease zIndex)
         * @param {string} id - Layer ID
         */
        moveLayerDown: function (id) {
            const index = this.layers.findIndex(l => l.id === id);
            if (index <= 0) return;

            // Swap with layer below
            [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];

            // Update zIndex
            this.layers.forEach((layer, i) => {
                layer.zIndex = i;
            });

            this._notifyLayerChange();
            console.log('[LayerManager] Moved layer down:', this.getLayer(id)?.name);
        },

        /**
         * Get layers sorted by zIndex (bottom to top)
         * @returns {Array} Sorted layers
         */
        getLayersSorted: function () {
            return [...this.layers].sort((a, b) => a.zIndex - b.zIndex);
        },

        /**
         * Get only visible layers sorted by zIndex
         * @returns {Array} Visible layers sorted
         */
        getVisibleLayersSorted: function () {
            return this.getLayersSorted().filter(l => l.visible);
        },

        /**
         * Clear all layers
         */
        clearAll: function () {
            this.layers = [];
            this.selectedLayerId = null;
            this._notifyLayerChange();
            this._notifySelectionChange();
            console.log('[LayerManager] Cleared all layers');
        },

        /**
         * Set layer change callback
         * @param {Function} callback - Called when layers change
         */
        onLayerChange: function (callback) {
            this._onLayerChange = callback;
        },

        /**
         * Set selection change callback
         * @param {Function} callback - Called when selection changes
         */
        onSelectionChange: function (callback) {
            this._onSelectionChange = callback;
        },

        /**
         * Notify layer change listeners
         */
        _notifyLayerChange: function () {
            if (this._onLayerChange) {
                this._onLayerChange(this.layers);
            }
            // Dispatch custom event for other modules
            document.dispatchEvent(new CustomEvent('layersChanged', {
                detail: { layers: this.layers }
            }));
        },

        /**
         * Notify selection change listeners
         */
        _notifySelectionChange: function () {
            const selectedLayer = this.getSelectedLayer();
            if (this._onSelectionChange) {
                this._onSelectionChange(selectedLayer);
            }
            // Dispatch custom event
            document.dispatchEvent(new CustomEvent('layerSelectionChanged', {
                detail: { layer: selectedLayer }
            }));
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.LayerManager.init();
        });
    } else {
        window.LayerManager.init();
    }

    console.log('[LayerManager] Module loaded');
})();
