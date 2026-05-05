import { getSpriteUrl } from './ui.js';

const BATCH       = 30;   // sprites per idle callback
const SHINY_DELAY = 1500; // ms before shiny preload begins

/**
 * Batch-preloads all sprite URLs into the browser cache after the initial
 * render is complete.  Uses requestIdleCallback so the main thread is
 * never blocked.  Shiny sprites start after a short delay so normal
 * sprites (the default view) are cached first.
 */
export function preloadAllSprites(pokemon) {
  const ids = pokemon.map(p => p.id);

  function schedule(fn, delay = 0) {
    if (delay) {
      setTimeout(() => schedule(fn), delay);
      return;
    }
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(fn, { timeout: 4000 });
    } else {
      setTimeout(fn, 50);
    }
  }

  function makeBatcher(isShiny) {
    let idx = 0;
    return function batch() {
      const end = Math.min(idx + BATCH, ids.length);
      for (let i = idx; i < end; i++) {
        new Image().src = getSpriteUrl(ids[i], isShiny);
      }
      idx = end;
      if (idx < ids.length) schedule(batch);
    };
  }

  // Normal sprites — start right away (first idle slot after render)
  schedule(makeBatcher(false));

  // Shiny sprites — start after a delay so normal sprites have a head start
  schedule(makeBatcher(true), SHINY_DELAY);
}
