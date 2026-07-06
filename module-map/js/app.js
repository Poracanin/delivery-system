/* ============================================================
   Mapa modulů — interaktivní síť ve stylu grafu Obsidianu
   Uzly = moduly systému, vazby = propojení (soubory + zodpovědnost)
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   Konstanty a paleta
   ------------------------------------------------------------ */
const NS = 'http://www.w3.org/2000/svg';
const NODE_W = 212;
const NODE_H = 92;
const STORAGE_KEY = 'module-map-v1';
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const PALETTE = {
  sun:      { name: 'Slunečná',   base: '#EFB93C', soft: '#F9EECF', ink: '#8A6A1C' },
  amber:    { name: 'Jantarová',  base: '#E89B4B', soft: '#F8E7D2', ink: '#8A5A22' },
  clay:     { name: 'Terakota',   base: '#D97D5C', soft: '#F6E0D6', ink: '#8A4630' },
  sage:     { name: 'Šalvějová',  base: '#8FAE7E', soft: '#E6EEDD', ink: '#4E6B3F' },
  sky:      { name: 'Modrošedá',  base: '#7FA3BF', soft: '#E0EAF1', ink: '#3F607A' },
  lilac:    { name: 'Levandule',  base: '#9E8FC9', soft: '#E9E4F4', ink: '#5B4E85' },
  graphite: { name: 'Grafitová',  base: '#6E6A63', soft: '#E9E6E1', ink: '#3C3935' },
};
const PALETTE_KEYS = Object.keys(PALETTE);

const EDGE_STROKE = '#C4B9A9';
const EDGE_STROKE_SEL = '#DE9E22';

/* ------------------------------------------------------------
   Výchozí ukázková síť (delivery system)
   ------------------------------------------------------------ */
function defaultState() {
  return {
    nodes: [
      { id: 'web',   x: 90,   y: 250, title: 'Web',                icon: '🖥️', category: 'Frontend',  color: 'sun',
        desc: 'Zákaznická webová aplikace — objednávání, sledování rozvozu, účet.',
        files: ['index.html', 'js/checkout.js', 'js/tracking.js', 'css/theme.css'] },
      { id: 'orders', x: 470, y: 90,  title: 'Správa objednávek',  icon: '🧾', category: 'Backend',   color: 'amber',
        desc: 'Přijímá, validuje a spravuje životní cyklus objednávek.',
        files: ['api/orders.js', 'models/order.js', 'services/pricing.js'] },
      { id: 'delivery', x: 880, y: 240, title: 'Rozvoz',           icon: '🛵', category: 'Logistika', color: 'clay',
        desc: 'Plánování tras, přiřazování kurýrů a sledování doručení v reálném čase.',
        files: ['api/delivery.js', 'services/dispatch.js', 'services/router.js'] },
      { id: 'user',  x: 90,   y: 520, title: 'Profil uživatele',   icon: '👤', category: 'Uživatelé', color: 'sky',
        desc: 'Registrace, přihlášení, adresy a historie objednávek zákazníka.',
        files: ['api/users.js', 'models/user.js', 'auth/session.js'] },
      { id: 'zones', x: 880,  y: 520, title: 'Zóny',               icon: '🗺️', category: 'Logistika', color: 'sage',
        desc: 'Definice rozvozových zón, cen dopravy a dostupnosti podle oblasti.',
        files: ['api/zones.js', 'data/zones.json', 'services/geo.js'] },
      { id: 'employee', x: 470, y: 640, title: 'Profil zaměstnance', icon: '🪪', category: 'Uživatelé', color: 'lilac',
        desc: 'Účty kurýrů a personálu — směny, dostupnost, hodnocení.',
        files: ['api/employees.js', 'models/employee.js'] },
      { id: 'notify', x: 470, y: 380, title: 'Notifikace',         icon: '🔔', category: 'Služby',    color: 'graphite',
        desc: 'E-maily, SMS a push oznámení o stavu objednávky a rozvozu.',
        files: ['services/notify.js', 'templates/email/'] },
    ],
    edges: [
      { id: 'e1', from: 'web', to: 'orders', label: 'api/orders.js',
        files: ['api/orders.js', 'js/checkout.js'],
        desc: 'Web odesílá nové objednávky a čte jejich stav přes REST API.' },
      { id: 'e2', from: 'orders', to: 'delivery', label: 'services/dispatch.js',
        files: ['services/dispatch.js', 'events/order-ready.js'],
        desc: 'Potvrzená objednávka se předává k naplánování rozvozu.' },
      { id: 'e3', from: 'delivery', to: 'zones', label: 'services/geo.js',
        files: ['services/geo.js', 'data/zones.json'],
        desc: 'Rozvoz ověřuje zónu doručení a počítá cenu dopravy.' },
      { id: 'e4', from: 'web', to: 'user', label: 'auth/session.js',
        files: ['auth/session.js', 'api/users.js'],
        desc: 'Přihlášení a načtení profilu zákazníka na webu.' },
      { id: 'e5', from: 'delivery', to: 'employee', label: 'api/employees.js',
        files: ['api/employees.js', 'services/dispatch.js'],
        desc: 'Přiřazení dostupného kurýra k naplánovanému rozvozu.' },
      { id: 'e6', from: 'orders', to: 'notify', label: 'services/notify.js',
        files: ['services/notify.js', 'events/order-status.js'],
        desc: 'Změny stavu objednávky spouštějí oznámení zákazníkovi.' },
      { id: 'e7', from: 'user', to: 'zones', label: 'services/geo.js',
        files: ['services/geo.js'],
        desc: 'Ověření, zda adresa uživatele spadá do rozvozové zóny.' },
    ],
    view: { x: 60, y: 40, scale: 0.9 },
  };
}

