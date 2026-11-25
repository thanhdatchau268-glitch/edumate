document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");

  // Chưa đăng nhập thì đưa sang trang đăng nhập
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const API = "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);
  const TEN_MON = {
    toan: "Chuyên Toán",
    ly: "Chuyên Vật Lý",
    hoa: "Chuyên Hóa Học",
    sinh: "Chuyên Sinh Học",
    van: "Chuyên Ngữ Văn",
    anh: "Chuyên Tiếng Anh",
    su: "Chuyên Lịch Sử",
    dia: "Chuyên Địa Lí",
  };

  // các mốc điểm (phải giống số bên app.py)
  const DIEM_MO_KHOA = 500;         // mở "Sửa hồ sơ"
  const DIEM_TAI_ANH = 500;         // mở "Tải ảnh avatar riêng"
  const DUNG_LUONG_ANH_TOI_DA = 15 * 1024 * 1024; // ảnh gốc tối đa 15MB (sẽ được thu nhỏ trước khi gửi)

  // ----- Nút Đăng xuất: gắn sớm để server lỗi vẫn đăng xuất được -----
  $("btn-dang-xuat").addEventListener("click", () => {
    if (typeof dangXuat === "function") {
      dangXuat(); // hàm nằm trong script.js
    } else {
      ["isLoggedIn", "username", "userId", "streak", "monChuyen", "avatar", "huyHieu"].forEach((k) =>
        localStorage.removeItem(k),
      );
      window.location.replace("index.html");
    }
  });

  // Đổ thông tin lên trang (dùng textContent để tên không chạy được code lạ)
  function hienThongTin(u) {
    $("pf-username").textContent = u.username;
    $("pf-bio").textContent = u.bio || "Chưa có giới thiệu";
    $("pf-score").textContent = u.score;
    $("pf-streak").textContent = u.streak;
    $("pf-baoho").textContent = u.the_bao_ho ?? 0;
    $("pf-chuyen").textContent = TEN_MON[u.mon_chuyen] || "Không";
    const streakIco = $("pf-streak-ico");
    if (streakIco) {
      const mat = Number(u.streak || 0) <= 0;
      streakIco.src = mat ? "img/icon-streak-mat.png" : "img/icon-streak.png";
      streakIco.alt = mat ? "Mất chuỗi" : "Streak";
    }
    if (window.capNhatIconStreak) window.capNhatIconStreak(u.streak || 0);
    datAvatar($("pf-avatar"), u.avatar); // hàm nằm trong script.js
  }

  let user = null; // nhớ thông tin hiện tại để điền sẵn vào form

  // Nạp song song thông tin user và danh sách huy hiệu (có timeout 8s để không treo vô hạn)
  function fetchCoTimeout(url, options = {}, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  const huyHieuReq = fetchCoTimeout(`${API}/api/huy-hieu/${userId}`)
    .then((r) => r.json())
    .catch((err) => ({ success: false, message: err && err.name === "AbortError" ? "Server phản hồi quá lâu (timeout)." : err.message }));

  try {
    const res = await fetchCoTimeout(`${API}/api/users/${userId}`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    user = kq.data;
    hienThongTin(user);
    localStorage.setItem("avatar", user.avatar || ""); // đồng bộ lại cho thanh menu
    localStorage.setItem("huyHieu", user.huy_hieu || "");
  } catch (err) {
    // Chỉ thay phần thẻ hồ sơ, KHÔNG xoá nút Đăng xuất
    document.querySelector(".profile-card").textContent = "Lỗi: " + err.message;
    const gridEl = $("pf-trophy-grid");
    if (gridEl) {
      gridEl.innerHTML = "";
      const p = document.createElement("p");
      p.className = "pf-trophy-empty";
      p.textContent = "Chưa kết nối được server. Hãy bật hoặc khởi động lại Backend/script/app.py nhé!";
      gridEl.appendChild(p);
    }
    return;
  }

  // =========================================================
  // KHÓA / MỞ KHÓA theo điểm (gọi lại mỗi khi điểm thay đổi)
  // =========================================================
  const nutSua = $("btn-sua");
  const nutTaiAnh = $("btn-tai-anh");
  const ttKhoa = $("avatar-khoa-tt");

  function capNhatKhoa() {
    // nút "Sửa hồ sơ"
    const duSua = user.score >= DIEM_MO_KHOA;
    nutSua.classList.toggle("btn-khoa", !duSua);
    if (duSua) delete nutSua.dataset.tip;
    else nutSua.dataset.tip = `Bạn phải đủ ${DIEM_MO_KHOA} điểm mới mở khóa tính năng này`;

    // nút "Tải ảnh của bạn"
    const duAnh = user.score >= DIEM_TAI_ANH;
    nutTaiAnh.classList.toggle("da-khoa", !duAnh);
    ttKhoa.style.color = "#5b6b82";
    ttKhoa.textContent = duAnh
      ? ""
      : `🔒 Tải ảnh riêng sẽ mở khóa khi đạt ${DIEM_TAI_ANH} điểm (bạn đang có ${user.score}).`;

    // thanh tiến độ mở khóa
    const pt = Math.min(100, Math.round((user.score / DIEM_MO_KHOA) * 100));
    $("pf-mk-bar").style.width = pt + "%";
    $("pf-mk-bar").parentElement.setAttribute("aria-valuenow", pt);
    $("pf-mk-text").textContent = duSua
      ? "Bạn đã mở khóa Sửa hồ sơ và Tải ảnh avatar riêng 🎉"
      : `${user.score}/${DIEM_MO_KHOA} điểm để mở khóa Sửa hồ sơ và Tải ảnh avatar riêng.`;
  }

  // =========================================================
  // ĐỔI AVATAR (chọn ảnh có sẵn hoặc tự tải lên)
  // =========================================================
  const nenAv = $("avatar-nen");
  const luoiAv = $("avatar-luoi");
  const ttAv = $("avatar-thong-bao");
  const fileAv = $("file-avatar");

  function moAvatar() {
    nenAv.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    capNhatKhoa();
    taiDanhSachAvatar();
  }

  function dongAvatar() {
    nenAv.classList.add("hidden");
    document.body.style.overflow = "";
  }

  // Tô viền ảnh đang dùng
  function danhDauAvatar() {
    luoiAv.querySelectorAll(".avatar-o").forEach((b) =>
      b.classList.toggle("dang-chon", b.dataset.ten === (user.avatar || "")),
    );
  }

  // Sau khi server đã lưu avatar mới: cập nhật mọi nơi trên trang
  function apDungAvatar(ten) {
    user.avatar = ten;
    localStorage.setItem("avatar", ten);
    datAvatar($("pf-avatar"), ten); // ảnh to trong hồ sơ
    document.querySelectorAll(".user-avatar").forEach((i) => datAvatar(i, ten)); // ảnh trên menu
    if (typeof dongBoNavbarHuyHieu === "function") {
      dongBoNavbarHuyHieu(user.huy_hieu || "");
    }
    danhDauAvatar();
    dongAvatar();
  }

  async function taiDanhSachAvatar() {
    ttAv.style.color = "#5b6b82";
    ttAv.textContent = "Đang tải...";
    luoiAv.innerHTML = "";
    luoiAv.style.cssText =
      "display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-bottom:14px;";
    try {
      const res = await fetch(`${API}/api/avatars`);
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      if (kq.data.length === 0) {
        ttAv.textContent = "Chưa có avatar có sẵn nào.";
        return;
      }
      ttAv.textContent = "";

      kq.data.forEach((ten) => {
        const nut = document.createElement("button");
        nut.type = "button";
        nut.className = "avatar-o";
        nut.dataset.ten = ten;
        nut.setAttribute("aria-label", "Chọn avatar " + ten);
        // khóa cỡ ngay tại đây: dù CSS lỗi/cache thì ô vẫn không phình
        nut.style.width = "84px";
        nut.style.height = "84px";
        nut.style.overflow = "hidden";

        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        datAvatar(img, ten);
        nut.appendChild(img);

        nut.addEventListener("click", () => chonAvatar(ten));
        luoiAv.appendChild(nut);
      });
      danhDauAvatar();
    } catch (err) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = "Không tải được danh sách avatar. Bật app.py nhé!";
    }
  }

  // Gửi avatar có sẵn đã chọn lên server ('' = về ảnh mặc định)
  async function chonAvatar(ten) {
    ttAv.style.color = "#5b6b82";
    ttAv.textContent = "Đang lưu...";
    try {
      const res = await fetch(`${API}/api/users/${userId}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: ten }),
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);
      apDungAvatar(kq.avatar);
    } catch (err) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = err.message;
    }
  }

  // ----- Tự tải ảnh lên -----

  // Cắt vuông giữa ảnh, thu nhỏ tối đa 512x512, đổi sang WebP -> file chỉ còn vài chục KB
  function thuNhoAnh(file) {
    return new Promise((ok, loi) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canh = Math.min(img.naturalWidth, img.naturalHeight); // cạnh hình vuông cắt ra
        const kichThuoc = Math.min(512, canh);
        const c = document.createElement("canvas");
        c.width = c.height = kichThuoc;
        const sx = (img.naturalWidth - canh) / 2;   // cắt đều hai bên
        const sy = (img.naturalHeight - canh) / 2;
        c.getContext("2d").drawImage(img, sx, sy, canh, canh, 0, 0, kichThuoc, kichThuoc);
        c.toBlob(
          (b) => (b ? ok(b) : loi(new Error("Không xử lý được ảnh này."))),
          "image/webp",
          0.85,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        loi(new Error("Không đọc được ảnh này. Hãy thử file JPG, PNG hoặc WEBP."));
      };
      img.src = url;
    });
  }

  async function taiAnhLen(file) {
    if (!file) return;
    ttAv.style.color = "#5b6b82";

    if (!file.type.startsWith("image/")) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = "Hãy chọn một file ảnh.";
      return;
    }
    if (file.size > DUNG_LUONG_ANH_TOI_DA) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = "Ảnh quá lớn (tối đa 15MB).";
      return;
    }

    nutTaiAnh.disabled = true;
    ttAv.textContent = "Đang xử lý và tải ảnh lên...";
    try {
      const blob = await thuNhoAnh(file);
      const fd = new FormData();
      fd.append("file", blob, "avatar.webp");

      // không tự đặt Content-Type: trình duyệt tự thêm boundary cho FormData
      const res = await fetch(`${API}/api/users/${userId}/avatar-upload`, {
        method: "POST",
        body: fd,
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);
      apDungAvatar(kq.avatar);
    } catch (err) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = err.message;
    } finally {
      nutTaiAnh.disabled = false;
      fileAv.value = ""; // cho phép chọn lại đúng file đó lần sau
    }
  }

  nutTaiAnh.addEventListener("click", () => {
    if (user.score < DIEM_TAI_ANH) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = `Bạn cần ${DIEM_TAI_ANH} điểm để tải ảnh riêng.`;
      return;
    }
    fileAv.click(); // mở hộp chọn file
  });
  fileAv.addEventListener("change", () => taiAnhLen(fileAv.files[0]));

  $("btn-doi-avatar").addEventListener("click", moAvatar);
  $("btn-dong-avatar").addEventListener("click", dongAvatar);
  $("btn-avatar-mac-dinh").addEventListener("click", () => chonAvatar(""));
  nenAv.addEventListener("click", (e) => {
    if (e.target === nenAv) dongAvatar();
  });

  // =========================================================
  // SỬA HỒ SƠ
  // =========================================================
  const nen = $("sua-nen");
  const form = $("form-sua");

  function moForm() {
    if (user.score < DIEM_MO_KHOA) return;
    $("in-username").value = user.username; // điền sẵn giá trị cũ
    $("in-bio").value = user.bio || "";
    $("sua-thong-bao").textContent = "";
    nen.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("in-username").focus();
  }

  function dongForm() {
    nen.classList.add("hidden");
    document.body.style.overflow = "";
  }

  $("btn-sua").addEventListener("click", moForm);
  $("btn-dong-sua").addEventListener("click", dongForm);
  $("btn-huy").addEventListener("click", dongForm);

  nen.addEventListener("click", (e) => {
    if (e.target === nen) dongForm();
  });

  // Phím Esc đóng cả 2 hộp
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dongForm();
      dongAvatar();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // chặn trang tự tải lại
    const tb = $("sua-thong-bao");
    tb.style.color = "#5b6b82";
    tb.textContent = "Đang lưu...";

    try {
      const res = await fetch(`${API}/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("in-username").value,
          bio: $("in-bio").value,
        }),
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      user.username = kq.username;
      user.bio = kq.bio;
      hienThongTin(user);

      localStorage.setItem("username", kq.username);
      const tenMenu = document.querySelector("#user-profile .username");
      if (tenMenu) tenMenu.textContent = kq.username;

      dongForm();
    } catch (err) {
      tb.style.color = "#dc2626";
      tb.textContent = err.message;
    }
  });

  // =========================================================
  // THÔNG BÁO (phần xử lý nằm trong thong-bao.js)
  // =========================================================
  const TB = window.THONGBAO;
  const tbBat = $("tb-bat");
  const tbChiTiet = $("tb-chi-tiet");
  const tbTrangThai = $("tb-trang-thai");

  function datTrangThai(chu, lop) {
    tbTrangThai.textContent = chu;
    tbTrangThai.className = "pf-trang-thai" + (lop ? " " + lop : "");
  }

  // Vẽ lại công tắc + trạng thái theo cài đặt hiện tại
  function veThongBao() {
    if (!TB) {
      datTrangThai("Chưa nạp được thong-bao.js (kiểm tra file có nằm cùng thư mục profile.html không).", "loi");
      tbBat.disabled = true;
      return;
    }
    const c = TB.doc();
    const q = TB.quyen();
    const bat = c.bat && q === "granted";

    tbBat.checked = bat;
    tbBat.disabled = q === "unsupported";
    $("tb-chuoi").checked = c.chuoi;
    $("tb-thi").checked = c.thi;
    $("tb-lich").checked = c.lich;
    $("tb-gio-chuoi").value = c.gioChuoi;

    // chưa bật thì mờ và khóa các mục bên dưới
    tbChiTiet.classList.toggle("tat", !bat);
    tbChiTiet.querySelectorAll("input, button").forEach((el) => (el.disabled = !bat));

    if (q === "unsupported") datTrangThai("Trình duyệt này không hỗ trợ thông báo.", "loi");
    else if (q === "denied") datTrangThai("Thông báo đang bị chặn trong trình duyệt. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → cho phép Thông báo.", "loi");
    else if (bat) datTrangThai("Đang bật ✔", "ok");
    else datTrangThai("Đang tắt. Gạt công tắc để bật.", "");
  }

  if (TB) {
    // Công tắc tổng: bật thì xin quyền của trình duyệt (phải gọi ngay lúc bấm)
    tbBat.addEventListener("change", async () => {
      if (tbBat.checked) {
        const kq = await TB.bat();
        veThongBao();
        if (!kq.ok) datTrangThai(kq.loi, "loi");
      } else {
        TB.tat();
        veThongBao();
      }
    });

    // 3 công tắc con: lưu ngay
    [["tb-chuoi", "chuoi"], ["tb-thi", "thi"], ["tb-lich", "lich"]].forEach(([id, khoa]) => {
      $(id).addEventListener("change", () => {
        const c = TB.doc();
        c[khoa] = $(id).checked;
        TB.luu(c);
      });
    });

    // Giờ nhắc chuỗi
    $("tb-gio-chuoi").addEventListener("change", () => {
      const v = $("tb-gio-chuoi").value;
      if (!v) { $("tb-gio-chuoi").value = TB.doc().gioChuoi; return; } // để trống thì trả lại giờ cũ
      const c = TB.doc();
      c.gioChuoi = v;
      TB.luu(c);
    });

    // Gửi thử
    $("tb-thu").addEventListener("click", async () => {
      const ok = await TB.thu();
      datTrangThai(
        ok ? "Đã gửi thông báo thử, xem góc màn hình nhé." : "Chưa gửi được. Hãy kiểm tra quyền thông báo của trình duyệt.",
        ok ? "ok" : "loi",
      );
    });
  }
  veThongBao();

  // =========================================================
  // CHUYỂN TAB MOBILE 2.0 (Segmented Control)
  // =========================================================
  document.querySelectorAll(".pf-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      // Đổi active button
      document.querySelectorAll(".pf-tab-btn").forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      // Đổi hiển thị nội dung tab
      document.querySelectorAll(".pf-tab-pane").forEach((pane) => {
        pane.classList.toggle("active", pane.id === `tab-${target}`);
      });
    });
  });

  // =========================================================
  // HỆ THỐNG HUY HIỆU CHÍNH THỨC & KHUNG AVATAR (PC + MOBILE)
  // =========================================================
  const HUY_HIEU_TOA_DO = {
    "buoc-chan-dau-tien": { cx: 49.91, cy: 49.16, d: 55.49 },
    "chuyen-can": { cx: 49.95, cy: 49.7, d: 57.5 },
    "tich-tieu-thanh-dai": { cx: 49.97, cy: 49.55, d: 64.57 },
    "bach-phat-bach-trung": { cx: 49.98, cy: 49.87, d: 57.98 },
    "giai-nguyen": { cx: 49.96, cy: 49.98, d: 52.19 },
    "hoi-nguyen": { cx: 49.98, cy: 49.95, d: 60.84 },
    "trang-nguyen": { cx: 49.98, cy: 49.94, d: 56.91 },
  };

  const avatarBox = $("pf-avatar-box");
  const khungHuyHieu = $("pf-khung-huy-hieu");
  const trophyCountEl = $("pf-trophy-count");
  const trophyGridEl = $("pf-trophy-grid");
  const badgeToastEl = $("pf-badge-toast");
  const badgeToastTitleEl = $("pf-badge-toast-title");
  const badgeToastDescEl = $("pf-badge-toast-desc");
  const badgeToastCloseEl = $("pf-badge-toast-close");

  let dsHuyHieu = [];
  let dangLuuHuyHieu = false;
  let trophyFeedbackEl = null;

  function layThongTinKhung(badgeId) {
    if (!badgeId) return null;
    if (window.HUY_HIEU_KHUNG && typeof window.HUY_HIEU_KHUNG.layThongTinKhung === "function") {
      const info = window.HUY_HIEU_KHUNG.layThongTinKhung(badgeId);
      if (info) return info;
    }
    const td = HUY_HIEU_TOA_DO[badgeId];
    if (!td) return null;
    const item = dsHuyHieu.find((b) => b.id === badgeId);
    return {
      id: badgeId,
      ten: item ? item.ten : badgeId,
      anh: item && item.anh ? item.anh : `img/huy-hieu/${badgeId}.webp`,
      cx: td.cx,
      cy: td.cy,
      d: td.d,
    };
  }

  function dongBoNavbarHuyHieu(badgeId) {
    const cleanId = badgeId || "";
    localStorage.setItem("huyHieu", cleanId);
    if (typeof window.capNhatHuyHieuNavbar === "function") {
      window.capNhatHuyHieuNavbar(cleanId);
    } else if (
      window.HUY_HIEU_KHUNG &&
      typeof window.HUY_HIEU_KHUNG.capNhatAvatarNavbar === "function"
    ) {
      window.HUY_HIEU_KHUNG.capNhatAvatarNavbar(cleanId);
    }
  }

  function datPhanHoiHuyHieu(msg) {
    if (!trophyGridEl) return;
    if (!trophyFeedbackEl) {
      trophyFeedbackEl = document.createElement("p");
      trophyFeedbackEl.id = "pf-trophy-feedback";
      trophyFeedbackEl.className = "pf-trophy-feedback";
      trophyFeedbackEl.setAttribute("aria-live", "polite");
      trophyGridEl.after(trophyFeedbackEl);
    }
    trophyFeedbackEl.textContent = msg || "";
  }

  function apDungKhungHuyHieu(badgeId) {
    const cleanId = badgeId || "";
    const info = layThongTinKhung(cleanId);

    user.huy_hieu = info ? info.id : "";
    dongBoNavbarHuyHieu(user.huy_hieu);
    localStorage.removeItem(`huyHieuDangDeo_${userId}`);

    if (avatarBox && khungHuyHieu) {
      if (info) {
        khungHuyHieu.src = info.anh;
        khungHuyHieu.alt = info.ten || info.id;
        avatarBox.style.setProperty("--hh-cx", `${info.cx}%`);
        avatarBox.style.setProperty("--hh-cy", `${info.cy}%`);
        avatarBox.style.setProperty("--hh-d", `${info.d}%`);
        avatarBox.classList.add("co-khung");
      } else {
        khungHuyHieu.removeAttribute("src");
        khungHuyHieu.alt = "";
        avatarBox.style.removeProperty("--hh-cx");
        avatarBox.style.removeProperty("--hh-cy");
        avatarBox.style.removeProperty("--hh-d");
        avatarBox.classList.remove("co-khung");
      }
    }

    if (trophyGridEl) {
      trophyGridEl.querySelectorAll(".pf-trophy-item.unlocked").forEach((card) => {
        const khop = Boolean(user.huy_hieu) && card.dataset.badgeId === user.huy_hieu;
        card.classList.toggle("dang-deo", khop);
        card.setAttribute("aria-pressed", khop ? "true" : "false");
        const st = card.querySelector(".pf-trophy-status");
        if (st) st.textContent = khop ? "Đang đeo · Bấm để tháo" : "Đã đạt · Bấm để đeo";
      });
    }
  }

  function hienToastHuyHieuMoi(moiMo) {
    if (!badgeToastEl || !Array.isArray(moiMo) || moiMo.length === 0) return;
    const tongDiem = moiMo.reduce((sum, item) => sum + (Number(item.diem_thuong) || 0), 0);
    const dsTen = moiMo.map((item) => item.ten || item.id).join(", ");
    if (badgeToastTitleEl) {
      badgeToastTitleEl.textContent =
        moiMo.length === 1
          ? `Chúc mừng! Mở khóa huy hiệu "${moiMo[0].ten || moiMo[0].id}"`
          : `Chúc mừng! Mở khóa ${moiMo.length} huy hiệu mới`;
    }
    if (badgeToastDescEl) {
      badgeToastDescEl.textContent =
        `${dsTen} — Đã cộng +${tongDiem} điểm vào Điểm tích lũy và Bảng xếp hạng tháng!`;
    }
    badgeToastEl.classList.remove("hidden");
  }

  if (badgeToastCloseEl && badgeToastEl) {
    badgeToastCloseEl.addEventListener("click", () => {
      badgeToastEl.classList.add("hidden");
    });
  }

  async function chonDeoHuyHieu(badgeId) {
    if (dangLuuHuyHieu) return;
    dangLuuHuyHieu = true;
    datPhanHoiHuyHieu("");

    const nextId = user.huy_hieu === badgeId ? "" : badgeId;
    try {
      const res = await fetch(`${API}/api/huy-hieu/deo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(userId), huy_hieu: nextId }),
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message || "Không cập nhật được huy hiệu.");

      const equipped =
        typeof kq.huy_hieu === "string"
          ? kq.huy_hieu
          : (kq.data && (kq.data.huy_hieu ?? kq.data.dang_deo)) || "";
      dsHuyHieu.forEach((b) => {
        b.dang_deo = Boolean(equipped) && b.id === equipped;
      });
      apDungKhungHuyHieu(equipped);
    } catch (err) {
      datPhanHoiHuyHieu(err.message || "Không thể thay đổi khung huy hiệu lúc này.");
    } finally {
      dangLuuHuyHieu = false;
    }
  }

  function taoTheHuyHieu(badge) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pf-trophy-item ${badge.da_mo ? "unlocked co-khung" : "locked"}${badge.dang_deo ? " dang-deo" : ""}`;
    btn.dataset.badgeId = badge.id;

    const rewardText = `+${Number(badge.diem_thuong) || 0} điểm`;
    if (badge.da_mo) {
      btn.setAttribute("aria-pressed", badge.dang_deo ? "true" : "false");
      btn.title = `${badge.ten} — ${badge.mo_ta} (${rewardText}). ${badge.dang_deo ? "Bấm để tháo khung" : "Bấm để đeo lên avatar"}`;
    } else {
      btn.setAttribute("aria-disabled", "true");
      btn.title = `Chưa mở khóa: ${badge.mo_ta} (${rewardText})`;
    }

    const badgeBox = document.createElement("div");
    badgeBox.className = "pf-trophy-badge img-badge";

    const img = document.createElement("img");
    img.src = badge.anh || `img/huy-hieu/${badge.id}.webp`;
    img.alt = badge.ten || badge.id;
    img.loading = "lazy";
    img.decoding = "async";
    badgeBox.appendChild(img);

    if (!badge.da_mo) {
      const lockSpan = document.createElement("span");
      lockSpan.className = "pf-lock-icon";
      lockSpan.setAttribute("aria-hidden", "true");
      lockSpan.innerHTML = '<i class="fa-solid fa-lock"></i>';
      badgeBox.appendChild(lockSpan);
    }

    const nameEl = document.createElement("span");
    nameEl.className = "pf-trophy-name";
    nameEl.textContent = badge.ten || badge.id;

    const rewardEl = document.createElement("span");
    rewardEl.className = "pf-trophy-reward";
    rewardEl.textContent = rewardText;

    const condEl = document.createElement("p");
    condEl.className = "pf-trophy-cond";
    condEl.textContent = badge.mo_ta || "";

    const statusEl = document.createElement("small");
    statusEl.className = "pf-trophy-status";
    if (badge.da_mo) {
      statusEl.textContent = badge.dang_deo ? "Đang đeo · Bấm để tháo" : "Đã đạt · Bấm để đeo";
    } else {
      const mucTieu = Number(badge.muc_tieu) || 1;
      const tienDo = Number(badge.tien_do) || 0;
      statusEl.textContent = mucTieu > 1 ? `Tiến độ: ${tienDo}/${mucTieu}` : "Chưa đạt";
    }

    btn.append(badgeBox, nameEl, rewardEl, condEl, statusEl);
    if (badge.da_mo) {
      btn.addEventListener("click", () => chonDeoHuyHieu(badge.id));
    }
    return btn;
  }

  function veTuHuyHieu() {
    if (!trophyGridEl) return;
    const daMo = dsHuyHieu.filter((b) => b.da_mo).length;
    if (trophyCountEl) {
      trophyCountEl.textContent = `${daMo}/${dsHuyHieu.length} Đã mở`;
    }

    trophyGridEl.innerHTML = "";
    if (dsHuyHieu.length === 0) {
      const p = document.createElement("p");
      p.className = "pf-trophy-empty";
      p.textContent = "Chưa có dữ liệu huy hiệu.";
      trophyGridEl.appendChild(p);
      return;
    }

    dsHuyHieu.forEach((badge) => {
      trophyGridEl.appendChild(taoTheHuyHieu(badge));
    });
  }

  async function taiHuyHieu() {
    try {
      // Áp dụng trước từ thông tin user để tránh nhấp nháy khung avatar
      apDungKhungHuyHieu(user.huy_hieu || "");

      const kq = await huyHieuReq;
      if (!kq || !kq.success || !kq.data) throw new Error((kq && kq.message) || "Không tải được huy hiệu.");

      const data = kq.data;
      dsHuyHieu = Array.isArray(data.ds) ? data.ds : [];

      if (typeof data.score === "number" && data.score !== user.score) {
        user.score = data.score;
        $("pf-score").textContent = user.score;
        capNhatKhoa();
      }

      veTuHuyHieu();
      apDungKhungHuyHieu(data.dang_deo || "");
      hienToastHuyHieuMoi(data.moi_mo);
    } catch (err) {
      if (trophyGridEl) {
        trophyGridEl.innerHTML = "";
        const p = document.createElement("p");
        p.className = "pf-trophy-empty";
        p.textContent = "Không tải được danh sách huy hiệu. Kiểm tra lại kết nối server nhé!";
        trophyGridEl.appendChild(p);
      }
    }
  }

  // =========================================================
  // TƯƠNG TÁC DẢI 3 CHỈ SỐ (Điểm tích lũy / Chuỗi ngày / Bảo hộ)
  // =========================================================
  const statNen = $("pf-stat-nen");
  const statTieuDe = $("pf-stat-tieu-de");
  const statBody = $("pf-stat-body");
  const statTb = $("pf-stat-tb");
  const statActions = $("pf-stat-actions");
  const btnDongStat = $("btn-dong-stat");

  function dongStatModal() {
    if (!statNen) return;
    statNen.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function moStatModal(loai) {
    if (!statNen || !user) return;
    if (statTb) {
      statTb.textContent = "";
      statTb.className = "pf-stat-tb";
    }
    statBody.innerHTML = "";
    statActions.innerHTML = "";

    const score = Number(user.score || 0);
    const streak = Number(user.streak || 0);
    const baoHo = Number(user.the_bao_ho || 0);
    const toiDaBaoHo = 3;

    if (loai === "diem") {
      statTieuDe.innerHTML = '<img src="img/icon-diem.png" alt="Điểm" class="vn-ico vn-ico-lg" /> Điểm tích lũy';
      statBody.innerHTML = `
        <div class="pf-stat-hero">
          <img src="img/icon-diem.png" alt="Điểm" class="vn-ico vn-ico-2xl" />
          <div>
            <b>${score} điểm</b>
            <span>Dùng để mở khóa Sửa hồ sơ (${DIEM_MO_KHOA}đ), đổi Thẻ bảo hộ (100đ) và đua Bảng xếp hạng.</span>
          </div>
        </div>
        <p class="pf-stat-desc">Mẹo: Làm bài lần đầu được 100% điểm, hoàn thành Nhiệm vụ hôm nay và Điểm danh 7 ngày để tích điểm nhanh.</p>
      `;
      statActions.innerHTML = `
        <a href="subjects.html" class="btn">Làm bài kiếm điểm</a>
        <a href="qua.html" class="btn btn-phu">Vào Quà tặng</a>
      `;
    } else if (loai === "streak") {
      const matChuoi = streak <= 0;
      const icoSrc = matChuoi ? "img/icon-streak-mat.png" : "img/icon-streak.png";
      const buffPct = Math.min(streak * 0.1, 5).toFixed(1).replace(".", ",");
      statTieuDe.innerHTML = `<img src="${icoSrc}" alt="Streak" class="vn-ico vn-ico-lg" /> Chuỗi ngày học`;
      statBody.innerHTML = `
        <div class="pf-stat-hero ${matChuoi ? "is-lost" : ""}">
          <img src="${icoSrc}" alt="Streak" class="vn-ico vn-ico-2xl" />
          <div>
            <b>${streak} ngày liên tục</b>
            <span>${matChuoi
              ? "Bạn chưa có chuỗi (hoặc đã mất chuỗi). Làm 1 bài tập bất kỳ hôm nay để thắp lại ngọn lửa!"
              : `Đang cộng thưởng +${buffPct}% điểm mỗi lần nộp bài (tối đa +5%).`}</span>
          </div>
        </div>
        <p class="pf-stat-desc">Nếu lỡ quên 1 ngày mà trong túi có <b>Thẻ bảo hộ (${baoHo}/${toiDaBaoHo})</b>, hệ thống sẽ tự động dùng 1 thẻ để giữ nguyên chuỗi của bạn.</p>
      `;
      statActions.innerHTML = `
        <a href="subjects.html" class="btn">Làm bài giữ chuỗi</a>
        <button type="button" class="btn btn-phu" id="btn-stat-xem-baoho">Xem Thẻ bảo hộ</button>
      `;
      const xemBhBtn = $("btn-stat-xem-baoho");
      if (xemBhBtn) xemBhBtn.addEventListener("click", () => moStatModal("baoho"));
    } else if (loai === "baoho") {
      statTieuDe.innerHTML = '<img src="img/icon-bao-ho.png" alt="Bảo hộ" class="vn-ico vn-ico-lg" /> Thẻ bảo hộ streak';
      const coTheDoi = baoHo < toiDaBaoHo && score >= 100;
      statBody.innerHTML = `
        <div class="pf-stat-hero">
          <img src="img/icon-bao-ho.png" alt="Bảo hộ" class="vn-ico vn-ico-2xl" />
          <div>
            <b>${baoHo} / ${toiDaBaoHo} thẻ đang giữ</b>
            <span>Tự động kích hoạt khi bạn bỏ lỡ 1 ngày học để bảo toàn chuỗi ngày.</span>
          </div>
        </div>
        <p class="pf-stat-desc">Bạn có thể nhận miễn phí ở <b>Điểm danh ngày 4 / Vòng quay</b> hoặc đổi <b>100 điểm</b> lấy 1 thẻ ngay tại đây.</p>
      `;

      const doiBtn = document.createElement("button");
      doiBtn.type = "button";
      doiBtn.className = "btn";
      doiBtn.disabled = !coTheDoi;
      doiBtn.textContent = baoHo >= toiDaBaoHo
        ? `Đã đầy (${toiDaBaoHo}/${toiDaBaoHo})`
        : score < 100
          ? `Cần 100 điểm (đang có ${score})`
          : "Đổi 100 điểm lấy +1 Bảo hộ";
      doiBtn.addEventListener("click", async () => {
        if (doiBtn.disabled) return;
        doiBtn.disabled = true;
        doiBtn.textContent = "Đang đổi...";
        if (statTb) { statTb.textContent = ""; statTb.className = "pf-stat-tb"; }
        try {
          const resp = await fetchCoTimeout(`${API}/api/bao-ho/doi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: Number(userId) }),
          });
          const resJson = await resp.json();
          if (!resp.ok || !resJson.success) {
            throw new Error(resJson.message || "Không thể đổi thẻ bảo hộ!");
          }
          user.score = resJson.score;
          user.the_bao_ho = resJson.the_bao_ho;
          hienThongTin(user);
          capNhatKhoa();
          if (window.AmThanh && window.AmThanh.diemDanh) window.AmThanh.diemDanh(false);
          moStatModal("baoho");
          if (statTb) {
            statTb.textContent = resJson.message || "Đổi thành công!";
            statTb.className = "pf-stat-tb ok";
          }
        } catch (err) {
          if (window.AmThanh && window.AmThanh.loi) window.AmThanh.loi();
          if (statTb) {
            statTb.textContent = err.message || "Lỗi khi đổi thẻ!";
            statTb.className = "pf-stat-tb loi";
          }
          doiBtn.disabled = false;
          doiBtn.textContent = "Đổi 100 điểm lấy +1 Bảo hộ";
        }
      });

      const quaLink = document.createElement("a");
      quaLink.href = "qua.html";
      quaLink.className = "btn btn-phu";
      quaLink.textContent = "Mở Quà tặng";

      statActions.appendChild(doiBtn);
      statActions.appendChild(quaLink);
    }

    statNen.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  document.querySelectorAll(".pf-vip-btn[data-stat]").forEach((btn) => {
    btn.addEventListener("click", () => moStatModal(btn.dataset.stat));
  });
  if (btnDongStat) btnDongStat.addEventListener("click", dongStatModal);
  if (statNen) {
    statNen.addEventListener("click", (e) => {
      if (e.target === statNen) dongStatModal();
    });
  }

  // chạy lần đầu để áp trạng thái khóa theo điểm hiện có và tải tủ huy hiệu
  capNhatKhoa();
  taiHuyHieu();
});