document.addEventListener("DOMContentLoaded", async () => {
  const API = "http://127.0.0.1:5000";

  // Lấy các tham số từ địa chỉ trang
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get("subject") || "toan").replace(/-/g, "_"); // ngu-van -> ngu_van
  const chapter = params.get("chapter");
  const article = params.get("article");
  const q = params.get("q"); // bài muốn làm, ví dụ "1.1" (không có thì hiện cả bài học)

  const problemList = document.getElementById("problem-list");
  const chapterSidebar = document.querySelector(".chapter-sidebar");

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
  // 1. TRANG PROBLEMS.HTML (DANH SÁCH CHƯƠNG VÀ BÀI TẬP)
  // =========================================================================
  function renderTableProblems(chuongObj, subjectCode, soBatDau = 0) {
    problemList.innerHTML = "";

    if (!chuongObj.danh_sach_bai || chuongObj.danh_sach_bai.length === 0) {
      problemList.innerHTML = `<tr><td colspan="3">Chương này chưa có bài tập nào.</td></tr>`;
      return;
    }

    chuongObj.danh_sach_bai.forEach((bai, i) => {
      // số hiển thị: nối tiếp qua các chương (01, 02, 03, 04...)
      const soHienThi = String(soBatDau + i + 1).padStart(2, "0");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${soHienThi}</td>
        <td>
          <a href="lesson.html?subject=${subjectCode}&chapter=${chuongObj.id_chuong}&article=bai-${bai.id}">
            ${bai.ten_bai}
          </a>
        </td>
        <td>${bai.diem}</td>
      `;
      problemList.appendChild(tr);
    });
  }

  if (problemList && chapterSidebar) {
    try {
      const data = await docJson(
        `./file_de/${subject}/tong-hop.json`,
        "Không tìm thấy danh sách bài của môn này."
      );

      chapterSidebar.innerHTML = `<h3>Chương bài học</h3>`;

      (data.chuong_list || []).forEach((chuongItem, index) => {
        // số bài của tất cả các chương đứng trước = số bắt đầu của chương này
        const soBatDau = data.chuong_list
          .slice(0, index)
          .reduce((tong, c) => tong + (c.danh_sach_bai || []).length, 0);

        const p = document.createElement("p");
        p.textContent = chuongItem.ten_chuong;
        p.style.cursor = "pointer";

        p.addEventListener("click", () => {
          document.querySelectorAll(".chapter-sidebar p").forEach((el) => el.classList.remove("active"));
          p.classList.add("active");
          renderTableProblems(chuongItem, subject, soBatDau);
        });

        chapterSidebar.appendChild(p);

        // Mặc định chọn chương đầu tiên
        if (index === 0) {
          p.classList.add("active");
          renderTableProblems(chuongItem, subject, soBatDau);
        }
      });
    } catch (error) {
      console.error("Lỗi tải danh sách chương:", error);
      problemList.innerHTML = `<tr><td colspan="3">Lỗi: ${error.message}</td></tr>`;
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

    // ----- Nút Nộp bài và khung hiện tổng điểm (chỉ tạo 1 lần, sau khi vẽ xong mọi bài) -----
    const btnNop = document.createElement("button");
    btnNop.type = "button";
    btnNop.id = "btn-nop-bai";
    btnNop.textContent = "Nộp bài";
    btnNop.className = "btn";

    const tongKet = document.createElement("p");
    tongKet.id = "tong-ket";
    tongKet.style.cssText = "margin-top:12px; font-weight:600;";

    quizContainer.appendChild(btnNop);
    quizContainer.appendChild(tongKet);
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
        let diemToiDa = 0;
        let daLuu = false;
        let diemCong = 0; // điểm thật sự được cộng (đã nhân thưởng)
        let heSo = 1;

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
          diemCong += kq.diem_cong || 0;
          heSo = Math.max(heSo, kq.he_so || 1);

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
            veCongThuc(o); // vẽ công thức trong lời giải vừa hiện ra
          });
        }

        tongKet.textContent = `Điểm của bạn: ${diemDat} / ${diemToiDa}`;
        if (daLuu && heSo > 1) {
          tongKet.textContent += ` Thưởng ×${heSo.toFixed(1)}: +${diemCong} điểm lên bảng xếp hạng.`;
        }
        if (!userId) tongKet.textContent += " (Đăng nhập để điểm được lưu nhé!)";
        else if (diemDat > 0 && !daLuu) tongKet.textContent += " (Bài này bạn đã được cộng điểm trước đó)";
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