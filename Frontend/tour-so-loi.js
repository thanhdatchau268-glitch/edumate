// tour-so-loi.js - Hướng dẫn tương tác kiểu Game "Làm A mới qua B" cho Sổ Lỗi Sai (PC)
(function () {
  "use strict";

  const uid = localStorage.getItem("userId");
  if (localStorage.getItem("isLoggedIn") !== "true" || !uid) return;

  const KHOA_XONG = "vnstarl_tour_soloi_" + uid;
  const KHOA_CHAIN = "vnstarl_tour_chain";
  const mqDesktop = window.matchMedia("(min-width: 641px)");

  let steps = [];
  let idx = -1;
  let holeEl = null;
  let mascotWrap = null;
  let activeMustEl = null;

  const IMG_INTRO = "img/tour/saoladuo_sach.webp";
  const POSE_INTRO = "sach";
  const IMG_THUOC = "img/tour/saoladuo_thuoc.webp";

  function layAnhTour(b) {
    if (!b || b.center || !b.target) {
      return { src: IMG_INTRO, pose: POSE_INTRO };
    }
    return { src: IMG_THUOC, pose: "thuoc" };
  }

  function phatAmSL(ma, auto) {
    sessionStorage.setItem("saola_da_soloi_" + uid, "1");
    sessionStorage.setItem("saola_da_3buoc_" + uid, "1");
    const chup = (tt) => {
      if (tt && window.SAOLA) window.SAOLA.noi(ma, auto ? { auto: true } : undefined);
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
        if (b.staysOnPage === false && b.mustClick) {
          const targetEl = document.querySelector(b.mustClick);
          if (typeof b.onAction === "function") b.onAction(targetEl);
          if (targetEl && typeof targetEl.click === "function") {
            targetEl.click();
            return;
          }
        }
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
    if (e && e.isTrusted === false) return;
    if (mascotWrap && mascotWrap.contains(e.target)) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden") && dc.contains(e.target)) return;

    const b = steps[idx];
    if (b && b.mustClick) {
      const targetBtn = e.target.closest(b.mustClick);
      if (targetBtn) {
        if (typeof b.onAction === "function") b.onAction(targetBtn);
        if (!b.staysOnPage) return; // Cho phép chuyển trang
        if (b.waitFor) {
          const batDauCho = Date.now();
          const choTimer = setInterval(() => {
            if (document.querySelector(b.waitFor) || Date.now() - batDauCho > 3500) {
              clearInterval(choTimer);
              renderBuoc(idx + 1);
            }
          }, 100);
          return;
        }
        setTimeout(() => renderBuoc(idx + 1), 200);
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
        id: "chao-sl",
        badge: "Khởi động · Sổ lỗi sai",
        title: "Chào mừng đến Sổ lỗi sai!",
        text: "Đây là nơi tự động lưu lại các câu cậu từng làm sai và lên lịch ôn lại sau 1–3–7 ngày để nhớ thật lâu!",
        center: true,
        nextLabel: "Bắt đầu khám phá Sổ lỗi sai ✦",
        onNext: () => phatAmSL("so_loi_nhac", false),
      });
    }

    ds.push({
      id: "tong-quan-sl",
      badge: "Bước 1 / 5",
      title: "Tổng quan Sổ lỗi sai",
      text: "Cậu theo dõi được số câu cần sửa, kỹ năng đến hạn ôn hôm nay và bấm nút Ôn ngay bất cứ lúc nào!",
      target: "#sl-tom-tat",
      nextLabel: "Xem trình tự ôn ➔",
      onEnter: () => {
        if (laNoiTiep) phatAmSL("so_loi_nhac", true);
      },
    });

    const coTheLoi = !!document.querySelector('#sl-ds button.sl-btn[data-key]');
    if (coTheLoi) {
      ds.push(
        {
          id: "mo-the-sl",
          badge: "Nhiệm vụ · Thao tác",
          title: "Mở một thẻ Sổ lỗi sai",
          text: "Hãy bấm vào nút sửa/ôn trên thẻ kỹ năng đang phát sáng để xem trình tự 3 bước làm bài chuẩn nhé!",
          target: '#sl-ds button.sl-btn[data-key]',
          mustClick: '#sl-ds button.sl-btn[data-key]',
          staysOnPage: true,
          waitFor: "#sl-card .sl-thang-goi-y",
          hint: "Bấm vào nút sửa/ôn trên thẻ để mở câu hỏi",
        },
        {
          id: "trinh-tu-sl",
          badge: "Bước 2 / 5",
          title: "Trình tự 3 bước gợi ý",
          text: "Khi gặp câu khó trong Sổ lỗi sai, đừng vội xem đáp án ngay mà hãy đi theo đúng 3 tầng gợi ý bên dưới!",
          target: "#sl-card .sl-thang-goi-y",
          nextLabel: "Xem bước 1 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_0", false),
        },
        {
          id: "buoc-1-lt",
          badge: "Bước 3 / 5",
          title: "Bước 1: Xem lại lý thuyết",
          text: "Đầu tiên, bấm \"Nhắc khái niệm\" để nhớ lại định nghĩa, công thức hoặc kiến thức cốt lõi của bài.",
          target: '#sl-card .sl-gy[data-tang="1"]',
          nextLabel: "Xem bước 2 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_1", false),
        },
        {
          id: "buoc-2-cg",
          badge: "Bước 4 / 5",
          title: "Bước 2: Xem lại cách giải",
          text: "Tiếp theo, bấm \"Gợi ý hướng làm\" để xem cách tư duy và hướng giải từng bước (trắc nghiệm sẽ được loại bớt phương án nhiễu).",
          target: '#sl-card .sl-gy[data-tang="2"]',
          nextLabel: "Xem bước 3 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_2", false),
        },
        {
          id: "buoc-3-da",
          badge: "Bước 5 / 5",
          title: "Bước 3: Xem đáp án",
          text: "Cuối cùng, nếu vẫn chưa làm ra thì mới mở \"Xem lời giải\" để đối chiếu đáp án và đọc bài giải hoàn chỉnh nhé!",
          target: '#sl-card .sl-gy[data-tang="3"]',
          nextLabel: "Sang Kho Bài Tập ➔",
          onEnter: () => phatAmSL("so_loi_buoc_3", false),
        }
      );
    } else {
      ds.push(
        {
          id: "trinh-tu-sl",
          badge: "Bước 2 / 5",
          title: "Lộ trình 3 bước ghi nhớ",
          text: "Đây là trình tự 3 bước cậu nên làm mỗi khi vào Sổ lỗi sai để biến điểm yếu thành điểm mạnh!",
          target: ".sl-cycle-box",
          nextLabel: "Xem bước 1 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_0", false),
        },
        {
          id: "buoc-1-lt",
          badge: "Bước 3 / 5",
          title: "Bước 1: Xem lại lý thuyết",
          text: "Đầu tiên hãy xem lại lý thuyết gốc của câu từng làm sai để chắc kiến thức nền.",
          target: ".sl-cycle-steps li:nth-child(1)",
          nextLabel: "Xem bước 2 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_1", false),
        },
        {
          id: "buoc-2-cg",
          badge: "Bước 4 / 5",
          title: "Bước 2: Xem lại cách giải",
          text: "Thứ hai là xem gợi ý cách giải và tự chứng minh lại bằng một câu tương tự.",
          target: ".sl-cycle-steps li:nth-child(2)",
          nextLabel: "Xem bước 3 ➔",
          onEnter: () => phatAmSL("so_loi_buoc_2", false),
        },
        {
          id: "buoc-3-da",
          badge: "Bước 5 / 5",
          title: "Bước 3: Xem đáp án & Thông thạo",
          text: "Cuối cùng đối chiếu đáp án khi cần; đúng đủ chu kỳ 1–3–7 ngày kỹ năng sẽ lên mức Thông thạo!",
          target: ".sl-cycle-steps li:nth-child(3)",
          nextLabel: "Sang Kho Bài Tập ➔",
          onEnter: () => phatAmSL("so_loi_buoc_3", false),
        }
      );
    }

    ds.push({
      id: "qua-bai-tap",
      badge: "Chuyển trạm · 2/4",
      title: "Sang mục Bài tập",
      text: "Cậu đã nắm cách dùng Sổ lỗi sai rồi! Giờ hãy bấm vào tab Bài tập đang phát sáng trên thanh menu để khám phá kho đề luyện thi nhé.",
      target: "#link-bai-tap",
      mustClick: "#link-bai-tap",
      scrollTop: true,
      staysOnPage: false,
      hint: 'Bấm vào "Bài tập" trên menu để sang trang mới',
      nextLabel: "Sang Kho Bài Tập ➔",
      onAction: () => {
        localStorage.setItem(KHOA_XONG, "1");
        sessionStorage.setItem(KHOA_CHAIN, "subjects");
      },
    });

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

    // Nếu đang mở thẻ sửa lỗi sẵn khi bấm "Hướng dẫn" thì quay về bản đồ kỹ năng để lấy #sl-tom-tat/#sl-ds
    const btnVe = document.getElementById("sl-ve") || document.getElementById("sl-ve2");
    const theEl = document.getElementById("sl-the");
    if (theEl && !theEl.classList.contains("hidden") && btnVe) btnVe.click();

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

    const btnReplay = document.getElementById("btn-mo-tour-sl");
    if (btnReplay) {
      btnReplay.addEventListener("click", () => batDau(false));
    }

    const laNoiTiep = sessionStorage.getItem(KHOA_CHAIN) === "so-loi";
    const chuaXong = localStorage.getItem(KHOA_XONG) !== "1";
    if (!laNoiTiep && !chuaXong) return;
    if (laNoiTiep) sessionStorage.removeItem(KHOA_CHAIN);

    // Chờ so-loi.js tải xong #sl-tom-tat và #sl-ds (tối đa 5 giây)
    const batDauCho = Date.now();
    const timer = setInterval(() => {
      const tomTat = document.getElementById("sl-tom-tat");
      if (tomTat && tomTat.innerHTML.trim() !== "") {
        clearInterval(timer);
        batDau(laNoiTiep);
      } else if (Date.now() - batDauCho > 5000) {
        clearInterval(timer);
      }
    }, 120);
  });
})();
