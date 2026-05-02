import { getPokemonList }                              from './data.js';
import { loadTrackerData, saveCaught, exportJSON,
         importJSON, resetAll, loadUIState, saveUIState,
         HUNT_SLOTS }                                   from './store.js';
import { renderCards, handleCardToggle }                from './cards.js';
import { renderDex,   handleDexToggle }                 from './dex.js';
import { renderHunt,  handleHuntClick, initHuntEvents } from './hunt.js';
import { renderBoxes, handleBoxToggle,
         navigateBox, resetBoxCache }                   from './boxes.js';

export const AppState = {
  pokemon:        [],
  caughtSet:      new Set(),
  shinyCaughtSet: new Set(),
  filters: {
    search:  '',
    gen:     0,
    type:    '',
    caught:  'all',
    shiny:   'all',
  },
  activeView:    'cards',
  dexMode:       'normal',
  boxMode:       'normal',
  boxIndex:      0,
  huntingSlots:  [],
  spriteMode:    'static',  // 'static' | 'animated'
};

const VIEWS = ['cards', 'dex', 'hunt', 'boxes'];

// Derived lookups — populated once in initApp after pokemon data loads
export const pokemonById = new Map();
let totalNonRegional = 0;

// ── HTML escaping ─────────────────────────────────────────
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sprite URLs ───────────────────────────────────────────
const _SPRITE_BASE    = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const _ANIMATED_BASE  = `${_SPRITE_BASE}/versions/generation-v/black-white/animated`;
const ANIMATED_MAX_ID = 649; // B&W animated sprites only exist for Gen 1–5

export function getSpriteUrl(id, isShiny) {
  if (AppState.spriteMode === 'animated' && id <= ANIMATED_MAX_ID) {
    return isShiny
      ? `${_ANIMATED_BASE}/shiny/${id}.gif`
      : `${_ANIMATED_BASE}/${id}.gif`;
  }
  return isShiny
    ? `${_SPRITE_BASE}/shiny/${id}.png`
    : `${_SPRITE_BASE}/${id}.png`;
}

// ── Filtering ─────────────────────────────────────────────
export function applyFilters(pokemon, filters, caughtSet, shinyCaughtSet) {
  const q = filters.search.toLowerCase().trim();
  return pokemon.filter(p => {
    if (q && !p.displayName.toLowerCase().includes(q) && !String(p.id).includes(q)) return false;
    if (filters.gen  && p.generation !== filters.gen)    return false;
    if (filters.type && !p.types.includes(filters.type)) return false;
    const isCaught = caughtSet.has(p.id);
    const isShiny  = shinyCaughtSet.has(p.id);
    if (filters.caught === 'caught'     && !isCaught) return false;
    if (filters.caught === 'not-caught' &&  isCaught) return false;
    if (filters.shiny  === 'shiny'      && !isShiny)  return false;
    if (filters.shiny  === 'not-shiny'  &&  isShiny)  return false;
    return true;
  });
}

// ── Stats bar ─────────────────────────────────────────────
export function updateStatsBar() {
  let both = 0;
  for (const id of AppState.caughtSet) {
    if (AppState.shinyCaughtSet.has(id)) both++;
  }
  document.getElementById('stat-caught').textContent =
    `Caught: ${AppState.caughtSet.size} / ${totalNonRegional}`;
  document.getElementById('stat-shiny').textContent =
    `Shiny: ${AppState.shinyCaughtSet.size} / ${totalNonRegional}`;
  document.getElementById('stat-both').textContent =
    `Both: ${both} / ${totalNonRegional}`;
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.removeAttribute('hidden');
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.setAttribute('hidden', ''), 220);
  }, 2000);
}

// ── Theme ─────────────────────────────────────────────────
const THEME_KEY = 'pokemonTrackerTheme';

function syncThemeButton() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const btn = document.getElementById('btn-theme');
  btn.textContent = isLight ? '🌙 Dark' : '☀ Light';
  btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  syncThemeButton();
}

