document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");

  // Chưa đăng nhập thì đưa sang trang đăng nhập
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const API = "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);
  const TEN_MON = { toan: "Chuyên Toán", ly: "Chuyên Lý", hoa: "Chuyên Hóa" };

  // ----- Nút Đăng xuất: gắn sớm để server lỗi vẫn đăng xuất được -----
  $("btn-dang-xuat").addEventListener("click", () => {
    if (typeof dangXuat === "function") {
      dangXuat(); // hàm nằm trong script.js
    } else {
      ["isLoggedIn", "username", "userId", "streak", "monChuyen", "avatar"].forEach((k) =>
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
    $("pf-chuyen").textContent = TEN_MON[u.mon_chuyen] || "Không";
    datAvatar($("pf-avatar"), u.avatar); // hàm nằm trong script.js
  }

  let user = null; // nhớ thông tin hiện tại để điền sẵn vào form

  try {
    const res = await fetch(`${API}/api/users/${userId}`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    user = kq.data;
    hienThongTin(user);
    localStorage.setItem("avatar", user.avatar || ""); // đồng bộ lại cho thanh menu
  } catch (err) {
    // Chỉ thay phần thẻ hồ sơ, KHÔNG xoá nút Đăng xuất / Sửa hồ sơ
    document.querySelector(".profile-card").textContent = "Lỗi: " + err.message;
    return;
  }

  // =========================================================
  // ĐỔI AVATAR (chọn trong kho ảnh admin đã thêm)
  // =========================================================
  const nenAv = $("avatar-nen");
  const luoiAv = $("avatar-luoi");
  const ttAv = $("avatar-thong-bao");

  function moAvatar() {
    nenAv.classList.remove("hidden");
    document.body.style.overflow = "hidden";
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

  async function taiDanhSachAvatar() {
    ttAv.style.color = "#5b6b82";
    ttAv.textContent = "Đang tải...";
    luoiAv.innerHTML = "";
    try {
      const res = await fetch(`${API}/api/avatars`);
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      if (kq.data.length === 0) {
        ttAv.textContent = "Chưa có avatar nào, bạn quay lại sau nhé!";
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
      luoiAv.style.cssText =
        "display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-bottom:14px;";
    }
  }

  // Gửi avatar đã chọn lên server ('' = về ảnh mặc định)
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

      user.avatar = kq.avatar;
      localStorage.setItem("avatar", kq.avatar);
      datAvatar($("pf-avatar"), kq.avatar); // ảnh to trong hồ sơ
      document.querySelectorAll(".user-avatar").forEach((i) => datAvatar(i, kq.avatar)); // ảnh trên menu
      danhDauAvatar();
      dongAvatar();
    } catch (err) {
      ttAv.style.color = "#dc2626";
      ttAv.textContent = err.message;
    }
  }

  $("btn-doi-avatar").addEventListener("click", moAvatar);
  $("btn-dong-avatar").addEventListener("click", dongAvatar);
  $("btn-avatar-mac-dinh").addEventListener("click", () => chonAvatar(""));
  nenAv.addEventListener("click", (e) => {
    if (e.target === nenAv) dongAvatar();
  });

  // =========================================================
  // SỬA HỒ SƠ (giữ nguyên như cũ)
  // =========================================================
  const DIEM_MO_KHOA = 500; // phải giống số bên app.py
  const duDiem = user.score >= DIEM_MO_KHOA;
  const nutSua = $("btn-sua");

  if (!duDiem) {
    nutSua.classList.add("btn-khoa"); // làm nút xám
    nutSua.dataset.tip = `Bạn phải đủ ${DIEM_MO_KHOA} điểm mới mở khóa tính năng này`;
  }

  const nen = $("sua-nen");
  const form = $("form-sua");

  function moForm() {
    if (!duDiem) return;
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
});