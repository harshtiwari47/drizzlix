const CACHE_NAME = "neurodeck-shell-v5";
const CACHE_PREFIX = "neurodeck-shell-v";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];
const CACHEABLE_DESTINATIONS = new Set(["document", "script", "style", "image", "font"]);
const NETWORK_ERROR_RESPONSE = new Response("Network unavailable", {
  status: 503,
  statusText: "Service Unavailable",
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const isLocalhost = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

const shouldCacheRequest = (request) => {
  if (isLocalhost) return false;
  return request.method === "GET" && CACHEABLE_DESTINATIONS.has(request.destination);
};

const shouldCacheResponse = (response) => response && response.ok && response.type !== "opaque";

async function putInCache(request, response) {
  if (isLocalhost) return;
  if (!shouldCacheResponse(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(async (response) => {
    await putInCache(request, response);
    return response;
  });

  if (cached) {
    event.waitUntil(networkPromise.catch(() => undefined));
    return cached;
  }

  try {
    return await networkPromise;
  } catch {
    return NETWORK_ERROR_RESPONSE.clone();
  }
}

async function navigateWithOfflineFallback(request, event) {
  if (isLocalhost) return fetch(request);

  const cache = await caches.open(CACHE_NAME);
  const cachedNavigation = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/index.html"));
  const networkPromise = fetch(request).then(async (response) => {
    await putInCache(request, response);
    const contentType = response?.headers?.get("content-type") || "";
    if (contentType.includes("text/html")) {
      await putInCache("/index.html", response);
    }
    return response;
  });

  if (cachedNavigation) {
    event.waitUntil(networkPromise.catch(() => undefined));
    return cachedNavigation;
  }

  try {
    return await networkPromise;
  } catch {
    return (await cache.match("/index.html")) || NETWORK_ERROR_RESPONSE.clone();
  }
}

self.addEventListener("install", (event) => {
  if (isLocalhost) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (isLocalhost) {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      ),
    );
    self.clients.claim();
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (isLocalhost) return;

  const { request } = event;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API requests should stay network-driven to avoid serving stale authenticated responses.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigateWithOfflineFallback(request, event));
    return;
  }

  if (shouldCacheRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || NETWORK_ERROR_RESPONSE.clone();
    }),
  );
});
