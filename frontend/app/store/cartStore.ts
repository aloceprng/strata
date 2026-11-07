import { reconcile, seedCart, type Cart, type Catalogue } from "./catalogue";

/**
 * The browser-only basket, one per brand, kept in localStorage. It lives outside React
 * so every page and tab reads the same cart; components subscribe with useSyncExternalStore.
 */

type Listener = () => void;
type Entry = { cart: Cart; catalogue: Catalogue; listeners: Set<Listener> };

const entries = new Map<string, Entry>();
const storageKey = (brand: string) => `strata:${brand}:cart:v1`;

function read(brand: string, catalogue: Catalogue): Cart {
  try {
    const raw = window.localStorage.getItem(storageKey(brand));
    if (raw) return reconcile(JSON.parse(raw) as Cart, catalogue);
  } catch {
    // Unreadable or blocked storage: start from the catalogue's sample basket.
  }
  return seedCart(catalogue);
}

function entry(brand: string, catalogue: Catalogue): Entry {
  let found = entries.get(brand);
  if (!found) {
    found = { cart: read(brand, catalogue), catalogue, listeners: new Set() };
    entries.set(brand, found);
  } else if (found.catalogue !== catalogue) {
    // A newer catalogue (another page, or the preview's late load): re-read against it.
    found.cart = read(brand, catalogue);
    found.catalogue = catalogue;
  }
  return found;
}

export function cartStore(brand: string, catalogue: Catalogue) {
  const server = seedCart(catalogue);
  return {
    subscribe(listener: Listener) {
      const { listeners } = entry(brand, catalogue);
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== storageKey(brand)) return;
        entry(brand, catalogue).cart = read(brand, catalogue);
        listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: () => entry(brand, catalogue).cart,
    /** The server, and the first client render, show the sample basket so hydration matches. */
    getServerSnapshot: () => server,
    update(change: (cart: Cart) => Cart) {
      const current = entry(brand, catalogue);
      current.cart = change(current.cart);
      try {
        window.localStorage.setItem(storageKey(brand), JSON.stringify(current.cart));
      } catch {
        // Private mode or full storage: the basket still works for this visit.
      }
      current.listeners.forEach((listener) => listener());
    },
  };
}

/** For tests: forget every in-memory basket. */
export function resetCarts() {
  entries.clear();
}
