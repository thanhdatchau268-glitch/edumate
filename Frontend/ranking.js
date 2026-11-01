document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("ranking-list");
  if (!tbody) return; // không phải trang xếp hạng thì thôi

  const API = "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);
  const userId = localStorage.getItem("userId");
  const monCuaToi = localStorage.getItem("monChuyen") || "";

  let cauHinh = null; // { bang:[{id,ten,mon}], ky:[{id,ten}], thang }
  let bang = null;    // id bảng đang xem
  let ky = "tong";    // id kỳ đang xem
  let luot = 0;       // chống kết quả cũ ghi đè kết quả mới khi bấm nhanh

  function baoDong(chu) {
    tbody.innerHTML = `<tr><td colspan="4" class="rk-trong"></td></tr>`;
    tbody.querySelector("td").textContent = chu;
  }

  // Xóa sạch bục để đổi bảng không còn dư người của bảng trước
  function xoaBuc() {
    [1, 2, 3].forEach((h) => {
      const the = $(`podium-${h}`);
      if (!the) return;
      the.querySelector(".podium-name").textContent = "";
      datAvatar(the.querySelector(".avatar"), ""); // hàm nằm trong script.js
    });
  }

  function veTab() {
    $("rk-bang").innerHTML = "";
    cauHinh.bang.forEach((b) => {
      const n = document.createElement("button");
      n.type = "button";
      n.className = "rk-chip" + (b.id === bang ? " on" : "");
      n.textContent = b.ten;
      n.setAttribute("role", "tab");
      n.setAttribute("aria-selected", b.id === bang);
      n.addEventListener("click", () => { bang = b.id; veTab(); taiBang(); });
      $("rk-bang").appendChild(n);
    });

    $("rk-ky").innerHTML = "";
    cauHinh.ky.forEach((k) => {
      const n = document.createElement("button");
      n.type = "button";
      n.className = k.id === ky ? "on" : "";
      n.textContent = k.ten;
      n.setAttribute("role", "tab");
      n.setAttribute("aria-selected", k.id === ky);
      n.addEventListener("click", () => { ky = k.id; veTab(); taiBang(); });
      $("rk-ky").appendChild(n);
    });

    // Dòng ghi chú cho biết đang xem bảng nào
    const tenBang = cauHinh.bang.find((b) => b.id === bang).ten;
    const [nam, thang] = cauHinh.thang.split("-");
    $("rk-ghi").textContent = ky === "thang"
      ? `${tenBang} · điểm tích lũy trong tháng ${Number(thang)}/${nam}, sang tháng mới tính lại từ đầu.`
      : `${tenBang} · tổng điểm từ trước đến nay.`;
  }

  async function taiBang() {
    const l = ++luot;
    xoaBuc();
    baoDong("Đang tải...");
    try {
      const res = await fetch(`${API}/api/ranking?bang=${encodeURIComponent(bang)}&ky=${encodeURIComponent(ky)}`);
      const kq = await res.json();
      if (l !== luot) return; // đã bấm sang bảng khác
      if (!kq.success) throw new Error(kq.message);

      if (kq.data.length === 0) {
        baoDong("Chưa có ai trên bảng xếp hạng này.");
        return;
      }

      // 3 người đầu lên bục
      [1, 2, 3].forEach((hang) => {
        const u = kq.data[hang - 1];
        const the = $(`podium-${hang}`);
        if (!the || !u) return;
        the.querySelector(".podium-name").textContent = `${u.username} - ${u.score}`;
        datAvatar(the.querySelector(".avatar"), u.avatar);
      });

      // Mỗi người = 1 dòng: Hạng, Username, Giới thiệu, Điểm
      tbody.innerHTML = "";
      kq.data.forEach((u, i) => {
        const tr = document.createElement("tr");
        if (userId && String(u.id) === userId) tr.className = "rk-toi";
        [i + 1, u.username, u.bio || "", u.score].forEach((chu) => {
          const td = document.createElement("td");
          td.textContent = chu; // textContent để tên không chạy được code lạ
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (err) {
      if (l !== luot) return;
      baoDong("Không kết nối được server. Bật app.py nhé!");
    }
  }

  // ----- Khởi động: lấy danh sách bảng từ server -----
  try {
    const res = await fetch(`${API}/api/ranking/cau-hinh`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    cauHinh = kq;
  } catch (err) {
    baoDong("Không kết nối được server. Bật app.py nhé!");
    return;
  }

  // Mặc định mở bảng đúng môn của bạn (không thi chuyên -> bảng Không chuyên)
  const cuaToi = cauHinh.bang.find((b) => b.mon === monCuaToi);
  bang = (cuaToi || cauHinh.bang[0]).id;
  veTab();
  taiBang();
});