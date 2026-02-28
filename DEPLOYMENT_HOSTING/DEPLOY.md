# DEPLOY.md — Tonnetz Deployment Runbook

Version: 1.0
Date: 2026-02-28

This is the operational deployment guide. For architecture decisions, hosting details, and caching/security design, see [ARCH_DEPLOYMENT_HOSTING.md](./ARCH_DEPLOYMENT_HOSTING.md).

---

## Quick Reference

```
cd INTEGRATION && npm run build        # build
npm run preview                        # test locally at localhost:4173/tonnetz/
rsync -avz --delete dist/ mikey@s501.sureserver.com:~/www/www/tonnetz/   # deploy
```

---

## Prerequisites (one-time setup)

### 1. Vite base path

`INTEGRATION/vite.config.ts` must include `base: '/tonnetz/'`:

```ts
export default defineConfig({
  base: '/tonnetz/',
  // ...
});
```

This prefixes all asset references with `/tonnetz/` so that `index.html` loads bundles from `/tonnetz/assets/index.[hash].js` instead of `/assets/index.[hash].js`.

### 2. `.htaccess` file

Create `INTEGRATION/public/.htaccess` so Vite copies it into `dist/` during build:

```apache
# Tonnetz — caching and security headers
# Deployed to ~/www/www/tonnetz/.htaccess on server

# --- Caching ---

<IfModule mod_headers.c>
  # Hashed JS/CSS bundles — cache forever (content-hash guarantees uniqueness)
  <FilesMatch "\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # index.html — never cache (must always fetch latest to pick up new bundles)
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

# --- Security ---

<IfModule mod_headers.c>
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'"
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "DENY"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

Vite automatically copies everything in `public/` into `dist/` at build time.

### 3. SSH key access

Ensure passwordless SSH is configured for the server:

```bash
ssh mikey@s501.sureserver.com "echo ok"
```

If this prompts for a password, set up key-based auth first:

```bash
ssh-copy-id mikey@s501.sureserver.com
```

### 4. Create the tonnetz directory on the server (first deploy only)

```bash
ssh mikey@s501.sureserver.com "mkdir -p ~/www/www/tonnetz"
```

---

## Deployment Steps

### Step 1: Build

```bash
cd INTEGRATION
npm run build
```

This produces `INTEGRATION/dist/` containing:

```
dist/
├── index.html              ← entry point (no-cache)
├── .htaccess               ← caching + security headers
└── assets/
    └── index.[hash].js     ← hashed bundle (cache immutable)
```

Verify the build:

```bash
ls -la dist/
cat dist/index.html | head -5    # should reference /tonnetz/assets/...
```

The `index.html` asset references should start with `/tonnetz/`:

```html
<script type="module" src="/tonnetz/assets/index.abc123.js"></script>
```

If they start with just `/assets/...`, the `base` config is missing (see Prerequisites §1).

### Step 2: Test locally

```bash
npm run preview
```

Opens at `http://localhost:4173/tonnetz/`. **Important:** the trailing slash is required in the Vite preview server — visiting `/tonnetz` (no slash) will show an error. This does not affect production: Apache's `mod_dir` automatically redirects `/tonnetz` → `/tonnetz/`.

Verify:

- [ ] Page loads without console errors
- [ ] Lattice renders and is interactive
- [ ] Chord playback works (tap a triangle)
- [ ] Progression input works (paste `Dm7 G7 Cmaj7`)
- [ ] Share URL generates with `/tonnetz/` in the path
- [ ] Library loads curated progressions

Press `Ctrl+C` to stop the preview server.

### Step 3: Backup current version (skip on first deploy)

```bash
ssh mikey@s501.sureserver.com "rm -rf ~/www/www/tonnetz-prev && cp -r ~/www/www/tonnetz ~/www/www/tonnetz-prev"
```

### Step 4: Deploy

```bash
rsync -avz --delete dist/ mikey@s501.sureserver.com:~/www/www/tonnetz/
```

Flags:
- `-a` — archive mode (preserves permissions, timestamps)
- `-v` — verbose (shows files transferred)
- `-z` — compress during transfer
- `--delete` — removes server files not in local `dist/` (cleans up old hashed bundles)

**Alternative** (if rsync is unavailable):

```bash
scp -r dist/* mikey@s501.sureserver.com:~/www/www/tonnetz/
```

Note: `scp` does not remove stale files. Old hashed bundles will accumulate on the server. Run periodic cleanup manually if using `scp`.

### Step 5: Verify production

```bash
# Check HTTP status
curl -sI https://www.mike-y.com/tonnetz/ | head -5

# Check caching headers on hashed bundle
BUNDLE=$(curl -s https://www.mike-y.com/tonnetz/ | grep -oP 'assets/index\.[a-f0-9]+\.js')
curl -sI "https://www.mike-y.com/tonnetz/$BUNDLE" | grep -i cache-control

# Check index.html is not cached
curl -sI https://www.mike-y.com/tonnetz/ | grep -i cache-control

# Check CSP header
curl -sI https://www.mike-y.com/tonnetz/ | grep -i content-security-policy
```

Expected results:

