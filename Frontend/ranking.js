document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("ranking-list");
  if (!tbody) return; // không phải trang xếp hạng thì thôi

  // Hàm tạo 1 dòng trong bảng
  function themDong(cells) {
    const tr = document.createElement("tr");
    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text; // dùng textContent để tên người dùng không chạy được code lạ
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/api/ranking");
    const kq = await res.json();

    tbody.innerHTML = ""; // xóa dữ liệu cũ trước khi đổ mới

    if (!kq.data || kq.data.length === 0) {
      themDong(["", "Chưa có ai trên bảng xếp hạng", "", ""]);
      return;
    }

    // Điền 3 người đầu vào bục (người nào chưa có thì để trống + ảnh mặc định)
    [1, 2, 3].forEach((hang) => {
      const u = kq.data[hang - 1]; // hạng 1 là phần tử số 0
      const the = document.getElementById(`podium-${hang}`);
      if (!the) return;
      the.querySelector(".podium-name").textContent = u ? `${u.username} - ${u.score}` : "";
      datAvatar(the.querySelector(".avatar"), u ? u.avatar : ""); // hàm nằm trong script.js
    });

    // Mỗi người dùng = 1 dòng: ID, Bio, Username, Điểm
    kq.data.forEach((u) => {
      themDong([u.id, u.bio || "", u.username, u.score]);
    });
  } catch (err) {
    tbody.innerHTML = "";
    themDong(["", "Không kết nối được server. Bật app.py nhé!", "", ""]);
  }
});