// Editor History — Undo/Redo System
// Tracks state changes and allows reverting/reapplying them

(function () {
  'use strict';

  const MAX_HISTORY = 50;

  window.EditorHistory = {
    _undoStack: [],
    _redoStack: [],
    _listeners: [],
    _batchActive: false,
    _batchActions: [],

    /**
     * Initialize the history system
     */
    init: function () {
      this._undoStack = [];
      this._redoStack = [];
      this.bindKeyboard();
      this._notify();
      console.log('[EditorHistory] Initialized');
    },

    /**
     * Push a new action onto the undo stack
     * @param {Object} action — { type, description, undo(), redo() }
     */
    push: function (action) {
      if (!action || typeof action.undo !== 'function' || typeof action.redo !== 'function') {
        console.warn('[EditorHistory] Invalid action, skipping');
        return;
      }

      if (this._batchActive) {
        this._batchActions.push(action);
        return;
      }

      this._undoStack.push(action);
      // Trim if too many
      if (this._undoStack.length > MAX_HISTORY) {
        this._undoStack.shift();
      }
      // Clear redo stack on new action
      this._redoStack = [];
      this._notify();
    },

    /**
     * Start a batch — multiple actions grouped as one undo step
     */
    startBatch: function (description) {
      this._batchActive = true;
      this._batchActions = [];
      this._batchDescription = description || 'Toplu işlem';
    },

    /**
     * End the batch and push as a single action
     */
    endBatch: function () {
      if (!this._batchActive) return;
      this._batchActive = false;

      const actions = [...this._batchActions];
      this._batchActions = [];

      if (actions.length === 0) return;

      this.push({
        type: 'batch',
        description: this._batchDescription,
        undo: () => {
          // Undo in reverse order
          for (let i = actions.length - 1; i >= 0; i--) {
            actions[i].undo();
          }
        },
        redo: () => {
          actions.forEach(a => a.redo());
        }
      });
    },

    /**
     * Undo the last action
     */
    undo: function () {
      if (this._undoStack.length === 0) return;

      const action = this._undoStack.pop();
      try {
        action.undo();
      } catch (e) {
        console.error('[EditorHistory] Undo failed:', e);
      }
      this._redoStack.push(action);
      this._notify();
    },

    /**
     * Redo the last undone action
     */
    redo: function () {
      if (this._redoStack.length === 0) return;

      const action = this._redoStack.pop();
      try {
        action.redo();
      } catch (e) {
        console.error('[EditorHistory] Redo failed:', e);
      }
      this._undoStack.push(action);
      this._notify();
    },

    /**
     * Check if undo is available
     */
    canUndo: function () {
      return this._undoStack.length > 0;
    },

    /**
     * Check if redo is available
     */
    canRedo: function () {
      return this._redoStack.length > 0;
    },

    /**
     * Get current state info
     */
    getState: function () {
      return {
        undoCount: this._undoStack.length,
        redoCount: this._redoStack.length,
        lastAction: this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1].description : null
      };
    },

    /**
     * Clear all history
     */
    clear: function () {
      this._undoStack = [];
      this._redoStack = [];
      this._notify();
    },

    /**
     * Listen for history changes
     */
    onChange: function (callback) {
      if (typeof callback === 'function') {
        this._listeners.push(callback);
      }
    },

    /**
     * Notify all listeners
     */
    _notify: function () {
      const state = this.getState();
      this._listeners.forEach(cb => {
        try { cb(state); } catch (e) { /* ignore */ }
      });
    },

    /**
     * Bind Ctrl+Z / Ctrl+Y keyboard shortcuts
     */
    bindKeyboard: function () {
      document.addEventListener('keydown', (e) => {
        // Only handle when in overlay mode
        if (window.ImageOverlayState?.currentMode !== 'overlay') return;

        // Don't capture when typing in an input
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault();
          this.undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
          e.preventDefault();
          this.redo();
        }
      });
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.EditorHistory.init());
  } else {
    window.EditorHistory.init();
  }
})();
