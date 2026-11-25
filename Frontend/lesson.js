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
  const nutMoRong = document.getElementById("btn-mo-rong-ly-thuyet");
  const khoiNutBai = document.querySelector(".khoi-ly-thuyet");
  const nen = document.getElementById("ly-thuyet-nen");
  const nutDong = document.getElementById("btn-dong-ly-thuyet");
  const noiDung = document.getElementById("ly-thuyet-noi-dung");
  const noiDungInline = document.getElementById("ly-thuyet-inline");

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

  // Dải 5 cấp độ thành tích 2D phẳng (xếp từ cao xuống thấp)
  const chuGiaiEl = document.getElementById("chu-giai");
  if (chuGiaiEl && window.HANG) {
    chuGiaiEl.innerHTML = HANG.map((h) => `
      <div class="tier-item" style="--tc:${h.c}">
        <span class="tier-icon"><i class="fa-solid ${h.icon}"></i></span>
        <b class="tier-name">${h.ten}</b>
        <span class="tier-min">≥ ${h.min}%</span>
      </div>`).join("");
  }

  let henGio = null;
  let daGuiSuKienLyThuyet = false;
  function batDemGioLyThuyet() {
    if (!userId || daGuiSuKienLyThuyet || henGio) return;
    henGio = setTimeout(() => {
      daGuiSuKienLyThuyet = true;
      fetch(`${API}/api/nhiem-vu/su-kien`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(userId), loai: "ly_thuyet" }),
      }).catch(() => { });
    }, 20000);
  }
  function moLyThuyet() {
    nen.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    batDemGioLyThuyet();
  }
  function dongLyThuyet() {
    if (nen.classList.contains("hidden")) return;
    if (window.innerWidth <= 1024) {
      clearTimeout(henGio); henGio = null;
    }
    nen.classList.add("hidden");
    document.body.style.overflow = "";
  }
  nutMo.addEventListener("click", moLyThuyet);
  if (nutMoRong) nutMoRong.addEventListener("click", moLyThuyet);
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
    if (!text.trim()) throw new Error("Bài này chưa có nội dung, bạn quay lại sau nhé!");
    const data = JSON.parse(text);

    // Phần 1: lý thuyết (hiển thị cả trong modal lẫn nguyên cột phải trên Laptop)
    const htmlLyThuyet = data.ly_thuyet || "<p>Bài này chưa có lý thuyết.</p>";
    noiDung.innerHTML = htmlLyThuyet;
    veCongThuc(noiDung);
    if (noiDungInline) {
      noiDungInline.innerHTML = htmlLyThuyet;
      veCongThuc(noiDungInline);
    }
    nutMo.disabled = false;
    if (window.innerWidth >= 1025 && data.ly_thuyet) {
      batDemGioLyThuyet();
    }

    // Phần 1b: mô phỏng (nếu bài có)
    moPhong = chuanHoaMoPhong(data.mo_phong);
    if (moPhong) {
      tieuDeMoPhong.textContent = moPhong.ten;
      khungMoPhong.title = moPhong.ten;
      nguonMoPhong.textContent = moPhong.nguon ? "Nguồn: " + moPhong.nguon : "";
      nutMoPhong.classList.remove("hidden"); // hiện nút
      if (khoiNutBai) khoiNutBai.classList.remove("ls-khong-mo-phong");
    } else if (khoiNutBai) {
      khoiNutBai.classList.add("ls-khong-mo-phong");
    }

    // Phần 2: danh sách bài tập, xếp từ dễ đến khó
    // File mới có "bai_tap"; file cũ chỉ có "cau_hoi" (mỗi câu coi như 1 bài)
    const dsBai = Array.isArray(data.bai_tap)
      ? data.bai_tap
      : (data.cau_hoi || []).map((c) => ({ id: c.id, do_kho: c.do_kho, cau_hoi: [c] }));

    const baiSapXep = [...dsBai].sort((a, b) => a.do_kho - b.do_kho);
    const [ten, tienDo] = await Promise.all([layTenBai(), layTienDo()]);

    // Tiêu đề trang: CHỈ GHI TÊN BÀI, KHÔNG GHI CHƯƠNG theo yêu cầu
    const tong = baiSapXep.reduce((s, b) => s + (tienDo[b.id] || 0), 0);
    const diemMax = baiSapXep.length * 100;
    document.getElementById("bai-tieu-de").textContent = ten.bai || "Bài học";

    // Huy hiệu đã đạt được trong bài này (nếu có bài đã hoàn thành điểm)
    const huyHieuDat = baiSapXep
      .filter((b) => (tienDo[b.id] || 0) > 0)
      .map((b) => (window.iconHang ? window.iconHang(tienDo[b.id]) : ""))
      .filter(Boolean);

    const baiPhuEl = document.getElementById("bai-phu");
    baiPhuEl.innerHTML = `
      <span class="ls-sub-pill">${baiSapXep.length} bài tập · ${tong}/${diemMax} điểm</span>
      ${huyHieuDat.length ? `<span class="ls-sub-medals">${huyHieuDat.join("")}</span>` : ""}
    `;
    if (ten.bai) document.title = ten.bai + " - VnStarL";

    function layBaiTapDangDo() {
      const map = new Map();
      const subNorm = String(subject || "").replace(/_/g, "-");
      const chapStr = String(chapter || "");
      const artStr = String(article || "");
      function thuThem(raw, fbSub, uuTien) {
        if (!raw) return;
        const daLam = Number(raw.daLam || 0);
        const tongCau = Number(raw.tongCau || 0);
        if (!(daLam > 0 && daLam < tongCau)) return;
        let c = raw.chapter || "";
        let a = raw.article || "";
        let q = raw.q !== undefined && raw.q !== null ? String(raw.q) : "";
        let linkSub = "";
        try {
          const sp = new URL(raw.link || "", "http://local").searchParams;
          if (!c) c = sp.get("chapter") || "";
          if (!a) a = sp.get("article") || "";
          if (!q) q = sp.get("q") || "";
          linkSub = sp.get("subject") || "";
        } catch (e) {}
        const s = (raw.subject || fbSub || linkSub || "").replace(/_/g, "-");
        if (s !== subNorm || c !== chapStr || a !== artStr || !q) return;
        const old = map.get(q);
        if (!old || uuTien || (raw.capNhat || 0) > (old.capNhat || 0)) {
          map.set(q, { ...raw, daLam, tongCau });
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("baiDangLamBai_")) {
          try { thuThem(JSON.parse(localStorage.getItem(k)), "", true); } catch (e) {}
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && ((k.startsWith("baiDangLam_") && !k.startsWith("baiDangLamBai_")) || k === "baiDangLam")) {
          try {
            const fb = k.startsWith("baiDangLam_") ? k.replace("baiDangLam_", "") : "";
            thuThem(JSON.parse(localStorage.getItem(k)), fb, false);
          } catch (e) {}
        }
      }
      return map;
    }

    const mapDangDo = layBaiTapDangDo();

    // Thẻ từng bài tập (2D Flat Modern, hạn chế chữ tối đa)
    const ds = document.getElementById("ds-cau");
    ds.innerHTML = "";
    baiSapXep.forEach((bai) => {
      const p = tienDo[bai.id] || 0;            // % điểm cao nhất
      const h = hangCua(p);                     // hạng hiện tại (null = chưa làm)
      const len = hangTren(h);                  // hạng kế tiếp (null = đã cao nhất)
      const soCau = (bai.cau_hoi || []).length;
      const link = `form.html?subject=${subject}&chapter=${chapter}&article=${article}&q=${bai.id}`;
      const kieuKho = bai.do_kho <= 1 ? "de" : bai.do_kho < 2 ? "vua" : "kho";

      // Mục tiêu ngắn gọn - HẠN CHẾ CHỮ
      let mucTieuHtml = "";
      if (!h) {
        mucTieuHtml = `<span class="bt-tag bt-tag--chua">Chưa làm</span>`;
      } else if (!len) {
        mucTieuHtml = `<span class="bt-tag bt-tag--max"><i class="fa-solid fa-crown"></i> Đạt tối đa</span>`;
      } else {
        mucTieuHtml = `<span class="bt-tag bt-tag--next"><i class="fa-solid fa-arrow-up"></i> +${len.min - p}% lên ${len.ten}</span>`;
      }

      // Nút hành động
      let nutHtml = "";
      if (!h) {
        nutHtml = `<a class="bt-btn bt-btn--play" href="${link}"><i class="fa-solid fa-play"></i> <span>Làm bài</span></a>`;
      } else if (!len) {
        nutHtml = `<a class="bt-btn bt-btn--done" href="${link}"><i class="fa-solid fa-rotate-right"></i> <span>Ôn lại</span></a>`;
      } else {
        nutHtml = `<a class="bt-btn bt-btn--redo" href="${link}"><i class="fa-solid fa-arrow-up"></i> <span>Làm lại</span></a>`;
      }

      const dangDoItem = mapDangDo.get(String(bai.id));
      const dangDo = Boolean(dangDoItem);
      const pctDoDang = dangDo && dangDoItem.tongCau > 0
        ? Math.max(8, Math.min(95, Math.round((dangDoItem.daLam / dangDoItem.tongCau) * 100)))
        : 0;
      const barWidth = p > 0 ? p : pctDoDang;

      const the = document.createElement("div");
      the.className = "bt-card" + (h ? " bt-card--co-diem" : "") + (dangDo ? " bt-card--do-dang" : "");
      if (h) the.style.setProperty("--c", h.c);
      the.dataset.baiId = String(bai.id);
      the.dataset.pctServer = String(p);

      the.innerHTML = `
        <div class="bt-top">
          <div class="bt-info">
            ${dangDo ? `<span class="bt-dot-do" aria-hidden="true"></span>` : ""}
            <span class="bt-title">Bài ${bai.id}</span>
            <span class="bt-chip bt-chip--${kieuKho}">${doKho(bai.do_kho)}</span>
            <span class="bt-chip bt-chip--cau">${soCau} câu</span>
          </div>
          <div class="bt-score">
            ${h ? `<span class="bt-hang-badge"><i class="fa-solid ${h.icon}"></i> <b>${p}%</b></span>` : `<span class="bt-diem-chua">0%</span>`}
          </div>
        </div>

        <div class="bt-bar-wrap">
          <div class="bt-bar"><i style="width:${barWidth}%"></i></div>
        </div>

        <div class="bt-bot">
          <div class="bt-target">${mucTieuHtml}</div>
          <div class="bt-action">${nutHtml}</div>
        </div>`;
      ds.appendChild(the);
    });

    window.addEventListener("pageshow", () => {
      const moi = layBaiTapDangDo();
      ds.querySelectorAll(".bt-card[data-bai-id]").forEach((card) => {
        const id = card.dataset.baiId;
        const item = moi.get(String(id));
        const info = card.querySelector(".bt-info");
        const barFill = card.querySelector(".bt-bar i");
        const coDot = info ? info.querySelector(".bt-dot-do") : null;
        if (item) {
          card.classList.add("bt-card--do-dang");
          if (info && !coDot) {
            info.insertAdjacentHTML("afterbegin", `<span class="bt-dot-do" aria-hidden="true"></span>`);
          }
          if (barFill && card.dataset.pctServer === "0") {
            const w = item.tongCau > 0 ? Math.max(8, Math.min(95, Math.round((item.daLam / item.tongCau) * 100))) : 8;
            barFill.style.width = `${w}%`;
          }
        } else {
          card.classList.remove("bt-card--do-dang");
          if (coDot) coDot.remove();
          if (barFill && card.dataset.pctServer === "0") {
            barFill.style.width = "0%";
          }
        }
      });
    });

    if (!userId) {
      document.getElementById("ds-ghi").textContent = "Đăng nhập để hạng và điểm của bạn được lưu lại nhé!";
    }
  } catch (err) {
    // Lỗi thì vẫn cho bấm nút, trong ô sẽ hiện thông báo lỗi
    noiDung.textContent = "Lỗi: " + err.message;
    nutMo.disabled = false;
    document.getElementById("ds-cau").innerHTML = `<p class="ghi">${err.message}</p>`;
  }
});