/* HCM Lite service worker — safe passthrough.
   Registers the app as a PWA (installable) without caching pages or API
   responses, so dashboards and AI answers always come from the server. */
const CACHE = "hcm-lite-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // network-only: no caching of data — HR numbers must always be live
  return;
});