| Check | Expected |
|-------|----------|
| HTTP status | `200 OK` |
| Bundle cache | `Cache-Control: public, max-age=31536000, immutable` |
| index.html cache | `Cache-Control: no-cache, no-store, must-revalidate` |
| CSP | `default-src 'self'; script-src 'self'; ...` |

Then open `https://www.mike-y.com/tonnetz/` in a browser and repeat the same checks from Step 2.

---

## Rollback

If a deploy breaks the site:

```bash
ssh mikey@s501.sureserver.com "rm -rf ~/www/www/tonnetz && mv ~/www/www/tonnetz-prev ~/www/www/tonnetz"
```

Verify the rollback:

```bash
curl -sI https://www.mike-y.com/tonnetz/ | head -5
```

Note: after rollback, `tonnetz-prev/` no longer exists. The next deploy will need to re-create the backup.

---

## Deploy Script

For convenience, save this as `deploy.sh` in the project root:

```bash
#!/usr/bin/env bash
# deploy.sh — Build and deploy Tonnetz to production
set -euo pipefail

SERVER="mikey@s501.sureserver.com"
REMOTE_DIR="~/www/www/tonnetz"
REMOTE_PREV="~/www/www/tonnetz-prev"
URL="https://www.mike-y.com/tonnetz/"

echo "=== Building ==="
cd INTEGRATION && npm run build && cd ..

echo ""
echo "=== Checking build output ==="
if ! grep -q '/tonnetz/' INTEGRATION/dist/index.html; then
  echo "ERROR: base path /tonnetz/ not found in index.html. Check vite.config.ts base setting."
  exit 1
fi
echo "Build looks good."

echo ""
echo "=== Backing up current version ==="
ssh "$SERVER" "rm -rf $REMOTE_PREV; cp -r $REMOTE_DIR $REMOTE_PREV 2>/dev/null || echo 'No previous version to back up (first deploy).'"

echo ""
echo "=== Deploying ==="
rsync -avz --delete INTEGRATION/dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Verifying ==="
STATUS=$(curl -sI "$URL" | head -1)
echo "HTTP response: $STATUS"

if echo "$STATUS" | grep -q "200"; then
  echo ""
  echo "Deploy successful: $URL"
else
  echo ""
  echo "WARNING: Unexpected HTTP status."
  echo "Check: $URL"
  echo "Rollback: ssh $SERVER 'rm -rf $REMOTE_DIR && mv $REMOTE_PREV $REMOTE_DIR'"
fi
```

Usage:

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Troubleshooting

### Assets return 404

**Symptom:** Page loads but is blank; console shows 404 for `/tonnetz/assets/index.[hash].js`.

**Cause:** `base: '/tonnetz/'` not set in `vite.config.ts`, or `dist/` was uploaded to wrong directory.

**Fix:** Check `vite.config.ts` has `base: '/tonnetz/'`. Verify server directory:

```bash
ssh mikey@s501.sureserver.com "ls ~/www/www/tonnetz/assets/"
```

### WordPress intercepts /tonnetz/ URL

**Symptom:** Visiting `/tonnetz/` shows WordPress content instead of the app.

**Cause:** The `tonnetz/` directory doesn't exist on disk, so WordPress's `!-d` rewrite rule catches it.

**Fix:** Ensure the directory exists and contains `index.html`:

```bash
ssh mikey@s501.sureserver.com "ls ~/www/www/tonnetz/index.html"
```

### Caching headers missing

**Symptom:** `curl -sI` shows no `Cache-Control` header on assets.

**Cause:** `.htaccess` wasn't included in the deploy, or Apache `mod_headers` is not enabled.

**Fix:** Check `.htaccess` exists on server:

```bash
ssh mikey@s501.sureserver.com "cat ~/www/www/tonnetz/.htaccess"
```

If `mod_headers` is not available, caching headers won't apply. The app still works; browsers will use default caching. Contact SureServer support to enable `mod_headers` if needed.

### Web Audio doesn't play on mobile

**Symptom:** Tapping a triangle shows visual selection but no sound on iOS Safari.

**Cause:** Browser autoplay policy blocks `AudioContext` creation before user gesture.

**Fix:** This is handled by the integration module's lazy audio init (see SPEC.md §Startup Sequence, step 2). If it still fails, ensure `initAudioSync()` is being called in the gesture handler chain, not `initAudio()`.

### Share URL doesn't load progression

**Symptom:** Opening a shared URL shows the app but no progression is loaded.

**Cause:** `encodeShareUrl()` may not include the `/tonnetz/` base path, or the URL hash is being stripped.

**Fix:** Verify the share URL format is `https://www.mike-y.com/tonnetz/#p=...`. The `#p=` fragment must survive the redirect from `mike-y.com` → `www.mike-y.com`.

### Old assets still loading after deploy

**Symptom:** Users see old version of the app after a deploy.

**Cause:** `index.html` is cached in their browser.

**Fix:** This shouldn't happen if `.htaccess` sets `no-cache` on `index.html`. Hard-refresh (`Ctrl+Shift+R`) resolves it for individual users. If persistent, check the caching headers (see "Caching headers missing" above).
