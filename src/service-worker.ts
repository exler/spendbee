/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from "$service-worker";

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `spendbee-cache-${version}`;
const DATA_CACHE = `spendbee-data-${version}`;

// Assets to cache (build files + static files)
const ASSETS = [
    ...build, // the app itself
    ...files, // everything in `static`
];

// Install event - cache all assets
self.addEventListener("install", (event) => {
    async function addFilesToCache() {
        const cache = await caches.open(CACHE);
        await cache.addAll(ASSETS);
    }

    event.waitUntil(addFilesToCache());
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE && key !== DATA_CACHE) {
                await caches.delete(key);
            }
        }
    }

    event.waitUntil(deleteOldCaches());
});

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
    // Only handle GET requests
    if (event.request.method !== "GET") return;

    async function respond() {
        const url = new URL(event.request.url);
        const cache = await caches.open(CACHE);
        const dataCache = await caches.open(DATA_CACHE);

        // Build files and static assets can always be served from cache
        if (ASSETS.includes(url.pathname)) {
            const response = await cache.match(url.pathname);
            if (response) {
                return response;
            }
        }

        // For API requests, use a network-first strategy with cache fallback
        if (url.pathname.startsWith("/api/")) {
            try {
                const response = await fetch(event.request);

                if (!(response instanceof Response)) {
                    throw new Error("invalid response from fetch");
                }

                // Cache successful GET responses for balances, groups, and expenses
                if (response.status === 200) {
                    // Only cache read-only endpoints that are useful offline
                    if (
                        url.pathname.includes("/balances") ||
                        (url.pathname.includes("/groups") && !url.pathname.includes("/invite")) ||
                        url.pathname.includes("/expenses/group/")
                    ) {
                        dataCache.put(event.request, response.clone());
                    }
                }

                return response;
            } catch (err) {
                // If network fails, try to serve from data cache
                const cachedResponse = await dataCache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Return a custom offline response for API calls
                return new Response(
                    JSON.stringify({
                        error: "You are offline. Some data may not be available.",
                        offline: true,
                    }),
                    {
                        status: 503,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
        }

        // For all other requests (pages, etc.), try network first
        try {
            const response = await fetch(event.request);

            if (!(response instanceof Response)) {
                throw new Error("invalid response from fetch");
            }

            // Cache successful responses
            if (response.status === 200) {
                cache.put(event.request, response.clone());
            }

            return response;
        } catch (err) {
            // If network fails, try cache
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            // If nothing in cache, throw error
            throw err;
        }
    }

    event.respondWith(respond());
});
