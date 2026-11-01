// gate.js - khách (chưa đăng nhập) vào Bài tập / Cuộc thi chỉ thấy giao diện giới thiệu.
// Dùng: <body data-gate="bai-tap"> hoặc <body data-gate="cuoc-thi">, nạp file này TRƯỚC subjects.js / contest.js.
// Đã đăng nhập thì file này không làm gì cả.
(function () {
    "use strict";
    const loai = document.body.dataset.gate;
    if (!loai) return;
    if (localStorage.getItem("isLoggedIn") === "true" && localStorage.getItem("userId")) return;

    const API = "http://127.0.0.1:5000";
    const TRANG_QUAY_LAI = loai === "bai-tap" ? "subjects.html" : "contest.html";
    const $ = (s, g = document) => g.querySelector(s);
    const HANG = window.HANG || [];                                   // từ hang.js
    const iconHang = (p) => (window.iconHang ? window.iconHang(p) : "");

    // ======================================================
    // Mảnh HTML dùng chung
    // ======================================================
    const cta = `
    <div class="gt-cta">
      <a data-cta href="register.html" class="gt-btn dac"><i class="fa-solid fa-user-plus"></i> Đăng ký miễn phí</a>
      <a data-cta href="login.html" class="gt-btn"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</a>
    </div>`;

    const dongCuoi = (tieu, phu) =>
        `<section class="gt-cuoi"><h2>${tieu}</h2><p>${phu}</p>${cta}</section>`;

    const buoc = (ds) => `<ol class="gt-buoc">${ds.map(([icon, t, m], i) => `
    <li><span class="gt-buoc-so"><i class="fa-solid ${icon}"></i></span>
      <b>${i + 1}. ${t}</b><small>${m}</small></li>`).join("")}</ol>`;

    const tinhNang = (ds) => `<div class="gt-tn">${ds.map(([icon, c, t, m]) => `
    <article style="--c:${c}"><i class="fa-solid ${icon}"></i><b>${t}</b><p>${m}</p></article>`).join("")}</div>`;

    const chipDong = (ds) =>
        `<ul class="gt-chip-dong">${ds.map((t) => `<li><i class="fa-solid fa-circle-check"></i>${t}</li>`).join("")}</ul>`;

    // ======================================================
    // TRANG BÀI TẬP
    // ======================================================
    const theMon = (ten, anh, icon, phu) => `
    <div class="subject-card gt-the-mon" tabindex="0"
         data-khoa="Đăng nhập để vào kho bài tập môn ${ten}.">
      <div class="subject-img"><img src="img/subject/${anh}.webp" alt="${ten}" data-icon="${icon}"></div>
      <span class="subject-name">${ten}</span>
      <small class="gt-phu">${phu}</small>
      <span class="subject-badge"><i class="fa-solid fa-lock"></i> Cần đăng nhập</span>
    </div>`;

    // Bài học mẫu: [số, tên, [% điểm của từng bài tập nhỏ]]
    const BAI_MAU = [
        ["01", "Phương trình bậc nhất một ẩn", [100, 85, 62, 45]],
        ["02", "Hệ hai phương trình bậc nhất hai ẩn", [70, 30, 0, 0]],
        ["03", "Bất phương trình bậc nhất một ẩn", [0, 0, 0]],
    ];

    const theBai = ([so, ten, ds]) => {
        const dd = ds.reduce((a, b) => a + b, 0), mx = ds.length * 100;
        return `
      <div class="bh-the" tabindex="0" data-khoa="Đăng nhập để mở bài học, đọc lý thuyết và làm bài tập này.">
        <span class="bh-so">${so}</span>
        <span class="bh-giua">
          <span class="bh-ten">${ten}</span>
          <span class="bh-icons">${ds.map(iconHang).join("")}</span>
        </span>
        <span class="bh-diem">${dd}<small>/ ${mx} điểm</small></span>
        <i class="fa-solid fa-arrow-right"></i>
      </div>`;
    };

    function trangBaiTap() {
        const tongDd = BAI_MAU.reduce((s, b) => s + b[2].reduce((a, c) => a + c, 0), 0);
        const tongMx = BAI_MAU.reduce((s, b) => s + b[2].length * 100, 0);
        const pt = Math.round((tongDd / tongMx) * 100);

        const chuGiai = HANG.map((h) => `
      <div class="cg" style="--c:${h.c}">
        <span class="hang-mini"><i class="fa-solid ${h.icon}"></i></span>
        <div><b>${h.ten}</b><small>${h.nhan} điểm</small></div>
      </div>`).join("");

        return `
    <section class="gt-hero">
      <span class="gt-nhan"><i class="fa-solid fa-lock"></i> Dành cho thành viên SaoLaEdu</span>
      <h1>Kho bài tập luyện thi vào lớp 10</h1>
      <p>Học lý thuyết, luyện từng dạng câu hỏi, xem lời giải chi tiết và leo hạng sau mỗi lần làm lại.
         Tạo tài khoản miễn phí để mở khóa toàn bộ.</p>
      ${cta}
      ${chipDong(["3 dạng câu hỏi như đề thi", "Lời giải chi tiết", "5 hạng thành tích", "Sổ lỗi sai ôn đúng chỗ hổng"])}
    </section>

    <section class="gt-khoi">
      <h2>Luyện tập theo lộ trình rõ ràng</h2>
      <p class="gt-sub">Mỗi bài học đều đi qua 4 bước, bạn luôn biết mình đang ở đâu.</p>
      ${buoc([
            ["fa-book-open", "Chọn môn và chương", "Mỗi chương gồm nhiều bài học, sắp theo thứ tự nên học."],
            ["fa-lightbulb", "Đọc lý thuyết", "Tóm tắt kiến thức, có mô phỏng thực hành ở một số bài."],
            ["fa-pen", "Làm bài tập", "Trắc nghiệm, đúng sai và trả lời ngắn, xếp từ dễ đến khó."],
            ["fa-medal", "Xem lời giải, nâng hạng", "Làm lại để đạt % cao hơn và lên hạng."],
        ])}
    </section>

    <section class="gt-khoi">
      <h2>Các môn đang có</h2>
      <p class="gt-sub">Bấm vào một môn để thử, hệ thống sẽ mời bạn đăng nhập.</p>
      <div class="subject-grid">
        ${theMon("Toán", "toan", "fa-calculator", "Đại số · Hình học")}
        ${theMon("Ngữ Văn", "ngu_van", "fa-feather-pointed", "Đọc hiểu · Tác phẩm")}
        ${theMon("Môn chuyên", "chuyen_toan", "fa-shapes", "Toán · Vật lý · Hóa học")}
      </div>
    </section>

    <section class="gt-khoi">
      <h2>Xem trước bên trong</h2>
      <p class="gt-sub">Đây là giao diện bạn sẽ dùng hằng ngày. Thử làm ngay câu hỏi bên phải nhé!</p>
      <div class="gt-xem">

        <div class="gt-cua-so">
          <div class="gt-cua-so-dau">
            <span class="gt-cham"><i></i><i></i><i></i></span>
            <span class="gt-cua-so-ten">Bài tập Toán · Chương 1</span>
            <span class="gt-ribbon">Ví dụ minh họa</span>
          </div>
          <div class="gt-cua-so-than">
            <div class="pl-tong">
              <div><div class="so">${tongDd}<small> / ${tongMx}</small></div>
                <div class="nhan">điểm bài tập đã đạt trong chương này</div></div>
              <div class="bar"><i style="width:${pt}%"></i></div><b>${pt}%</b>
            </div>
            <div class="pl-ds">${BAI_MAU.map(theBai).join("")}</div>
          </div>
        </div>

        <div class="gt-cua-so">
          <div class="gt-cua-so-dau">
            <span class="gt-cham"><i></i><i></i><i></i></span>
            <span class="gt-cua-so-ten">Dùng thử 1 câu hỏi</span>
          </div>
          <div class="gt-cua-so-than">
            <div class="question-card q-trac-nghiem" id="gt-demo">
              <div class="cau-dau"><b class="cau-so">Câu 1</b><span class="cau-diem">2 điểm</span></div>
              <div class="cau-de">Nghiệm của phương trình 2x + 3 = 11 là:</div>
              <div class="cau-lua-chon">
                ${["x = 3", "x = 4", "x = 5", "x = 7"].map((t, k) => `
                <label class="lua-chon">
                  <input type="radio" name="gt-q" value="${k}">
                  <span class="lua-chon-ky-hieu">${"ABCD"[k]}</span>
                  <span class="lua-chon-chu">${t}</span>
                </label>`).join("")}
              </div>
              <div class="gt-demo-nut"><button type="button" class="gt-btn dac" id="gt-kt">Kiểm tra</button></div>
              <div class="ket-qua-cau" id="gt-kq" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>

      <h3>5 hạng thành tích cho mỗi bài tập</h3>
      <div class="chu-giai">${chuGiai}</div>
    </section>

    <section class="gt-khoi">
      <h2>Không chỉ là làm bài</h2>
      <p class="gt-sub">Những thứ giúp bạn học đều và nhớ lâu.</p>
      ${tinhNang([
            ["fa-circle-check", "#178a5a", "Lời giải chi tiết", "Nộp bài là có kết quả từng câu, kèm lời giải để hiểu vì sao."],
            ["fa-book-bookmark", "#c27410", "Sổ lỗi sai", "Câu sai tự vào sổ, ôn lại cách 1, 3, 7 ngày để nhớ thật."],
            ["fa-fire", "#d9480f", "Chuỗi ngày và nhiệm vụ", "Mỗi ngày 3 nhiệm vụ, điểm danh và quay thưởng."],
            ["fa-ranking-star", "#2457d6", "Bảng xếp hạng", "Tích điểm từ bài tập và so tài cùng bạn bè."],
        ])}
    </section>

    ${dongCuoi("Sẵn sàng bắt đầu?", "Tạo tài khoản chỉ mất chưa đến 1 phút, hoàn toàn miễn phí.")}`;
    }

    // Câu hỏi dùng thử: chấm ngay trên trình duyệt, chỉ là 1 câu mẫu cố định
    function ganDemo(goc) {
        $("#gt-kt", goc).addEventListener("click", () => {
            const kq = $("#gt-kq", goc);
            const chon = $("#gt-demo input:checked", goc);
            if (!chon) { kq.innerHTML = `<div class="kq kq-chua">Hãy chọn một đáp án trước nhé.</div>`; return; }

            const dung = chon.value === "1";
            goc.querySelectorAll("#gt-demo input").forEach((i) => (i.disabled = true));
            $("#gt-kt", goc).disabled = true;
            kq.innerHTML =
                (dung ? `<div class="kq kq-dung">✔ Đúng! +2 điểm</div>` : `<div class="kq kq-sai">✘ Chưa đúng. Đáp án là B.</div>`) +
                `<div class="kq-loi-giai"><b>Lời giải:</b> 2x = 11 − 3 = 8, suy ra x = 4.</div>
         <div class="gt-demo-moi">Thích chứ? Đăng ký để làm tiếp các bài tập thật và lưu điểm của bạn.${cta}</div>`;
        });
    }

    // ======================================================
    // TRANG CUỘC THI
    // ======================================================
    const NHAN = { "sap-dien-ra": "Sắp diễn ra", "dang-dien-ra": "Đang diễn ra", "da-ket-thuc": "Đã kết thúc" };

    // Cuộc thi mẫu: chỉ dùng khi server chưa bật hoặc chưa có cuộc thi nào
    const THI_MAU = [
        { id: 1, ten: "Giao lưu Toán 9 - Chương 1", trang_thai: "dang-dien-ra", bat_dau: "2026-11-10 19:00", ket_thuc: "2026-11-10 20:00" },
        { id: 2, ten: "Thử sức Ngữ văn - Đọc hiểu", trang_thai: "sap-dien-ra", bat_dau: "2026-11-17 19:30", ket_thuc: "2026-11-17 20:30" },
        { id: 3, ten: "Vòng khởi động", trang_thai: "da-ket-thuc", bat_dau: "2026-11-01 19:00", ket_thuc: "2026-11-01 20:00" },
    ];

    const dinhDangGio = (s) => {
        const [ngay, gio] = s.split(" "), [n, t, d] = ngay.split("-");
        return `${gio} - ${d}/${t}/${n}`;
    };
    const soPhut = (a, b) => Math.round((new Date(b.replace(" ", "T")) - new Date(a.replace(" ", "T"))) / 60000);

    // Nội dung 3 tab mẫu
    const TAB_MAU = {
        "thong-tin": `
      <h3 class="contest-ten">Giao lưu Toán 9</h3>
      <span class="contest-badge dang-dien-ra">Đang diễn ra</span>
      <p><b>Bắt đầu:</b> 19:00 - 10/11/2026</p>
      <p><b>Kết thúc:</b> 20:00 - 10/11/2026</p>
      <p><b>Thời lượng:</b> 60 phút</p>
      <h4>Nội dung cuộc thi</h4>
      <p class="contest-noidung-text">Từ Chương 1 - Bài 01 đến Chương 3 - Bài 02</p>`,
        "bai-tap": `
      <table class="problem-table">
        <thead><tr><th>ID</th><th>Bài</th><th>Điểm</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Bài 1: Phương trình bậc nhất</td><td>100</td></tr>
          <tr><td>2</td><td>Bài 2: Hệ phương trình</td><td>100</td></tr>
          <tr><td>3</td><td>Bài 3: Bài toán thực tế</td><td>100</td></tr>
        </tbody>
      </table>`,
        "xep-hang": `
      <div class="leaderboard-container">
        <div class="podium-section">
          <div class="podium-card silver"><img class="avatar" src="img/avartar.webp" alt="Top 2">
            <span class="podium-name">Thí sinh B - 270</span><div class="step">2</div></div>
          <div class="podium-card gold"><img class="avatar" src="img/avartar.webp" alt="Top 1">
            <span class="podium-name">Thí sinh A - 300</span><div class="step">1</div></div>
          <div class="podium-card bronze"><img class="avatar" src="img/avartar.webp" alt="Top 3">
            <span class="podium-name">Thí sinh C - 240</span><div class="step">3</div></div>
        </div>
        <p class="gt-ghi">Tên của bạn có thể ở đây. Điểm lên bảng ngay sau khi nộp bài.</p>
      </div>`,
    };

    function trangCuocThi() {
        return `
    <section class="gt-hero">
      <span class="gt-nhan"><i class="fa-solid fa-lock"></i> Dành cho thành viên SaoLaEdu</span>
      <h1>Tranh tài cùng bạn bè</h1>
      <p>Mỗi cuộc thi có khung giờ riêng, đề riêng và bảng xếp hạng riêng.
         Đăng nhập để vào thi, ghi tên mình lên bục vinh danh.</p>
      ${cta}
      ${chipDong(["Chấm điểm tự động", "Bảng xếp hạng riêng", "Nhắc trước giờ thi 30 phút"])}
    </section>

    <section class="gt-khoi">
      <h2>Các cuộc thi</h2>
      <p class="gt-sub">Bạn có thể xem lịch thi ngay bây giờ. Bấm vào một cuộc thi để thử vào.</p>
      <div class="gt-cuon">
        <table class="contest-table">
          <thead><tr><th>ID</th><th>Tên cuộc thi</th><th>Thời gian làm bài</th></tr></thead>
          <tbody id="gt-ds-thi"><tr><td colspan="3" class="contest-empty">Đang tải...</td></tr></tbody>
        </table>
      </div>
      <p class="gt-ghi" id="gt-ghi-bang"></p>
    </section>

    <section class="gt-khoi">
      <h2>Bên trong một cuộc thi</h2>
      <p class="gt-sub">Mỗi cuộc thi có 3 tab. Bấm thử để xem.</p>
      <div class="gt-cua-so">
        <div class="gt-cua-so-dau">
          <div class="contest-tabs" id="gt-tabs">
            <button type="button" class="contest-tab active" data-gtab="thong-tin">Thông tin</button>
            <button type="button" class="contest-tab" data-gtab="bai-tap">Bài tập</button>
            <button type="button" class="contest-tab" data-gtab="xep-hang">Bảng xếp hạng</button>
          </div>
          <span class="gt-ribbon">Ví dụ minh họa</span>
        </div>
        <div class="contest-noi-dung gt-tab-nd" id="gt-tab-nd"></div>
      </div>
    </section>

    <section class="gt-khoi">
      <h2>Tham gia thế nào?</h2>
      <p class="gt-sub">Công bằng cho mọi người: giờ thi được tính trên máy chủ.</p>
      ${buoc([
            ["fa-user-plus", "Tạo tài khoản", "Đăng ký miễn phí, mất chưa đến 1 phút."],
            ["fa-bell", "Nhận nhắc giờ thi", "Bật thông báo để được nhắc trước 30 phút."],
            ["fa-clock", "Vào thi đúng giờ", "Làm bài trong khung giờ của cuộc thi."],
            ["fa-flag-checkered", "Nộp bài, xem hạng", "Mỗi người nộp một lần, điểm lên bảng xếp hạng ngay."],
        ])}
    </section>

    ${dongCuoi("Sẵn sàng ghi tên lên bục vinh danh?", "Đăng ký ngay để không lỡ cuộc thi tiếp theo.")}`;
    }

    function veTabMau(ten) {
        $("#gt-tab-nd").innerHTML = TAB_MAU[ten];
        document.querySelectorAll("#gt-tabs .contest-tab").forEach((t) =>
            t.classList.toggle("active", t.dataset.gtab === ten));
    }

    function veBangThi(ds, laMau) {
        const tb = $("#gt-ds-thi");
        tb.innerHTML = "";
        ds.forEach((c) => {
            const tr = document.createElement("tr");
            tr.className = "co-the-bam";
            tr.tabIndex = 0;
            tr.dataset.khoa = "Đăng nhập để xem chi tiết, làm bài và xem bảng xếp hạng của cuộc thi này.";
            tr.innerHTML = `<td></td>
        <td><span class="t"></span><span class="contest-badge"></span><i class="fa-solid fa-lock gt-o-khoa"></i></td>
        <td class="contest-time"><span></span><small></small></td>`;
            const [td1, td2, td3] = tr.children;
            td1.textContent = laMau ? "—" : c.id;                 // textContent: tên không chạy được code lạ
            td2.querySelector(".t").textContent = c.ten;
            const nhan = td2.querySelector(".contest-badge");
            nhan.className = `contest-badge ${c.trang_thai}`;
            nhan.textContent = NHAN[c.trang_thai] || "";
            td3.querySelector("span").textContent = `${dinhDangGio(c.bat_dau)} → ${dinhDangGio(c.ket_thuc)}`;
            td3.querySelector("small").textContent = `Thời lượng ${soPhut(c.bat_dau, c.ket_thuc)} phút`;
            tb.appendChild(tr);
        });
        $("#gt-ghi-bang").textContent = laMau
            ? "Danh sách trên là ví dụ minh họa. Cuộc thi thật sẽ hiện ở đây khi có lịch."
            : "Bấm vào một cuộc thi để xem chi tiết.";
    }

    // Lấy lịch thi thật (API này công khai, không cần đăng nhập). Lỗi thì dùng dữ liệu mẫu
    async function taiLichThi() {
        try {
            const kq = await (await fetch(`${API}/api/contests`)).json();
            if (kq.success && kq.data && kq.data.length) return veBangThi(kq.data.slice(0, 6), false);
        } catch (e) { /* server chưa bật thì dùng mẫu */ }
        veBangThi(THI_MAU, true);
    }

    // ======================================================
    // Hộp mời đăng nhập (dùng lại .modal-nen / .modal-hop của style3.css)
    // ======================================================
    function taoModal() {
        const nen = document.createElement("div");
        nen.id = "gt-nen";
        nen.className = "modal-nen hidden";
        nen.innerHTML = `
      <div class="modal-hop modal-nho" role="dialog" aria-modal="true" aria-labelledby="gt-m-tieu-de">
        <div class="modal-dau">
          <h3 id="gt-m-tieu-de">Đăng nhập để tiếp tục</h3>
          <button type="button" class="modal-dong" id="gt-m-dong" aria-label="Đóng">✕</button>
        </div>
        <div class="gt-modal-nd">
          <div class="gt-khoa-icon"><i class="fa-solid fa-lock"></i></div>
          <p id="gt-m-noi-dung"></p>
          ${cta}
        </div>
      </div>`;
        document.body.appendChild(nen);

        const dong = () => { nen.classList.add("hidden"); document.body.style.overflow = ""; };
        $("#gt-m-dong").addEventListener("click", dong);
        nen.addEventListener("click", (e) => { if (e.target === nen) dong(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") dong(); });

        return (chu) => {
            $("#gt-m-noi-dung").textContent = chu;
            nen.classList.remove("hidden");
            document.body.style.overflow = "hidden";
            nen.querySelector(".gt-btn.dac").focus();
        };
    }

    // ======================================================
    // Chạy: gỡ phần thật, thay bằng phần giới thiệu
    // ======================================================
    // Xóa hẳn khỏi trang để subjects.js / contest.js không tìm thấy gì và không gọi server
    if (loai === "bai-tap") {
        document.querySelectorAll("main.subject-page").forEach((n) => n.remove());
    } else {
        document.querySelectorAll(".contest-head, .contest-container, #contest-nen").forEach((n) => n.remove());
    }

    const main = document.createElement("main");
    main.className = "gt-trang";
    main.innerHTML = loai === "bai-tap" ? trangBaiTap() : trangCuocThi();
    $("#header").after(main);

    const moModal = taoModal();

    if (loai === "bai-tap") {
        ganDemo(main);
        // ô môn chưa có ảnh thì hiện icon giữ chỗ (giống subjects.js)
        main.querySelectorAll(".subject-img img").forEach((img) => {
            const thayBangIcon = () => {
                const ph = document.createElement("div");
                ph.className = "subject-placeholder";
                ph.innerHTML = `<i class="fa-solid ${img.dataset.icon}"></i>`;
                img.replaceWith(ph);
            };
            img.addEventListener("error", thayBangIcon);
            if (img.complete && img.naturalWidth === 0) thayBangIcon();
        });
    } else {
        taiLichThi();
        veTabMau("thong-tin");
        $("#gt-tabs").addEventListener("click", (e) => {
            const t = e.target.closest("[data-gtab]");
            if (t) veTabMau(t.dataset.gtab);
        });
    }

    // Một chỗ xử lý chung: bấm vào thứ gì có data-khoa thì mời đăng nhập
    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cta]")) sessionStorage.setItem("quayLai", TRANG_QUAY_LAI); // đăng nhập xong quay lại đây
        const k = e.target.closest("[data-khoa]");
        if (k) { e.preventDefault(); moModal(k.dataset.khoa); }
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const k = e.target.closest && e.target.closest("[data-khoa]");
        if (k) moModal(k.dataset.khoa);
    });
})();