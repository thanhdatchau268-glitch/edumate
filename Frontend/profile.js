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

  // các mốc điểm (phải giống số bên app.py)
  const DIEM_MO_KHOA = 500;         // mở "Sửa hồ sơ"
  const DIEM_TAI_ANH = 500;         // mở "Tải ảnh avatar riêng"
  const DUNG_LUONG_ANH_TOI_DA = 15 * 1024 * 1024; // ảnh gốc tối đa 15MB (sẽ được thu nhỏ trước khi gửi)

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
  // NÚT BUFF +500 ĐIỂM (thử nghiệm, chỉ hiện khi chạy ở localhost)
  // =========================================================
  const nutBuff = $("btn-buff");
  const laMayLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  if (laMayLocal) nutBuff.classList.remove("hidden");

  nutBuff.addEventListener("click", async () => {
    nutBuff.disabled = true;
    try {
      const res = await fetch(`${API}/api/dev/buff-diem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(userId) }),
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      user.score = kq.score;   // điểm mới từ server
      hienThongTin(user);
      capNhatKhoa();           // đủ điểm thì mở khóa luôn, không cần tải lại trang
    } catch (err) {
      alert("Không buff được: " + err.message);
    } finally {
      nutBuff.disabled = false;
    }
  });

  // chạy lần đầu để áp trạng thái khóa theo điểm hiện có
  capNhatKhoa();
});