const menuBtn = document.getElementById("menu-btn");
const nav = document.getElementById("nav");

// ---------- Avatar: dùng chung cho mọi trang ----------
const AVATAR_MAC_DINH = "img/avartar.webp";
const API_SERVER = "http://127.0.0.1:5000";

// tên lưu trong DB -> đường dẫn ảnh
//  - ''/null       : ảnh mặc định
//  - "up_xxx.webp" : ảnh người dùng tự tải lên (nằm ở server)
//  - tên khác      : ảnh admin bỏ trong Frontend/img/avatar/
function duongDanAvatar(ten) {
  if (!ten) return AVATAR_MAC_DINH;
  if (/^(https?:\/\/|data:|blob:|\/|img\/)/i.test(ten)) return ten;
  if (ten.startsWith("drv_")) return "https://lh3.googleusercontent.com/d/" + encodeURIComponent(ten.slice(4)) + "=w256";
  if (ten.startsWith("up_")) return API_SERVER + "/uploads/avatars/" + encodeURIComponent(ten);
  return "img/avatar/" + encodeURIComponent(ten);
}

// gán avatar cho 1 thẻ <img>; ảnh bị xóa/lỗi thì tự quay về ảnh mặc định
function datAvatar(img, ten) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null; // tránh lặp vô hạn nếu ảnh mặc định cũng lỗi
    img.src = AVATAR_MAC_DINH;
  };
  img.src = duongDanAvatar(ten);
}

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

// ---------- Khung huy hiệu dùng chung cho Navbar & mọi trang ----------
const _hangDoiKhung = [];
let _dangTaiKhung = false;

