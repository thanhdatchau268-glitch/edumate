// tour-bai-tap.js - Hướng dẫn tương tác kiểu Game "Làm A mới qua B" cho Kho Bài Tập (PC)
// Chạy liên mạch từ subjects.html sang problems.html và nối tiếp sang khoa-bang.html
(function () {
  "use strict";

  const uid = localStorage.getItem("userId");
  if (localStorage.getItem("isLoggedIn") !== "true" || !uid) return;

  const KHOA_XONG = "vnstarl_tour_baitap_" + uid;
  const KHOA_TRANG_THAI = "vnstarl_tour_bt_stage"; // "problems" khi vừa chuyển từ subjects -> problems
  const KHOA_CHAIN = "vnstarl_tour_chain";
  const mqDesktop = window.matchMedia("(min-width: 641px)");
  const trang = (location.pathname.split("/").pop() || "subjects.html").toLowerCase();

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

  function goiSaola(ma, auto) {
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
      if (b.scrollTop) setTimeout(capNhatKhung, 520);
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
        if (!b.staysOnPage) return; // Cho phép chuyển trang (subjects -> problems hoặc problems -> khoa-bang)
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
    sessionStorage.removeItem(KHOA_TRANG_THAI);
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

  function dungCacBuocSubjects(laNoiTiep) {
    const ds = [];

    if (!laNoiTiep) {
      ds.push({
        id: "chao-bt",
        badge: "Khởi động · Bài tập",
        title: "Chào mừng đến Kho Bài Tập!",
        text: "Bấm bắt đầu để tớ giới thiệu nhanh cách chọn môn, chọn chương và luyện bài hiệu quả nhất nhé!",
        center: true,
        nextLabel: "Bắt đầu khám phá Kho Bài Tập ✦",
        onNext: () => {
          localStorage.setItem("saola_da_vao_bt_" + uid, "1");
          sessionStorage.setItem("saola_da_bt_ss_" + uid, "1");
          goiSaola("bt_lan_dau", false);
        },
      });
    }

    ds.push(
      {
        id: "tong-quan-bt",
        badge: "Bước 1 / 6",
        title: "Trung tâm luyện thi VnStarL",
        text: "Đây là nơi tập hợp toàn bộ chuyên đề lớp 9 (Toán, Ngữ Văn và môn Chuyên), giúp cậu tích điểm lên bảng vàng và vá lỗ hổng kiến thức.",
        center: true,
        nextLabel: "Xem cột theo dõi ➔",
        onEnter: () => {
          if (laNoiTiep) {
            localStorage.setItem("saola_da_vao_bt_" + uid, "1");
            sessionStorage.setItem("saola_da_bt_ss_" + uid, "1");
            goiSaola("bt_lan_dau", true);
          }
        },
      },
      {
        id: "cot-phai",
        badge: "Bước 2 / 6",
        title: "Nhiệm vụ & Mục tiêu tuần",
        text: "Cột bên phải theo dõi 3 nhiệm vụ trong ngày, số bài cậu đã giải trong tuần và chuỗi ngày học liên tục.",
        target: ".col-right-social",
        nextLabel: "Xem các môn học ➔",
      },
      {
        id: "ba-mon",
        badge: "Bước 3 / 6",
        title: "Lộ trình 3 môn trọng tâm",
        text: "Mỗi thẻ hiển thị phần trăm hoàn thành thật và tổng số bài tập của cậu ở Toán học, Ngữ Văn và môn Chuyên.",
        target: "#subject-grid",
        nextLabel: "Đi tiếp ➔",
      }
    );

    // Chỉ thêm bước spotlight "Các môn đang làm dở" nếu khối đó đang hiển thị
    const resumeEl = document.getElementById("resume-section");
    if (resumeEl && getComputedStyle(resumeEl).display !== "none") {
      ds.push({
        id: "lam-do",
        badge: "Bổ sung",
        title: "Các môn đang làm dở",
        text: "Nếu cậu dừng giữa chừng một bài, hệ thống tự giữ vị trí ngay đây để hôm sau bấm Làm tiếp ngay.",
        target: "#resume-section",
        nextLabel: "Thực hành chọn môn ➔",
      });
    }

    ds.push({
      id: "bam-chon-mon",
      badge: "Nhiệm vụ 1 · Thao tác",
      title: "Mở một môn học đầu tiên",
      text: "Hãy bấm trực tiếp vào thẻ Toán học đang phát sáng để vào xem danh sách chương & bài học!",
      target: "#subject-grid a.rich-card",
      mustClick: "#subject-grid a.rich-card",
      staysOnPage: false,
      hint: "Bấm vào thẻ môn để đi tiếp",
      onAction: () => {
        sessionStorage.setItem(KHOA_TRANG_THAI, "problems");
      },
    });

    return ds;
  }

  function dungCacBuocProblems() {
    const hasSecondChap = !!document.querySelector("#chuong-ds button.pl-chap:nth-child(2)");
    const chapSelector = hasSecondChap ? "#chuong-ds button.pl-chap:nth-child(2)" : "#chuong-ds button.pl-chap";
    return [
      {
        id: "chon-chuong",
        badge: "Nhiệm vụ 2 · Thao tác",
        title: "Chọn chương muốn ôn tập",
        text: "Cột bên phải là toàn bộ các chương kèm thanh điểm. Hãy bấm thử vào chương đang phát sáng để xem bài học đổi theo nhé!",
        target: "#chuong-ds",
        mustClick: chapSelector,
        staysOnPage: true,
        hint: "Bấm vào chương đang phát sáng để tiếp tục",
      },
      {
        id: "ds-bai",
        badge: "Bước 6 / 6",
        title: "Chọn bài học & Bắt đầu luyện tập",
        text: "Bên trái là các bài học thuộc chương vừa chọn, hiển thị điểm đạt được và huy hiệu. Cậu bấm vào bất kỳ bài nào để đọc lý thuyết & làm bài!",
        target: "#problem-list",
        nextLabel: "Qua mục Khoa bảng ➔",
      },
      {
        id: "qua-khoa-bang",
        badge: "Chuyển trạm · 2/3",
        title: "Sang mục Khoa bảng",
        text: "Bấm vào tab Khoa bảng đang phát sáng trên thanh menu để tìm hiểu đấu trường Thi Hương, Thi Hội, Thi Đình nhé!",
        target: "#link-khoa-bang",
        mustClick: "#link-khoa-bang",
        staysOnPage: false,
        scrollTop: true,
        hint: "Bấm vào \"Khoa bảng\" trên menu để sang trang mới",
        nextLabel: "Hoàn tất tại đây 🎉",
        onAction: () => {
          localStorage.setItem(KHOA_XONG, "1");
          sessionStorage.setItem(KHOA_CHAIN, "khoa-bang");
        },
      },
    ];
  }

  function batDau(danhSachBuoc) {
    if (!mqDesktop.matches || !danhSachBuoc.length) return;
    const dc = document.getElementById("daily-checkin-overlay");
    if (dc && !dc.classList.contains("hidden")) {
      window.addEventListener("daily-checkin:closed", () => batDau(danhSachBuoc), { once: true });
      return;
    }
    if (idx >= 0) ketThuc(false);

    steps = danhSachBuoc;
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

    if (trang === "subjects.html") {
      const btnReplay = document.getElementById("btn-mo-tour-bt");
      if (btnReplay) {
        btnReplay.addEventListener("click", () => batDau(dungCacBuocSubjects(false)));
      }

      const laNoiTiep = sessionStorage.getItem(KHOA_CHAIN) === "subjects";
      if (laNoiTiep || localStorage.getItem(KHOA_XONG) !== "1") {
        if (laNoiTiep) sessionStorage.removeItem(KHOA_CHAIN);
        const batDauCho = Date.now();
        const timer = setInterval(() => {
          if (document.querySelector("#subject-grid a.rich-card")) {
            clearInterval(timer);
            batDau(dungCacBuocSubjects(laNoiTiep));
          } else if (Date.now() - batDauCho > 4000) {
            clearInterval(timer);
          }
        }, 100);
      }
    } else if (trang === "problems.html" && sessionStorage.getItem(KHOA_TRANG_THAI) === "problems") {
      // Chờ bai-tap.js tải JSON & vẽ xong #chuong-ds và #problem-list (tối đa 5 giây)
      const batDauCho = Date.now();
      const timer = setInterval(() => {
        const coChuong = document.querySelector("#chuong-ds button.pl-chap");
        const coBai = document.querySelector("#problem-list a.bh-the");
        if (coChuong && coBai) {
          clearInterval(timer);
          batDau(dungCacBuocProblems());
        } else if (Date.now() - batDauCho > 5000) {
          clearInterval(timer);
          sessionStorage.removeItem(KHOA_TRANG_THAI);
        }
      }, 120);
    }
  });
})();
