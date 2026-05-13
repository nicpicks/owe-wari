# PWA Implementation Plan — owe-wari

Progressive Web App rollout in four phases, from basic installability to full offline and native-app polish.

---

## Phase 1 – Installability ✅ (done)

- [x] App icons generated from `public/icon.svg` via `scripts/generate-icons.js` (sharp)
  - `public/icons/icon-192.png` (192×192)
  - `public/icons/icon-512.png` (512×512)
  - `public/icons/icon-maskable-192.png` (192×192, maskable — symbol padded to safe area)
  - `public/icons/apple-touch-icon.png` (180×180)
- [x] Web app manifest at `public/manifest.json`
  - `name`, `short_name`, `description`, `start_url`, `display: standalone`
  - `background_color: #0B0B0B`, `theme_color: #F2A007`
  - Icons array with maskable + any purposes
  - Shortcut: "New Group" → `/`
- [x] Meta tags in `src/app/layout.tsx`
  - `manifest`, `themeColor`, `viewport` (with `viewport-fit=cover`)
  - `appleWebApp: { capable, statusBarStyle: black-translucent, title }`
  - `apple-touch-icon` link
- [x] Service worker via `@ducanh2912/next-pwa` in `next.config.js`
  - Precaches Next.js static assets and pages
  - Disabled in development (`NODE_ENV === 'development'`)
  - `cacheOnFrontEndNav`, `aggressiveFrontEndNavCaching`, `reloadOnOnline`

---

## Phase 2 – Offline shell

- [ ] Verify offline shell loads after first visit (run Lighthouse PWA audit)
- [ ] Confirm static assets (CSS, fonts, JS bundles) are precached by next-pwa defaults
- [ ] Add offline fallback page `src/app/offline/page.tsx` — shown when a navigation request fails offline
  - Register fallback in workbox options: `fallbacks: { document: '/offline' }`
- [ ] Add `NetworkStatusBanner` component — appears at top of screen when the browser goes offline mid-session
  - Subscribe to `window online/offline` events; dismiss automatically when connection is restored

---

## Phase 3 – Data caching

- [ ] Cache tRPC GET responses (group details, member lists) for stale-while-revalidate reads
  - Use a workbox `RuntimeCaching` rule targeting `/api/trpc/group.*` and `/api/trpc/expense.*`
- [ ] Show stale group data when offline, with a "last synced" timestamp in the UI
- [ ] Consider IndexedDB queue for pending expense writes (create/update) when offline
  - Re-submit the queue when the connection is restored
  - Surface queued writes in the UI so the user knows what is pending

---

## Phase 4 – Native-app polish

- [ ] "Add to Home Screen" nudge component — surfaces the browser install prompt after a meaningful interaction (e.g. second group visit) and dismisses permanently if declined
- [ ] App shortcuts in manifest — add a "New Expense" shortcut pointing to `/groups/:id/expenses/new` (requires storing last-used groupId in localStorage)
- [ ] Splash screen customisation — use `apple-mobile-web-app-capable` meta tags and the correct icon sizes for iOS splash screens
- [ ] Web Share Target registration — allow the app to receive shared images (receipts) from the camera app via `share_target` in the manifest
- [ ] Push notifications for new group expenses — requires:
  - Server-side push subscription management (VAPID keys, subscription storage)
  - A `/api/push/subscribe` endpoint
  - A service worker `push` event handler
  - UI permission request (after a user-initiated action)
