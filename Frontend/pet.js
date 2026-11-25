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
  const KHOA_THU_GON = "saola_thu_gon";            // "1" = thu gọn Sao La vào mép phải
  const KHOA_SKIN_GAN_DAY = "saola_skin_gan_day";  // các skin vừa mặc, để dặn sw.js giữ cache
  const KHOA_TT_CACHE = "saola_tt_cache_" + userId;// cache trạng thái pet để hiện & nói ngay tức thì
  const KHOA_LOI_CACHE = "saola_loi_cache_v3";     // cache manifest lời thoại khỏi chờ fetch
  const KHOA_THI_CACHE = "saola_thi_cache";        // cache kiểm tra cuộc thi trong phiên
  const KHOA_AM_THIEU = "saola_am_thieu_v3";       // nhớ các file mp3 không tồn tại trong phiên
  const SO_SKIN_GIU_CACHE = 2;                     // chỉ giữ cache cho skin đang mặc + 1 skin gần nhất
  const THU_MUC_AM = "audio/pet/";
  const HAN_NHO_CUOC_THI = 60 * 1000;              // nhớ kết quả "có cuộc thi không" 60 giây
  const THOI_GIAN_BONG_BONG = 4500;
  const THOI_GIAN_HANH_DONG = 3000;
  const LA_FORM = trang === "form.html" && /[?&]subject=contest\b/.test(location.search); // chỉ ẩn/tắt tiếng khi đang thi cuộc thi trên form.html

  const giamChuyenDong = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- trạng thái ----------
  const S = {
    ttServer: null,          // trạng thái server trả về gần nhất
    gioiTinh: "nu",
    soKhung: 6, fps: 6,
    hieuUng: { thu_muc: "img/pet/hieu_ung/", ds: [], theo_hanh_dong: {} },

    skin: null,              // {id, thu_muc, hanh_dong}
    skinCho: null,           // skin chờ nạp khi Sao La đang thu gọn
    anhSkin: new Map(),      // hành động -> Image  (CHỈ của skin đang mặc)
    anhHu: new Map(),        // tên hiệu ứng -> Image
    luotSkin: 0, luotHanhDong: 0, henVeIdle: 0,
    dangChayLoop: false,     // chỉ chạy requestAnimationFrame khi mở & tab đang hiển thị

    loi: {},                 // mã lời -> chữ thoại
    hangCham: [],            // hàng đợi lời "chạm vào" (xáo trộn, không lặp liên tục)
    tuongTac: false,         // người dùng đã bấm/gõ phím chưa (trình duyệt chặn tự phát tiếng)
    choPhat: null,           // {ma, chu, ts} câu vừa bị trình duyệt chặn autoplay, phát ngay khi chạm
    thi: { t: 0, v: false, p: null }, // có cuộc thi đang diễn ra không (nhớ 60 giây)

    amThieu: new Set(),      // mp3 không tồn tại (khỏi hỏi lại)
    luotGiong: 0, amDangPhat: null,
    henBongBong: 0,
  };
  try {
    const amCu = JSON.parse(luu.docSS(KHOA_AM_THIEU) || "[]");
    if (Array.isArray(amCu)) amCu.forEach((dd) => S.amThieu.add(dd));
    const thiCu = JSON.parse(luu.docSS(KHOA_THI_CACHE) || "null");
    if (thiCu && typeof thiCu.t === "number" && Date.now() - thiCu.t < HAN_NHO_CUOC_THI) {
      S.thi.t = thiCu.t;
      S.thi.v = !!thiCu.v;
    }
  } catch (e) { /* bỏ qua */ }
  const ELM = {};            // các phần tử giao diện

  // =====================================================================
  // GIAO DIỆN
  // =====================================================================
  function dungGiaoDien() {
    if (!document.querySelector('link[href^="pet.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "pet.css?v=3";
      document.head.appendChild(l);
    }
    const goc = document.createElement("div");
    goc.id = "sao-la";
    goc.hidden = true; // có skin rồi mới hiện
    goc.innerHTML =
      '<div class="sl-dat" aria-hidden="true"></div>' +
      '<div class="sl-bong" hidden role="status" aria-live="polite"></div>' +
      '<button type="button" class="sl-thu" aria-label="Thu gọn hoặc mở lại Sao La"></button>' +
      '<button type="button" class="sl-tieng" aria-label="Bật hoặc tắt tiếng Sao La"></button>' +
      '<div class="sl-pet"><div class="sl-than"></div><div class="sl-hu"></div>' +
      '<div class="sl-hit" role="button" tabindex="0" aria-label="Sao La, chạm để trò chuyện"></div></div>';
    document.body.appendChild(goc);

    ELM.goc = goc;
    ELM.bong = goc.querySelector(".sl-bong");
    ELM.thu = goc.querySelector(".sl-thu");
    ELM.tieng = goc.querySelector(".sl-tieng");
    ELM.hit = goc.querySelector(".sl-hit");
    ELM.than = { el: goc.querySelector(".sl-than"), anh: null, n: 1, i: 0 };
    ELM.hu = { el: goc.querySelector(".sl-hu"), anh: null, n: 1, i: 0 };

    const capNhatThuGon = () => {
      const thu = luu.doc(KHOA_THU_GON) === "1";
      goc.classList.toggle("thu-gon", thu);
      ELM.thu.textContent = thu ? "🦌" : "›";
      ELM.thu.title = thu ? "Mở lại Sao La" : "Thu gọn Sao La vào góc màn hình";
      ELM.thu.setAttribute("aria-expanded", String(!thu));
    };
    capNhatThuGon();
    ELM.thu.addEventListener("click", () => {
      const moi = luu.doc(KHOA_THU_GON) === "1" ? "0" : "1";
      luu.ghi(KHOA_THU_GON, moi);
      if (moi === "1") dungGiong();
      capNhatThuGon();
      if (moi === "0" && S.skinCho && !S.skin) {
        const cho = S.skinCho;
        S.skinCho = null;
        apDungSkin(cho).then((ok) => { if (ok) batLoop(); });
      } else {
        batLoop();
      }
    });

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

  // 1 bộ đếm giờ chung cho cả pet và hiệu ứng; tự dừng khi ẩn tab hoặc đang thu gọn (tiết kiệm pin điện thoại)
  let tgTruoc = 0;
  function daMoRong() {
    return luu.doc(KHOA_THU_GON) !== "1";
  }
  function nenChayLoop() {
    return !document.hidden && !giamChuyenDong && daMoRong() && !!S.skin;
  }
  function batLoop() {
    if (S.dangChayLoop || !nenChayLoop()) return;
    S.dangChayLoop = true;
    requestAnimationFrame(lap);
  }
  function lap(t) {
    if (!nenChayLoop()) { S.dangChayLoop = false; return; }
    requestAnimationFrame(lap);
    if (t - tgTruoc < 1000 / S.fps) return;
    tgTruoc = t;
    [ELM.than, ELM.hu].forEach((nc) => {
      if (nc.anh && nc.n > 1) { nc.i = (nc.i + 1) % nc.n; veKhung(nc); }
    });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) batLoop(); });

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

  // Có cuộc thi đang diễn ra không? (dùng cache sessionStorage 60s để không làm trễ lúc mở trang)
  function dangCoCuocThi() {
    if (S.thi.p && Date.now() - S.thi.t < HAN_NHO_CUOC_THI) return S.thi.p;
    S.thi.t = Date.now();
    S.thi.p = fetch(API + "/api/contests")
      .then((res) => res.json())
      .then((kq) => !!(kq && Array.isArray(kq.data) && kq.data.some((c) => c.trang_thai === "dang-dien-ra")))
      .catch(() => false)
      .then((v) => {
        S.thi.v = v;
        luu.ghiSS(KHOA_THI_CACHE, JSON.stringify({ t: S.thi.t, v }));
        return v;
      });
    return S.thi.p;
  }
  function imLangNhanh() {
    if (LA_FORM) return true;
    if (Date.now() - S.thi.t < HAN_NHO_CUOC_THI) return S.thi.v;
    dangCoCuocThi(); // làm mới ngầm cho lần gọi sau, không chặn phát tiếng ngay lập tức
    return S.thi.v;
  }

  function nhoAmThieu(dd) {
    S.amThieu.add(dd);
    try { luu.ghiSS(KHOA_AM_THIEU, JSON.stringify(Array.from(S.amThieu).slice(-50))); } catch (e) { /* bỏ qua */ }
  }
  function duongDanAm(gioiTinh, ma) { return THU_MUC_AM + gioiTinh + "/" + ma + ".mp3?v=3"; }

  function dungGiong() {
    ++S.luotGiong;
    S.choPhat = null;
    if (S.amDangPhat) {
      try { S.amDangPhat.a.pause(); S.amDangPhat.a.src = ""; } catch (e) { /* bỏ qua */ }
      S.amDangPhat = null;
    }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
  }

  // Phát thẳng qua Audio stream (nghe ngay khi tải được những byte đầu, không chờ tải xong cả file mới phát)
  function phatTrucTiep(dd, ma, chu, luot) {
    return new Promise((ok) => {
      const a = new Audio(dd);
      a.preload = "auto";
      a.volume = 1.0;
      S.amDangPhat = { a, dd };
      let daXong = false;
      const don = () => {
        if (daXong) return;
        daXong = true;
        if (S.amDangPhat && S.amDangPhat.a === a) S.amDangPhat = null;
      };
      a.addEventListener("ended", don, { once: true });
      a.addEventListener("error", () => {
        don();
        nhoAmThieu(dd);
        if (luot === S.luotGiong) ok(noiBangTrinhDuyet(chu));
        else ok(false);
      }, { once: true });
      if (luot !== S.luotGiong) { don(); ok(false); return; }
      a.play().then(
        () => {
          S.tuongTac = true;
          S.choPhat = null;
          ok(true);
        },
        (err) => {
          don();
          if (luot === S.luotGiong && err && err.name === "NotAllowedError" && !S.tuongTac) {
            S.choPhat = { ma, chu, ts: Date.now() };
          }
          ok(false);
        }
      );
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
      u.pitch = 1.15;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // Thứ tự: giọng nữ mp3 (stream tức thì) -> giọng trình duyệt -> chỉ chữ
  async function phatGiong(ma, chu) {
    dungGiong();
    if (!ma || dangTatTieng() || imLangNhanh()) return false;
    const luot = S.luotGiong;
    const dd = duongDanAm("nu", ma);
    if (S.amThieu.has(dd)) return S.tuongTac ? noiBangTrinhDuyet(chu) : false;
    return phatTrucTiep(dd, ma, chu, luot);
  }

  // =====================================================================
  // LỜI THOẠI
  // =====================================================================
  function docLoiCache() {
    try {
      const cu = JSON.parse(luu.doc(KHOA_LOI_CACHE) || "null");
      if (cu && typeof cu === "object") S.loi = cu;
    } catch (e) { /* bỏ qua */ }
  }
  async function napLoi() {
    try {
      const res = await fetch(THU_MUC_AM + "manifest.json?v=3");
      if (!res.ok) return;
      const kq = await res.json();
      if (kq && kq.loi && typeof kq.loi === "object") {
        S.loi = kq.loi;
        luu.ghi(KHOA_LOI_CACHE, JSON.stringify(kq.loi));
      }
    } catch (e) { /* không có lời thoại thì pet vẫn chạy, chỉ im lặng */ }
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
    return S.hangCham.shift() || null;
  }

  // Nói 1 lời: hiện chữ + (nếu được phép) tải & phát giọng On-Demand. Trả true nếu có gì để nói.
  // Miệng pet: nếu skin có hành động "noi" riêng thì dùng, không thì giữ hành động đang chạy.
  function noi(ma, tuyChon) {
    const chu = (tuyChon && tuyChon.chu) || (ma && S.loi[ma]) || "";
    if (!chu && !ma) return false;
    if (chu) hienChu(chu);
    if (S.skin && S.skin.hanh_dong.includes("noi")) datHanhDong("noi", 2500);
    phatGiong(ma, chu);
    return !!chu;
  }

  // =====================================================================
  // KHỞI ĐỘNG
  // =====================================================================
  function apTrangThai(tt) {
    S.ttServer = tt;
    S.gioiTinh = "nu";
    S.soKhung = tt.so_khung || 6;
    S.fps = tt.fps || 6;
    if (tt.hieu_ung) S.hieuUng = tt.hieu_ung;
    // Nếu đang thu gọn trên mobile thì chỉ hiện nút 🦌, chưa tải sprite nặng cho tới khi người dùng bấm mở
    if (!daMoRong() && !S.skin) {
      S.skinCho = tt.skin_hien_tai;
      if (ELM.goc) ELM.goc.hidden = false;
      return Promise.resolve(true);
    }
    S.skinCho = null;
    return apDungSkin(tt.skin_hien_tai).then((ok) => { if (ok) batLoop(); return ok; });
  }

  function docTtCache() {
    try {
      const c = JSON.parse(luu.doc(KHOA_TT_CACHE) || "null");
      return c && c.skin_hien_tai ? c : null;
    } catch (e) { return null; }
  }

  async function taiTrangThai() {
    try {
      const res = await fetch(API + "/api/pet?user_id=" + encodeURIComponent(userId));
      const kq = await res.json();
      if (kq && kq.success && kq.data) {
        luu.ghi(KHOA_TT_CACHE, JSON.stringify(kq.data));
        return kq.data;
      }
      return null;
    } catch (e) { return null; }
  }

  // Lần đầu bấm/gõ phím: từ lúc này trình duyệt chắc chắn cho phát tiếng; phát nốt câu vừa bị chặn (nếu mới < 8s)
  function ghiNhanTuongTac() {
    S.tuongTac = true;
    if (S.choPhat) {
      const c = S.choPhat;
      S.choPhat = null;
      if (Date.now() - c.ts < 8000) phatGiong(c.ma, c.chu);
    }
  }
  ["pointerdown", "keydown", "touchstart"].forEach((s) =>
    window.addEventListener(s, ghiNhanTuongTac, { once: true, capture: true, passive: true }));

  let dungXong;
  const sanSang = new Promise((ok) => { dungXong = ok; });

  function xuLyChaoVaSanSang(tt) {
    window.SAOLA.vuaChaoMoi = false;
    if (daMoRong() && S.skin) {
      const khoaMoi = "saola_da_chao_moi_" + userId;
      if (!luu.doc(khoaMoi) && S.loi.chao_moi) {
        luu.ghi(khoaMoi, "1");
        luu.ghiSS("saola_da_chao", "1");
        window.SAOLA.vuaChaoMoi = true;
        noi("chao_moi");
      } else if (!luu.docSS("saola_da_chao") && S.loi.chao) {
        luu.ghiSS("saola_da_chao", "1");
        hienChu(S.loi.chao);
      }
    }
    dungXong(tt);
    window.dispatchEvent(new CustomEvent("saola-san-sang", { detail: tt }));
  }

  async function khoiDong() {
    dungGiaoDien();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
    docLoiCache();

    const ttCache = docTtCache();
    if (ttCache) {
      // Hiện Sao La & phát thoại ngay lập tức từ cache (< 50ms), rồi đồng bộ ngầm với server
      await apTrangThai(ttCache);
      xuLyChaoVaSanSang(ttCache);
      Promise.all([taiTrangThai(), napLoi()]).then(([ttMoi]) => {
        if (ttMoi && (!S.skin || (ttMoi.skin_hien_tai && ttMoi.skin_hien_tai.id !== S.skin.id))) {
          apTrangThai(ttMoi);
        }
      });
      if (!LA_FORM && Date.now() - S.thi.t >= HAN_NHO_CUOC_THI) dangCoCuocThi();
      return;
    }

    // Lần đầu tiên vào web chưa có cache: tải song song ngay, không chờ delay
    const [tt] = await Promise.all([taiTrangThai(), napLoi()]);
    if (!tt) { dungXong(null); return; }
    await apTrangThai(tt);
    xuLyChaoVaSanSang(tt);
    if (!LA_FORM && Date.now() - S.thi.t >= HAN_NHO_CUOC_THI) dangCoCuocThi();
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
