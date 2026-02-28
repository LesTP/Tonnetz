# ARCH_DEPLOYMENT_HOSTING.md

Version: Draft 0.2
Date: 2026-02-28

## 1. Purpose and Scope

This document defines the deployment and hosting approach for the Tonnetz web app, focusing on a **static-first** architecture hosted on an existing rented server alongside a WordPress site. It also identifies decisions that may impact subsystem architecture.

**Non-goals:** server-specific administration, user accounts, user data storage, moderation workflows.

---

## 2. Deployment Goals and Constraints

* Make the app accessible at `https://www.mike-y.com/tonnetz/`.
* Coexist with the existing WordPress site at the domain root without interference.
* Avoid user accounts and long-term user data storage on the server.
* Keep the system portable to future mobile packaging (PWA/wrapper).
* Prefer simple operational burden (copy static files; no backend services).
* Operate within shared hosting constraints (no root access, no Docker, no systemd).

---

## 3. Hosting Model (MVP)

### 3.1 Static-first

MVP ships as a static web app:

* `index.html`
* versioned JS/CSS bundles (hashed filenames)
* static assets (fonts/icons)

Runtime behavior:

* Harmony Core executes fully client-side.
* Persistence is local-only (browser `localStorage`).
* No backend required for core functionality.
* Web Audio API for synthesis (no external audio files).

### 3.2 Hosting target

| Detail               | Value                                              |
| --------------------- | -------------------------------------------------- |
| **Provider**          | SureServer shared hosting                          |
| **Server**            | s501.sureserver.com                                |
| **OS**                | Debian 12 (Bookworm)                               |
| **Web server**        | Apache (with `mod_rewrite`, `.htaccess` supported) |
| **HTTPS**             | Provided by hosting; active on domain              |
| **Shell access**      | Jailed SSH (user `mikey`, no root)                 |
| **Web root**          | `~/www/www/`                                       |
| **App directory**     | `~/www/www/tonnetz/`                               |
| **Public URL**        | `https://www.mike-y.com/tonnetz/`                  |
| **Domain redirects**  | `mike-y.com` → `https://www.mike-y.com/`          |
| **Transfer methods**  | SCP, SFTP, rsync over SSH (port 22)                |

### 3.3 WordPress coexistence

The existing WordPress installation at `~/www/www/` uses this `.htaccess`:

```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
```

The `!-f` and `!-d` conditions mean WordPress only rewrites requests when the target file or directory **does not exist** on disk. Since `~/www/www/tonnetz/` is a real directory, Apache will serve its contents directly. **No modification to the WordPress `.htaccess` is needed.**

### 3.4 Optional future endpoint (explicitly deferred)

A minimal "anonymous share" endpoint (pastebin-style) may be added later:

* stores progression blobs
* returns short IDs
* no accounts

This is **not required** for MVP. See DEP-D1.

---

## 4. Build and Deploy Process

> **Operational runbook:** For step-by-step deploy commands, verification checks, rollback procedure, and troubleshooting, see [DEPLOY.md](./DEPLOY.md).

### 4.1 Build output

The build produces a single deployable directory (`dist/`) containing:

* `index.html`
* hashed asset bundles (`app.[hash].js`, `style.[hash].css`)
* static assets (fonts, icons)
* `.htaccess` (caching and security headers; see §6 and §7)

### 4.2 Base path configuration

Because the app is served from a subdirectory (`/tonnetz/`), the bundler must be configured with the correct base path:

```js
// vite.config.ts
export default defineConfig({
  base: '/tonnetz/',
  // ...
});
```

All asset references (`<script src="...">`, `<link href="...">`, dynamic imports) will be prefixed with `/tonnetz/`. The `index.html` will reference assets as `/tonnetz/app.[hash].js`, etc.

**Architecture impact:** URL-based sharing (Persistence/Data `encodeShareUrl()`) must produce URLs with the `/tonnetz/` path prefix: `https://www.mike-y.com/tonnetz/#p=...`.

### 4.3 Deployment steps

```bash
# 1. Build locally
cd INTEGRATION && npm run build

# 2. Upload dist/ to server
rsync -avz --delete dist/ mikey@s501.sureserver.com:~/www/www/tonnetz/

# 3. Verify
curl -sI https://www.mike-y.com/tonnetz/ | head -10
```

Alternatively, via SCP:

```bash
scp -r dist/* mikey@s501.sureserver.com:~/www/www/tonnetz/
```