function damBaoKhungHuyHieu(cb) {
  if (!document.querySelector('link[href^="huy-hieu-khung.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "huy-hieu-khung.css";
    document.head.appendChild(link);
  }
  if (window.HUY_HIEU_KHUNG) {
    if (typeof cb === "function") cb(window.HUY_HIEU_KHUNG);
    return;
  }
  if (typeof cb === "function") _hangDoiKhung.push(cb);
  if (_dangTaiKhung) return;
  _dangTaiKhung = true;

  const existing = document.querySelector('script[src^="huy-hieu-khung.js"]');
  const script = existing || document.createElement("script");
  script.addEventListener("load", () => {
    while (_hangDoiKhung.length > 0) {
      const fn = _hangDoiKhung.shift();
      if (typeof fn === "function" && window.HUY_HIEU_KHUNG) {
        fn(window.HUY_HIEU_KHUNG);
      }
    }
  });
  if (!existing) {
    script.src = "huy-hieu-khung.js";
    document.head.appendChild(script);
  }
}

window.capNhatHuyHieuNavbar = function capNhatHuyHieuNavbar(huyHieuId) {
  if (huyHieuId !== undefined) {
    localStorage.setItem("huyHieu", huyHieuId || "");
  }
  const id = huyHieuId !== undefined ? (huyHieuId || "") : (localStorage.getItem("huyHieu") || "");
  damBaoKhungHuyHieu((hh) => {
    const moiNhat = huyHieuId !== undefined ? id : (localStorage.getItem("huyHieu") || "");
    hh.capNhatAvatarNavbar(moiNhat, { luuStorage: false });
  });
};

async function dongBoHuyHieuTuServer(userProfile) {
  const uid = localStorage.getItem("userId");
  if (!uid) return;
  try {
    const res = await fetch(`${API_SERVER}/api/users/${encodeURIComponent(uid)}`);
    if (!res.ok) return;
    const kq = await res.json();
    const u = kq && kq.success ? (kq.data || kq.user) : null;
    if (!u) return;

    const hhMoi = u.huy_hieu || "";
    const avMoi = u.avatar || "";
    const hhCu = localStorage.getItem("huyHieu") || "";
    const avCu = localStorage.getItem("avatar") || "";

    if (typeof u.streak === "number") {
      localStorage.setItem("streak", u.streak);
      if (window.capNhatIconStreak) window.capNhatIconStreak(u.streak);
    }

    if (avMoi !== avCu) {
      localStorage.setItem("avatar", avMoi);
      const avEl = userProfile ? userProfile.querySelector(".user-avatar") : null;
      if (avEl) datAvatar(avEl, avMoi);
    }
    if (hhMoi !== hhCu) {
      localStorage.setItem("huyHieu", hhMoi);
      window.capNhatHuyHieuNavbar(hhMoi);
    }
  } catch (e) {
    // Im lặng nếu server tạm thời không phản hồi
  }
}

window.capNhatIconStreak = function capNhatIconStreak(soStreak) {
  const n = Number(soStreak);
  const val = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const mat = val <= 0;
  document.querySelectorAll(".streak-box").forEach((box) => {
    box.classList.toggle("streak-lost", mat);
    const img = box.querySelector("img");
    if (img) {
      img.src = mat ? "img/icon-streak-mat.png" : "img/icon-streak.png";
      img.alt = mat ? "Mất chuỗi" : "Streak";
    }
    const sp = box.querySelector("span");
    if (sp) sp.textContent = val;
  });
};

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

    // hiện số ngày học liên tiếp + đổi icon lửa xám nếu mất chuỗi
    window.capNhatIconStreak(localStorage.getItem("streak") || "0");

    // hiện avatar đã chọn trên thanh menu + khung huy hiệu nếu có
    datAvatar(
      userProfile.querySelector(".user-avatar"),
      localStorage.getItem("avatar") || "",
    );
    window.capNhatHuyHieuNavbar();
    dongBoHuyHieuTuServer(userProfile);
  }

  // đã đăng nhập thì "Giới thiệu" được thay bằng "Cá nhân hóa"
  const linkGt = document.getElementById("link-gioi-thieu");
  if (linkGt) {
    const icon = linkGt.querySelector("i");
    const chu = linkGt.querySelector(".nav-chu");
    if (icon) icon.className = "fa-solid fa-graduation-cap"; // đổi icon nhà -> mũ tốt nghiệp
    if (chu) chu.textContent = "Cá nhân hóa";
    linkGt.title = "Cá nhân hóa";
    linkGt.setAttribute("aria-label", "Cá nhân hóa");
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
  ["isLoggedIn", "username", "userId", "streak", "monChuyen", "avatar", "huyHieu"].forEach((k) =>
    localStorage.removeItem(k),
  );
  localStorage.removeItem("kbToken");
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
      localStorage.setItem("avatar", data.user.avatar || "");
      localStorage.setItem("huyHieu", data.user.huy_hieu || "");
      if (data.token) localStorage.setItem("kbToken", data.token);

      // Chỉ lần đăng nhập đầu tiên mới định hướng môn chuyên, các lần sau vào thẳng trang chính
      if (data.user.can_khao_sat) {
        window.location.href = "dinh-huong.html";
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
function themMucKhoaBang() {
  const ds = document.getElementById("nav");
  if (!ds) return;
  if (!ds.querySelector('a[href="khoa-bang.html"]')) {
    const li = document.createElement("li");
    li.id = "nav-khoa-bang";
    li.innerHTML = '<a href="khoa-bang.html" id="link-khoa-bang" title="Khoa cử" aria-label="Khoa cử"><i class="fa-solid fa-scroll"></i><span class="nav-chu">Khoa cử</span></a>';
    const xh = ds.querySelector("#nav-xep-hang");
    xh ? xh.after(li) : ds.appendChild(li);
  }
  if (!ds.querySelector('a[href="vuon-saoladou.html"]')) {
    const liVuon = document.createElement("li");
    liVuon.id = "nav-vuon-saoladou";
    liVuon.innerHTML = '<a href="vuon-saoladou.html" id="link-vuon-saoladou" title="Vườn Saoladou" aria-label="Vườn Saoladou"><i class="fa-solid fa-seedling"></i><span class="nav-chu">Vườn Saoladou</span></a>';
    const xh = ds.querySelector("#nav-xep-hang");
    xh ? xh.after(liVuon) : ds.appendChild(liVuon);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", themMucKhoaBang);
else themMucKhoaBang();
// Tự đánh dấu mục menu của trang hiện tại
function danhDauMenu() {
  const trang = location.pathname.split("/").pop() || "index.html";
  // các trang con thuộc nhóm "Bài tập"
  const NHOM = {
    "problems.html": "subjects.html",
    "lesson.html": "subjects.html",
    "form.html": "subjects.html",
    "so-loi.html": "subjects.html",
  };
  const dich = NHOM[trang] || trang;
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === dich);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", danhDauMenu);
} else {
  danhDauMenu();
}
// Nạp hệ thống thông báo (nhắc chuỗi, cuộc thi, lịch học) trên mọi trang khi đã đăng nhập
if (
  localStorage.getItem("isLoggedIn") === "true" &&
  !window.THONGBAO &&
  !document.querySelector('script[src^="thong-bao.js"]')
) {
  const s = document.createElement("script");
  s.src = "thong-bao.js?v=1";
  document.head.appendChild(s);
}

// Nạp Sao La (pet) trên mọi trang khi đã đăng nhập (trừ đăng nhập / đăng ký)
if (
  localStorage.getItem("isLoggedIn") === "true" &&
  !window.SAOLA &&
  !/(login|register)\.html$/i.test(location.pathname) &&
  !document.querySelector('script[src^="pet.js"]')
) {
  const s = document.createElement("script");
  s.src = "pet.js?v=7";
  document.head.appendChild(s);
}

// Nạp hệ thống hiệu ứng âm thanh Web Audio toàn trang
if (
  !window.AmThanh &&
  !document.querySelector('script[src^="am-thanh.js"]')
) {
  const sa = document.createElement("script");
  sa.src = "am-thanh.js?v=3";
  document.head.appendChild(sa);
}

// Nạp Điểm danh hàng ngày (daily-checkin) trên mọi trang khi đã đăng nhập (trừ login, register, qua.html)
if (
  localStorage.getItem("isLoggedIn") === "true" &&
  !window.DAILY_CHECKIN &&
  !/(login|register|qua)\.html$/i.test(location.pathname) &&
  !document.querySelector('script[src^="daily-checkin.js"]')
) {
  const s = document.createElement("script");
  s.src = "daily-checkin.js?v=5";
  document.head.appendChild(s);
}

// Nạp Notched Bottom Tab Bar (Component 041) trên mobile cho mọi trang (bao gồm login/register)
if (!document.querySelector('script[src^="notched-nav.js"]')) {
  const sn = document.createElement("script");
  sn.src = "notched-nav.js?v=5";
  document.head.appendChild(sn);
}

// Cảnh báo bảo mật hệ thống khi mở F12 DevTools
try {
  console.log("%cDỪNG LẠI!", "color:#dc2626;font-size:36px;font-weight:900;-webkit-text-stroke:1px black;");
  console.log("%cĐây là tính năng trình duyệt dành cho các nhà phát triển. Mọi hành vi cố tình can thiệp hoặc gian lận thi cử tại VnStarL sẽ bị ghi nhận và khóa tài khoản.", "font-size:14px;color:#475569;font-weight:600;line-height:1.5;");
} catch (e) { }

// Tối ưu tải ảnh theo nhu cầu (chỉ tải khi sắp hiển thị + giải mã bất đồng bộ trên điện thoại)
(function () {
  function toiUuAnh(img) {
    if (!img || img.tagName !== "IMG") return;
    if (!img.hasAttribute("decoding")) img.decoding = "async";
    if (img.hasAttribute("data-eager") || img.closest("#header")) return;
    if (!img.hasAttribute("loading")) img.loading = "lazy";
  }

  function quetAnh(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.tagName === "IMG") toiUuAnh(root);
    root.querySelectorAll("img").forEach(toiUuAnh);
  }

  function khoiTaoLazy() {
    quetAnh(document);
    if (!window.MutationObserver || !document.body) return;
    const obs = new MutationObserver((ds) => {
      for (let i = 0; i < ds.length; i++) {
        const added = ds[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) quetAnh(added[j]);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", khoiTaoLazy);
  } else {
    khoiTaoLazy();
  }
})();
