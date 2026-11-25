document.addEventListener("DOMContentLoaded", async () => {
  // Chốt chặn: nếu file này lỡ bị nạp 2 lần trong HTML thì lần thứ 2 dừng ngay,
  // không vẽ lặp bài tập (nguyên nhân gây lỗi "bài hiện 2 lần" trước đây).
  if (window.__baiTapDaChay) {
    console.warn("bai-tap.js bị nạp nhiều lần - bỏ qua lần chạy thừa. Hãy kiểm tra thẻ <script> trong HTML.");
    return;
  }
  window.__baiTapDaChay = true;

  const API = "http://127.0.0.1:5000";

  // Âm thanh: gọi động window.AmThanh để hỗ trợ cả trường hợp am-thanh.js được nạp sau qua script.js
  const goiAm = (ten, ...args) => {
    const a = window.AmThanh;
    return a && typeof a[ten] === "function" ? a[ten](...args) : undefined;
  };
  const Am = {
    chon: () => goiAm("chon"),
    go: () => goiAm("go"),
    xong: () => goiAm("xong"),
    dung: (c) => goiAm("dung", c),
    sai: () => goiAm("sai"),
    nop: () => goiAm("nop"),
    hoanThanh: (p) => goiAm("hoanThanh", p),
    ruong: () => (window.AmThanh && typeof window.AmThanh.ruong === "function" ? window.AmThanh.ruong() : goiAm("hoanThanh", 100)),
    thuong: (l) => goiAm("thuong", l),
    loi: () => goiAm("loi"),
    dangBat: () => !!(window.AmThanh && typeof window.AmThanh.dangBat === "function" && window.AmThanh.dangBat()),
    batTat: () => {
      const a = window.AmThanh;
      return a && typeof a.batTat === "function" ? a.batTat() : false;
    },
  };
  const giamChuyenDong = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lấy các tham số từ địa chỉ trang
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get("subject") || "toan").replace(/-/g, "_"); // ngu-van -> ngu_van
  const chapter = params.get("chapter");
  const article = params.get("article");
  const q = params.get("q"); // bài muốn làm, ví dụ "1.1" (không có thì hiện cả bài học)
  const userId = localStorage.getItem("userId");

  const problemList = document.getElementById("problem-list");
  const chuongDs = document.getElementById("chuong-ds");
  const plTong = document.getElementById("pl-tong");
  const chipsEl = document.getElementById("chuong-chips");   // thanh chọn chương vuốt ngang (chỉ hiện trên điện thoại)
  const tenChapEl = document.getElementById("pl-chap-ten");  // tên đầy đủ của chương đang chọn (chỉ hiện trên điện thoại)

  // Chống chạy code lạ khi đưa chữ vào innerHTML
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Vẽ công thức KaTeX trong 1 phần tử (không có KaTeX thì bỏ qua, không báo lỗi)
  function veCongThuc(el) {
    if (!el || !window.renderMathInElement) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) {
      console.warn("Không vẽ được công thức:", e);
    }
  }

  // Đọc danh sách bài đang làm dở từ localStorage (hỗ trợ cả khóa mới per-bài & khóa legacy theo môn)
  function layDanhSachBaiDoLocal() {
    const map = new Map();
    function them(raw, fbSub, uuTien) {
      if (!raw) return;
      const daLam = Number(raw.daLam || 0);
      const tongCau = Number(raw.tongCau || 0);
      if (!(daLam > 0 && daLam < tongCau)) return;
      let chap = raw.chapter || "";
      let art = raw.article || "";
      let qId = raw.q !== undefined && raw.q !== null ? String(raw.q) : "";
      let linkSub = "";
      try {
        const sp = new URL(raw.link || "", "http://local").searchParams;
        if (!chap) chap = sp.get("chapter") || "";
        if (!art) art = sp.get("article") || "";
        if (!qId) qId = sp.get("q") || "";
        linkSub = sp.get("subject") || "";
      } catch (e) {}
      const sub = (raw.subject || fbSub || linkSub || "").replace(/_/g, "-");
      if (!sub || sub === "contest") return;
      const dedupKey = (chap || art || qId)
        ? `${sub}|${chap}|${art}|${qId}`
        : `${sub}|${raw.link || raw.ten || ""}`;
      const old = map.get(dedupKey);
      if (!old || uuTien || (raw.capNhat || 0) > (old.capNhat || 0)) {
        map.set(dedupKey, {
          ...raw,
          subject: sub,
          chapter: String(chap),
          article: String(art),
          q: String(qId),
          daLam,
          tongCau
        });
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("baiDangLamBai_")) {
        try { them(JSON.parse(localStorage.getItem(k)), "", true); } catch (e) {}
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && ((k.startsWith("baiDangLam_") && !k.startsWith("baiDangLamBai_")) || k === "baiDangLam")) {
        try {
          const fb = k.startsWith("baiDangLam_") ? k.replace("baiDangLam_", "") : "";
          them(JSON.parse(localStorage.getItem(k)), fb, false);
        } catch (e) {}
      }
    }
    return Array.from(map.values());
  }

  function demBaiDangDoTheoBai(subInput, chapterId, articleId) {
    const subNorm = String(subInput || "").replace(/_/g, "-");
    const chapStr = String(chapterId || "");
    const artStr = String(articleId || "");
    const all = layDanhSachBaiDoLocal().filter(
      (it) => it.subject === subNorm && it.chapter === chapStr && it.article === artStr
    );
    const seen = new Set();
    all.forEach((it) => seen.add(it.q || "__whole__"));
    return seen.size;
  }

  // Đọc file JSON an toàn: file trống / không tìm thấy thì báo thân thiện
  async function docJson(url, loiKhongThay) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(loiKhongThay);
    const text = await response.text();
    if (!text.trim()) throw new Error("Bài này chưa có nội dung, bạn quay lại sau nhé!");
    return JSON.parse(text);
  }

  // =========================================================================
  // 1. TRANG PROBLEMS.HTML: chọn chương -> thấy các bài học (kèm điểm, hạng)
  // =========================================================================

  // Lấy điểm cao nhất của mọi bài tập trong môn. null = không kết nối được server
  // Dạng: { "chuong-1": { "bai-01": { "1.1": 86, "1.2": 0 } } }
  let ruongDaMo = new Set();
  async function layTienDo() {
    try {
      const url = `${API}/api/tien-do/${subject}` + (userId ? `?user_id=${encodeURIComponent(userId)}` : "");
      const res = await fetch(url);
      const kq = await res.json();
      if (!kq.success) return null;
      ruongDaMo = new Set(Array.isArray(kq.ruong_da_mo) ? kq.ruong_da_mo : []);
      return kq.data;
    } catch (e) {
      return null;
    }
  }

  // Sắp id bài tập theo số: 1.2 đứng trước 1.10
  const soSanhId = (a, b) => {
    const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
    return (x[0] - y[0]) || ((x[1] || 0) - (y[1] || 0));
  };
  const tong = (ds) => Object.values(ds).reduce((a, b) => a + b, 0);

  if (problemList && chuongDs) {
    try {
      const [data, tienDo] = await Promise.all([
        docJson(`./file_de/${subject}/tong-hop.json`, "Không tìm thấy danh sách bài của môn này."),
        layTienDo(),
      ]);
      const dsChuong = data.chuong_list || [];

      const tenMon = document.getElementById("ten-mon");
      if (tenMon && data.mon) tenMon.textContent = "Bài tập " + data.mon;

      // lưu thầm số lượng từng hạng để sau này làm danh hiệu
      if (tienDo && window.luuThongKeHang) luuThongKeHang(subject, tienDo);

      // các bài tập (id -> %) của 1 bài học
      const dsBaiTap = (chuong, bai) => (((tienDo || {})[chuong.id_chuong] || {})[`bai-${bai.id}`]) || {};

      // tổng điểm / điểm tối đa của cả chương
      const thongKeChuong = (chuong) => {
        let dd = 0, mx = 0;
        (chuong.danh_sach_bai || []).forEach((bai) => {
          const ds = dsBaiTap(chuong, bai);
          dd += tong(ds);
          mx += Object.keys(ds).length * 100;
        });
        return { dd, mx, pt: mx ? Math.round((dd / mx) * 100) : 0 };
      };

      // số bắt đầu của mỗi chương (đánh số nối tiếp qua các chương: 01, 02, 03...)
      const soBatDau = dsChuong.map((_, i) =>
        dsChuong.slice(0, i).reduce((t, c) => t + (c.danh_sach_bai || []).length, 0)
      );

      // chương đang chọn: lấy từ &chuong=... trên địa chỉ (quay lại từ trang bài học), không có thì chương đầu
      let chon = Math.max(0, dsChuong.findIndex((c) => c.id_chuong === params.get("chuong")));

      // ----- Cột chương bên phải -----
      function veChuong() {
        chuongDs.innerHTML = dsChuong.map((c, i) => {
          const [nhan, ...conLai] = String(c.ten_chuong).split(":");
          const k = thongKeChuong(c);
          return `<button type="button" class="pl-chap${i === chon ? " on" : ""}" data-i="${i}">
            <b>${esc(nhan.trim())}<span>${tienDo ? `${k.dd}/${k.mx} điểm` : ""}</span></b>
            <small>${esc(conLai.join(":").trim())}</small>
            <div class="mini-bar"><i style="width:${k.pt}%"></i></div>
          </button>`;
        }).join("");
      }

      // ----- Thanh chương vuốt ngang (điện thoại): mỗi chương 1 viên, hiện tên ngắn + % hoàn thành -----
      function veChip() {
        if (!chipsEl) return;
        chipsEl.innerHTML = dsChuong.map((c, i) => {
          const nhan = String(c.ten_chuong).split(":")[0].trim();
          const k = thongKeChuong(c);
          return `<button type="button" class="pl-chip${i === chon ? " on" : ""}" data-i="${i}" aria-pressed="${i === chon}">
            <b>${esc(nhan)}</b><span>${tienDo ? k.pt + "%" : "—"}</span><i style="width:${k.pt}%"></i>
          </button>`;
        }).join("");
        cuonToiChip(false);
      }

      // cuộn thanh chương để viên đang chọn nằm giữa (không cuộn cả trang)
      function cuonToiChip(muot) {
        const on = chipsEl && chipsEl.querySelector(".on");
        if (!on) return;
        chipsEl.scrollTo({ left: on.offsetLeft - (chipsEl.clientWidth - on.offsetWidth) / 2, behavior: muot ? "smooth" : "auto" });
      }

      let toastTimer = null;
      function hienThongBaoRuong(noiDung, loai = "ok") {
        let toast = document.getElementById("pl-toast");
        if (!toast) {
          toast = document.createElement("div");
          toast.id = "pl-toast";
          toast.className = "pl-toast";
          toast.setAttribute("role", "status");
          toast.setAttribute("aria-live", "polite");
          toast.innerHTML = `<span class="pl-toast-msg"></span><button type="button" class="pl-toast-close" aria-label="Đóng">&times;</button>`;
          toast.querySelector(".pl-toast-close").addEventListener("click", () => {
            toast.classList.remove("hien");
          });
          document.body.appendChild(toast);
        }
        toast.classList.remove("ok", "warn", "hien");
        toast.classList.add(loai === "warn" ? "warn" : "ok");
        toast.querySelector(".pl-toast-msg").textContent = noiDung;
        void toast.offsetWidth;
        toast.classList.add("hien");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("hien"), 4800);
      }

      // ----- Khối tổng điểm + danh sách bài học của chương đang chọn -----
      function veBai() {
        const c = dsChuong[chon];
        if (!c) { problemList.innerHTML = `<p class="pl-rong">Môn này chưa có chương nào.</p>`; return; }

        const nhanChuong = String(c.ten_chuong || "").split(":")[0].trim() || c.id_chuong;

        // tên đầy đủ của chương (điện thoại không đủ chỗ hiện trên viên chọn chương)
        if (tenChapEl) {
          const [nhanC, ...conC] = String(c.ten_chuong).split(":");
          tenChapEl.innerHTML = `<small>${esc(nhanC.trim())}</small><b>${esc(conC.join(":").trim() || nhanC.trim())}</b>`;
        }
        // tổng điểm của chương
        const k = thongKeChuong(c);
        if (tienDo) {
          const daMo = ruongDaMo.has(c.id_chuong);
          const sanSangMo = Boolean(k.mx > 0 && k.dd >= k.mx && !daMo);
          const loiKhuyen = daMo
            ? "Tuyệt vời! Bạn đã chinh phục 100% chương này và mở khóa kho báu!"
            : sanSangMo
              ? "Xuất sắc! Bạn đã đạt 100% chương này — bấm vào rương để mở quà bí mật!"
              : k.mx === 0
                ? "Chương này hiện chưa có bài tập chấm điểm."
                : k.pt >= 80
                  ? "Gần chạm đích rồi! Hoàn thành nốt 100% để mở khóa rương kho báu bí mật!"
                  : "Hoàn thành 100% điểm của chương này để mở khóa rương kho báu bí mật!";
          const chestTitle = daMo
            ? "Đã mở rương chương này"
            : sanSangMo
              ? "Bấm để mở rương thưởng chương!"
              : "Hoàn thành 100% điểm chương để mở khóa rương";
          const chestCls = "pl-tong-chest" + (sanSangMo ? " ready" : daMo ? " opened" : "");

          plTong.className = "pl-tong";
          plTong.innerHTML = `
            <div class="pl-tong-mascot">
              <img src="img/bai-tap/saoladuo_phihanhgia.png" alt="Sao La phi hành gia" loading="eager" data-eager onerror="this.style.visibility='hidden'">
            </div>
            <div class="pl-tong-mid">
              <h2>${esc(nhanChuong)}: <span>${k.dd} / ${k.mx} điểm</span></h2>
              <div class="pl-tong-bar-row">
                <div class="bar"><i style="width:${k.pt}%"></i></div>
                <b>${k.pt}%</b>
              </div>
              <p class="pl-tong-sub">${esc(loiKhuyen)}</p>
            </div>
            <button type="button" class="${chestCls}" data-chuong="${esc(c.id_chuong)}" title="${esc(chestTitle)}" aria-label="${esc(chestTitle)}">
              <span class="pl-chest-glow" aria-hidden="true"></span>
              <img src="img/bai-tap/ruong_vang.png" alt="Rương thưởng chương" loading="eager" data-eager onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline-flex';">
              <span class="pl-chest-fallback" aria-hidden="true" style="display:none"><i class="fa-solid fa-gift"></i></span>
              ${daMo ? `<span class="pl-chest-pill">✓ Đã mở</span>` : ""}
            </button>`;
        } else {
          plTong.className = "pl-tong im";
          plTong.textContent = "Chưa kết nối được máy chủ nên chưa hiện điểm. Kiểm tra mạng rồi thử lại nhé!";
        }

        if (!c.danh_sach_bai || c.danh_sach_bai.length === 0) {
          problemList.innerHTML = `<p class="pl-rong">Chương này chưa có bài tập nào.</p>`;
          return;
        }

        problemList.innerHTML = "";
        c.danh_sach_bai.forEach((bai, i) => {
          const so = String(soBatDau[chon] + i + 1).padStart(2, "0");
          const ds = dsBaiTap(c, bai);
          const ids = Object.keys(ds).sort(soSanhId);
          const dd = tong(ds), mx = ids.length * 100;
          const artId = `bai-${bai.id}`;
          const soDangDo = demBaiDangDoTheoBai(subject, c.id_chuong, artId);

          const a = document.createElement("a");
          // xong = đạt tối đa mọi bài tập, dang = đã làm một phần (điện thoại dùng để tô màu)
          a.className = "bh-the" + (mx && dd >= mx ? " xong" : dd > 0 ? " dang" : "") + (soDangDo > 0 ? " co-do-dang" : "");
          a.style.setProperty("--k", i);
          a.href = `lesson.html?subject=${subject}&chapter=${c.id_chuong}&article=${artId}`;
          a.innerHTML = `
            <span class="bh-so">${so}</span>
            <span class="bh-giua">
              <span class="bh-ten">${esc(bai.ten_bai)}</span>
              <span class="bh-meta-row">
                <span class="bh-icons">${ids.map((id) => iconHang(ds[id])).join("")}</span>${soDangDo > 0 ? `${ids.length > 0 ? `<span class="bh-meta-sep" aria-hidden="true"></span>` : ""}<span class="bh-dang-lam"><span class="bh-dot-do" aria-hidden="true"></span>${soDangDo} bài đang làm dở</span>` : ""}
              </span>
              <span class="bh-bar"><i style="width:${mx ? Math.round((dd / mx) * 100) : 0}%"></i></span>
            </span>
            <span class="bh-diem">${mx ? dd : "—"}<small>${!tienDo ? "chưa tải được" : mx ? `/ ${mx} điểm` : "chưa có đề"
            }</small></span>
            <i class="fa-solid fa-arrow-right"></i>`;
          problemList.appendChild(a);
        });
      }

      // chọn 1 chương (từ cột bên phải hoặc từ thanh vuốt ngang)
      function chonChuong(i) {
        chon = i;
        veChuong();
        veBai();
        if (chipsEl) {
          chipsEl.querySelectorAll(".pl-chip").forEach((b, j) => {
            b.classList.toggle("on", j === i);
            b.setAttribute("aria-pressed", j === i);
          });
          cuonToiChip(true);
        }
        // nhớ chương đang xem: bấm Back từ trang bài học sẽ quay lại đúng chương này
        try {
          const u = new URL(location.href);
          u.searchParams.set("chuong", dsChuong[i].id_chuong);
          history.replaceState(null, "", u);
        } catch (e) { /* bỏ qua nếu trình duyệt không cho */ }
        // điện thoại: đang cuộn xuống giữa danh sách cũ thì đưa về đầu danh sách mới
        if (window.matchMedia("(max-width: 640px)").matches) {
          const dau = document.querySelector(".pl-layout").getBoundingClientRect().top + window.scrollY - 64;
          if (window.scrollY > dau) window.scrollTo({ top: dau, behavior: "smooth" });
        }
      }

      chuongDs.addEventListener("click", (e) => {
        const nut = e.target.closest(".pl-chap");
        if (!nut) return;
        chonChuong(Number(nut.dataset.i));
      });

      if (chipsEl) {
        chipsEl.addEventListener("click", (e) => {
          const nut = e.target.closest(".pl-chip");
          if (nut) chonChuong(Number(nut.dataset.i));
        });
      }

      let dangMoRuong = false;
      plTong.addEventListener("click", async (e) => {
        const btn = e.target.closest(".pl-tong-chest.ready");
        if (!btn || dangMoRuong) return;

        const c = dsChuong[chon];
        const chuongId = btn.dataset.chuong;
        if (!c || c.id_chuong !== chuongId) return;
        const nhanChuong = String(c.ten_chuong || "").split(":")[0].trim() || c.id_chuong;

        const uid = localStorage.getItem("userId");
        if (!uid) {
          hienThongBaoRuong("Hãy đăng nhập để nhận quà rương!", "warn");
          return;
        }

        dangMoRuong = true;
        btn.disabled = true;
        btn.classList.add("is-loading");
        try {
          const resp = await fetch(`${API}/api/tien-do/mo-ruong`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: Number(uid),
              subject,
              chuong: c.id_chuong,
            }),
          });
          const res = await resp.json().catch(() => ({}));
          if (!resp.ok || !res.success) {
            if (resp.status === 409) {
              ruongDaMo.add(c.id_chuong);
              veBai();
            }
            hienThongBaoRuong(res.message || "Không mở được rương lúc này!", "warn");
            return;
          }

          ruongDaMo.add(c.id_chuong);
          veBai();
          Am.ruong();
          hienThongBaoRuong(
            `🎉 Rương ${nhanChuong} mở khóa! Bạn nhận bí mật +${res.diem_thuong} điểm thưởng!`,
            "ok"
          );

          const diemThuong = Number(res.diem_thuong || 0);
          if (diemThuong > 0) {
            const oldScore = localStorage.getItem("score");
            if (oldScore !== null && !Number.isNaN(Number(oldScore))) {
              localStorage.setItem("score", String(Number(oldScore) + diemThuong));
            }
            document.querySelectorAll("[data-user-score], #user-score").forEach((el) => {
              const cur = Number(String(el.textContent || "").replace(/[^\d.-]/g, ""));
              if (!Number.isNaN(cur)) el.textContent = String(cur + diemThuong);
            });
          }
        } catch (err) {
          hienThongBaoRuong("Lỗi kết nối server khi mở rương!", "warn");
        } finally {
          dangMoRuong = false;
          const curBtn = plTong.querySelector(".pl-tong-chest");
          if (curBtn) {
            curBtn.disabled = false;
            curBtn.classList.remove("is-loading");
          }
        }
      });

      veChuong();
      veChip();
      veBai();
      window.addEventListener("pageshow", () => { veBai(); });
    } catch (error) {
      console.error("Lỗi tải danh sách chương:", error);
      problemList.innerHTML = `<p class="pl-rong">Lỗi: ${esc(error.message)}</p>`;
    }
  }

  // =========================================================================
  // 2. TRANG FORM.HTML (HIỆN BÀI TẬP + CÂU HỎI + NÚT NỘP BÀI)
  // =========================================================================
  const quizContainer = document.getElementById("quiz-container");
  if (!quizContainer || !chapter || !article) return;

  // Bảo mật phòng thi: Chỉ chặn chuột phải & DevTools khi đang thi Khoa Bảng (contest)
  if (subject === "contest") {
    document.body.classList.add("kb-anti-copy");
    document.addEventListener("contextmenu", (e) => {
      // Cho phép chuột phải vào đáp án trắc nghiệm để gạch loại trừ
      if (e.target.closest(".lua-chon")) return;
      e.preventDefault();
    });
    document.addEventListener("copy", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      if (e.key === "F12" || e.keyCode === 123) { e.preventDefault(); return false; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) { e.preventDefault(); return false; }
      if ((e.ctrlKey || e.metaKey) && ["u", "U", "s", "S"].includes(e.key)) { e.preventDefault(); return false; }
    }, true);
  }

  // Khóa phòng thi Khoa Bảng khi chưa đến ngày/giờ mở
  if (subject === "contest") {
    try {
      const cRes = await fetch(`${API}/api/contests`);
      const cData = await cRes.json();
      if (cData.success && Array.isArray(cData.data)) {
        const curC = cData.data.find((c) => String(c.id) === String(chapter));
        if (curC && curC.trang_thai !== "dang-dien-ra") {
          quizContainer.innerHTML = `
            <div style="text-align:center;padding:48px 24px;max-width:540px;margin:40px auto;background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
              <div style="font-size:3.5rem;color:#f59e0b;margin-bottom:16px;"><i class="fa-solid fa-lock"></i></div>
              <h2 style="font-size:1.45rem;color:#1e293b;margin-bottom:12px;font-weight:800;">Phòng thi chưa mở</h2>
              <p style="color:#64748b;line-height:1.6;margin-bottom:24px;font-size:0.95rem;">
                Kỳ thi <b>${esc(curC.ten)}</b> hiện chưa đến giờ làm bài.<br>
                Thời gian mở: <b style="color:#2563eb;">${esc(curC.bat_dau)}</b> đến <b>${esc(curC.ket_thuc)}</b>.<br>
                Vui lòng quay lại đúng ngày và giờ quy định để vào thi!
              </p>
              <a href="khoa-bang.html" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-radius:99px;text-decoration:none;font-weight:700;box-shadow:0 4px 14px rgba(37,99,235,0.3);">
                <i class="fa-solid fa-arrow-left"></i> Quay lại Bảng vàng Khoa Bảng
              </a>
            </div>`;
          return;
        }
      }
    } catch (e) {
      console.warn("Lỗi kiểm tra trạng thái kỳ thi:", e);
    }
  }

  // File cũ chỉ có "cau_hoi" -> coi mỗi câu là 1 bài có đúng 1 câu
  // File mới có "bai_tap" -> mỗi bài chứa nhiều câu hỏi nhỏ
  function layDanhSachBai(data) {
    if (Array.isArray(data.bai_tap)) return data.bai_tap;
    return (data.cau_hoi || []).map((c) => ({
      id: c.id,
      do_kho: c.do_kho,
      tac_pham: data.tac_pham,
      cau_hoi: [c],
    }));
  }

  const TEN_PHAN = {
    "trac-nghiem": "Trắc nghiệm nhiều lựa chọn",
    "dung-sai": "Trắc nghiệm đúng sai",
    "tra-loi-ngan": "Trả lời ngắn",
    "tu-luan": "Tự luận",
  };

  // Điểm mỗi câu: lấy trong JSON, không có thì mặc định 10
  const diemCua = (cau) => cau.diem ?? 10;

  try {
    const data = await docJson(
      `./file_de/${subject}/${chapter}/${article}.json`,
      "Không thể tải file nội dung bài học."
    );
    const tatCaBai = layDanhSachBai(data);

    // Địa chỉ có &q=1.1 thì chỉ giữ đúng bài đó, không có thì giữ hết
    const dsBai = q ? tatCaBai.filter((b) => String(b.id) === q) : tatCaBai;
    if (dsBai.length === 0) {
      quizContainer.insertAdjacentHTML("afterbegin", `<p>Không tìm thấy bài này.</p>`);
      return;
    }
    // Mọi môn luyện tập thường (trừ phòng thi Khoa Bảng): làm từng câu một (quiz-tung-cau.js)
    if (window.QuizTungCau && subject !== "contest") {
      const mp = typeof data.mo_phong === "string" ? data.mo_phong : (data.mo_phong || {}).url;
      if (QuizTungCau.chay({
        API, subject, subjectUrl: params.get("subject"), chapter, article, userId,
        dsBai, moPhong: mp && /^https:\/\//i.test(mp) ? mp : "",
        lyThuyet: data.ly_thuyet || "",
        esc, veCongThuc, Am,
      })) return;
    }

    // Bài có mô phỏng thì thêm nút mở mô phỏng ở tab mới (chỉ nhận link https)
    const moPhong = typeof data.mo_phong === "string" ? data.mo_phong : (data.mo_phong || {}).url;
    if (moPhong && /^https:\/\//i.test(moPhong)) {
      quizContainer.insertAdjacentHTML(
        "afterbegin",
        `<p class="mo-phong-lien-ket">
           <a class="btn" href="${moPhong}" target="_blank" rel="noopener">🔬 Mở mô phỏng ở tab mới</a>
         </p>`
      );
    }

    // Thư mục hình của 1 bài: img/<môn>/<chương>/<bài học>/<bài tập>/
    const duongDanHinh = (bai, tenFile) =>
      `img/${subject}/${chapter}/${article}/${bai.id}/${tenFile}`;

    // Biến danh sách tên file thành các thẻ <img> (nhận cả 1 tên lẫn 1 mảng tên)
    const veHinh = (ds, bai, lop) => {
      const mang = !ds ? [] : Array.isArray(ds) ? ds : [ds];
      return mang
        .map((ten) => `<img class="${lop}" src="${duongDanHinh(bai, ten)}" alt="Hình minh hoạ" loading="lazy">`)
        .join("");
    };

    // Nơi nhớ từng câu cùng ô hiển thị của nó (để chấm điểm sau)
    const dsCau = [];

    // ----- Vẽ từng bài -----
    dsBai.forEach((bai, baiIdx) => {
      const khungBai = document.createElement("section");
      khungBai.className = "bai-tap-khung";

      khungBai.insertAdjacentHTML(
        "beforeend",
        `<h2 class="bai-tap-tieu-de">Bài ${bai.id}${bai.ten ? ": " + bai.ten : ""}</h2>`
      );

      // Tác phẩm + hình của bài (nếu có)
      if (bai.tac_pham) {
        const tp = bai.tac_pham;
        khungBai.insertAdjacentHTML(
          "beforeend",
          `<div class="tac-pham-box">
             <h3>${tp.ten || ""}</h3>
             ${tp.tac_gia ? `<p class="tac-gia">Tác giả: ${tp.tac_gia}</p>` : ""}
             ${veHinh(tp.hinh, bai, "tac-pham-hinh")}
             <div class="tac-pham-noi-dung">${tp.noi_dung || ""}</div>
           </div>`
        );
      }

      // Các câu hỏi nhỏ trong bài (tự chèn tiêu đề phần khi đổi dạng câu)
      let loaiTruoc = null;

      (bai.cau_hoi || []).forEach((cau, i) => {
        if (!TEN_PHAN[cau.type]) return; // loại câu lạ thì bỏ qua
        const name = `q-${baiIdx}-${i}`; // tên nhóm ô chọn, mỗi câu một tên riêng

        if (cau.type !== loaiTruoc) {
          khungBai.insertAdjacentHTML("beforeend", `<h3 class="phan-tieu-de">${TEN_PHAN[cau.type]}</h3>`);
          loaiTruoc = cau.type;
        }

        const cauHtml = document.createElement("div");
        cauHtml.className = "question-card q-" + cau.type;

        const tieuDe = `
          <div class="cau-dau">
            <b class="cau-so">Câu ${cau.id ?? i + 1}</b>
            <button type="button" class="cau-flag" aria-pressed="false" title="Đánh dấu câu chưa chắc chắn để kiểm tra lại trước khi nộp">
              <i class="fa-regular fa-flag"></i><span>Chưa chắc</span>
            </button>
            <span class="cau-diem">${diemCua(cau)} điểm</span>
          </div>
          <div class="cau-de">${cau.de_bai}</div>
          ${veHinh(cau.hinh, bai, "tac-pham-hinh")}`;

        if (cau.type === "trac-nghiem") {
          cauHtml.innerHTML = `${tieuDe}
            <div class="cau-lua-chon">
              ${(cau.dap_an || []).map((item, k) => `
                <label class="lua-chon">
                  <input type="radio" name="${name}" value="${k}">
                  <span class="lua-chon-ky-hieu">${"ABCD"[k] ?? k + 1}</span>
                  <span class="lua-chon-chu">${item}</span>
                  <button type="button" class="lua-chon-loai" title="Gạch loại trừ đáp án sai (hoặc chuột phải)" aria-label="Gạch loại trừ đáp án ${"ABCD"[k] ?? k + 1}">
                    <i class="fa-solid fa-ban"></i>
                  </button>
                </label>`).join("")}
            </div>`;
        } else if (cau.type === "dung-sai") {
          cauHtml.innerHTML = `${tieuDe}
            <div class="cau-lua-chon cau-dung-sai">
              <label class="lua-chon"><input type="radio" name="${name}" value="true"><span class="lua-chon-chu">Đúng</span></label>
              <label class="lua-chon"><input type="radio" name="${name}" value="false"><span class="lua-chon-chu">Sai</span></label>
            </div>`;
        } else if (cau.type === "tu-luan") {
          cauHtml.innerHTML = `${tieuDe}
            <textarea class="o-tu-luan" name="${name}" rows="5" maxlength="6000" placeholder="Viết bài làm của bạn..."></textarea>
            <div class="tu-luan-dem">0 từ</div>`;
          const ta = cauHtml.querySelector("textarea");
          ta.addEventListener("input", () => {
            cauHtml.querySelector(".tu-luan-dem").textContent =
              (ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0) + " từ";
          });
        }
        else {
          cauHtml.innerHTML = `${tieuDe}
            <input class="o-tra-loi" type="text" name="${name}" placeholder="Nhập câu trả lời..." autocomplete="off">`;
        }

        // Chỗ hiện kết quả sau khi nộp (đúng/sai + gợi ý + lời giải)
        cauHtml.insertAdjacentHTML("beforeend", `<div class="ket-qua-cau"></div>`);
        khungBai.appendChild(cauHtml);
        dsCau.push({ cau, card: cauHtml, baiId: bai.id });
      });

      quizContainer.appendChild(khungBai);
    });

    // ----- Nút Nộp bài, khung tổng điểm, khung hạng (chỉ tạo 1 lần) -----
    const btnNop = document.createElement("button");
    btnNop.type = "button";
    btnNop.id = "btn-nop-bai";
    btnNop.textContent = "Nộp bài";
    btnNop.className = "btn";

    const tongKet = document.createElement("p");
    tongKet.id = "tong-ket";
    tongKet.style.cssText = "margin-top:12px; font-weight:600;";

    const hangBox = document.createElement("div"); // MỚI: nơi hiện hạng sau khi nộp
    hangBox.className = "hang-ket-qua";

    // Khung sao + lời khen hiện sau khi nộp
    const saoBox = document.createElement("div");
    saoBox.className = "sao-khung";

    quizContainer.appendChild(btnNop);
    quizContainer.appendChild(saoBox);
    quizContainer.appendChild(tongKet);
    quizContainer.appendChild(hangBox);
    veCongThuc(quizContainer);

    // ===== Đồng hồ đếm ngược Khoa Bảng (khi subject === "contest") =====
    let kbTimerInterval = null;
    if (subject === "contest") {
      const cid = String(chapter);
      let tongPhut = 45;
      let tenKy = "Khoa Bảng - Cuộc thi";
      if (cid === "1" || params.get("cap") === "huong") {
        tongPhut = 30;
        tenKy = "Khoa Bảng - Thi Hương";
      } else if (cid === "2" || params.get("cap") === "hoi") {
        tongPhut = 45;
        tenKy = "Khoa Bảng - Thi Hội";
      } else if (cid === "3" || params.get("cap") === "dinh") {
        tongPhut = 60;
        tenKy = "Khoa Bảng - Thi Đình";
      }

      const tongGiay = tongPhut * 60;
      const ssKey = "kb_start_" + cid;
      if (!sessionStorage.getItem(ssKey)) {
        sessionStorage.setItem(ssKey, String(Date.now()));
      }
      const startLuc = Number(sessionStorage.getItem(ssKey));

      const timerBar = document.createElement("div");
      timerBar.id = "kb-dong-ho";
      timerBar.className = "kb-dong-ho-sticky";
      timerBar.innerHTML = `
        <div class="kb-dh-inner">
          <div class="kb-dh-trai">
            <span class="kb-dh-badge"><i class="fa-solid fa-scroll"></i> Khoa Bảng</span>
            <b class="kb-dh-ten">${tenKy} (${tongPhut} phút)</b>
          </div>
          <div class="kb-dh-giua">
            <i class="fa-regular fa-clock"></i>
            <span>Thời gian còn:</span>
            <b class="kb-dh-so" id="kb-dh-so">--:--</b>
          </div>
          <div class="kb-dh-phai">
            <button type="button" class="kb-dh-btn-nop" id="kb-dh-nop">
              <i class="fa-solid fa-paper-plane"></i> Nộp bài
            </button>
          </div>
        </div>`;
      quizContainer.prepend(timerBar);

      const dhSo = timerBar.querySelector("#kb-dh-so");
      const dhNop = timerBar.querySelector("#kb-dh-nop");
      dhNop.addEventListener("click", () => btnNop.click());

      const capNhatDongHo = () => {
        const daQua = Math.floor((Date.now() - startLuc) / 1000);
        const conLai = Math.max(0, tongGiay - daQua);

        const m = Math.floor(conLai / 60);
        const s = conLai % 60;
        dhSo.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

        if (conLai <= 300 && conLai > 0) {
          timerBar.classList.add("canh-bao");
        }

        if (conLai <= 0) {
          clearInterval(kbTimerInterval);
          dhSo.textContent = "00:00 (Hết giờ)";
          timerBar.classList.add("canh-bao");
          if (!btnNop.disabled) {
            alert("Đã hết thời gian làm bài thi (" + tongPhut + " phút)! Hệ thống sẽ tự động nộp bài thi của bạn.");
            btnNop.click();
          }
        }
      };

      capNhatDongHo();
      kbTimerInterval = setInterval(capNhatDongHo, 1000);
    }

    // ----- Thanh tiến độ dính trên cùng + nút bật/tắt âm -----
    const thanhTD = document.createElement("div");
    thanhTD.className = "tien-do-lam";
    thanhTD.innerHTML = `
      <div class="tdl-hang">
        <span class="tdl-chu"><b class="tdl-so">0/${dsCau.length}</b><span class="tdl-loi"></span></span>
        <button type="button" class="tdl-am" aria-label="Bật/tắt âm thanh"></button>
      </div>
      <div class="tdl-thanh"><i></i></div>`;
    const dhBar = document.getElementById("kb-dong-ho");
    if (dhBar) dhBar.insertAdjacentElement("afterend", thanhTD);
    else quizContainer.prepend(thanhTD);
    const tdlSo = thanhTD.querySelector(".tdl-so");
    const tdlLoi = thanhTD.querySelector(".tdl-loi");
    const tdlDai = thanhTD.querySelector(".tdl-thanh i");
    const tdlAm = thanhTD.querySelector(".tdl-am");

    const veNutAm = () => {
      const b = Am.dangBat();
      tdlAm.textContent = b ? "🔊" : "🔇";
      tdlAm.setAttribute("aria-pressed", String(b));
      tdlAm.title = b ? "Đang bật âm thanh (bấm để tắt)" : "Đang tắt âm thanh (bấm để bật)";
    };
    tdlAm.addEventListener("click", () => { Am.batTat(); veNutAm(); });
    window.addEventListener("amthanh:doi", veNutAm);
    veNutAm();

    // Câu này đã có trả lời chưa?
    const daLam = ({ cau, card }) => {
      if (cau.type === "tra-loi-ngan") return card.querySelector("input[type=text]").value.trim() !== "";
      if (cau.type === "tu-luan") return card.querySelector("textarea").value.trim() !== "";
      return !!card.querySelector("input[type=radio]:checked");
    };

    // ---------- Cơ chế lưu bài dở dang theo yêu cầu ----------
    let daNopBtXong = false;
    const tenBaiBt = (() => {
      const b0 = dsBai && dsBai[0];
      if (b0 && b0.ten) return (b0.id ? `Bài ${b0.id}: ${b0.ten}` : b0.ten);
      return `Bài tập ${chapter} - ${article}`;
    })();
    const linkBt = `form.html?subject=${encodeURIComponent(params.get("subject") || subject)}&chapter=${encodeURIComponent(chapter)}&article=${encodeURIComponent(article)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

    function trungBaiBt(item, s1) {
      if (!item) return false;
      if (item.link === linkBt) return true;
      try {
        const sp = new URL(item.link || "", "http://local").searchParams;
        const s = (item.subject || sp.get("subject") || "").replace(/_/g, "-");
        const c = item.chapter || sp.get("chapter") || "";
        const a = item.article || sp.get("article") || "";
        const qItem = item.q !== undefined && item.q !== null ? String(item.q) : (sp.get("q") || "");
        return s === s1 && c === String(chapter || "") && a === String(article || "") && qItem === String(q || "");
      } catch (e) {
        return false;
      }
    }

    function dongBoBaiDaiNhatBt(s1) {
      const prefix = "baiDangLamBai_" + s1 + "_";
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          try {
            const it = JSON.parse(localStorage.getItem(k) || "null");
            if (it && it.daLam > 0 && it.daLam < it.tongCau) items.push(it);
          } catch (e) {}
        }
      }
      if (items.length === 0) {
        localStorage.removeItem("baiDangLam_" + s1);
        localStorage.removeItem("baiDangLam_" + s1.replace(/-/g, "_"));
        try {
          const c = JSON.parse(localStorage.getItem("baiDangLam") || "null");
          if (c && (c.subject === s1 || c.subject === s1.replace(/-/g, "_"))) {
            localStorage.removeItem("baiDangLam");
          }
        } catch (e) {}
        return;
      }
      items.sort((a, b) => {
        const ca = a.conLai !== undefined ? Number(a.conLai) : Math.max(0, Number(a.tongCau) - Number(a.daLam));
        const cb = b.conLai !== undefined ? Number(b.conLai) : Math.max(0, Number(b.tongCau) - Number(b.daLam));
        if (cb !== ca) return cb - ca;
        return (b.capNhat || 0) - (a.capNhat || 0);
      });
      localStorage.setItem("baiDangLam_" + s1, JSON.stringify(items[0]));
    }

    function luuBaiDangLamBt(daLamSo, tongSo) {
      const conLai = Math.max(0, tongSo - daLamSo);
      const rawSub = params.get("subject") || subject;
      const subKey = String(rawSub).replace(/_/g, "-");
      if (subKey === "contest") return;
      if (daLamSo > 0 && conLai > 0 && !daNopBtXong) {
        const kBai = `baiDangLamBai_${subKey}_${chapter || ""}_${article || ""}${q ? "_" + q : ""}`;
        const thongTin = {
          subject: subKey,
          chapter: String(chapter || ""),
          article: String(article || ""),
          q: q ? String(q) : "",
          ten: tenBaiBt || "Bài tập rèn luyện",
          tongCau: tongSo,
          daLam: daLamSo,
          conLai: conLai,
          link: linkBt,
          capNhat: Date.now()
        };
        localStorage.setItem(kBai, JSON.stringify(thongTin));
        dongBoBaiDaiNhatBt(subKey);
        localStorage.setItem("baiDangLam", JSON.stringify(thongTin));
      } else if (daLamSo >= tongSo || daNopBtXong) {
        xoaBaiDangLamBt();
      }
    }

    function xoaBaiDangLamBt() {
      const rawSub = params.get("subject") || subject;
      const s1 = String(rawSub).replace(/_/g, "-");
      const kBai = `baiDangLamBai_${s1}_${chapter || ""}_${article || ""}${q ? "_" + q : ""}`;
      localStorage.removeItem(kBai);
      try {
        const legacy = JSON.parse(localStorage.getItem("baiDangLam_" + s1) || "null");
        if (trungBaiBt(legacy, s1)) {
          localStorage.removeItem("baiDangLam_" + s1);
        }
        const legacyUnder = JSON.parse(localStorage.getItem("baiDangLam_" + s1.replace(/-/g, "_")) || "null");
        if (trungBaiBt(legacyUnder, s1)) {
          localStorage.removeItem("baiDangLam_" + s1.replace(/-/g, "_"));
        }
      } catch (e) {}
      dongBoBaiDaiNhatBt(s1);
    }

    let daBaoXong = false; // chỉ rung chuông "xong hết" 1 lần
    function capNhatTienDo() {
      const tong = dsCau.length;
      let xong = 0;
      let phanVan = 0;
      dsCau.forEach((x) => {
        const co = daLam(x);
        x.card.classList.toggle("da-lam", co);
        if (co) xong++;
        if (x.card.classList.contains("phan-van")) phanVan++;
      });
      const pt = tong ? Math.round((xong / tong) * 100) : 0;
      tdlSo.textContent = `${xong}/${tong}`;
      tdlDai.style.width = pt + "%";
      thanhTD.classList.toggle("het", tong > 0 && xong === tong);
      btnNop.classList.toggle("san-sang", tong > 0 && xong === tong && !btnNop.disabled);

      let loi = " · Bắt đầu thôi nào! 🚀";
      if (tong > 0 && xong === tong) loi = phanVan > 0 ? ` · Đã làm hết (còn ${phanVan} câu phân vân 🚩)` : " · Xong hết rồi, bấm Nộp bài nhé! 🎯";
      else if (tong - xong === 1) loi = " · Còn đúng 1 câu nữa thôi! 🔥";
      else if (pt >= 50) loi = " · Quá nửa chặng rồi, cố lên! 💪";
      else if (xong > 0) loi = " · Đang vào guồng rồi đó! ✨";
      if (phanVan > 0 && xong < tong) loi += ` · ${phanVan} câu phân vân 🚩`;
      tdlLoi.textContent = loi;

      if (tong > 0 && xong === tong && !daBaoXong) { daBaoXong = true; Am.xong(); }
      if (xong < tong) daBaoXong = false;
      if (xong > 0 && !daNopBtXong) {
        luuBaiDangLamBt(xong, tong);
      }
    }
    capNhatTienDo();

    // Đánh dấu câu chưa chắc chắn (🚩) hoặc gạch đáp án loại trừ (🚫)
    function batTatLoaiLuaChon(lbl) {
      if (btnNop.disabled) return;
      const biLoai = !lbl.classList.contains("bi-loai");
      lbl.classList.toggle("bi-loai", biLoai);
      const rad = lbl.querySelector("input[type=radio]");
      if (biLoai && rad && rad.checked) {
        rad.checked = false;
        capNhatTienDo();
      }
      const btnL = lbl.querySelector(".lua-chon-loai");
      if (btnL) {
        btnL.classList.toggle("on", biLoai);
        btnL.title = biLoai ? "Bỏ gạch đáp án này" : "Gạch loại trừ đáp án sai (hoặc chuột phải)";
        btnL.innerHTML = `<i class="fa-solid ${biLoai ? "fa-rotate-left" : "fa-ban"}"></i>`;
      }
    }

    quizContainer.addEventListener("click", (e) => {
      if (btnNop.disabled) return;
      const flagBtn = e.target.closest(".cau-flag");
      if (flagBtn) {
        e.preventDefault();
        const card = flagBtn.closest(".question-card");
        const on = !card.classList.contains("phan-van");
        card.classList.toggle("phan-van", on);
        flagBtn.classList.toggle("on", on);
        flagBtn.setAttribute("aria-pressed", on ? "true" : "false");
        flagBtn.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-flag"></i><span>${on ? "Đang phân vân" : "Chưa chắc"}</span>`;
        capNhatTienDo();
        return;
      }
      const loaiBtn = e.target.closest(".lua-chon-loai");
      if (loaiBtn) {
        e.preventDefault();
        e.stopPropagation();
        const lbl = loaiBtn.closest(".lua-chon");
        if (lbl) batTatLoaiLuaChon(lbl);
      }
    });

    quizContainer.addEventListener("contextmenu", (e) => {
      if (btnNop.disabled) return;
      const lbl = e.target.closest(".cau-lua-chon:not(.cau-dung-sai) .lua-chon");
      if (!lbl) return;
      e.preventDefault();
      batTatLoaiLuaChon(lbl);
    });

    // Chọn đáp án / gõ chữ -> kêu "bóp", cập nhật tiến độ
    quizContainer.addEventListener("change", (e) => {
      if (e.target.matches("input[type=radio]")) {
        const lbl = e.target.closest(".lua-chon");
        if (lbl && lbl.classList.contains("bi-loai")) {
          lbl.classList.remove("bi-loai");
          const btnL = lbl.querySelector(".lua-chon-loai");
          if (btnL) {
            btnL.classList.remove("on");
            btnL.innerHTML = `<i class="fa-solid fa-ban"></i>`;
          }
        }
        Am.chon();
        capNhatTienDo();
      }
    });
    quizContainer.addEventListener("input", (e) => {
      if (!e.target.matches("input[type=text], textarea")) return;
      const truoc = e.target.classList.contains("co-chu");
      const co = e.target.value.trim() !== "";
      e.target.classList.toggle("co-chu", co);
      if (co && !truoc) Am.go(); // chỉ kêu ở ký tự đầu tiên, đỡ ồn
      capNhatTienDo();
    });

    // Pháo giấy nhỏ khi làm tốt (tự tắt nếu người dùng chọn giảm chuyển động)
    function phaoGiay(soHat) {
      if (giamChuyenDong) return;
      const mau = ["#2457d6", "#178a5a", "#e07a1f", "#7b4bd8", "#f59e0b", "#d93a3a"];
      const lop = document.createElement("div");
      lop.className = "phao-giay";
      for (let i = 0; i < soHat; i++) {
        const h = document.createElement("i");
        h.style.left = Math.random() * 100 + "%";
        h.style.background = mau[i % mau.length];
        h.style.animationDelay = Math.random() * 0.4 + "s";
        h.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
        h.style.setProperty("--lech", (Math.random() * 160 - 80) + "px");
        h.style.transform = `rotate(${Math.random() * 360}deg)`;
        lop.appendChild(h);
      }
      document.body.appendChild(lop);
      setTimeout(() => lop.remove(), 3500);
    }

    // Hiện sao + lời khen sau khi chấm xong
    function hienSao(pct) {
      const sao = pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0;
      const loi =
        pct >= 100 ? "Tuyệt đối! Không sai câu nào 🏆" :
          pct >= 80 ? "Xuất sắc! Gần như hoàn hảo 🎉" :
            pct >= 60 ? "Làm tốt lắm! Thêm chút nữa là hoàn hảo 💪" :
              pct >= 30 ? "Cố lên! Xem lời giải rồi làm lại nhé 📘" :
                "Đừng nản! Mỗi câu sai là một bài học 🌱";
      saoBox.innerHTML = `
        <div class="sao-hang">${[1, 2, 3].map((n) =>
        `<span class="sao${n <= sao ? " bat" : ""}" style="animation-delay:${(n - 1) * 0.18}s">★</span>`).join("")}</div>
        <div class="sao-loi">${loi}</div>`;
      saoBox.classList.add("hien");
      saoBox.scrollIntoView({ behavior: giamChuyenDong ? "auto" : "smooth", block: "center" });
      Am.hoanThanh(pct);
      if (pct >= 60) phaoGiay(pct >= 90 ? 70 : 40);
    }

    // Phát kết quả từng câu lần lượt: đúng thì "ting" (liên tiếp đúng thì cao dần), sai thì rung nhẹ
    function phatKetQua(thuTu, pct) {
      const buoc = Math.max(70, Math.min(220, Math.floor(2600 / Math.max(1, thuTu.length))));
      let combo = 0;
      thuTu.forEach((x, i) => {
        setTimeout(() => {
          if (x.dung === true) {
            x.card.classList.add("bung-dung");
            Am.dung(combo++);
          } else if (x.dung === false) {
            x.card.classList.add("bung-sai");
            Am.sai();
            combo = 0;
          }
        }, i * buoc);
      });
      setTimeout(() => hienSao(pct), thuTu.length * buoc + 250);
    }

    // Lấy câu trả lời người dùng đã chọn / nhập của 1 nhóm câu
    function layCauTraLoi(ds) {
      const answers = {};
      ds.forEach(({ cau, card }) => {
        if (cau.type === "tra-loi-ngan") {
          answers[cau.id] = card.querySelector("input[type=text]").value.trim();
        }
        else if (cau.type === "tu-luan") {
          answers[cau.id] = card.querySelector("textarea").value;
        }
        else {
          const chon = card.querySelector("input[type=radio]:checked");
          answers[cau.id] = chon ? chon.value : "";
        }
      });
      return answers;
    }

    // Khoá mọi ô nhập sau khi nộp thành công
    const khoaOnhap = () =>
      quizContainer.querySelectorAll("input, textarea").forEach((el) => (el.disabled = true));

    // ---------- Lưu trạng thái khi thoát trang nếu đã làm dở ----------
    const xuLyThoatBt = () => {
      if (!daNopBtXong) {
        let daLamSo = 0;
        dsCau.forEach((x) => { if (daLam(x)) daLamSo++; });
        const tongSo = dsCau.length;
        if (tongSo > 0 && daLamSo > 0 && daLamSo < tongSo) {
          luuBaiDangLamBt(daLamSo, tongSo);
        }
      }
    };
    window.addEventListener("beforeunload", xuLyThoatBt);
    window.addEventListener("pagehide", xuLyThoatBt);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") xuLyThoatBt();
    });

    // ----- Bấm Nộp bài -----
    btnNop.addEventListener("click", async () => {
      btnNop.disabled = true; // tránh bấm nhiều lần
      btnNop.classList.remove("san-sang");
      Am.nop();
      tongKet.textContent = "Đang nộp bài...";
      hangBox.innerHTML = "";
      saoBox.classList.remove("hien");
      saoBox.innerHTML = "";
      const userId = localStorage.getItem("userId");

      daNopBtXong = true;
      xoaBaiDangLamBt();

      try {
        // ===== Cuộc thi: gửi 1 lần lên API riêng của cuộc thi =====
        if (subject === "contest") {
          if (!userId) throw new Error("Hãy đăng nhập để thi!");
          const answers = layCauTraLoi(dsCau);
          const res = await fetch(`${API}/api/contests/${encodeURIComponent(chapter)}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: Number(userId), answers }),
          });
          const kq = await res.json();
          if (!kq.success) throw new Error(kq.message);
          tongKet.innerHTML = `Đã nộp bài thành công! Điểm của bạn: <b style="color:var(--nhan);font-size:1.15rem">${kq.diem} điểm</b>.`;
          khoaOnhap();
          if (kbTimerInterval) clearInterval(kbTimerInterval);
          sessionStorage.removeItem("kb_start_" + String(chapter));
          tongKet.insertAdjacentHTML("beforeend", `
            <div style="margin-top:16px">
              <a href="khoa-bang.html" class="btn" style="background:var(--nhan);color:#fff;border-radius:10px;padding:10px 18px">
                <i class="fa-solid fa-award"></i> Về Bảng Vàng Khoa Bảng
              </a>
            </div>
          `);
          Am.xong();
          phaoGiay(35);
          if (window.SAOLA) window.SAOLA.noi("thi_xong");
          return;
        }

        // ===== Bài tập thường: mỗi bài gửi lên server 1 lần =====
        let diemDat = 0;
        let soLoiMoi = 0; // số câu sai vừa vào Sổ lỗi sai
        let diemToiDa = 0;
        let daLuu = false;
        let diemCong = 0; // điểm thật sự được cộng (đã nhân thưởng)
        let heSo = 1;
        let bestPct = 0;  // MỚI: % điểm cao nhất của bài (để hiện hạng)

        const theoBai = {};
        dsCau.forEach((x) => (theoBai[x.baiId] ||= []).push(x));
        const thuTuKetQua = []; // để phát âm thanh/hiệu ứng lần lượt sau khi chấm xong

        for (const baiId of Object.keys(theoBai)) {
          const res = await fetch(`${API}/api/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId ? Number(userId) : null,
              subject, chapter, article, bai_id: String(baiId),
              answers: layCauTraLoi(theoBai[baiId]),
            }),
          });
          const kq = await res.json();
          if (!kq.success) throw new Error(kq.message);

          diemDat += kq.diem_dat;
          diemToiDa += kq.diem_toi_da;
          if (kq.da_luu) daLuu = true;
          soLoiMoi += (kq.so_loi_ghi || []).length;
          diemCong += kq.diem_cong || 0;
          heSo = Math.max(heSo, kq.he_so || 1);
          if (typeof kq.best_pct === "number") bestPct = Math.max(bestPct, kq.best_pct);

          // cập nhật streak trên thanh trên cùng
          if (kq.streak !== null && kq.streak !== undefined) {
            localStorage.setItem("streak", kq.streak);
            if (window.capNhatIconStreak) {
              window.capNhatIconStreak(kq.streak);
            } else {
              const streakEl = document.querySelector(".streak-box span");
              if (streakEl) streakEl.textContent = kq.streak;
            }
          }

          // hiện kết quả từng câu: đúng/sai, sai thì kèm gợi ý, luôn kèm lời giải
          theoBai[baiId].forEach(({ cau, card }) => {
            const o = card.querySelector(".ket-qua-cau");
            const r = kq.ket_qua[cau.id];
            card.classList.remove("dung", "sai", "chua-lam", "bung-dung", "bung-sai");
            thuTuKetQua.push({ card, dung: r ? r.dung : null });
            if (!r || r.dung === null) {
              card.classList.add("chua-lam");
              o.innerHTML = `<div class="kq kq-chua">Bạn chưa trả lời câu này.</div>`;
              return;
            }
            if (cau.type === "tu-luan" && r.tu_luan) {
              card.classList.add(r.dung ? "dung" : "sai");
              o.innerHTML = `<div class="kq ${r.dung ? "kq-dung" : "kq-sai"}">Bạn đạt ${r.diem_dat} / ${r.diem} điểm</div>
              <ul class="tl-y">${r.tu_luan.map((y) => `<li class="${y.dat ? "dat" : "chua"}">
              <b>${y.dat ? "✔" : "✘"}</b> ${esc(y.noi_dung || "")}
              <small>${y.nhoi ? " (bài chỉ liệt kê từ khóa nên không tính)" : y.qua_ngan ? " (bài viết quá ngắn nên chưa tính)" : y.ngu_nghia ? " (chấm theo ý nghĩa)" : ""}</small></li>`).join("")}</ul>
               <p class="tl-luu-y">Hệ thống chấm theo từ khóa nên chỉ gần đúng. Hãy đối chiếu với đáp án mẫu.</p>`;
              if (r.loi_giai) o.innerHTML += `<div class="kq-loi-giai"><b>Đáp án mẫu:</b> ${r.loi_giai}</div>`;
              veCongThuc(o);
              return;
            }
            card.classList.add(r.dung ? "dung" : "sai");
            o.innerHTML = r.dung
              ? `<div class="kq kq-dung">✔ Đúng! +${r.diem} điểm</div>`
              : `<div class="kq kq-sai">✘ Chưa đúng.${cau.goi_y ? " Gợi ý: " + cau.goi_y : ""}</div>`;
            const coSoLoi = r.dung === false && (kq.so_loi_ghi || []).includes(String(cau.id)) && window.SOLOI;
            if (coSoLoi) {
              // Câu sai đã vào Sổ lỗi sai -> hỏi vì sao sai, khóa tạm lời giải chi tiết cho tới khi sửa lỗi
              const hop = document.createElement("div");
              o.appendChild(hop);
              SOLOI.veChanDoan(hop, { bai_key: `${subject}/${chapter}/${article}/${baiId}`, cau_id: String(cau.id) });
              o.insertAdjacentHTML("beforeend",
                `<p class="sl-ghi-chu"><i class="fa-solid fa-lock"></i> Lời giải chi tiết được khóa tạm thời — hãy <a href="so-loi.html">sửa lỗi trong Sổ lỗi sai</a> để mở khóa lời giải nhé!</p>`);
            } else if (r.loi_giai) {
              o.innerHTML += `<div class="kq-loi-giai"><b>Lời giải:</b> ${r.loi_giai}</div>`;
            }
            veCongThuc(o); // vẽ công thức trong lời giải vừa hiện ra
          });
        }

        tongKet.textContent = `Điểm của bạn: ${diemDat} / ${diemToiDa}`;
        if (userId && diemCong > 0) {
          const buffText = heSo > 1 ? ` (Buff ×${Number(heSo.toFixed(3))})` : "";
          tongKet.textContent += daLuu
            ? `${buffText}: +${diemCong} điểm lên bảng xếp hạng.`
            : ` (Làm lại nhận 50%${heSo > 1 ? `, Buff ×${Number(heSo.toFixed(3))}` : ""}): +${diemCong} điểm lên bảng xếp hạng.`;
        }
        if (!userId) tongKet.textContent += " (Đăng nhập để điểm được lưu nhé!)";
        if (soLoiMoi > 0) tongKet.innerHTML += ` <a href="so-loi.html" style="color:var(--nhan)">${soLoiMoi} câu sai đã vào Sổ lỗi sai. Sửa ngay</a>`;
        // MỚI: hiện hạng cao nhất của bài sau khi nộp
        const hang = window.hangCua ? hangCua(bestPct) : null;
        if (userId && hang) {
          hangBox.innerHTML = `
            <span class="hang-mini" style="--c:${hang.c}"><i class="fa-solid ${hang.icon}"></i></span>
            <span>Hạng cao nhất của bài này: <b style="color:${hang.c}">${hang.ten}</b> (${bestPct}%)</span>`;
        }
        const pct = diemToiDa ? Math.round((diemDat / diemToiDa) * 100) : 0;
        khoaOnhap();
        phatKetQua(thuTuKetQua, pct);
        if (window.SAOLA) {
          const buoc = Math.max(70, Math.min(220, Math.floor(2600 / Math.max(1, thuTuKetQua.length))));
          setTimeout(() => {
            if (pct < 30) {
              // 0% - 29% -> 1-20.mp3 (nop_0_29)
              window.SAOLA.hanhDong("khoc", 3000);
              window.SAOLA.noi("nop_0_29");
            } else if (pct < 80) {
              // 30% - 79% -> 30-70%.mp3 (nop_30_79)
              window.SAOLA.hanhDong("hoc", 3000);
              window.SAOLA.noi("nop_30_79");
            } else {
              // 80% - 100% -> 80-100.mp3 (nop_80_100)
              window.SAOLA.hanhDong("vui", 3000);
              window.SAOLA.noi("nop_80_100");
            }
          }, thuTuKetQua.length * buoc + 350);
        }
      } catch (err) {
        daNopBtXong = false;
        btnNop.disabled = false; // lỗi thì cho nộp lại
        capNhatTienDo();
        tongKet.textContent = "Không nộp được bài: " + err.message;
      }
    });
  } catch (error) {
    console.error("Lỗi tải chi tiết bài tập:", error);
    quizContainer.insertAdjacentHTML("afterbegin", `<p>${error.message}</p>`);
  }
});