/* ------------------------------------------------------------
   Stav aplikace
   ------------------------------------------------------------ */
let state = loadState();
let sel = null;                 // { type: 'node'|'edge', id }
let connectMode = false;
let connectSource = null;       // id zdrojového uzlu v režimu propojování

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        data.view = data.view || { x: 0, y: 0, scale: 1 };
        return data;
      }
    }
  } catch (_) { /* poškozená data → výchozí síť */ }
  return defaultState();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: state.nodes, edges: state.edges, view: state.view,
    }));
  }, 250);
}

const uid = () => 'id-' + Math.random().toString(36).slice(2, 9);
const nodeById = (id) => state.nodes.find(n => n.id === id);
const edgeById = (id) => state.edges.find(e => e.id === id);
const nodeEdges = (id) => state.edges.filter(e => e.from === id || e.to === id);

function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/* ------------------------------------------------------------
   DOM reference
   ------------------------------------------------------------ */
const wrap = document.getElementById('canvas-wrap');
const svg = document.getElementById('canvas');
const sidebar = document.getElementById('sidebar');
const statsPill = document.getElementById('stats-pill');
const connectHint = document.getElementById('connect-hint');
const zoomLabel = document.getElementById('zoom-label');

/* Měření textu pro zkracování a šířky štítků */
const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(text, font) {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
function truncate(text, font, maxW) {
  if (textWidth(text, font) <= maxW) return text;
  let out = text;
  while (out.length > 1 && textWidth(out + '…', font) > maxW) out = out.slice(0, -1);
  return out + '…';
}

/* ------------------------------------------------------------
   SVG kostra: defs + vrstvy
   ------------------------------------------------------------ */
function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const defs = el('defs', {}, svg);

const shadow = el('filter', { id: 'card-shadow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
el('feDropShadow', { dx: 0, dy: 5, stdDeviation: 9, 'flood-color': '#2E2618', 'flood-opacity': 0.16 }, shadow);

const shadowSm = el('filter', { id: 'pill-shadow', x: '-40%', y: '-60%', width: '180%', height: '240%' }, defs);
el('feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, 'flood-color': '#2E2618', 'flood-opacity': 0.12 }, shadowSm);

function makeArrow(id, color) {
  const m = el('marker', {
    id, viewBox: '0 0 10 10', refX: 8.5, refY: 5,
    markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
  }, defs);
  el('path', { d: 'M 0 1 L 9 5 L 0 9 L 2.8 5 Z', fill: color }, m);
}
makeArrow('arrow', EDGE_STROKE);
makeArrow('arrow-sel', EDGE_STROKE_SEL);

const viewport = el('g', { id: 'viewport' }, svg);
const edgesLayer = el('g', { id: 'edges' }, viewport);
const nodesLayer = el('g', { id: 'nodes' }, viewport);
const tempLayer = el('g', { id: 'temp', 'data-temp': '1' }, viewport);

/* ------------------------------------------------------------
   Geometrie vazeb
   ------------------------------------------------------------ */
function edgeGeometry(edge) {
  const a = nodeById(edge.from);
  const b = nodeById(edge.to);
  if (!a || !b) return null;

  const ca = { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 };
  const cb = { x: b.x + NODE_W / 2, y: b.y + NODE_H / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;

  let p1, p2, c1, c2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // vodorovné napojení na boky karet
    const sx = dx >= 0 ? a.x + NODE_W : a.x;
    const ex = dx >= 0 ? b.x : b.x + NODE_W;
    p1 = { x: sx, y: ca.y };
    p2 = { x: ex, y: cb.y };
    const bend = Math.min(170, Math.max(48, Math.abs(dx) * 0.42));
    c1 = { x: p1.x + (dx >= 0 ? bend : -bend), y: p1.y };
    c2 = { x: p2.x + (dx >= 0 ? -bend : bend), y: p2.y };
  } else {
    // svislé napojení na horní/dolní hranu
    const sy = dy >= 0 ? a.y + NODE_H : a.y;
    const ey = dy >= 0 ? b.y : b.y + NODE_H;
    p1 = { x: ca.x, y: sy };
    p2 = { x: cb.x, y: ey };
    const bend = Math.min(150, Math.max(44, Math.abs(dy) * 0.42));
    c1 = { x: p1.x, y: p1.y + (dy >= 0 ? bend : -bend) };
    c2 = { x: p2.x, y: p2.y + (dy >= 0 ? -bend : bend) };
  }

  // bod v polovině kubické křivky (t = 0.5)
  const mid = {
    x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x,
    y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y,
  };

  return {
    d: `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`,
    mid,
  };
}

/* ------------------------------------------------------------
   Vykreslení vazby
   ------------------------------------------------------------ */
function renderEdge(edge) {
  const geo = edgeGeometry(edge);
  if (!geo) return;

  const selected = sel && sel.type === 'edge' && sel.id === edge.id;
  const g = el('g', { class: 'edge', 'data-id': edge.id }, edgesLayer);

  el('path', {
    d: geo.d, fill: 'none',
    stroke: selected ? EDGE_STROKE_SEL : EDGE_STROKE,
    'stroke-width': selected ? 2.6 : 2,
    'marker-end': selected ? 'url(#arrow-sel)' : 'url(#arrow)',
  }, g);

  // neviditelná široká cesta pro pohodlné klikání
  el('path', {
    d: geo.d, fill: 'none', stroke: 'rgba(0,0,0,0)',
    'stroke-width': 16, class: 'edge-hit', 'data-id': edge.id,
  }, g);

  // štítek uprostřed vazby
  const files = edge.files || [];
  const line1 = edge.label || files[0] || 'vazba';
  const line2 = files.length > 1
    ? `${files.length} ${plural(files.length, 'soubor', 'soubory', 'souborů')}`
    : null;

  const f1 = `500 11px ${FONT}`;
  const t1 = truncate(line1, f1, 190);
  const w1 = textWidth(t1, f1);
  const w2 = line2 ? textWidth(line2, `400 10px ${FONT}`) : 0;
  const pillW = Math.max(w1, w2) + 24;
  const pillH = line2 ? 36 : 24;

  const pill = el('g', {
    class: 'edge-pill', 'data-id': edge.id,
    transform: `translate(${geo.mid.x}, ${geo.mid.y})`,
    cursor: 'pointer',
  }, g);

  el('rect', {
    x: -pillW / 2, y: -pillH / 2, width: pillW, height: pillH,
    rx: pillH / 2,
    fill: selected ? '#FCF3DC' : '#FFFEFB',
    stroke: selected ? EDGE_STROKE_SEL : 'rgba(28,27,25,0.10)',
    'stroke-width': selected ? 1.6 : 1,
    filter: 'url(#pill-shadow)',
  }, pill);

  const ty1 = line2 ? -3 : 0;
  const label1 = el('text', {
    x: 0, y: ty1, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-family': FONT, 'font-size': 11, 'font-weight': 500,
    fill: selected ? '#7A5A10' : '#6E6862',
  }, pill);
  label1.textContent = t1;

  if (line2) {
    const label2 = el('text', {
      x: 0, y: 10, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': FONT, 'font-size': 10,
      fill: '#A39C93',
    }, pill);
    label2.textContent = line2;
  }
}

/* ------------------------------------------------------------
   Vykreslení uzlu (karta modulu)
   ------------------------------------------------------------ */
function renderNode(node) {
  const pal = PALETTE[node.color] || PALETTE.sun;
  const selected = sel && sel.type === 'node' && sel.id === node.id;
  const isSource = connectSource === node.id;

  const g = el('g', {
    class: 'node' + (selected ? ' selected' : ''),
    'data-id': node.id,
    transform: `translate(${node.x}, ${node.y})`,
  }, nodesLayer);

  if (selected || isSource) {
    el('rect', {
      x: -5, y: -5, width: NODE_W + 10, height: NODE_H + 10, rx: 25,
      fill: 'none', stroke: PALETTE.sun.base, 'stroke-width': 3, opacity: 0.5,
    }, g);
  }

  el('rect', {
    class: 'node-body',
    width: NODE_W, height: NODE_H, rx: 20,
    fill: '#FFFEFB',
    stroke: selected || isSource ? PALETTE.sun.base : 'rgba(28,27,25,0.10)',
    'stroke-width': selected || isSource ? 1.6 : 1,
    filter: 'url(#card-shadow)',
  }, g);

  // ikona v barevném kroužku
  el('circle', { cx: 34, cy: 32, r: 18, fill: pal.soft, stroke: pal.base, 'stroke-width': 1.2 }, g);
  const ico = el('text', {
    x: 34, y: 33, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': 16, 'font-family': FONT,
  }, g);
  ico.textContent = node.icon || '📦';

  // název
  const titleFont = `600 14px ${FONT}`;
  const title = el('text', {
    x: 62, y: 25, 'dominant-baseline': 'central',
    'font-family': FONT, 'font-size': 14, 'font-weight': 600,
    fill: '#1C1B19', 'letter-spacing': '-0.1',
  }, g);
  title.textContent = truncate(node.title || 'Bez názvu', titleFont, NODE_W - 76);

  // kategorie jako barevný čip
  const catFont = `600 10px ${FONT}`;
  const cat = node.category || 'Ostatní';
  const catT = truncate(cat, catFont, 110);
  const catW = textWidth(catT, catFont) + 16;
  el('rect', { x: 62, y: 36, width: catW, height: 17, rx: 8.5, fill: pal.soft }, g);
  const catText = el('text', {
    x: 62 + catW / 2, y: 45, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-family': FONT, 'font-size': 10, 'font-weight': 600, fill: pal.ink,
  }, g);
  catText.textContent = catT;

  // spodní řádek: počty souborů a vazeb
  const nFiles = (node.files || []).length;
  const deg = nodeEdges(node.id).length;
  const meta = el('text', {
    x: 16, y: 73, 'dominant-baseline': 'central',
    'font-family': FONT, 'font-size': 11, fill: '#A39C93',
  }, g);
  meta.textContent =
    `${nFiles} ${plural(nFiles, 'soubor', 'soubory', 'souborů')}  ·  ` +
    `${deg} ${plural(deg, 'vazba', 'vazby', 'vazeb')}`;

  // port pro tažení nové vazby
  const port = el('g', { class: 'port', 'data-port': node.id }, g);
  el('circle', { cx: NODE_W, cy: NODE_H / 2, r: 9, fill: PALETTE.sun.base, stroke: '#FFFEFB', 'stroke-width': 2.5 }, port);
  const plus = el('text', {
    x: NODE_W, y: NODE_H / 2 + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-family': FONT, 'font-size': 11, 'font-weight': 700, fill: '#5C420A',
    'pointer-events': 'none',
  }, port);
  plus.textContent = '+';
}

/* ------------------------------------------------------------
   Kompletní překreslení
   ------------------------------------------------------------ */
function renderAll() {
  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';
  for (const e of state.edges) renderEdge(e);
  for (const n of state.nodes) renderNode(n);
  updateStats();
}

function allFiles() {
  const set = new Set();
  for (const n of state.nodes) (n.files || []).forEach(f => set.add(f.trim()));
  for (const e of state.edges) (e.files || []).forEach(f => set.add(f.trim()));
  set.delete('');
  return set;
}

function updateStats() {
  const nN = state.nodes.length, nE = state.edges.length, nF = allFiles().size;
  statsPill.innerHTML =
    `<span><b>${nN}</b> ${plural(nN, 'modul', 'moduly', 'modulů')}</span>` +
    `<span><b>${nE}</b> ${plural(nE, 'vazba', 'vazby', 'vazeb')}</span>` +
    `<span><b>${nF}</b> ${plural(nF, 'soubor', 'soubory', 'souborů')}</span>`;
}

/* ------------------------------------------------------------
   Pohled: pan + zoom
   ------------------------------------------------------------ */
function applyView() {
  const { x, y, scale } = state.view;
  viewport.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
  const grid = 26 * scale;
  wrap.style.backgroundSize = `${grid}px ${grid}px`;
  wrap.style.backgroundPosition = `${x}px ${y}px`;
  zoomLabel.textContent = Math.round(scale * 100) + ' %';
}

function screenToWorld(sx, sy) {
  const r = wrap.getBoundingClientRect();
  return {
    x: (sx - r.left - state.view.x) / state.view.scale,
    y: (sy - r.top - state.view.y) / state.view.scale,
  };
}

function zoomAt(sx, sy, factor) {
  const r = wrap.getBoundingClientRect();
  const px = sx - r.left, py = sy - r.top;
  const old = state.view.scale;
  const next = Math.min(2.5, Math.max(0.25, old * factor));
  state.view.x = px - (px - state.view.x) * (next / old);
  state.view.y = py - (py - state.view.y) * (next / old);
  state.view.scale = next;
  applyView();
  save();
}

function contentBBox() {
  if (!state.nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of state.nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
  }
  for (const e of state.edges) {
    const geo = edgeGeometry(e);
    if (!geo) continue;
    minX = Math.min(minX, geo.mid.x - 110); maxX = Math.max(maxX, geo.mid.x + 110);
    minY = Math.min(minY, geo.mid.y - 26);  maxY = Math.max(maxY, geo.mid.y + 26);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function fitView() {
  const bb = contentBBox();
  if (!bb) return;
  const r = wrap.getBoundingClientRect();
  const pad = 90;
  const scale = Math.min(2, Math.max(0.25, Math.min(
    (r.width - pad * 2) / bb.width,
    (r.height - pad * 2) / bb.height,
  )));
  state.view.scale = scale;
  state.view.x = (r.width - bb.width * scale) / 2 - bb.x * scale;
  state.view.y = (r.height - bb.height * scale) / 2 - bb.y * scale;
  applyView();
  save();
}

/* ------------------------------------------------------------
   Výběr
   ------------------------------------------------------------ */
function select(next) {
  sel = next;
  renderAll();
  renderSidebar();
}

function centerOn(node) {
  const r = wrap.getBoundingClientRect();
  state.view.x = r.width / 2 - (node.x + NODE_W / 2) * state.view.scale;
  state.view.y = r.height / 2 - (node.y + NODE_H / 2) * state.view.scale;
  applyView();
  save();
}

/* ------------------------------------------------------------
   Mutace dat
   ------------------------------------------------------------ */
function addNode(x, y) {
  const color = PALETTE_KEYS[state.nodes.length % PALETTE_KEYS.length];
  const node = {
    id: uid(), x: Math.round(x), y: Math.round(y),
    title: 'Nový modul', icon: '📦', category: 'Ostatní',
    color, desc: '', files: [],
  };
  state.nodes.push(node);
  save();
  select({ type: 'node', id: node.id });
  const input = sidebar.querySelector('#f-title');
  if (input) { input.focus(); input.select(); }
  toast('Modul přidán — pojmenuj ho v panelu vpravo');
}

function addEdge(fromId, toId) {
  if (fromId === toId) return;
  const existing = state.edges.find(e => e.from === fromId && e.to === toId);
  if (existing) {
    toast('Tato vazba už existuje');
    select({ type: 'edge', id: existing.id });
    return;
  }
  const edge = { id: uid(), from: fromId, to: toId, label: '', files: [], desc: '' };
  state.edges.push(edge);
  save();
  select({ type: 'edge', id: edge.id });
  toast('Vazba vytvořena — doplň soubory a zodpovědnost');
}

function deleteSelection() {
  if (!sel) return;
  if (sel.type === 'node') {
    state.edges = state.edges.filter(e => e.from !== sel.id && e.to !== sel.id);
    state.nodes = state.nodes.filter(n => n.id !== sel.id);
    toast('Modul smazán (včetně jeho vazeb)');
  } else {
    state.edges = state.edges.filter(e => e.id !== sel.id);
    toast('Vazba smazána');
  }
  save();
  select(null);
}

function autoLayout() {
  const n = state.nodes.length;
  if (!n) return;
  const r = wrap.getBoundingClientRect();
  const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
  const radius = Math.max(240, n * 62);
  state.nodes.forEach((node, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    node.x = Math.round(c.x + Math.cos(a) * radius - NODE_W / 2);
    node.y = Math.round(c.y + Math.sin(a) * radius * 0.72 - NODE_H / 2);
  });
  save();
  renderAll();
  fitView();
  toast('Moduly uspořádány');
}

/* ------------------------------------------------------------
   Režim propojování
   ------------------------------------------------------------ */
function setConnectMode(on, source = null) {
  connectMode = on;
  connectSource = on ? source : null;
  document.getElementById('btn-connect').classList.toggle('active', on);
  connectHint.classList.toggle('hidden', !on);
  wrap.classList.toggle('connecting', on);
  renderAll();
}

/* ------------------------------------------------------------
   Interakce s plátnem (pointer events)
   ------------------------------------------------------------ */
let drag = null; // { kind: 'node'|'pan'|'wire', ... }

svg.addEventListener('pointerdown', (e) => {
  const portEl = e.target.closest('[data-port]');
  const nodeEl = e.target.closest('.node');
  const edgeEl = e.target.closest('.edge-hit, .edge-pill');

  closeMenus();

  if (portEl) {
    // tažení nové vazby z portu
    const fromId = portEl.getAttribute('data-port');
    drag = { kind: 'wire', from: fromId, moved: false };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  if (nodeEl) {
    const id = nodeEl.getAttribute('data-id');
    if (connectMode) {
      if (!connectSource) {
        setConnectMode(true, id);
        toast('Zdroj vybrán — klikni na cílový modul');
      } else if (connectSource !== id) {
        const src = connectSource;
        setConnectMode(false);
        addEdge(src, id);
      } else {
        setConnectMode(true, null);
      }
      return;
    }
    const node = nodeById(id);
    const w = screenToWorld(e.clientX, e.clientY);
    drag = { kind: 'node', id, dx: w.x - node.x, dy: w.y - node.y, moved: false };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  if (edgeEl) {
    select({ type: 'edge', id: edgeEl.getAttribute('data-id') });
    return;
  }

  // prázdné plátno → posun pohledu
  drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: state.view.x, vy: state.view.y, moved: false };
  wrap.classList.add('panning');
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', (e) => {
  if (!drag) return;

  if (drag.kind === 'node') {
    const w = screenToWorld(e.clientX, e.clientY);
    const node = nodeById(drag.id);
    node.x = Math.round(w.x - drag.dx);
    node.y = Math.round(w.y - drag.dy);
    drag.moved = true;
    renderAll();
  } else if (drag.kind === 'pan') {
    state.view.x = drag.vx + (e.clientX - drag.sx);
    state.view.y = drag.vy + (e.clientY - drag.sy);
    drag.moved = true;
    applyView();
  } else if (drag.kind === 'wire') {
    drag.moved = true;
    const from = nodeById(drag.from);
    const w = screenToWorld(e.clientX, e.clientY);
    tempLayer.innerHTML = '';
    el('path', {
      d: `M ${from.x + NODE_W} ${from.y + NODE_H / 2} L ${w.x} ${w.y}`,
      fill: 'none', stroke: EDGE_STROKE_SEL, 'stroke-width': 2.2,
      'stroke-dasharray': '7 5', 'marker-end': 'url(#arrow-sel)',
    }, tempLayer);
    // zvýraznění cílového uzlu pod kurzorem
    document.querySelectorAll('.node.drop-target').forEach(n => n.classList.remove('drop-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const target = under && under.closest ? under.closest('.node') : null;
    if (target && target.getAttribute('data-id') !== drag.from) target.classList.add('drop-target');
  }
});

svg.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  wrap.classList.remove('panning');

  if (d.kind === 'node') {
    if (!d.moved) select({ type: 'node', id: d.id });
    else save();
  } else if (d.kind === 'pan') {
    if (!d.moved) select(null);
    else save();
  } else if (d.kind === 'wire') {
    tempLayer.innerHTML = '';
    document.querySelectorAll('.node.drop-target').forEach(n => n.classList.remove('drop-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const target = under && under.closest ? under.closest('.node') : null;
    if (target) {
      const toId = target.getAttribute('data-id');
      if (toId !== d.from) addEdge(d.from, toId);
    } else if (!d.moved) {
      // pouhé kliknutí na port → režim propojování s předvoleným zdrojem
      setConnectMode(true, d.from);
      toast('Klikni na cílový modul');
    }
  }
});

svg.addEventListener('dblclick', (e) => {
  if (e.target.closest('.node') || e.target.closest('.edge-hit, .edge-pill')) return;
  const w = screenToWorld(e.clientX, e.clientY);
  addNode(w.x - NODE_W / 2, w.y - NODE_H / 2);
});

wrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

/* ------------------------------------------------------------
   Postranní panel — inspektor
   ------------------------------------------------------------ */
function field(labelText, inputHtml, hint = '') {
  return `<div class="field"><label>${labelText}</label>${inputHtml}` +
         (hint ? `<div class="hint">${hint}</div>` : '') + `</div>`;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderSidebar() {
  if (sel && sel.type === 'node') return renderNodeInspector();
  if (sel && sel.type === 'edge') return renderEdgeInspector();
  renderOverview();
}

/* --- Přehled sítě --- */
function renderOverview() {
  const nN = state.nodes.length, nE = state.edges.length, nF = allFiles().size;

  const items = state.nodes.map(n => {
    const pal = PALETTE[n.color] || PALETTE.sun;
    const deg = nodeEdges(n.id).length;
    return `<button class="link-item" data-goto="${n.id}">
      <span class="dot" style="background:${pal.base}"></span>
      <span class="li-main">
        <span class="li-title">${esc(n.title)}</span>
        <span class="li-sub">${esc(n.category || '')}</span>
      </span>
      <span class="li-badge">${deg} ${plural(deg, 'vazba', 'vazby', 'vazeb')}</span>
    </button>`;
  }).join('');

  sidebar.innerHTML = `
    <div class="panel-kicker">Přehled</div>
    <div class="panel-title">Síť modulů</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${nN}</div><div class="lbl">${plural(nN, 'Modul', 'Moduly', 'Modulů')}</div></div>
      <div class="stat-card"><div class="num">${nE}</div><div class="lbl">${plural(nE, 'Vazba', 'Vazby', 'Vazeb')}</div></div>
      <div class="stat-card wide"><div class="num">${nF}</div><div class="lbl">Propojujících souborů celkem</div></div>
    </div>
    <div class="section-label">Moduly</div>
    <div class="link-list">${items || '<div class="hint">Zatím žádné moduly.</div>'}</div>
    <div class="empty-tip">
      <b>Tipy:</b> dvojklik na plátno přidá modul · tažením ze žlutého
      <b>＋</b> na okraji karty vytvoříš vazbu · kolečkem přibližuješ ·
      klávesy <b>N</b> (modul), <b>C</b> (propojit), <b>Delete</b> (smazat).
    </div>`;

  sidebar.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const node = nodeById(btn.getAttribute('data-goto'));
      select({ type: 'node', id: node.id });
      centerOn(node);
    });
  });
}

/* --- Inspektor modulu --- */
function renderNodeInspector() {
  const node = nodeById(sel.id);
  if (!node) return renderOverview();
  const pal = PALETTE[node.color] || PALETTE.sun;

  const swatches = PALETTE_KEYS.map(key => {
    const p = PALETTE[key];
    return `<button class="swatch ${node.color === key ? 'selected' : ''}"
      data-color="${key}" title="${p.name}" style="background:${p.base}"></button>`;
  }).join('');

  const edges = nodeEdges(node.id).map(e => {
    const other = nodeById(e.from === node.id ? e.to : e.from);
    const dir = e.from === node.id ? '→' : '←';
    const oPal = other ? (PALETTE[other.color] || PALETTE.sun) : PALETTE.graphite;
    return `<button class="link-item" data-edge="${e.id}">
      <span class="dot" style="background:${oPal.base}"></span>
      <span class="li-main">
        <span class="li-title">${dir} ${esc(other ? other.title : '?')}</span>
        <span class="li-sub">${esc(e.label || (e.files || [])[0] || 'bez popisu')}</span>
      </span>
    </button>`;
  }).join('');

  sidebar.innerHTML = `
    <div class="panel-kicker">Modul</div>
    <div class="panel-title"><span class="emoji">${esc(node.icon || '📦')}</span>${esc(node.title)}</div>

    ${field('Název', `<input type="text" id="f-title" value="${esc(node.title)}">`)}
    <div class="field-row">
      ${field('Ikona (emoji)', `<input type="text" id="f-icon" value="${esc(node.icon || '')}" maxlength="4">`)}
      ${field('Kategorie', `<input type="text" id="f-category" value="${esc(node.category || '')}" list="categories">`)}
    </div>
    <datalist id="categories">
      ${[...new Set(state.nodes.map(n => n.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}
    </datalist>
    ${field('Barva', `<div class="swatches">${swatches}</div>`)}
    ${field('Za co modul zodpovídá', `<textarea id="f-desc">${esc(node.desc || '')}</textarea>`)}
    ${field('Soubory modulu', `<textarea id="f-files">${esc((node.files || []).join('\n'))}</textarea>`, 'Jeden soubor na řádek')}

    <div class="section-label">Vazby (${nodeEdges(node.id).length})</div>
    <div class="link-list">${edges || '<div class="hint">Zatím žádné vazby — vytvoř je tažením ze žlutého ＋.</div>'}</div>

    <div class="panel-actions">
      <button class="btn btn-ghost" id="f-connect"><span class="btn-ico">⌁</span> Propojit s…</button>
      <button class="btn btn-danger" id="f-delete">Smazat</button>
    </div>`;

  const bind = (id, fn) => sidebar.querySelector(id).addEventListener('input', (e) => { fn(e.target.value); save(); renderAll(); });
  bind('#f-title', v => { node.title = v; });
  bind('#f-icon', v => { node.icon = v; });
  bind('#f-category', v => { node.category = v; });
  bind('#f-desc', v => { node.desc = v; });
  bind('#f-files', v => { node.files = v.split('\n').map(s => s.trim()).filter(Boolean); });

  sidebar.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      node.color = sw.getAttribute('data-color');
      save();
      renderAll();
      renderSidebar();
    });
  });

  sidebar.querySelectorAll('[data-edge]').forEach(btn => {
    btn.addEventListener('click', () => select({ type: 'edge', id: btn.getAttribute('data-edge') }));
  });

  sidebar.querySelector('#f-connect').addEventListener('click', () => {
    setConnectMode(true, node.id);
    toast('Klikni na cílový modul');
  });
  sidebar.querySelector('#f-delete').addEventListener('click', deleteSelection);
}

/* --- Inspektor vazby --- */
function renderEdgeInspector() {
  const edge = edgeById(sel.id);
  if (!edge) return renderOverview();
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);
  const fPal = from ? (PALETTE[from.color] || PALETTE.sun) : PALETTE.graphite;
  const tPal = to ? (PALETTE[to.color] || PALETTE.sun) : PALETTE.graphite;

  sidebar.innerHTML = `
    <div class="panel-kicker">Vazba</div>
    <div class="panel-title">Propojení modulů</div>

    <div class="edge-head">
      <span class="node-chip"><span class="dot" style="background:${fPal.base}"></span><span>${esc(from ? from.title : '?')}</span></span>
      <span class="arrow">→</span>
      <span class="node-chip"><span class="dot" style="background:${tPal.base}"></span><span>${esc(to ? to.title : '?')}</span></span>
    </div>

    ${field('Označení vazby', `<input type="text" id="f-label" value="${esc(edge.label || '')}" placeholder="např. api/orders.js">`, 'Zobrazuje se na štítku přímo v síti')}
    ${field('Propojující soubory', `<textarea id="f-files">${esc((edge.files || []).join('\n'))}</textarea>`, 'Jeden soubor na řádek — které soubory moduly propojují')}
    ${field('Za co vazba zodpovídá', `<textarea id="f-desc" placeholder="Co si moduly předávají a proč…">${esc(edge.desc || '')}</textarea>`)}

    <div class="panel-actions">
      <button class="btn btn-ghost" id="f-swap"><span class="btn-ico">⇆</span> Prohodit směr</button>
      <button class="btn btn-danger" id="f-delete">Smazat</button>
    </div>`;

  const bind = (id, fn) => sidebar.querySelector(id).addEventListener('input', (e) => { fn(e.target.value); save(); renderAll(); });
  bind('#f-label', v => { edge.label = v; });
  bind('#f-files', v => { edge.files = v.split('\n').map(s => s.trim()).filter(Boolean); });
  bind('#f-desc', v => { edge.desc = v; });

  sidebar.querySelector('#f-swap').addEventListener('click', () => {
    [edge.from, edge.to] = [edge.to, edge.from];
    save();
    renderAll();
    renderSidebar();
  });
  sidebar.querySelector('#f-delete').addEventListener('click', deleteSelection);
}

/* ------------------------------------------------------------
   Toast
   ------------------------------------------------------------ */
function toast(msg) {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 2600);
}

