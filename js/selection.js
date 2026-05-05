import { AppState, updateStatsBar, showToast } from './ui.js';
import { saveCaught } from './store.js';
import { SHINY_LOCKED, statusClass } from './dex.js';

// ── Module state ──────────────────────────────────────────
let isSelecting   = false;
let suppressClick = false;
let selectAction  = null;   // 'add' | 'remove'
let selectMode    = null;   // 'caught' | 'shiny'
let activeConfig  = null;   // which CONFIGS entry started this drag
let startX = 0, startY = 0;
let curX   = 0, curY   = 0;
let rafPending = false;

const MIN_DRAG = 5; // px — below this, treat as a plain click

// ── Container configs ─────────────────────────────────────
const CONFIGS = [
  {
    id:   'dex-container',
    sel:  '.dex-sprite[data-id]',
    mode: () => AppState.dexMode === 'shiny' ? 'shiny' : 'caught',
  },
  {
    id:   'box-grid',
    sel:  '.dex-sprite[data-id]',
    mode: () => AppState.boxMode === 'shiny' ? 'shiny' : 'caught',
  },
];

// ── Init ──────────────────────────────────────────────────
export function initSelection() {
  // Inject the rubber-band box element into the page
  const boxEl = document.createElement('div');
  boxEl.id = 'selection-box';
  boxEl.hidden = true;
  document.body.appendChild(boxEl);

  for (const cfg of CONFIGS) {
    document.getElementById(cfg.id).addEventListener('mousedown', e => onDown(e, cfg));
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  // Swallow the click that browsers fire after mouseup so single-click
  // toggle handlers don't double-fire after a completed drag.
  document.addEventListener('click', e => {
    if (suppressClick) { e.stopImmediatePropagation(); suppressClick = false; }
  }, true /* capture phase */);
}

// ── Mouse handlers ────────────────────────────────────────
function onDown(e, cfg) {
  if (e.button !== 0) return;
  if (e.target.closest('button')) return;

  const mode = cfg.mode();
  const tile = e.target.closest(cfg.sel);

  // Determine add/remove from the tile under the cursor (if any)
  let action = 'add';
  if (tile) {
    const id = Number(tile.dataset.id);
    if (mode === 'shiny' && SHINY_LOCKED.has(id)) return;
    const active = mode === 'shiny'
      ? AppState.shinyCaughtSet.has(id)
      : AppState.caughtSet.has(id);
    action = active ? 'remove' : 'add';
  }

  isSelecting  = true;
  selectMode   = mode;
  selectAction = action;
  activeConfig = cfg;
  startX = curX = e.clientX;
  startY = curY = e.clientY;
}

function onMove(e) {
  if (!isSelecting) return;
  e.preventDefault(); // prevent text selection while dragging
  curX = e.clientX;
  curY = e.clientY;

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(updateBoxAndHighlight);
  }
}

function updateBoxAndHighlight() {
  rafPending = false;
  if (!isSelecting) return;

  const x1 = Math.min(startX, curX);
  const y1 = Math.min(startY, curY);
  const w  = Math.abs(curX - startX);
  const h  = Math.abs(curY - startY);
  const boxEl = document.getElementById('selection-box');

  if (w < MIN_DRAG && h < MIN_DRAG) {
    // Not yet a real drag — keep box hidden, no highlights
    boxEl.hidden = true;
    return;
  }

  // Show and position the rubber-band box
  boxEl.style.left   = `${x1}px`;
  boxEl.style.top    = `${y1}px`;
  boxEl.style.width  = `${w}px`;
  boxEl.style.height = `${h}px`;
  boxEl.hidden = false;

  document.body.classList.add('drag-selecting');

  // Live-highlight every tile that intersects the current box
  const container = document.getElementById(activeConfig.id);
  if (!container) return;
  const x2 = x1 + w, y2 = y1 + h;
  for (const tile of container.querySelectorAll(activeConfig.sel)) {
    const r = tile.getBoundingClientRect();
    tile.classList.toggle('drag-selected',
      r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1);
  }
}

function onUp() {
  if (!isSelecting) return;
  isSelecting = false;
  rafPending  = false;

  document.getElementById('selection-box').hidden = true;
  document.body.classList.remove('drag-selecting');

  const wasDrag = Math.abs(curX - startX) >= MIN_DRAG
                || Math.abs(curY - startY) >= MIN_DRAG;

  if (wasDrag) {
    const container = document.getElementById(activeConfig.id);
    const selected  = container
      ? [...container.querySelectorAll(`${activeConfig.sel}.drag-selected`)]
      : [];

    if (selected.length > 0) {
      suppressClick = true;
      applySelection(selected);
    }
  }

  // Clear all highlights regardless
  for (const el of document.querySelectorAll('.drag-selected')) {
    el.classList.remove('drag-selected');
  }

  activeConfig = null;
  selectMode   = null;
  selectAction = null;
}

// ── Apply + DOM update ────────────────────────────────────
function applySelection(tiles) {
  let changed = 0;

  for (const tile of tiles) {
    const id       = Number(tile.dataset.id);
    const inCaught = AppState.caughtSet.has(id);
    const inShiny  = AppState.shinyCaughtSet.has(id);

    if (selectMode === 'shiny') {
      if      (selectAction === 'add'    && !inShiny) { AppState.shinyCaughtSet.add(id);    changed++; }
      else if (selectAction === 'remove' &&  inShiny) { AppState.shinyCaughtSet.delete(id); changed++; }
    } else {
      if      (selectAction === 'add'    && !inCaught) { AppState.caughtSet.add(id);    changed++; }
      else if (selectAction === 'remove' &&  inCaught) { AppState.caughtSet.delete(id); changed++; }
    }
  }

  if (changed === 0) return;

  saveCaught(AppState.caughtSet, AppState.shinyCaughtSet);
  for (const tile of tiles) updateTile(tile, Number(tile.dataset.id));
  updateStatsBar();

  const verb  = selectAction === 'add' ? 'marked' : 'unmarked';
  const label = selectMode === 'shiny' ? ' shiny' : '';
  showToast(`${changed} Pokémon ${verb}${label} as caught`);
}

function updateTile(tile, id) {
  const caught = AppState.caughtSet.has(id);
  const shiny  = AppState.shinyCaughtSet.has(id);

  if (tile.tagName === 'ARTICLE') {
    tile.classList.toggle('card-caught', caught);
    tile.classList.toggle('card-shiny',  shiny);
    tile.querySelector('.btn-caught')?.setAttribute('aria-pressed', String(caught));
    tile.querySelector('.btn-shiny')?.setAttribute('aria-pressed',  String(shiny));
  } else {
    tile.classList.remove('is-caught', 'is-shiny', 'is-both');
    const sc = statusClass(caught, shiny, false);
    if (sc) tile.classList.add(sc);
  }
}
