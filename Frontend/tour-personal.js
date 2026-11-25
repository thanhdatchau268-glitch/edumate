// tour-personal.js - Hướng dẫn tương tác kiểu Game "Làm A mới qua B" cho trang Học tập cá nhân hoá (PC)
(function () {
  "use strict";

  const uid = localStorage.getItem("userId");
  if (!uid) return;

  const KHOA_XONG = "vnstarl_tour_personal_" + uid;
  const mqDesktop = window.matchMedia("(min-width: 641px)");

  const BUOC = [
    {
      id: "chao",
      badge: "Khởi động",
      title: "Xin chào sĩ tử mới!",
      text: "Tớ là Saoladuo! Bấm bắt đầu để tớ dẫn cậu đi một vòng làm quen góc Học tập cá nhân hoá nhé.",
      center: true,
      nextLabel: "Bắt đầu khám phá cùng Saoladuo ✦",
      onNext: () => {
        // Cú click vừa mở khóa audio trình duyệt -> phát luôn lời chào đầu tiên
        if (window.SAOLA) window.SAOLA.noi("chao_moi");
      },
    },
    {
      id: "tong-quan",
      badge: "Bước 1 / 7",
      title: "Góc Học tập cá nhân hoá",
      text: "Đây là trung tâm điều phối việc học hằng ngày của cậu: nhận nhiệm vụ tích điểm, tự xếp thời gian biểu ôn thi và lưu điểm các kỳ lớp 9.",
      center: true,
      nextLabel: "Xem khu Nhiệm vụ ➔",
    },
    {
      id: "nhiem-vu",
      badge: "Bước 2 / 7",
      title: "Nhiệm vụ hôm nay",
      text: "Mỗi ngày có 3 nhiệm vụ từ Dễ đến Khó. Làm xong nhớ bấm nhận điểm và hoàn thành đủ cả 3 để nhận thêm 1 lượt quay thưởng nhé!",
      target: "#nhiem-vu",
      nextLabel: "Đi tiếp ➔",
    },
    {
      id: "cum-tab",
      badge: "Bước 3 / 7",
      title: "3 khu vực chính bên dưới",
      text: "Bên dưới là 3 tab quan trọng: Sổ lỗi sai (vá lỗ hổng kiến thức), Thiết lập (nhập lịch) và Điểm số (lưu điểm thi). Giờ mình cùng mở thử từng tab nhé!",
      target: ".tab-chinh",
      nextLabel: "Thực hành mở Tab ➔",
    },
    {
      id: "bam-setup",
      badge: "Nhiệm vụ 1 · Thao tác",
      title: "Bấm vào tab Thiết lập",
      text: "Hãy bấm trực tiếp vào nút Thiết lập đang phát sáng để mở bảng cài đặt thời gian biểu!",
      target: "#tab-setup",
      mustClick: "#tab-setup",
      staysOnPage: true,
      hint: "Bấm vào nút \"Thiết lập\" để tiếp tục",
    },
    {
      id: "xem-setup",
      badge: "Bước 4 / 7",
      title: "Bên trong mục Thiết lập",
      text: "Tại đây cậu tải ảnh Thời khóa biểu (hoặc tự gõ), thêm buổi Học thêm, Công việc tuần này và giờ đi ngủ. Hệ thống sẽ tự tránh giờ kẹt để xếp lịch!",
      target: "#pn-setup .setup-card",
      nextLabel: "Qua tab Sổ lỗi sai ➔",
      onEnter: () => {
        const pn = document.getElementById("pn-setup");
        const tb = document.getElementById("tab-setup");
        if (pn && pn.hidden && tb) tb.click();
      },
    },
    {
      id: "bam-so-loi",
      badge: "Nhiệm vụ 2 · Thao tác",
      title: "Bấm vào tab Sổ lỗi sai",
      text: "Giờ cậu hãy bấm trực tiếp vào tab Sổ lỗi sai đang sáng lên để xem bản đồ kỹ năng và các thẻ cần ôn của mình.",
      target: "#tab-so-loi",
      mustClick: "#tab-so-loi",
      staysOnPage: true,
      hint: "Bấm vào nút \"Sổ lỗi sai\" để tiếp tục",
    },
    {
      id: "xem-so-loi",
      badge: "Bước 5 / 7",
      title: "Bản đồ Sổ lỗi sai thông minh",
      text: "Mọi câu từng làm sai sẽ gom lại theo từng bài học, tự hẹn ngày ôn lại và phân loại mức độ để cậu vá đúng chỗ hổng nhanh nhất.",
      target: "#pn-so-loi",
      nextLabel: "Qua tab Điểm số ➔",
      onEnter: () => {
        const pn = document.getElementById("pn-so-loi");
        const tb = document.getElementById("tab-so-loi");
        if (pn && pn.hidden && tb) tb.click();
      },
    },
    {
      id: "bam-diem",
      badge: "Nhiệm vụ 3 · Thao tác",
      title: "Bấm vào tab Điểm số",
      text: "Bước cuối trong góc Cá nhân hoá: hãy bấm vào tab Điểm số đang nhấp nháy!",
      target: "#tab-diem",
      mustClick: "#tab-diem",
      staysOnPage: true,
      hint: "Bấm vào nút \"Điểm số\" để tiếp tục",
    },
    {
      id: "xem-diem",
      badge: "Bước 6 / 7",
      title: "Lưu điểm các kỳ lớp 9",
      text: "Kỳ thi nào tới ngày mở cậu nhập điểm vào bảng này; điểm sẽ tự động đồng bộ sang trang Khảo sát chọn trường để tính xác suất đỗ chuẩn hơn!",
      target: "#pn-diem .khung",
      nextLabel: "Khám phá Sổ lỗi sai ➔",
      onEnter: () => {
        const pn = document.getElementById("pn-diem");
        const tb = document.getElementById("tab-diem");
        if (pn && pn.hidden && tb) tb.click();
      },
    },
    {
      id: "qua-so-loi",
      badge: "Chuyển trạm · 1/4",
      title: "Mở Sổ lỗi sai ngay!",
      text: "Mọi câu cậu từng làm sai sẽ tự động gom vào Sổ lỗi sai để ôn lại cho nhớ thật sâu. Bấm vào nút Sổ lỗi sai đang phát sáng để ghé xem ngay nhé!",
      target: "#btn-so-loi",
      mustClick: "#btn-so-loi",
      staysOnPage: false,
      hint: "Bấm vào nút \"Sổ lỗi sai\" để mở trang",
      nextLabel: "Hoàn tất tại đây 🎉",
      onEnter: () => {
        const tabSoLoi = document.getElementById("tab-so-loi");
        if (tabSoLoi) tabSoLoi.click();
      },
      onAction: () => {
        localStorage.setItem(KHOA_XONG, "1");
        sessionStorage.setItem("vnstarl_tour_chain", "so-loi");
      },
    },
  ];

  let idx = -1;
  let holeEl = null;
  let mascotWrap = null;
  let activeMustEl = null;

  const IMG_INTRO = "img/tour/saoladuo_chao.webp";
  const POSE_INTRO = "chao";
  const IMG_THUOC = "img/tour/saoladuo_thuoc.webp";

  function layAnhTour(b) {
    if (!b || b.center || !b.target) {
      return { src: IMG_INTRO, pose: POSE_INTRO };
    }
    return { src: IMG_THUOC, pose: "thuoc" };
  }

  function datViTriMascot(rect) {
    if (!mascotWrap) return;
    const b = BUOC[idx];
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
    const laTabHoacNutNho =
      rect.height <= 120 ||
      b.scrollTop ||
      b.target === ".tab-chinh" ||
      (typeof b.target === "string" && b.target.indexOf("#tab-") === 0);

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
    if (idx < 0 || idx >= BUOC.length || !holeEl) return;
    const b = BUOC[idx];
    if (b.center || !b.target) {
      holeEl.classList.add("is-center");
      datViTriMascot(null);
      return;
    }
    const el = document.querySelector(b.target);
    if (!el || el.hidden) {
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
    document.querySelectorAll(".tour-must-parent").forEach((el) => el.classList.remove("tour-must-parent"));
    if (activeMustEl) {
      activeMustEl.classList.remove("tour-must-click");
      activeMustEl = null;
    }
  }

  function renderBuoc(i) {
    donMustClick();
    idx = i;
    if (idx >= BUOC.length) { ketThuc(true); return; }

    const b = BUOC[idx];
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
        const tabDock = mEl.closest(".tab-chinh");
        if (tabDock) tabDock.classList.add("tour-must-parent");
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
          <button type="button" class="tour-btn-skip" id="tourSkipBtn">${b.staysOnPage === false ? "Hoàn tất tại đây" : "Bỏ qua hướng dẫn"}</button>
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
      setTimeout(capNhatKhung, 140);
      setTimeout(capNhatKhung, 340);
      setTimeout(capNhatKhung, 560);
    });
  }

  // Khóa mọi click ra ngoài vùng được phép ("Làm A mới qua B")
  function chanClickNgoai(e) {
    if (idx < 0) return;
    if (mascotWrap && mascotWrap.contains(e.target)) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden") && dc.contains(e.target)) return;

    const b = BUOC[idx];
    if (b && b.mustClick) {
      const targetBtn = e.target.closest(b.mustClick);
      if (targetBtn) {
        if (typeof b.onAction === "function") b.onAction(targetBtn);
        if (b.staysOnPage === false) return; // Cho phép chuyển trang sang subjects.html
        // Cho phép sự kiện click thật đi tới personal.js để mở tab, rồi tự chuyển sang bước B
        setTimeout(() => renderBuoc(idx + 1), 160);
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

  function batDauTour() {
    if (!mqDesktop.matches) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden")) {
      window.addEventListener("daily-checkin:closed", () => batDauTour(), { once: true });
      return;
    }
    if (idx >= 0) ketThuc(false);

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
    const replayBtn = document.getElementById("btn-mo-tour");
    if (replayBtn) replayBtn.addEventListener("click", batDauTour);

    if (mqDesktop.matches && localStorage.getItem(KHOA_XONG) !== "1") {
      setTimeout(batDauTour, 350);
    }
  });
})();
