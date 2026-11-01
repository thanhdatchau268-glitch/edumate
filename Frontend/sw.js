// sw.js - service worker nhỏ chỉ để hiện thông báo trên điện thoại và xử lý khi bấm vào thông báo
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    const url = new URL((e.notification.data && e.notification.data.url) || "index.html", self.location.href).href;
    e.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (ds) => {
            for (const c of ds) {
                try {
                    await c.focus();
                    if ("navigate" in c) await c.navigate(url);
                    return;
                } catch (err) { /* thử tab khác / mở tab mới */ }
            }
            return self.clients.openWindow(url);
        }),
    );
});