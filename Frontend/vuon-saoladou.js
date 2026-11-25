// vuon-saoladou.js - Vườn Saoladou V28 (3 thanh chỉ số phân đoạn · Online/Offline · Ốm ngất · Ngồi ghế · Giờ ngủ)
(function () {
  "use strict";

  const API = typeof API_SERVER === "string" ? API_SERVER : "http://127.0.0.1:5000";
  const giamChuyenDong = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const luu = {
    doc(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    ghi(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* bỏ qua */
      }
    },
  };

  function getUserId() {
    if (luu.doc("isLoggedIn") !== "true") return null;
    const raw = luu.doc("userId");
    if (!raw || !/^\d+$/.test(String(raw).trim())) return null;
    return String(raw).trim();
  }

  function getToken() {
    return luu.doc("kbToken") || "";
  }

  function formatGiay(sec) {
    const s = Math.max(0, Math.ceil(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    if (h > 0) return h + ":" + pad(m) + ":" + pad(r);
    return m + ":" + pad(r);
  }

  function playSfx(kind) {
    try {
      if (!window.AmThanh) return;
      if (kind === "ok" && typeof window.AmThanh.dung === "function") {
        window.AmThanh.dung();
      } else if (typeof window.AmThanh.bam === "function") {
        window.AmThanh.bam();
      }
    } catch (e) {
      /* bỏ qua lỗi audio */
    }
  }

  function createCoinImg(cls) {
    const img = document.createElement("img");
    img.src = "img/pet/educoin.webp";
    img.alt = "EduCoin";
    img.className = cls || "vuon-coin-ico";
    img.decoding = "async";
    return img;
  }

  // ---------- Đọc Giờ Ngủ & Giờ Thức Dậy từ trang Cá nhân hóa (personal.js) ----------
  function parseMinutesOfDay(str, fallbackMin) {
    const m = String(str || "").trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{0,2})$/);
    if (!m) return fallbackMin;
    const h = Number(m[1]);
    const p = Number(m[2] || 0);
    if (h >= 0 && h < 24 && p >= 0 && p < 60) return h * 60 + p;
    return fallbackMin;
  }

  function formatMinutesHHMM(totalMin) {
    const m = ((totalMin % 1440) + 1440) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return hh + ":" + mm;
  }

  function getPersonalSleepSchedule() {
    let rawNgu = "21:30";
    let rawBatDau = "06:00";
    if (userId) {
      try {
        const saved = JSON.parse(luu.doc("edumate_hoctap_" + userId) || "{}");
        if (saved && saved.gio) {
          if (saved.gio.ngu) rawNgu = saved.gio.ngu;
          if (saved.gio.batDau) rawBatDau = saved.gio.batDau;
        }
      } catch (e) {
        /* giữ mặc định */
      }
    }
    const sleepMin = parseMinutesOfDay(rawNgu, 21 * 60 + 30);
    const wakeMin = parseMinutesOfDay(rawBatDau, 6 * 60);
    return {
      sleepMin,
      wakeMin,
      sleepStr: formatMinutesHHMM(sleepMin),
      wakeStr: formatMinutesHHMM(wakeMin),
    };
  }

  function isInSleepWindow(nowDate) {
    const now = nowDate || new Date();
    const { sleepMin, wakeMin } = getPersonalSleepSchedule();
    if (sleepMin === wakeMin) return false;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (sleepMin > wakeMin) {
      return nowMin >= sleepMin || nowMin < wakeMin;
    }
    return nowMin >= sleepMin && nowMin < wakeMin;
  }

  // ---------- Icon SVG sắc nét cho từng vật phẩm Rừng Trường Sơn ----------
  const ITEM_ICONS = {
    duong_xi:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 41V11" stroke="#15803d" stroke-width="3" stroke-linecap="round"/><path d="M24 33c-7-1-12-5-13-11 5 1 9 4 13 9m0-8c-6-2-10-6-10-12 4 1 8 4 10 9m0 13c7-1 12-5 13-11-5 1-9 4-13 9m0-8c6-2 10-6 10-12-4 1-8 4-10 9" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="10" r="3" fill="#4ade80"/></svg>',
    la_sung:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M12 36C12 20 22 10 38 10c0 16-10 26-26 26Z" fill="#4ade80" stroke="#15803d" stroke-width="2.4"/><path d="M12 36L32 16M21 27l-4-6m8 2l5 4" stroke="#166534" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="18" r="4" fill="#fb7185" stroke="#be123c" stroke-width="1.6"/></svg>',
    mon_thuc:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 41V24" stroke="#166534" stroke-width="3.2" stroke-linecap="round"/><path d="M24 28c-9 0-14-6-12-14 6 0 11 4 12 14Zm0 0c9 0 14-6 12-14-6 0-11 4-12 14Z" fill="#22c55e" stroke="#15803d" stroke-width="2.2"/><ellipse cx="24" cy="16" rx="5" ry="9" fill="#86efac" stroke="#15803d" stroke-width="2"/></svg>',
    ray_rung:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 41c-3-10-2-19 0-27" stroke="#14532d" stroke-width="3" stroke-linecap="round"/><path d="M24 10c-10 2-15 11-11 20 4 4 8 2 11-2 3 4 7 6 11 2 4-9-1-18-11-20Z" fill="#16a34a" stroke="#14532d" stroke-width="2.2"/><path d="M24 12v18m-6-9 6 3m6-3-6 3" stroke="#bbf7d0" stroke-width="2" stroke-linecap="round"/></svg>',
    ho_trom:
      '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="14" fill="#dcfce7" stroke="#16a34a" stroke-width="2.2"/><path d="M24 11l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1 4-9Z" fill="#22c55e" stroke="#15803d" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    nuoc_suoi:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 7C17 17 12 24 12 31a12 12 0 0 0 24 0c0-7-5-14-12-24Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2.4"/><path d="M19 32a5 5 0 0 0 5 5" stroke="#e0f2fe" stroke-width="2.6" stroke-linecap="round"/></svg>',
    thao_duoc:
      '<svg viewBox="0 0 48 48" fill="none"><rect x="11" y="18" width="26" height="20" rx="6" fill="#fef3c7" stroke="#b45309" stroke-width="2.2"/><path d="M24 23v10m-5-5h10" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/><path d="M18 18c-3-6 1-11 6-11s9 5 6 11" stroke="#15803d" stroke-width="2.2" fill="#4ade80"/></svg>',
    ban_chai:
      '<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="25" width="32" height="8" rx="4" fill="#d97706" stroke="#78350f" stroke-width="2"/><path d="M13 25v-8m5 8v-8m5 8v-8m5 8v-8m5 8v-8" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/><path d="M11 17h24" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>',
    bong_may:
      '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="15" fill="#fde68a" stroke="#b45309" stroke-width="2.4"/><path d="M11 19c8 4 18 4 26 0M11 29c8-4 18-4 26 0M19 10c4 9 4 19 0 28M29 10c-4 9-4 19 0 28" stroke="#92400e" stroke-width="2"/></svg>',
    sao_truc:
      '<svg viewBox="0 0 48 48" fill="none"><g transform="rotate(-28 24 24)"><rect x="6" y="20" width="36" height="8" rx="4" fill="#a3e635" stroke="#3f6212" stroke-width="2.2"/><circle cx="18" cy="24" r="1.7" fill="#3f6212"/><circle cx="24" cy="24" r="1.7" fill="#3f6212"/><circle cx="30" cy="24" r="1.7" fill="#3f6212"/><circle cx="35" cy="24" r="1.7" fill="#3f6212"/></g><path d="M35 12v8m0-8l5-1v7" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lan_rung:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M14 39c6-3 14-3 20 0" stroke="#15803d" stroke-width="3" stroke-linecap="round"/><path d="M24 38V20" stroke="#166534" stroke-width="2.5"/><circle cx="24" cy="15" r="5" fill="#f472b6"/><circle cx="17" cy="21" r="4.5" fill="#e879f9"/><circle cx="31" cy="21" r="4.5" fill="#c084fc"/><circle cx="24" cy="15" r="2" fill="#fef08a"/></svg>',
    den_dom_dom:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v7" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/><rect x="14" y="13" width="20" height="24" rx="8" fill="#fef08a" stroke="#b45309" stroke-width="2.4"/><path d="M14 21h20M14 29h20" stroke="#d97706" stroke-width="1.8"/><circle cx="24" cy="25" r="4" fill="#f59e0b"/></svg>',
    ghe_da:
      '<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="21" width="32" height="8" rx="4" fill="#94a3b8" stroke="#475569" stroke-width="2.2"/><path d="M14 29v9m20-9v9" stroke="#64748b" stroke-width="5" stroke-linecap="round"/><path d="M12 21c3-2 7-2 10 0" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round"/></svg>',
    bang_ten:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 28v13" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><rect x="8" y="11" width="32" height="18" rx="4" fill="#d97706" stroke="#78350f" stroke-width="2.4"/><path d="M14 18h20m-16 5h12" stroke="#fef3c7" stroke-width="2.2" stroke-linecap="round"/></svg>',
    hoa_sen:
      '<svg viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="34" rx="16" ry="6" fill="#22c55e" stroke="#15803d" stroke-width="2"/><path d="M24 12c4 6 5 12 0 18-5-6-4-12 0-18Z" fill="#f472b6" stroke="#be185d" stroke-width="1.8"/><path d="M24 30c-7-1-12-6-11-12 5 1 9 5 11 12Zm0 0c7-1 12-6 11-12-5 1-9 5-11 12Z" fill="#f9a8d4" stroke="#be185d" stroke-width="1.8"/><circle cx="24" cy="24" r="3" fill="#fde047"/></svg>',
    leu_trai:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 8 6 38h36L24 8Z" fill="#fef3c7" stroke="#0f766e" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 8 15 38h18L24 8Z" fill="#14b8a6" opacity="0.3"/><path d="M24 22 18 38h12L24 22Z" fill="#f59e0b" stroke="#92400e" stroke-width="1.8" stroke-linejoin="round"/><path d="M24 4v5" stroke="#78350f" stroke-width="2.4" stroke-linecap="round"/></svg>',
    chuong_gio:
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 5v6M12 13h24" stroke="#78350f" stroke-width="3" stroke-linecap="round"/><rect x="14" y="16" width="4" height="18" rx="2" fill="#a3e635" stroke="#3f6212" stroke-width="1.6"/><rect x="20" y="16" width="4" height="22" rx="2" fill="#bef264" stroke="#3f6212" stroke-width="1.6"/><rect x="26" y="16" width="4" height="19" rx="2" fill="#a3e635" stroke="#3f6212" stroke-width="1.6"/><rect x="32" y="16" width="4" height="15" rx="2" fill="#84cc16" stroke="#3f6212" stroke-width="1.6"/></svg>',
    suoi_nam:
      '<svg viewBox="0 0 48 48" fill="none"><rect x="21" y="25" width="7" height="14" rx="3" fill="#fef3c7" stroke="#92400e" stroke-width="1.8"/><path d="M11 26c0-9 6-14 13.5-14S38 17 38 26H11Z" fill="#fb923c" stroke="#9a3412" stroke-width="2"/><circle cx="19" cy="19" r="2.3" fill="#fef08a"/><circle cx="29" cy="20" r="2" fill="#fef08a"/><rect x="11" y="31" width="5" height="8" rx="2" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.5"/><path d="M6 32c0-5 3.5-8 7.5-8S21 27 21 32H6Z" fill="#38bdf8" stroke="#0369a1" stroke-width="1.6"/></svg>',
  };

  function getItemIconHtml(id) {
    return ITEM_ICONS[id] || '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="16" fill="#d1fae5" stroke="#059669" stroke-width="2.4"/><path d="M24 15v18m-9-9h18" stroke="#047857" stroke-width="2.6" stroke-linecap="round"/></svg>';
  }

  const DECOR_SCENE_SVGS = {
    lan_rung:
      '<svg viewBox="0 0 110 100" fill="none" aria-hidden="true">' +
      '<ellipse cx="55" cy="86" rx="38" ry="10" fill="#15803d" opacity="0.28"/>' +
      '<path d="M28 84c6-18 16-24 27-24s21 6 27 24Z" fill="#22c55e" stroke="#166534" stroke-width="2.2"/>' +
      '<path d="M55 68V26M55 56c-11-3-18-10-21-18M55 52c11-3 18-10 21-18" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="55" cy="22" r="9" fill="#f472b6" stroke="#be185d" stroke-width="1.8"/><circle cx="55" cy="22" r="3.5" fill="#fef08a"/>' +
      '<circle cx="34" cy="37" r="8" fill="#e879f9" stroke="#a21caf" stroke-width="1.8"/><circle cx="34" cy="37" r="3" fill="#fef08a"/>' +
      '<circle cx="76" cy="37" r="8" fill="#c084fc" stroke="#7e22ce" stroke-width="1.8"/><circle cx="76" cy="37" r="3" fill="#fef08a"/>' +
      "</svg>" +
      '<svg class="vuon-butterfly" viewBox="0 0 28 22" fill="none" aria-hidden="true">' +
      '<path d="M14 11C10 2 2 3 3 10c1 4 6 4 11 1Zm0 0c4-9 12-8 11-1-1 4-6 4-11 1Z" fill="#fde047" stroke="#ca8a04" stroke-width="1.4"/>' +
      '<path d="M14 12c-4 2-6 7-2 8 2 0 2-4 2-8Zm0 0c4 2 6 7 2 8-2 0-2-4-2-8Z" fill="#fb923c" stroke="#c2410c" stroke-width="1.2"/>' +
      "</svg>",
    den_dom_dom:
      '<svg viewBox="0 0 80 128" fill="none" aria-hidden="true">' +
      '<path d="M40 0v24" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M24 26h32l-4 7H28l-4-7Z" fill="#92400e" stroke="#78350f" stroke-width="2"/>' +
      '<rect x="20" y="33" width="40" height="48" rx="16" fill="#fef08a" stroke="#b45309" stroke-width="2.6"/>' +
      '<circle cx="40" cy="57" r="11" fill="#fde047" opacity="0.9"/>' +
      '<path d="M20 48h40M20 64h40M40 33v48" stroke="#d97706" stroke-width="1.8" opacity="0.75"/>' +
      '<path d="M28 81h24l-3 7H31l-3-7Z" fill="#92400e" stroke="#78350f" stroke-width="2"/>' +
      "</svg>" +
      '<span class="vuon-firefly vuon-firefly--1"></span>' +
      '<span class="vuon-firefly vuon-firefly--2"></span>' +
      '<span class="vuon-firefly vuon-firefly--3"></span>',
    ghe_da:
      '<svg viewBox="0 0 132 80" fill="none" aria-hidden="true">' +
      '<ellipse cx="66" cy="68" rx="52" ry="9" fill="#0f172a" opacity="0.2"/>' +
      '<rect x="26" y="46" width="16" height="22" rx="4" fill="#64748b" stroke="#475569" stroke-width="2"/>' +
      '<rect x="90" y="46" width="16" height="22" rx="4" fill="#64748b" stroke="#475569" stroke-width="2"/>' +
      '<rect x="12" y="32" width="108" height="16" rx="7" fill="#cbd5e1" stroke="#475569" stroke-width="2.4"/>' +
      '<path d="M20 34c8-4 18-4 26 0m38 0c7-3 15-3 22 0" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/>' +
      "</svg>",
    hoa_sen:
      '<svg viewBox="0 0 118 76" fill="none" aria-hidden="true">' +
      '<ellipse cx="58" cy="56" rx="48" ry="13" fill="#0284c7" opacity="0.22"/>' +
      '<path d="M16 52 C14 40 36 34 56 38 L42 50 L62 56 C44 64 18 62 16 52 Z" fill="#16a34a" stroke="#14532d" stroke-width="2"/>' +
      '<path d="M58 52 C60 40 84 36 104 44 C106 54 90 62 72 60 L82 52 Z" fill="#22c55e" stroke="#15803d" stroke-width="2"/>' +
      '<path d="M58 14 C65 24 66 36 58 46 C50 36 51 24 58 14 Z" fill="#f472b6" stroke="#be185d" stroke-width="1.8"/>' +
      '<path d="M58 46 C44 44 35 35 37 25 C46 27 54 34 58 46 Z" fill="#f9a8d4" stroke="#be185d" stroke-width="1.8"/>' +
      '<path d="M58 46 C72 44 81 35 79 25 C70 27 62 34 58 46 Z" fill="#f9a8d4" stroke="#be185d" stroke-width="1.8"/>' +
      '<path d="M58 46 C48 48 40 44 40 36 C48 37 54 40 58 46 Z" fill="#fbcfe8" stroke="#db2777" stroke-width="1.5"/>' +
      '<path d="M58 46 C68 48 76 44 76 36 C68 37 62 40 58 46 Z" fill="#fbcfe8" stroke="#db2777" stroke-width="1.5"/>' +
      '<circle cx="58" cy="36" r="4.5" fill="#fde047"/>' +
      "</svg>",
    leu_trai:
      '<svg viewBox="0 0 154 114" fill="none" aria-hidden="true">' +
      '<ellipse cx="77" cy="100" rx="64" ry="11" fill="#0f172a" opacity="0.24"/>' +
      '<path d="M77 12 L18 96 L136 96 Z" fill="#fef3c7" stroke="#0f766e" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M77 12 L100 96 L136 96 Z" fill="#0d9488" opacity="0.88"/>' +
      '<path d="M77 12 L52 96 L18 96 Z" fill="#14b8a6" opacity="0.82"/>' +
      '<path class="vuon-tent-glow" d="M77 44 L56 96 L98 96 Z" fill="#334155" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/>' +
      '<path class="vuon-tent-beam" d="M56 96 L36 108 L118 108 L98 96 Z" fill="#fde047" opacity="0"/>' +
      '<path d="M77 6 v10 M77 10 l14 4 l-14 4" fill="#fb7185" stroke="#be123c" stroke-width="1.6" stroke-linejoin="round"/>' +
      "</svg>",
    chuong_gio:
      '<svg viewBox="0 0 80 120" fill="none" aria-hidden="true">' +
      '<path d="M40 0v14" stroke="#78350f" stroke-width="2.8" stroke-linecap="round"/>' +
      '<ellipse cx="40" cy="18" rx="22" ry="6" fill="#92400e" stroke="#78350f" stroke-width="2"/>' +
      '<path d="M24 22v10 M34 24v12 M46 24v10 M56 22v12" stroke="#d97706" stroke-width="1.6"/>' +
      '<rect x="20" y="32" width="7" height="36" rx="3.5" fill="#a3e635" stroke="#3f6212" stroke-width="1.8"/>' +
      '<rect x="31" y="35" width="7" height="44" rx="3.5" fill="#bef264" stroke="#3f6212" stroke-width="1.8"/>' +
      '<rect x="42" y="34" width="7" height="39" rx="3.5" fill="#a3e635" stroke="#3f6212" stroke-width="1.8"/>' +
      '<rect x="53" y="33" width="7" height="30" rx="3.5" fill="#84cc16" stroke="#3f6212" stroke-width="1.8"/>' +
      '<path d="M40 24v62" stroke="#b45309" stroke-width="1.6"/>' +
      '<circle cx="40" cy="92" r="7" fill="#fef08a" stroke="#b45309" stroke-width="2"/>' +
      "</svg>" +
      '<span class="vuon-chime-note vuon-chime-note--1">♪</span>' +
      '<span class="vuon-chime-note vuon-chime-note--2">♫</span>',
    suoi_nam:
      '<svg viewBox="0 0 108 86" fill="none" aria-hidden="true">' +
      '<ellipse cx="54" cy="74" rx="42" ry="9" fill="#0f172a" opacity="0.2"/>' +
      '<g class="vuon-mush-glow">' +
      '<rect x="47" y="42" width="14" height="30" rx="6" fill="#fef3c7" stroke="#92400e" stroke-width="2"/>' +
      '<path d="M26 44 C26 24 38 14 54 14 C70 14 82 24 82 44 Z" fill="#fb923c" stroke="#9a3412" stroke-width="2.2"/>' +
      '<circle cx="42" cy="28" r="4" fill="#fef08a"/><circle cx="62" cy="26" r="3.4" fill="#fef08a"/><circle cx="53" cy="36" r="3" fill="#fef08a"/>' +
      '<rect x="21" y="54" width="10" height="19" rx="4.5" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.8"/>' +
      '<path d="M10 56 C10 44 17 38 26 38 C35 38 42 44 42 56 Z" fill="#38bdf8" stroke="#0369a1" stroke-width="2"/>' +
      '<circle cx="22" cy="47" r="2.6" fill="#bae6fd"/><circle cx="31" cy="49" r="2.2" fill="#bae6fd"/>' +
      '<rect x="75" y="57" width="9" height="16" rx="4" fill="#dcfce7" stroke="#15803d" stroke-width="1.8"/>' +
      '<path d="M66 59 C66 49 72 44 79.5 44 C87 44 93 49 93 59 Z" fill="#34d399" stroke="#065f46" stroke-width="2"/>' +
      '<circle cx="77" cy="51" r="2.2" fill="#fef08a"/>' +
      "</g>" +
      "</svg>",
  };

  const DEFAULT_DECOR_POS = {
    lan_rung: { left: "43%", bottom: "18%" },
    den_dom_dom: { left: "81%", bottom: "26%" },
    ghe_da: { left: "65%", bottom: "20%" },
    bang_ten: { left: "39%", bottom: "36%" },
    hoa_sen: { left: "14%", bottom: "16%" },
    leu_trai: { left: "22%", bottom: "37%" },
    chuong_gio: { left: "94%", bottom: "29%" },
    suoi_nam: { left: "72%", bottom: "31%" },
  };

  const WANDER_LINES = [
    "Lá rừng hôm nay xanh mướt quá!",
    "Dạo một vòng quanh bãi cỏ cho khỏe chân nào~",
    "Nghe tiếng suối chảy êm tai ghê!",
    "Bạn nhớ ôn bài đều đặn để kiếm thêm EduCoin nhé!",
    "Hôm nay trời Trường Sơn đẹp thật đó!",
  ];

  const BENCH_LINES = [
    "Ngồi ghế đá ngắm mây trời Trường Sơn chill quá đi!",
    "Gió rừng mát rượi, ngồi ghế đá nghỉ chân thích ghê~",
    "Ngồi đây hóng gió một lát rồi mình lại cùng học bài nha!",
  ];

  const FOOD_IDS = new Set(["duong_xi", "la_sung", "mon_thuc", "ray_rung", "ho_trom", "thao_duoc"]);
  const PLAY_IDS = new Set(["bong_may", "sao_truc", "ban_chai"]);

  const GROUP_META = [
    { id: "thuc_an", title: "Thức ăn thực vật (5)", pill: "🌿 Thức ăn" },
    { id: "cham_soc", title: "Chăm sóc & Thảo dược (3)", pill: "💧 Chăm sóc" },
    { id: "do_choi", title: "Đồ chơi (2)", pill: "🎵 Đồ chơi" },
    { id: "trang_tri", title: "Trang trí Vườn (8)", pill: "🪷 Trang trí" },
  ];

  const DOCK_FILTERS = [
    { id: "all", label: "Tất cả" },
    { id: "thuc_an", label: "Thức ăn" },
    { id: "cham_soc", label: "Chăm sóc" },
    { id: "do_choi", label: "Đồ chơi" },
    { id: "trang_tri", label: "Trang trí" },
  ];

  // ---------- Tham chiếu DOM ----------
  const userId = getUserId();
  const elLoading = document.getElementById("vuon-loading");
  const elLoginCta = document.getElementById("vuon-login-cta");
  const elError = document.getElementById("vuon-error");
  const elErrorMsg = document.getElementById("vuon-error-msg");
  const elRetryBtn = document.getElementById("vuon-retry-btn");
  const elLocalBtn = document.getElementById("vuon-local-btn");
  const elStage = document.getElementById("vuon-stage");

  const elHealthPill = document.getElementById("vuon-health-pill");
  const elValNo = document.getElementById("vuon-val-no");
  const elBarNo = document.getElementById("vuon-bar-no");
  const elValVui = document.getElementById("vuon-val-vui");
  const elBarVui = document.getElementById("vuon-bar-vui");
  const elValSach = document.getElementById("vuon-val-sach");
  const elBarSach = document.getElementById("vuon-bar-sach");

  const elEducoin = document.getElementById("vuon-educoin");
  const elBxhSub = document.getElementById("vuon-bxh-sub");
  const elTabBtnVuon = document.getElementById("tab-btn-vuon");
  const elTabBtnShop = document.getElementById("tab-btn-shop");
  const elToast = document.getElementById("vuon-toast-banner");

  const elScene = document.getElementById("vuon-scene");
  const elArena = document.getElementById("vuon-arena");
  const elWorld = document.getElementById("vuon-world");
  const elPingLayer = document.getElementById("vuon-ping-layer");
  const elTimeSwitch = document.getElementById("vuon-time-switch");
  const elBadgeSong = document.getElementById("vuon-badge-song");
  const elBadgeCay = document.getElementById("vuon-badge-cay");
  const elDecorLayer = document.getElementById("vuon-decor-layer");
  const elPetWrap = document.getElementById("vuon-pet-wrap");
  const elPetBtn = document.getElementById("vuon-pet-btn");
  const elPetSprite = document.getElementById("vuon-pet-sprite");
  const elPetFx = document.getElementById("vuon-pet-fx");
  const elPetSickFx = document.getElementById("vuon-pet-sick-fx");
  const elPetHint = document.getElementById("vuon-pet-hint");
  const elSpeech = document.getElementById("vuon-speech");
  const elFloatLayer = document.getElementById("vuon-float-layer");

  const elDock = document.getElementById("vuon-dock");
  const elDockToggle = document.getElementById("vuon-dock-toggle");
  const elDockFilters = document.getElementById("vuon-dock-filters");
  const elDockItems = document.getElementById("vuon-dock-items");

  const elShop = document.getElementById("vuon-shop");
  const elShopFilters = document.getElementById("vuon-shop-filters");
  const elShopBody = document.getElementById("vuon-shop-body");

  // ---------- Trạng thái ứng dụng ----------
  const app = {
    data: null,
    syncedAt: 0,
    activeTab: "vuon",
    dockFilter: "all",
    shopFilter: "all",
    busy: false,
    toastTimer: 0,
    speechTimer: 0,
    actionTimer: 0,
    tickInterval: 0,
    heartbeatInterval: 0,
    heartbeatBusy: false,
    timeMode: "auto",
    timeInterval: 0,
    pos: { x: 50, y: 20 },
    isMoving: false,
    moveTicket: 0,
    moveTimer: 0,
    envState: "idle",
    envTimer: 0,
    wanderTimer: 0,
    lastUserActionAt: 0,
    wasSleeping: false,
    isAnnoyed: false,
    annoyedTimer: 0,
    sleepPokeCount: 0,
    sleepPokeResetTimer: 0,
    wiggleTimer: 0,
  };

  function isPetSick() {
    const sk = app.data && ((app.data.trang_thai && app.data.trang_thai.suc_khoe) || app.data.suc_khoe);
    return sk === "om";
  }

  function isSleepActive() {
    return Boolean(app.data && !isPetSick() && isInSleepWindow(new Date()));
  }

  // ---------- Sprite Engine (6-frame horizontal + holdLastFrame cho om_met) ----------
  const sprite = {
    skinKey: "",
    bodyImg: null,
    bodyUrl: "",
    fxImg: null,
    fxUrl: "",
    frames: 6,
    fps: 6,
    idx: 0,
    fxIdx: 0,
    lastFrameAt: 0,
    rafId: 0,
    loadTicket: 0,
    action: "idle",
    holdLastFrame: false,
  };

  function applySpriteBg(el, img, frames) {
    el.classList.remove("is-fallback");
    el.style.backgroundImage = 'url("' + img.src + '")';
    el.style.backgroundSize = frames * 100 + "% 100%";
    el.style.backgroundPosition = "0% 0";
  }

  function stepSpriteFrame(el, frames, idx) {
    const pct = frames > 1 ? (idx / (frames - 1)) * 100 : 0;
    el.style.backgroundPosition = pct + "% 0";
  }

  function startSpriteLoop() {
    if (sprite.rafId || giamChuyenDong || document.hidden) return;
    const loop = (ts) => {
      if (document.hidden || giamChuyenDong || !sprite.bodyImg) {
        sprite.rafId = 0;
        return;
      }
      sprite.rafId = requestAnimationFrame(loop);
      const interval = 1000 / Math.max(1, sprite.fps || 6);
      if (ts - sprite.lastFrameAt < interval) return;
      sprite.lastFrameAt = ts;
      if (sprite.bodyImg && sprite.frames > 1) {
        if (sprite.holdLastFrame) {
          if (sprite.idx < sprite.frames - 1) {
            sprite.idx += 1;
            stepSpriteFrame(elPetSprite, sprite.frames, sprite.idx);
          }
        } else {
          sprite.idx = (sprite.idx + 1) % sprite.frames;
          stepSpriteFrame(elPetSprite, sprite.frames, sprite.idx);
        }
      }
      if (sprite.fxImg && sprite.frames > 1) {
        sprite.fxIdx = (sprite.fxIdx + 1) % sprite.frames;
        stepSpriteFrame(elPetFx, sprite.frames, sprite.fxIdx);
      }
    };
    sprite.rafId = requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && sprite.bodyImg) startSpriteLoop();
  });

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function getIdleAction() {
    if (isPetSick()) return ["om_met", "vuon_idle", "idle"];
    if (isSleepActive() && !app.isAnnoyed) return ["ngu", "nghi_ngoi", "idle"];
    return ["vuon_idle", "idle"];
  }

  function getIdleSpriteOpts() {
    return isPetSick() ? { holdLastFrame: true } : { holdLastFrame: false };
  }

  function resolveAction(preferred, hanhDongList) {
    if (Array.isArray(preferred)) {
      for (let i = 0; i < preferred.length; i++) {
        if (preferred[i] && hanhDongList.includes(preferred[i])) return preferred[i];
      }
      return "idle";
    }
    return preferred && hanhDongList.includes(preferred) ? preferred : "idle";
  }

  async function syncPetSprite(actionName, fxName, opts) {
    const data = app.data;
    if (!data) return;
    const skin = data.skin_hien_tai || { id: "mac_dinh", thu_muc: "img/pet/than/mac_dinh/", hanh_dong: ["idle"], v: 0 };
    const sid = "mac_dinh";
    const thuMuc = skin.thu_muc || "img/pet/than/mac_dinh/";
    const ver = skin.v || 0;
    const hanhDongList = Array.isArray(skin.hanh_dong) ? skin.hanh_dong : ["idle"];
    const targetAction = resolveAction(actionName, hanhDongList);
    const holdLastFrame = Boolean(opts && opts.holdLastFrame && targetAction === "om_met");

    sprite.frames = Math.max(1, Number(data.so_khung) || 6);
    sprite.fps = Math.max(1, Number(data.fps) || 6);
    sprite.action = targetAction;

    const url = thuMuc + targetAction + ".webp?v=" + ver;
    const idleUrl = thuMuc + "idle.webp?v=" + ver;
    const fallbackUrl = skin.xem_truoc || "img/pet/than/mac_dinh/_xem_truoc.webp?v=" + ver;
    const key = sid + "|" + targetAction + "|" + ver + "|" + (holdLastFrame ? "hold" : "loop");
    const needsFx = fxName && (targetAction === "idle" || targetAction === "vuon_idle");
    const fxUrl = needsFx ? "img/pet/hieu_ung/" + encodeURIComponent(fxName) + ".webp" : "";

    if (sprite.skinKey === key && sprite.fxUrl === fxUrl && sprite.bodyImg) {
      sprite.holdLastFrame = holdLastFrame;
      startSpriteLoop();
      return;
    }

    const ticket = ++sprite.loadTicket;
    let [bodyImg, fxImg] = await Promise.all([
      sprite.bodyUrl === url && sprite.bodyImg ? Promise.resolve(sprite.bodyImg) : loadImage(url),
      fxUrl ? loadImage(fxUrl) : Promise.resolve(null),
    ]);
    if (!bodyImg && targetAction !== "idle") {
      bodyImg = await loadImage(idleUrl);
    }
    if (ticket !== sprite.loadTicket) return;

    sprite.skinKey = key;
    sprite.bodyUrl = bodyImg ? bodyImg.src : url;
    sprite.fxUrl = fxUrl;
    sprite.holdLastFrame = holdLastFrame;
    sprite.idx = holdLastFrame && giamChuyenDong ? Math.max(0, sprite.frames - 1) : 0;
    sprite.fxIdx = 0;

    if (bodyImg) {
      sprite.bodyImg = bodyImg;
      applySpriteBg(elPetSprite, bodyImg, sprite.frames);
      if (sprite.idx > 0) {
        stepSpriteFrame(elPetSprite, sprite.frames, sprite.idx);
      }
    } else {
      sprite.bodyImg = null;
      elPetSprite.classList.add("is-fallback");
      elPetSprite.style.backgroundImage = 'url("' + fallbackUrl + '")';
    }

    if (fxImg) {
      sprite.fxImg = fxImg;
      applySpriteBg(elPetFx, fxImg, sprite.frames);
    } else {
      sprite.fxImg = null;
      elPetFx.style.backgroundImage = "none";
    }

    startSpriteLoop();
  }

  function triggerPetEffect(actionName, fxName, durationMs) {
    clearTimeout(app.actionTimer);
    elPetBtn.classList.remove("is-petting");
    void elPetBtn.offsetWidth;
    elPetBtn.classList.add("is-petting");
    syncPetSprite(actionName || ["choi_vui", "vuon_idle"], fxName || "sao", { holdLastFrame: false });
    app.actionTimer = setTimeout(() => {
      elPetBtn.classList.remove("is-petting");
      if (!app.isMoving && app.envState === "idle") {
        syncPetVisualState(false);
      }
    }, durationMs || 2400);
  }

  // ---------- Đồng bộ Trạng thái Ốm ngất & Giờ Ngủ Cá nhân hóa ----------
  function syncPetVisualState(initialLoad) {
    if (!app.data) return;
    const sick = isPetSick();
    const sleeping = isSleepActive();

    if (sick) {
      clearTimeout(app.moveTimer);
      clearTimeout(app.envTimer);
      clearTimeout(app.annoyedTimer);
      app.moveTicket += 1;
      app.isMoving = false;
      app.isAnnoyed = false;
      app.wasSleeping = false;
      setEnvState("idle");
      elPetWrap.classList.remove("is-walking", "is-sleeping", "is-annoyed", "is-sitting");
      elPetWrap.classList.add("is-fainted");
      syncPetSprite(["om_met", "vuon_idle", "idle"], "", { holdLastFrame: true });
      return;
    }

    elPetWrap.classList.remove("is-fainted");

    if (sleeping) {
      if (!app.wasSleeping) {
        app.wasSleeping = true;
        app.sleepPokeCount = 0;
        if (initialLoad) {
          elPetWrap.classList.remove("face-left");
          applyPetPositionInstant(78, 23);
        } else if (!app.isMoving && app.envState === "idle" && !app.isAnnoyed) {
          movePetTo(78, 23, () => {
            elPetWrap.classList.remove("face-left");
            if (isSleepActive() && !app.isAnnoyed) {
              elPetWrap.classList.add("is-sleeping");
              syncPetSprite(["ngu", "nghi_ngoi", "idle"], "", { holdLastFrame: false });
            }
          });
          return;
        }
      }
      if (!app.isAnnoyed && !app.isMoving && app.envState === "idle") {
        elPetWrap.classList.remove("face-left");
        elPetWrap.classList.add("is-sleeping");
        syncPetSprite(["ngu", "nghi_ngoi", "idle"], "", { holdLastFrame: false });
      }
      return;
    }

    // Thức dậy khi hết khung giờ ngủ (tới sáng khi người dùng đang online)
    elPetWrap.classList.remove("is-sleeping", "is-annoyed");
    if (app.wasSleeping) {
      app.wasSleeping = false;
      app.isAnnoyed = false;
      app.sleepPokeCount = 0;
      if (!initialLoad) {
        triggerPetEffect(["choi_vui", "vuon_idle", "idle"], "sao", 2600);
        showSpeech("Chào buổi sáng! Hôm nay chúng mình cùng chinh phục bài mới nhé!");
        spawnFloat("☀️ Chào buổi sáng!", false);
        return;
      }
    }

    if (!app.isMoving && app.envState === "idle") {
      syncPetSprite(getIdleAction(), "", getIdleSpriteOpts());
    }
  }

  // ---------- Chu kỳ Ngày / Hoàng hôn / Đêm ----------
  function resolveAutoTimePhase() {
    const h = new Date().getHours();
    if (h >= 6 && h <= 16) return "day";
    if (h >= 17 && h <= 18) return "sunset";
    return "night";
  }

  function applyTimeOfDay(mode) {
    if (mode) app.timeMode = mode;
    const phase = app.timeMode === "auto" ? resolveAutoTimePhase() : app.timeMode;
    elStage.setAttribute("data-time", phase);
    document.body.setAttribute("data-time", phase);
    if (elTimeSwitch) {
      elTimeSwitch.querySelectorAll("[data-time-mode]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.timeMode === app.timeMode);
      });
    }
  }

  // ---------- Bộ não Di chuyển 2.5D & Auto Wander AI ----------
  function isMobileView() {
    return window.innerWidth <= 640;
  }

  function getMinGrassY() {
    if (isMobileView() && elDock && !elDock.classList.contains("is-collapsed")) {
      return 24;
    }
    return 14;
  }

  function calcDepthScale(yPct) {
    const t = Math.max(0, Math.min(1, (yPct - 14) / 28));
    return Number((1.04 - t * 0.16).toFixed(3));
  }

  function setEnvState(state) {
    clearTimeout(app.envTimer);
    app.envState = state || "idle";
    elPetWrap.classList.toggle("is-swimming", app.envState === "swimming");
    elPetWrap.classList.toggle("is-resting", app.envState === "resting");
    elPetWrap.classList.toggle("is-viewing", app.envState === "viewing");
    elPetWrap.classList.toggle("is-sitting", app.envState === "sitting");
  }

  function applyPetPositionInstant(xPct, yPct) {
    app.pos = { x: xPct, y: yPct };
    elPetWrap.style.setProperty("--move-ms", "0ms");
    elPetWrap.style.setProperty("--pet-scale", String(calcDepthScale(yPct)));
    elPetWrap.style.left = xPct + "%";
    elPetWrap.style.bottom = yPct + "%";
  }

  function movePetTo(targetX, targetY, onArrive) {
    if (isPetSick()) return;
    const tx = Math.max(8, Math.min(92, Number(targetX)));
    const ty = Math.max(8, Math.min(48, Number(targetY)));
    const dx = tx - app.pos.x;
    const dy = ty - app.pos.y;
    const dist = Math.hypot(dx, dy);

    clearTimeout(app.moveTimer);
    const ticket = ++app.moveTicket;
    setEnvState("idle");
    elPetWrap.classList.remove("is-sleeping");

    if (dx < -1) elPetWrap.classList.add("face-left");
    else if (dx > 1) elPetWrap.classList.remove("face-left");

    const duration = giamChuyenDong || dist < 1.5
      ? 0
      : Math.max(320, Math.min(1400, Math.round(dist * 24)));

    app.pos = { x: tx, y: ty };
    elPetWrap.style.setProperty("--move-ms", duration + "ms");
    elPetWrap.style.setProperty("--pet-scale", String(calcDepthScale(ty)));
    elPetWrap.style.left = tx + "%";
    elPetWrap.style.bottom = ty + "%";

    if (duration === 0) {
      app.isMoving = false;
      elPetWrap.classList.remove("is-walking");
      if (typeof onArrive === "function") onArrive();
      return;
    }

    app.isMoving = true;
    elPetWrap.classList.add("is-walking");
    syncPetSprite("di_bo", "", { holdLastFrame: false });

    app.moveTimer = setTimeout(() => {
      if (ticket !== app.moveTicket) return;
      app.isMoving = false;
      elPetWrap.classList.remove("is-walking");
      if (typeof onArrive === "function") {
        onArrive();
      } else {
        syncPetVisualState(false);
      }
    }, duration);
  }

  function spawnClickPing(xPct, yPct) {
    if (!elPingLayer) return;
    const ping = document.createElement("span");
    ping.className = "vuon-click-ping";
    ping.style.left = xPct + "%";
    ping.style.bottom = yPct + "%";
    elPingLayer.appendChild(ping);
    setTimeout(() => {
      if (ping.parentNode) ping.parentNode.removeChild(ping);
    }, 620);
  }

  function scheduleAutoWander() {
    clearTimeout(app.wanderTimer);
    if (giamChuyenDong) return;
    const delay = 7000 + Math.floor(Math.random() * 4000);
    app.wanderTimer = setTimeout(() => {
      if (
        !document.hidden &&
        app.data &&
        app.activeTab === "vuon" &&
        !app.busy &&
        !app.isMoving &&
        app.envState === "idle" &&
        !isPetSick() &&
        !isSleepActive() &&
        !app.isAnnoyed &&
        Date.now() - app.lastUserActionAt >= 6000
      ) {
        const minY = getMinGrassY();
        const tx = Math.round(44 + Math.random() * 30);
        const ty = Math.round(minY + Math.random() * Math.max(10, 34 - minY));
        movePetTo(tx, ty, () => {
          syncPetVisualState(false);
          if (Math.random() < 0.32 && elSpeech.classList.contains("hidden")) {
            const line = WANDER_LINES[Math.floor(Math.random() * WANDER_LINES.length)];
            showSpeech(line);
          }
        });
      }
      scheduleAutoWander();
    }, delay);
  }

  // ---------- Toast, Speech & Floating Pop ----------
  function showToast(msg, tone) {
    if (!msg) return;
    clearTimeout(app.toastTimer);
    elToast.textContent = msg;
    elToast.className = "vuon-toast-banner" + (tone ? " is-" + tone : "");
    app.toastTimer = setTimeout(() => {
      elToast.classList.add("hidden");
    }, 3400);
  }

  function updateSpeechAlignment() {
    if (!elSpeech) return;
    elSpeech.classList.remove("align-left", "align-right");
    if (app.pos.x <= 30) elSpeech.classList.add("align-left");
    else if (app.pos.x >= 70) elSpeech.classList.add("align-right");
  }

  function showSpeech(text, durationMs, annoyed) {
    if (!text) return;
    clearTimeout(app.speechTimer);
    updateSpeechAlignment();
    elSpeech.textContent = text;
    elSpeech.classList.toggle("is-annoyed", Boolean(annoyed));
    elSpeech.classList.remove("hidden");
    app.speechTimer = setTimeout(() => {
      elSpeech.classList.add("hidden");
      elSpeech.classList.remove("is-annoyed");
    }, durationMs || 3800);
  }

  function spawnFloat(text, isHeart) {
    if (!text) return;
    const node = document.createElement("span");
    node.className = "vuon-float-pop" + (isHeart ? " vuon-float-pop--heart" : "");
    node.textContent = text;
    node.style.left = 42 + Math.round(Math.random() * 16) + "%";
    elFloatLayer.appendChild(node);
    setTimeout(() => {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 1500);
  }

  // ---------- API Helpers ----------
  function showView(viewName, errMsg) {
    elLoading.classList.toggle("hidden", viewName !== "loading");
    elLoginCta.classList.toggle("hidden", viewName !== "login");
    elError.classList.toggle("hidden", viewName !== "error");
    elStage.classList.toggle("hidden", viewName !== "stage");
    if (viewName === "error" && errMsg) {
      const isEndpoint404 = String(errMsg).indexOf("Không tìm thấy endpoint") !== -1;
      const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
      if (isEndpoint404) {
        elErrorMsg.textContent = errMsg + (isLocal
          ? " — Trang đang gọi Google Apps Script bản cũ. Nếu bạn đang chạy app.py trên máy, hãy bấm 'Dùng Backend Local'; hoặc cập nhật code trong thư mục AppsScript/ lên Google Apps Script nhé."
          : " — Backend Google Apps Script chưa được cập nhật mã mới trong thư mục AppsScript/.");
      } else {
        elErrorMsg.textContent = errMsg;
      }
      if (elLocalBtn) {
        elLocalBtn.classList.toggle("hidden", !(isEndpoint404 && isLocal));
      }
    }
  }

  async function apiGetGarden() {
    const sched = getPersonalSleepSchedule();
    const qs =
      "?user_id=" + encodeURIComponent(userId) +
      "&ngu_tu=" + encodeURIComponent(sched.sleepStr) +
      "&ngu_den=" + encodeURIComponent(sched.wakeStr);
    const res = await fetch(API + "/api/vuon" + qs);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.message || "Không tải được dữ liệu Vườn Saoladou.");
    }
    return json.data;
  }

  async function apiPost(path, body) {
    const token = getToken();
    if (!token) {
      throw new Error("Phiên đăng nhập thiếu mã bảo mật. Hãy đăng xuất rồi đăng nhập lại nhé!");
    }
    const res = await fetch(API + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Thao tác chưa thành công, thử lại sau nhé.");
    }
    return json;
  }

  // ---------- Helpers đọc dữ liệu chuẩn hóa ----------
  function getRemainingSeconds(baseSeconds) {
    const elapsed = Math.floor((Date.now() - app.syncedAt) / 1000);
    return Math.max(0, (Number(baseSeconds) || 0) - elapsed);
  }

  function getCatalogMap(data) {
    const map = new Map();
    const list = Array.isArray(data && data.catalog) ? data.catalog : [];
    list.forEach((it) => {
      if (it && it.id) map.set(it.id, it);
    });
    return map;
  }

  function formatBonusTags(item) {
    const tags = [];
    const hq = item && item.hieu_qua;
    if (typeof hq === "string" && hq.trim()) {
      tags.push(hq.trim());
      return tags;
    }
    if (hq && typeof hq === "object") {
      if (hq.min_all) tags.push("Hồi các chỉ số ≥ " + hq.min_all + "%");
      const fmt = (n, label) => (n > 0 ? "+" + n : String(n)) + " " + label;
      if (hq.no_bung) tags.push(fmt(hq.no_bung, "No bụng"));
      if (hq.vui_ve) tags.push(fmt(hq.vui_ve, "Vui vẻ"));
      if (hq.sach_se) tags.push(fmt(hq.sach_se, "Sạch sẽ"));
      return tags;
    }
    if (item) {
      if (item.no) tags.push("+" + item.no + " No bụng");
      if (item.vui) tags.push("+" + item.vui + " Vui vẻ");
      if (item.sach) tags.push("+" + item.sach + " Sạch sẽ");
    }
    return tags;
  }

  // ---------- Render HUD ----------
  function renderStatBar(valEl, barEl, rawVal) {
    const val = Math.max(0, Math.min(100, Math.round(Number(rawVal) || 0)));
    valEl.textContent = val + "%";
    barEl.style.width = val + "%";
    const wrap = barEl.closest(".vuon-stat");
    if (wrap) {
      wrap.classList.toggle("is-danger", val < 20);
      wrap.classList.toggle("is-warn", val >= 20 && val < 50);
    }
  }

  function updateHealthPill() {
    if (!elHealthPill || !app.data) return;
    const tt = app.data.trang_thai || {};
    const sucKhoe = tt.suc_khoe || app.data.suc_khoe || "khoe_vui";
    const sched = getPersonalSleepSchedule();

    elHealthPill.classList.remove("is-healthy", "is-warn", "is-sick", "is-sleep");
    if (sucKhoe === "om") {
      elHealthPill.classList.add("is-sick");
      elHealthPill.textContent = "😵 Ngất xỉu vì kiệt sức — cần cấp cứu!";
    } else if (isSleepActive()) {
      elHealthPill.classList.add("is-sleep");
      elHealthPill.textContent = "😴 Đang ngủ ngon (" + sched.sleepStr + " – " + sched.wakeStr + ")";
    } else if (sucKhoe === "can_cham") {
      elHealthPill.classList.add("is-warn");
      elHealthPill.textContent = "🍃 Hơi đói hoặc bẩn rồi — chăm SaoLa nhé!";
    } else {
      elHealthPill.classList.add("is-healthy");
      elHealthPill.textContent = "✨ Khỏe mạnh rạng rỡ";
    }
  }

  function renderHud() {
    const data = app.data;
    if (!data) return;
    const tt = data.trang_thai || {};
    const sucKhoe = tt.suc_khoe || data.suc_khoe || "khoe_vui";

    updateHealthPill();
    renderStatBar(elValNo, elBarNo, tt.no_bung);
    renderStatBar(elValVui, elBarVui, tt.vui_ve);
    renderStatBar(elValSach, elBarSach, tt.sach_se);

    const educoin = Number(data.educoin) || 0;
    const score = Number(data.score) || 0;
    elEducoin.textContent = educoin.toLocaleString("vi-VN");
    elBxhSub.textContent = "BXH: " + score.toLocaleString("vi-VN") + "đ · tiêu không tụt hạng";

    // Huy hiệu 😵 nổi trên đầu khi SaoLa đang ngất xỉu vì kiệt sức
    if (sucKhoe === "om") {
      elPetSickFx.textContent = "😵";
      elPetSickFx.classList.remove("hidden");
    } else {
      elPetSickFx.classList.add("hidden");
    }

    renderPetHint();
    renderZoneBadges();
  }

  function renderZoneBadges() {
    const tt = (app.data && app.data.tuong_tac) || {};
    if (elBadgeSong) {
      const cho = getRemainingSeconds(tt.tam_song_cho_giay);
      const toiDaSong = tt.tam_song_toi_da != null ? Number(tt.tam_song_toi_da) : 2;
      const con = tt.tam_song_con != null ? Number(tt.tam_song_con) : toiDaSong;
      if (con <= 0) {
        elBadgeSong.textContent = "💧 Tắm hồ (" + toiDaSong + "/" + toiDaSong + ")";
      } else if (cho > 0) {
        elBadgeSong.textContent = "💧 Hồi " + formatGiay(cho);
      } else {
        elBadgeSong.textContent = "💧 Tắm hồ (" + con + "/" + toiDaSong + ")";
      }
    }
    if (elBadgeCay) {
      const cho = getRemainingSeconds(tt.nghi_cay_cho_giay);
      const toiDaCay = tt.nghi_cay_toi_da != null ? Number(tt.nghi_cay_toi_da) : 2;
      const con = tt.nghi_cay_con != null ? Number(tt.nghi_cay_con) : toiDaCay;
      if (con <= 0) {
        elBadgeCay.textContent = "🌳 Nghỉ râm (" + toiDaCay + "/" + toiDaCay + ")";
      } else if (cho > 0) {
        elBadgeCay.textContent = "🌳 Hồi " + formatGiay(cho);
      } else {
        elBadgeCay.textContent = "🌳 Nghỉ râm (" + con + "/" + toiDaCay + ")";
      }
    }
  }

  function renderPetHint() {
    const data = app.data;
    if (!data) return;
    const tt = data.trang_thai || {};
    const toiDa = Math.max(1, Number(tt.vuot_ve_toi_da != null ? tt.vuot_ve_toi_da : 3));
    const conLai = Math.max(0, Number(tt.vuot_ve_con_lai != null ? tt.vuot_ve_con_lai : toiDa));
    const hoiCon = getRemainingSeconds(tt.vuot_ve_hoi_con);

    if (isPetSick()) {
      elPetHint.textContent = "SaoLa đang ngất xỉu · Cho ăn hoặc dùng Thảo dược nhé";
    } else if (isSleepActive()) {
      const sched = getPersonalSleepSchedule();
      elPetHint.textContent = "Đang ngủ say (" + sched.sleepStr + " – " + sched.wakeStr + ") · Zzz...";
    } else if (hoiCon > 0) {
      elPetHint.textContent = "Chạm để vuốt ve · Hồi lượt sau " + formatGiay(hoiCon);
    } else if (conLai > 0) {
      elPetHint.textContent = "Chạm để vuốt ve · Còn " + conLai + "/" + toiDa + " lượt vui vẻ";
    } else {
      elPetHint.textContent = "Chạm để trò chuyện với SaoLa";
    }
  }

  // ---------- Render Lớp Trang Trí Rừng ----------
  function renderDecorLayer() {
    const data = app.data;
    if (!data) return;
    const catMap = getCatalogMap(data);
    const list = Array.isArray(data.trang_tri) ? data.trang_tri : [];
    elDecorLayer.textContent = "";

    list.forEach((dec) => {
      const bat = dec && (dec.dang_bat === 1 || dec.dang_bat === true);
      if (!bat || !dec.item_id) return;
      const meta = catMap.get(dec.item_id);
      const pos = (meta && meta.pos) || DEFAULT_DECOR_POS[dec.item_id];
      if (!pos) return;

      const isBench = dec.item_id === "ghe_da";
      const wrap = document.createElement(isBench ? "button" : "div");
      if (isBench) {
        wrap.type = "button";
        wrap.dataset.zone = "ghe_da";
        wrap.setAttribute("aria-label", "Bấm để SaoLa ngồi nghỉ trên ghế đá");
        wrap.title = "Bấm để SaoLa ngồi nghỉ trên ghế đá";
      }
      wrap.className = "vuon-decor-item vuon-decor--" + dec.item_id + (isBench ? " is-interactive" : "");
      if (pos.left) wrap.style.left = pos.left;
      if (pos.top) wrap.style.top = pos.top;
      if (pos.bottom) wrap.style.bottom = pos.bottom;

      if (dec.item_id === "bang_ten") {
        const board = document.createElement("div");
        board.className = "vuon-sign-board";
        board.textContent = "Vườn của " + (data.username || "bạn");
        const post = document.createElement("div");
        post.className = "vuon-sign-post";
        wrap.append(board, post);
      } else if (DECOR_SCENE_SVGS[dec.item_id]) {
        wrap.innerHTML = DECOR_SCENE_SVGS[dec.item_id];
      }

      if (isBench) {
        const badge = document.createElement("span");
        badge.className = "vuon-zone-badge";
        badge.textContent = "🪑 Ngồi ghế đá";
        wrap.appendChild(badge);
        wrap.addEventListener("click", (e) => {
          e.stopPropagation();
          handleZoneClick("ghe_da", e);
        });
      }

      elDecorLayer.appendChild(wrap);
    });

    requestAnimationFrame(syncTreeDecorPositions);
  }

  // Neo chính xác đèn lồng & chuông gió ngay dưới mép tán lá cây cổ thụ theo khung thực tế
  function syncTreeDecorPositions() {
    if (!elDecorLayer || !elArena || !elWorld) return;
    const treeEl = elWorld.querySelector(".vuon-zone-cay");
    if (!treeEl) return;
    const ar = elArena.getBoundingClientRect();
    const tr = treeEl.getBoundingClientRect();
    if (!ar.width || !ar.height || !tr.width || !tr.height) return;

    const anchors = {
      den_dom_dom: { xRatio: 0.25, yRatio: 0.58 },
      chuong_gio: { xRatio: 0.84, yRatio: 0.56 },
    };
    Object.keys(anchors).forEach((id) => {
      const node = elDecorLayer.querySelector(".vuon-decor--" + id);
      if (!node) return;
      const cfg = anchors[id];
      const leftPct = ((tr.left + tr.width * cfg.xRatio - ar.left) / ar.width) * 100;
      const topPct = ((tr.top + tr.height * cfg.yRatio - ar.top) / ar.height) * 100;
      node.style.left = leftPct.toFixed(2) + "%";
      node.style.top = topPct.toFixed(2) + "%";
      node.style.bottom = "auto";
    });
  }

  // ---------- Render Dock Túi Đồ ----------
  function renderDockFilters() {
    elDockFilters.textContent = "";
    DOCK_FILTERS.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vuon-pill" + (app.dockFilter === f.id ? " is-active" : "");
      btn.textContent = f.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(app.dockFilter === f.id));
      btn.addEventListener("click", () => {
        app.dockFilter = f.id;
        renderDockFilters();
        renderDockItems();
      });
      elDockFilters.appendChild(btn);
    });
  }

  function createDockCard({ iconHtml, imgUrl, name, subText, extraClass, disabled, cooldownSec, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vuon-dock-card" + (extraClass ? " " + extraClass : "");
    btn.disabled = !!disabled;
    if (cooldownSec > 0) {
      btn.dataset.cdTotal = String(cooldownSec);
    }

    const ico = document.createElement("span");
    ico.className = "vuon-dock-ico";
    if (imgUrl) {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = "";
      img.loading = "lazy";
      ico.appendChild(img);
    } else {
      ico.innerHTML = iconHtml;
    }

    const meta = document.createElement("span");
    meta.className = "vuon-dock-meta";
    const elName = document.createElement("span");
    elName.className = "vuon-dock-name";
    elName.textContent = name;
    const elSub = document.createElement("span");
    elSub.className = "vuon-dock-sub";
    elSub.textContent = subText;
    meta.append(elName, elSub);

    btn.append(ico, meta);
    if (onClick) btn.addEventListener("click", onClick);
    return btn;
  }

  function renderDockItems() {
    const data = app.data;
    if (!data) return;
    const catMap = getCatalogMap(data);
    const filter = app.dockFilter;
    const cards = [];

    const tuiDo = Array.isArray(data.tui_do) ? data.tui_do : [];
    tuiDo.forEach((entry) => {
      if (!entry || !entry.item_id) return;
      const meta = catMap.get(entry.item_id) || {};
      const nhom = entry.nhom || meta.nhom || "";
      const tieuHao = entry.tieu_hao !== undefined ? Boolean(entry.tieu_hao) : Boolean(meta.tieu_hao);
      const qty = Number(entry.so_luong) || 0;
      if (tieuHao && qty <= 0) return;
      if (filter !== "all" && filter !== nhom) return;

      const baseCd = Number(entry.hoi_chieu_con) || 0;
      const cd = getRemainingSeconds(baseCd);
      const subText = tieuHao
        ? "×" + qty + " · Bấm để dùng"
        : cd > 0
          ? "Hồi " + formatGiay(cd)
          : "Dùng mãi · Sẵn sàng";

      cards.push(
        createDockCard({
          iconHtml: getItemIconHtml(entry.item_id),
          name: entry.ten || meta.ten || entry.item_id,
          subText,
          extraClass: cd > 0 ? "is-cooldown" : "",
          disabled: cd > 0 || app.busy,
          cooldownSec: !tieuHao && cd > 0 ? baseCd : 0,
          onClick: () => handleUseItem(entry.item_id),
        })
      );
    });

    const trangTri = Array.isArray(data.trang_tri) ? data.trang_tri : [];
    if (filter === "all" || filter === "trang_tri") {
      trangTri.forEach((dec) => {
        if (!dec || !dec.item_id) return;
        const meta = catMap.get(dec.item_id) || {};
        const bat = dec.dang_bat === 1 || dec.dang_bat === true;
        cards.push(
          createDockCard({
            iconHtml: getItemIconHtml(dec.item_id),
            name: dec.ten || meta.ten || dec.item_id,
            subText: bat ? "Đang bật · Bấm để tắt" : "Đang tắt · Bấm để bật",
            extraClass: bat ? "is-on" : "",
            disabled: app.busy,
            onClick: () => handleToggleDecor(dec.item_id, !bat),
          })
        );
      });
    }

    elDockItems.textContent = "";
    if (cards.length === 0) {
      const emptyBtn = document.createElement("button");
      emptyBtn.type = "button";
      emptyBtn.className = "vuon-empty-cta";
      emptyBtn.textContent = "Túi đang trống — Ghé Shop mua lá rừng cho SaoLa nhé ➔";
      emptyBtn.addEventListener("click", () => {
        if (filter !== "all") app.shopFilter = filter;
        switchTab("shop");
      });
      elDockItems.appendChild(emptyBtn);
      return;
    }

    cards.forEach((c) => elDockItems.appendChild(c));
  }

  // ---------- Render Cửa Hàng ----------
  function renderShopFilters() {
    elShopFilters.textContent = "";
    const pills = [{ id: "all", label: "Tất cả" }].concat(
      GROUP_META.map((g) => ({ id: g.id, label: g.pill }))
    );
    pills.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vuon-pill" + (app.shopFilter === p.id ? " is-active" : "");
      btn.textContent = p.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(app.shopFilter === p.id));
      btn.addEventListener("click", () => {
        app.shopFilter = p.id;
        renderShopFilters();
        renderShopBody();
      });
      elShopFilters.appendChild(btn);
    });
  }

  function buildVatPhamShopCard(item, ownedQtyMap, ownedForeverSet, ownedDecorSet, educoin) {
    const card = document.createElement("article");
    card.className = "vuon-shop-card";

    const top = document.createElement("div");
    top.className = "vuon-shop-card-top";

    const thumb = document.createElement("div");
    thumb.className = "vuon-shop-thumb";
    thumb.innerHTML = getItemIconHtml(item.id);

    const info = document.createElement("div");
    info.className = "vuon-shop-info";
    const h4 = document.createElement("h4");
    h4.className = "vuon-shop-name";
    h4.textContent = item.ten || item.id;
    const desc = document.createElement("p");
    desc.className = "vuon-shop-desc";
    desc.textContent = item.mo_ta || "";
    info.append(h4, desc);

    top.append(thumb, info);

    const badges = document.createElement("div");
    badges.className = "vuon-shop-badges";
    formatBonusTags(item).forEach((txt) => {
      const span = document.createElement("span");
      span.className = "vuon-tag vuon-tag--stat";
      span.textContent = txt;
      badges.appendChild(span);
    });
    if (item.mua_1_lan) {
      const forever = document.createElement("span");
      forever.className = "vuon-tag vuon-tag--forever";
      forever.textContent = "Mua 1 lần · Dùng mãi";
      badges.appendChild(forever);
    }
    const qty = ownedQtyMap.get(item.id) || 0;
    if (qty > 0 && !item.mua_1_lan) {
      const qtyBadge = document.createElement("span");
      qtyBadge.className = "vuon-tag vuon-tag--qty";
      qtyBadge.textContent = "Trong túi: ×" + qty;
      badges.appendChild(qtyBadge);
    }

    const foot = document.createElement("div");
    foot.className = "vuon-shop-foot";

    const isOwnedPermanent =
      item.nhom === "trang_tri" ? ownedDecorSet.has(item.id) : Boolean(item.mua_1_lan && ownedForeverSet.has(item.id));

    if (isOwnedPermanent) {
      const ownedSpan = document.createElement("span");
      ownedSpan.className = "vuon-owned-pill";
      ownedSpan.textContent = "Đã sở hữu ✔";
      const goBtn = document.createElement("button");
      goBtn.type = "button";
      goBtn.className = "vuon-sub-btn";
      goBtn.textContent = "Vào Vườn";
      goBtn.addEventListener("click", () => {
        app.dockFilter = item.nhom || "all";
        switchTab("vuon");
      });
      foot.append(ownedSpan, goBtn);
    } else {
      const gia = Number(item.gia) || 0;
      const thieu = educoin < gia;
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "vuon-buy-btn";
      buyBtn.disabled = thieu || app.busy;
      if (thieu) {
        buyBtn.append(
          document.createTextNode("Thiếu EduCoin ("),
          createCoinImg("vuon-coin-ico vuon-coin-ico--btn"),
          document.createTextNode(gia.toLocaleString("vi-VN") + ")")
        );
      } else {
        buyBtn.append(
          document.createTextNode("Mua · "),
          createCoinImg("vuon-coin-ico vuon-coin-ico--btn"),
          document.createTextNode(gia.toLocaleString("vi-VN"))
        );
      }
      buyBtn.addEventListener("click", () => handleBuy("vat_pham", item.id, item.ten, buyBtn));
      foot.appendChild(buyBtn);
    }

    card.append(top, badges, foot);
    return card;
  }

  function renderShopBody() {
    const data = app.data;
    if (!data) return;
    const educoin = Number(data.educoin) || 0;
    const catalog = Array.isArray(data.catalog) ? data.catalog : [];
    const tuiDo = Array.isArray(data.tui_do) ? data.tui_do : [];
    const trangTri = Array.isArray(data.trang_tri) ? data.trang_tri : [];

    const ownedQtyMap = new Map();
    const ownedForeverSet = new Set();
    tuiDo.forEach((it) => {
      if (!it || !it.item_id) return;
      ownedQtyMap.set(it.item_id, Number(it.so_luong) || 0);
      ownedForeverSet.add(it.item_id);
    });

    const ownedDecorSet = new Set(trangTri.map((d) => d && d.item_id).filter(Boolean));

    elShopBody.textContent = "";

    const groups = app.shopFilter === "all" ? GROUP_META : GROUP_META.filter((g) => g.id === app.shopFilter);
    groups.forEach((g) => {
      const items = catalog.filter((it) => it && it.nhom === g.id);
      if (items.length === 0) return;

      const sec = document.createElement("section");
      sec.className = "vuon-shop-section";

      const title = document.createElement("h3");
      title.className = "vuon-shop-section-title";
      title.textContent = g.title;

      const grid = document.createElement("div");
      grid.className = "vuon-shop-grid";
      items.forEach((it) =>
        grid.appendChild(buildVatPhamShopCard(it, ownedQtyMap, ownedForeverSet, ownedDecorSet, educoin))
      );

      sec.append(title, grid);
      elShopBody.appendChild(sec);
    });
  }

  function renderAll(initialLoad) {
    renderHud();
    renderDecorLayer();
    renderDockFilters();
    renderDockItems();
    renderShopFilters();
    renderShopBody();
    syncPetVisualState(Boolean(initialLoad));
  }

  function switchTab(tab) {
    app.activeTab = tab === "shop" ? "shop" : "vuon";
    const isShop = app.activeTab === "shop";

    elTabBtnVuon.classList.toggle("is-active", !isShop);
    elTabBtnVuon.setAttribute("aria-selected", String(!isShop));
    elTabBtnShop.classList.toggle("is-active", isShop);
    elTabBtnShop.setAttribute("aria-selected", String(isShop));

    elScene.classList.toggle("hidden", isShop);
    elShop.classList.toggle("hidden", !isShop);

    if (isShop) {
      renderShopFilters();
      renderShopBody();
    } else {
      renderDockFilters();
      renderDockItems();
      requestAnimationFrame(syncTreeDecorPositions);
    }
  }

  // ---------- Handlers Tương Tác ----------
  function applyNewGardenData(newData) {
    app.data = newData;
    app.syncedAt = Date.now();
    renderAll(false);
  }

  function handleSleepPoke() {
    if (app.isAnnoyed) return;
    const sched = getPersonalSleepSchedule();
    app.sleepPokeCount += 1;
    clearTimeout(app.sleepPokeResetTimer);
    app.sleepPokeResetTimer = setTimeout(() => {
      app.sleepPokeCount = 0;
    }, 12000);

    if (app.sleepPokeCount === 1) {
      playSfx("bam");
      elPetWrap.classList.remove("is-sleep-wiggle");
      void elPetWrap.offsetWidth;
      elPetWrap.classList.add("is-sleep-wiggle");
      clearTimeout(app.wiggleTimer);
      app.wiggleTimer = setTimeout(() => elPetWrap.classList.remove("is-sleep-wiggle"), 460);
      showSpeech("Zzz... khò... tới giờ ngủ rồi nè...");
      spawnFloat("💤", false);
      return;
    }

    if (app.sleepPokeCount === 2) {
      playSfx("bam");
      elPetWrap.classList.remove("is-sleep-wiggle");
      void elPetWrap.offsetWidth;
      elPetWrap.classList.add("is-sleep-wiggle");
      clearTimeout(app.wiggleTimer);
      app.wiggleTimer = setTimeout(() => elPetWrap.classList.remove("is-sleep-wiggle"), 460);
      showSpeech("Ưm... đừng gọi tớ dậy mà, khuya rồi đó...");
      spawnFloat("😴", false);
      return;
    }

    // Bấm chọc từ lần thứ 3 trở lên -> bật dậy khó chịu khuyên đi ngủ rồi ngủ tiếp!
    app.isAnnoyed = true;
    app.sleepPokeCount = 0;
    clearTimeout(app.sleepPokeResetTimer);
    clearTimeout(app.annoyedTimer);
    playSfx("bam");
    elPetWrap.classList.remove("is-sleeping", "is-sleep-wiggle");
    elPetWrap.classList.add("is-annoyed");
    syncPetSprite(["vuon_idle", "idle"], "", { holdLastFrame: false });
    spawnFloat("😤 Đi ngủ thôi!", false);
    showSpeech(
      "Hừm! Đã qua giờ ngủ (" +
        sched.sleepStr +
        ") rồi đó 😤 Ngủ đủ giấc mai mới học giỏi được, mau tắt máy đi ngủ đi rồi tớ cũng ngủ đây!",
      4000,
      true
    );

    app.annoyedTimer = setTimeout(() => {
      app.isAnnoyed = false;
      elPetWrap.classList.remove("is-annoyed");
      syncPetVisualState(false);
    }, 3500);
  }

  async function handlePetClick(e) {
    if (e) e.stopPropagation();
    if (app.busy || !app.data) return;
    app.lastUserActionAt = Date.now();

    if (isPetSick()) {
      const msg = "SaoLa đang xỉu vì kiệt sức! Hãy cho ăn lá rừng, uống nước suối hoặc dùng Thảo dược để hồi sức nhé!";
      showSpeech(msg);
      showToast(msg, "err");
      return;
    }

    if (isSleepActive()) {
      handleSleepPoke();
      return;
    }

    app.busy = true;
    try {
      const kq = await apiPost("/api/vuon/vuot-ve", {});
      playSfx("ok");
      if (!kq.om) {
        triggerPetEffect(["choi_vui", "vuon_idle"], "sao", 2400);
      }
      if (kq.vui_cong > 0) spawnFloat("💛 +" + kq.vui_cong, true);
      else spawnFloat("💛", true);
      showSpeech(kq.message || "Hí! SaoLa thích được vuốt ve lắm!");
      if (kq.data) applyNewGardenData(kq.data);
    } catch (err) {
      showToast(err.message, "warn");
    } finally {
      app.busy = false;
    }
  }

  async function runEnvInteraction(hanhDong, envMode, spritePref, fxName, durationMs) {
    app.busy = true;
    setEnvState(envMode);
    syncPetSprite(spritePref, fxName, { holdLastFrame: false });
    try {
      const kq = await apiPost("/api/vuon/tuong-tac", { hanh_dong: hanhDong });
      if (kq.cong_diem) {
        playSfx("ok");
        if (kq.sach_cong > 0) spawnFloat("+" + kq.sach_cong + " 💧 Sạch sẽ", false);
        if (kq.vui_cong > 0) spawnFloat("+" + kq.vui_cong + " 💛 Vui vẻ", true);
      } else {
        playSfx("bam");
        if (hanhDong === "ngam_canh") spawnFloat("💛", true);
      }
      if (kq.message) showSpeech(kq.message);
      if (kq.data) applyNewGardenData(kq.data);
    } catch (err) {
      showToast(err.message, "warn");
    } finally {
      app.busy = false;
      clearTimeout(app.envTimer);
      app.envTimer = setTimeout(() => {
        if (app.envState === envMode) {
          setEnvState("idle");
          if (!app.isMoving) syncPetVisualState(false);
        }
      }, durationMs || 3200);
    }
  }

  function getLakeCenterTarget() {
    const lakeEl =
      elWorld && (elWorld.querySelector(".vuon-lake-core") || elWorld.querySelector('[data-zone="song"]'));
    if (!lakeEl || !elArena) return { x: 24, y: 21 };
    const ar = elArena.getBoundingClientRect();
    const lr = lakeEl.getBoundingClientRect();
    if (!ar.width || !ar.height || !lr.width || !lr.height) return { x: 24, y: 21 };
    const x = ((lr.left + lr.width * 0.5 - ar.left) / ar.width) * 100;
    const y = ((ar.bottom - (lr.top + lr.height * 0.62)) / ar.height) * 100;
    return { x, y };
  }

  function getBenchSeatTarget() {
    const benchEl = elDecorLayer && elDecorLayer.querySelector(".vuon-decor--ghe_da");
    if (!benchEl || !elArena) return { x: 65, y: 20 };
    const ar = elArena.getBoundingClientRect();
    const br = benchEl.getBoundingClientRect();
    if (!ar.width || !ar.height || !br.width || !br.height) return { x: 65, y: 20 };
    const x = ((br.left + br.width * 0.48 - ar.left) / ar.width) * 100;
    // Đặt đáy khung sprite ngang đáy ghế đá để hông SaoLa tựa khít mặt đá (y~54% ghế), chân buông tự nhiên phía trước
    const seatY = br.bottom;
    const y = ((ar.bottom - seatY) / ar.height) * 100;
    return { x, y };
  }

  function handleZoneClick(zone, evt) {
    if (!app.data || app.activeTab !== "vuon") return;
    if (app.busy) return;
    app.lastUserActionAt = Date.now();

    if (isPetSick()) {
      const msg = "SaoLa đang xỉu vì kiệt sức! Hãy cho ăn lá rừng, uống nước suối hoặc dùng Thảo dược để hồi sức nhé!";
      showSpeech(msg);
      showToast(msg, "err");
      return;
    }

    if (isSleepActive()) {
      const sched = getPersonalSleepSchedule();
      const msg = "Đang giờ ngủ (" + sched.sleepStr + " – " + sched.wakeStr + "), để SaoLa nghỉ ngơi tới sáng nha!";
      showSpeech(msg);
      showToast(msg, "warn");
      return;
    }

    if (zone === "ghe_da") {
      playSfx("bam");
      const seat = getBenchSeatTarget();
      movePetTo(seat.x, seat.y, () => {
        elPetWrap.classList.remove("face-left");
        setEnvState("sitting");
        syncPetSprite(["ngoi_ghe", "nghi_ngoi", "vuon_idle", "idle"], "", { holdLastFrame: false });
        const line = BENCH_LINES[Math.floor(Math.random() * BENCH_LINES.length)];
        showSpeech(line, 4400);
        spawnFloat("🪑 Thư giãn!", false);
        clearTimeout(app.envTimer);
        app.envTimer = setTimeout(() => {
          if (app.envState === "sitting") {
            setEnvState("idle");
            if (!app.isMoving) syncPetVisualState(false);
          }
        }, 4500);
      });
      return;
    }

    if (zone === "song") {
      const lake = getLakeCenterTarget();
      movePetTo(lake.x, lake.y, () => {
        runEnvInteraction("tam_song", "swimming", ["tam_song", "vuon_idle"], "", 3200);
      });
      return;
    }

    if (zone === "cay") {
      movePetTo(84, isMobileView() ? 25 : 22, () => {
        elPetWrap.classList.add("face-left");
        runEnvInteraction("nghi_cay", "resting", ["nghi_ngoi", "idle"], "zzz", 3200);
      });
      return;
    }

    if (zone === "da") {
      movePetTo(73, 37, () => {
        elPetWrap.classList.add("face-left");
        runEnvInteraction("ngam_canh", "viewing", ["choi_vui", "vuon_idle"], "sao", 2600);
      });
      return;
    }

    if (zone === "co" && elArena && evt) {
      const rect = elArena.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const rawX = ((evt.clientX - rect.left) / rect.width) * 100;
      const rawBottom = ((rect.bottom - evt.clientY) / rect.height) * 100;
      const minY = getMinGrassY();
      const tx = Math.round(Math.max(12, Math.min(88, rawX)) * 10) / 10;
      const ty = Math.round(Math.max(minY, Math.min(44, rawBottom)) * 10) / 10;
      const zoneCoEl = elWorld && elWorld.querySelector('[data-zone="co"]');
      if (zoneCoEl) {
        const coRect = zoneCoEl.getBoundingClientRect();
        const pingX = Math.max(4, Math.min(96, ((evt.clientX - coRect.left) / coRect.width) * 100));
        const pingY = Math.max(8, Math.min(88, ((coRect.bottom - evt.clientY) / coRect.height) * 100));
        spawnClickPing(pingX, pingY);
      }
      playSfx("bam");
      movePetTo(tx, ty);
    }
  }

  async function executeUseItem(itemId, wasSick) {
    try {
      const kq = await apiPost("/api/vuon/dung", { item_id: itemId });
      playSfx("ok");
      if (kq.data) {
        app.data = kq.data;
        app.syncedAt = Date.now();
        renderHud();
        renderDecorLayer();
        renderShopBody();
      }
      const stillSick = isPetSick();
      if (stillSick) {
        syncPetVisualState(false);
        showSpeech(
          (kq.message ? kq.message + " " : "") + "Nhưng SaoLa vẫn còn yếu (<20%), chăm thêm chút nữa nhé!"
        );
        spawnFloat("🩺 Đang hồi sức...", false);
      } else {
        elPetWrap.classList.remove("is-fainted", "is-sleeping");
        if (itemId === "nuoc_suoi") {
          setEnvState("swimming");
          syncPetSprite(["tam_song", "vuon_idle"], "", { holdLastFrame: false });
          clearTimeout(app.envTimer);
          app.envTimer = setTimeout(() => {
            setEnvState("idle");
            if (!app.isMoving) syncPetVisualState(false);
          }, 2600);
        } else if (FOOD_IDS.has(itemId)) {
          triggerPetEffect(["an_la", "vuon_idle"], "sao", 2400);
        } else if (PLAY_IDS.has(itemId)) {
          triggerPetEffect(["choi_vui", "vuon_idle"], "sao", 2600);
        } else {
          triggerPetEffect(["choi_vui", "vuon_idle"], "sao", 2400);
        }
        if (kq.message) showSpeech(kq.message);
        spawnFloat(wasSick ? "✨ Hồi sức rồi!" : "✨ Chăm sóc!", false);
      }
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      app.busy = false;
      renderDockItems();
    }
  }

  async function handleUseItem(itemId) {
    if (app.busy || !app.data) return;
    app.lastUserActionAt = Date.now();
    const wasSick = isPetSick();
    const sleeping = isSleepActive();
    app.busy = true;
    renderDockItems();

    // Khi đang ngất xỉu hoặc đang ngủ: dùng vật phẩm trực tiếp tại chỗ để cấp cứu/chăm sóc ngay
    if (wasSick || sleeping) {
      executeUseItem(itemId, wasSick);
      return;
    }

    if (itemId === "nuoc_suoi") {
      const lake = getLakeCenterTarget();
      movePetTo(lake.x, lake.y, () => {
        executeUseItem(itemId, false);
      });
    } else if (PLAY_IDS.has(itemId)) {
      movePetTo(50, 22, () => {
        executeUseItem(itemId, false);
      });
    } else {
      executeUseItem(itemId, false);
    }
  }

  async function handleToggleDecor(itemId, bat) {
    if (app.busy || !app.data) return;
    app.busy = true;
    try {
      const kq = await apiPost("/api/vuon/trang-tri", { item_id: itemId, bat: Boolean(bat) });
      playSfx("bam");
      showToast(kq.message || (bat ? "Đã bật đồ trang trí trong vườn!" : "Đã cất đồ trang trí."), "ok");
      if (kq.data) {
        applyNewGardenData(kq.data);
      } else {
        const fresh = await apiGetGarden();
        applyNewGardenData(fresh);
      }
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      app.busy = false;
      renderDockItems();
    }
  }

  async function handleBuy(loai, id, ten, btnEl) {
    if (app.busy || !app.data) return;
    app.busy = true;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Đang mua...";
    }
    try {
      const kq = await apiPost("/api/vuon/mua", { loai, id, so_luong: 1 });
      playSfx("ok");
      showToast(kq.message || ("Đã mua \"" + (ten || id) + "\"!"), "ok");
      if (kq.data) {
        applyNewGardenData(kq.data);
      } else {
        const fresh = await apiGetGarden();
        applyNewGardenData(fresh);
      }
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      app.busy = false;
      renderShopBody();
      renderDockItems();
    }
  }

  // ---------- Nhịp Online mỗi 60 giây (POST /api/vuon/nhip) ----------
  async function sendOnlineHeartbeat() {
    if (!app.data || document.hidden || app.busy || app.heartbeatBusy || !getToken()) return;
    app.heartbeatBusy = true;
    const wasSick = isPetSick();
    const sched = getPersonalSleepSchedule();
    try {
      const kq = await apiPost("/api/vuon/nhip", {
        dang_ngu: isSleepActive(),
        ngu_tu: sched.sleepStr,
        ngu_den: sched.wakeStr,
      });
      if (kq && kq.data) {
        app.data = kq.data;
        app.syncedAt = Date.now();
        renderHud();
        syncPetVisualState(false);
        if (!wasSick && isPetSick()) {
          showSpeech("Ôi không! SaoLa kiệt sức ngất xỉu rồi — mau cho ăn hoặc dùng Thảo dược nhé!", 4500, true);
        }
      }
    } catch (e) {
      /* bỏ qua lỗi mạng thoáng qua khi gửi nhịp định kỳ */
    } finally {
      app.heartbeatBusy = false;
    }
  }

  // ---------- Khởi động ----------
  async function loadGarden() {
    showView("loading");
    try {
      const data = await apiGetGarden();
      app.data = data;
      app.syncedAt = Date.now();
      showView("stage");
      renderAll(true);
      switchTab(app.activeTab);
    } catch (err) {
      showView("error", err && err.message ? err.message : "Không tải được dữ liệu Vườn Saoladou.");
    }
  }

  function tickDockCooldowns() {
    if (app.activeTab !== "vuon") return;
    const nodes = elDockItems.querySelectorAll("[data-cd-total]");
    nodes.forEach((btn) => {
      const rem = getRemainingSeconds(btn.dataset.cdTotal);
      const sub = btn.querySelector(".vuon-dock-sub");
      if (rem > 0) {
        if (sub) sub.textContent = "Hồi " + formatGiay(rem);
      } else {
        delete btn.dataset.cdTotal;
        btn.classList.remove("is-cooldown");
        btn.disabled = app.busy;
        if (sub) sub.textContent = "Dùng mãi · Sẵn sàng";
      }
    });
  }

  function startCooldownTicker() {
    if (app.tickInterval) clearInterval(app.tickInterval);
    app.tickInterval = setInterval(() => {
      if (!app.data || document.hidden) return;
      updateHealthPill();
      renderPetHint();
      renderZoneBadges();
      tickDockCooldowns();
    }, 1000);
  }

  function bindEvents() {
    elTabBtnVuon.addEventListener("click", () => switchTab("vuon"));
    elTabBtnShop.addEventListener("click", () => switchTab("shop"));
    elPetBtn.addEventListener("click", handlePetClick);
    elRetryBtn.addEventListener("click", loadGarden);
    if (elLocalBtn) {
      elLocalBtn.addEventListener("click", () => {
        luu.ghi("vnstarl_use_local", "1");
        loadGarden();
      });
    }
    if (elDockToggle && elDock) {
      elDockToggle.addEventListener("click", () => {
        const collapsed = elDock.classList.toggle("is-collapsed");
        elDockToggle.setAttribute("aria-expanded", String(!collapsed));
        elDockToggle.textContent = collapsed ? "🎒 Mở Túi đồ" : "🎒 Thu gọn";
        playSfx("bam");
        if (
          !collapsed &&
          isMobileView() &&
          !app.isMoving &&
          !isPetSick() &&
          !isSleepActive() &&
          app.envState === "idle" &&
          app.pos.y < 24
        ) {
          movePetTo(app.pos.x, 26);
        }
      });
    }
    if (elTimeSwitch) {
      elTimeSwitch.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-time-mode]");
        if (!btn) return;
        e.stopPropagation();
        applyTimeOfDay(btn.dataset.timeMode);
      });
    }
    if (elWorld) {
      elWorld.addEventListener("click", (e) => {
        if (e.target.closest("#vuon-time-switch")) return;
        const zoneEl = e.target.closest("[data-zone]");
        if (!zoneEl) return;
        handleZoneClick(zoneEl.dataset.zone, e);
      });
    }
    window.addEventListener("storage", (e) => {
      if (userId && e.key === "edumate_hoctap_" + userId && app.data) {
        updateHealthPill();
        renderPetHint();
        syncPetVisualState(false);
      }
    });
    window.addEventListener("resize", () => {
      if (app.activeTab === "vuon") syncTreeDecorPositions();
    });
  }

  function init() {
    if (!userId) {
      showView("login");
      return;
    }
    applyTimeOfDay("auto");
    applyPetPositionInstant(50, isMobileView() ? 27 : 20);
    app.timeInterval = setInterval(() => {
      if (app.timeMode === "auto") applyTimeOfDay("auto");
      if (app.data) {
        updateHealthPill();
        syncPetVisualState(false);
      }
    }, 60000);
    app.heartbeatInterval = setInterval(sendOnlineHeartbeat, 60000);
    bindEvents();
    startCooldownTicker();
    scheduleAutoWander();
    loadGarden();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
