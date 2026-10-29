document.addEventListener("DOMContentLoaded", async () => {
  // Lấy thông tin bài từ địa chỉ trang
  const params = new URLSearchParams(location.search);
  const subject = params.get("subject");
  const chapter = params.get("chapter");
  const article = params.get("article");

  // Tên thư mục dùng gạch dưới (ngu-van -> ngu_van), giống bai-tap.js
  const folder = (subject || "").replace("-", "_");

  // ----- Các phần tử: lý thuyết -----
  const nutMo = document.getElementById("btn-ly-thuyet");
  const nen = document.getElementById("ly-thuyet-nen");
  const nutDong = document.getElementById("btn-dong-ly-thuyet");
  const noiDung = document.getElementById("ly-thuyet-noi-dung");

  // ----- Các phần tử: mô phỏng -----
  const nutMoPhong = document.getElementById("btn-mo-phong");
  const nenMoPhong = document.getElementById("mo-phong-nen");
  const nutDongMoPhong = document.getElementById("btn-dong-mo-phong");
  const khungMoPhong = document.getElementById("mo-phong-khung");
  const tieuDeMoPhong = document.getElementById("mo-phong-tieu-de");
  const nguonMoPhong = document.getElementById("mo-phong-nguon");

  let moPhong = null; // thông tin mô phỏng của bài (null = bài không có)

  // ----- Mở / đóng ô lý thuyết -----
  function moLyThuyet() {
    nen.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // khoá cuộn trang phía sau
  }

  function dongLyThuyet() {
    nen.classList.add("hidden");
    document.body.style.overflow = "";
  }

  nutMo.addEventListener("click", moLyThuyet);
  nutDong.addEventListener("click", dongLyThuyet);
  nen.addEventListener("click", (e) => {
    if (e.target === nen) dongLyThuyet();
  });

  // ----- Mở / đóng ô mô phỏng -----
  function moMoPhong() {
    if (!moPhong) return;
    // Chỉ nạp iframe ở lần mở đầu tiên (tiết kiệm mạng). Các lần sau giữ nguyên
    // nên học sinh đóng/mở lại vẫn còn nguyên những gì đã chỉnh trong mô phỏng.
    if (!khungMoPhong.src || khungMoPhong.src === "about:blank") {
      khungMoPhong.src = moPhong.url;
    }
    nenMoPhong.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function dongMoPhong() {
    nenMoPhong.classList.add("hidden");
    document.body.style.overflow = "";
  }

  nutMoPhong.addEventListener("click", moMoPhong);
  nutDongMoPhong.addEventListener("click", dongMoPhong);
  nenMoPhong.addEventListener("click", (e) => {
    if (e.target === nenMoPhong) dongMoPhong();
  });

  // Phím Esc đóng được cả 2 ô
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dongLyThuyet();
      dongMoPhong();
    }
  });

  // "mo_phong" trong JSON có thể là chuỗi link, hoặc object { url, ten, nguon }
  // Chỉ chấp nhận link https để tránh nhúng nhầm nội dung lạ
  function chuanHoaMoPhong(mp) {
    if (!mp) return null;
    const o = typeof mp === "string" ? { url: mp } : mp;
    if (!/^https:\/\//i.test(o.url || "")) return null;
    return {
      url: o.url,
      ten: o.ten || "Mô phỏng",
      nguon: o.nguon || "",
    };
  }

  // ----- Đọc file JSON của bài -----
  try {
    const res = await fetch(`./file_de/${folder}/${chapter}/${article}.json`);
    if (!res.ok) throw new Error("Không tìm thấy bài này.");

    // đọc dạng chữ trước, file trống thì báo thân thiện thay vì lỗi JSON
    const text = await res.text();
    if (!text.trim()) throw new Error("Bài này chưa có nội dung, bạn quay lại sau nhé!");
    const data = JSON.parse(text);

    // Phần 1: lý thuyết
    noiDung.innerHTML = data.ly_thuyet || "<p>Bài này chưa có lý thuyết.</p>";
    nutMo.disabled = false;

    // Phần 1b: mô phỏng (nếu bài có)
    moPhong = chuanHoaMoPhong(data.mo_phong);
    if (moPhong) {
      tieuDeMoPhong.textContent = moPhong.ten;
      khungMoPhong.title = moPhong.ten;
      nguonMoPhong.textContent = moPhong.nguon ? "Nguồn: " + moPhong.nguon : "";
      nutMoPhong.classList.remove("hidden"); // hiện nút
    }

    // Phần 2: danh sách bài tập, xếp từ dễ đến khó
    // File mới có "bai_tap"; file cũ chỉ có "cau_hoi" (mỗi câu coi như 1 bài)
    const dsBai = Array.isArray(data.bai_tap)
      ? data.bai_tap
      : (data.cau_hoi || []).map((c) => ({ id: c.id, do_kho: c.do_kho, cau_hoi: [c] }));

    const ds = document.getElementById("ds-cau");
    const baiSapXep = [...dsBai].sort((a, b) => a.do_kho - b.do_kho);

    baiSapXep.forEach((bai) => {
      const a = document.createElement("a");
      a.className = "btn";
      // Hiện "Bài 1.1 (3 câu)"
      const soCau = (bai.cau_hoi || []).length;
      a.textContent = `Bài ${bai.id} (${soCau} câu)`;
      a.href = `form.html?subject=${subject}&chapter=${chapter}&article=${article}&q=${bai.id}`;
      ds.appendChild(a);
    });
  } catch (err) {
    // Lỗi thì vẫn cho bấm nút, trong ô sẽ hiện thông báo lỗi
    noiDung.textContent = "Lỗi: " + err.message;
    nutMo.disabled = false;
  }
});