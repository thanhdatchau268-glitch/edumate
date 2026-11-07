document.addEventListener("DOMContentLoaded", async () => {
  const API = "http://127.0.0.1:5000";
  const userId = localStorage.getItem("userId");

  // Vẽ công thức KaTeX (không có KaTeX thì bỏ qua)
  const veCongThuc = window.veCongThuc || function (el) {
    if (!el || !window.renderMathInElement) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) { console.warn("Không vẽ được công thức:", e); }
  };

  // Lấy thông tin bài từ địa chỉ trang
  const params = new URLSearchParams(location.search);
  const subject = params.get("subject");
  const chapter = params.get("chapter");
  const article = params.get("article");

  // Tên thư mục dùng gạch dưới (ngu-van -> ngu_van), giống bai-tap.js
  const folder = (subject || "").replace(/-/g, "_");

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

  // Nút "Về ..." quay đúng chương trong trang danh sách bài
  document.getElementById("quay-lai").href =
    `problems.html?subject=${subject}&chuong=${chapter}`;

  // Bảng giải thích 5 hạng ở cuối trang
  document.getElementById("chu-giai").innerHTML = HANG.map((h) => `
    <div class="cg" style="--c:${h.c}">
      <span class="hang-mini"><i class="fa-solid ${h.icon}"></i></span>
      <div><b>${h.ten}</b><small>${h.nhan} điểm</small></div>
    </div>`).join("");

  let henGio = null;
  function moLyThuyet() {
    nen.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (userId && !henGio) {
      henGio = setTimeout(() => {
        fetch(`${API}/api/nhiem-vu/su-kien`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: Number(userId), loai: "ly_thuyet" }),
        }).catch(() => { });
      }, 20000);
    }
  }
  function dongLyThuyet() {
    clearTimeout(henGio); henGio = null;
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
    return { url: o.url, ten: o.ten || "Mô phỏng", nguon: o.nguon || "" };
  }

  // ----- Tên chương + tên bài học (lấy từ tong-hop.json, lỗi thì bỏ qua) -----
  async function layTenBai() {
    try {
      const res = await fetch(`./file_de/${folder}/tong-hop.json`);
      const tong = JSON.parse(await res.text());
      const ch = (tong.chuong_list || []).find((c) => c.id_chuong === chapter);
      const bai = ch && (ch.danh_sach_bai || []).find((b) => `bai-${b.id}` === article);
      return { chuong: ch ? ch.ten_chuong : "", bai: bai ? bai.ten_bai : "" };
    } catch (e) {
      return { chuong: "", bai: "" };
    }
  }

  // ----- % điểm cao nhất của từng bài tập trong bài học này: { "1.1": 86, ... } -----
  async function layTienDo() {
    try {
      let url = `${API}/api/tien-do/${folder}?chuong=${chapter}&bai=${article}`;
      if (userId) url += `&user_id=${userId}`;
      const kq = await (await fetch(url)).json();
      return (kq.success && kq.data[chapter] && kq.data[chapter][article]) || {};
    } catch (e) {
      return {}; // không kết nối được server thì coi như chưa làm gì
    }
  }

  const doKho = (d) => (d <= 1 ? "Dễ" : d < 2 ? "Vừa" : "Khó");

  // ----- Đọc file JSON của bài -----
  try {
    const res = await fetch(`./file_de/${folder}/${chapter}/${article}.json`);
    if (!res.ok) throw new Error("Không tìm thấy bài này.");

    // đọc dạng chữ trước, file trống thì báo thân thiện thay vì lỗi JSON
    const text = await res.text();
    if (!text.trim()) throw new Error("Bài này chưa có nội dung, anh/chị quay lại sau nhé!");
    const data = JSON.parse(text);

    // Phần 1: lý thuyết
    noiDung.innerHTML = data.ly_thuyet || "<p>Bài này chưa có lý thuyết.</p>";
    veCongThuc(noiDung);
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

    const baiSapXep = [...dsBai].sort((a, b) => a.do_kho - b.do_kho);
    const [ten, tienDo] = await Promise.all([layTenBai(), layTienDo()]);

    // Tiêu đề trang
    const tong = baiSapXep.reduce((s, b) => s + (tienDo[b.id] || 0), 0);
    document.getElementById("bai-tieu-de").textContent = ten.bai || "Bài học";
    document.getElementById("bai-phu").textContent =
      `${ten.chuong ? ten.chuong + " · " : ""}${baiSapXep.length} bài tập · ${tong}/${baiSapXep.length * 100} điểm`;
    if (ten.bai) document.title = ten.bai + " - VnStarL";

    // Thẻ từng bài tập
    const ds = document.getElementById("ds-cau");
    ds.innerHTML = "";
    baiSapXep.forEach((bai) => {
      const p = tienDo[bai.id] || 0;            // % điểm cao nhất
      const h = hangCua(p);                     // hạng hiện tại (null = chưa làm)
      const len = hangTren(h);                  // hạng kế tiếp (null = đã cao nhất)
      const soCau = (bai.cau_hoi || []).length;
      const link = `form.html?subject=${subject}&chapter=${chapter}&article=${article}&q=${bai.id}`;

      const ghi = !h ? "Chưa làm. Đạt từ 1% để nhận hạng đầu tiên."
        : !len ? "Hoàn thành xuất sắc!"
          : `Còn ${len.min - p}% để lên ${len.ten}.`;
      const nut = !h ? `<a class="nut dac" href="${link}"><i class="fa-solid fa-play"></i> Làm bài</a>`
        : !len ? `<a class="nut" href="${link}"><i class="fa-solid fa-rotate-right"></i> Ôn lại</a>`
          : `<a class="nut" href="${link}"><i class="fa-solid fa-arrow-up"></i> Làm lại</a>`;

      const the = document.createElement("div");
      the.className = "bt-the";
      if (h) the.style.setProperty("--c", h.c);
      the.innerHTML = `
        <div class="hang-lon ${h ? h.id : "chua"}">
          <i class="fa-solid ${h ? h.icon : "fa-lock-open"}"></i>
        </div>
        <div class="giua">
          <h3>Bài ${bai.id}
            <span class="chip">${doKho(bai.do_kho)}</span>
            <span class="chip">${soCau} câu</span>
            ${h ? `<span class="hang-ten">${h.ten}</span>` : ""}
          </h3>
          <div class="tien-do"><i style="width:${p}%"></i></div>
          <div class="ghi">${ghi}</div>
        </div>
        <div class="bt-phai">
          <div class="phantram">${p}%<small>${p} / 100 điểm</small></div>
          ${nut}
        </div>`;
      ds.appendChild(the);
    });

    if (!userId) {
      document.getElementById("ds-ghi").textContent = "Đăng nhập để hạng và điểm của anh/chị được lưu lại nhé!";
    }
  } catch (err) {
    // Lỗi thì vẫn cho bấm nút, trong ô sẽ hiện thông báo lỗi
    noiDung.textContent = "Lỗi: " + err.message;
    nutMo.disabled = false;
    document.getElementById("ds-cau").innerHTML = `<p class="ghi">${err.message}</p>`;
  }
});