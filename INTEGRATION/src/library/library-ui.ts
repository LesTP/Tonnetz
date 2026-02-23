/**
 * Library UI — renders the progression library inside the sidebar Library tab.
 *
 * Phase 2b: Filter tabs (All / Genre / Feature), scrollable card list,
 * expandable accordion cards with Load button.
 */

import { injectCSS, HIDDEN_CLASS } from "rendering-ui";
import type { LibraryEntry } from "./library-types.js";
import { LIBRARY, getGenres, getFeatures } from "./library-data.js";

// ── CSS ──────────────────────────────────────────────────────────────

const STYLE_ID = "library-ui";

const L = {
  filters: "tonnetz-lib-filters",
  filterBtn: "tonnetz-lib-filter-btn",
  filterBtnActive: "tonnetz-lib-filter-btn--active",
  subFilters: "tonnetz-lib-sub-filters",
  subBtn: "tonnetz-lib-sub-btn",
  subBtnActive: "tonnetz-lib-sub-btn--active",
  list: "tonnetz-lib-list",
  card: "tonnetz-lib-card",
  cardExpanded: "tonnetz-lib-card--expanded",
  summary: "tonnetz-lib-summary",
  title: "tonnetz-lib-title",
  meta: "tonnetz-lib-meta",
  badge: "tonnetz-lib-badge",
  composer: "tonnetz-lib-composer",
  preview: "tonnetz-lib-preview",
  detail: "tonnetz-lib-detail",
  comment: "tonnetz-lib-comment",
  chords: "tonnetz-lib-chords",
  loadBtn: "tonnetz-lib-load-btn",
  empty: "tonnetz-lib-empty",
  hidden: HIDDEN_CLASS,
} as const;

const STYLES = `
.${L.filters} {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.${L.filterBtn} {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 500;
  color: #999;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.${L.filterBtn}:hover { color: #555; }
.${L.filterBtnActive} {
  color: #2a9d8f;
  border-bottom-color: #2a9d8f;
}

.${L.subFilters} {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.${L.subBtn} {
  padding: 3px 8px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: #fff;
  font-size: 11px;
  color: #777;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.${L.subBtn}:hover { border-color: #aaa; color: #444; }
.${L.subBtnActive} {
  background: #2a9d8f;
  border-color: #2a9d8f;
  color: #fff;
}

.${L.list} {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.${L.card} {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition: border-color 0.15s;
}
.${L.card}:hover { border-color: #ccc; }

.${L.summary} {
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.${L.title} {
  font-size: 13px;
  font-weight: 600;
  color: #222;
}

.${L.meta} {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #999;
}

.${L.badge} {
  padding: 1px 6px;
  border-radius: 8px;
  background: #f0f0f0;
  font-size: 10px;
  color: #666;
}

.${L.composer} {
  font-style: italic;
}

.${L.preview} {
  font-size: 11px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.${L.detail} {
  display: none;
  padding: 0 10px 10px;
  border-top: 1px solid #f0f0f0;
}
.${L.cardExpanded} .${L.detail} {
  display: block;
}

.${L.comment} {
  font-size: 12px;
  line-height: 1.5;
  color: #555;
  margin: 8px 0;
}

.${L.chords} {
  font-size: 11px;
  font-family: monospace;
  color: #777;
  background: #f8f8f8;
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  word-break: break-word;
}

.${L.loadBtn} {
  width: 100%;
  padding: 6px 0;
  border: none;
  border-radius: 4px;
  background: #2a9d8f;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.${L.loadBtn}:hover { background: #21867a; }

.${L.empty} {
  text-align: center;
  color: #999;
  padding: 24px 0;
  font-size: 13px;
}

.${L.hidden} { display: none !important; }
`;

// ── Helpers ──────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Collapse repeated chords into a space-delimited preview string. */
function chordPreview(chords: readonly string[], maxLen = 40): string {
  const unique: string[] = [];
  let prev = "";
  for (const c of chords) {
    if (c !== prev) { unique.push(c); prev = c; }
  }
  const full = unique.join(" ");
  return full.length > maxLen ? full.slice(0, maxLen - 1) + "…" : full;
}

// ── Types ────────────────────────────────────────────────────────────

export interface LibraryUIOptions {
  /** Container element (the sidebar's library list container). */
  container: HTMLElement;
  /** Called when user loads a progression from the library. */
  onLoad: (entry: LibraryEntry) => void;
}

export interface LibraryUI {
  /** Tear down DOM and listeners. */
  destroy(): void;
}

// ── Factory ──────────────────────────────────────────────────────────

type FilterMode = "all" | "genre" | "feature";

