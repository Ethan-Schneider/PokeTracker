let cache = null;

export async function getPokemonList() {
  if (cache) return cache;
  const res = await fetch('./data/pokemon.json');
  if (!res.ok) throw new Error(`Failed to load pokemon.json: ${res.status}`);
  cache = await res.json();
  return cache;
}