**Note:** `rsync --delete` removes files from the server that are no longer in `dist/`, keeping the deployment clean. SCP does not remove stale files and may leave old hashed bundles on the server.

### 4.4 Rollback strategy

Before each deploy, back up the current release:

```bash
# On server (pre-deploy):
cp -r ~/www/www/tonnetz/ ~/www/www/tonnetz-prev/

# To rollback:
rm -rf ~/www/www/tonnetz/
mv ~/www/www/tonnetz-prev/ ~/www/www/tonnetz/
```

Shared hosting does not support atomic symlink swaps. The brief window during `rsync --delete` where files are being replaced is acceptable for a low-traffic MVP.

### 4.5 Deploy script (recommended)

A single deploy script automates the process:

```bash
#!/usr/bin/env bash
# deploy.sh — Deploy Tonnetz to production
set -euo pipefail

SERVER="mikey@s501.sureserver.com"
REMOTE_DIR="~/www/www/tonnetz"
REMOTE_PREV="~/www/www/tonnetz-prev"

echo "Building..."
cd INTEGRATION && npm run build && cd ..

echo "Backing up current release..."
ssh "$SERVER" "rm -rf $REMOTE_PREV; cp -r $REMOTE_DIR $REMOTE_PREV 2>/dev/null || true"

echo "Deploying..."
rsync -avz --delete INTEGRATION/dist/ "$SERVER:$REMOTE_DIR/"

echo "Verifying..."
STATUS=$(curl -sI https://www.mike-y.com/tonnetz/ | head -1)
echo "$STATUS"

if echo "$STATUS" | grep -q "200"; then
  echo "Deploy successful."
else
  echo "WARNING: Unexpected status. Check https://www.mike-y.com/tonnetz/"
  echo "To rollback: ssh $SERVER 'rm -rf $REMOTE_DIR && mv $REMOTE_PREV $REMOTE_DIR'"
fi
```

---

## 5. Versioning Strategy

### 5.1 App version

* Maintain an app version string (semver) embedded in the UI and build metadata.
* The version is displayed in the sidebar About section.

### 5.2 Data schema version

* Persisted progression/event data includes `schema_version`.
* Harmony Core and Persistence module must support forward migration for minor schema changes.

### 5.3 Asset versioning

* All JS/CSS bundles use content-hash filenames (`app.a1b2c3d4.js`).
* `index.html` is the only file that changes path-predictably between releases.
* Old hashed bundles are removed by `rsync --delete` during deployment.

---

## 6. Caching Strategy

### 6.1 Policy

| Asset type           | Cache-Control                              | Rationale                                 |
| -------------------- | ------------------------------------------ | ----------------------------------------- |
| Hashed bundles (JS/CSS) | `public, max-age=31536000, immutable`   | Content-hash guarantees uniqueness        |
| `index.html`         | `no-cache, no-store, must-revalidate`      | Must always fetch latest to pick up new bundles |
| Fonts/icons          | `public, max-age=2592000` (30 days)        | Rarely change; moderate cache             |

### 6.2 Apache `.htaccess` implementation