export function createLibraryUI(options: LibraryUIOptions): LibraryUI {
  injectCSS(STYLE_ID, STYLES);

  const { container, onLoad } = options;
  const entries = LIBRARY;
  const genres = getGenres(entries);
  const features = getFeatures(entries);

  let filterMode: FilterMode = "all";
  let selectedGenre: string | null = null;
  let selectedFeature: string | null = null;
  let expandedCardId: string | null = null;

  // ── Filter bar ─────────────────────────────────────────────────────

  const filterBar = el("div", L.filters);
  const allBtn = el("button", `${L.filterBtn} ${L.filterBtnActive}`, { "data-testid": "lib-filter-all" });
  allBtn.textContent = "All";
  const genreBtn = el("button", L.filterBtn, { "data-testid": "lib-filter-genre" });
  genreBtn.textContent = "Genre";
  const featureBtn = el("button", L.filterBtn, { "data-testid": "lib-filter-feature" });
  featureBtn.textContent = "Feature";
  filterBar.appendChild(allBtn);
  filterBar.appendChild(genreBtn);
  filterBar.appendChild(featureBtn);

  // Sub-filter pills (genre tags or feature tags)
  const subFilters = el("div", `${L.subFilters} ${L.hidden}`, { "data-testid": "lib-sub-filters" });

  // Card list
  const list = el("div", L.list, { "data-testid": "lib-card-list" });

  // Empty state
  const emptyEl = el("div", L.empty);
  emptyEl.textContent = "No matching progressions";

  // ── Build cards ────────────────────────────────────────────────────

  const cardEls = new Map<string, HTMLElement>();

  function buildCard(entry: LibraryEntry): HTMLElement {
    const card = el("div", L.card, { "data-entry-id": entry.id, "data-testid": `lib-card-${entry.id}` });

    const summary = el("div", L.summary);
    const titleEl = el("div", L.title);
    titleEl.textContent = entry.title;

    const meta = el("div", L.meta);
    const badge = el("span", L.badge);
    badge.textContent = entry.genre;
    meta.appendChild(badge);
    if (entry.composer) {
      const comp = el("span", L.composer);
      comp.textContent = entry.composer;
      meta.appendChild(comp);
    }

    const preview = el("div", L.preview);
    preview.textContent = chordPreview(entry.chords);

    summary.appendChild(titleEl);
    summary.appendChild(meta);
    summary.appendChild(preview);

    // Detail (expanded)
    const detail = el("div", L.detail);

    const comment = el("div", L.comment);
    comment.textContent = entry.comment;

    const chordsEl = el("div", L.chords);
    chordsEl.textContent = chordPreview(entry.chords, 999);

    const tempoInfo = el("div", L.meta);
    tempoInfo.textContent = `${entry.tempo} BPM · ${entry.harmonicFeature.join(", ")}`;

    const loadBtn = el("button", L.loadBtn, { "data-testid": `lib-load-${entry.id}` });
    loadBtn.textContent = "Load Progression";

    detail.appendChild(comment);
    detail.appendChild(tempoInfo);
    detail.appendChild(chordsEl);
    detail.appendChild(loadBtn);

    card.appendChild(summary);
    card.appendChild(detail);

    // Events
    summary.addEventListener("click", () => {
      if (expandedCardId === entry.id) {
        card.classList.remove(L.cardExpanded);
        expandedCardId = null;
      } else {
        // Collapse previous
        if (expandedCardId) {
          cardEls.get(expandedCardId)?.classList.remove(L.cardExpanded);
        }
        card.classList.add(L.cardExpanded);
        expandedCardId = entry.id;
      }
    });

    loadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onLoad(entry);
    });

    cardEls.set(entry.id, card);
    return card;
  }

  // ── Rendering ──────────────────────────────────────────────────────

  function getFilteredEntries(): readonly LibraryEntry[] {
    if (filterMode === "genre" && selectedGenre) {
      return entries.filter((e) => e.genre === selectedGenre);
    }
    if (filterMode === "feature" && selectedFeature) {
      return entries.filter((e) => e.harmonicFeature.includes(selectedFeature));
    }
    return entries;
  }

  function renderSubFilters(): void {
    subFilters.innerHTML = "";
    if (filterMode === "genre") {
      subFilters.classList.remove(L.hidden);
      for (const g of genres) {
        const btn = el("button", `${L.subBtn}${selectedGenre === g ? ` ${L.subBtnActive}` : ""}`, { "data-value": g });
        btn.textContent = g;
        btn.addEventListener("click", () => {
          selectedGenre = selectedGenre === g ? null : g;
          renderSubFilters();
          renderList();
        });
        subFilters.appendChild(btn);
      }
    } else if (filterMode === "feature") {
      subFilters.classList.remove(L.hidden);
      for (const f of features) {
        const btn = el("button", `${L.subBtn}${selectedFeature === f ? ` ${L.subBtnActive}` : ""}`, { "data-value": f });
        btn.textContent = f;
        btn.addEventListener("click", () => {
          selectedFeature = selectedFeature === f ? null : f;
          renderSubFilters();
          renderList();
        });
        subFilters.appendChild(btn);
      }
    } else {
      subFilters.classList.add(L.hidden);
    }
  }

  function renderList(): void {
    list.innerHTML = "";
    expandedCardId = null;
    const filtered = getFilteredEntries();
    if (filtered.length === 0) {
      list.appendChild(emptyEl);
      return;
    }
    for (const entry of filtered) {
      list.appendChild(buildCard(entry));
    }
  }

  function setFilterMode(mode: FilterMode): void {
    filterMode = mode;
    selectedGenre = null;
    selectedFeature = null;
    allBtn.classList.toggle(L.filterBtnActive, mode === "all");
    genreBtn.classList.toggle(L.filterBtnActive, mode === "genre");
    featureBtn.classList.toggle(L.filterBtnActive, mode === "feature");
    renderSubFilters();
    renderList();
  }

  // ── Events ─────────────────────────────────────────────────────────

  allBtn.addEventListener("click", () => setFilterMode("all"));
  genreBtn.addEventListener("click", () => setFilterMode("genre"));
  featureBtn.addEventListener("click", () => setFilterMode("feature"));

  // ── Mount ──────────────────────────────────────────────────────────

  container.innerHTML = "";
  container.appendChild(filterBar);
  container.appendChild(subFilters);
  container.appendChild(list);

  // Initial render
  renderList();

  // ── Public interface ───────────────────────────────────────────────

  return {
    destroy(): void {
      container.innerHTML = "";
    },
  };
}
