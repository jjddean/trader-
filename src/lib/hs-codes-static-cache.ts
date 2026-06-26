export interface HsCodeStaticRow {
  code: string;
  desc: string;
}

let cachedRows: HsCodeStaticRow[] | null = null;
let loadPromise: Promise<HsCodeStaticRow[]> | null = null;

export function getCachedHsCodeRows(): HsCodeStaticRow[] | null {
  return cachedRows;
}

/** Load once per session; safe to call from multiple components. */
export function preloadHsCodeRows(): Promise<HsCodeStaticRow[]> {
  if (cachedRows) return Promise.resolve(cachedRows);
  if (!loadPromise) {
    loadPromise = fetch("/hs-codes.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HS codes fetch failed: ${res.status}`);
        return res.json() as Promise<HsCodeStaticRow[]>;
      })
      .then((data) => {
        cachedRows = data;
        return data;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}
