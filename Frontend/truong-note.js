// truong-note.js - Sticky-note trường mục tiêu "Nhịp tim sống" (V30 PC: Độ sẵn sàng + Trần giai đoạn + Gợi ý hành động)
(function () {
  "use strict";

  const curScript = document.currentScript || document.querySelector('script[src*="truong-note.js"]');
  const attrPage = curScript ? (curScript.getAttribute("data-page") || "").trim().toLowerCase() : "";
  const page =
    attrPage === "profile" || attrPage === "personal"
      ? attrPage
      : (location.pathname || "").toLowerCase().includes("personal")
        ? "personal"
        : "profile";

  const API = (window.VNSTARL_API || "http://127.0.0.1:5000").replace(/\/+$/, "");
  const ANH_MAC_DINH = "img/school/aaa.webp";
  const KEY_MON = {
    toan: "Toan",
    ly: "Ly",
    hoa: "Hoa",
    sinh: "Sinh",
    van: "Van",
    anh: "Anh",
    su: "Su",
    dia: "Dia",
    tin: "Tin",
  };
  const VAI_TRO = [
    { badge: "NV1 · Thử sức", loai: "thusuc" },
    { badge: "NV2 · Vừa sức", loai: "vuasuc" },
    { badge: "NV3 · An toàn", loai: "antoan" },
  ];

  let duLieuPromise = null;
  let sanSangCache = null;
  let sanSangCacheAt = 0;
  let renderSeq = 0;
  let henCapNhat = 0;

  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  function docJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  function docTrangThaiTruong() {
    const nvRaw = docJson("nguyenVong", []);
    const nguyenVong = Array.isArray(nvRaw)
      ? nvRaw.filter((x) => x && typeof x === "object" && x.id != null)
      : [];

    const tcRaw = docJson("truongChuyen", null);
    const truongChuyen =
      tcRaw && typeof tcRaw === "object" && tcRaw.id != null ? tcRaw : null;

    return { nguyenVong, truongChuyen };
  }

  // ---------- Tính điểm nền học lực Toán/Văn (45%) & Xác suất đỗ ----------
  const hopLeDiem = (x) => Number.isFinite(x) && x >= 0 && x <= 10;
  const trungBinh = (l) => l.reduce((s, x) => s + x.w * x.v, 0) / l.reduce((s, x) => s + x.w, 0);

  function erf(x) {
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y =
      1 -
      (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
        Math.exp(-x * x);
    return s * y;
  }

  const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

  function duBao(t, chuyen) {
    if (!t) return null;
    const a = t.diem_2026;
    const b = t.diem_2025;
    const coA = Number.isFinite(a);
    const coB = Number.isFinite(b);
    const sMin = chuyen ? 2.5 : 1.5;
    const sDon = chuyen ? 3.5 : 2.5;
    const nguongBD = chuyen ? 5 : 3;
    if (coA && coB) {
      const lech = Math.abs(a - b);
      return { du: 0.65 * a + 0.35 * b, sigma: Math.max(sMin, lech * 0.6), nam: 2, bienDong: lech >= nguongBD, a, b };
    }
    if (coA || coB) return { du: coA ? a : b, sigma: sDon, nam: 1, bienDong: false };
    return null;
  }

  function tinhDiemNenTuKyThi(diemChuyenAuto) {
    const KT = window.KYTHI;
    if (!KT || typeof KT.capNhatKy !== "function" || typeof KT.doc !== "function") {
      return { diem: null, diemChuyen: null };
    }
    const ky = KT.capNhatKy();
    const luu = KT.doc();
    const ds = { toan: [], van: [] };

    ky.forEach((k) => {
      if (!k.mo) return;
      ["toan", "van"].forEach((m) => {
        const raw = luu[`d-${k.id}-${m}`];
        if (raw === "" || raw === null || raw === undefined || String(raw).trim() === "") return;
        const v = Number(raw);
        if (hopLeDiem(v)) ds[m].push({ w: k.w, v });
      });
    });

    if (!ds.toan.length || !ds.van.length) {
      return { diem: null, diemChuyen: null };
    }

    const toan = trungBinh(ds.toan);
    const van = trungBinh(ds.van);
    const diem = +(toan + van + (toan + van) / 2).toFixed(1);

    // Ý 1 V30: Điểm môn chuyên KHÔNG nhập tay mà dùng chỉ số tự động từ VnStarL (Khoa cử + Bài tập + Sổ lỗi sai)
    let diemChuyen = null;
    if (typeof diemChuyenAuto === "number" && Number.isFinite(diemChuyenAuto)) {
      diemChuyen = +(toan - 1 + (van - 1) + (toan + van) / 2 + diemChuyenAuto * 2 - 3).toFixed(1);
    }
    return { diem, diemChuyen };
  }

  function taiDuLieu() {
    if (!duLieuPromise) {
      duLieuPromise = fetch("diem_chuan_2026.json")
        .then((res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(() => null);
    }
    return duLieuPromise;
  }

  async function taiSanSangBackend(force) {
    const uid = localStorage.getItem("userId");
    if (!uid) return null;
    if (!force && sanSangCache && Date.now() - sanSangCacheAt < 15000) {
      return sanSangCache;
    }
    const mon = (localStorage.getItem("monChuyen") || "").trim();
    const qs = mon ? `?mon_chuyen=${encodeURIComponent(mon)}` : "";
    try {
      const res = await fetch(`${API}/api/muc-tieu/san-sang/${uid}${qs}`);
      const kq = await res.json();
      if (res.ok && kq.success && kq.data) {
        sanSangCache = kq.data;
        sanSangCacheAt = Date.now();
        return sanSangCache;
      }
    } catch (e) { /* offline fallback */ }
    return sanSangCache;
  }

  function timTruong(danhSach, item) {
    if (!Array.isArray(danhSach) || !item) return null;
    const idStr = String(item.id);
    return danhSach.find((t) => String(t.id) === idStr) || (item.ten ? danhSach.find((t) => t.ten_truong === item.ten) : null) || null;
  }

  function chuanHoaPt(pt) {
    if (typeof pt !== "number" || !Number.isFinite(pt)) return null;
    return Math.max(0, Math.min(100, Math.round(pt)));
  }

  function tinhMucDo(pt) {
    if (pt === null) return { tier: "na", text: "Chưa ước tính", width: 0 };
    if (pt >= 70) return { tier: "cao", text: `${pt}%`, width: pt };
    if (pt >= 45) return { tier: "kha", text: `${pt}%`, width: pt };
    return { tier: "thap", text: `${pt}%`, width: pt };
  }

  // Công thức Ý 2 V30: 45% Điểm nền học lực + 55% Thực chiến VnStarL, khóa theo Trần giai đoạn
  function tinhDoSanSang(xsTruong, ss, laChuyen) {
    const tran = ss && typeof ss.tran_toi_da === "number" ? ss.tran_toi_da : 65;
    const giaiDoan = (ss && ss.giai_doan) || "Khởi động";
    const thucChien = ss
      ? (laChuyen ? Number(ss.diem_thuc_chien_chuyen) || 0 : Number(ss.diem_thuc_chien_co_so) || 0)
      : 35;

    if (xsTruong === null) {
      if (!ss) return { pt: null, biKhoaTran: false, tran, giaiDoan };
      const rawOnly = Math.round(thucChien * 0.75);
      return { pt: Math.min(tran, rawOnly), biKhoaTran: rawOnly > tran, tran, giaiDoan };
    }

    const sanSangTho = Math.round(0.45 * xsTruong + 0.55 * thucChien);
    const pt = Math.max(0, Math.min(tran, sanSangTho));
    return { pt, biKhoaTran: sanSangTho > tran, tran, giaiDoan };
  }

  // ---------- Render HTML (Ý 2 + Ý 3: Độ sẵn sàng + Nhịp tim sống + Gợi ý hành động bấm được) ----------
  function taoHtmlNote(card, tiltIdx) {
    const muc = tinhMucDo(card.pt);
    const ten = card.ten || "Trường mục tiêu";
    const imgSrc = card.chuyen ? `img/school/chuyen_${card.id}.webp` : `img/school/${card.id}.webp`;
    const chuyenCls = card.chuyen ? " tn-note--chuyen" : "";
    const tiltCls = tiltIdx != null ? ` tn-note--tilt-${tiltIdx % 4}` : "";
    const pulseCls = card.delta > 0 ? " tn-note--pulse" : "";

    const lockTitle = card.biKhoaTran
      ? `Đang khóa trần giai đoạn ${card.giaiDoan} (${card.tran}%) — hoàn thành thêm bài tập/Sổ lỗi sai để mở khóa!`
      : `Giai đoạn ${card.giaiDoan} (Trần tối đa ${card.tran}%)`;

    const lockHtml = card.biKhoaTran
      ? `<span class="tn-lock-ico" title="${esc(lockTitle)}" aria-label="${esc(lockTitle)}"><i class="fa-solid fa-lock"></i></span>`
      : "";

    const gainHtml = card.delta > 0
      ? `<span class="tn-gain-badge">+${card.delta}% ↑</span>`
      : "";

    const tip = card.tip;
    const tipHtml = tip && tip.text
      ? `<a class="tn-action-tip tn-action-tip--${esc(tip.loai || "bai_tap")}" href="${esc(tip.href || "subjects.html")}" title="Bấm để thực hiện ngay">${esc(tip.text)}</a>`
      : "";

    const barStartWidth = card.delta > 0 && card.prevPt != null ? card.prevPt : muc.width;

    return `
      <div class="tn-note tn-note--${card.loai}${chuyenCls}${tiltCls}${pulseCls}">
        <a class="tn-note-main" href="khaosat.html" title="Bấm để xem hoặc đổi nguyện vọng ở trang Khảo sát">
          <div class="tn-media">
            <img class="tn-img" src="${esc(imgSrc)}" alt="Ảnh ${esc(ten)}" loading="lazy" decoding="async">
            <span class="tn-badge tn-badge--${card.loai}">${esc(card.badge)}</span>
            <span class="tn-edit-ico" aria-hidden="true"><i class="fa-solid fa-pen-to-square"></i></span>
          </div>
          <h3 class="tn-name">${esc(ten)}</h3>
          <div class="tn-stat" title="${esc(lockTitle)}">
            <div class="tn-stat-row">
              <span class="tn-stat-label">Độ sẵn sàng:</span>
              <span class="tn-pct-group">
                ${gainHtml}
                <span class="tn-pct tn-pct--${muc.tier}">${esc(muc.text)}${lockHtml}</span>
              </span>
            </div>
            <div class="tn-bar" aria-hidden="true">
              <i class="tn-bar-fill tn-bar-fill--${muc.tier}" data-target-width="${muc.width}" style="width:${barStartWidth}%"></i>
            </div>
          </div>
        </a>
        ${tipHtml}
      </div>`;
  }

  function taoHtmlTrong(tiltIdx) {
    const tiltCls = tiltIdx != null ? ` tn-note--tilt-${tiltIdx % 4}` : "";
    return `
      <a class="tn-note tn-note--empty${tiltCls}" href="khaosat.html">
        <div class="tn-empty-ico" aria-hidden="true">🎯</div>
        <p class="tn-empty-title">Chưa ghim trường mục tiêu</p>
        <span class="tn-empty-cta">Làm khảo sát ngay ➔</span>
      </a>`;
  }

  function ganXuLyAnh(root) {
    if (!root) return;
    root.querySelectorAll("img.tn-img").forEach((img) => {
      img.addEventListener("error", function onErr() {
        if (img.dataset.fb === "1") return;
        img.dataset.fb = "1";
        img.src = ANH_MAC_DINH;
      });
    });
  }

  function kichHoatThanhTang(root) {
    if (!root) return;
    requestAnimationFrame(() => {
      root.querySelectorAll(".tn-bar-fill[data-target-width]").forEach((bar) => {
        bar.style.width = bar.dataset.targetWidth + "%";
      });
    });
  }

  function baoDamKhung() {
    const pageCls = `tn-page-${page}`;

    let railLeft = document.getElementById("tn-rail-left");
    if (!railLeft) {
      railLeft = document.createElement("aside");
      railLeft.id = "tn-rail-left";
      railLeft.className = `tn-rail tn-rail--left ${pageCls}`;
      railLeft.setAttribute("aria-label", "Nguyện vọng mục tiêu bên trái");
      document.body.appendChild(railLeft);
    }

    let railRight = document.getElementById("tn-rail-right");
    if (!railRight) {
      railRight = document.createElement("aside");
      railRight.id = "tn-rail-right";
      railRight.className = `tn-rail tn-rail--right ${pageCls}`;
      railRight.setAttribute("aria-label", "Nguyện vọng mục tiêu bên phải");
      document.body.appendChild(railRight);
    }

    const hostSelector = page === "personal" ? ".hoctap" : ".pf-wrap";
    const host = document.querySelector(hostSelector);
    let dock = document.getElementById("tn-dock");
    if (!dock && host) {
      dock = document.createElement("section");
      dock.id = "tn-dock";
      dock.className = `tn-dock ${pageCls}`;
      dock.setAttribute("aria-label", "Nguyện vọng mục tiêu");
      host.appendChild(dock);
    }

    return { railLeft, railRight, dock };
  }

  function capNhatViTriSaoLa() {
    const railRight = document.getElementById("tn-rail-right");
    if (!railRight) return;
    const saoLa = document.getElementById("sao-la");
    const hienSaoLa = !!(saoLa && !saoLa.hidden);
    railRight.classList.toggle("tn-below-saola", hienSaoLa);
  }

  function theoDoiSaoLa() {
    capNhatViTriSaoLa();
    if (typeof MutationObserver !== "function") return;
    const obs = new MutationObserver(() => capNhatViTriSaoLa());
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class"],
    });
  }

  async function capNhat(forceRefresh) {
    if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
      ["tn-rail-left", "tn-rail-right", "tn-dock"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      return;
    }

    const seq = ++renderSeq;
    const uid = localStorage.getItem("userId") || "khach";
    const snapKey = "tn_last_ready_" + uid;
    const prevSnap = docJson(snapKey, {});
    const nextSnap = {};

    const { nguyenVong, truongChuyen } = docTrangThaiTruong();
    const [data, ss] = await Promise.all([taiDuLieu(), taiSanSangBackend(Boolean(forceRefresh))]);
    if (seq !== renderSeq) return;

    const { diem, diemChuyen } = tinhDiemNenTuKyThi(ss ? ss.diem_chuyen_auto : null);
    const dsThuong = data && Array.isArray(data["Dong Thap"]) ? data["Dong Thap"] : null;
    const dsChuyenMap = data && data["Dong Thap Chuyen"] ? data["Dong Thap Chuyen"] : null;

    const tipCoSo = (ss && ss.goi_y_co_so) || { loai: "bai_tap", text: "📘 Luyện bài Toán/Văn mở trần (+3%)", href: "subjects.html" };
    const tipChuyen = (ss && ss.goi_y_chuyen) || { loai: "khoa_cu", text: "🏆 Luyện đề & Khoa cử chuyên (+4%)", href: "khoa-bang.html" };

    const cards = nguyenVong.map((item, idx) => {
      const vt = typeof item.vt === "number" && item.vt >= 0 && item.vt < VAI_TRO.length ? item.vt : idx;
      const role = VAI_TRO[vt] || { badge: `NV${vt + 1}`, loai: "antoan" };
      let xsTruong = null;
      if (diem !== null && dsThuong) {
        const t = timTruong(dsThuong, item);
        const dub = duBao(t, false);
        if (dub) xsTruong = chuanHoaPt(phi((diem - dub.du) / dub.sigma) * 100);
      }
      if (xsTruong === null) xsTruong = chuanHoaPt(item.pt);

      const ready = tinhDoSanSang(xsTruong, ss, false);
      const cardKey = "nv_" + item.id;
      const prevPt = typeof prevSnap[cardKey] === "number" ? prevSnap[cardKey] : null;
      const delta = prevPt !== null && ready.pt !== null && ready.pt > prevPt ? ready.pt - prevPt : 0;
      if (ready.pt !== null) nextSnap[cardKey] = ready.pt;

      return {
        id: item.id,
        ten: item.ten,
        vt,
        pt: ready.pt,
        prevPt,
        delta,
        biKhoaTran: ready.biKhoaTran,
        tran: ready.tran,
        giaiDoan: ready.giaiDoan,
        tip: tipCoSo,
        badge: role.badge,
        loai: role.loai,
        chuyen: false,
      };
    });

    let cardChuyen = null;
    if (truongChuyen) {
      const mon = truongChuyen.mon || localStorage.getItem("monChuyen") || "";
      const keyMon = KEY_MON[mon] || "";
      let xsTruong = null;
      if (diemChuyen !== null && dsChuyenMap && keyMon && Array.isArray(dsChuyenMap[keyMon])) {
        const t = timTruong(dsChuyenMap[keyMon], truongChuyen);
        const dub = duBao(t, true);
        if (dub) xsTruong = chuanHoaPt(phi((diemChuyen - dub.du) / dub.sigma) * 100);
      }
      if (xsTruong === null) xsTruong = chuanHoaPt(truongChuyen.pt);

      const ready = tinhDoSanSang(xsTruong, ss, true);
      const cardKey = "chuyen_" + truongChuyen.id;
      const prevPt = typeof prevSnap[cardKey] === "number" ? prevSnap[cardKey] : null;
      const delta = prevPt !== null && ready.pt !== null && ready.pt > prevPt ? ready.pt - prevPt : 0;
      if (ready.pt !== null) nextSnap[cardKey] = ready.pt;

      cardChuyen = {
        id: truongChuyen.id,
        ten: truongChuyen.ten,
        pt: ready.pt,
        prevPt,
        delta,
        biKhoaTran: ready.biKhoaTran,
        tran: ready.tran,
        giaiDoan: ready.giaiDoan,
        tip: tipChuyen,
        badge: "Chuyên",
        loai: "chuyen",
        chuyen: true,
      };
    }

    try {
      if (Object.keys(nextSnap).length > 0) {
        localStorage.setItem(snapKey, JSON.stringify({ ...prevSnap, ...nextSnap }));
      }
    } catch (e) { /* bỏ qua */ }

    const { railLeft, railRight, dock } = baoDamKhung();
    const isEmpty = cards.length === 0 && !cardChuyen;

    if (isEmpty) {
      railLeft.innerHTML = taoHtmlTrong(0);
      railRight.innerHTML = "";
      if (dock) {
        dock.innerHTML = `
          <div class="tn-dock-head">
            <h2 class="tn-dock-title">📌 Nguyện vọng mục tiêu</h2>
          </div>
          <div class="tn-dock-grid tn-dock-grid--empty">
            ${taoHtmlTrong(null)}
          </div>`;
      }
    } else {
      const leftCards = [];
      const rightCards = [];
      cards.forEach((c, idx) => {
        if (c.vt === 0 || c.vt === 1 || (c.vt > 2 && idx < 2)) leftCards.push(c);
        else rightCards.push(c);
      });
      if (cardChuyen) rightCards.push(cardChuyen);

      if (cards.length === 0 && cardChuyen) {
        railLeft.innerHTML = taoHtmlTrong(0);
      } else {
        railLeft.innerHTML = leftCards.map((c, i) => taoHtmlNote(c, i)).join("");
      }
      railRight.innerHTML = rightCards.map((c, i) => taoHtmlNote(c, i + 2)).join("");

      if (dock) {
        const allCards = [...leftCards, ...rightCards];
        dock.innerHTML = `
          <div class="tn-dock-head">
            <h2 class="tn-dock-title">📌 Nguyện vọng mục tiêu</h2>
            <a class="tn-dock-edit" href="khaosat.html">Đổi trường</a>
          </div>
          <div class="tn-dock-grid">
            ${allCards.map((c) => taoHtmlNote(c, null)).join("")}
          </div>`;
      }
    }

    ganXuLyAnh(railLeft);
    ganXuLyAnh(railRight);
    ganXuLyAnh(dock);
    kichHoatThanhTang(railLeft);
    kichHoatThanhTang(railRight);
    kichHoatThanhTang(dock);
    capNhatViTriSaoLa();
  }

  function lenLichCapNhat(force) {
    clearTimeout(henCapNhat);
    henCapNhat = setTimeout(() => capNhat(Boolean(force)), 30);
  }

  function khoiTao() {
    theoDoiSaoLa();
    capNhat(true);

    const bangDiem = document.getElementById("bang-diem");
    if (bangDiem) {
      bangDiem.addEventListener("input", () => lenLichCapNhat(false));
      bangDiem.addEventListener("change", () => lenLichCapNhat(false));
    }

    window.addEventListener("vnstarl:diem-updated", () => lenLichCapNhat(false));

    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === "nguyenVong" || e.key === "truongChuyen" || e.key === "monChuyen" || e.key.startsWith("edumate_diem_")) {
        lenLichCapNhat(true);
      }
    });

    window.addEventListener("pageshow", () => lenLichCapNhat(true));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", khoiTao);
  } else {
    khoiTao();
  }
})();
