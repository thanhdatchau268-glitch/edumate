// sw.js - service worker của VnStarL:
//   1) hiện thông báo trên điện thoại + xử lý khi bấm vào thông báo
//   2) cache-first (có phiên bản) cho sprite / hiệu ứng / giọng nói của Sao La, CÓ GIỚI HẠN dung lượng
self.addEventListener("install", () => self.skipWaiting());

// ====================== CACHE SAO LA ======================
// Đổi PHIEN_BAN khi thay ảnh/giọng nói thật sự (tên file giữ nguyên) để máy người dùng nạp lại.
const PHIEN_BAN = "v1";
const TIEN_TO = "vnstarl-pet-";
const CACHE_THAN = TIEN_TO + "than-" + PHIEN_BAN;       // sprite của skin
const CACHE_HIEU_UNG = TIEN_TO + "hu-" + PHIEN_BAN;     // hiệu ứng dùng chung (nhỏ, ít)
const CACHE_AM = TIEN_TO + "am-" + PHIEN_BAN;           // giọng nói mp3
const TOI_DA_SKIN = 3;   // chốt chặn: tối đa 3 skin trong cache (trang web còn dặn giữ 2 skin gần nhất)
const TOI_DA_AM = 40;    // tối đa 40 file giọng nói
const KHUON_SKIN = /\/img\/pet\/than\/([a-z0-9_]+)\/[^/]+$/;

function phanLoai(duongDan) {
    if (/\/img\/pet\/than\//.test(duongDan)) {
        if (/\/_xem_truoc\.webp$/.test(duongDan)) return null;   // ảnh xem trước nhỏ xíu: để trình duyệt tự cache
        return CACHE_THAN;
    }
    if (/\/img\/pet\/hieu_ung\//.test(duongDan)) return CACHE_HIEU_UNG;
    if (/\/audio\/pet\/[^/]+\/[^/]+\.mp3$/.test(duongDan)) return CACHE_AM;
    return null;
}

function idSkin(request) {
    const m = KHUON_SKIN.exec(new URL(request.url).pathname);
    return m ? m[1] : null;
}

// Xóa mọi file của các skin KHÔNG nằm trong danh sách giữ lại
async function xoaSkinNgoai(cache, giu) {
    for (const req of await cache.keys()) {
        const id = idSkin(req);
        if (id && !giu.includes(id)) await cache.delete(req);
    }
}

// Sau khi thêm file mới vào cache: giữ trong giới hạn
async function donDep(ten, cache, requestMoi) {
    const keys = await cache.keys();   // theo thứ tự thêm vào: cũ nhất đứng trước
    if (ten === CACHE_THAN) {
        const moi = idSkin(requestMoi);
        const thuTu = [];
        for (const r of keys) { const id = idSkin(r); if (id && !thuTu.includes(id)) thuTu.push(id); }
        let thua = thuTu.length - TOI_DA_SKIN;
        for (const id of thuTu) {
            if (thua <= 0) break;
            if (id === moi) continue;   // không bao giờ xóa skin đang nạp
            for (const r of keys) if (idSkin(r) === id) await cache.delete(r);
            thua--;
        }
    } else if (ten === CACHE_AM && keys.length > TOI_DA_AM) {
        for (const r of keys.slice(0, keys.length - TOI_DA_AM)) await cache.delete(r);
    }
}

async function uuTienCache(e, ten) {
    const cache = await caches.open(ten);
    const co = await cache.match(e.request);
    if (co) return co;

    const res = await fetch(e.request);
    // chỉ cache phản hồi thành công trọn vẹn (200), không cache lỗi 404/206
    if (res.status === 200 && res.type === "basic") {
        e.waitUntil(cache.put(e.request, res.clone()).then(() => donDep(ten, cache, e.request)).catch(() => { }));
    }
    return res;
}

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET" || req.headers.has("range")) return;   // để trình duyệt tự xử lý
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    const ten = phanLoai(url.pathname);
    if (!ten) return;
    e.respondWith(uuTienCache(e, ten));
});

// Trang web dặn: chỉ giữ cache của các skin này (skin đang mặc + gần nhất)
self.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.loai !== "pet-giu-skin" || !Array.isArray(d.giu)) return;
    const giu = d.giu.filter((x) => typeof x === "string" && /^[a-z0-9_]{1,40}$/.test(x));
    if (giu.length === 0) return;
    e.waitUntil(caches.open(CACHE_THAN).then((c) => xoaSkinNgoai(c, giu)));
});

self.addEventListener("activate", (e) => {
    e.waitUntil((async () => {
        // dọn cache của phiên bản cũ
        const hienTai = [CACHE_THAN, CACHE_HIEU_UNG, CACHE_AM];
        for (const k of await caches.keys()) {
            if (k.startsWith(TIEN_TO) && !hienTai.includes(k)) await caches.delete(k);
        }
        await self.clients.claim();
    })());
});

// ====================== THÔNG BÁO ======================
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
