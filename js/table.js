import { AppState, applyFilters, updateStatsBar, showToast } from './ui.js';
import { saveCaught } from './store.js';

const SPRITE_BASE  = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const FALLBACK_IMG = './assets/pokeball.svg';

function spriteUrl(id)       { return `${SPRITE_BASE}/${id}.png`; }
function shinySpriteUrl(id)  { return `${SPRITE_BASE}/shiny/${id}.png`; }

function typeBadges(types) {
  return types.map(t => `<span class="type-badge ${t}">${t}</span>`).join('');
}

function sortPokemon(list, sort) {
  const [field, dir] = sort.split('-');
  const asc = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (field === 'id')     return (a.id - b.id) * asc;
    if (field === 'name')   return a.displayName.localeCompare(b.displayName) * asc;
    if (field === 'gen')    return (a.generation - b.generation) * asc;
    if (field === 'caught') {
      const ac = AppState.caughtSet.has(a.id) ? 1 : 0;
      const bc = AppState.caughtSet.has(b.id) ? 1 : 0;
      return (bc - ac) * asc;
    }
    if (field === 'shiny') {
      const as = AppState.shinyCaughtSet.has(a.id) ? 1 : 0;
      const bs = AppState.shinyCaughtSet.has(b.id) ? 1 : 0;
      return (bs - as) * asc;
    }
    return 0;
  });
}

export function renderTable(state) {
  const filtered = applyFilters(
    state.pokemon, state.filters, state.caughtSet, state.shinyCaughtSet
  );
  const sorted   = sortPokemon(filtered, state.sort);

  // Update sort indicators on headers
  document.querySelectorAll('#pokemon-table th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const [field, dir] = state.sort.split('-');
    if (th.dataset.sort === field) {
      th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  const html = sorted.map(p => {
    const caught = state.caughtSet.has(p.id);
    const shiny  = state.shinyCaughtSet.has(p.id);
    const rowCls = [caught ? 'row-caught' : '', shiny ? 'row-shiny' : ''].join(' ').trim();
    return `
      <tr data-id="${p.id}" class="${rowCls}">
        <td class="id-cell">#${String(p.id).padStart(4, '0')}</td>
        <td class="sprite-cell">
          <img loading="lazy" src="${spriteUrl(p.id)}"
               alt="${p.displayName} sprite"
               onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
        </td>
        <td class="sprite-cell">
          <img loading="lazy" src="${shinySpriteUrl(p.id)}"
               alt="${p.displayName} shiny sprite"
               onerror="this.src='${FALLBACK_IMG}';this.onerror=null">
        </td>
        <td class="name-cell">${p.displayName}</td>
        <td class="gen-cell">${p.generation}</td>
        <td class="types-cell">${typeBadges(p.types)}</td>
        <td class="toggle-cell">
          <button class="btn-toggle btn-caught"
                  data-action="toggle-caught"
                  aria-pressed="${caught}"
                  title="Mark as caught">●</button>
        </td>
        <td class="toggle-cell">
          <button class="btn-toggle btn-shiny"
                  data-action="toggle-shiny"
                  aria-pressed="${shiny}"
                  title="Mark shiny as caught">★</button>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('table-body').innerHTML = html;
}

export function handleTableToggle(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row  = btn.closest('tr[data-id]');
  if (!row)  return;
  const id     = Number(row.dataset.id);
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

  // Partial DOM update — no full re-render
  const caught = AppState.caughtSet.has(id);
  const shiny  = AppState.shinyCaughtSet.has(id);

  row.classList.toggle('row-caught', caught);
  row.classList.toggle('row-shiny',  shiny);

  const caughtBtn = row.querySelector('.btn-caught');
  const shinyBtn  = row.querySelector('.btn-shiny');
  caughtBtn.setAttribute('aria-pressed', String(caught));
  shinyBtn.setAttribute('aria-pressed',  String(shiny));

  updateStatsBar();

  // Find the Pokémon name for the toast
  const p = AppState.pokemon.find(x => x.id === id);
  const name = p?.displayName ?? `#${id}`;
  if (action === 'toggle-caught') {
    showToast(caught ? `${name} marked as caught!` : `${name} unmarked.`);
  } else {
    showToast(shiny ? `${name} shiny marked as caught!` : `${name} shiny unmarked.`);
  }
}