// ── Animated sprite toggle ────────────────────────────────
function syncSpriteButton() {
  const animated = AppState.spriteMode === 'animated';
  const btn = document.getElementById('btn-sprite-mode');
  btn.textContent = animated ? '📷 Static' : '🎬 Animated';
  btn.classList.toggle('active', animated);
  btn.title = animated ? 'Switch to static sprites' : 'Switch to B&W animated sprites';
}

function toggleSpriteMode() {
  AppState.spriteMode = AppState.spriteMode === 'animated' ? 'static' : 'animated';
  syncSpriteButton();
  renderActiveView();
  persistUIState();
}

// ── Dex / Box mode helpers ────────────────────────────────
function applyMode(stateKey, prefix, mode) {
  AppState[stateKey] = mode;
  document.getElementById(`btn-${prefix}-normal`).classList.toggle('active', mode === 'normal');
  document.getElementById(`btn-${prefix}-shiny`).classList.toggle('active',  mode === 'shiny');
  document.getElementById(`btn-${prefix}-normal`).setAttribute('aria-pressed', String(mode === 'normal'));
  document.getElementById(`btn-${prefix}-shiny`).setAttribute('aria-pressed',  String(mode === 'shiny'));
}

function applyDexMode(mode) { applyMode('dexMode', 'dex', mode); }
function applyBoxMode(mode) { applyMode('boxMode', 'box', mode); }

// ── View rendering ────────────────────────────────────────
function renderActiveView() {
  if (AppState.activeView === 'cards')       renderCards(AppState);
  else if (AppState.activeView === 'dex')    renderDex(AppState);
  else if (AppState.activeView === 'hunt')   renderHunt(AppState);
  else if (AppState.activeView === 'boxes')  renderBoxes(AppState);
}

function switchView(view) {
  AppState.activeView = view;
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== view);
    document.getElementById(`btn-view-${v}`).classList.toggle('active', v === view);
    document.getElementById(`btn-view-${v}`).setAttribute('aria-pressed', String(v === view));
  }
  renderActiveView();
  persistUIState();
}

// ── Persist UI state ──────────────────────────────────────
function persistUIState() {
  saveUIState({
    activeView:         AppState.activeView,
    activeGen:          AppState.filters.gen,
    activeType:         AppState.filters.type,
    activeCaughtFilter: AppState.filters.caught,
    activeShinyFilter:  AppState.filters.shiny,
    searchQuery:        AppState.filters.search,
    dexMode:            AppState.dexMode,
    boxMode:            AppState.boxMode,
    boxIndex:           AppState.boxIndex,
    spriteMode:         AppState.spriteMode,
  });
}

function restoreUIState() {
  const s = loadUIState();
  if (s.activeView && VIEWS.includes(s.activeView)) AppState.activeView   = s.activeView;
  if (s.activeGen  != null)  AppState.filters.gen    = Number(s.activeGen);
  if (s.activeType != null)  AppState.filters.type   = s.activeType;
  if (s.activeCaughtFilter != null) AppState.filters.caught = s.activeCaughtFilter;
  if (s.activeShinyFilter  != null) AppState.filters.shiny  = s.activeShinyFilter;
  if (s.searchQuery != null) AppState.filters.search  = s.searchQuery;
  if (s.dexMode)             AppState.dexMode         = s.dexMode;
  if (s.boxMode)             AppState.boxMode         = s.boxMode;
  if (s.boxIndex != null)    AppState.boxIndex        = Number(s.boxIndex);
  if (s.spriteMode)          AppState.spriteMode      = s.spriteMode;

  document.getElementById('filter-gen').value    = AppState.filters.gen;
  document.getElementById('filter-type').value   = AppState.filters.type;
  document.getElementById('filter-caught').value = AppState.filters.caught;
  document.getElementById('filter-shiny').value  = AppState.filters.shiny;
  document.getElementById('search-input').value  = AppState.filters.search;
}

