document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");

  // Chưa đăng nhập thì đưa sang trang đăng nhập
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);
  const TEN_MON = { toan: "Chuyên Toán", ly: "Chuyên Lý", hoa: "Chuyên Hóa" };

  // ----- Nút Đăng xuất: gắn sớm để server lỗi vẫn đăng xuất được -----
  $("btn-dang-xuat").addEventListener("click", () => {
    if (typeof dangXuat === "function") {
      dangXuat(); // hàm nằm trong script.js
    } else {
      // phòng khi script.js chưa nạp được
      ["isLoggedIn", "username", "userId", "streak", "monChuyen"].forEach((k) =>
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
  }

  let user = null; // nhớ thông tin hiện tại để điền sẵn vào form

  try {
    const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    user = kq.data;
    hienThongTin(user);
  } catch (err) {
    // Chỉ thay phần thẻ hồ sơ, KHÔNG xoá nút Đăng xuất / Sửa hồ sơ
    document.querySelector(".profile-card").textContent = "Lỗi: " + err.message;
    return;
  }

  // ----- Khóa nút Sửa nếu chưa đủ điểm -----
  const DIEM_MO_KHOA = 500; // phải giống số bên app.py
  const duDiem = user.score >= DIEM_MO_KHOA;
  const nutSua = $("btn-sua");

  if (!duDiem) {
    nutSua.classList.add("btn-khoa"); // làm nút xám
    nutSua.dataset.tip = `Bạn phải đủ ${DIEM_MO_KHOA} điểm mới mở khóa tính năng này`;
  }

  // ----- Mở / đóng hộp sửa hồ sơ -----
  const nen = $("sua-nen");
  const form = $("form-sua");

  function moForm() {
    if (!duDiem) return;
    $("in-username").value = user.username; // điền sẵn giá trị cũ
    $("in-bio").value = user.bio || "";
    $("sua-thong-bao").textContent = "";
    nen.classList.remove("hidden"); // hiện nền mờ + hộp
    document.body.style.overflow = "hidden"; // khóa cuộn trang phía sau
    $("in-username").focus(); // đưa con trỏ vào ô tên luôn
  }

  function dongForm() {
    nen.classList.add("hidden");
    document.body.style.overflow = ""; // cho cuộn trang lại
  }

  $("btn-sua").addEventListener("click", moForm);
  $("btn-dong-sua").addEventListener("click", dongForm); // nút ✕
  $("btn-huy").addEventListener("click", dongForm); // nút Hủy

  // Bấm vùng mờ bên ngoài hộp thì đóng (bấm trong hộp thì không đóng)
  nen.addEventListener("click", (e) => {
    if (e.target === nen) dongForm();
  });

  // Bấm phím Esc cũng đóng được
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dongForm();
  });

  // ----- Bấm Lưu: gửi lên server -----
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // chặn trang tự tải lại
    const tb = $("sua-thong-bao");
    tb.style.color = "#5b6b82";
    tb.textContent = "Đang lưu...";

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("in-username").value,
          bio: $("in-bio").value,
        }),
      });
      const kq = await res.json();
      if (!kq.success) throw new Error(kq.message);

      // Cập nhật dữ liệu đang nhớ + hiển thị trên trang
      user.username = kq.username;
      user.bio = kq.bio;
      hienThongTin(user);

      // Cập nhật tên trên thanh menu và trong localStorage
      localStorage.setItem("username", kq.username);
      const tenMenu = document.querySelector("#user-profile .username");
      if (tenMenu) tenMenu.textContent = kq.username;

      dongForm(); // lưu xong thì đóng hộp
    } catch (err) {
      tb.style.color = "#dc2626";
      tb.textContent = err.message; // vd: "Tên không được để trống!"
    }
  });
});