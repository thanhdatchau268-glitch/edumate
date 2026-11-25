// gate.js - khách (chưa đăng nhập) vào Bài tập / Cuộc thi chỉ thấy giao diện giới thiệu.
// Dùng: <body data-gate="bai-tap"> hoặc <body data-gate="cuoc-thi">, nạp file này TRƯỚC subjects.js / contest.js.
// Đã đăng nhập thì file này không làm gì cả.
(function () {
  "use strict";
  const loai = document.body.dataset.gate;
  if (!loai) return;
  if (localStorage.getItem("isLoggedIn") === "true" && localStorage.getItem("userId")) return;

  const API = "http://127.0.0.1:5000";
  const TRANG_QUAY_LAI = loai === "bai-tap" ? "subjects.html" : "contest.html";
  const $ = (s, g = document) => g.querySelector(s);
  const HANG = window.HANG || [];                                   // từ hang.js
  const iconHang = (p) => (window.iconHang ? window.iconHang(p) : "");

  // ======================================================
  // Mảnh HTML dùng chung
  // ======================================================
  const cta = `
    <div class="gt-cta">
      <a data-cta href="register.html" class="gt-btn dac"><i class="fa-solid fa-user-plus"></i> Đăng ký miễn phí</a>
      <a data-cta href="login.html" class="gt-btn"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</a>
    </div>`;

  const dongCuoi = (tieu, phu) =>
    `<section class="gt-cuoi"><h2>${tieu}</h2><p>${phu}</p>${cta}</section>`;

  const buoc = (ds) => `<div class="interactive-steps-container" id="interactive-steps">${ds.map(([icon, t, m], i) => `
    <div class="step-card" data-step="${i + 1}">
      <div class="step-summary">
        <span class="step-badge">${i + 1}</span>
        <i class="step-ico fa-solid ${icon}"></i>
        <b class="step-name">${t}</b>
      </div>
      <div class="step-detail">
        <p>${m}</p>
      </div>
    </div>`).join("")}</div>`;

  const tinhNang = (ds) => `<div class="gt-tn">${ds.map(([icon, c, t, m]) => `
    <article style="--c:${c}"><i class="fa-solid ${icon}"></i><b>${t}</b><p>${m}</p></article>`).join("")}</div>`;

  const chipDong = (ds) =>
    `<ul class="gt-chip-dong">${ds.map((t) => `<li><i class="fa-solid fa-circle-check"></i>${t}</li>`).join("")}</ul>`;

  // ======================================================
  // TRANG BÀI TẬP
  // ======================================================
  const theMon = (ten, icon) => `
    <div class="subject-card gt-the-mon" tabindex="0" data-khoa="Đăng nhập để vào kho bài tập môn ${ten}.">
      <div class="subject-ico-box"><i class="fa-solid ${icon}"></i></div>
      <span class="subject-name">${ten}</span>
    </div>`;

  // Bài học mẫu: [số, tên, [% điểm của từng bài tập nhỏ]]
  const BAI_MAU = [
    ["01", "Phương trình bậc nhất một ẩn", [100, 85, 62, 45]],
    ["02", "Hệ hai phương trình bậc nhất hai ẩn", [70, 30, 0, 0]],
    ["03", "Bất phương trình bậc nhất một ẩn", [0, 0, 0]],
  ];

  const theBai = ([so, ten, ds]) => {
    const dd = ds.reduce((a, b) => a + b, 0), mx = ds.length * 100;
    return `
      <div class="bh-the" tabindex="0" data-khoa="Đăng nhập để mở bài học, đọc lý thuyết và làm bài tập này.">
        <span class="bh-so">${so}</span>
        <span class="bh-giua">
          <span class="bh-ten">${ten}</span>
          <span class="bh-icons">${ds.map(iconHang).join("")}</span>
        </span>
        <span class="bh-diem">${dd}<small>/ ${mx} điểm</small></span>
        <i class="fa-solid fa-arrow-right"></i>
      </div>`;
  };

  function trangBaiTap() {
    const tongDd = BAI_MAU.reduce((s, b) => s + b[2].reduce((a, c) => a + c, 0), 0);
    const tongMx = BAI_MAU.reduce((s, b) => s + b[2].length * 100, 0);
    const pt = Math.round((tongDd / tongMx) * 100);

    const chuGiai = HANG.map((h) => `
      <div class="cg" style="--c:${h.c}">
        <span class="hang-mini"><i class="fa-solid ${h.icon}"></i></span>
        <div><b>${h.ten}</b><small>${h.nhan} điểm</small></div>
      </div>`).join("");

    return `
    <section class="gt-hero">
     <span class="gt-nhan"><i class="fa-solid fa-lock"></i> Dành cho thành viên VnStarL</span>
      <h1>Kho bài tập luyện thi vào lớp 10</h1>
      ${cta}
    </section>

    <section class="gt-khoi gt-khoi-mon">
      <h2>Các môn đang có</h2>
      <p class="gt-sub">Bấm vào một môn để thử, hệ thống sẽ mời bạn đăng nhập.</p>
      <div class="subject-grid">
        ${theMon("Toán", "fa-calculator")}
        ${theMon("Ngữ Văn", "fa-feather-pointed")}
        ${theMon("Môn chuyên", "fa-shapes")}
      </div>
    </section>

    <section class="gt-khoi gt-khoi-buoc">
      <h2>Luyện tập theo lộ trình rõ ràng</h2>
      <p class="gt-sub">Mỗi bài học đều đi qua 4 bước, bạn luôn biết mình đang ở đâu.</p>
      <div class="split-stage-container" id="split-stage"></div>
    </section>

    <section class="gt-khoi gt-khoi-xem">
      <h2>Xem trước bên trong</h2>
      <p class="gt-sub">Đây là giao diện bạn sẽ dùng hằng ngày. Thử làm ngay câu hỏi bên phải nhé!</p>
      <div class="gt-xem">

        <div class="gt-cua-so">
          <div class="gt-cua-so-dau">
            <span class="gt-cham"><i></i><i></i><i></i></span>
            <span class="gt-cua-so-ten">Bài tập Toán · Chương 1</span>
            <span class="gt-ribbon">Ví dụ minh họa</span>
          </div>
          <div class="gt-cua-so-than">
            <div class="pl-tong">
              <div><div class="so">${tongDd}<small> / ${tongMx}</small></div>
                <div class="nhan">điểm bài tập đã đạt trong chương này</div></div>
              <div class="bar"><i style="width:${pt}%"></i></div><b>${pt}%</b>
            </div>
            <div class="pl-ds">${BAI_MAU.map(theBai).join("")}</div>
          </div>
        </div>

        <div class="gt-cua-so">
          <div class="gt-cua-so-dau">
            <span class="gt-cham"><i></i><i></i><i></i></span>
            <span class="gt-cua-so-ten">Dùng thử 1 câu hỏi</span>
          </div>
          <div class="gt-cua-so-than">
            <div class="question-card q-trac-nghiem" id="gt-demo">
              <div class="cau-dau"><b class="cau-so">Câu 1</b><span class="cau-diem">2 điểm</span></div>
              <div class="cau-de">Nghiệm của phương trình 2x + 3 = 11 là:</div>
              <div class="cau-lua-chon">
                ${["x = 3", "x = 4", "x = 5", "x = 7"].map((t, k) => `
                <label class="lua-chon">
                  <input type="radio" name="gt-q" value="${k}">
                  <span class="lua-chon-ky-hieu">${"ABCD"[k]}</span>
                  <span class="lua-chon-chu">${t}</span>
                </label>`).join("")}
              </div>
              <div class="gt-demo-nut"><button type="button" class="gt-btn dac" id="gt-kt">Kiểm tra</button></div>
              <div class="ket-qua-cau" id="gt-kq" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>

      <h3>5 hạng thành tích cho mỗi bài tập</h3>
      <div class="chu-giai">${chuGiai}</div>
    </section>

    <!-- KHU VỰC BỘ 5 THẺ CÁNH QUẠT 3D TÁI SINH (PERFECT 5-CARD FAN DECK) -->
    <section class="gt-khoi gt-khoi--deck">
      <h2>VnStarL có gì cho sĩ tử lớp 9?</h2>
      <p class="gt-sub">5 vũ khí bí truyền giúp bạn tự tin đỗ trường cấp ba mơ ước.</p>

      <div class="fan-deck-wrapper" id="vnstarl-fan-deck">
        <div class="fan-card-container">
          <!-- THẺ 1: SỔ LỖI SAI -->
          <div class="fan-card" data-card="1">
            <div class="card-inner">
              <span class="card-watermark">1</span>
              <div class="card-icon-box"><i class="fa-solid fa-book-bookmark"></i></div>
              <b class="card-title">Sổ Lỗi Sai</b>
              <span class="card-tag">Ôn ngắt quãng</span>
            </div>
          </div>

          <!-- THẺ 2: LỜI GIẢI CHI TIẾT -->
          <div class="fan-card" data-card="2">
            <div class="card-inner">
              <span class="card-watermark">2</span>
              <div class="card-icon-box"><i class="fa-solid fa-circle-check"></i></div>
              <b class="card-title">Lời Giải Chi Tiết</b>
              <span class="card-tag">Từng bước hiểu sâu</span>
            </div>
          </div>

          <!-- THẺ 3 (TRUNG TÂM): KHOA BẢNG KỲ THI -->
          <div class="fan-card active" data-card="3">
            <div class="card-inner">
              <span class="center-crown">👑</span>
              <span class="card-watermark">★</span>
              <div class="card-icon-box"><i class="fa-solid fa-scroll"></i></div>
              <b class="card-title">Khoa Bảng</b>
              <span class="card-tag">Đấu trường vinh danh</span>
            </div>
          </div>

          <!-- THẺ 4: CHUỖI & NHIỆM VỤ -->
          <div class="fan-card" data-card="4">
            <div class="card-inner">
              <span class="card-watermark">4</span>
              <div class="card-icon-box"><img src="img/icon-streak.png" alt="Streak" class="vn-ico vn-ico-lg" /></div>
              <b class="card-title">Chuỗi Ngày</b>
              <span class="card-tag">Quay thưởng mỗi ngày</span>
            </div>
          </div>

          <!-- THẺ 5: BẢNG XẾP HẠNG -->
          <div class="fan-card" data-card="5">
            <div class="card-inner">
              <span class="card-watermark">5</span>
              <div class="card-icon-box"><i class="fa-solid fa-ranking-star"></i></div>
              <b class="card-title">Bảng Vàng</b>
              <span class="card-tag">Đua Top sĩ tử</span>
            </div>
          </div>
        </div>

        <!-- Dải sáng phản chiếu dưới đáy -->
        <div class="deck-floor-light" aria-hidden="true"></div>
      </div>

      <div class="deck-scrubber-wrap">
        <input type="range" min="1" max="5" step="1" id="deck-scrubber" class="deck-scrubber" value="3" aria-label="Chọn thẻ vũ khí">
      </div>

      <!-- Mô tả khi chạm vào từng thẻ -->
      <div class="deck-card-caption" id="deck-caption">
        <b class="caption-title">🏛️ Khoa Bảng Kỳ Thi</b>
        <p class="caption-desc">Hệ thống phân định học vị từ Thi Hương, Thi Hội đến Thi Đình. Ghi danh bảng vàng và khắc tên trên bia đá vinh dự.</p>
      </div>
    </section>

    ${dongCuoi("Sẵn sàng bắt đầu?", "Tạo tài khoản chỉ mất chưa đến 1 phút, hoàn toàn miễn phí.")}`;
  }

  // Tương tác 4 bước lộ trình: PC dùng thanh ngang 1-4 + hộp chi tiết; Mobile giữ nguyên Split-Stage 2x2
  function ganSplitStage(goc) {
    const container = $("#split-stage", goc);
    if (!container) return;

    const STEPS = [
      { id: 1, icon: "fa-book-open", title: "Chọn môn và chương", shortHint: "Đúng trọng tâm lớp 9", desc: "Mỗi chương gồm nhiều bài học phân theo chuẩn chương trình lớp 9. Giúp sĩ tử nắm chắc kiến thức trọng tâm từng phần trước khi làm đề.", cta: "Xem danh sách bài ➔" },
      { id: 2, icon: "fa-lightbulb", title: "Đọc lý thuyết", shortHint: "Cô đọng, dễ hiểu", desc: "Tóm tắt cô đọng lý thuyết trọng tâm, kèm các hình ảnh minh họa và mô phỏng trực quan giúp bạn hiểu sâu bản chất vấn đề.", cta: "Khám phá lý thuyết ➔" },
      { id: 3, icon: "fa-pen", title: "Làm bài tập", shortHint: "Từ dễ đến khó", desc: "Trắc nghiệm, đúng sai và trả lời ngắn, xếp từ dễ đến khó bám sát ma trận đề thi vào 10 mới nhất.", cta: "Bắt đầu luyện tập ➔" },
      { id: 4, icon: "fa-medal", title: "Xem lời giải & lên hạng", shortHint: "Vá lỗi & bứt top", desc: "Xem phương pháp giải chi tiết từng bước, khắc phục lỗi sai tức thì và leo hạng sau mỗi lần luyện lại.", cta: "Xem bảng vinh danh ➔" }
    ];

    const mqMobile = window.matchMedia("(max-width: 640px)");
    let desktopStep = 1;

    // 1. GIAO DIỆN PC (>= 641px): Thanh lộ trình 4 bước nằm ngang + Hộp chi tiết mở sẵn
    function renderDesktopStepper(activeStep) {
      desktopStep = STEPS.some((s) => s.id === activeStep) ? activeStep : 1;
      const item = STEPS.find((s) => s.id === desktopStep) || STEPS[0];

      container.removeAttribute("data-dir");
      container.classList.add("is-desktop-stepper");
      container.innerHTML = `
        <div class="gt-stepper-wrap">
          <div class="gt-stepper-track" role="tablist" aria-label="4 bước luyện tập">
            ${STEPS.map((s) => {
              const active = s.id === desktopStep;
              return `
                <button
                  type="button"
                  role="tab"
                  aria-selected="${active}"
                  class="gt-step-pill ${active ? "is-active" : ""}"
                  data-step="${s.id}">
                  <span class="gt-step-top">
                    <span class="gt-step-num">${s.id}</span>
                    <span class="gt-step-ico-box" aria-hidden="true">
                      <i class="fa-solid ${s.icon}"></i>
                    </span>
                  </span>
                  <b class="gt-step-name">${s.title}</b>
                  <span class="gt-step-hint">${s.shortHint}</span>
                </button>
              `;
            }).join("")}
          </div>

          <div class="gt-step-panel" role="tabpanel" aria-live="polite">
            <div class="gt-step-panel-left">
              <div class="gt-step-panel-eyebrow">
                <span class="gt-step-panel-badge">Bước 0${item.id} / 04</span>
                <span class="gt-step-panel-dots" aria-hidden="true">
                  ${STEPS.map((s) => `<i class="${s.id === item.id ? "is-on" : ""}"></i>`).join("")}
                </span>
              </div>
              <div class="gt-step-panel-heading">
                <span class="gt-step-panel-ico" aria-hidden="true">
                  <i class="fa-solid ${item.icon}"></i>
                </span>
                <h3>${item.title}</h3>
              </div>
              <p class="gt-step-panel-desc">${item.desc}</p>
            </div>
            <div class="gt-step-panel-right">
              <button
                type="button"
                class="gt-step-panel-cta"
                data-khoa="Đăng nhập để trải nghiệm: ${item.title}">
                ${item.cta}
              </button>
            </div>
          </div>
        </div>
      `;

      const pills = Array.from(container.querySelectorAll(".gt-step-pill"));
      pills.forEach((btn, idx) => {
        btn.addEventListener("click", () => {
          const nextId = Number(btn.dataset.step);
          if (nextId !== desktopStep) renderDesktopStepper(nextId);
        });
        btn.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const offset = e.key === "ArrowRight" ? 1 : -1;
            const targetIdx = (idx + offset + STEPS.length) % STEPS.length;
            renderDesktopStepper(STEPS[targetIdx].id);
            const focusTarget = container.querySelector(`.gt-step-pill[data-step="${STEPS[targetIdx].id}"]`);
            if (focusTarget) focusTarget.focus();
          }
        });
      });
    }

    // 2. GIAO DIỆN MOBILE (<= 640px): Giữ nguyên hoàn toàn Split-Stage 2x2 hiện có
    function renderGrid() {
      container.classList.remove("is-desktop-stepper");
      container.removeAttribute("data-dir");
      container.innerHTML = `
        <div class="split-stage-grid">
          ${STEPS.map((s) => `
            <div class="stage-grid-card" role="button" tabindex="0" data-step="${s.id}" title="Bấm để xem chi tiết bước ${s.id}">
              <div class="stage-grid-header">
                <span class="stage-badge">${s.id}</span>
                <i class="fa-solid ${s.icon} stage-ico"></i>
              </div>
              <b class="stage-grid-title">${s.title}</b>
            </div>
          `).join("")}
        </div>
      `;

      container.querySelectorAll(".stage-grid-card").forEach((card) => {
        const stepId = Number(card.dataset.step);
        card.addEventListener("click", () => renderSplit(stepId));
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            renderSplit(stepId);
          }
        });
      });
    }

    function renderSplit(activeStep) {
      container.classList.remove("is-desktop-stepper");
      if (activeStep === 1 || activeStep === 3) {
        container.setAttribute("data-dir", "left");
      } else {
        container.setAttribute("data-dir", "right");
      }

      const item = STEPS.find((s) => s.id === activeStep) || STEPS[0];
      const other3 = STEPS.filter((s) => s.id !== item.id);

      container.innerHTML = `
        <div class="stage-main-card" role="button" tabindex="0" title="Bấm vào thẻ để thu gọn về 4 bước">
          <div class="stage-main-header">
            <span class="stage-badge">${item.id}</span>
            <i class="fa-solid ${item.icon} stage-ico"></i>
            <b class="stage-title">${item.title}</b>
            <button type="button" class="stage-back-btn" title="Thu gọn về 4 bước" aria-label="Thu gọn về 4 bước">
              <i class="fa-solid fa-table-cells-large"></i> <span>Thu gọn</span>
            </button>
          </div>
          <p class="stage-desc">${item.desc}</p>
          <button type="button" class="stage-cta-btn" data-khoa="Đăng nhập để trải nghiệm: ${item.title}">${item.cta}</button>
        </div>
        <div class="stage-side-stack">
          ${other3.map((s) => `
            <button type="button" class="stage-side-btn" data-step="${s.id}" title="${s.title}">
              <span class="side-badge">${s.id}</span>
              <i class="fa-solid ${s.icon} side-ico"></i>
            </button>
          `).join("")}
        </div>`;

      const backBtn = container.querySelector(".stage-back-btn");
      if (backBtn) {
        backBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          renderGrid();
        });
      }

      const mainCard = container.querySelector(".stage-main-card");
      if (mainCard) {
        mainCard.addEventListener("click", (e) => {
          if (e.target.closest("[data-khoa]")) return;
          renderGrid();
        });
      }

      container.querySelectorAll(".stage-side-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          renderSplit(Number(btn.dataset.step));
        });
      });
    }

    function syncViewportMode() {
      if (mqMobile.matches) {
        renderGrid();
      } else {
        renderDesktopStepper(desktopStep);
      }
    }

    if (typeof mqMobile.addEventListener === "function") {
      mqMobile.addEventListener("change", syncViewportMode);
    }
    syncViewportMode();
  }

  // Tương tác Bộ 5 thẻ xòe quạt 3D
  function ganFanDeck(goc) {
    const deck = $("#vnstarl-fan-deck", goc);
    const caption = $("#deck-caption", goc);
    const scrubber = $("#deck-scrubber", goc);
    if (!deck || !caption) return;

    const DETAILS = {
      1: { title: "📜 Sổ Lỗi Sai Thông Minh", desc: "Tự động ghi nhớ câu làm sai, lên lịch ôn lại cách 1, 3, 7 ngày để vá đúng lỗ hổng kiến thức." },
      2: { title: "💡 Lời Giải Chi Tiết Từng Câu", desc: "Nộp bài xong là có phân tích phương pháp giải chi tiết, không chỉ biết đáp án mà hiểu vì sao làm vậy." },
      3: { title: "🏛️ Khoa Bảng & Kỳ Thi Đấu Trường", desc: "Hệ thống thi cử mô phỏng khoa cử truyền thống: Thi Hương, Thi Hội, Thi Đình ghi danh bảng vàng." },
      4: { title: "🔥 Chuỗi Ngày & Nhiệm Vụ", desc: "Duy trì streak đều đặn mỗi ngày, hoàn thành 3 nhiệm vụ để mở rương và quay thưởng hấp dẫn." },
      5: { title: "🏆 Bảng Vàng Xếp Hạng Toàn Quốc", desc: "Tích điểm từ từng bài tập rèn luyện, so tài cao thấp cùng hàng ngàn sĩ tử lớp 9 trên bục vinh danh." }
    };

    let activeCardIndex = 3;
    const cards = deck.querySelectorAll(".fan-card");

    function setActiveCard(idx) {
      activeCardIndex = Number(idx) || 1;
      cards.forEach((c) => {
        const isMatch = Number(c.dataset.card) === activeCardIndex;
        c.classList.toggle("active", isMatch);
      });

      // Ensure active card has crown: dynamically add <span class="center-crown">👑</span>
      deck.querySelectorAll(".center-crown").forEach((el) => el.remove());
      const activeCard = deck.querySelector(`.fan-card[data-card="${activeCardIndex}"]`);
      if (activeCard) {
        const inner = activeCard.querySelector(".card-inner") || activeCard;
        const crown = document.createElement("span");
        crown.className = "center-crown";
        crown.textContent = "👑";
        inner.prepend(crown);
      }

      // Update caption
      if (DETAILS[activeCardIndex]) {
        caption.innerHTML = `<b class="caption-title">${DETAILS[activeCardIndex].title}</b><p class="caption-desc">${DETAILS[activeCardIndex].desc}</p>`;
      }

      // Update scrubber slider value
      if (scrubber) {
        scrubber.value = activeCardIndex;
      }
    }

    let rotateTimer = null;

    function startAutoRotate() {
      stopAutoRotate();
      rotateTimer = setInterval(() => {
        const next = (activeCardIndex % 5) + 1;
        setActiveCard(next);
      }, 5000);
    }

    function stopAutoRotate() {
      if (rotateTimer) {
        clearInterval(rotateTimer);
        rotateTimer = null;
      }
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        setActiveCard(Number(card.dataset.card));
      });
    });

    if (scrubber) {
      ["input", "change"].forEach((evt) => {
        scrubber.addEventListener(evt, () => {
          setActiveCard(Number(scrubber.value));
        });
      });
    }

    const interactTargets = [deck, scrubber].filter(Boolean);
    interactTargets.forEach((target) => {
      ["pointerdown", "touchstart", "mouseenter"].forEach((evt) => {
        target.addEventListener(evt, stopAutoRotate);
      });
      ["pointerup", "touchend", "mouseleave"].forEach((evt) => {
        target.addEventListener(evt, startAutoRotate);
      });
    });

    setActiveCard(3);
    startAutoRotate();
  }

  // Câu hỏi dùng thử: chấm ngay trên trình duyệt, chỉ là 1 câu mẫu cố định
  function ganDemo(goc) {
    const btn = $("#gt-kt", goc);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const kq = $("#gt-kq", goc);
      const chon = $("#gt-demo input:checked", goc);
      if (!chon) { kq.innerHTML = `<div class="kq kq-chua">Hãy chọn một đáp án trước nhé.</div>`; return; }

      const dung = chon.value === "1";
      goc.querySelectorAll("#gt-demo input").forEach((i) => (i.disabled = true));
      $("#gt-kt", goc).disabled = true;
      kq.innerHTML =
        (dung ? `<div class="kq kq-dung">✔ Đúng! +2 điểm</div>` : `<div class="kq kq-sai">✘ Chưa đúng. Đáp án là B.</div>`) +
        `<div class="kq-loi-giai"><b>Lời giải:</b> 2x = 11 − 3 = 8, suy ra x = 4.</div>
         <div class="gt-demo-moi">Thích chứ? Đăng ký để làm tiếp các bài tập thật và lưu điểm của bạn.${cta}</div>`;
    });
  }

  // ======================================================
  // TRANG CUỘC THI
  // ======================================================
  const NHAN = { "sap-dien-ra": "Sắp diễn ra", "dang-dien-ra": "Đang diễn ra", "da-ket-thuc": "Đã kết thúc" };

  // Cuộc thi mẫu: chỉ dùng khi server chưa bật hoặc chưa có cuộc thi nào
  const THI_MAU = [
    { id: 1, ten: "Giao lưu Toán 9 - Chương 1", trang_thai: "dang-dien-ra", bat_dau: "2026-11-10 19:00", ket_thuc: "2026-11-10 20:00" },
    { id: 2, ten: "Thử sức Ngữ văn - Đọc hiểu", trang_thai: "sap-dien-ra", bat_dau: "2026-11-17 19:30", ket_thuc: "2026-11-17 20:30" },
    { id: 3, ten: "Vòng khởi động", trang_thai: "da-ket-thuc", bat_dau: "2026-11-01 19:00", ket_thuc: "2026-11-01 20:00" },
  ];

  const dinhDangGio = (s) => {
    const [ngay, gio] = s.split(" "), [n, t, d] = ngay.split("-");
    return `${gio} - ${d}/${t}/${n}`;
  };
  const soPhut = (a, b) => Math.round((new Date(b.replace(" ", "T")) - new Date(a.replace(" ", "T"))) / 60000);

  // Nội dung 3 tab mẫu
  const TAB_MAU = {
    "thong-tin": `
      <h3 class="contest-ten">Giao lưu Toán 9</h3>
      <span class="contest-badge dang-dien-ra">Đang diễn ra</span>
      <p><b>Bắt đầu:</b> 19:00 - 10/11/2026</p>
      <p><b>Kết thúc:</b> 20:00 - 10/11/2026</p>
      <p><b>Thời lượng:</b> 60 phút</p>
      <h4>Nội dung cuộc thi</h4>
      <p class="contest-noidung-text">Từ Chương 1 - Bài 01 đến Chương 3 - Bài 02</p>`,
    "bai-tap": `
      <table class="problem-table">
        <thead><tr><th>ID</th><th>Bài</th><th>Điểm</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Bài 1: Phương trình bậc nhất</td><td>100</td></tr>
          <tr><td>2</td><td>Bài 2: Hệ phương trình</td><td>100</td></tr>
          <tr><td>3</td><td>Bài 3: Bài toán thực tế</td><td>100</td></tr>
        </tbody>
      </table>`,
    "xep-hang": `
      <div class="leaderboard-container">
        <div class="podium-section">
          <div class="podium-card silver"><img class="avatar" src="img/avartar.webp" alt="Top 2">
            <span class="podium-name">Thí sinh B - 270</span><div class="step">2</div></div>
          <div class="podium-card gold"><img class="avatar" src="img/avartar.webp" alt="Top 1">
            <span class="podium-name">Thí sinh A - 300</span><div class="step">1</div></div>
          <div class="podium-card bronze"><img class="avatar" src="img/avartar.webp" alt="Top 3">
            <span class="podium-name">Thí sinh C - 240</span><div class="step">3</div></div>
        </div>
        <p class="gt-ghi">Tên của bạn có thể ở đây. Điểm lên bảng ngay sau khi nộp bài.</p>
      </div>`,
  };

  function trangCuocThi() {
    return `
    <section class="gt-hero">
     <span class="gt-nhan"><i class="fa-solid fa-lock"></i> Dành cho thành viên VnStarL</span>
      <h1>Tranh tài cùng bạn bè</h1>
      <p>Mỗi cuộc thi có khung giờ riêng, đề riêng và bảng xếp hạng riêng.
         Đăng nhập để vào thi, ghi tên mình lên bục vinh danh.</p>
      ${cta}
      ${chipDong(["Chấm điểm tự động", "Bảng xếp hạng riêng", "Nhắc trước giờ thi 30 phút"])}
    </section>

    <section class="gt-khoi">
      <h2>Các cuộc thi</h2>
      <p class="gt-sub">Bạn có thể xem lịch thi ngay bây giờ. Bấm vào một cuộc thi để thử vào.</p>
      <div class="gt-cuon">
        <table class="contest-table">
          <thead><tr><th>ID</th><th>Tên cuộc thi</th><th>Thời gian làm bài</th></tr></thead>
          <tbody id="gt-ds-thi"><tr><td colspan="3" class="contest-empty">Đang tải...</td></tr></tbody>
        </table>
      </div>
      <p class="gt-ghi" id="gt-ghi-bang"></p>
    </section>

    <section class="gt-khoi">
      <h2>Bên trong một cuộc thi</h2>
      <p class="gt-sub">Mỗi cuộc thi có 3 tab. Bấm thử để xem.</p>
      <div class="gt-cua-so">
        <div class="gt-cua-so-dau">
          <div class="contest-tabs" id="gt-tabs">
            <button type="button" class="contest-tab active" data-gtab="thong-tin">Thông tin</button>
            <button type="button" class="contest-tab" data-gtab="bai-tap">Bài tập</button>
            <button type="button" class="contest-tab" data-gtab="xep-hang">Bảng xếp hạng</button>
          </div>
          <span class="gt-ribbon">Ví dụ minh họa</span>
        </div>
        <div class="contest-noi-dung gt-tab-nd" id="gt-tab-nd"></div>
      </div>
    </section>

    <section class="gt-khoi">
      <h2>Tham gia thế nào?</h2>
      <p class="gt-sub">Công bằng cho mọi người: giờ thi được tính trên máy chủ.</p>
      ${buoc([
      ["fa-user-plus", "Tạo tài khoản", "Đăng ký miễn phí, mất chưa đến 1 phút."],
      ["fa-bell", "Nhận nhắc giờ thi", "Bật thông báo để được nhắc trước 30 phút."],
      ["fa-clock", "Vào thi đúng giờ", "Làm bài trong khung giờ của cuộc thi."],
      ["fa-flag-checkered", "Nộp bài, xem hạng", "Mỗi người nộp một lần, điểm lên bảng xếp hạng ngay."],
    ])}
    </section>

    ${dongCuoi("Sẵn sàng ghi tên lên bục vinh danh?", "Đăng ký ngay để không lỡ cuộc thi tiếp theo.")}`;
  }

  function veTabMau(ten) {
    $("#gt-tab-nd").innerHTML = TAB_MAU[ten];
    document.querySelectorAll("#gt-tabs .contest-tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.gtab === ten));
  }

  function veBangThi(ds, laMau) {
    const tb = $("#gt-ds-thi");
    tb.innerHTML = "";
    ds.forEach((c) => {
      const tr = document.createElement("tr");
      tr.className = "co-the-bam";
      tr.tabIndex = 0;
      tr.dataset.khoa = "Đăng nhập để xem chi tiết, làm bài và xem bảng xếp hạng của cuộc thi này.";
      tr.innerHTML = `<td></td>
        <td><span class="t"></span><span class="contest-badge"></span><i class="fa-solid fa-lock gt-o-khoa"></i></td>
        <td class="contest-time"><span></span><small></small></td>`;
      const [td1, td2, td3] = tr.children;
      td1.textContent = laMau ? "—" : c.id;                 // textContent: tên không chạy được code lạ
      td2.querySelector(".t").textContent = c.ten;
      const nhan = td2.querySelector(".contest-badge");
      nhan.className = `contest-badge ${c.trang_thai}`;
      nhan.textContent = NHAN[c.trang_thai] || "";
      td3.querySelector("span").textContent = `${dinhDangGio(c.bat_dau)} → ${dinhDangGio(c.ket_thuc)}`;
      td3.querySelector("small").textContent = `Thời lượng ${soPhut(c.bat_dau, c.ket_thuc)} phút`;
      tb.appendChild(tr);
    });
    $("#gt-ghi-bang").textContent = laMau
      ? "Danh sách trên là ví dụ minh họa. Cuộc thi thật sẽ hiện ở đây khi có lịch."
      : "Bấm vào một cuộc thi để xem chi tiết.";
  }

  // Lấy lịch thi thật (API này công khai, không cần đăng nhập). Lỗi thì dùng dữ liệu mẫu
  async function taiLichThi() {
    try {
      const kq = await (await fetch(`${API}/api/contests`)).json();
      if (kq.success && kq.data && kq.data.length) return veBangThi(kq.data.slice(0, 6), false);
    } catch (e) { /* server chưa bật thì dùng mẫu */ }
    veBangThi(THI_MAU, true);
  }

  // ======================================================
  // Hộp mời đăng nhập (dùng lại .modal-nen / .modal-hop của style3.css)
  // ======================================================
  function taoModal() {
    const nen = document.createElement("div");
    nen.id = "gt-nen";
    nen.className = "modal-nen hidden";
    nen.innerHTML = `
      <div class="modal-hop modal-nho" role="dialog" aria-modal="true" aria-labelledby="gt-m-tieu-de">
        <div class="modal-dau">
          <h3 id="gt-m-tieu-de">Đăng nhập để tiếp tục</h3>
          <button type="button" class="modal-dong" id="gt-m-dong" aria-label="Đóng">✕</button>
        </div>
        <div class="gt-modal-nd">
          <div class="gt-khoa-icon"><i class="fa-solid fa-lock"></i></div>
          <p id="gt-m-noi-dung"></p>
          ${cta}
        </div>
      </div>`;
    document.body.appendChild(nen);

    const dong = () => { nen.classList.add("hidden"); document.body.style.overflow = ""; };
    $("#gt-m-dong").addEventListener("click", dong);
    nen.addEventListener("click", (e) => { if (e.target === nen) dong(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") dong(); });

    return (chu) => {
      $("#gt-m-noi-dung").textContent = chu;
      nen.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      nen.querySelector(".gt-btn.dac").focus();
    };
  }

  // ======================================================
  // Chạy: gỡ phần thật, thay bằng phần giới thiệu
  // ======================================================
  // Xóa hẳn khỏi trang để subjects.js / contest.js không tìm thấy gì và không gọi server
  if (loai === "bai-tap") {
    document.querySelectorAll("main.subject-page").forEach((n) => n.remove());
  } else {
    document.querySelectorAll(".contest-head, .contest-container, #contest-nen").forEach((n) => n.remove());
  }

  const main = document.createElement("main");
  main.className = "gt-trang";
  main.innerHTML = loai === "bai-tap" ? trangBaiTap() : trangCuocThi();
  $("#header").after(main);

  const moModal = taoModal();

  if (loai === "bai-tap") {
    ganDemo(main);
    ganSplitStage(main);
    ganFanDeck(main);
  } else {
    taiLichThi();
    veTabMau("thong-tin");
    $("#gt-tabs").addEventListener("click", (e) => {
      const t = e.target.closest("[data-gtab]");
      if (t) veTabMau(t.dataset.gtab);
    });
  }

  // Một chỗ xử lý chung: bấm vào thứ gì có data-khoa thì mời đăng nhập
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cta]")) sessionStorage.setItem("quayLai", TRANG_QUAY_LAI); // đăng nhập xong quay lại đây
    const k = e.target.closest("[data-khoa]");
    if (k) { e.preventDefault(); moModal(k.dataset.khoa); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const k = e.target.closest && e.target.closest("[data-khoa]");
    if (k) moModal(k.dataset.khoa);
  });
})();