This file is placed inside `~/www/www/tonnetz/.htaccess` (separate from WordPress's `.htaccess` at the parent level):

```apache
# Tonnetz caching rules

# Hashed JS/CSS bundles — cache forever (immutable)
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # index.html — never cache
  <Files "index.html">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
  </Files>

  # Fonts — cache 30 days
  <FilesMatch "\.(woff2?|ttf|eot)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
</IfModule>
```

**Architecture impact:** The bundler must output hashed filenames (Vite does this by default). The app should tolerate users running slightly different asset versions temporarily during a deploy window.

---

## 7. Security Baseline (MVP)

### 7.1 Transport

* HTTPS enforced by hosting provider (redirect from HTTP → HTTPS).
* Domain redirect: `mike-y.com` → `https://www.mike-y.com/`.

### 7.2 Content Security Policy

The app uses inline SVG, Web Audio API, and no third-party scripts. A restrictive CSP is feasible:

```apache
# Add to ~/www/www/tonnetz/.htaccess
<IfModule mod_headers.c>
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'"
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "DENY"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

Notes:
* `style-src 'unsafe-inline'` is needed for inline SVG styles. Can be tightened with nonces if a build step is added.
* `media-src 'none'` is correct — Audio Engine uses `AudioContext` (Web Audio API), not `<audio>` elements.
* No third-party scripts, analytics, or CDN resources are loaded.

### 7.3 Future endpoint protections (deferred)

If optional endpoints are added later (DEP-D1):

* rate limiting
* request size limits
* basic abuse protections

---

## 8. Observability (minimal)

### 8.1 MVP

* Apache access logs (managed by hosting provider) are sufficient for traffic monitoring.
* Client-side errors are visible in browser developer tools.
* No analytics or telemetry in MVP.

### 8.2 Future (opt-in)

* Optional client-side error logging can be added later.
* Lightweight privacy-respecting analytics (e.g., Plausible, self-hosted) could be considered.

**Constraint:** avoid collecting personally identifying user data unless explicitly intended.

---

## 9. Offline and Installability

### 9.1 Current state (MVP)

MVP does **not** include PWA features:

* No service worker.
* No `manifest.json`.
* The app requires a network connection to load.

### 9.2 PWA readiness (post-MVP)

The architecture supports adding PWA capabilities without changes to Harmony Core or subsystem interfaces:

* **Service worker:** precache hashed bundles + `index.html` with network-first strategy.
* **Manifest:** standard `manifest.json` with app name, icons, `start_url: /tonnetz/`, `display: standalone`.
* **Offline storage:** `localStorage` persistence already works offline; only initial page load requires network.

**Architecture impact:** Adding PWA affects build pipeline only (generate service worker, include manifest). No changes to Harmony Core, Audio Engine, or Persistence/Data logic.

---

## 10. Decisions

### DEP-D1: Sharing mechanism

```
Date: 2026-02-12
Status: Closed
Priority: Important
Decision:
MVP uses URL-hash sharing (Option A). Progressions are encoded into the URL fragment:
  https://www.mike-y.com/tonnetz/#p=...
No server-side storage required.
Option B (short-link service with anonymous blob storage) is deferred to post-MVP.
Architecture impact:
Persistence module's encodeShareUrl() must use /tonnetz/ base path.
```

### DEP-D2: Offline / installability

```
Date: 2026-02-12, updated 2026-02-28
Status: Deferred to post-MVP
Priority: Minor
Decision:
MVP ships without PWA features. The static architecture supports adding service worker
and manifest post-MVP without subsystem changes. See §9.
```

### DEP-D3: Cross-platform packaging plan

```
Date: 2026-02-12
Status: Deferred
Priority: Minor
Decision:
Future wrapper-based mobile app (Capacitor/TWA/etc.) remains a possibility.
Architecture impact: Harmony Core and data model are UI-agnostic; Audio Engine uses
Web Audio API (supported by Capacitor WebView). No browser-only assumptions outside
Audio/UI layers.
```

### DEP-D4: WordPress coexistence

```
Date: 2026-02-28
Status: Closed
Priority: Critical
Decision:
Tonnetz is deployed to ~/www/www/tonnetz/ as a self-contained static directory.
WordPress's mod_rewrite rules (!-f, !-d) ensure no conflict. The Tonnetz directory
has its own .htaccess for caching and security headers, independent of WordPress.
No WordPress configuration changes are required.
```

---

## 11. First Deploy Checklist

- [ ] Configure bundler `base: '/tonnetz/'`
- [ ] Verify `encodeShareUrl()` produces URLs with `/tonnetz/` prefix
- [ ] Build and verify `dist/` contains `index.html`, hashed bundles, `.htaccess`
- [ ] Create `~/www/www/tonnetz/` directory on server
- [ ] Upload `dist/` contents via rsync or scp
- [ ] Verify `https://www.mike-y.com/tonnetz/` loads correctly
- [ ] Verify caching headers on hashed assets (`Cache-Control: immutable`)
- [ ] Verify `index.html` is not cached (`Cache-Control: no-cache`)
- [ ] Verify CSP header is present and not blocking Web Audio
- [ ] Test URL sharing: generate share link → open in new browser → progression loads
- [ ] Test on mobile browser (responsive layout, touch interaction, audio playback)

---

## 12. Summary

The Tonnetz MVP is deployed as a static site at `https://www.mike-y.com/tonnetz/` on SureServer shared hosting (Apache). It coexists with the existing WordPress site without configuration conflicts. Deployment is a simple `rsync` of the `dist/` directory. Caching is enforced via a subdirectory `.htaccess` with immutable hashed bundles and no-cache `index.html`. Security headers include CSP, X-Frame-Options, and nosniff. Backend endpoints, PWA features, and mobile packaging are deferred to post-MVP. Key architectural hooks are the `/tonnetz/` base path in the bundler and URL-serializable progressions in the Persistence module.
