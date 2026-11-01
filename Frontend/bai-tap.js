document.addEventListener("DOMContentLoaded", async () => {
  const API = "http://127.0.0.1:5000";

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
  async function layTienDo() {
    try {
      const url = `${API}/api/tien-do/${subject}` + (userId ? `?user_id=${userId}` : "");
      const res = await fetch(url);
      const kq = await res.json();
      return kq.success ? kq.data : null;
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

      // ----- Khối tổng điểm + danh sách bài học của chương đang chọn -----
      function veBai() {
        const c = dsChuong[chon];
        if (!c) { problemList.innerHTML = `<p class="pl-rong">Môn này chưa có chương nào.</p>`; return; }

        // tổng điểm của chương
        const k = thongKeChuong(c);
        if (tienDo) {
          plTong.className = "pl-tong";
          plTong.innerHTML = `
            <div><div class="so">${k.dd}<small> / ${k.mx}</small></div>
            <div class="nhan">điểm bài tập đã đạt trong chương này</div></div>
            <div class="bar"><i style="width:${k.pt}%"></i></div><b>${k.pt}%</b>`;
        } else {
          plTong.className = "pl-tong im";
          plTong.textContent = "Chưa kết nối được server nên chưa hiện điểm. Bật app.py nhé!";
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

          const a = document.createElement("a");
          a.className = "bh-the";
          a.href = `lesson.html?subject=${subject}&chapter=${c.id_chuong}&article=bai-${bai.id}`;
          a.innerHTML = `
            <span class="bh-so">${so}</span>
            <span class="bh-giua">
              <span class="bh-ten">${esc(bai.ten_bai)}</span>
              <span class="bh-icons">${ids.map((id) => iconHang(ds[id])).join("")}</span>
            </span>
            <span class="bh-diem">${mx ? dd : "—"}<small>${!tienDo ? "chưa tải được" : mx ? `/ ${mx} điểm` : "chưa có đề"
            }</small></span>
            <i class="fa-solid fa-arrow-right"></i>`;
          problemList.appendChild(a);
        });
      }

      chuongDs.addEventListener("click", (e) => {
        const nut = e.target.closest(".pl-chap");
        if (!nut) return;
        chon = Number(nut.dataset.i);
        veChuong();
        veBai();
      });

      veChuong();
      veBai();
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
                </label>`).join("")}
            </div>`;
        } else if (cau.type === "dung-sai") {
          cauHtml.innerHTML = `${tieuDe}
            <div class="cau-lua-chon cau-dung-sai">
              <label class="lua-chon"><input type="radio" name="${name}" value="true"><span class="lua-chon-chu">Đúng</span></label>
              <label class="lua-chon"><input type="radio" name="${name}" value="false"><span class="lua-chon-chu">Sai</span></label>
            </div>`;
        } else {
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

    quizContainer.appendChild(btnNop);
    quizContainer.appendChild(tongKet);
    quizContainer.appendChild(hangBox);
    veCongThuc(quizContainer);

    // Lấy câu trả lời người dùng đã chọn / nhập của 1 nhóm câu
    function layCauTraLoi(ds) {
      const answers = {};
      ds.forEach(({ cau, card }) => {
        if (cau.type === "tra-loi-ngan") {
          answers[cau.id] = card.querySelector("input[type=text]").value.trim();
        } else {
          const chon = card.querySelector("input[type=radio]:checked");
          answers[cau.id] = chon ? chon.value : "";
        }
      });
      return answers;
    }

    // Khoá mọi ô nhập sau khi nộp thành công
    const khoaOnhap = () =>
      quizContainer.querySelectorAll("input").forEach((el) => (el.disabled = true));

    // ----- Bấm Nộp bài -----
    btnNop.addEventListener("click", async () => {
      btnNop.disabled = true; // tránh bấm nhiều lần
      tongKet.textContent = "Đang nộp bài...";
      hangBox.innerHTML = "";
      const userId = localStorage.getItem("userId");

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
          tongKet.textContent = `Đã nộp bài. Điểm của bạn: ${kq.diem}`;
          khoaOnhap();
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
            const streakEl = document.querySelector(".streak-box span");
            if (streakEl) streakEl.textContent = kq.streak;
          }

          // hiện kết quả từng câu: đúng/sai, sai thì kèm gợi ý, luôn kèm lời giải
          theoBai[baiId].forEach(({ cau, card }) => {
            const o = card.querySelector(".ket-qua-cau");
            const r = kq.ket_qua[cau.id];
            card.classList.remove("dung", "sai", "chua-lam");
            if (!r || r.dung === null) {
              card.classList.add("chua-lam");
              o.innerHTML = `<div class="kq kq-chua">Bạn chưa trả lời câu này.</div>`;
              return;
            }
            card.classList.add(r.dung ? "dung" : "sai");
            o.innerHTML = r.dung
              ? `<div class="kq kq-dung">✔ Đúng! +${r.diem} điểm</div>`
              : `<div class="kq kq-sai">✘ Chưa đúng.${cau.goi_y ? " Gợi ý: " + cau.goi_y : ""}</div>`;
            if (r.loi_giai) o.innerHTML += `<div class="kq-loi-giai"><b>Lời giải:</b> ${r.loi_giai}</div>`;
            // MỚI: câu sai đã vào Sổ lỗi sai -> hỏi vì sao sai, lời giải mở khi sửa lỗi
            if (r.dung === false && (kq.so_loi_ghi || []).includes(String(cau.id)) && window.SOLOI) {
              const hop = document.createElement("div");
              o.appendChild(hop);
              SOLOI.veChanDoan(hop, { bai_key: `${subject}/${chapter}/${article}/${baiId}`, cau_id: String(cau.id) });
              o.insertAdjacentHTML("beforeend",
                `<p class="sl-ghi-chu">Lời giải sẽ mở khi bạn <a href="so-loi.html">sửa lỗi trong Sổ lỗi sai</a>.</p>`);
            }
            veCongThuc(o); // vẽ công thức trong lời giải vừa hiện ra
          });
        }

        tongKet.textContent = `Điểm của bạn: ${diemDat} / ${diemToiDa}`;
        if (daLuu && heSo > 1) {
          tongKet.textContent += ` Thưởng ×${heSo.toFixed(1)}: +${diemCong} điểm lên bảng xếp hạng.`;
        }
        if (!userId) tongKet.textContent += " (Đăng nhập để điểm được lưu nhé!)";
        else if (diemDat > 0 && !daLuu) tongKet.textContent += " (Bài này bạn đã được cộng điểm trước đó)";
        if (soLoiMoi > 0) tongKet.innerHTML += ` <a href="so-loi.html" style="color:var(--nhan)">${soLoiMoi} câu sai đã vào Sổ lỗi sai. Sửa ngay</a>`;
        // MỚI: hiện hạng cao nhất của bài sau khi nộp
        const hang = window.hangCua ? hangCua(bestPct) : null;
        if (userId && hang) {
          hangBox.innerHTML = `
            <span class="hang-mini" style="--c:${hang.c}"><i class="fa-solid ${hang.icon}"></i></span>
            <span>Hạng cao nhất của bài này: <b style="color:${hang.c}">${hang.ten}</b> (${bestPct}%)</span>`;
        }
        khoaOnhap();
      } catch (err) {
        btnNop.disabled = false; // lỗi thì cho nộp lại
        tongKet.textContent = "Không nộp được bài: " + err.message;
      }
    });
  } catch (error) {
    console.error("Lỗi tải chi tiết bài tập:", error);
    quizContainer.insertAdjacentHTML("afterbegin", `<p>${error.message}</p>`);
  }
});