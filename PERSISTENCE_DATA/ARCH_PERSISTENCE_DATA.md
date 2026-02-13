# ARCH_PERSISTENCE_DATA.md

Version: Draft 0.2
Date: 2026-02-12

## 1. Purpose and Scope

Persistence/Data manages:

* local storage of saved progressions and settings
* import/export formats
* URL-share serialization
* schema versioning and migrations

Non-goals: accounts, long-term server storage, analytics.

---

## 2. Storage Backend

**PD-D1: Local storage backend**
Status: Tentative
Options:

* localStorage (simplest; fine for small numbers)
* IndexedDB (recommended if future large libraries or corpus ingestion expected)

Decision may be deferred until Phase 2.

---

## 3. Progression Data Model

### 3.1 Grid-based representation (MVP)

Each progression is stored as a **fixed-grid sequence**, where each array entry corresponds to one grid unit.

```json
{
  "schema_version": 1,
  "id": "uuid",
  "title": "Example",
  "tempo_bpm": 120,
  "grid": "1/4",
  "chords": ["Dm7","G7","Cmaj7","Cmaj7"],
  "notes": ""
}
```

Notes:

* Duration is implicit via repeated tokens
* Grid may be `"1/4"`, `"1/8"`, `"1/3"`, `"1/6"` etc.
* Later schema versions may support explicit durations if needed

**PD-D2: Grid-based encoding**
Status: Closed (MVP)

---

## 4. URL-based Sharing

Payload fields:

* schema_version
* grid
* tempo (optional)
* chords[]

Encoded as:

* JSON → base64url string
* embedded in URL fragment (`/#p=`)

**PD-D3: Compression**
Status: Open (not required for MVP)

---

## 5. Event Stream Storage

Optional future feature for detailed interaction replay.
Status: Deferred / Tentative.

---

## 6. Versioning and Migration

**PD-D4: Migration strategy**
Status: Closed
Decision: best-effort forward migration using schema_version field.

---

## 7. Public API (Module Interface)

```text
saveProgression(prog)
loadProgression(id)
listProgressions()
deleteProgression(id)
encodeShareUrl(prog)
decodeShareUrl(payload)
loadSettings()
saveSettings(partial)
```

---

## 8. Testing Strategy

* save/load round-trip equality
* schema migration tests
* URL encode/decode determinism

---

## 9. Future Extensions

* IndexedDB migration (if MVP starts with localStorage)
* corpus import
* short-link share service
