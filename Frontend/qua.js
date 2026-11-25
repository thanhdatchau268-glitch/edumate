document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const API = typeof API_SERVER === "string" ? API_SERVER : "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);

  // chữ ngắn gọn ghi trên từng múi của vòng quay (id lấy từ server)
  const NHAN_MUI = {
    hut: "😢 Hụt",
    diem10: "+10 điểm",
    diem20: "+20 điểm",
    diem50: "+50 điểm",
    bao_ho: "🛡️ Thẻ bảo hộ",
    x15: "⚡ x1,5 điểm 1h",
    them_luot: "🎟️ +1 lượt",
  };
  const MAU_MUI = [
    "#e8eefc",
    "#fff4e0",
    "#e6f6ee",
    "#f3e8ff",
    "#ffe8e8",
    "#e0f4fb",
    "#fdf6c8"
  ];

  let dsMui = []; // các múi của vòng quay
  let tt = null; // trạng thái quà hiện tại
  let goc = 0; // góc đã quay (cộng dồn để lần sau quay tiếp mượt)
  let dangQuay = false;
  let demNguoc = null;

  function baoLoi(el, text, mau) {
    el.style.color = mau || "#c62828";
    el.textContent = text;
  }
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // ----- Vẽ vòng quay -----
  function veVongQuay() {
    const banh = $("qua-banh");
    const n = dsMui.length;
    if (!banh || n <= 0) return;
    const mui = 360 / n;
    banh.style.background =
      "conic-gradient(" +
      dsMui.map((_, i) => `${MAU_MUI[i % MAU_MUI.length
      ]
        } ${i * mui
        }deg ${(i + 1) * mui
        }deg`).join(",") +
      ")";
    banh.innerHTML = "";
    dsMui.forEach((m, i) => {
      const o = document.createElement("div");
      o.className = "qua-nhan-mui";
      o.style.transform = `rotate(${(i + 0.5) * mui
        }deg)`;
      const sp = document.createElement("span");
      if (m.id === "diem10" || m.id === "diem20" || m.id === "diem50") {
        const ico = document.createElement("img");
        ico.className = "vn-ico";
        ico.src = "img/icon-diem.png";
        ico.alt = "Điểm";
        sp.appendChild(ico);
        sp.appendChild(document.createTextNode(" " + (NHAN_MUI[m.id] || m.ten)));
      } else if (m.id === "bao_ho") {
        const ico = document.createElement("img");
        ico.className = "vn-ico";
        ico.src = "img/icon-bao-ho.png";
        ico.alt = "Bảo hộ streak";
        sp.appendChild(ico);
        sp.appendChild(document.createTextNode(" Thẻ bảo hộ"));
      } else if (m.id === "them_luot") {
        const ico = document.createElement("img");
        ico.className = "vn-ico";
        ico.src = "img/icon-ve.png";
        ico.alt = "Vé quay";
        sp.appendChild(ico);
        sp.appendChild(document.createTextNode(" +1 lượt"));
      } else {
        sp.textContent = NHAN_MUI[m.id] || m.ten; // textContent: không chạy được code lạ
      }
      o.appendChild(sp);
      banh.appendChild(o);
    });
  }
  // ----- Đếm ngược buff x1,5 -----
  function hienX15() {
    clearInterval(demNguoc);
    const el = $("qua-x15");
    let giay = tt.x15_con_lai;
    if (giay <= 0) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const ve = () => {
      const m = String(Math.floor(giay / 60)).padStart(2,
        "0");
      const s = String(giay % 60).padStart(2,
        "0");
      el.textContent = `⚡ Đang x1,5 điểm khi làm bài: còn ${m}:${s}`;
    };
    ve();
    demNguoc = setInterval(() => {
      giay--;
      if (giay <= 0) {
        clearInterval(demNguoc);
        el.classList.add("hidden");
        return;
      }
      ve();
    },
      1000);
  }
  // ----- Đổ trạng thái lên trang -----
  function hienTrangThai() {
    $("qua-diem").textContent = tt.score;
    $("qua-bao-ho").textContent = `${tt.the_bao_ho}/${tt.toi_da_bao_ho}`;
    $("qua-luot").textContent = tt.luot_quay;
    const spinBadge = $("wheel-spins-val");
    if (spinBadge) spinBadge.textContent = tt.luot_quay;
    localStorage.setItem("streak", tt.streak); // đồng bộ chuỗi ngày lên thanh menu
    if (window.capNhatIconStreak) window.capNhatIconStreak(tt.streak);

    $("qua-mo-ta").textContent = tt.tuan_dau
      ? "Điểm danh 7 ngày đầu để nhận quà. Bỏ lỡ một ngày cũng không mất tiến độ." : `Đã điểm danh ${tt.tong_ngay} ngày. Điểm danh đủ 7 ô để nhận thêm 1 lượt quay.`;

    const lich = $("qua-lich");
    lich.innerHTML = "";

    const daNhanCount = tt.lich.filter((o) => o.da_nhan).length;
    const fillPct = daNhanCount >= 7 ? 100 : daNhanCount <= 0 ? 0 : Math.min(100, Math.round((Math.max(0, daNhanCount - 0.5) / 6) * 100));

    const lineBg = document.createElement("div");
    lineBg.className = "journey-line-bg";
    lineBg.innerHTML = `<div class="journey-line-fill" style="width: ${fillPct}%;"></div>`;
    lich.appendChild(lineBg);

    const todayDayNum = tt.da_diem_danh_hom_nay
      ? (tt.tien_do > 0 ? tt.tien_do : 1)
      : ((tt.tien_do || 0) % 7) + 1;

    tt.lich.forEach((o) => {
      const d = document.createElement("div");
      const isToday = !tt.da_diem_danh_hom_nay && o.ngay === todayDayNum;
      d.className = `station-node qua-o ${o.da_nhan ? "completed da-nhan is-checked" : ""} ${isToday ? "is-today" : ""}`;

      const tenL = (o.ten || "").toLowerCase();
      let icon = '<img src="img/icon-diem.png" alt="Điểm" class="vn-ico vn-ico-xl">';
      if (tenL.includes("bảo hộ") || tenL.includes("khiên")) icon = '<img src="img/icon-bao-ho.png" alt="Bảo hộ streak" class="vn-ico vn-ico-xl">';
      else if (tenL.includes("quay")) icon = '<img src="img/icon-hop-qua.png" alt="Vòng quay" class="vn-ico vn-ico-xl">';
      else if (tenL === "điểm danh") icon = '<img src="img/icon-diem.png" alt="Điểm danh" class="vn-ico vn-ico-xl">';

      const pinHtml = isToday
        ? `<img src="img/pet/than/mac_dinh/_xem_truoc.webp" alt="Sao La" class="station-mascot-pin" loading="lazy" decoding="async" onerror="this.src='img/logo.webp'">`
        : "";

      d.innerHTML = `
        ${pinHtml}
        <div class="station-circle">
          <span class="station-circle-icon">${o.da_nhan ? '<i class="fa-solid fa-check text-emerald-600 font-bold"></i>' : icon}</span>
        </div>
        <span class="station-label-title">Ngày ${o.ngay}</span>
        <span class="station-reward-val" title="${esc(o.ten)}">${o.da_nhan ? "Đã nhận" : esc(o.ten)}</span>
      `;
      lich.appendChild(d);
    });

    const nutDD = $("btn-diem-danh");
    nutDD.disabled = tt.da_diem_danh_hom_nay;
    nutDD.innerHTML = tt.da_diem_danh_hom_nay
      ? '<i class="fa-solid fa-circle-check"></i> Hôm nay đã điểm danh'
      : '<i class="fa-solid fa-calendar-check"></i> Điểm danh hôm nay';
    $("btn-quay").disabled = dangQuay || tt.luot_quay <= 0;
    hienX15();
  }
  // ----- Tải dữ liệu lần đầu -----
  try {
    const res = await fetch(`${API
      }/api/users/${userId
      }/qua`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    tt = kq.data;
    dsMui = tt.vong_quay;
    veVongQuay();
    hienTrangThai();
  } catch (err) {
    baoLoi($("qua-loi"),
      "Lỗi: " + err.message);
    return;
  }
  // ----- Điểm danh -----
  $("btn-diem-danh").addEventListener("click", async () => {
    const nut = $("btn-diem-danh");
    nut.disabled = true;
    try {
      const res = await fetch(`${API
        }/api/diem-danh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_id: Number(userId)
          }),
        });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);
      tt = Object.assign(tt, kq.trang_thai);
      hienTrangThai();
      if (window.AmThanh && window.AmThanh.diemDanh) window.AmThanh.diemDanh(tt.tien_do === 7);
      baoLoi($("qua-dd-tb"),
        "🎉 Bạn nhận được: " + kq.nhan.join(", "),
        "#178a5a");
    } catch (err) {
      if (window.AmThanh && window.AmThanh.loi) window.AmThanh.loi();
      baoLoi($("qua-dd-tb"), err.message);
      hienTrangThai(); // trả nút về đúng trạng thái
    }
  });

  // ----- Quay thưởng -----
  $("btn-quay").addEventListener("click", async () => {
    if (dangQuay || tt.luot_quay <= 0) return;
    dangQuay = true;
    $("btn-quay").disabled = true;
    $("qua-quay-tb").textContent = "";
    try {
      const res = await fetch(`${API
        }/api/quay-thuong`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_id: Number(userId)
          }),
        });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      // quay đến đúng múi server đã chọn (kim chỉ ở đỉnh), lệch nhẹ ngẫu nhiên trong múi
      const mui = 360 / dsMui.length;
      const tam = (kq.vi_tri + 0.5) * mui;
      const lech = (Math.random() - 0.5) * mui * 0.6;
      goc = goc - (goc % 360) + 360 * 5 + (360 - tam) + lech;
      $("qua-banh").style.transform = `rotate(${goc
        }deg)`;
      if (window.AmThanh && window.AmThanh.quay) window.AmThanh.quay(4.2);

      // đợi quay xong (4.2s) mới hiện kết quả
      setTimeout(() => {
        dangQuay = false;
        tt = Object.assign(tt, kq.trang_thai);
        hienTrangThai();
        const trung = kq.trung !== "hut";
        if (window.AmThanh && window.AmThanh.trungQua) window.AmThanh.trungQua(trung);
        baoLoi(
          $("qua-quay-tb"),
          (trung ? "🎉 Bạn trúng: " : "😢 ") + kq.ten + (kq.ghi_chu ? ` (${kq.ghi_chu
            })` : ""),
          trung ? "#178a5a" : "#5b6b82",
        );
      },
        4300);
    } catch (err) {
      dangQuay = false;
      if (window.AmThanh && window.AmThanh.loi) window.AmThanh.loi();
      baoLoi($("qua-quay-tb"), err.message);
      hienTrangThai();
    }
  });
});