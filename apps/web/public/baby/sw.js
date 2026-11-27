/* Baby Shoot service worker: the app shell and studio examples work offline and open instantly.
   API calls and photos always go to the network. */
const V = "bs-v1";
const SHELL = ["/", "/baby/app.js", "/baby/themes.js", "/baby/supabase.js", "/baby/brand/mark.png", "/baby/brand/markDark.png", "/baby/brand/baby.png", "/baby/brand/shoot.png", "/baby/icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (u.pathname.startsWith("/baby/sets/") || u.pathname.startsWith("/baby/brand/") || u.pathname.startsWith("/baby/icons/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); } return r; })));
    return;
  }
  if (u.pathname === "/" || u.pathname.startsWith("/baby/")) {
    // Network first so updates land at once; the cached copy covers offline.
    e.respondWith(fetch(e.request).then((r) => { if (r.ok && u.pathname !== "/") { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); } if (r.ok && u.pathname === "/") { const c = r.clone(); caches.open(V).then((x) => x.put("/", c)); } return r; }).catch(() => caches.match(u.pathname === "/" ? "/" : e.request)));
  }
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow("/#shoots")))); });
