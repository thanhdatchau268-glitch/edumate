// pet-ho-so.js - thẻ "Sao La" trong hồ sơ: chọn giới tính giọng nói (3c) + chọn trang phục/skin (3b)
// Cần pet.js nạp trước (profile.html đã xếp đúng thứ tự).
//
// Màn hình chọn đồ CHỈ nạp ảnh _xem_truoc.webp của từng skin, không nạp sprite.
// Mọi thay đổi gửi lên server kèm token; server mới là nơi kiểm tra quyền sở hữu.
document.addEventListener("DOMContentLoaded", async () => {
  const the = document.getElementById("sl-the");
  if (!the || !window.SAOLA) return;

  const API = typeof API_SERVER === "string" ? API_SERVER : "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);
  const luoi = $("sl-skin-luoi");
  const ttGt = $("sl-gt-tt");
  const ttSkin = $("sl-skin-tt");
  const radios = [...the.querySelectorAll('input[name="sl-gt"]')];

  let tt = null; // trạng thái pet mới nhất từ server

  function bao(el, chu, loai) {
    el.textContent = chu || "";
    el.className = "sl-tt" + (loai ? " " + loai : "");
  }

  // Gọi API ghi dữ liệu (cần token). Ném Error(message) nếu thất bại.
  async function goi(duongDan, thanBody) {
    let token = null;
    try { token = localStorage.getItem("kbToken"); } catch (e) { /* bỏ qua */ }
    if (!token) throw new Error("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này.");
    let res;
    try {
      res = await fetch(API + duongDan, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(thanBody),
      });
    } catch (e) {
      throw new Error("Không kết nối được server. Bật app.py nhé!");
    }
    const kq = await res.json().catch(() => ({}));
    if (!kq.success) throw new Error(kq.message || "Có lỗi xảy ra, thử lại sau nhé.");
    return kq.data;
  }

  // ---------- giới tính ----------
  function veGioiTinh() {
    radios.forEach((r) => { r.checked = r.value === tt.gioi_tinh; });
  }

  radios.forEach((r) =>
    r.addEventListener("change", async () => {
      if (!r.checked || r.value === tt.gioi_tinh) return;
      const cu = tt.gioi_tinh;
      radios.forEach((x) => (x.disabled = true));
      bao(ttGt, "Đang lưu...");
      try {
        tt = await goi("/api/pet", { gioi_tinh: r.value });
        await SAOLA.ap(tt);
        bao(ttGt, "Đã đổi giọng của Sao La ✔", "ok");
        SAOLA.noi("chao"); // nghe thử ngay (đang có thao tác bấm nên trình duyệt cho phát tiếng)
      } catch (err) {
        tt.gioi_tinh = cu;
        bao(ttGt, err.message, "loi");
      } finally {
        radios.forEach((x) => (x.disabled = false));
        veGioiTinh();
      }
    }),
  );

  // ---------- trang phục ----------
  function veSkin() {
    luoi.textContent = "";
    tt.skin.forEach((s) => {
      const dangMac = s.id === tt.skin_dang_mac;
      const nut = document.createElement("button");
      nut.type = "button";
      nut.className = "sl-o" + (dangMac ? " dang-mac" : "") + (s.so_huu ? "" : " chua-co");
      nut.disabled = dangMac;

      const anh = document.createElement("img");
      anh.src = s.xem_truoc;       // chỉ ảnh xem trước 128x128
      anh.alt = "";
      anh.loading = "lazy";
      anh.decoding = "async";
      anh.width = 96; anh.height = 96;

      const ten = document.createElement("span");
      ten.className = "sl-ten";
      ten.textContent = s.ten;

      const nhan = document.createElement("span");
      nhan.className = "sl-nhan";
      nhan.textContent = dangMac ? "Đang mặc" : s.so_huu ? "Bấm để mặc" : "🔒 " + s.gia + " điểm";

      nut.append(anh, ten, nhan);
      nut.setAttribute("aria-label", s.ten + ", " + nhan.textContent);
      nut.addEventListener("click", () => macSkin(s, nut));
      luoi.appendChild(nut);
    });
  }

  async function macSkin(s, nut) {
    if (!s.so_huu) {
      bao(ttSkin, "Bạn chưa sở hữu trang phục \"" + s.ten + "\".", "loi");
      return;
    }
    luoi.querySelectorAll("button").forEach((b) => (b.disabled = true));
    bao(ttSkin, "Đang thay đồ...");
    try {
      tt = await goi("/api/pet/mac", { skin: s.id });
      const ok = await SAOLA.ap(tt);
      bao(ttSkin, ok ? "Đã mặc \"" + s.ten + "\" ✔" : "Đã lưu, nhưng chưa nạp được hình. Thử tải lại trang nhé.", ok ? "ok" : "loi");
    } catch (err) {
      bao(ttSkin, err.message, "loi");
    } finally {
      veSkin();
    }
  }

  // ---------- khởi động ----------
  bao(ttSkin, "Đang tải...");
  const ban = await SAOLA.sanSang;
  if (!ban) {
    bao(ttSkin, "Không tải được dữ liệu Sao La. Bật app.py nhé!", "loi");
    radios.forEach((x) => (x.disabled = true));
    return;
  }
  tt = ban;
  bao(ttSkin, "");
  veGioiTinh();
  veSkin();
});
