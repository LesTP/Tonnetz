# ARCH_DEPLOYMENT_HOSTING.md

Version: Draft 0.1
Date: 2026-02-12

## 1. Purpose and Scope

This document defines the deployment and hosting approach for the Tonnetz web app, focusing on a **static-first** architecture hosted on a rented server. It also identifies decisions that may impact subsystem architecture.

**Non-goals:** server-specific instructions, user accounts, user data storage, moderation workflows.

---

## 2. Deployment Goals and Constraints

* Make the app accessible via a public URL.
* Avoid user accounts and long-term user data storage on the server.
* Keep the system portable to future mobile packaging (PWA/wrapper).
* Prefer simple operational burden (copy static files; minimal services).

---

## 3. Hosting Model (MVP)

### 3.1 Static-first

MVP ships as a static web app:

* `index.html`
* versioned JS/CSS bundles
* static assets (fonts/icons)

Runtime behavior:

* Harmony Core executes fully client-side.
* Persistence is local-only (browser storage).
* No backend required for core functionality.

### 3.2 Optional future endpoint (explicitly deferred)

A minimal “anonymous share” endpoint (pastebin-style) may be added later:

* stores progression blobs
* returns short IDs
* no accounts

This is **not required** for MVP.

---

## 4. Release and Build Process (framework)

### 4.1 Build output

A build produces a single deployable directory (e.g., `dist/`) containing:

* `index.html`
* hashed asset bundles (`app.[hash].js`, etc.)
* static assets

### 4.2 Deployment mechanism (server-agnostic)

Deployment is conceptually:

1. Build locally or via CI
2. Upload `dist/` to server web root (or versioned release directory)
3. Switch active release (symlink/atomic swap recommended)
4. Verify health by loading the site and running a smoke test

---

## 5. Versioning Strategy

### 5.1 App version

* Maintain an app version string (e.g., semver) embedded in the UI and build metadata.

### 5.2 Data schema version

* Persisted progression/event data includes `schema_version`.
* Harmony Core and Persistence module must support forward migration for minor schema changes.

---

## 6. Caching Strategy (important)

Recommended default:

* **Hashed bundles:** cache long (immutable)
* **index.html:** cache short (or no-cache) so users pick up new releases
* **JSON assets (if any):** cache based on update frequency

**Architecture impact:** bundler must output hashed filenames (standard), and app should tolerate users running slightly different asset versions temporarily.

---

## 7. Security Baseline (MVP)

Even static-only deployments should target:

* HTTPS
* sensible Content Security Policy (CSP) (can start permissive, tighten later)
* no third-party scripts by default

If optional endpoints are added later:

* rate limiting
* request size limits
* basic abuse protections

---

## 8. Observability (minimal)

MVP:

* server access logs are sufficient
* optional client-side error logging can be added later (opt-in)

**Constraint:** avoid collecting personally identifying user data unless explicitly intended.

---

## 9. Decisions Needed and Architectural Implications

### DEP-D1: Sharing mechanism in MVP

* **Option A (recommended):** encode progressions into URL hash/query (no server storage)
* Option B (later): short-link service storing anonymous blobs

**Architecture impact:** Persistence module should support a compact, versioned, URL-serializable representation.

### DEP-D2: Offline / installability

* Decide whether MVP should be PWA-installable.
* If yes: service worker, asset caching rules, offline storage expectations.

**Architecture impact:** affects build pipeline and caching, but not Harmony Core logic.

### DEP-D3: Cross-platform packaging plan

* Future: wrapper-based mobile app (Capacitor/TWA/etc.)

**Architecture impact:** keep Harmony Core and data model UI-agnostic; avoid browser-only assumptions outside Audio/UI layers.

---

## 10. Summary

MVP should be deployed as a static site on an existing rented server with local-only persistence and (optionally) URL-based sharing. Backend endpoints are deferred. Key architectural hooks are versioned data formats and URL-serializable progressions.
