/**
 * Interactive Selector Hierarchy Graph.
 * Visualizes Sitemap selector relationships in an interactive SVG/HTML tree graph.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SelectorGraph = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TYPE_COLORS = {
    _root: { bg: '#0f766e', border: '#14b8a6', text: '#ffffff', tag: 'ROOT' },
    SelectorText: { bg: '#1e3a8a', border: '#3b82f6', text: '#ffffff', tag: 'TEXT' },
    SelectorLink: { bg: '#065f46', border: '#10b981', text: '#ffffff', tag: 'LINK' },
    SelectorPopupLink: { bg: '#115e59', border: '#14b8a6', text: '#ffffff', tag: 'POPUP' },
    SelectorImage: { bg: '#581c87', border: '#a855f7', text: '#ffffff', tag: 'IMG' },
    SelectorTable: { bg: '#7c2d12', border: '#f97316', text: '#ffffff', tag: 'TABLE' },
    SelectorElement: { bg: '#134e4a', border: '#2dd4bf', text: '#ffffff', tag: 'ELEMENT' },
    SelectorElementAttribute: { bg: '#312e81', border: '#6366f1', text: '#ffffff', tag: 'ATTR' },
    SelectorHTML: { bg: '#4c1d95', border: '#8b5cf6', text: '#ffffff', tag: 'HTML' },
    SelectorGrouped: { bg: '#701a75', border: '#d946ef', text: '#ffffff', tag: 'GROUP' },
    SelectorPagination: { bg: '#831843', border: '#ec4899', text: '#ffffff', tag: 'PAGE' },
    SelectorElementClick: { bg: '#713f12', border: '#eab308', text: '#ffffff', tag: 'CLICK' },
    SelectorElementScroll: { bg: '#1e293b', border: '#64748b', text: '#ffffff', tag: 'SCROLL' },
    SelectorXPath: { bg: '#3f2d12', border: '#d97706', text: '#ffffff', tag: 'XPATH' }
  };

  class SelectorGraph {
    constructor(containerEl, sitemap, options = {}) {
      this.container = containerEl;
      this.sitemap = sitemap;
      this.options = Object.assign({
        onNodeClick: null
      }, options);

      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this._windowHandlers = null;
      this._dragId = null; // P2.3: id of the node currently being dragged
    }

    render() {
      if (!this.container) return;
      // Remove window listeners left over from a previous graph instance
      // rendered into the same container (prevents listener accumulation).
      if (this.container.__wsGraphCleanup) {
        this.container.__wsGraphCleanup();
      }
      this.container.innerHTML = '';
      this.container.style.position = 'relative';
      this.container.style.overflow = 'hidden';
      this.container.style.userSelect = 'none';
      this.container.style.cursor = 'grab';

      const tree = this.buildTree();
      
      const wrapper = document.createElement('div');
      wrapper.className = 'ws-graph-canvas';
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.transformOrigin = '0 0';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';

      const domTree = this.renderTreeNode(tree);
      wrapper.appendChild(domTree);
      this.container.appendChild(wrapper);

      this.wrapperEl = wrapper;

      // Controls overlay (Zoom In, Zoom Out, Reset)
      const controls = document.createElement('div');
      controls.className = 'ws-graph-controls';
      controls.style.position = 'absolute';
      controls.style.bottom = '16px';
      controls.style.right = '16px';
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.zIndex = '10';

      controls.innerHTML = `
        <button id="ws-graph-zoom-in" class="ws-btn ws-btn-secondary" style="padding:4px 8px;font-size:14px;font-weight:bold;">+</button>
        <button id="ws-graph-zoom-out" class="ws-btn ws-btn-secondary" style="padding:4px 8px;font-size:14px;font-weight:bold;">-</button>
        <button id="ws-graph-reset" class="ws-btn ws-btn-secondary" style="padding:4px 8px;font-size:12px;">Reset</button>
        <button id="ws-graph-png" class="ws-btn ws-btn-secondary" style="padding:4px 8px;font-size:12px;" title="Export the selector graph as a PNG image">PNG</button>
      `;
      this.container.appendChild(controls);

      this.bindEvents();
    }

    buildTree() {
      const rootNode = {
        id: '_root',
        type: '_root',
        name: '_root',
        children: []
      };

      // `visitedPath` (a per-branch chain) guards cycles; the previous global
      // `visited` set was dead code.
      const buildSubtree = (parentId, visitedPath) => {
        const children = this.sitemap.getDirectChildSelectors(parentId);
        const childNodes = [];

        for (const child of children) {
          const isCycle = visitedPath.includes(child.id);
          const childNode = {
            id: child.id,
            type: child.type,
            name: child.id,
            selector: child.selector,
            multiple: child.multiple,
            isCycle: isCycle,
            children: []
          };

          if (!isCycle) {
            childNode.children = buildSubtree(child.id, [...visitedPath, child.id]);
          }
          childNodes.push(childNode);
        }
        return childNodes;
      };

      rootNode.children = buildSubtree('_root', ['_root']);
      return rootNode;
    }

    renderTreeNode(node) {
      const el = document.createElement('div');
      el.className = 'ws-tree-branch';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.margin = '12px 18px';

      // Node Card Pill
      const colors = TYPE_COLORS[node.type] || TYPE_COLORS.SelectorText;
      const card = document.createElement('div');
      card.className = 'ws-graph-node';
      card.style.background = colors.bg;
      card.style.border = `2px solid ${colors.border}`;
      card.style.color = colors.text;
      card.style.borderRadius = '8px';
      card.style.padding = '8px 14px';
      card.style.minWidth = '130px';
      card.style.textAlign = 'center';
      card.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
      card.style.cursor = 'pointer';
      card.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

      card.innerHTML = `
        <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:${colors.border};text-transform:uppercase;margin-bottom:2px;">${colors.tag}${node.multiple ? ' (MULTIPLE)' : ''}${node.isCycle ? ' (RECURSIVE)' : ''}</div>
        <div style="font-size:13px;font-weight:600;">${this.escapeHtml(node.name)}</div>
        ${node.selector ? `<div style="font-size:11px;color:#94a3b8;font-family:monospace;margin-top:2px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(node.selector)}</div>` : ''}
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.05)';
        card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'scale(1)';
        card.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
      });

      if (this.options.onNodeClick && node.id !== '_root') {
        card.addEventListener('click', () => {
          this.options.onNodeClick(node.id);
        });
      }

      // P2.3 — drag & drop re-parenting. Drag a node onto another node to
      // make that node its parent (dropping onto _root moves it back to the
      // root). The sitemap model enforces the cycle rule via
      // reparentSelector/wouldCreateCycle; the graph surfaces the outcome
      // through the onReparent / onReparentError callbacks.
      if (node.id !== '_root') {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', (e) => {
          this._dragId = node.id;
          card.style.opacity = '0.5';
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', node.id);
            e.dataTransfer.effectAllowed = 'move';
          }
        });
        card.addEventListener('dragend', () => {
          this._dragId = null;
          card.style.opacity = '';
        });
      }
      card.addEventListener('dragover', (e) => {
        if (!this._dragId || this._dragId === node.id) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        card.style.outline = '3px dashed #f59e0b';
        card.style.outlineOffset = '2px';
      });
      card.addEventListener('dragleave', () => {
        card.style.outline = '';
        card.style.outlineOffset = '';
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.outline = '';
        card.style.outlineOffset = '';
        const dragId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this._dragId || null;
        this._dragId = null;
        if (!dragId || dragId === node.id || dragId === '_root') return;
        if (this.sitemap && typeof this.sitemap.wouldCreateCycle === 'function'
            && this.sitemap.wouldCreateCycle(dragId, node.id)) {
          if (this.options.onReparentError) this.options.onReparentError(dragId, node.id);
          return;
        }
        if (this.options.onReparent) this.options.onReparent(dragId, node.id);
      });

      el.appendChild(card);

      // Children container
      if (node.children && node.children.length > 0) {
        // Connector line down
        const lineDown = document.createElement('div');
        lineDown.style.width = '2px';
        lineDown.style.height = '18px';
        lineDown.style.background = '#475569';
        el.appendChild(lineDown);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'ws-tree-children';
        childrenContainer.style.display = 'flex';
        childrenContainer.style.position = 'relative';
        childrenContainer.style.borderTop = node.children.length > 1 ? '2px solid #475569' : 'none';
        childrenContainer.style.paddingTop = '12px';

        for (const child of node.children) {
          childrenContainer.appendChild(this.renderTreeNode(child));
        }

        el.appendChild(childrenContainer);
      }

      return el;
    }

    // --- P2.3: PNG export --------------------------------------------------
    // The on-screen graph is HTML, so the export does NOT screenshot the
    // DOM — it re-renders the same tree to a <canvas> from the pure layout
    // below (2x scale for crisp text) and encodes it as a PNG blob. No
    // external library is involved (100% local).

    layoutTree() {
      const NODE_W = 180;
      const NODE_H = 70;
      const H_GAP = 26;
      const V_GAP = 48;
      const PAD = 24;
      const tree = this.buildTree();

      const measure = (node) => {
        if (!node.children || node.children.length === 0) {
          node._subtreeW = NODE_W;
          return node._subtreeW;
        }
        let sum = 0;
        for (const c of node.children) sum += measure(c) + H_GAP;
        sum -= H_GAP;
        node._subtreeW = Math.max(NODE_W, sum);
        return node._subtreeW;
      };
      measure(tree);

      const nodes = [];
      const edges = [];
      const place = (node, left, depth) => {
        const x = left + (node._subtreeW - NODE_W) / 2;
        const y = PAD + depth * (NODE_H + V_GAP);
        node._x = x;
        node._y = y;
        nodes.push({
          id: node.id,
          name: node.name,
          type: node.type,
          selector: node.selector || '',
          multiple: !!node.multiple,
          isCycle: !!node.isCycle,
          x: x, y: y, w: NODE_W, h: NODE_H
        });
        if (node.children && node.children.length > 0) {
          const kidsTotal = node.children.reduce((a, c) => a + c._subtreeW, 0)
            + H_GAP * (node.children.length - 1);
          let cursor = left + (node._subtreeW - kidsTotal) / 2;
          for (const c of node.children) {
            place(c, cursor, depth + 1);
            edges.push({
              from: node.id,
              to: c.id,
              x1: x + NODE_W / 2,
              y1: y + NODE_H,
              x2: c._x + NODE_W / 2,
              y2: c._y
            });
            cursor += c._subtreeW + H_GAP;
          }
        }
      };
      place(tree, PAD, 0);

      const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
      return {
        nodes: nodes,
        edges: edges,
        width: PAD * 2 + tree._subtreeW,
        height: maxY + NODE_H + PAD,
        nodeW: NODE_W,
        nodeH: NODE_H
      };
    }

    _roundRectPath(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    _fitText(str, maxW) {
      const s = String(str);
      const maxChars = Math.max(6, Math.floor(maxW / 7));
      return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
    }

    async exportPng() {
      const layout = this.layoutTree();
      const SCALE = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(layout.width * SCALE));
      canvas.height = Math.max(1, Math.round(layout.height * SCALE));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context is not available');
      ctx.scale(SCALE, SCALE);

      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, layout.width, layout.height);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      for (const e of layout.edges) {
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.bezierCurveTo(e.x1, (e.y1 + e.y2) / 2, e.x2, (e.y1 + e.y2) / 2, e.x2, e.y2);
        ctx.stroke();
      }

      for (const n of layout.nodes) {
        const colors = TYPE_COLORS[n.type] || TYPE_COLORS.SelectorText;
        this._roundRectPath(ctx, n.x, n.y, n.w, n.h, 8);
        ctx.fillStyle = colors.bg;
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = colors.border;
        ctx.font = 'bold 10px sans-serif';
        const tag = colors.tag + (n.multiple ? ' (MULTIPLE)' : '') + (n.isCycle ? ' (RECURSIVE)' : '');
        ctx.fillText(tag, n.x + n.w / 2, n.y + 18);
        ctx.fillStyle = colors.text;
        ctx.font = '600 13px sans-serif';
        ctx.fillText(this._fitText(n.name, n.w - 20), n.x + n.w / 2, n.y + 38);
        if (n.selector) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px monospace';
          ctx.fillText(this._fitText(n.selector, n.w - 20), n.x + n.w / 2, n.y + 56);
        }
      }

      return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('PNG encoding failed'));
          }, 'image/png');
        } else {
          reject(new Error('Canvas.toBlob is not supported here'));
        }
      });
    }

    async downloadPng(filename) {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        throw new Error('URL.createObjectURL is not available');
      }
      const blob = await this.exportPng();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'selectors.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }, 1000);
    }

    bindEvents() {
      const zoomInBtn = this.container.querySelector('#ws-graph-zoom-in');
      const zoomOutBtn = this.container.querySelector('#ws-graph-zoom-out');
      const resetBtn = this.container.querySelector('#ws-graph-reset');

      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.scale = Math.min(2.5, this.scale + 0.2);
          this.updateTransform();
        });
      }

      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.scale = Math.max(0.4, this.scale - 0.2);
          this.updateTransform();
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.scale = 1;
          this.translateX = 0;
          this.translateY = 0;
          this.updateTransform();
        });
      }

      // P2.3: export the graph as a PNG (drawn to canvas, not a DOM shot).
      const pngBtn = this.container.querySelector('#ws-graph-png');
      if (pngBtn) {
        pngBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = ((this.sitemap && this.sitemap.name) || 'sitemap')
            .replace(/[^\w.-]+/g, '_');
          this.downloadPng(name + '_selectors.png').catch((err) => {
            console.warn('PNG export failed:', err);
          });
        });
      }

      // Pan & drag
      this.container.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('.ws-graph-node')) return;
        this.isDragging = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        this.container.style.cursor = 'grabbing';
      });

      const onWindowMouseMove = (e) => {
        if (!this.isDragging) return;
        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.updateTransform();
      };

      const onWindowMouseUp = () => {
        if (this.isDragging) {
          this.isDragging = false;
          if (this.container) this.container.style.cursor = 'grab';
        }
      };

      window.addEventListener('mousemove', onWindowMouseMove);
      window.addEventListener('mouseup', onWindowMouseUp);

      this._windowHandlers = { onWindowMouseMove, onWindowMouseUp };
      this.container.__wsGraphCleanup = () => {
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
        delete this.container.__wsGraphCleanup;
      };

      // Mouse wheel zoom
      this.container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.scale = Math.min(2.5, Math.max(0.3, this.scale + delta));
        this.updateTransform();
      }, { passive: false });
    }

    updateTransform() {
      if (this.wrapperEl) {
        this.wrapperEl.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  return SelectorGraph;
}));
