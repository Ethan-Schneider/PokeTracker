import { AppState, applyFilters, updateStatsBar, showToast, escapeHtml, pokemonById, getSpriteUrl } from './ui.js';
import { saveCaught } from './store.js';

const FALLBACK_IMG = './assets/pokeball.svg';

function typeBadges(types) {
  return types.map(t => `<span class="type-badge ${t}">${t}</span>`).join('');
}

export function renderCards(state) {
  const filtered = applyFilters(
    state.pokemon, state.filters, state.caughtSet, state.shinyCaughtSet
  );

  // Regular Pokémon first (by ID), regional forms at end (by ID)
  const sorted = [
    ...filtered.filter(p => !p.region).sort((a, b) => a.id - b.id),
    ...filtered.filter(p =>  p.region).sort((a, b) => a.id - b.id),
  ];

  const html = sorted.map(p => {
    const caught   = state.caughtSet.has(p.id);
    const shiny    = state.shinyCaughtSet.has(p.id);
    const cardCls  = ['poke-card', caught ? 'card-caught' : '', shiny ? 'card-shiny' : ''].join(' ').trim();
    const safeName = escapeHtml(p.displayName);
    return `
      <article class="${cardCls}" data-id="${p.id}">
        <div class="card-sprites">
          <img loading="lazy" src="${getSpriteUrl(p.id, false)}"
               alt="${safeName} sprite"
               onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
          <div class="sprite-divider"></div>
          <img loading="lazy" src="${getSpriteUrl(p.id, true)}"
               alt="${safeName} shiny sprite"
               onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
        </div>
        <div class="card-number">#${String(p.id).padStart(4, '0')}</div>
        <div class="card-name">${safeName}</div>
        <div class="card-types">${typeBadges(p.types)}</div>
        <div class="card-actions">
          <button class="btn-toggle btn-caught"
                  data-action="toggle-caught"
                  aria-pressed="${caught}"
                  title="Mark as caught">● Caught</button>
          <button class="btn-toggle btn-shiny"
                  data-action="toggle-shiny"
                  aria-pressed="${shiny}"
                  title="Mark shiny as caught">★ Shiny</button>
        </div>
      </article>`;
  }).join('');

  document.getElementById('card-grid').innerHTML = html;
}

export function handleCardToggle(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const card = btn.closest('article[data-id]');
  if (!card)  return;
  const id     = Number(card.dataset.id);
  const action = btn.dataset.action;

  if (action === 'toggle-caught') {
    if (AppState.caughtSet.has(id)) {
      AppState.caughtSet.delete(id);
    } else {
      AppState.caughtSet.add(id);
    }
  } else if (action === 'toggle-shiny') {
    if (AppState.shinyCaughtSet.has(id)) {
      AppState.shinyCaughtSet.delete(id);
    } else {
      AppState.shinyCaughtSet.add(id);
    }
  }

  saveCaught(AppState.caughtSet, AppState.shinyCaughtSet);

  // Partial DOM update
  const caught = AppState.caughtSet.has(id);
  const shiny  = AppState.shinyCaughtSet.has(id);

  card.classList.toggle('card-caught', caught);
  card.classList.toggle('card-shiny',  shiny);

  const caughtBtn = card.querySelector('.btn-caught');
  const shinyBtn  = card.querySelector('.btn-shiny');
  caughtBtn.setAttribute('aria-pressed', String(caught));
  shinyBtn.setAttribute('aria-pressed',  String(shiny));

  updateStatsBar();

  const name = pokemonById.get(id)?.displayName ?? `#${id}`;
  if (action === 'toggle-caught') {
    showToast(caught ? `${name} marked as caught!` : `${name} unmarked.`);
  } else {
    showToast(shiny ? `${name} shiny marked as caught!` : `${name} shiny unmarked.`);
  }
}
