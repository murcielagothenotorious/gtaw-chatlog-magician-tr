// Editor Context Menu — Right-click menu for photo editor
// Photopea-style context-sensitive menu

(function () {
  'use strict';

  let menuEl = null;

  window.EditorContextMenu = {
    /**
     * Initialize context menu system
     */
    init: function () {
      // Listen for right-click on the dropzone
      const dropzone = document.getElementById('imageDropzone');
      if (dropzone) {
        dropzone.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
      }

      // Close on click anywhere
      document.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });

      console.log('[EditorContextMenu] Initialized');
    },

    /**
     * Handle right-click event
     */
    handleContextMenu: function (e) {
      // Only in overlay mode
      if (window.ImageOverlayState?.currentMode !== 'overlay') return;

      e.preventDefault();
      this.close(); // Close any existing menu

      const lineWrapper = e.target.closest('.chat-line-wrapper');
      const isOnLine = !!lineWrapper;
      const lineIndex = isOnLine ? parseInt(lineWrapper.dataset.lineIndex) : null;

      const items = this.buildMenuItems(isOnLine, lineIndex, lineWrapper);
      this.show(e.clientX, e.clientY, items);
    },

    /**
     * Build menu items based on click context
     */
    buildMenuItems: function (isOnLine, lineIndex, lineWrapper) {
      const items = [];
      const state = window.ImageOverlayState;
      const history = window.EditorHistory;

      if (isOnLine) {
        // Line-specific items
        items.push({
          icon: 'fa-mouse-pointer',
          label: 'Seç',
          action: () => {
            state?.selectElement(lineIndex, lineWrapper, false);
          }
        });

        items.push({
          icon: 'fa-object-group',
          label: 'Seçime Ekle',
          shortcut: 'Ctrl+Tık',
          action: () => {
            state?.selectElement(lineIndex, lineWrapper, true);
          }
        });

        items.push({ separator: true });

        items.push({
          icon: 'fa-eye-slash',
          label: 'Satırı Gizle',
          action: () => {
            if (!lineWrapper) return;
            const prevDisplay = lineWrapper.style.display;
            lineWrapper.style.display = 'none';

            // Record in undo
            history?.push({
              type: 'hide-line',
              description: `Satır ${lineIndex} gizlendi`,
              undo: () => { lineWrapper.style.display = prevDisplay || ''; },
              redo: () => { lineWrapper.style.display = 'none'; }
            });
          }
        });

        items.push({
          icon: 'fa-arrows-alt',
          label: 'Pozisyonu Sıfırla',
          action: () => {
            if (!state || lineIndex === null) return;
            const oldTransform = state.lineTransforms[lineIndex] ? { ...state.lineTransforms[lineIndex] } : null;
            delete state.lineTransforms[lineIndex];
            state.renderChatOverlay();

            history?.push({
              type: 'reset-line-position',
              description: `Satır ${lineIndex} sıfırlandı`,
              undo: () => {
                if (oldTransform) state.lineTransforms[lineIndex] = oldTransform;
                state.renderChatOverlay();
              },
              redo: () => {
                delete state.lineTransforms[lineIndex];
                state.renderChatOverlay();
              }
            });
          }
        });

        items.push({ separator: true });

        // Color submenu — just list the common ones
        const colors = [
          { cls: 'white', name: 'Beyaz' },
          { cls: 'me', name: 'Aksiyon' },
          { cls: 'yellow', name: 'Sarı' },
          { cls: 'green', name: 'Yeşil' },
          { cls: 'grey', name: 'Gri' },
        ];

        colors.forEach(color => {
          items.push({
            icon: 'fa-circle',
            iconClass: color.cls,
            label: color.name,
            action: () => {
              if (!lineWrapper) return;
              const spans = lineWrapper.querySelectorAll('span.colorable, span[class]');
              const possibleColors = ['me', 'ame', 'darkgrey', 'grey', 'lightgrey', 'death', 'yellow', 'green', 'orange', 'blue', 'white', 'radioColor', 'radioColor2', 'depColor', 'vesseltraffic', 'toyou'];

              spans.forEach(span => {
                possibleColors.forEach(c => span.classList.remove(c));
                span.classList.add(color.cls);
              });
            }
          });
        });

      } else {
        // Clicked on empty area
        items.push({
          icon: 'fa-paste',
          label: 'Görsel Yapıştır',
          shortcut: 'Ctrl+V',
          action: () => {
            // Trigger paste — user needs to actually paste
            const fileInput = document.getElementById('imageFileInput');
            if (fileInput) fileInput.click();
          }
        });

        items.push({ separator: true });

        items.push({
          icon: 'fa-undo',
          label: 'Geri Al',
          shortcut: 'Ctrl+Z',
          disabled: !history?.canUndo(),
          action: () => history?.undo()
        });

        items.push({
          icon: 'fa-redo',
          label: 'İleri Al',
          shortcut: 'Ctrl+Y',
          disabled: !history?.canRedo(),
          action: () => history?.redo()
        });

        items.push({ separator: true });

        items.push({
          icon: 'fa-sync-alt',
          label: 'Tüm Satırları Sıfırla',
          shortcut: 'R',
          action: () => {
            if (!state) return;
            const oldTransforms = { ...state.lineTransforms };
            state.lineTransforms = {};
            state.renderChatOverlay();

            history?.push({
              type: 'reset-all',
              description: 'Tüm satırlar sıfırlandı',
              undo: () => {
                state.lineTransforms = oldTransforms;
                state.renderChatOverlay();
              },
              redo: () => {
                state.lineTransforms = {};
                state.renderChatOverlay();
              }
            });
          }
        });

        // Show hidden lines
        const hiddenLines = document.querySelectorAll('.chat-line-wrapper[style*="display: none"]');
        if (hiddenLines.length > 0) {
          items.push({
            icon: 'fa-eye',
            label: `Gizli Satırları Göster (${hiddenLines.length})`,
            action: () => {
              hiddenLines.forEach(line => {
                line.style.display = '';
              });
            }
          });
        }

        items.push({ separator: true });

        items.push({
          icon: 'fa-search-plus',
          label: 'Ekrana Sığdır',
          action: () => {
            if (state) {
              state.imageTransform = { x: 0, y: 0, scale: 1 };
              state.updateImageTransform();
            }
          }
        });
      }

      return items;
    },

    /**
     * Show context menu at position
     */
    show: function (x, y, items) {
      this.close();

      menuEl = document.createElement('div');
      menuEl.className = 'editor-context-menu';

      items.forEach(item => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'ctx-separator';
          menuEl.appendChild(sep);
          return;
        }

        const row = document.createElement('div');
        row.className = 'ctx-item' + (item.disabled ? ' disabled' : '');

        let iconHtml = '';
        if (item.icon) {
          const extraClass = item.iconClass ? ` ${item.iconClass}` : '';
          iconHtml = `<span class="ctx-icon${extraClass}"><i class="fas ${item.icon}"></i></span>`;
        }

        row.innerHTML = `
          ${iconHtml}
          <span class="ctx-label">${item.label}</span>
          ${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}
        `;

        if (!item.disabled && item.action) {
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
            item.action();
          });
        }

        menuEl.appendChild(row);
      });

      document.body.appendChild(menuEl);

      // Ensure menu doesn't go offscreen
      requestAnimationFrame(() => {
        if (!menuEl) return;
        const rect = menuEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - rect.height - 8;
        menuEl.style.left = Math.min(x, maxX) + 'px';
        menuEl.style.top = Math.min(y, maxY) + 'px';
      });
    },

    /**
     * Close the context menu
     */
    close: function () {
      if (menuEl) {
        menuEl.remove();
        menuEl = null;
      }
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.EditorContextMenu.init());
  } else {
    window.EditorContextMenu.init();
  }
})();
