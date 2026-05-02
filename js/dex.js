import { AppState, applyFilters, updateStatsBar, showToast, escapeHtml, pokemonById, getSpriteUrl } from './ui.js';
import { saveCaught } from './store.js';

const FALLBACK_IMG = './assets/pokeball.svg';

const GEN_REGIONS = {
  1: 'Kanto', 2: 'Johto', 3: 'Hoenn',  4: 'Sinnoh', 5: 'Unova',
  6: 'Kalos', 7: 'Alola', 8: 'Galar',  9: 'Paldea',
};

export const REGIONAL_LABELS = {
  alola: 'Alolan Forms',
  galar: 'Galarian Forms',
  hisui: 'Hisuian Forms',
  paldea: 'Paldean Forms',
};

const REGIONS_AFTER_GEN = {
  7: ['alola'],
  8: ['galar', 'hisui'],
  9: ['paldea'],
};

export const SHINY_LOCKED = new Set([
  494, 720, 789, 790, 801, 802, 891, 892, 893, 896, 897, 898,
  1009, 1010, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1024, 1025,
]);

export function statusClass(caught, shiny, locked) {
  if (locked)          return '';
  if (caught && shiny) return 'is-both';
  if (caught)          return 'is-caught';
  if (shiny)           return 'is-shiny';
  return '';
}

function makeSpriteHtml(p, state, isShinyMode) {
  const locked   = isShinyMode && SHINY_LOCKED.has(p.id);
  const caught   = state.caughtSet.has(p.id);
  const shiny    = state.shinyCaughtSet.has(p.id);
  const imgSrc   = getSpriteUrl(p.id, isShinyMode);
  const sc       = statusClass(caught, shiny, locked);
  const cls      = ['dex-sprite', sc, locked ? 'is-locked' : ''].filter(Boolean).join(' ');
  const safeName = escapeHtml(p.displayName);
  const tooltip  = locked ? `${safeName} (shiny locked)` : safeName;
  return `<div class="${cls}" data-id="${p.id}" data-action="toggle" title="${tooltip}">
    <img loading="lazy" src="${imgSrc}" alt="${safeName}"
         onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
  </div>`;
}

function makeSection(label, sublabel, pokemon, state, isShinyMode, countHtml) {
  const spritesHtml = pokemon.map(p => makeSpriteHtml(p, state, isShinyMode)).join('');
  const safeLabel   = escapeHtml(label);
  return `<div class="gen-section" data-section="${label.toLowerCase().replace(/\s+/g, '-')}">
    <div class="gen-header">
      <h2 class="gen-title">${safeLabel}${sublabel ? ` <span class="gen-region">${escapeHtml(sublabel)}</span>` : ''}</h2>
      <div class="gen-stat">${countHtml}</div>
    </div>
    <div class="gen-sprites">${spritesHtml}</div>
  </div>`;
}

