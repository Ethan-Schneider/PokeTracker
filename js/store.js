const DATA_KEY = 'pokemonTrackerData';
const UI_KEY   = 'pokemonTrackerUIState';
export const HUNT_SLOTS = 9;

function emptyData() {
  return { version: 1, caught: [], shinyCaught: [], hunting: new Array(HUNT_SLOTS).fill(null) };
}

function readData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.caught) || !Array.isArray(parsed.shinyCaught)) {
      throw new Error('Invalid schema');
    }
    if (!Array.isArray(parsed.hunting)) parsed.hunting = new Array(HUNT_SLOTS).fill(null);
    return parsed;
  } catch {
    return emptyData();
  }
}

function writeData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function loadTrackerData() {
  const data = readData();
  return {
    caughtSet:      new Set(data.caught),
    shinyCaughtSet: new Set(data.shinyCaught),
    hunting:        data.hunting,
  };
}

export function saveCaught(caughtSet, shinyCaughtSet) {
  const data = readData();
  data.caught      = [...caughtSet].sort((a, b) => a - b);
  data.shinyCaught = [...shinyCaughtSet].sort((a, b) => a - b);
  writeData(data);
}

export function saveHunting(huntingArr) {
  const data = readData();
  data.hunting = huntingArr;
  writeData(data);
}

export function exportJSON() {
  const raw = localStorage.getItem(DATA_KEY) ?? JSON.stringify(emptyData());
  const blob = new Blob([raw], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pokemon-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.caught) || !Array.isArray(data.shinyCaught)) {
          throw new Error('Missing caught or shinyCaught arrays');
        }
        const validId = id => Number.isInteger(id) && id > 0 && id <= 20000;
        if (!data.caught.every(validId) || !data.shinyCaught.every(validId)) {
          throw new Error('Invalid Pokémon IDs in data');
        }
        writeData({
          version:     data.version ?? 1,
          caught:      data.caught,
          shinyCaught: data.shinyCaught,
          hunting:     Array.isArray(data.hunting) ? data.hunting : new Array(HUNT_SLOTS).fill(null),
        });
        resolve();
      } catch (err) {
        reject(new Error(`Invalid import file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function resetAll() {
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(UI_KEY);
}

export function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUIState(state) {
  localStorage.setItem(UI_KEY, JSON.stringify(state));
}
