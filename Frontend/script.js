const menuBtn = document.getElementById("menu-btn");
const nav = document.getElementById("nav");

// Bật/tắt menu trên điện thoại
if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });

  // Đánh dấu mục đang chọn
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.querySelectorAll("a").forEach((x) => x.classList.remove("active"));
      link.classList.add("active");
      nav.classList.remove("open");
    });
  });
}

// 1. Hàm hiển thị giao diện Đã đăng nhập
function showLoggedInUI() {
  const authButtons = document.getElementById("auth-buttons");
  const userProfile = document.getElementById("user-profile");

  if (authButtons && userProfile) {
    authButtons.classList.add("hidden");
    userProfile.classList.remove("hidden");

    // hiện tên đã lưu lúc đăng nhập
    const nameEl = document.querySelector(".username");
    if (nameEl) nameEl.textContent = localStorage.getItem("username") || "Bạn";

    // hiện số ngày học liên tiếp
    const streakEl = document.querySelector(".streak-box span");
    if (streakEl) streakEl.textContent = localStorage.getItem("streak") || "0";
  }

  // đã đăng nhập thì "Giới thiệu" được thay bằng "Học tập cá nhân hoá"
  const linkGt = document.getElementById("link-gioi-thieu");
  if (linkGt) {
    linkGt.textContent = "Học tập cá nhân hoá";
    linkGt.href = "personal.html";
  }


  // bấm vào avatar hoặc tên thì mở trang hồ sơ
  document.querySelectorAll(".user-avatar, .username").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "profile.html"));
  });
}

// Đăng xuất = xoá thông tin đăng nhập rồi về trang chủ
function dangXuat() {
  ["isLoggedIn", "username", "userId", "streak", "monChuyen"].forEach((k) =>
    localStorage.removeItem(k),
  );
  // replace để không quay lại được trang cũ bằng nút Back
  window.location.replace("index.html");
}

// 2. Xử lý Submit Đăng nhập (Kết nối Backend Flask)
async function handleLoginSubmit(event) {
  event.preventDefault(); // Chặn reload trang

  const email = document.getElementById("login-email").value;
  const mk = document.getElementById("login-password").value;

  try {
    const response = await fetch("http://127.0.0.1:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mk }),
    });

    // Server lỗi 500 trả về HTML, không phải JSON
    if (response.status >= 500) {
      alert("Server bị lỗi (" + response.status + "). Xem chữ đỏ trong terminal chạy app.py nhé!");
      return;
    }

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("streak", data.user.streak);
      localStorage.setItem("monChuyen", data.user.mon_chuyen || "");

      // Chỉ lần đăng nhập đầu tiên mới khảo sát, các lần sau vào thẳng trang chính
      if (data.user.can_khao_sat) {
        window.location.href = "khaosat.html";
      } else {
        window.location.href = "personal.html";
      }
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error(error);
    alert("Lỗi đăng nhập: " + error.message);
  }
}
// 3. Xử lý Submit Đăng ký (Kết nối Backend Flask)
async function handleRegisterSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("reg-username").value;
  const email = document.getElementById("reg-email").value;
  const mk = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm-password").value;

  if (mk !== confirmPassword) {
    alert("Mật khẩu nhập lại không khớp!");
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:5000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, mk }),
    });
    const data = await response.json();

    if (data.success) {
      alert(data.message);
      window.location.href = "login.html"; // Đăng ký xong chuyển hướng sang trang đăng nhập
    } else {
      alert(data.message);
    }
  } catch (error) {
    alert("Không thể kết nối tới server Python!");
  }
}

// 4. Kiểm tra trạng thái khi tải trang
function checkLoginStatus() {
  const path = window.location.pathname;

  if (path.endsWith("login.html") || path.endsWith("register.html")) {
    return;
  }

  if (localStorage.getItem("isLoggedIn") === "true") {
    showLoggedInUI();
  }
}

// Chạy kiểm tra khi giao diện DOM đã sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkLoginStatus);
} else {
  checkLoginStatus();
}

// Lấy các phần tử Modal (nếu có)
const loginModal = document.querySelector("#login-modal");
const btnLogin = document.querySelector(".btn-login");
const btnClose = document.querySelector(".btn-close");

function toggleModal() {
  if (loginModal) {
    loginModal.classList.toggle("hidden");
  }
}

if (btnLogin) btnLogin.addEventListener("click", toggleModal);
if (btnClose) btnClose.addEventListener("click", toggleModal);