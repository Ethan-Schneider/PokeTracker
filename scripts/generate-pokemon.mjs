/**
 * Run once with: node scripts/generate-pokemon.mjs
 * Fetches all Gen 1-9 Pokémon + regional forms from PokeAPI
 * and writes data/pokemon.json.
 * Takes ~12-15 minutes total due to rate-limit delays.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH  = join(__dirname, '..', 'data', 'pokemon.json');
const TOTAL     = 1025;
const DELAY_MS  = 250;

const GENERATION_MAP = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3,
  'generation-iv': 4, 'generation-v': 5,  'generation-vi': 6,
  'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9,
};

const REGION_GENERATION = { alola: 7, galar: 8, hisui: 8, paldea: 9 };

// Regional form slugs grouped by region
const REGIONAL_FORMS = {
  alola: [
    'rattata-alola', 'raticate-alola', 'raichu-alola',
    'sandshrew-alola', 'sandslash-alola', 'vulpix-alola', 'ninetales-alola',
    'diglett-alola', 'dugtrio-alola', 'meowth-alola', 'persian-alola',
    'geodude-alola', 'graveler-alola', 'golem-alola',
    'grimer-alola', 'muk-alola', 'exeggutor-alola', 'marowak-alola',
  ],
  galar: [
    'meowth-galar', 'ponyta-galar', 'rapidash-galar',
    'slowpoke-galar', 'slowbro-galar', 'slowking-galar',
    'farfetchd-galar', 'weezing-galar', 'mr-mime-galar',
    'corsola-galar', 'zigzagoon-galar', 'linoone-galar',
    'darumaka-galar', 'darmanitan-galar-standard',
    'yamask-galar', 'stunfisk-galar',
    'articuno-galar', 'zapdos-galar', 'moltres-galar',
  ],
  hisui: [
    'growlithe-hisui', 'arcanine-hisui',
    'voltorb-hisui', 'electrode-hisui',
    'typhlosion-hisui', 'qwilfish-hisui', 'sneasel-hisui',
    'dialga-origin', 'palkia-origin',
    'zorua-hisui', 'zoroark-hisui',
    'braviary-hisui', 'sliggoo-hisui', 'goodra-hisui',
    'avalugg-hisui', 'decidueye-hisui',
    'samurott-hisui', 'lilligant-hisui',
  ],
  paldea: [
    'wooper-paldea',
    'tauros-paldea-combat', 'tauros-paldea-blaze', 'tauros-paldea-aqua',
  ],
};

const DISPLAY_NAME_OVERRIDES = {
  // Base Pokémon edge cases
  'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime', 'mime-jr': 'Mime Jr.', 'mr-rime': 'Mr. Rime',
  'farfetchd': "Farfetch'd", 'sirfetchd': "Sirfetch'd",
  'flabebe': 'Flabébé', 'type-null': 'Type: Null',
  'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o',
  'tapu-koko': 'Tapu Koko', 'tapu-lele': 'Tapu Lele',
  'tapu-bulu': 'Tapu Bulu', 'tapu-fini': 'Tapu Fini',
  'porygon-z': 'Porygon-Z', 'ho-oh': 'Ho-Oh',
  'chi-yu': 'Chi-Yu', 'chien-pao': 'Chien-Pao',
  'ting-lu': 'Ting-Lu', 'wo-chien': 'Wo-Chien',
  // Regional form display names
  'rattata-alola':           'Alolan Rattata',
  'raticate-alola':          'Alolan Raticate',
  'raichu-alola':            'Alolan Raichu',
  'sandshrew-alola':         'Alolan Sandshrew',
  'sandslash-alola':         'Alolan Sandslash',
  'vulpix-alola':            'Alolan Vulpix',
  'ninetales-alola':         'Alolan Ninetales',
  'diglett-alola':           'Alolan Diglett',
  'dugtrio-alola':           'Alolan Dugtrio',
  'meowth-alola':            'Alolan Meowth',
  'persian-alola':           'Alolan Persian',
  'geodude-alola':           'Alolan Geodude',
  'graveler-alola':          'Alolan Graveler',
  'golem-alola':             'Alolan Golem',
  'grimer-alola':            'Alolan Grimer',
  'muk-alola':               'Alolan Muk',
  'exeggutor-alola':         'Alolan Exeggutor',
  'marowak-alola':           'Alolan Marowak',
  'meowth-galar':            'Galarian Meowth',
  'ponyta-galar':            'Galarian Ponyta',
  'rapidash-galar':          'Galarian Rapidash',
  'slowpoke-galar':          'Galarian Slowpoke',
  'slowbro-galar':           'Galarian Slowbro',
  'slowking-galar':          'Galarian Slowking',
  'farfetchd-galar':         "Galarian Farfetch'd",
  'weezing-galar':           'Galarian Weezing',
  'mr-mime-galar':           'Galarian Mr. Mime',
  'corsola-galar':           'Galarian Corsola',
  'zigzagoon-galar':         'Galarian Zigzagoon',
  'linoone-galar':           'Galarian Linoone',
  'darumaka-galar':          'Galarian Darumaka',
  'darmanitan-galar-standard': 'Galarian Darmanitan',
  'yamask-galar':            'Galarian Yamask',
  'stunfisk-galar':          'Galarian Stunfisk',
  'articuno-galar':          'Galarian Articuno',
  'zapdos-galar':            'Galarian Zapdos',
  'moltres-galar':           'Galarian Moltres',
  'growlithe-hisui':         'Hisuian Growlithe',
  'arcanine-hisui':          'Hisuian Arcanine',
  'voltorb-hisui':           'Hisuian Voltorb',
  'electrode-hisui':         'Hisuian Electrode',
  'typhlosion-hisui':        'Hisuian Typhlosion',
  'qwilfish-hisui':          'Hisuian Qwilfish',
  'sneasel-hisui':           'Hisuian Sneasel',
  'dialga-origin':           'Origin Forme Dialga',
  'palkia-origin':           'Origin Forme Palkia',
  'zorua-hisui':             'Hisuian Zorua',
  'zoroark-hisui':           'Hisuian Zoroark',
  'braviary-hisui':          'Hisuian Braviary',
  'sliggoo-hisui':           'Hisuian Sliggoo',
  'goodra-hisui':            'Hisuian Goodra',
  'avalugg-hisui':           'Hisuian Avalugg',
  'decidueye-hisui':         'Hisuian Decidueye',
  'samurott-hisui':          'Hisuian Samurott',
  'lilligant-hisui':         'Hisuian Lilligant',
  'wooper-paldea':           'Paldean Wooper',
  'tauros-paldea-combat':    'Paldean Tauros (Combat)',
  'tauros-paldea-blaze':     'Paldean Tauros (Blaze)',
  'tauros-paldea-aqua':      'Paldean Tauros (Aqua)',
};

function toDisplayName(slug) {
  if (DISPLAY_NAME_OVERRIDES[slug]) return DISPLAY_NAME_OVERRIDES[slug];
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchPokemon(id) {
  const [pokemon, species] = await Promise.all([
    fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`),
    fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);
  return {
    id,
    name:        pokemon.name,
    displayName: toDisplayName(pokemon.name),
    generation:  GENERATION_MAP[species.generation.name] ?? 0,
    types:       pokemon.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
  };
}

async function fetchRegionalForm(slug, region) {
  const pokemon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${slug}`);
  return {
    id:          pokemon.id,
    name:        slug,
    displayName: toDisplayName(slug),
    generation:  REGION_GENERATION[region],
    region,
    types:       pokemon.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
  };
}

async function main() {
  const results = [];
  const errors  = [];
  const startTime = Date.now();

  // ── Regular Pokémon (IDs 1–1025) ────────────────────────
  console.log(`Fetching ${TOTAL} base Pokémon from PokeAPI...`);
  for (let id = 1; id <= TOTAL; id++) {
    try {
      results.push(await fetchPokemon(id));
      if (id % 50 === 0 || id === TOTAL) {
        const s = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  ${id}/${TOTAL} (${((id/TOTAL)*100).toFixed(1)}%) — ${s}s`);
      }
    } catch (err) {
      console.warn(`  WARN: failed ID ${id}: ${err.message}`);
      errors.push(`id:${id}`);
    }
    if (id < TOTAL) await sleep(DELAY_MS);
  }

  // ── Regional forms ───────────────────────────────────────
  const allSlugs = Object.entries(REGIONAL_FORMS).flatMap(([region, slugs]) =>
    slugs.map(slug => ({ slug, region }))
  );
  console.log(`\nFetching ${allSlugs.length} regional forms...`);
  for (const { slug, region } of allSlugs) {
    try {
      results.push(await fetchRegionalForm(slug, region));
      console.log(`  ✓ ${slug}`);
    } catch (err) {
      console.warn(`  WARN: failed ${slug}: ${err.message}`);
      errors.push(slug);
    }
    await sleep(DELAY_MS);
  }

  if (errors.length) {
    console.warn(`\nFailed (${errors.length}): ${errors.join(', ')}`);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  const mins = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone! Wrote ${results.length} entries to data/pokemon.json (${mins} min)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
