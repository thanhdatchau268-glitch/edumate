// pet.js - Sao La: skin nguyên con (mục 3b) + lời thoại, giọng nói theo giới tính (mục 3c)
//
// Việc file này làm:
//   - hỏi server skin đang mặc, CHỈ nạp sprite của skin đó (idle trước, hành động khác nạp lười)
//   - đổi skin: nạp idle skin mới xong mới đổi, rồi giải phóng sprite skin cũ
//   - skin thiếu hành động: dùng idle của chính skin + hiệu ứng dùng chung (img/pet/hieu_ung/)
//   - lời thoại: bong bóng chữ + giọng mp3 (giới tính -> giới tính còn lại -> speechSynthesis -> chỉ chữ)
//   - im lặng ở form.html và trong lúc có cuộc thi đang diễn ra
// Trang khác dùng qua window.SAOLA (xem cuối file).
(function () {
  "use strict";
  if (window.SAOLA) return;

  // ---------- localStorage an toàn (có thể bị chặn) ----------
  const luu = {
    doc(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    ghi(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
    docSS(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    ghiSS(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };

  const trang = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (luu.doc("isLoggedIn") !== "true" || !luu.doc("userId")) return;
  if (trang === "login.html" || trang === "register.html") return;
  const userId = luu.doc("userId");

  const API = typeof API_SERVER === "string" ? API_SERVER : "http://127.0.0.1:5000";

  // ---------- cấu hình ----------
  const KHOA_TAT_TIENG = "saola_tat_tieng";        // "1" = đã tắt tiếng (nhớ lâu dài)
  const KHOA_SKIN_GAN_DAY = "saola_skin_gan_day";  // các skin vừa mặc, để dặn sw.js giữ cache
  const SO_SKIN_GIU_CACHE = 2;                     // chỉ giữ cache cho skin đang mặc + 1 skin gần nhất
  const THU_MUC_AM = "audio/pet/";
  const TOI_DA_TAI_TRUOC = 2;                      // tải trước tối đa 2 lời kế tiếp
  const HAN_NHO_CUOC_THI = 60 * 1000;              // nhớ kết quả "có cuộc thi không" 60 giây
  const THOI_GIAN_BONG_BONG = 4500;
  const THOI_GIAN_HANH_DONG = 3000;
  const LA_FORM = trang === "form.html";           // form.html: pet không phát tiếng

  const giamChuyenDong = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- trạng thái ----------
  const S = {
    ttServer: null,          // trạng thái server trả về gần nhất
    gioiTinh: "nu",
    soKhung: 6, fps: 6,
    hieuUng: { thu_muc: "img/pet/hieu_ung/", ds: [], theo_hanh_dong: {} },

    skin: null,              // {id, thu_muc, hanh_dong}
    anhSkin: new Map(),      // hành động -> Image  (CHỈ của skin đang mặc)
    anhHu: new Map(),        // tên hiệu ứng -> Image
    luotSkin: 0, luotHanhDong: 0, henVeIdle: 0,

    loi: {},                 // mã lời -> chữ thoại
    hangCham: [],            // hàng đợi lời "chạm vào" (xáo trộn, không lặp liên tục)
    tuongTac: false,         // người dùng đã bấm/gõ phím chưa (trình duyệt chặn tự phát tiếng)
    thi: { t: 0, v: false, p: null }, // có cuộc thi đang diễn ra không (nhớ 60 giây)

    am: new Map(),           // đường dẫn mp3 -> {u: objectURL, p: Promise, huy: bool}
    amThieu: new Set(),      // mp3 không tồn tại (khỏi hỏi lại)
    hangTaiTruoc: [],        // mp3 đã tải trước
    luotGiong: 0, amDangPhat: null,
    henBongBong: 0,
  };
  const ELM = {};            // các phần tử giao diện

  // =====================================================================
  // GIAO DIỆN
  // =====================================================================
  function dungGiaoDien() {
    if (!document.querySelector('link[href^="pet.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "pet.css?v=2";
      document.head.appendChild(l);
    }
    const goc = document.createElement("div");
    goc.id = "sao-la";
    goc.hidden = true; // có skin rồi mới hiện
    goc.innerHTML =
      '<div class="sl-dat" aria-hidden="true"></div>' +
      '<div class="sl-bong" hidden role="status" aria-live="polite"></div>' +
      '<button type="button" class="sl-tieng" aria-label="Bật hoặc tắt tiếng Sao La"></button>' +
      '<div class="sl-pet"><div class="sl-than"></div><div class="sl-hu"></div>' +
      '<div class="sl-hit" role="button" tabindex="0" aria-label="Sao La, chạm để trò chuyện"></div></div>';
    document.body.appendChild(goc);

    ELM.goc = goc;
    ELM.bong = goc.querySelector(".sl-bong");
    ELM.tieng = goc.querySelector(".sl-tieng");
    ELM.hit = goc.querySelector(".sl-hit");
    ELM.than = { el: goc.querySelector(".sl-than"), anh: null, n: 1, i: 0 };
    ELM.hu = { el: goc.querySelector(".sl-hu"), anh: null, n: 1, i: 0 };

    ELM.tieng.hidden = LA_FORM; // form.html không có tiếng nên khỏi hiện nút
    veNutTieng();
    ELM.tieng.addEventListener("click", () => {
      datTatTieng(!dangTatTieng());
      if (dangTatTieng()) dungGiong();
      else noi(null, { chu: "Mình nói lại được rồi nhé!" });
    });

    const chamVao = () => { noi(layLoiCham()); datHanhDong("vui", 2500); };
    ELM.hit.addEventListener("click", chamVao);
    ELM.hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chamVao(); }
    });
  }

  // ---------- vẽ dải khung (sprite sheet ngang, mỗi hành động 6 khung) ----------
  function datSprite(nc, img, n) {
    nc.anh = img; nc.n = Math.max(1, n); nc.i = 0;
    nc.el.style.backgroundImage = 'url("' + img.src + '")';
    nc.el.style.backgroundSize = nc.n * 100 + "% 100%";
    veKhung(nc);
  }
  function xoaSprite(nc) {
    nc.anh = null; nc.n = 1; nc.i = 0;
    nc.el.style.backgroundImage = "none";
  }
  function veKhung(nc) {
    nc.el.style.backgroundPosition = (nc.n > 1 ? (nc.i / (nc.n - 1)) * 100 : 0) + "% 0";
  }

  // ---------- cắt / căn ảnh theo hình thật ----------
  // Ảnh họa sĩ xuất ra thường chừa lề trong suốt (chân pet cách đáy khung vài chục px) nên pet trông
  // "lơ lửng". Ta quét kênh alpha của TOÀN BỘ các khung idle để tìm khung bao (bounding box) thật,
  // rồi: (1) dịch hình xuống cho điểm ảnh thấp nhất chạm đáy khung = mặt đất, (2) căn giữa theo chiều
  // ngang, (3) thu vùng bấm ôm sát hình. Mọi hành động và hiệu ứng của skin dùng chung 1 mốc căn này
  // (lấy từ idle) nên đổi hành động không bị giật vị trí.
  const NGUONG_ALPHA = 24;   // điểm ảnh có alpha > 24/255 mới tính là "có hình" (bỏ viền mờ/bóng khuếch tán)

  // Trả về {l, t, r, b} theo tỉ lệ 0..1 của 1 khung, hoặc null nếu không đọc được (ảnh khác nguồn, trống...).
  function tinhKhungBao(img, soKhung) {
    try {
      const W = img.naturalWidth, H = img.naturalHeight;
      const fw = Math.floor(W / Math.max(1, soKhung));
      if (!W || !H || fw < 1) return null;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const g = cv.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      cv.width = cv.height = 0; // trả bộ nhớ ngay
      let l = fw, r = -1, t = H, b = -1;
      for (let y = 0; y < H; y++) {
        const hang = y * W * 4 + 3;
        for (let x = 0; x < fw * soKhung; x++) {
          if (d[hang + x * 4] > NGUONG_ALPHA) {
            const xx = x % fw;
            if (xx < l) l = xx;
            if (xx > r) r = xx;
            if (y < t) t = y;
            if (y > b) b = y;
          }
        }
      }
      if (r < 0) return null;
      return { l: l / fw, r: (r + 1) / fw, t: t / H, b: (b + 1) / H };
    } catch (e) { return null; } // canvas bị chặn (khác nguồn): bỏ qua, pet vẫn chạy như cũ
  }

  // Áp mốc căn cho skin vừa nạp xong. kb = null thì không căn.
  function canChinh(kb) {
    const dx = kb ? 0.5 - (kb.l + kb.r) / 2 : 0;   // dịch ngang cho giữa khung
    const dy = kb ? 1 - kb.b : 0;                  // phần trống phía dưới chân -> dịch xuống bấy nhiêu
    const dich = kb ? "translate(" + dx * 100 + "%, " + dy * 100 + "%)" : "";
    ELM.than.el.style.transform = dich;
    ELM.hu.el.style.transform = dich;              // hiệu ứng vẽ cùng hệ tọa độ với pet nên dịch giống hệt
    const h = ELM.hit.style;                       // vùng bấm ôm sát hình sau khi dịch
    if (kb) {
      h.left = (kb.l + dx) * 100 + "%";  h.top = (kb.t + dy) * 100 + "%";
      h.width = (kb.r - kb.l) * 100 + "%"; h.height = (kb.b - kb.t) * 100 + "%";
      h.right = h.bottom = "auto";
    } else { h.left = h.top = "0"; h.width = h.height = "100%"; }
  }

  // 1 bộ đếm giờ chung cho cả pet và hiệu ứng; tab ẩn thì đứng im cho đỡ tốn pin
  let tgTruoc = 0;
  function lap(t) {
    requestAnimationFrame(lap);
    if (document.hidden || giamChuyenDong) return;
    if (t - tgTruoc < 1000 / S.fps) return;
    tgTruoc = t;
    [ELM.than, ELM.hu].forEach((nc) => {
      if (nc.anh && nc.n > 1) { nc.i = (nc.i + 1) % nc.n; veKhung(nc); }
    });
  }

  // =====================================================================
  // NẠP SPRITE (lười) + ĐỔI SKIN
  // =====================================================================
  // Đuôi ?v= đổi khi họa sĩ thay ảnh, nên sw.js/trình duyệt không giữ ảnh cũ trùng tên
  function duongDanSprite(skin, ten) {
    return skin.thu_muc + ten + ".webp?v=" + (skin.v || 0);
  }

  function napAnh(url) {
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = url;
    });
  }

  function giaiPhongAnh(map) {
    for (const im of map.values()) if (im) im.src = ""; // bỏ tham chiếu để trình duyệt thu hồi bộ nhớ
    map.clear();
  }

  // Dặn sw.js chỉ giữ cache của vài skin gần nhất (đỡ đầy bộ nhớ máy)
  function baoSwGiuSkin(id) {
    let ds = [];
    try { ds = JSON.parse(luu.doc(KHOA_SKIN_GAN_DAY) || "[]"); } catch (e) { ds = []; }
    if (!Array.isArray(ds)) ds = [];
    ds = [id].concat(ds.filter((x) => x !== id)).slice(0, SO_SKIN_GIU_CACHE);
    luu.ghi(KHOA_SKIN_GAN_DAY, JSON.stringify(ds));
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ loai: "pet-giu-skin", giu: ds });
  }

  // Đổi sang skin mới. Nạp idle xong mới đổi (không bị nháy trắng), rồi mới thả sprite skin cũ.
  async function apDungSkin(moTa) {
    if (!moTa || !moTa.thu_muc || !Array.isArray(moTa.hanh_dong)) return false;
    if (S.skin && S.skin.id === moTa.id) { S.skin = moTa; return true; }

    const luot = ++S.luotSkin;
    const idle = await napAnh(duongDanSprite(moTa, "idle"));
    if (luot !== S.luotSkin) return false; // trong lúc chờ đã có yêu cầu đổi khác
    if (!idle) return false;               // nạp lỗi thì giữ skin cũ, không báo lỗi

    const mapCu = S.anhSkin;
    S.skin = moTa;
    S.anhSkin = new Map([["idle", idle]]);
    ++S.luotHanhDong;
    clearTimeout(S.henVeIdle);
    canChinh(tinhKhungBao(idle, S.soKhung)); // cắt/căn theo hình thật: chân chạm đất
    datSprite(ELM.than, idle, S.soKhung);   // hiện skin mới trước...
    xoaSprite(ELM.hu);
    giaiPhongAnh(mapCu);                    // ...rồi mới thả skin cũ
    ELM.goc.hidden = false;
    baoSwGiuSkin(moTa.id);
    return true;
  }

  // Lấy sprite của 1 hành động thuộc skin ĐANG MẶC (nạp lười lần đầu cần)
  async function layHanhDong(ten) {
    const skin = S.skin;
    if (!skin || !skin.hanh_dong.includes(ten)) return null;
    if (S.anhSkin.has(ten)) return S.anhSkin.get(ten);
    const im = await napAnh(duongDanSprite(skin, ten));
    if (S.skin !== skin) { if (im) im.src = ""; return null; } // đã đổi skin trong lúc nạp
    if (im) S.anhSkin.set(ten, im);
    return im;
  }

  async function layHieuUng(ten) {
    if (S.anhHu.has(ten)) return S.anhHu.get(ten);
    const im = await napAnh(S.hieuUng.thu_muc + ten + ".webp?v=" + (S.hieuUng.v || 0));
    if (im) S.anhHu.set(ten, im);
    return im;
  }

  // Chạy 1 hành động. Skin không có hành động đó -> idle của CHÍNH skin + hiệu ứng dùng chung.
  async function datHanhDong(ten, ms) {
    if (!S.skin) return;
    const luot = ++S.luotHanhDong;
    clearTimeout(S.henVeIdle);

    let sprite = await layHanhDong(ten);
    let hu = null;
    if (!sprite) {
      sprite = S.anhSkin.get("idle");
      const tenHu = S.hieuUng.theo_hanh_dong[ten];
      if (tenHu && S.hieuUng.ds.includes(tenHu)) hu = await layHieuUng(tenHu);
    }
    if (luot !== S.luotHanhDong || !sprite) return; // có lệnh mới hơn, hoặc skin vừa đổi

    datSprite(ELM.than, sprite, S.soKhung);
    if (hu) datSprite(ELM.hu, hu, S.soKhung); else xoaSprite(ELM.hu);
    if (ten !== "idle") {
      S.henVeIdle = setTimeout(() => datHanhDong("idle"), ms || THOI_GIAN_HANH_DONG);
    }
  }

  // =====================================================================
  // BONG BÓNG CHỮ
  // =====================================================================
  function hienChu(chu) {
    clearTimeout(S.henBongBong);
    if (!chu) { ELM.bong.hidden = true; return; }
    ELM.bong.textContent = chu; // textContent: chữ thoại không chạy được code lạ
    ELM.bong.hidden = false;
    S.henBongBong = setTimeout(() => { ELM.bong.hidden = true; }, THOI_GIAN_BONG_BONG);
  }

  // =====================================================================
  // GIỌNG NÓI
  // =====================================================================
  function dangTatTieng() { return luu.doc(KHOA_TAT_TIENG) === "1"; }
  function datTatTieng(tat) { luu.ghi(KHOA_TAT_TIENG, tat ? "1" : "0"); veNutTieng(); }
  function veNutTieng() {
    if (!ELM.tieng) return;
    const tat = dangTatTieng();
    ELM.tieng.textContent = tat ? "🔇" : "🔊";
    ELM.tieng.setAttribute("aria-pressed", tat ? "true" : "false");
    ELM.tieng.title = tat ? "Đang tắt tiếng (vẫn hiện chữ)" : "Đang bật tiếng";
  }

  // Có cuộc thi đang diễn ra không? (hỏi server, nhớ 60 giây; lỗi mạng coi như không có)
  function dangCoCuocThi() {
    if (S.thi.p && Date.now() - S.thi.t < HAN_NHO_CUOC_THI) return S.thi.p; // nhiều lời gọi cùng lúc dùng chung 1 lần hỏi
    S.thi.t = Date.now();
    S.thi.p = fetch(API + "/api/contests")
      .then((res) => res.json())
      .then((kq) => !!(kq && Array.isArray(kq.data) && kq.data.some((c) => c.trang_thai === "dang-dien-ra")))
      .catch(() => false)
      .then((v) => { S.thi.v = v; return v; });
    return S.thi.p;
  }
  async function imLang() { return LA_FORM || (await dangCoCuocThi()); }

  // ----- tải mp3 (lười): fetch -> blob -> objectURL, để còn giải phóng được -----
  function layAm(duongDan) {
    if (S.amThieu.has(duongDan)) return Promise.resolve(null);
    let e = S.am.get(duongDan);
    if (!e) {
      e = { u: null, huy: false, p: null };
      e.p = fetch(duongDan)
        .then((r) => {
          const loai = r.headers.get("content-type") || "";
          return r.ok && !loai.includes("text/html") ? r.blob() : null; // server trả trang lỗi HTML = không có file
        })
        .then((b) => (b && b.size ? URL.createObjectURL(b) : null))
        .catch(() => null)
        .then((u) => {
          if (!u) { S.am.delete(duongDan); S.amThieu.add(duongDan); return null; }
          if (e.huy) { URL.revokeObjectURL(u); return null; }
          e.u = u;
          return u;
        });
      S.am.set(duongDan, e);
    }
    return e.p;
  }
  function boAm(duongDan) {
    S.hangTaiTruoc = S.hangTaiTruoc.filter((x) => x !== duongDan); // luôn gỡ khỏi hàng, kể cả khi file không tồn tại
    const e = S.am.get(duongDan);
    if (!e) return;
    e.huy = true;
    if (e.u) URL.revokeObjectURL(e.u);
    S.am.delete(duongDan);
  }
  function duongDanAm(gioiTinh, ma) { return THU_MUC_AM + gioiTinh + "/" + ma + ".mp3"; }

  // Tải trước tối đa 1-2 lời kế tiếp (chỉ khi thật sự có thể phát)
  function taiTruoc(ma) {
    if (!ma || LA_FORM || dangTatTieng() || !S.tuongTac || S.thi.v) return;
    const dd = duongDanAm(S.gioiTinh, ma);
    if (S.hangTaiTruoc.includes(dd) || S.amThieu.has(dd)) return;
    S.hangTaiTruoc.push(dd);
    while (S.hangTaiTruoc.length > TOI_DA_TAI_TRUOC) boAm(S.hangTaiTruoc[0]);
    layAm(dd);
  }

  function dungGiong() {
    ++S.luotGiong;
    if (S.amDangPhat) {
      S.amDangPhat.a.pause();
      boAm(S.amDangPhat.dd);
      S.amDangPhat = null;
    }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
  }

  // Phát 1 file. Trả true nếu đã bắt đầu phát, false nếu bị trình duyệt chặn.
  function phatFile(url, dd, luot) {
    return new Promise((ok) => {
      const a = new Audio(url);
      S.amDangPhat = { a, dd };
      const xong = () => { if (S.amDangPhat && S.amDangPhat.a === a) S.amDangPhat = null; boAm(dd); };
      a.addEventListener("ended", xong);
      a.addEventListener("error", xong);
      if (luot !== S.luotGiong) { xong(); ok(false); return; }
      a.play().then(() => ok(true), () => { xong(); ok(false); });
    });
  }

  // Dự phòng cuối: giọng đọc của trình duyệt (chỉ khi có giọng tiếng Việt)
  function noiBangTrinhDuyet(chu) {
    try {
      if (!chu || !window.speechSynthesis) return false;
      const giong = speechSynthesis.getVoices().find((v) => /^vi/i.test(v.lang));
      if (!giong) return false;
      const u = new SpeechSynthesisUtterance(chu);
      u.voice = giong; u.lang = giong.lang;
      u.pitch = S.gioiTinh === "nam" ? 0.8 : 1.15;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // Thứ tự: giọng đúng giới tính -> giọng giới tính còn lại -> giọng trình duyệt -> chỉ chữ (không báo lỗi)
  async function phatGiong(ma, chu) {
    dungGiong();
    if (!ma || dangTatTieng() || !S.tuongTac) return false;
    const luot = S.luotGiong;
    if (await imLang()) return false;
    if (luot !== S.luotGiong) return false;

    const khac = S.gioiTinh === "nam" ? "nu" : "nam";
    for (const gt of [S.gioiTinh, khac]) {
      const dd = duongDanAm(gt, ma);
      const u = await layAm(dd);
      if (luot !== S.luotGiong) return false;
      if (u) return phatFile(u, dd, luot);
    }
    return noiBangTrinhDuyet(chu);
  }

  // =====================================================================
  // LỜI THOẠI
  // =====================================================================
  async function napLoi() {
    try {
      const res = await fetch(THU_MUC_AM + "manifest.json");
      if (!res.ok) return;
      const kq = await res.json();
      if (kq && kq.loi && typeof kq.loi === "object") S.loi = kq.loi;
    } catch (e) { /* không có lời thoại thì pet vẫn chạy, chỉ im lặng */ }
  }

  // nv07 -> nv08 (nếu có), cham_vao_1 -> cham_vao_2
  function maKeTiep(ma) {
    const m = /^(.*?)(\d+)$/.exec(ma || "");
    if (!m) return null;
    const moi = m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
    return moi in S.loi ? moi : null;
  }

  function xaoTron(ds) {
    for (let i = ds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ds[i], ds[j]] = [ds[j], ds[i]];
    }
    return ds;
  }
  function layLoiCham() {
    if (S.hangCham.length === 0) {
      S.hangCham = xaoTron(Object.keys(S.loi).filter((k) => k.startsWith("cham_vao_") && S.loi[k]));
    }
    const ma = S.hangCham.shift() || null;
    taiTruoc(S.hangCham[0]); // lời chạm kế tiếp
    return ma;
  }

  // Nói 1 lời: hiện chữ + (nếu được phép) phát giọng. Trả true nếu có gì để nói.
  // Miệng pet: nếu skin có hành động "noi" riêng thì dùng, không thì giữ hành động đang chạy.
  function noi(ma, tuyChon) {
    const chu = (tuyChon && tuyChon.chu) || (ma && S.loi[ma]) || "";
    if (!chu && !ma) return false;
    if (chu) hienChu(chu);
    if (S.skin && S.skin.hanh_dong.includes("noi")) datHanhDong("noi", 2500);
    phatGiong(ma, chu);
    taiTruoc(maKeTiep(ma));
    return !!chu;
  }

  // =====================================================================
  // KHỞI ĐỘNG
  // =====================================================================
  function apTrangThai(tt) {
    S.ttServer = tt;
    S.gioiTinh = tt.gioi_tinh === "nam" ? "nam" : "nu";
    S.soKhung = tt.so_khung || 6;
    S.fps = tt.fps || 6;
    if (tt.hieu_ung) S.hieuUng = tt.hieu_ung;
    return apDungSkin(tt.skin_hien_tai);
  }

  async function taiTrangThai() {
    try {
      const res = await fetch(API + "/api/pet?user_id=" + encodeURIComponent(userId));
      const kq = await res.json();
      return kq && kq.success ? kq.data : null;
    } catch (e) { return null; } // server tắt: pet im lặng biến mất, không làm hỏng trang
  }

  // Lần đầu bấm/gõ phím: từ lúc này trình duyệt mới cho phát tiếng
  function ghiNhanTuongTac() { S.tuongTac = true; }
  ["pointerdown", "keydown", "touchstart"].forEach((s) =>
    window.addEventListener(s, ghiNhanTuongTac, { once: true, capture: true, passive: true }));

  let dungXong;
  const sanSang = new Promise((ok) => { dungXong = ok; });

  async function khoiDong() {
    dungGiaoDien();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
    requestAnimationFrame(lap);

    const [tt] = await Promise.all([taiTrangThai(), napLoi()]);
    if (!tt) { dungXong(null); return; }
    await apTrangThai(tt);
    dungXong(tt);

    // Chào bằng chữ 1 lần mỗi phiên. KHÔNG phát tiếng: vừa mở trang là bị trình duyệt chặn.
    if (!luu.docSS("saola_da_chao") && S.loi.chao && S.skin) {
      luu.ghiSS("saola_da_chao", "1");
      hienChu(S.loi.chao);
    }
  }

  window.SAOLA = {
    sanSang,                                         // Promise<trạng thái | null>
    noi,                                             // noi("nv01") hoặc noi(null, {chu: "..."})
    hanhDong: datHanhDong,                           // hanhDong("hoc", 3000)
    ap: apTrangThai,                                 // áp trạng thái server vừa trả (sau khi mặc skin/đổi giới tính)
    trangThai: () => S.ttServer,
    gioiTinh: () => S.gioiTinh,
    datTatTieng,
    dangTatTieng,
    dungGiong,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", khoiDong);
  else khoiDong();
})();
