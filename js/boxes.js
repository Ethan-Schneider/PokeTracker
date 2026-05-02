import { AppState, updateStatsBar, showToast, escapeHtml, pokemonById, getSpriteUrl } from './ui.js';
import { saveCaught } from './store.js';
import { SHINY_LOCKED, REGIONAL_LABELS, statusClass } from './dex.js';

const FALLBACK_IMG = './assets/pokeball.svg';
const BOX_SIZE     = 30;

let allBoxes = null;

function computeBoxes(pokemon) {
  const regular = pokemon.filter(p => !p.region).sort((a, b) => a.id - b.id);
  const boxes = [];

  for (let i = 0; i < regular.length; i += BOX_SIZE) {
    boxes.push({ label: `Box ${boxes.length + 1}`, pokemon: regular.slice(i, i + BOX_SIZE), region: null });
  }

  for (const [region, label] of Object.entries(REGIONAL_LABELS)) {
    const forms = pokemon.filter(p => p.region === region).sort((a, b) => a.id - b.id);
    if (!forms.length) continue;
    for (let i = 0; i < forms.length; i += BOX_SIZE) {
      boxes.push({ label, pokemon: forms.slice(i, i + BOX_SIZE), region });
    }
  }

  return boxes;
}

export function renderBoxes(state) {
  if (!allBoxes) allBoxes = computeBoxes(state.pokemon);

  const isShinyMode = (state.boxMode ?? 'normal') === 'shiny';
  const idx = Math.max(0, Math.min(state.boxIndex ?? 0, allBoxes.length - 1));
  const box = allBoxes[idx];

  document.getElementById('box-label').textContent =
    `${box.label}  (${idx + 1} / ${allBoxes.length})`;

  const cells = [...box.pokemon, ...Array(BOX_SIZE - box.pokemon.length).fill(null)];

  const gridHtml = cells.map(p => {
    if (!p) return `<div class="box-empty-cell"></div>`;

    const locked   = isShinyMode && SHINY_LOCKED.has(p.id);
    const caught   = state.caughtSet.has(p.id);
    const shiny    = state.shinyCaughtSet.has(p.id);
    const sc       = statusClass(caught, shiny, locked);
    const cls      = ['dex-sprite', sc, locked ? 'is-locked' : ''].filter(Boolean).join(' ');
    const imgSrc   = getSpriteUrl(p.id, isShinyMode);
    const safeName = escapeHtml(p.displayName);
    const tip      = locked ? `${safeName} (shiny locked)` : safeName;

    return `<div class="${cls}" data-id="${p.id}" data-action="toggle" title="${tip}">
      <img loading="lazy" src="${imgSrc}" alt="${safeName}"
           onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
    </div>`;
  }).join('');

  document.getElementById('box-grid').innerHTML = gridHtml;
}

export function handleBoxToggle(e) {
  const tile = e.target.closest('.dex-sprite[data-action="toggle"]');
  if (!tile) return;

  const id = Number(tile.dataset.id);
  if (!id) return;

  const isShinyMode = (AppState.boxMode ?? 'normal') === 'shiny';
  if (isShinyMode && SHINY_LOCKED.has(id)) return;

  if (isShinyMode) {
    AppState.shinyCaughtSet.has(id)
      ? AppState.shinyCaughtSet.delete(id)
      : AppState.shinyCaughtSet.add(id);
  } else {
    AppState.caughtSet.has(id)
      ? AppState.caughtSet.delete(id)
      : AppState.caughtSet.add(id);
  }

  saveCaught(AppState.caughtSet, AppState.shinyCaughtSet);

  const caught = AppState.caughtSet.has(id);
  const shiny  = AppState.shinyCaughtSet.has(id);
  const locked = isShinyMode && SHINY_LOCKED.has(id);

  tile.classList.remove('is-caught', 'is-shiny', 'is-both');
  const sc = statusClass(caught, shiny, locked);
  if (sc) tile.classList.add(sc);

  updateStatsBar();

  const name = pokemonById.get(id)?.displayName ?? `#${id}`;
  showToast(isShinyMode
    ? (shiny  ? `${name} shiny marked!`     : `${name} shiny unmarked.`)
    : (caught ? `${name} marked as caught!` : `${name} unmarked.`)
  );
}

export function navigateBox(delta) {
  if (!allBoxes) return;
  AppState.boxIndex = ((AppState.boxIndex ?? 0) + delta + allBoxes.length) % allBoxes.length;
  renderBoxes(AppState);
}

export function resetBoxCache() {
  allBoxes = null;
}
