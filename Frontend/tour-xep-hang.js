// tour-xep-hang.js - Hướng dẫn tương tác kiểu Game "Làm A mới qua B" cho Bảng Xếp Hạng (PC)
(function () {
  "use strict";

  const uid = localStorage.getItem("userId");
  if (localStorage.getItem("isLoggedIn") !== "true" || !uid) return;

  const KHOA_XONG = "vnstarl_tour_xephang_" + uid;
  const KHOA_CHAIN = "vnstarl_tour_chain";
  const mqDesktop = window.matchMedia("(min-width: 641px)");

  let steps = [];
  let idx = -1;
  let holeEl = null;
  let mascotWrap = null;
  let activeMustEl = null;

  const IMG_INTRO = "img/tour/saoladuo_xephang.webp";
  const POSE_INTRO = "xephang";
  const IMG_THUOC = "img/tour/saoladuo_thuoc.webp";

  function layAnhTour(b) {
    if (!b || b.center || !b.target) {
      return { src: IMG_INTRO, pose: POSE_INTRO };
    }
    return { src: IMG_THUOC, pose: "thuoc" };
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
        <img src="${anh.src}" data-pose="${anh.pose}" alt="Saoladuo">
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
        setTimeout(() => renderBuoc(idx + 1), 240);
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
    sessionStorage.removeItem(KHOA_CHAIN);
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
        id: "chao-rk",
        badge: "Khởi động · Xếp hạng",
        title: "Chào mừng đến Bảng Xếp Hạng!",
        text: "Đây là chặng cuối cùng trong hành trình tân binh. Bấm bắt đầu để xem cách theo dõi điểm và tranh Cúp Vàng nhé!",
        center: true,
        nextLabel: "Bắt đầu khám phá ✦",
      });
    }

    const kyThangBtn = document.querySelector('#rk-ky [data-ky="thang"]');
    const mustKy = kyThangBtn ? '#rk-ky [data-ky="thang"]' : '#rk-ky button';

    ds.push(
      {
        id: "buc-top3",
        badge: "Bước 1 / 4",
        title: "Bục Vinh Danh & Giải Thưởng",
        text: "Ba sĩ tử đứng đầu mỗi bảng sẽ lên bục Top 1–2–3. Cuối tháng chốt bảng vàng lúc 23:59, Top 1–10 đều nhận thưởng Kim cương và Thẻ Streak!",
        target: ".podium-wrap",
        nextLabel: "Thử đổi kỳ xếp hạng ➔",
      },
      {
        id: "bam-ky-thang",
        badge: "Nhiệm vụ 1 · Thao tác",
        title: "Chuyển sang bảng Tháng này",
        text: "Cậu có thể so tài theo Tổng điểm từ trước tới nay hoặc đua top Tháng này. Hãy bấm nút Tháng này đang phát sáng để xem nhé!",
        target: mustKy,
        mustClick: mustKy,
        hint: "Bấm vào nút \"Tháng này\" để tiếp tục",
      },
      {
        id: "bam-cach-tinh",
        badge: "Nhiệm vụ 2 · Thao tác",
        title: "Mở Cách tính điểm",
        text: "Làm sao leo top nhanh nhất? Bấm vào nút Cách tính điểm đang nhấp nháy để xem chi tiết từng nguồn cộng điểm!",
        target: "#btn-toggle-rules",
        mustClick: "#btn-toggle-rules",
        hint: "Bấm vào \"Cách tính điểm\" để mở bảng",
      },
      {
        id: "xem-cach-tinh",
        badge: "Bước 3 / 4",
        title: "5 nguồn điểm tăng hạng",
        text: "Cậu được cộng điểm khi làm bài lần đầu, giữ chuỗi Streak, thi Khoa bảng, Điểm danh và sửa lỗi trong Sổ lỗi sai.",
        target: "#rk-rules-drawer",
        nextLabel: "Xem vị trí của cậu ➔",
      },
      {
        id: "vi-tri-toi",
        badge: "Bước cuối · 4 / 4",
        title: "Thanh Vị trí của bạn",
        text: "Tại đây cậu luôn biết mình đang đứng hạng mấy và cần thêm bao nhiêu điểm nữa để bắt kịp Top 1. Chúc cậu học thật tốt cùng VnStarL!",
        target: "#my-standing-strip",
        nextLabel: "Hoàn tất hành trình 🎉",
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

    const btnReplay = document.getElementById("btn-mo-tour-rk");
    if (btnReplay) {
      btnReplay.addEventListener("click", () => batDau(false));
    }

    const laNoiTiep = sessionStorage.getItem(KHOA_CHAIN) === "ranking";
    const chuaXong = localStorage.getItem(KHOA_XONG) !== "1";
    if (!laNoiTiep && !chuaXong) return;
    if (laNoiTiep) sessionStorage.removeItem(KHOA_CHAIN);

    // Chờ ranking.js tải xong #rk-bang, #rk-ky và #ranking-list (tối đa 5 giây)
    const batDauCho = Date.now();
    const timer = setInterval(() => {
      const coTab = document.querySelector("#rk-bang button, #rk-ky button");
      const coPodium = document.querySelector("#podium-1");
      if (coTab && coPodium) {
        clearInterval(timer);
        batDau(laNoiTiep);
      } else if (Date.now() - batDauCho > 5000) {
        clearInterval(timer);
      }
    }, 120);
  });
})();
