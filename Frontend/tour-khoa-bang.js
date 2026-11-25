// tour-khoa-bang.js - Hướng dẫn tương tác kiểu Game "Làm A mới qua B" cho Bảng Vàng Khoa Bảng (PC)
(function () {
  "use strict";

  const uid = localStorage.getItem("userId");
  if (localStorage.getItem("isLoggedIn") !== "true" || !uid) return;

  const KHOA_XONG = "vnstarl_tour_khoabang_" + uid;
  const KHOA_CHAIN = "vnstarl_tour_chain";
  const mqDesktop = window.matchMedia("(min-width: 641px)");

  let steps = [];
  let idx = -1;
  let holeEl = null;
  let mascotWrap = null;
  let activeMustEl = null;

  const IMG_INTRO = "img/tour/saoladuo_khoabang.png";
  const POSE_INTRO = "khoabang";
  const IMG_THUOC = "img/tour/saoladuo_thuoc.webp";

  function layAnhTour(b) {
    if (!b || b.center || !b.target) {
      return { src: IMG_INTRO, pose: POSE_INTRO, fallback: "img/tour/saoladuo_xephang.webp" };
    }
    return { src: IMG_THUOC, pose: "thuoc" };
  }

  function phatLoiKhoaBang(ma, auto) {
    sessionStorage.setItem("saola_da_kb_" + uid, "1");
    const maAm = ma || "kb_gioi_thieu";
    const chup = (tt) => {
      if (tt && window.SAOLA) window.SAOLA.noi(maAm, auto ? { auto: true } : undefined);
    };
    if (window.SAOLA) window.SAOLA.sanSang.then(chup);
    else window.addEventListener("saola-san-sang", (e) => chup(e.detail), { once: true });
  }

  function datViTriMascot(rect) {
    if (!mascotWrap) return;
    const b = steps[idx];
    const imgEl = mascotWrap.querySelector(".tour-saola-avatar img");

    if (!b || b.center || !rect) {
      mascotWrap.classList.add("is-center-modal");
      mascotWrap.classList.remove("is-flipped");
      mascotWrap.style.top = "";
      mascotWrap.style.left = "";
      if (imgEl) imgEl.classList.remove("is-ruler-right");
      return;
    }

    mascotWrap.classList.remove("is-center-modal");
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = mascotWrap.getBoundingClientRect();
    const mw = box.width || 580;
    const mh = box.height || 210;
    const gap = 20;
    const laTabHoacNutNho = rect.height <= 76 || b.scrollTop;

    let top, left, flipped = false;
    if (laTabHoacNutNho) {
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - mw / 2, vw - mw - 16));
      top = vh - rect.bottom >= mh + gap + 12 ? rect.bottom + gap : Math.max(16, rect.top - mh - gap);
    } else if (vw - rect.right >= mw + gap + 12) {
      left = rect.right + gap;
      top = Math.max(70, Math.min(rect.top + 8, vh - mh - 18));
      flipped = false;
    } else if (rect.left >= mw + gap + 12) {
      left = rect.left - mw - gap;
      top = Math.max(70, Math.min(rect.top + 8, vh - mh - 18));
      flipped = true;
    } else if (vh - rect.bottom >= mh + gap + 12) {
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - mw / 2, vw - mw - 16));
      top = rect.bottom + gap;
    } else if (rect.top >= mh + gap + 72) {
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - mw / 2, vw - mw - 16));
      top = rect.top - mh - gap;
    } else {
      left = vw - mw - 20;
      top = vh - mh - 18;
    }

    mascotWrap.classList.toggle("is-flipped", flipped);
    mascotWrap.style.left = Math.round(left) + "px";
    mascotWrap.style.top = Math.round(top) + "px";

    if (imgEl && imgEl.dataset.pose === "thuoc") {
      const avW = (mascotWrap.querySelector(".tour-saola-avatar") || {}).offsetWidth || 140;
      const saoladuoCenterX = flipped ? (left + mw - avW / 2) : (left + avW / 2);
      const targetCenterX = rect.left + rect.width / 2;
      imgEl.classList.toggle("is-ruler-right", targetCenterX > saoladuoCenterX);
    }
  }

  function capNhatKhung() {
    if (idx < 0 || idx >= steps.length || !holeEl) return;
    const b = steps[idx];
    if (b.center || !b.target) {
      holeEl.classList.add("is-center");
      datViTriMascot(null);
      return;
    }
    const el = document.querySelector(b.target);
    if (!el || el.offsetParent === null) {
      holeEl.classList.add("is-center");
      datViTriMascot(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = b.scrollTop ? 10 : 8;
    holeEl.classList.remove("is-center");
    holeEl.style.top = Math.max(4, r.top - pad) + "px";
    holeEl.style.left = Math.max(4, r.left - pad) + "px";
    holeEl.style.width = Math.min(window.innerWidth - 8, r.width + pad * 2) + "px";
    holeEl.style.height = r.height + pad * 2 + "px";
    datViTriMascot(r);
  }

  function donMustClick() {
    document.body.classList.remove("tour-must-header");
    if (activeMustEl) {
      activeMustEl.classList.remove("tour-must-click");
      activeMustEl = null;
    }
  }

  function renderBuoc(i) {
    donMustClick();
    idx = i;
    if (idx >= steps.length) { ketThuc(true); return; }

    const b = steps[idx];
    if (typeof b.onEnter === "function") b.onEnter();

    if (b.scrollTop) {
      window.scrollTo({ top: 0, behavior: "auto" });
    } else if (b.target) {
      const el = document.querySelector(b.target);
      if (el) {
        const r = el.getBoundingClientRect();
        el.scrollIntoView({ behavior: "smooth", block: r.height > 260 ? "start" : "center" });
      }
    }

    if (b.mustClick) {
      const mEl = document.querySelector(b.mustClick);
      if (mEl) {
        activeMustEl = mEl;
        mEl.classList.add("tour-must-click");
        if (mEl.closest("#header")) document.body.classList.add("tour-must-header");
      }
    }

    const anh = layAnhTour(b);
    mascotWrap.innerHTML = `
      <div class="tour-saola-avatar">
        <img src="${anh.src}" data-pose="${anh.pose}" alt="Saoladuo"${anh.fallback ? ` onerror="this.onerror=null;this.src='${anh.fallback}'"` : ""}>
      </div>
      <div class="tour-bubble" role="dialog" aria-live="polite">
        <span class="tour-bubble-step">${b.badge}</span>
        <h3>${b.title}</h3>
        <p>${b.text}</p>
        ${b.hint ? `<div class="tour-action-hint"><i class="fa-solid fa-hand-pointer"></i> ${b.hint}</div>` : ""}
        <div class="tour-bubble-foot">
          <button type="button" class="tour-btn-skip" id="tourSkipBtn">Bỏ qua hướng dẫn</button>
          ${b.nextLabel ? `<button type="button" class="tour-btn-next" id="tourNextBtn">${b.nextLabel}</button>` : ""}
        </div>
      </div>
    `;

    const skipBtn = document.getElementById("tourSkipBtn");
    if (skipBtn) skipBtn.addEventListener("click", () => ketThuc(true));

    const nextBtn = document.getElementById("tourNextBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (typeof b.onNext === "function") b.onNext();
        renderBuoc(idx + 1);
      });
    }

    requestAnimationFrame(() => {
      capNhatKhung();
      setTimeout(capNhatKhung, 320);
      setTimeout(capNhatKhung, 600);
    });
  }

  function chanClickNgoai(e) {
    if (idx < 0) return;
    if (mascotWrap && mascotWrap.contains(e.target)) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden") && dc.contains(e.target)) return;

    const b = steps[idx];
    if (b && b.mustClick) {
      const targetBtn = e.target.closest(b.mustClick);
      if (targetBtn) {
        if (typeof b.onAction === "function") b.onAction(targetBtn);
        if (!b.staysOnPage) return; // Cho phép bấm tab Header qua trang khác
        // Chờ tab Khoa bảng gọi API render xong #kb-noi-dung
        setTimeout(() => renderBuoc(idx + 1), 360);
        return;
      }
    }

    e.preventDefault();
    e.stopPropagation();
    const bubble = mascotWrap && mascotWrap.querySelector(".tour-bubble");
    if (bubble) {
      bubble.classList.remove("is-shaking");
      void bubble.offsetWidth;
      bubble.classList.add("is-shaking");
    }
  }

  function chanCuon(e) {
    e.preventDefault();
  }

  function chanPhimCuon(e) {
    const k = e.key;
    if (k === "ArrowUp" || k === "ArrowDown" || k === "PageUp" || k === "PageDown" || k === "Home" || k === "End" || (k === " " && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA")) {
      e.preventDefault();
    }
  }

  function ketThuc(luuCo) {
    donMustClick();
    idx = -1;
    if (luuCo) localStorage.setItem(KHOA_XONG, "1");
    document.documentElement.classList.remove("tour-dang-chay");
    document.body.classList.remove("tour-dang-chay");
    document.removeEventListener("click", chanClickNgoai, true);
    window.removeEventListener("wheel", chanCuon, { capture: true });
    window.removeEventListener("touchmove", chanCuon, { capture: true });
    window.removeEventListener("keydown", chanPhimCuon, true);
    window.removeEventListener("resize", capNhatKhung);
    window.removeEventListener("scroll", capNhatKhung, true);
    if (holeEl) { holeEl.remove(); holeEl = null; }
    if (mascotWrap) { mascotWrap.remove(); mascotWrap = null; }
    if (luuCo) window.dispatchEvent(new CustomEvent("vnstarl:tour-ket-thuc"));
  }

  function dungCacBuoc(laNoiTiep) {
    const ds = [];

    if (!laNoiTiep) {
      ds.push({
        id: "chao-kb",
        badge: "Khởi động · Khoa bảng",
        title: "Chào mừng đến Bảng Vàng Khoa Cử!",
        text: "Bấm bắt đầu để tớ giới thiệu 3 kỳ thi Thi Hương, Thi Hội, Thi Đình và cách ghi danh lên bảng vàng nhé!",
        center: true,
        nextLabel: "Bắt đầu khám phá Khoa bảng ✦",
        onNext: () => phatLoiKhoaBang("kb_chao", false),
      });
    }

    ds.push(
      {
        id: "tong-quan-kb",
        badge: "Bước 1 / 5",
        title: "Ba kỳ thi, ba bậc danh vọng",
        text: "Ở đây có Thi Hương (mỗi tuần), Thi Hội (mỗi tháng) và Thi Đình (mỗi quý). Điểm thi được tổng hợp để phong học vị và ghi danh vào bảng vàng!",
        target: "#kb-noi-dung",
        nextLabel: "Xem chọn nhóm thi ➔",
        onEnter: () => {
          if (laNoiTiep) phatLoiKhoaBang("kb_chao", true);
        },
        onNext: () => phatLoiKhoaBang("kb_gioi_thieu", false),
      },
      {
        id: "nhom-mon-kb",
        badge: "Bước 2 / 5",
        title: "Chia bảng theo môn chuyên",
        text: "Bảng vàng tự mở đúng nhóm môn của cậu (hoặc cậu có thể bấm qua lại giữa Không chuyên và các môn Chuyên để xem đối thủ cùng khối).",
        target: "#kb-bang",
        nextLabel: "Thử xem Thi Hương ➔",
      },
      {
        id: "bam-huong",
        badge: "Nhiệm vụ 1 · Thao tác",
        title: "Mở chi tiết kỳ Thi Hương",
        text: "Hãy bấm trực tiếp vào tab Thi Hương đang phát sáng để xem quy chế, đồng hồ đếm ngược và bảng xếp hạng tuần!",
        target: '#kb-tabs > a[data-tab="huong"]',
        mustClick: '#kb-tabs > a[data-tab="huong"]',
        staysOnPage: true,
        hint: "Bấm vào tab \"Thi Hương\" để tiếp tục",
      },
      {
        id: "xem-huong",
        badge: "Bước 3 / 5",
        title: "Bên trong kỳ Thi Hương",
        text: "Cậu thấy bảng thành phần điểm, đếm ngược chốt kỳ và danh hiệu dự kiến (Giải Nguyên, Hương Cống...). Thi Hội và Thi Đình cũng xem tương tự nhé!",
        target: "#kb-noi-dung",
        nextLabel: "Qua xem Hồ sơ ➔",
      },
      {
        id: "bam-ho-so",
        badge: "Nhiệm vụ 2 · Thao tác",
        title: "Mở Hồ sơ Khoa bảng",
        text: "Giờ hãy bấm vào tab Hồ sơ đang sáng lên để xem nơi lưu lại toàn bộ danh hiệu cậu từng đạt được!",
        target: '#kb-tabs > a[data-tab="ho-so"]',
        mustClick: '#kb-tabs > a[data-tab="ho-so"]',
        staysOnPage: true,
        hint: "Bấm vào tab \"Hồ sơ\" để tiếp tục",
      },
      {
        id: "xem-ho-so",
        badge: "Bước 4 / 5",
        title: "Gia phả danh hiệu của riêng cậu",
        text: "Mỗi khi kết thúc một kỳ thi mà lọt top, danh hiệu sẽ được khắc vĩnh viễn tại đây kèm khung huy hiệu cho avatar!",
        target: "#kb-noi-dung",
        nextLabel: "Chuyển sang trang cuối ➔",
      },
      {
        id: "qua-xep-hang",
        badge: "Chuyển trạm · 3/3",
        title: "Ghé xem Bảng Xếp Hạng",
        text: "Hoàn thành Khoa bảng rồi! Bấm vào tab Xếp hạng đang nhấp nháy trên thanh menu để xem thứ hạng chung của mình, hoặc kết thúc hướng dẫn ngay tại đây nhé.",
        target: "#link-xep-hang",
        mustClick: "#link-xep-hang",
        staysOnPage: false,
        scrollTop: true,
        hint: "Bấm vào \"Xếp hạng\" trên menu để ghé trang",
        nextLabel: "Hoàn tất toàn bộ 🎉",
        onAction: () => {
          localStorage.setItem(KHOA_XONG, "1");
          sessionStorage.setItem(KHOA_CHAIN, "ranking");
        },
      }
    );

    return ds;
  }

  function batDau(laNoiTiep) {
    if (!mqDesktop.matches) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden")) {
      window.addEventListener("daily-checkin:closed", () => batDau(laNoiTiep), { once: true });
      return;
    }
    if (idx >= 0) ketThuc(false);

    steps = dungCacBuoc(laNoiTiep);
    document.documentElement.classList.add("tour-dang-chay");
    document.body.classList.add("tour-dang-chay");
    holeEl = document.createElement("div");
    holeEl.className = "tour-hole is-center";
    mascotWrap = document.createElement("div");
    mascotWrap.className = "tour-mascot-wrap is-center-modal";

    document.body.append(holeEl, mascotWrap);
    document.addEventListener("click", chanClickNgoai, true);
    window.addEventListener("wheel", chanCuon, { passive: false, capture: true });
    window.addEventListener("touchmove", chanCuon, { passive: false, capture: true });
    window.addEventListener("keydown", chanPhimCuon, true);
    window.addEventListener("resize", capNhatKhung);
    window.addEventListener("scroll", capNhatKhung, true);

    renderBuoc(0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!mqDesktop.matches) return;

    const btnReplay = document.getElementById("btn-mo-tour-kb");
    if (btnReplay) {
      btnReplay.addEventListener("click", () => batDau(false));
    }

    const laNoiTiep = sessionStorage.getItem(KHOA_CHAIN) === "khoa-bang";
    const chuaXong = localStorage.getItem(KHOA_XONG) !== "1";
    if (!laNoiTiep && !chuaXong) return;
    if (laNoiTiep) sessionStorage.removeItem(KHOA_CHAIN);

    // Chờ khoa-bang.js tải xong #kb-bang và #kb-noi-dung (tối đa 5 giây)
    const batDauCho = Date.now();
    const timer = setInterval(() => {
      const coNhom = document.querySelector("#kb-bang [data-b]");
      const coNoiDung = document.querySelector("#kb-noi-dung > *");
      if (coNhom && coNoiDung) {
        clearInterval(timer);
        batDau(laNoiTiep);
      } else if (Date.now() - batDauCho > 5000) {
        clearInterval(timer);
      }
    }, 120);
  });
})();