export function renderDex(state) {
  const isShinyMode = (state.dexMode ?? 'normal') === 'shiny';

  const visibleIds = new Set(
    applyFilters(state.pokemon, state.filters, state.caughtSet, state.shinyCaughtSet)
      .map(p => p.id)
  );

  const regular = state.pokemon.filter(p => !p.region);
  const byRegion = {};
  for (const p of state.pokemon) {
    if (p.region) {
      if (!byRegion[p.region]) byRegion[p.region] = [];
      byRegion[p.region].push(p);
    }
  }

  const byGen = new Map();
  for (const p of regular) {
    if (!byGen.has(p.generation)) byGen.set(p.generation, []);
    byGen.get(p.generation).push(p);
  }

  const sections = [];
  for (const gen of [...byGen.keys()].sort((a, b) => a - b)) {
    if (state.filters.gen && state.filters.gen !== gen) continue;

    const pokemon = byGen.get(gen);
    if (!pokemon.some(p => visibleIds.has(p.id))) continue;

    const visible      = pokemon.filter(p => visibleIds.has(p.id));
    const caughtCount  = pokemon.filter(p => state.caughtSet.has(p.id)).length;
    const shinyCount   = pokemon.filter(p => state.shinyCaughtSet.has(p.id)).length;
    const shinyTotal   = pokemon.filter(p => !SHINY_LOCKED.has(p.id)).length;

    const countHtml = isShinyMode
      ? `<span class="gen-shiny">${shinyCount} / ${shinyTotal} ★</span>`
      : `<span class="gen-caught">${caughtCount} / ${pokemon.length} ●</span>`;

    sections.push(makeSection(
      `Generation ${gen}`, `— ${GEN_REGIONS[gen] ?? ''}`,
      visible, state, isShinyMode, countHtml
    ));

    for (const region of (REGIONS_AFTER_GEN[gen] ?? [])) {
      const forms = byRegion[region];
      if (!forms?.length) continue;

      const visibleForms = forms.filter(p => visibleIds.has(p.id));
      if (!visibleForms.length) continue;

      const fCaught    = forms.filter(p => state.caughtSet.has(p.id)).length;
      const fShiny     = forms.filter(p => state.shinyCaughtSet.has(p.id)).length;
      const fShinyTotal = forms.filter(p => !SHINY_LOCKED.has(p.id)).length;

      const fCountHtml = isShinyMode
        ? `<span class="gen-shiny">${fShiny} / ${fShinyTotal} ★</span>`
        : `<span class="gen-caught">${fCaught} / ${forms.length} ●</span>`;

      sections.push(makeSection(
        REGIONAL_LABELS[region], null,
        visibleForms, state, isShinyMode, fCountHtml
      ));
    }
  }

  document.getElementById('dex-container').innerHTML = sections.length
    ? sections.join('')
    : '<p style="color:var(--text-muted);padding:2rem">No Pokémon match the current filters.</p>';
}

export function handleDexToggle(e) {
  const tile = e.target.closest('.dex-sprite[data-action="toggle"]');
  if (!tile) return;

  const id = Number(tile.dataset.id);
  if (!id) return;

  const isShinyMode = (AppState.dexMode ?? 'normal') === 'shiny';
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

  tile.classList.remove('is-caught', 'is-shiny', 'is-both');
  const sc = statusClass(caught, shiny, false);
  if (sc) tile.classList.add(sc);

  const section = tile.closest('.gen-section');
  if (section) {
    const sectionId = section.dataset.section;
    // Single-pass: find which region this section belongs to (null = generation section)
    const region = Object.entries(REGIONAL_LABELS).find(
      ([, label]) => label.toLowerCase().replace(/\s+/g, '-') === sectionId
    )?.[0];

    const sectionPokemon = region
      ? AppState.pokemon.filter(p => p.region === region)
      : AppState.pokemon.filter(p => p.generation === (pokemonById.get(id)?.generation ?? 0) && !p.region);

    const caughtCount = sectionPokemon.filter(p => AppState.caughtSet.has(p.id)).length;
    const shinyCount  = sectionPokemon.filter(p => AppState.shinyCaughtSet.has(p.id)).length;
    const shinyTotal  = sectionPokemon.filter(p => !SHINY_LOCKED.has(p.id)).length;
    const statEl = section.querySelector('.gen-stat');
    if (statEl) {
      statEl.innerHTML = isShinyMode
        ? `<span class="gen-shiny">${shinyCount} / ${shinyTotal} ★</span>`
        : `<span class="gen-caught">${caughtCount} / ${sectionPokemon.length} ●</span>`;
    }
  }

  updateStatsBar();

  const name = pokemonById.get(id)?.displayName ?? `#${id}`;
  showToast(isShinyMode
    ? (shiny  ? `${name} shiny marked!`      : `${name} shiny unmarked.`)
    : (caught ? `${name} marked as caught!`  : `${name} unmarked.`)
  );
}
