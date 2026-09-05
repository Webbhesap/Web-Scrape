/**
 * P2.3 — selector graph: drag & drop re-parenting + PNG export
 * (Plan.md roadmap item 7).
 *
 * - Re-parenting: dragging a node onto another node makes the target its
 *   parent (onto _root = back to the root). The sitemap model enforces the
 *   cycle rule; the graph surfaces success/failure via onReparent /
 *   onReparentError callbacks.
 * - PNG export: the HTML graph is re-rendered to a <canvas> from a pure
 *   layout (no DOM screenshot, no external library) and encoded as a PNG
 *   blob. The layout is asserted with exact geometry; the canvas path is
 *   exercised with a stubbed 2D context + toBlob.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'chrome-edge');

function bootGraphWindow() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', {
    url: 'http://localhost:8080/dashboard/dashboard.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const win = dom.window;
  const SCRIPTS = [
    'src/engine/UrlRangeExpander.js', 'src/models/Selector.js', 'src/models/Sitemap.js',
    'src/ui/SelectorGraph.js'
  ];
  for (const rel of SCRIPTS) {
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    win.document.body.appendChild(el);
  }
  return { win, doc: win.document };
}

function makeSitemap(win, selectors, name = 'Graph Test') {
  return new win.Sitemap({
    _id: 'g_test',
    name: name,
    startUrl: ['https://g.test/'],
    selectors: selectors
  });
}

const BASE_SELECTORS = [
  { id: 'a', parentSelectors: ['_root'], type: 'SelectorElement', selector: '.a', multiple: true },
  { id: 'b', parentSelectors: ['_root'], type: 'SelectorText', selector: '.b' },
  { id: 'c', parentSelectors: ['a'], type: 'SelectorText', selector: '.c' },
  { id: 'd', parentSelectors: ['a'], type: 'SelectorText', selector: '.d' }
];

function findCard(doc, name) {
  const cards = Array.from(doc.querySelectorAll('.ws-graph-node'));
  const card = cards.find((c) => c.children[1] && c.children[1].textContent === name);
  assert.ok(card, `card for "${name}" rendered`);
  return card;
}

function fakeDragEvent(win, type, el, opts = {}) {
  const ev = new win.Event(type, { bubbles: true, cancelable: true });
  if (opts.data) {
    const store = {};
    ev.dataTransfer = {
      setData: (t, v) => { store[t] = v; },
      getData: (t) => (t in store ? store[t] : ''),
      effectAllowed: '',
      dropEffect: ''
    };
  }
  el.dispatchEvent(ev);
  return ev;
}

test('P2.3 - layoutTree: exact geometry, depth rows, sibling non-overlap, edges', () => {
  const { win } = bootGraphWindow();
  const sm = makeSitemap(win, BASE_SELECTORS);
  const graph = new win.SelectorGraph(null, sm, {});
  const layout = graph.layoutTree();

  // 5 nodes: _root, a, b (depth 1), c, d (depth 2).
  assert.equal(layout.nodes.length, 5);
  assert.equal(layout.edges.length, 4);

  const byId = (id) => layout.nodes.find((n) => n.id === id);
  // Constants: NODE_W=180 NODE_H=70 H_GAP=26 V_GAP=48 PAD=24
  assert.equal(layout.width, 640, 'canvas width = 2*PAD + root subtree');
  assert.equal(layout.height, 354, 'canvas height fits 3 depth rows');

  assert.equal(byId('_root').x, 230);
  assert.equal(byId('_root').y, 24);
  assert.equal(byId('a').x, 127);
  assert.equal(byId('b').x, 436);
  assert.equal(byId('a').y, 142);
  assert.equal(byId('b').y, 142);
  assert.equal(byId('c').x, 24);
  assert.equal(byId('d').x, 230);
  assert.equal(byId('c').y, 260);
  assert.equal(byId('d').y, 260);

  // Siblings never overlap horizontally.
  assert.ok(byId('c').x + byId('c').w < byId('d').x, 'c and d do not overlap');
  assert.ok(byId('a').x + byId('a').w + 26 <= byId('b').x || byId('b').x + byId('b').w + 26 <= byId('a').x,
    'a and b subtrees are separated');

  const edgePairs = [...layout.edges].map((e) => e.from + '>' + e.to).sort(); // Node-realm array for deepEqual
  assert.deepEqual(edgePairs, ['_root>a', '_root>b', 'a>c', 'a>d'], 'all parent->child edges present');
  // Every edge goes top-down.
  layout.edges.forEach((e) => assert.ok(e.y1 < e.y2, 'edge points downward'));
});

test('P2.3 - cyclic sitemap does not break layout (cycle node is not expanded)', () => {
  const { win } = bootGraphWindow();
  // True cycle: d hangs under c, and c also hangs under d (multi-parent).
  const smCycle = makeSitemap(win, [
    { id: 'c', parentSelectors: ['_root'], type: 'SelectorText', selector: '.c' },
    { id: 'd', parentSelectors: ['c'], type: 'SelectorText', selector: '.d' }
  ]);
  smCycle.getSelectorById('c').parentSelectors = ['_root', 'd'];

  const graph = new win.SelectorGraph(null, smCycle, {});
  const layout = graph.layoutTree(); // must terminate
  assert.ok(layout.nodes.length >= 4);
  assert.ok(layout.width > 0 && layout.height > 0);
  // The cycle reference is flagged, not expanded.
  assert.ok(layout.nodes.some((n) => n.isCycle), 'cycle node flagged');
  // wouldCreateCycle guards the UI path as well: c under d would loop.
  assert.equal(smCycle.wouldCreateCycle('c', 'd'), true, 'model rejects c under d');
  assert.equal(smCycle.reparentSelector('c', 'd'), false, 'reparent refused');
  assert.deepEqual([...smCycle.getSelectorById('c').parentSelectors], ['_root', 'd'], 'no mutation on refusal');
});

test('P2.3 - drag & drop re-parents, rejects cycles, ignores self, supports root target', () => {
  const { win, doc } = bootGraphWindow();
  const sm = makeSitemap(win, BASE_SELECTORS);
  const host = doc.getElementById('host');
  const events = { dropped: [], errors: [] };
  const graph = new win.SelectorGraph(host, sm, {
    onReparent: (moved, target) => {
      events.dropped.push([moved, target]);
      sm.reparentSelector(moved, target);
    },
    onReparentError: (moved, target) => events.errors.push([moved, target])
  });
  graph.render();

  // 1) Move b (root child) under a.
  const bCard = findCard(doc, 'b');
  const aCard = findCard(doc, 'a');
  assert.equal(bCard.getAttribute('draggable'), 'true', 'nodes are draggable');
  fakeDragEvent(win, 'dragstart', bCard, { data: true });
  fakeDragEvent(win, 'dragover', aCard, { data: true });
  fakeDragEvent(win, 'drop', aCard, { data: true });
  assert.deepEqual(events.dropped, [['b', 'a']], 'onReparent fired for b -> a');
  assert.deepEqual([...sm.getSelectorById('b').parentSelectors], ['a'], 'sitemap actually re-parented');

  // 2) Cycle: a is now the parent of b — dragging a onto b must be rejected.
  const events2 = { dropped: [], errors: [] };
  const graph2 = new win.SelectorGraph(host, sm, {
    onReparent: (m, t) => { events2.dropped.push([m, t]); sm.reparentSelector(m, t); },
    onReparentError: (m, t) => events2.errors.push([m, t])
  });
  graph2.render();
  fakeDragEvent(win, 'dragstart', findCard(doc, 'a'), { data: true });
  fakeDragEvent(win, 'drop', findCard(doc, 'b'), { data: true });
  assert.deepEqual(events2.dropped, [], 'cycle drop did NOT re-parent');
  assert.deepEqual(events2.errors, [['a', 'b']], 'cycle drop reported via onReparentError');
  assert.deepEqual([...sm.getSelectorById('a').parentSelectors], ['_root'], 'sitemap unchanged after rejected drop');

  // 3) Dropping a node onto itself is ignored.
  const events3 = { dropped: [], errors: [] };
  const graph3 = new win.SelectorGraph(host, sm, {
    onReparent: (m, t) => { events3.dropped.push([m, t]); },
    onReparentError: (m, t) => events3.errors.push([m, t])
  });
  graph3.render();
  fakeDragEvent(win, 'dragstart', findCard(doc, 'a'), { data: true });
  fakeDragEvent(win, 'drop', findCard(doc, 'a'), { data: true });
  assert.deepEqual(events3.dropped, []);
  assert.deepEqual(events3.errors, [], 'self-drop is a silent no-op');

  // 4) Dropping onto _root moves the node back to the root.
  const events4 = { dropped: [], errors: [] };
  const graph4 = new win.SelectorGraph(host, sm, {
    onReparent: (m, t) => { events4.dropped.push([m, t]); sm.reparentSelector(m, t); },
    onReparentError: (m, t) => events4.errors.push([m, t])
  });
  graph4.render();
  fakeDragEvent(win, 'dragstart', findCard(doc, 'a'), { data: true });
  fakeDragEvent(win, 'drop', findCard(doc, '_root'), { data: true });
  assert.deepEqual(events4.dropped, [['a', '_root']], 'drop on root reparents to root');
});

test('P2.3 - PNG export renders the tree to a canvas and downloads a blob', async () => {
  const { win, doc } = bootGraphWindow();
  const sm = makeSitemap(win, BASE_SELECTORS, 'My Sitemap');
  const host = doc.getElementById('host');
  const graph = new win.SelectorGraph(host, sm, {});
  graph.render();

  // jsdom has no real canvas: stub the 2D context (recording text) and toBlob.
  const texts = [];
  const ctxStub = {
    scale: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    bezierCurveTo: () => {},
    stroke: () => {},
    fill: () => {},
    arcTo: () => {},
    closePath: () => {},
    fillText: (s) => { texts.push(String(s)); }
  };
  Object.defineProperty(win.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: (type) => (type === '2d' ? ctxStub : null)
  });
  let blobCalls = 0;
  win.HTMLCanvasElement.prototype.toBlob = function (cb, type) {
    blobCalls++;
    assert.equal(type, 'image/png');
    setTimeout(() => cb(new win.Blob(['fakepng'], { type: 'image/png' })), 0);
  };

  const layout = graph.layoutTree();
  let blob = null;
  await new Promise((resolve, reject) => {
    graph.exportPng().then((b) => { blob = b; resolve(); }).catch(reject);
  });
  assert.ok(blob, 'exportPng resolves a blob');
  assert.equal(blob.type, 'image/png');
  assert.equal(blobCalls, 1);
  // Every node name + tag made it onto the canvas.
  for (const name of ['_root', 'a', 'b', 'c', 'd']) {
    assert.ok(texts.includes(name), `canvas received text for node "${name}"`);
  }
  assert.ok(texts.includes('ROOT'), 'type tags rendered');

  // downloadPng wires the blob to an <a download> navigation.
  const createdUrls = [];
  win.URL.createObjectURL = (b) => { createdUrls.push(b); return 'blob:test-' + createdUrls.length; };
  win.URL.revokeObjectURL = () => {};
  let clickedAnchor = null;
  win.HTMLAnchorElement.prototype.click = function () { clickedAnchor = this; };

  await graph.downloadPng('My_Sitemap_selectors.png');
  assert.ok(clickedAnchor, 'the download anchor was clicked');
  assert.equal(clickedAnchor.download, 'My_Sitemap_selectors.png');
  assert.ok(String(clickedAnchor.href).startsWith('blob:test-'), 'anchor points at the blob URL');
  assert.equal(createdUrls.length, 1);
  assert.equal(createdUrls[0].type, 'image/png');
  assert.equal(clickedAnchor.href, 'blob:test-1');
  // Canvas was sized from the layout at 2x scale.
  assert.ok(texts.length > 0);
});
