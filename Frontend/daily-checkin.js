/**
 * daily-checkin.js - Điểm danh 7 ngày nhận quà & vòng quay
 * Tự động bật modal frosted glass khi người dùng chưa điểm danh hôm nay
 */
(function () {
  "use strict";

  // Đảm bảo không nạp trùng lặp
  if (window.DAILY_CHECKIN_INITIALIZED) return;
  window.DAILY_CHECKIN_INITIALIZED = true;

  // 1. Kiểm tra trạng thái đăng nhập
  const userId = localStorage.getItem("userId");
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn || !userId) return;

  // Cấu hình URL máy chủ
  const API_BASE = typeof API_SERVER === "string" ? API_SERVER : "http://127.0.0.1:5000";

  const ICO_DIEM_LG = '<img src="img/icon-diem.png" alt="Điểm" class="vn-ico vn-ico-xl">';
  const ICO_DIEM_SM = '<img src="img/icon-diem.png" alt="Điểm" class="vn-ico">';
  const ICO_BAOHO_LG = '<img src="img/icon-bao-ho.png" alt="Bảo hộ streak" class="vn-ico vn-ico-xl">';
  const ICO_BAOHO_SM = '<img src="img/icon-bao-ho.png" alt="Bảo hộ streak" class="vn-ico">';
  const ICO_HOPQUA_LG = '<img src="img/icon-hop-qua.png" alt="Quà" class="vn-ico vn-ico-xl">';
  const ICO_HOPQUA_SM = '<img src="img/icon-hop-qua.png" alt="Quà" class="vn-ico">';
  const ICO_VE_LG = '<img src="img/icon-ve.png" alt="Vé quay" class="vn-ico vn-ico-xl vn-ico-ve">';

  // Tự động nhúng daily-checkin.css nếu chưa có trong trang
  function ensureCSS() {
    if (!document.querySelector('link[href*="daily-checkin.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "daily-checkin.css?v=4";
      document.head.appendChild(link);
    }
  }

  // Phân tích tên phần thưởng thành biểu tượng và thẻ hiển thị ngắn gọn
  function parseReward(ten, ngay) {
    if (!ten) {
      if (ngay === 4) return { icon: ICO_BAOHO_LG, tag: `${ICO_BAOHO_SM} Bảo hộ` };
      if (ngay === 7) return { icon: ICO_HOPQUA_LG, tag: `${ICO_HOPQUA_SM} Vòng quay` };
      return { icon: ICO_DIEM_LG, tag: `+${ngay * 10} ${ICO_DIEM_SM}` };
    }
    const lower = ten.toLowerCase();
    if (lower.includes("bảo hộ") || lower.includes("khiên")) {
      return { icon: ICO_BAOHO_LG, tag: `${ICO_BAOHO_SM} Bảo hộ` };
    }
    if (lower.includes("quay")) {
      return { icon: ICO_HOPQUA_LG, tag: `${ICO_HOPQUA_SM} Vòng quay` };
    }
    const m = ten.match(/\+(\d+)/);
    if (m) {
      return { icon: ICO_DIEM_LG, tag: `+${m[1]} ${ICO_DIEM_SM}` };
    }
    if (lower === "điểm danh") {
      return { icon: ICO_DIEM_LG, tag: "Điểm danh" };
    }
    if (lower.includes("điểm")) {
      return { icon: ICO_DIEM_LG, tag: `${ten.replace(/\s*điểm/i, "")} ${ICO_DIEM_SM}` };
    }
    return { icon: ICO_DIEM_LG, tag: ten };
  }

  // Tạo cấu trúc DOM cho modal điểm danh nếu chưa có
  function getOrCreateModal() {
    let overlay = document.getElementById("daily-checkin-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "daily-checkin-overlay";
      overlay.className = "daily-checkin-backdrop hidden";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "daily-checkin-title");

      overlay.innerHTML = `
        <div class="daily-checkin-modal" role="document">
          <button class="daily-checkin-close" id="daily-btn-close" aria-label="Đóng" title="Đóng">✕</button>
          <div class="daily-sparkle-container"></div>
          <div class="daily-checkin-header">
            <h2 class="daily-checkin-title" id="daily-checkin-title">
              <span class="daily-icon-gift">${ICO_HOPQUA_LG}</span> ĐIỂM DANH HÀNG NGÀY
            </h2>
            <p class="daily-checkin-subtitle">Duy trì chuỗi ngày để nhận rương và vòng quay</p>
          </div>
          <div class="daily-checkin-stats">
            <div class="daily-stat-card">
              <div class="daily-stat-icon">${ICO_DIEM_LG}</div>
              <div class="daily-stat-val" id="daily-stat-score">0</div>
              <div class="daily-stat-lbl">Điểm</div>
            </div>
            <div class="daily-stat-card">
              <div class="daily-stat-icon">${ICO_BAOHO_LG}</div>
              <div class="daily-stat-val" id="daily-stat-shield">0/3</div>
              <div class="daily-stat-lbl">Bảo hộ</div>
            </div>
            <div class="daily-stat-card">
              <div class="daily-stat-icon">${ICO_VE_LG}</div>
              <div class="daily-stat-val" id="daily-stat-ticket">0</div>
              <div class="daily-stat-lbl">Lượt quay</div>
            </div>
          </div>
          <div class="daily-notification" id="daily-notification"></div>
          <div class="daily-checkin-track journey-path-container" id="daily-track"></div>
          <div class="daily-actions">
            <button class="btn-checkin-3d daily-btn-primary" id="daily-btn-claim">
              <i class="fa-solid fa-calendar-check"></i> Điểm danh hôm nay
            </button>
            <button class="daily-btn-secondary" id="daily-btn-later">Để sau</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Gắn sự kiện đóng modal
      const btnClose = overlay.querySelector("#daily-btn-close");
      const btnLater = overlay.querySelector("#daily-btn-later");
      if (btnClose) btnClose.addEventListener("click", closeModal);
      if (btnLater) btnLater.addEventListener("click", closeModal);

      // Đóng khi click ngoài backdrop
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      });

      // Đóng khi nhấn phím Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
          closeModal();
        }
      });
    }
    return overlay;
  }

  // Đóng modal điểm danh với animation mượt
  function closeModal() {
    const overlay = document.getElementById("daily-checkin-overlay");
    if (!overlay || overlay.classList.contains("hidden")) return;

    try {
      sessionStorage.setItem("daily_checkin_closed", "1");
    } catch (e) {
      /* Bỏ qua nếu sessionStorage bị chặn */
    }

    if (window.AmThanh && window.AmThanh.dong) window.AmThanh.dong();
    overlay.classList.add("closing");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("closing");
      window.dispatchEvent(new CustomEvent("daily-checkin:closed"));
    }, 220);
  }

  // Mở modal điểm danh
  function openModal() {
    const overlay = getOrCreateModal();
    overlay.classList.remove("hidden", "closing");
    if (window.AmThanh && window.AmThanh.mo) window.AmThanh.mo();
  }

  // Hiệu ứng pháo hoa tia sáng chúc mừng khi nhận quà
  function triggerSparkles(modalEl, btnEl) {
    if (!modalEl || !btnEl) return;
    let container = modalEl.querySelector(".daily-sparkle-container");
    if (!container) return;
    container.innerHTML = "";

    const colors = ["#fbbf24", "#38bdf8", "#2563eb", "#10b981", "#a855f7", "#ec4899", "#f59e0b"];
    const rect = btnEl.getBoundingClientRect();
    const modalRect = modalEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2 - modalRect.left;
    const originY = rect.top + rect.height / 2 - modalRect.top;

    for (let i = 0; i < 26; i++) {
      const sp = document.createElement("div");
      sp.className = "daily-sparkle";
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 110;
      const dx = Math.cos(angle) * dist + "px";
      const dy = Math.sin(angle) * dist + "px";
      sp.style.setProperty("--dx", dx);
      sp.style.setProperty("--dy", dy);
      sp.style.left = originX + "px";
      sp.style.top = originY + "px";
      sp.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      const size = 5 + Math.random() * 6;
      sp.style.width = size + "px";
      sp.style.height = size + "px";
      container.appendChild(sp);
    }

    setTimeout(() => {
      container.innerHTML = "";
    }, 1000);
  }

  // Điền dữ liệu vào giao diện modal
  function renderData(data) {
    const overlay = getOrCreateModal();
    const scoreEl = overlay.querySelector("#daily-stat-score");
    const shieldEl = overlay.querySelector("#daily-stat-shield");
    const ticketEl = overlay.querySelector("#daily-stat-ticket");
    const trackEl = overlay.querySelector("#daily-track");
    const claimBtn = overlay.querySelector("#daily-btn-claim");
    const notifEl = overlay.querySelector("#daily-notification");

    // Chỉ số người dùng
    if (scoreEl) scoreEl.textContent = data.score != null ? data.score : 0;
    if (shieldEl) shieldEl.textContent = `${data.the_bao_ho || 0}/${data.toi_da_bao_ho || 3}`;
    if (ticketEl) ticketEl.textContent = data.luot_quay || 0;
    if (data.streak !== undefined && window.capNhatIconStreak) {
      window.capNhatIconStreak(data.streak);
    }

    // Reset thông báo
    if (notifEl) {
      notifEl.className = "daily-notification";
      notifEl.textContent = "";
    }

    // Vẽ đường nối & 7 trạm ngày (dùng chung khi mới mở modal và khi vừa bấm điểm danh)
    renderTrack(trackEl, data, null);

    // Cập nhật nút điểm danh
    if (claimBtn) {
      if (data.da_diem_danh_hom_nay) {
        claimBtn.disabled = true;
        claimBtn.innerHTML = "✔ Đã điểm danh hôm nay";
        claimBtn.classList.add("is-claimed");
      } else {
        claimBtn.disabled = false;
        claimBtn.innerHTML = "<i class=\"fa-solid fa-calendar-check\"></i> Điểm danh hôm nay";
        claimBtn.classList.remove("is-claimed");

        // Gỡ listener cũ để tránh trùng lặp
        const newClaimBtn = claimBtn.cloneNode(true);
        claimBtn.parentNode.replaceChild(newClaimBtn, claimBtn);

        const todayDayNum = data.da_diem_danh_hom_nay
          ? (data.tien_do > 0 ? data.tien_do : 1)
          : ((data.tien_do || 0) % 7) + 1;
        newClaimBtn.addEventListener("click", () => handleClaim(todayDayNum));
      }
    }
  }

  function renderTrack(trackEl, data, justClaimedDay = null) {
    if (!trackEl) return;

    const todayDayNum = data.da_diem_danh_hom_nay
      ? (data.tien_do > 0 ? data.tien_do : 1)
      : ((data.tien_do || 0) % 7) + 1;

    trackEl.innerHTML = "";
    const lich = Array.isArray(data.lich) && data.lich.length === 7
      ? data.lich
      : [
          { ngay: 1, ten: "+20 điểm", da_nhan: false },
          { ngay: 2, ten: "+30 điểm", da_nhan: false },
          { ngay: 3, ten: "+40 điểm", da_nhan: false },
          { ngay: 4, ten: "Thẻ bảo hộ streak", da_nhan: false },
          { ngay: 5, ten: "+50 điểm", da_nhan: false },
          { ngay: 6, ten: "+60 điểm", da_nhan: false },
          { ngay: 7, ten: "Vòng quay", da_nhan: false }
        ];

    const tinhFill = (cnt) => cnt >= 7 ? 100 : cnt <= 0 ? 0 : Math.min(100, Math.round((Math.max(0, cnt - 0.5) / 6) * 100));
    const daNhanCount = lich.filter((it) => it.da_nhan).length;
    const fillPct = tinhFill(daNhanCount);
    const startPct = justClaimedDay ? tinhFill(Math.max(0, daNhanCount - 1)) : fillPct;

    const lineBg = document.createElement("div");
    lineBg.className = "journey-line-bg";
    lineBg.innerHTML = `<div class="journey-line-fill" id="daily-line-fill" style="width: ${startPct}%;"></div>`;
    trackEl.appendChild(lineBg);

    lich.forEach((item) => {
      const reward = parseReward(item.ten, item.ngay);
      const cell = document.createElement("div");
      const isTodayCell = !data.da_diem_danh_hom_nay && item.ngay === todayDayNum;
      const isJustChecked = !!(justClaimedDay && item.ngay === justClaimedDay && item.da_nhan);
      cell.className = `station-node daily-day-cell ${item.da_nhan ? "completed is-checked" : ""} ${isTodayCell ? "is-today" : ""} ${isJustChecked ? "just-checked" : ""}`;
      cell.setAttribute("data-day", item.ngay);

      const pinHtml = isTodayCell
        ? `<img src="img/pet/than/mac_dinh/_xem_truoc.webp" alt="Sao La" class="station-mascot-pin" loading="lazy" decoding="async" onerror="this.src='img/logo.webp'">`
        : "";

      const iconHtml = item.da_nhan
        ? `<i class="fa-solid fa-check text-emerald-600 font-bold" style="font-size: 1.15rem;"></i>`
        : reward.icon;

      cell.innerHTML = `
        ${pinHtml}
        <div class="station-circle">
          <span class="station-circle-icon">${iconHtml}</span>
        </div>
        <span class="station-label-title daily-day-num">Ngày ${item.ngay}</span>
        <span class="station-reward-val daily-day-reward" title="${item.ten}">${item.da_nhan ? "Đã nhận" : reward.tag}</span>
      `;
      trackEl.appendChild(cell);
    });

    if (justClaimedDay) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const lf = trackEl.querySelector("#daily-line-fill");
        if (lf) lf.style.width = fillPct + "%";
      }));
    }
  }

  // Thao tác gửi yêu cầu điểm danh
  async function handleClaim(todayDayNum) {
    const overlay = document.getElementById("daily-checkin-overlay");
    const claimBtn = overlay ? overlay.querySelector("#daily-btn-claim") : null;
    const notifEl = overlay ? overlay.querySelector("#daily-notification") : null;
    const modalEl = overlay ? overlay.querySelector(".daily-checkin-modal") : null;

    if (!claimBtn || claimBtn.disabled) return;
    claimBtn.disabled = true;
    claimBtn.innerHTML = "⏳ Đang nhận thưởng...";

    try {
      const res = await fetch(`${API_BASE}/api/diem-danh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(userId) })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Không thể điểm danh lúc này.");
      }

      // Điểm danh thành công!
      const tt = result.trang_thai || {};

      // 1. Cập nhật chuỗi ngày streak trong localStorage và trên giao diện header
      if (tt.streak !== undefined) {
        try {
          localStorage.setItem("streak", tt.streak);
        } catch (e) { /* ignore */ }
        if (window.capNhatIconStreak) {
          window.capNhatIconStreak(tt.streak);
        } else {
          document.querySelectorAll(".streak-box span").forEach((el) => {
            el.textContent = tt.streak;
          });
        }
      }

      // 2. Cập nhật chỉ số trên modal
      const scoreEl = overlay.querySelector("#daily-stat-score");
      const shieldEl = overlay.querySelector("#daily-stat-shield");
      const ticketEl = overlay.querySelector("#daily-stat-ticket");
      if (scoreEl && tt.score != null) scoreEl.textContent = tt.score;
      if (shieldEl) shieldEl.textContent = `${tt.the_bao_ho || 0}/${tt.toi_da_bao_ho || 3}`;
      if (ticketEl && tt.luot_quay != null) ticketEl.textContent = tt.luot_quay;

      // 3. Vẽ lại toàn bộ track 7 ngày theo trang_thai mới nhất (reset tuần mới + chạy thanh mượt)
      renderTrack(overlay.querySelector("#daily-track"), tt, tt.tien_do || todayDayNum);

      // 4. Cập nhật nút chính thành '✔ Đã nhận quà hôm nay'
      claimBtn.disabled = true;
      claimBtn.innerHTML = "✔ Đã nhận quà hôm nay";
      claimBtn.classList.add("is-claimed");

      // 5. Hiển thị thông báo chúc mừng, phát âm thanh & hiệu ứng pháo hoa
      if (window.AmThanh && window.AmThanh.diemDanh) window.AmThanh.diemDanh(tt.tien_do === 7);

      const nhanMsg = Array.isArray(result.nhan) && result.nhan.length > 0
        ? result.nhan.join(", ")
        : "Quà điểm danh hàng ngày";

      if (notifEl) {
        notifEl.textContent = `🎉 Chúc mừng! Bạn nhận được: ${nhanMsg}`;
        notifEl.className = "daily-notification active";
      }

      triggerSparkles(modalEl, claimBtn);
    } catch (err) {
      if (window.AmThanh && window.AmThanh.loi) window.AmThanh.loi();
      if (notifEl) {
        notifEl.textContent = err.message || "Lỗi khi điểm danh. Vui lòng thử lại sau.";
        notifEl.className = "daily-notification active error";
      }
      claimBtn.disabled = false;
      claimBtn.innerHTML = "✅ Điểm danh hôm nay";
    }
  }

  let daChoTour = false;

  function coTourDangHoacSapChay() {
    if (document.body && document.body.classList.contains("tour-dang-chay")) return true;
    const laPc = window.matchMedia && window.matchMedia("(min-width: 641px)").matches;
    if (!laPc) return false;
    try {
      if (sessionStorage.getItem("vnstarl_tour_chain")) return true;
      const trang = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      if (trang === "problems.html" && sessionStorage.getItem("vnstarl_tour_bt_stage") === "problems") return true;
      const khoaTheoTrang = {
        "personal.html": "vnstarl_tour_personal_" + userId,
        "so-loi.html": "vnstarl_tour_soloi_" + userId,
        "subjects.html": "vnstarl_tour_baitap_" + userId,
        "khoa-bang.html": "vnstarl_tour_khoabang_" + userId,
        "ranking.html": "vnstarl_tour_xephang_" + userId,
      };
      const k = khoaTheoTrang[trang];
      if (k && localStorage.getItem(k) !== "1") return true;
    } catch (e) { /* bỏ qua */ }
    return false;
  }

  // Khởi động kiểm tra và hiển thị nếu hợp lệ
  async function initDailyCheckin(forceOpen = false) {
    ensureCSS();

    // Nếu đã đóng trong phiên làm việc này và không yêu cầu mở ép buộc thì bỏ qua
    if (!forceOpen) {
      try {
        if (sessionStorage.getItem("daily_checkin_closed") === "1") {
          return;
        }
      } catch (e) {
        /* Bỏ qua nếu sessionStorage bị chặn */
      }
      if (coTourDangHoacSapChay()) {
        if (!daChoTour) {
          daChoTour = true;
          window.addEventListener("vnstarl:tour-ket-thuc", () => {
            setTimeout(() => {
              let vanConTour = false;
              try {
                vanConTour = !!(sessionStorage.getItem("vnstarl_tour_chain") || sessionStorage.getItem("vnstarl_tour_bt_stage"));
              } catch (e) { /* bỏ qua */ }
              if (!vanConTour && !(document.body && document.body.classList.contains("tour-dang-chay"))) {
                initDailyCheckin(false);
              }
            }, 260);
          }, { once: true });
        }
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/qua`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const data = json.data;

      // Nếu chưa điểm danh hôm nay hoặc được gọi chủ động mở
      if (!data.da_diem_danh_hom_nay || forceOpen) {
        renderData(data);
        openModal();
      }
    } catch (err) {
      console.warn("Không thể tải trạng thái điểm danh:", err);
    }
  }

  // Xuất API toàn cục để các trang hoặc nút tiện ích có thể gọi mở lại
  window.DAILY_CHECKIN = {
    open: () => initDailyCheckin(true),
    close: closeModal,
    refresh: () => initDailyCheckin(false)
  };

  // Tự động kiểm tra sau khi DOM đã sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initDailyCheckin(false));
  } else {
    initDailyCheckin(false);
  }
})();
