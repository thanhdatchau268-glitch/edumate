document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("contest-list");
  if (!tbody) return; // không phải trang cuộc thi thì thôi

  const API = "http://127.0.0.1:5000";

  // Chữ hiện ra cho từng trạng thái (khớp với server trả về)
  const NHAN = {
    "sap-dien-ra": "Sắp diễn ra",
    "dang-dien-ra": "Đang diễn ra",
    "da-ket-thuc": "Đã kết thúc",
  };

  // Các phần tử của ô cuộc thi (hiện lên khi bấm vào 1 dòng)
  const nen = document.getElementById("contest-nen");           // lớp nền mờ
  const nutDong = document.getElementById("btn-dong-contest");  // nút ✕
  const noiDung = document.getElementById("contest-noi-dung");  // chỗ đổ nội dung từng tab
  const cacTab = document.querySelectorAll(".contest-tab");     // 3 nút tab

  let cuocThiDangMo = null; // cuộc thi đang được mở trong ô
  let luotMo = 0;           // đếm lượt bấm tab, để tab nào bấm sau cùng thì thắng

  // ---------- Hàm nhỏ dùng chung ----------

  // Hiện 1 dòng thông báo chiếm hết 3 cột của bảng
  function baoDong(chu) {
    tbody.innerHTML = `<tr><td colspan="3" class="contest-empty"></td></tr>`;
    tbody.querySelector("td").textContent = chu;
  }

  // Hiện 1 câu thông báo trong ô (khi chưa có gì để xem)
  function baoTrongO(chu) {
    noiDung.innerHTML = `<p class="contest-empty"></p>`;
    noiDung.querySelector("p").textContent = chu;
  }

  // Đổi "2026-11-01 19:00" thành "19:00 - 01/11/2026"
  function dinhDangGio(chuoi) {
    const [ngay, gio] = chuoi.split(" ");
    const [nam, thang, ngayThang] = ngay.split("-");
    return `${gio} - ${ngayThang}/${thang}/${nam}`;
  }

  // Số phút làm bài = giờ kết thúc trừ giờ bắt đầu
  function tinhSoPhut(batDau, ketThuc) {
    const a = new Date(batDau.replace(" ", "T"));
    const b = new Date(ketThuc.replace(" ", "T"));
    return Math.round((b - a) / 60000);
  }

  // ---------- Tab 1: Thông tin ----------
  function veThongTin(c) {
    // phần khung viết sẵn, chữ của người dùng sẽ gán bằng textContent ở dưới cho an toàn
    noiDung.innerHTML = `
      <h3 class="contest-ten"></h3>
      <span class="contest-badge ${NHAN[c.trang_thai] ? c.trang_thai : ""}"></span>
      <p><b>Bắt đầu:</b> <span class="i-bat-dau"></span></p>
      <p><b>Kết thúc:</b> <span class="i-ket-thuc"></span></p>
      <p><b>Thời lượng:</b> <span class="i-thoi-luong"></span></p>
      <h4>Nội dung cuộc thi</h4>
      <p class="contest-noidung-text"></p>`;

    noiDung.querySelector(".contest-ten").textContent = c.ten;
    noiDung.querySelector(".contest-badge").textContent = NHAN[c.trang_thai] || "";
    noiDung.querySelector(".i-bat-dau").textContent = dinhDangGio(c.bat_dau);
    noiDung.querySelector(".i-ket-thuc").textContent = dinhDangGio(c.ket_thuc);
    noiDung.querySelector(".i-thoi-luong").textContent =
      `${tinhSoPhut(c.bat_dau, c.ket_thuc)} phút`;
    // noi_dung là chữ admin viết, vd: "Từ Chương 1 - Bài 01 đến Chương 3 - Bài 02"
    noiDung.querySelector(".contest-noidung-text").textContent =
      c.noi_dung || "Chưa có mô tả nội dung cuộc thi.";
  }

  // ---------- Tab 2: Bài tập (bảng giống trang danh sách bài tập) ----------
  async function veBaiTap(c, luot) {
    // Chưa tới giờ thì không cho xem đề
    if (c.trang_thai === "sap-dien-ra") {
      baoTrongO("Đề thi sẽ mở khi cuộc thi bắt đầu, bạn quay lại sau nhé!");
      return;
    }

    try {
      // Đề nằm ở file_de/contest/<id>/<id>.json (cùng đường dẫn với nút làm bài)
      const res = await fetch(`./file_de/contest/${c.id}/${c.id}.json`);
      if (!res.ok) throw new Error("Chưa có đề cho cuộc thi này.");
      const text = await res.text();
      if (!text.trim()) throw new Error("Chưa có đề cho cuộc thi này.");
      const data = JSON.parse(text);

      if (luot !== luotMo) return; // đã bấm sang tab khác thì bỏ kết quả này

      const dsBai = data.bai_tap || [];
      if (dsBai.length === 0) throw new Error("Cuộc thi này chưa có bài nào.");

      noiDung.innerHTML = `
        <table class="problem-table">
          <thead><tr><th>ID</th><th>Bài</th><th>Điểm</th></tr></thead>
          <tbody></tbody>
        </table>`;
      const body = noiDung.querySelector("tbody");

      dsBai.forEach((bai) => {
        // Tổng điểm của bài = cộng điểm các câu (câu nào không ghi thì tính 10)
        const tongDiem = (bai.cau_hoi || []).reduce((s, q) => s + (q.diem ?? 10), 0);
        const ten = bai.ten ? `Bài ${bai.id}: ${bai.ten}` : `Bài ${bai.id}`;

        const tr = document.createElement("tr");
        const tdId = document.createElement("td");
        const tdTen = document.createElement("td");
        const tdDiem = document.createElement("td");
        tdId.textContent = bai.id;
        tdDiem.textContent = tongDiem;

        if (c.trang_thai === "dang-dien-ra") {
          // Đang diễn ra: bấm vào để làm bài
          const a = document.createElement("a");
          a.href = `form.html?subject=contest&chapter=${c.id}&article=${c.id}&q=${bai.id}`;
          a.textContent = ten;
          tdTen.appendChild(a);
        } else {
          // Đã kết thúc: chỉ xem tên, không làm được nữa
          tdTen.textContent = ten;
        }
        tr.append(tdId, tdTen, tdDiem);
        body.appendChild(tr);
      });
    } catch (err) {
      if (luot === luotMo) baoTrongO(err.message);
    }
  }

  // ---------- Tab 3: Bảng xếp hạng (giống trang xếp hạng: bục + bảng) ----------
  async function veXepHang(c, luot) {
    try {
      const res = await fetch(`${API}/api/contests/${c.id}/ranking`);
      const kq = await res.json();
      if (luot !== luotMo) return;

      if (!kq.data || kq.data.length === 0) {
        baoTrongO("Chưa có ai nộp bài trong cuộc thi này.");
        return;
      }

      // Khung viết sẵn (dùng lại class của trang xếp hạng), tên + điểm gán sau
      noiDung.innerHTML = `
        <div class="leaderboard-container">
          <div class="podium-section">
            <div class="podium-card silver">
              <img class="avatar" src="img/avartar.webp" alt="Top 2">
              <span class="podium-name"></span><div class="step">2</div>
            </div>
            <div class="podium-card gold">
              <img class="avatar" src="img/avartar.webp" alt="Top 1">
              <span class="podium-name"></span><div class="step">1</div>
            </div>
            <div class="podium-card bronze">
              <img class="avatar" src="img/avartar.webp" alt="Top 3">
              <span class="podium-name"></span><div class="step">3</div>
            </div>
          </div>
          <div class="table-section">
            <table class="user-table">
              <thead><tr><th>Hạng</th><th>Username</th><th>Điểm</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>`;

      // Điền 3 người đầu lên bục (thứ tự trên màn hình: hạng 2, hạng 1, hạng 3)
      const ten = noiDung.querySelectorAll(".podium-name");
      const anh = noiDung.querySelectorAll(".podium-card .avatar");
      [1, 0, 2].forEach((viTri, i) => {
        const u = kq.data[viTri];
        ten[i].textContent = u ? `${u.username} - ${u.diem}` : "";
        datAvatar(anh[i], u ? u.avatar : ""); // hàm nằm trong script.js
      });

      // Mỗi người = 1 dòng: Hạng, Username, Điểm
      const body = noiDung.querySelector("tbody");
      kq.data.forEach((u, i) => {
        const tr = document.createElement("tr");
        [i + 1, u.username, u.diem].forEach((chu) => {
          const td = document.createElement("td");
          td.textContent = chu; // textContent để tên không chạy được code lạ
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    } catch (err) {
      if (luot === luotMo) baoTrongO("Không kết nối được server. Bật app.py nhé!");
    }
  }

  // ---------- Chuyển tab ----------
  function chonTab(tenTab) {
    const c = cuocThiDangMo;
    if (!c) return;
    const luot = ++luotMo;

    // tô màu nút tab đang chọn
    cacTab.forEach((t) => t.classList.toggle("active", t.dataset.tab === tenTab));

    if (tenTab === "thong-tin") veThongTin(c);
    else if (tenTab === "bai-tap") veBaiTap(c, luot);
    else veXepHang(c, luot);
  }

  cacTab.forEach((t) => t.addEventListener("click", () => chonTab(t.dataset.tab)));

  // ---------- Mở / đóng ô cuộc thi ----------
  function moCuocThi(c) {
    cuocThiDangMo = c;
    nen.classList.remove("hidden");          // hiện nền mờ + ô
    document.body.style.overflow = "hidden"; // khóa cuộn trang phía sau
    chonTab("thong-tin");                    // luôn mở tab đầu tiên
  }

  function dongCuocThi() {
    nen.classList.add("hidden");
    document.body.style.overflow = "";
    cuocThiDangMo = null;
  }

  nutDong.addEventListener("click", dongCuocThi);
  // Bấm vùng mờ bên ngoài thì đóng (bấm trong ô thì không đóng)
  nen.addEventListener("click", (e) => {
    if (e.target === nen) dongCuocThi();
  });
  // Bấm phím Esc cũng đóng được
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dongCuocThi();
  });

  // ---------- Đổ danh sách cuộc thi vào bảng ----------
  try {
    const res = await fetch(`${API}/api/contests`);
    const kq = await res.json();

    if (!kq.data || kq.data.length === 0) {
      baoDong("Chưa có cuộc thi nào, bạn quay lại sau nhé!");
      return;
    }

    tbody.innerHTML = ""; // xóa dữ liệu cũ trước khi đổ mới

    kq.data.forEach((c) => {
      const tr = document.createElement("tr");
      tr.className = "co-the-bam"; // để con trỏ đổi thành bàn tay
      tr.tabIndex = 0;             // cho phép bấm phím Tab rồi Enter

      // Cột 1: ID
      const tdId = document.createElement("td");
      tdId.textContent = c.id;

      // Cột 2: tên cuộc thi + nhãn trạng thái
      const tdTen = document.createElement("td");
      const ten = document.createElement("span");
      ten.textContent = c.ten;
      const nhan = document.createElement("span");
      nhan.className = `contest-badge ${c.trang_thai}`;
      nhan.textContent = NHAN[c.trang_thai] || "";
      tdTen.append(ten, nhan);

      // Cột 3: thời gian làm bài
      const tdGio = document.createElement("td");
      tdGio.className = "contest-time";
      tdGio.innerHTML = `<span></span><small></small>`;
      tdGio.querySelector("span").textContent =
        `${dinhDangGio(c.bat_dau)} → ${dinhDangGio(c.ket_thuc)}`;
      tdGio.querySelector("small").textContent =
        `Thời lượng ${tinhSoPhut(c.bat_dau, c.ket_thuc)} phút`;

      tr.append(tdId, tdTen, tdGio);

      // Bấm vào dòng (hoặc nhấn Enter) thì mở ô cuộc thi
      tr.addEventListener("click", () => moCuocThi(c));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter") moCuocThi(c);
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    baoDong("Không kết nối được server. Bật app.py nhé!");
  }
});