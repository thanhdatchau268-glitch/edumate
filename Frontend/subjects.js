// ========================================================
// TIỆN ÍCH NHẬN DIỆN THIẾT BỊ (DEVICE UTILITY)
// ========================================================
const DeviceUtil = {
  isMobile: () => window.innerWidth <= 640 || window.matchMedia("(max-width: 640px)").matches,
  isDesktop: () => window.innerWidth > 640,
  isTouch: () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
  onDeviceChange: (callback) => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e) => callback(e.matches ? "mobile" : "desktop");
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("subject-grid");
  const orbit = document.getElementById("subject-orbit");
  if (!grid && !orbit) return;

  const API = "http://127.0.0.1:5000";
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username") || "vô mae";

  // ======================================================
  // 1. DỮ LIỆU MÔN HỌC & TIẾN ĐỘ CHUẨN
  // ======================================================
  const MON_CHUNG = [
    {
      ten: "Toán",
      tenDayDu: "Toán học",
      subject: "toan",
      anh: "toan",
      icon: "fa-calculator",
      mau: "#2563eb",
      mauDam: "#153e99",
      coBai: true,
      tag: "Môn chính",
      chuyenDe: 14,
      baiTap: 420,
      tienDoMacDinh: 65,
    },
    {
      ten: "Ngữ Văn",
      tenDayDu: "Ngữ Văn",
      subject: "ngu-van",
      anh: "ngu_van",
      icon: "fa-feather-pointed",
      mau: "#0284c7",
      mauDam: "#075985",
      coBai: true,
      tag: "Môn chính",
      chuyenDe: 12,
      baiTap: 350,
      tienDoMacDinh: 40,
    },
  ];

  const MON_CHUYEN = {
    toan: {
      ten: "Chuyên Toán",
      tenDayDu: "Chuyên Toán",
      subject: "chuyen-toan",
      anh: "chuyen_toan",
      icon: "fa-shapes",
      mau: "#7c3aed",
      mauDam: "#5b21b6",
      coBai: true,
      tag: "Chuyên sâu",
      chuyenDe: 10,
      baiTap: 280,
      tienDoMacDinh: 25,
    },
    ly: {
      ten: "Chuyên Lý",
      tenDayDu: "Chuyên Vật Lý",
      subject: "vat-ly",
      anh: "chuyen_ly",
      icon: "fa-atom",
      mau: "#7c3aed",
      mauDam: "#5b21b6",
      coBai: true,
      tag: "Chuyên sâu",
      chuyenDe: 8,
      baiTap: 220,
      tienDoMacDinh: 20,
    },
    dia: {
      ten: "Chuyên Địa",
      tenDayDu: "Chuyên Địa Lí",
      subject: "chuyen-dia",
      anh: "chuyen_dia",
      icon: "fa-earth-asia",
      mau: "#7c3aed",
      mauDam: "#5b21b6",
      coBai: true,
      tag: "Chuyên sâu",
      chuyenDe: 6,
      baiTap: 180,
      tienDoMacDinh: 15,
    },
  };

  const monChuyen = localStorage.getItem("monChuyen") || "";
  const dsMon = [...MON_CHUNG];
  if (MON_CHUYEN[monChuyen]) {
    dsMon.push(MON_CHUYEN[monChuyen]);
  } else {
    // Mặc định bổ sung Chuyên Vật Lý để hiển thị đủ 3 cột cân xứng chuẩn giao diện PC
    dsMon.push(MON_CHUYEN.ly);
  }

  // ======================================================
  // 2. HÀM LẤY TIẾN ĐỘ THẬT TỪ API
  // ======================================================
  async function layPhanTram(subject) {
    if (!userId) return null;
    try {
      const res = await fetch(`${API}/api/tien-do/${subject}?user_id=${userId}`);
      const kq = await res.json();
      if (!kq.success) return null;
      let tong = 0, dem = 0;
      Object.values(kq.data || {}).forEach((chuong) =>
        Object.values(chuong).forEach((bai) =>
          Object.values(bai).forEach((p) => { tong += Number(p) || 0; dem++; })));
      return dem ? Math.round(tong / dem) : 0;
    } catch (e) {
      return null;
    }
  }

  // ======================================================
  // 3. LOGIC XỬ LÝ KHỐI PC (DESKTOP 3 CỘT)
  // ======================================================
  let daKhoiTaoDesktop = false;

  function khoiTaoGiaoDienDesktop() {
    if (daKhoiTaoDesktop || !grid) return;
    daKhoiTaoDesktop = true;

    // --- A. Render 3 Thẻ môn học ở cột giữa ---
    grid.innerHTML = "";
    dsMon.forEach((m) => {
      const the = document.createElement(m.coBai ? "a" : "div");
      the.className = `rich-card ${m.subject === "toan" ? "active-subject" : ""}` + (m.coBai ? "" : " rich-card--soon");
      if (m.coBai) the.href = `problems.html?subject=${m.subject}`;
      the.style.setProperty("--subject-color", m.mau);
      the.style.setProperty("--subject-dark", m.mauDam || m.mau);

      let pt = m.tienDoMacDinh;
      try {
        const allTd = JSON.parse(localStorage.getItem("edumate_tiendo_" + (userId || "")) || "{}");
        if (allTd[m.subject] != null) {
          pt = parseInt(allTd[m.subject], 10);
        } else {
          const savedPt = localStorage.getItem("tienDo_" + m.subject);
          if (savedPt !== null && !isNaN(savedPt)) pt = parseInt(savedPt, 10);
        }
      } catch (e) { }

      const baiDaLam = Math.round((pt / 100) * m.baiTap);

      // KIỂM TRA MÔN CHUYÊN HAY MÔN THƯỜNG:
      // Chỉ môn có tag "Chuyên sâu" hoặc ID "chuyen-" hoặc "vat-ly" mới hiển thị "Chuyên đề"
      const isMonChuyen = (m.tag === "Chuyên sâu") || (m.subject && m.subject.startsWith("chuyen-")) || (m.subject === "vat-ly");

      const metaHtml = isMonChuyen
        ? `<span><i class="fa-solid fa-layer-group"></i> ${m.chuyenDe || 8} Chuyên đề</span>
           <span><i class="fa-solid fa-circle-check"></i> ${m.baiTap} Bài tập</span>`
        : `<span><i class="fa-solid fa-circle-check"></i> ${m.baiTap} Bài tập</span>`;

      the.innerHTML = `
        <div class="rich-card-badge">${m.tag}</div>
        <div class="rich-card-icon" style="color: ${m.mau};">
          <i class="fa-solid ${m.icon}"></i>
        </div>
        <h3 class="rich-card-title">${m.tenDayDu}</h3>
        
        <div class="rich-card-progress">
          <div class="progress-info">
            <span>Tiến độ</span>
            <span class="progress-val" data-pt-subj="${m.subject}">${pt}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" data-bar-subj="${m.subject}" style="width: ${pt}%; background: linear-gradient(90deg, ${m.mau}, ${m.mauDam || m.mau});"></div>
          </div>
          <div class="progress-sub" data-sub-subj="${m.subject}">Đã hoàn thành ${baiDaLam}/${m.baiTap} bài (${pt}%)</div>
        </div>

        <div class="rich-card-meta">
          ${metaHtml}
        </div>

        <div class="rich-card-cta">
          <span>${m.coBai ? "Tiếp tục học" : "Sắp ra mắt"}</span>
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      `;

      grid.appendChild(the);
    });

    // Cập nhật tiến độ thật từ API
    if (userId) {
      dsMon.forEach(async (m) => {
        if (!m.coBai) return;
        const ptThat = await layPhanTram(m.subject);
        if (ptThat !== null) {
          const ptEl = document.querySelector(`[data-pt-subj="${m.subject}"]`);
          const barEl = document.querySelector(`[data-bar-subj="${m.subject}"]`);
          const subEl = document.querySelector(`[data-sub-subj="${m.subject}"]`);
          if (ptEl) ptEl.textContent = `${ptThat}%`;
          if (barEl) barEl.style.width = `${ptThat}%`;
          if (subEl) {
            const daLam = Math.round((ptThat / 100) * m.baiTap);
            subEl.textContent = `Đã hoàn thành ${daLam}/${m.baiTap} bài (${ptThat}%)`;
          }
        }
      });
    }

    // Cập nhật tên người dùng trên bong bóng thoại linh vật Sao La
    const bubbleUser = document.querySelector(".user-name-bubble");
    if (bubbleUser) bubbleUser.textContent = username;

    // --- B. Khu vực "Các môn đang làm dở" thanh mảnh (#resume-section) ---
    function renderResumeSection() {
      const container = document.getElementById("resume-section");
      const listEl = document.getElementById("resume-items-container");
      if (!container || !listEl) return;

      listEl.innerHTML = "";
      let countDo = 0;

      const MAP_MON = {
        "toan": { ten: "Toán học", icon: "fa-calculator" },
        "ngu-van": { ten: "Ngữ Văn", icon: "fa-feather-pointed" },
        "vat-ly": { ten: "Chuyên Vật Lý", icon: "fa-atom" },
        "chuyen-toan": { ten: "Chuyên Toán", icon: "fa-shapes" },
        "chuyen-dia": { ten: "Chuyên Địa", icon: "fa-earth-asia" }
      };

      (dsMon || []).forEach((m) => {
        if (m && m.subject) {
          MAP_MON[m.subject.replace(/_/g, "-")] = { ten: m.tenDayDu || m.ten, icon: m.icon };
        }
      });

      const esc = (s) =>
        String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      // Map<subKey, Map<exerciseDedupKey, normalizedItem>>
      const theoMon = new Map();

      function themBaiDo(rawItem, fallbackSub, uuTienMoi) {
        if (!rawItem || !rawItem.ten) return;
        const daLam = Number(rawItem.daLam || 0);
        const tongCau = Number(rawItem.tongCau || 0);
        if (!(daLam > 0 && daLam < tongCau)) return;

        let chapter = rawItem.chapter || "";
        let article = rawItem.article || "";
        let q = rawItem.q !== undefined && rawItem.q !== null ? String(rawItem.q) : "";
        let linkSub = "";
        try {
          const sp = new URL(rawItem.link || "", "http://local").searchParams;
          if (!chapter) chapter = sp.get("chapter") || "";
          if (!article) article = sp.get("article") || "";
          if (!q) q = sp.get("q") || "";
          linkSub = sp.get("subject") || "";
        } catch (e) {}

        const sub = (rawItem.subject || fallbackSub || linkSub || "").replace(/_/g, "-");
        if (!sub || sub === "contest") return;

        const conLai = rawItem.conLai !== undefined ? Math.max(0, Number(rawItem.conLai)) : Math.max(0, tongCau - daLam);
        const dedupKey = (chapter || article || q)
          ? `${sub}|${chapter}|${article}|${q}`
          : `${sub}|${rawItem.link || rawItem.ten}`;

        if (!theoMon.has(sub)) theoMon.set(sub, new Map());
        const mapBai = theoMon.get(sub);
        const old = mapBai.get(dedupKey);
        if (!old || uuTienMoi || (rawItem.capNhat || 0) > (old.capNhat || 0)) {
          mapBai.set(dedupKey, {
            ...rawItem,
            subject: sub,
            chapter,
            article,
            q,
            daLam,
            tongCau,
            conLai
          });
        }
      }

      // Ưu tiên đọc tất cả bản ghi chi tiết từng bài (baiDangLamBai_*)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("baiDangLamBai_")) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            themBaiDo(item, "", true);
          } catch (e) {}
        }
      }

      // Hỗ trợ ngược các bản ghi cũ (baiDangLam_<mon> và baiDangLam) nếu chưa có bản chi tiết trùng
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && ((k.startsWith("baiDangLam_") && !k.startsWith("baiDangLamBai_")) || k === "baiDangLam")) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            const fbSub = k.startsWith("baiDangLam_") ? k.replace("baiDangLam_", "") : "";
            themBaiDo(item, fbSub, false);
          } catch (e) {}
        }
      }

      theoMon.forEach((mapBai, subKey) => {
        const items = Array.from(mapBai.values());
        if (items.length === 0) return;
        countDo++;

        // Sắp xếp ưu tiên bài có NHIỀU câu chưa làm nhất (trùng thì lấy mới cập nhật hơn)
        items.sort((a, b) => {
          if (b.conLai !== a.conLai) return b.conLai - a.conLai;
          return (b.capNhat || 0) - (a.capNhat || 0);
        });

        const infoMon = MAP_MON[subKey] || { ten: "Bài tập", icon: "fa-book-open" };
        const bestItem = items[0];

        let labelHtml = "";
        let conLaiHienThi = bestItem.conLai;
        if (items.length === 1) {
          labelHtml = `<span class="resume-row-title" title="${esc(bestItem.ten)}">${esc(bestItem.ten)}</span>`;
        } else {
          conLaiHienThi = items.reduce((sum, it) => sum + it.conLai, 0);
          labelHtml = `<span class="resume-row-title" title="Ưu tiên làm tiếp bài nhiều câu chưa làm nhất">${items.length} bài đang làm dở</span>`;
        }

        const row = document.createElement("div");
        row.className = "resume-row-item";
        row.innerHTML = `
          <div class="resume-row-left">
            <div class="resume-row-icon"><i class="fa-solid ${infoMon.icon}"></i></div>
            <span class="resume-row-subject">${esc(infoMon.ten)}:</span>
            ${labelHtml}
          </div>
          <div class="resume-row-right">
            <span class="resume-remain-badge">Còn ${conLaiHienThi} câu chưa làm</span>
            <a href="${esc(bestItem.link)}" class="resume-btn-sm">Làm tiếp ➔</a>
          </div>
        `;
        listEl.appendChild(row);
      });

      // Tự động hiển thị nếu có bài dở; Ẩn hoàn toàn nếu không có
      if (countDo > 0) {
        container.style.display = "flex";
      } else {
        container.style.display = "none";
      }
    }

    renderResumeSection();

    // Tự động làm mới dữ liệu bài dở dang ngay khi người dùng quay lại trang (chống Back-Forward Cache)
    window.addEventListener("pageshow", () => renderResumeSection());
    window.addEventListener("focus", () => renderResumeSection());
    window.addEventListener("storage", () => renderResumeSection());

    // --- E. Cột Phải: Nhiệm vụ hôm nay (API Thật) ---
    async function taiNhiemVuThat() {
      const listEl = document.getElementById("real-quest-list");
      const countEl = document.getElementById("quest-count");
      const miniBar = document.getElementById("quest-mini-bar");
      if (!listEl) return;

      if (!userId) {
        listEl.innerHTML = `
          <li class="quest-row done">
            <i class="fa-solid fa-circle-check"></i>
            <span class="q-name">Đăng nhập ngày mới</span>
            <span class="q-claimed">Đã nhận</span>
          </li>
          <li class="quest-row pending">
            <i class="fa-regular fa-circle"></i>
            <div class="q-col">
              <span class="q-name">Giải đúng 5 bài tập Toán</span>
              <div class="q-track"><div class="q-fill" style="width: 40%;"></div></div>
            </div>
            <span class="q-xp">+25 XP</span>
          </li>
          <li class="quest-row pending">
            <i class="fa-regular fa-circle"></i>
            <div class="q-col">
              <span class="q-name">Duy trì chuỗi học tập</span>
              <div class="q-track"><div class="q-fill" style="width: 0%;"></div></div>
            </div>
            <span class="q-xp">+15 XP</span>
          </li>
        `;
        if (countEl) countEl.textContent = "1/3";
        if (miniBar) miniBar.style.width = "33.3%";
        return;
      }

      try {
        const res = await fetch(`${API}/api/nhiem-vu/${userId}`);
        const kq = await res.json();
        if (!kq.success || !kq.data || !Array.isArray(kq.data.ds)) {
          throw new Error("Không lấy được danh sách nhiệm vụ");
        }

        const { ds, so_da_nhan } = kq.data;
        if (countEl) countEl.textContent = `${so_da_nhan}/${ds.length}`;

        // Cập nhật Mini Progress Bar
        if (miniBar && ds.length > 0) {
          const pt = Math.round((so_da_nhan / ds.length) * 100);
          miniBar.style.width = `${pt}%`;
        }

        listEl.innerHTML = ds.map((item) => {
          const safeTen = esc(item.ten);
          if (item.da_nhan) {
            return `
              <li class="quest-row done">
                <i class="fa-solid fa-circle-check"></i>
                <span class="q-name" title="${safeTen}">${safeTen}</span>
                <span class="q-claimed">Đã nhận</span>
              </li>
            `;
          } else if (item.xong) {
            return `
              <li class="quest-row ready">
                <i class="fa-solid fa-circle-check" style="color: #2563eb;"></i>
                <span class="q-name" title="${safeTen}">${safeTen}</span>
                <button class="btn-claim-xp" data-nvid="${esc(item.id)}">Nhận +${Number(item.thuong_diem) || 0} XP</button>
              </li>
            `;
          } else {
            const pt = Math.min(100, Math.round(((item.tien_do || 0) / (item.muc_tieu || 1)) * 100));
            return `
              <li class="quest-row pending">
                <i class="fa-regular fa-circle"></i>
                <div class="q-col">
                  <span class="q-name" title="${safeTen}">${safeTen}</span>
                  <div class="q-track"><div class="q-fill" style="width: ${pt}%;"></div></div>
                </div>
                <span class="q-xp">+${Number(item.thuong_diem) || 0} XP</span>
              </li>
            `;
          }
        }).join("");

        listEl.querySelectorAll(".btn-claim-xp").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const nvId = btn.dataset.nvid;
            btn.disabled = true;
            btn.textContent = "Đang nhận...";

            try {
              const resp = await fetch(`${API}/api/nhiem-vu/nhan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: parseInt(userId, 10), nv_id: nvId }),
              });
              const ketQua = await resp.json();
              if (ketQua.success) {
                taiNhiemVuThat();
              } else {
                alert(ketQua.message || "Chưa thể nhận thưởng!");
                btn.disabled = false;
                btn.textContent = "Nhận lại";
              }
            } catch (err) {
              btn.disabled = false;
              btn.textContent = "Thử lại";
            }
          });
        });
      } catch (e) {
        console.warn("Không kết nối được API nhiệm vụ, dùng fallback cục bộ:", e);
      }
    }
    taiNhiemVuThat();

    // --- F. Cột Phải: Card 2 - Mục tiêu tuần & Biểu đồ mini 7 ngày (Dữ liệu thật + đặt mục tiêu) ---
    const btnEditWeekly = document.getElementById("btn-edit-weekly-goal");
    const editorWeekly = document.getElementById("weekly-goal-editor");
    const inputWeekly = document.getElementById("in-weekly-target");
    const btnSaveWeekly = document.getElementById("btn-save-weekly-goal");
    const btnCancelWeekly = document.getElementById("btn-cancel-weekly-goal");

    function apDungGiaoDienMucTieu(stats) {
      const percentBadge = document.getElementById("weekly-goal-percent");
      const doneCountEl = document.getElementById("weekly-done-count");
      const targetEl = document.getElementById("weekly-total-target");
      const fillBar = document.getElementById("weekly-fill-bar");
      const remainEl = document.getElementById("weekly-remain-count");
      const streakTextEl = document.getElementById("weekly-streak-text");
      const streakIcoEl = document.getElementById("weekly-streak-ico");
      const streakFooterEl = document.querySelector(".weekly-streak-footer");
      if (!percentBadge || !doneCountEl || !fillBar) return;

      const weeklyDone = Math.max(0, Number(stats.da_lam_tuan ?? 0));
      const weeklyTarget = Math.max(5, Number(stats.muc_tieu ?? 20));
      const streakDays = Math.max(0, Number(stats.streak ?? 0));
      const percent = Math.min(100, Math.round((weeklyDone / weeklyTarget) * 100));

      percentBadge.textContent = `${percent}%`;
      doneCountEl.textContent = weeklyDone;
      if (targetEl) targetEl.textContent = weeklyTarget;
      if (inputWeekly && (!editorWeekly || editorWeekly.hidden)) inputWeekly.value = weeklyTarget;
      fillBar.style.width = `${percent}%`;

      if (remainEl) {
        const conLai = Math.max(0, weeklyTarget - weeklyDone);
        remainEl.textContent = conLai === 0 ? "Đạt mục tiêu! 🎉" : `Còn ${conLai} bài`;
      }

      const theoNgay = Array.isArray(stats.theo_ngay) && stats.theo_ngay.length === 7
        ? stats.theo_ngay
        : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((thu, idx) => {
            const todayDayOfWeek = new Date().getDay();
            const mapIdx = [6, 0, 1, 2, 3, 4, 5];
            return { thu, so_bai: 0, is_today: idx === mapIdx[todayDayOfWeek] };
          });

      const maxDaily = Math.max(3, ...theoNgay.map((d) => Number(d.so_bai) || 0));
      const dayCols = document.querySelectorAll(".weekly-mini-chart .chart-day-col");
      dayCols.forEach((col, idx) => {
        const info = theoNgay[idx];
        const bar = col.querySelector(".chart-bar");
        const sb = info ? Number(info.so_bai) || 0 : 0;
        const hPct = sb > 0 ? Math.max(18, Math.round((sb / maxDaily) * 100)) : 0;
        if (bar) {
          bar.style.height = `${hPct}%`;
          const prefix = info ? info.thu : "";
          bar.title = info && info.is_today
            ? `${prefix} (Hôm nay): ${sb} bài`
            : `${prefix}: ${sb > 0 ? sb + " bài" : "Chưa làm"}`;
        }
        col.classList.toggle("is-today", Boolean(info && info.is_today));
      });

      const matChuoi = streakDays <= 0;
      if (streakFooterEl) streakFooterEl.classList.toggle("is-lost", matChuoi);
      if (streakIcoEl) {
        streakIcoEl.src = matChuoi ? "img/icon-streak-mat.png" : "img/icon-streak.png";
        streakIcoEl.alt = matChuoi ? "Mất chuỗi" : "Streak";
      }
      if (streakTextEl) {
        streakTextEl.innerHTML = matChuoi
          ? `Chưa có chuỗi (<b>0 ngày</b>) — làm 1 bài hôm nay!`
          : `Chuỗi <b>${streakDays} ngày</b> học liên tục`;
      }
    }

    async function renderWeeklyGoal() {
      const localTarget = parseInt(localStorage.getItem("weekly_goal_target_" + (userId || "khach")) || "20", 10) || 20;
      const localStreak = parseInt(localStorage.getItem("streak") || "0", 10) || 0;

      if (!userId) {
        apDungGiaoDienMucTieu({ da_lam_tuan: 0, muc_tieu: localTarget, streak: 0 });
        return;
      }

      try {
        const res = await fetch(`${API}/api/muc-tieu-tuan/${userId}`);
        const kq = await res.json();
        if (res.ok && kq && kq.success && kq.data) {
          localStorage.setItem("weekly_goal_target_" + userId, kq.data.muc_tieu);
          if (typeof kq.data.streak === "number") {
            localStorage.setItem("streak", kq.data.streak);
            if (window.capNhatIconStreak) window.capNhatIconStreak(kq.data.streak);
          }
          apDungGiaoDienMucTieu(kq.data);
          return;
        }
      } catch (e) { /* fallback cục bộ nếu server tạm ngắt */ }

      apDungGiaoDienMucTieu({ da_lam_tuan: 0, muc_tieu: localTarget, streak: localStreak });
    }

    if (btnEditWeekly && editorWeekly) {
      btnEditWeekly.addEventListener("click", () => {
        editorWeekly.hidden = !editorWeekly.hidden;
        if (!editorWeekly.hidden && inputWeekly) {
          inputWeekly.focus();
          inputWeekly.select();
        }
      });
    }
    if (btnCancelWeekly && editorWeekly) {
      btnCancelWeekly.addEventListener("click", () => {
        editorWeekly.hidden = true;
      });
    }
    if (btnSaveWeekly && inputWeekly && editorWeekly) {
      btnSaveWeekly.addEventListener("click", async () => {
        let val = parseInt(inputWeekly.value, 10);
        if (!Number.isFinite(val)) val = 20;
        val = Math.max(5, Math.min(200, val));
        inputWeekly.value = val;
        localStorage.setItem("weekly_goal_target_" + (userId || "khach"), String(val));

        if (userId) {
          btnSaveWeekly.disabled = true;
          try {
            const resp = await fetch(`${API}/api/muc-tieu-tuan/${userId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ muc_tieu: val }),
            });
            await resp.json();
          } catch (e) { /* bỏ qua, vẫn dùng được cục bộ */ }
          btnSaveWeekly.disabled = false;
        }
        editorWeekly.hidden = true;
        renderWeeklyGoal();
      });
      inputWeekly.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          btnSaveWeekly.click();
        } else if (e.key === "Escape") {
          editorWeekly.hidden = true;
        }
      });
    }

    renderWeeklyGoal();
    window.addEventListener("pageshow", () => renderWeeklyGoal());
    window.addEventListener("focus", () => renderWeeklyGoal());
  }

  // ======================================================
  // 4. LOGIC XỬ LÝ KHỐI MOBILE: HỆ MẶT TRỜI (ORBIT SYSTEM)
  // ======================================================
  let daDungOrbit = false;

  function dungOrbit() {
    if (daDungOrbit || !orbit) return;
    daDungOrbit = true;

    const BO_CUC = {
      1: { kieu: "mot", by: 50, pos: [[50, 24]] },
      2: { kieu: "doi", by: 50, pos: [[26, 22], [74, 78]] },
      3: { kieu: "ba", by: 48, pos: [[26, 22], [74, 22], [50, 78]] },
    };
    const bc = BO_CUC[dsMon.length] || BO_CUC[3];

    orbit.classList.add("orbit--" + bc.kieu);
    orbit.style.setProperty("--by", bc.by + "%");

    orbit.innerHTML = `
      <span class="orbit-glow" aria-hidden="true"></span>
      <span class="orbit-stars" aria-hidden="true"></span>
      <span class="orbit-ring r1" aria-hidden="true"></span>
      <span class="orbit-ring r2" aria-hidden="true"></span>
      <span class="orbit-ring r3" aria-hidden="true"></span>
      <div class="orbit-core" aria-hidden="true">
        <div class="orbit-core-spin"><i class="fa-solid fa-book-open"></i></div>
      </div>`;

    const CHU_VI = 289.03;
    const dsEl = [];

    dsMon.forEach((m, i) => {
      const [x, y] = bc.pos[i] || [50, 50];
      const arm = document.createElement("div");
      arm.className = "orbit-arm";

      const the = document.createElement(m.coBai ? "a" : "div");
      the.className = "orbit-sat" + (m.coBai ? "" : " orbit-sat--soon");
      the.style.cssText = `--x:${x}%;--y:${y}%;--c:${m.mau};--c2:${m.mauDam || m.mau};--c-glow:${m.mau}55;--i:${i};--p:0`;
      if (m.coBai) the.href = `problems.html?subject=${m.subject}`;
      the.setAttribute("aria-label", m.ten);

      the.innerHTML = `
        <span class="orbit-counter">
          <span class="orbit-body">
            <svg class="orbit-svg" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="orbit-track" cx="50" cy="50" r="46"></circle>
              <circle class="orbit-arc" cx="50" cy="50" r="46" style="stroke-dasharray:${CHU_VI}"></circle>
            </svg>
            <i class="orbit-ico fa-solid ${m.icon}"></i>
            <b class="orbit-ten">${m.ten}</b>
            <span class="orbit-pt">${m.coBai ? "…" : "Sắp có"}</span>
          </span>
        </span>`;

      dsEl.push(the);
      arm.appendChild(the);
      orbit.appendChild(arm);
    });

    function chayVong(el, pt) {
      const ptEl = el.querySelector(".orbit-pt");
      if (pt === null) { ptEl.textContent = "Bắt đầu"; return; }
      el.style.setProperty("--p", pt / 100);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        ptEl.textContent = pt + "%";
        return;
      }
      const batDau = performance.now(), thoiGian = 800;
      const buoc = (t) => {
        const k = Math.min(1, (t - batDau) / thoiGian);
        ptEl.textContent = Math.round(pt * (1 - Math.pow(1 - k, 3))) + "%";
        if (k < 1) requestAnimationFrame(buoc);
      };
      requestAnimationFrame(buoc);
    }

    orbit.classList.add("is-play");
    const ketQua = dsMon.map((m) => (m.coBai ? layPhanTram(m.subject) : Promise.resolve(null)));
    setTimeout(() => {
      Promise.all(ketQua).then((kq) => {
        dsMon.forEach((m, i) => { if (m.coBai) chayVong(dsEl[i], kq[i]); });
      });
    }, 400);
  }

  // ======================================================
  // 5. PHÂN NHÁNH THỰC THI THEO THIẾT BỊ (BRANCHING EXECUTION)
  // ======================================================
  function khoiTaoTheoThietBi() {
    if (DeviceUtil.isMobile()) {
      dungOrbit();
    } else {
      khoiTaoGiaoDienDesktop();
    }
  }

  khoiTaoTheoThietBi();

  // Tự động thích ứng khi resize hoặc xoay màn hình
  DeviceUtil.onDeviceChange((type) => {
    if (type === "mobile") {
      dungOrbit();
    } else {
      khoiTaoGiaoDienDesktop();
    }
  });

  const noiBaiTapTrang = (tt) => {
    if (!tt || !window.SAOLA || window.SAOLA.vuaChaoMoi) return;
    const uid = userId || "khach";
    const kDaVao = "saola_da_vao_bt_" + uid;
    const kSs = "saola_da_bt_ss_" + uid;
    if (DeviceUtil.isDesktop() && localStorage.getItem("vnstarl_tour_baitap_" + uid) !== "1") {
      return; // Nhường tour-bai-tap.js phát bt_lan_dau ngay khi bấm nút Bắt đầu
    }
    if (!localStorage.getItem(kDaVao)) {
      localStorage.setItem(kDaVao, "1");
      sessionStorage.setItem(kSs, "1");
      window.SAOLA.noi("bt_lan_dau");
    } else if (!sessionStorage.getItem(kSs)) {
      sessionStorage.setItem(kSs, "1");
      window.SAOLA.noi("bt_quay_lai");
    }
  };
  if (window.SAOLA) window.SAOLA.sanSang.then(noiBaiTapTrang);
  else window.addEventListener("saola-san-sang", (e) => noiBaiTapTrang(e.detail), { once: true });
});
