import { AppState, showToast, escapeHtml, pokemonById, getSpriteUrl } from './ui.js';
import { saveHunting, HUNT_SLOTS } from './store.js';
import { SHINY_LOCKED } from './dex.js';

const FALLBACK_IMG = './assets/pokeball.svg';

let activeSlotIndex = null;

// ── Hunt board ────────────────────────────────────────────
export function renderHunt(state) {
  const slots = state.huntingSlots.slice(0, HUNT_SLOTS);

  const slotsHtml = slots.map((id, i) => {
    if (id === null) {
      return `<div class="hunt-slot hunt-slot-empty" data-slot="${i}" data-action="open-picker">
        <span class="hunt-plus">+</span>
        <span class="hunt-empty-label">Add to Hunt</span>
      </div>`;
    }

    const p        = pokemonById.get(id);
    const name     = p?.displayName ?? `#${id}`;
    const safeName = escapeHtml(name);
    const gotShiny = state.shinyCaughtSet.has(id);
    const badge    = gotShiny ? `<div class="hunt-got-badge">★ Caught!</div>` : '';

    return `<div class="hunt-slot ${gotShiny ? 'hunt-slot-done' : ''}" data-slot="${i}" data-action="open-picker">
      <button class="hunt-remove" data-action="remove-slot" data-slot="${i}" title="Remove">×</button>
      <img loading="lazy"
           src="${getSpriteUrl(id, true)}"
           alt="${safeName}"
           onerror="this.src='${getSpriteUrl(id, false)}';this.onerror=null">
      <div class="hunt-name">${safeName}</div>
      ${badge}
    </div>`;
  }).join('');

  document.getElementById('hunt-board').innerHTML =
    `<div class="hunt-grid">${slotsHtml}</div>`;
}

// ── Slot click handler ────────────────────────────────────
export function handleHuntClick(e) {
  const removeBtn = e.target.closest('[data-action="remove-slot"]');
  if (removeBtn) {
    const i = Number(removeBtn.dataset.slot);
    AppState.huntingSlots[i] = null;
    saveHunting(AppState.huntingSlots);
    renderHunt(AppState);
    return;
  }

  const slot = e.target.closest('[data-action="open-picker"]');
  if (!slot) return;
  activeSlotIndex = Number(slot.dataset.slot);
  openPicker();
}

// ── Picker modal ──────────────────────────────────────────
function openPicker() {
  const modal  = document.getElementById('hunt-modal');
  const search = document.getElementById('hunt-search');
  search.value = '';
  renderPickerGrid('');
  modal.classList.remove('hidden');
  requestAnimationFrame(() => search.focus());
}

export function closePicker() {
  document.getElementById('hunt-modal').classList.add('hidden');
  activeSlotIndex = null;
}

function renderPickerGrid(query) {
  const q    = query.toLowerCase().trim();
  const list = q
    ? AppState.pokemon.filter(p =>
        p.displayName.toLowerCase().includes(q) || String(p.id).includes(q))
    : AppState.pokemon;

  const html = list.map(p => {
    const isHunting = AppState.huntingSlots.includes(p.id);
    const isLocked  = SHINY_LOCKED.has(p.id);
    const cls = [
      'picker-tile',
      isHunting ? 'picker-tile-active' : '',
      isLocked  ? 'picker-tile-locked' : '',
    ].filter(Boolean).join(' ');
    const tooltip = isLocked
      ? `${p.displayName} (#${p.id}) — shiny locked`
      : `${p.displayName} (#${p.id})`;
    return `<div class="${cls}" data-id="${p.id}" data-locked="${isLocked}" title="${tooltip}">
      <img loading="lazy" src="${getSpriteUrl(p.id, false)}" alt="${escapeHtml(p.displayName)}"
           onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
    </div>`;
  }).join('');

  document.getElementById('picker-grid').innerHTML =
    html || '<p style="color:var(--text-muted);padding:1rem 0">No results.</p>';
}

// ── Picker events ─────────────────────────────────────────
export function initHuntEvents() {
  document.getElementById('hunt-search').addEventListener('input', e => {
    renderPickerGrid(e.target.value);
  });

  document.getElementById('picker-grid').addEventListener('click', e => {
    const tile = e.target.closest('.picker-tile[data-id]');
    if (!tile || activeSlotIndex === null) return;
    if (tile.dataset.locked === 'true') return; // shiny-locked: ignore
    const id = Number(tile.dataset.id);
    AppState.huntingSlots[activeSlotIndex] = id;
    saveHunting(AppState.huntingSlots);
    renderHunt(AppState);
    closePicker();
    showToast(`${pokemonById.get(id)?.displayName ?? 'Pokémon'} added to hunt list!`);
  });

  document.getElementById('hunt-modal-close').addEventListener('click', closePicker);

  document.getElementById('hunt-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('hunt-modal')) closePicker();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePicker();
  });
}
