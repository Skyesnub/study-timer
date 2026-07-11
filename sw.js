// Bump this version string any time you deploy changes, so installed
// PWAs pick up the new files instead of serving stale cached ones.
const CACHE_NAME = "study-timer-cache-v3";

const PRECACHE_FILES = [
    "./",
    "./index.html",
    "./styles.css",
    "./locations.css",
    "./manifest.json",
    "./main.js",
    "./helpers/state.js",
    "./helpers/db.js",
    "./helpers/auth-page.js",
    "./helpers/study-page.js",
    "./helpers/projects-page.js",
    "./helpers/progress-page.js",
    "./helpers/settings-page.js",
    "./helpers/wakelock.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-192.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
    "./icons/favicon-16.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache each file individually rather than cache.addAll(), so one
            // missing/renamed file (e.g. a path that doesn't match your repo)
            // doesn't block the whole service worker from installing.
            return Promise.allSettled(
                PRECACHE_FILES.map((url) =>
                    cache.add(url).catch((error) => {
                        console.warn("Service worker: couldn't precache", url, error);
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    // Never cache anything going to Supabase (auth, database, storage) or
    // the CDN-loaded client library — these must always hit the network.
    const isSupabase = requestUrl.hostname.endsWith(".supabase.co");
    const isCdn = requestUrl.hostname === "cdn.jsdelivr.net";
    const isSameOriginGet = requestUrl.origin === self.location.origin && event.request.method === "GET";

    if (!isSameOriginGet || isSupabase || isCdn) {
        return; // Let the browser handle it normally
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                return networkResponse;
            });
        }).catch(() => caches.match("./index.html"))
    );
});