// ── Event wiring ──────────────────────────────────────────
function wireEvents() {
  for (const v of VIEWS) {
    document.getElementById(`btn-view-${v}`).addEventListener('click', () => switchView(v));
  }

  document.getElementById('btn-dex-normal').addEventListener('click', () => {
    applyDexMode('normal'); renderDex(AppState); persistUIState();
  });
  document.getElementById('btn-dex-shiny').addEventListener('click', () => {
    applyDexMode('shiny');  renderDex(AppState); persistUIState();
  });

  document.getElementById('btn-box-normal').addEventListener('click', () => {
    applyBoxMode('normal'); renderBoxes(AppState); persistUIState();
  });
  document.getElementById('btn-box-shiny').addEventListener('click', () => {
    applyBoxMode('shiny');  renderBoxes(AppState); persistUIState();
  });

  document.getElementById('btn-box-prev').addEventListener('click', () => { navigateBox(-1); persistUIState(); });
  document.getElementById('btn-box-next').addEventListener('click', () => { navigateBox(1);  persistUIState(); });

  document.getElementById('search-input').addEventListener('input', e => {
    AppState.filters.search = e.target.value;
    renderActiveView();
    persistUIState();
  });

  document.getElementById('filter-gen').addEventListener('change', e => {
    AppState.filters.gen = Number(e.target.value); renderActiveView(); persistUIState();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    AppState.filters.type = e.target.value; renderActiveView(); persistUIState();
  });
  document.getElementById('filter-caught').addEventListener('change', e => {
    AppState.filters.caught = e.target.value; renderActiveView(); persistUIState();
  });
  document.getElementById('filter-shiny').addEventListener('change', e => {
    AppState.filters.shiny = e.target.value; renderActiveView(); persistUIState();
  });

  document.getElementById('card-grid').addEventListener('click', handleCardToggle);
  document.getElementById('dex-container').addEventListener('click', handleDexToggle);
  document.getElementById('box-grid').addEventListener('click', handleBoxToggle);
  document.getElementById('hunt-board').addEventListener('click', handleHuntClick);
  initHuntEvents();

  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-sprite-mode').addEventListener('click', toggleSpriteMode);
  document.getElementById('btn-export').addEventListener('click', exportJSON);

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importJSON(file);
      const { caughtSet, shinyCaughtSet, hunting } = loadTrackerData();
      AppState.caughtSet      = caughtSet;
      AppState.shinyCaughtSet = shinyCaughtSet;
      AppState.huntingSlots   = hunting;
      resetBoxCache();
      updateStatsBar();
      renderActiveView();
      showToast('Import successful!');
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all caught, shiny, and hunt data? This cannot be undone.')) return;
    resetAll();
    AppState.caughtSet      = new Set();
    AppState.shinyCaughtSet = new Set();
    AppState.huntingSlots   = new Array(HUNT_SLOTS).fill(null);
    resetBoxCache();
    updateStatsBar();
    renderActiveView();
    showToast('All data reset.');
  });
}

// ── Entry point ───────────────────────────────────────────
export async function initApp() {
  try {
    AppState.pokemon = await getPokemonList();
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<p style="color:var(--accent-red);padding:2rem">
        Failed to load Pokémon data. Run the generation script first:<br>
        <code>node scripts/generate-pokemon.mjs</code><br><br>
        ${err.message}
      </p>`;
    return;
  }

  // Build derived lookups once
  for (const p of AppState.pokemon) pokemonById.set(p.id, p);
  totalNonRegional = AppState.pokemon.filter(p => !p.region).length;

  const { caughtSet, shinyCaughtSet, hunting } = loadTrackerData();
  AppState.caughtSet      = caughtSet;
  AppState.shinyCaughtSet = shinyCaughtSet;
  AppState.huntingSlots   = hunting;

  restoreUIState();
  applyDexMode(AppState.dexMode);
  applyBoxMode(AppState.boxMode);
  syncThemeButton();
  syncSpriteButton();
  updateStatsBar();
  wireEvents();

  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).classList.toggle('hidden', AppState.activeView !== v);
    document.getElementById(`btn-view-${v}`).classList.toggle('active', AppState.activeView === v);
    document.getElementById(`btn-view-${v}`).setAttribute('aria-pressed', String(AppState.activeView === v));
  }

  renderActiveView();
}
