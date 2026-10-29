document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const API = "http://127.0.0.1:5000";
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
  // ----- Vẽ vòng quay -----
  function veVongQuay() {
    const banh = $("qua-banh");
    const n = dsMui.length;
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
      sp.textContent = NHAN_MUI[m.id
      ] || m.ten; // textContent: không chạy được code lạ
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
      el.textContent = `⚡ Đang x1,
            5 điểm khi làm bài: còn ${m
        }:${s
        }`;
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
    $("qua-bao-ho").textContent = `${tt.the_bao_ho
      }/${tt.toi_da_bao_ho
      }`;
    $("qua-luot").textContent = tt.luot_quay;
    localStorage.setItem("streak", tt.streak); // đồng bộ chuỗi ngày lên thanh menu

    $("qua-mo-ta").textContent = tt.tuan_dau
      ? "Điểm danh 7 ngày đầu để nhận quà. Bỏ lỡ một ngày cũng không mất tiến độ." : `Đã điểm danh ${tt.tong_ngay
      } ngày. Điểm danh đủ 7 ô để nhận thêm 1 lượt quay.`;

    const lich = $("qua-lich");
    lich.innerHTML = "";
    tt.lich.forEach((o) => {
      const d = document.createElement("div");
      d.className = "qua-o" + (o.da_nhan ? " da-nhan" : "");
      const b = document.createElement("b");
      b.textContent = `Ngày ${o.ngay
        }`;
      d.appendChild(b);
      d.appendChild(document.createTextNode(o.da_nhan ? "✔ " + o.ten : o.ten));
      lich.appendChild(d);
    });

    const nutDD = $("btn-diem-danh");
    nutDD.disabled = tt.da_diem_danh_hom_nay;
    nutDD.textContent = tt.da_diem_danh_hom_nay ? "✔ Hôm nay đã điểm danh" : "✅ Điểm danh hôm nay";
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
      baoLoi($("qua-dd-tb"),
        "🎉 Bạn nhận được: " + kq.nhan.join(", "),
        "#178a5a");
    } catch (err) {
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

      // đợi quay xong (4.2s) mới hiện kết quả
      setTimeout(() => {
        dangQuay = false;
        tt = Object.assign(tt, kq.trang_thai);
        hienTrangThai();
        const trung = kq.trung !== "hut";
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
      baoLoi($("qua-quay-tb"), err.message);
      hienTrangThai();
    }
  });
});