/* ------------------------------------------------------------
   Horní lišta a klávesy
   ------------------------------------------------------------ */
document.getElementById('btn-add').addEventListener('click', () => {
  const r = wrap.getBoundingClientRect();
  const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
  addNode(c.x - NODE_W / 2 + (Math.random() * 60 - 30), c.y - NODE_H / 2 + (Math.random() * 60 - 30));
});

document.getElementById('btn-connect').addEventListener('click', () => setConnectMode(!connectMode));
document.getElementById('btn-layout').addEventListener('click', autoLayout);

document.getElementById('zoom-in').addEventListener('click', () => {
  const r = wrap.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25);
});
document.getElementById('zoom-out').addEventListener('click', () => {
  const r = wrap.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.25);
});
document.getElementById('zoom-fit').addEventListener('click', fitView);

/* Export menu */
const exportMenu = document.getElementById('export-menu');
document.getElementById('btn-export').addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('hidden');
});
function closeMenus() { exportMenu.classList.add('hidden'); }
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeMenus();
});

exportMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  closeMenus();
  const action = btn.getAttribute('data-action');

  if (action === 'png' || action === 'pdf') {
    const bb = contentBBox();
    if (!bb) return toast('Není co exportovat — síť je prázdná');
    const prevSel = sel;
    select(null); // exportujeme bez zvýraznění výběru
    try {
      if (action === 'png') { await MMExport.exportPNG(svg, bb); toast('PNG uloženo'); }
      else { await MMExport.exportPDF(svg, bb); toast('PDF uloženo'); }
    } catch (err) {
      console.error(err);
      toast('Export se nepodařil');
    }
    select(prevSel);
  } else if (action === 'json') {
    MMExport.exportJSON({ nodes: state.nodes, edges: state.edges, view: state.view });
    toast('JSON uložen');
  } else if (action === 'import') {
    document.getElementById('file-input').click();
  } else if (action === 'reset') {
    state = defaultState();
    save();
    select(null);
    applyView();
    toast('Ukázková síť obnovena');
  }
});

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('bad format');
    state = { nodes: data.nodes, edges: data.edges, view: data.view || { x: 0, y: 0, scale: 1 } };
    save();
    select(null);
    applyView();
    fitView();
    toast('Síť načtena z JSON');
  } catch (_) {
    toast('Soubor se nepodařilo načíst — neplatný JSON');
  }
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');

  if (e.key === 'Escape') {
    if (connectMode) setConnectMode(false);
    else if (!typing) select(null);
    closeMenus();
    return;
  }
  if (typing) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelection();
  } else if (e.key.toLowerCase() === 'n') {
    document.getElementById('btn-add').click();
  } else if (e.key.toLowerCase() === 'c') {
    setConnectMode(!connectMode);
  } else if (e.key.toLowerCase() === 'f') {
    fitView();
  }
});

/* ------------------------------------------------------------
   Start
   ------------------------------------------------------------ */
applyView();
renderAll();
renderSidebar();
