// so-loi.js - trang Sổ lỗi sai: bản đồ kỹ năng + thẻ ôn (sửa lỗi / chứng minh)
document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { location.href = "login.html"; return; }

    const API = "http://127.0.0.1:5000";
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Vẽ công thức KaTeX (không có KaTeX thì bỏ qua)
    const veCT = window.veCongThuc || function (el) {
        if (!el || !window.renderMathInElement) return;
        try {
            window.renderMathInElement(el, {
                delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
                throwOnError: false,
            });
        } catch (e) { console.warn("Không vẽ được công thức:", e); }
    };

    // Gửi POST, trả về kết quả hoặc ném lỗi có thông báo thân thiện
    async function goi(url, body) {
        let kq;
        try {
            const res = await fetch(API + url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: Number(userId), ...body }),
            });
            kq = await res.json();
        } catch (e) {
            throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé!");
        }
        if (!kq.success) throw new Error(kq.message || "Có lỗi xảy ra.");
        return kq;
    }

    const MUC = [
        { ten: "Chưa vững", c: "#d62424" },
        { ten: "Đang luyện", c: "#c27410" },
        { ten: "Khá", c: "#2457d6" },
        { ten: "Thông thạo", c: "#178a5a" },
    ];
    const TEN_NN = { khai_niem: "chưa hiểu khái niệm", tinh_nham: "tính nhầm", doc_sai_de: "đọc sai đề", doan_bua: "đoán bừa" };
    const ngayVN = (s) => {
        if (!s || typeof s !== "string" || !s.includes("-")) return "";
        const [, m, d] = s.split("-");
        return (d && m) ? `${d}/${m}` : "";
    };

    // =========================================================
    // 1. BẢN ĐỒ KỸ NĂNG
    // =========================================================
    let dsGoc = [];
    let monDangChon = "tat-ca";
    let chiCanLam = false;
    let tuKhoaTim = "";

    function veBoLocMon() {
        const tabs = $("sl-mon-tabs");
        if (!tabs) return;

        const demMon = new Map();
        dsGoc.forEach((k) => {
            const mon = k.mon_ten || "Khác";
            demMon.set(mon, (demMon.get(mon) || 0) + 1);
        });

        if (monDangChon !== "tat-ca" && !demMon.has(monDangChon)) {
            monDangChon = "tat-ca";
        }

        const tatCa = `<button type="button" class="sl-mon-pill${monDangChon === "tat-ca" ? " active" : ""}" data-mon="tat-ca" role="tab" aria-selected="${monDangChon === "tat-ca"}">Tất cả (${dsGoc.length})</button>`;
        const cacMon = Array.from(demMon.entries()).map(([mon, so]) => {
            const active = monDangChon === mon;
            return `<button type="button" class="sl-mon-pill${active ? " active" : ""}" data-mon="${esc(mon)}" role="tab" aria-selected="${active}">${esc(mon)} (${so})</button>`;
        }).join("");

        tabs.innerHTML = tatCa + cacMon;
    }

    function veDanhSachDaLoc() {
        const box = $("sl-ds");
        if (!dsGoc.length) {
            box.innerHTML = `<div class="sl-rong">Sổ đang trống. Khi bạn làm sai một câu, kỹ năng đó sẽ xuất hiện ở đây để ôn.<br>
          <a class="sl-btn dac" href="subjects.html">Đi làm bài tập</a></div>`;
            return;
        }

        const q = tuKhoaTim.trim().toLowerCase();
        const dsLoc = dsGoc.filter((k) => {
            const tenMon = k.mon_ten || "Khác";
            if (monDangChon !== "tat-ca" && tenMon !== monDangChon) return false;
            if (chiCanLam && !(k.loi_chua_hieu > 0 || k.den_han)) return false;
            if (q) {
                const ten = (k.ten || "").toLowerCase();
                const mon = tenMon.toLowerCase();
                if (!ten.includes(q) && !mon.includes(q)) return false;
            }
            return true;
        });

        if (!dsLoc.length) {
            box.innerHTML = `<div class="sl-rong">Không có kỹ năng nào phù hợp với bộ lọc hiện tại.<br>
          <button type="button" class="sl-btn" id="sl-reset-filter">Xem tất cả kỹ năng</button></div>`;
            const resetBtn = $("sl-reset-filter");
            if (resetBtn) {
                resetBtn.addEventListener("click", () => {
                    monDangChon = "tat-ca";
                    chiCanLam = false;
                    tuKhoaTim = "";
                    if ($("sl-search")) $("sl-search").value = "";
                    if ($("sl-only-due")) {
                        $("sl-only-due").classList.remove("active");
                        $("sl-only-due").setAttribute("aria-pressed", "false");
                    }
                    veBoLocMon();
                    veDanhSachDaLoc();
                });
            }
            return;
        }

        // gom theo môn
        const theoMon = {};
        dsLoc.forEach((k) => (theoMon[k.mon_ten || "Khác"] ||= []).push(k));
        box.innerHTML = Object.entries(theoMon).map(([mon, dsK]) =>
            `<h2 class="sl-mon"><span>${esc(mon)}</span><span class="sl-mon-count">${dsK.length} bài</span></h2><div class="sl-luoi">${dsK.map(theKyNang).join("")}</div>`).join("");
    }

    async function veBanDo() {
        $("sl-the").classList.add("hidden");
        $("sl-ban-do").classList.remove("hidden");
        window.scrollTo({ top: 0 });
        const box = $("sl-ds");
        box.innerHTML = `<p class="sl-rong">Đang tải...</p>`;
        try {
            const res = await fetch(`${API}/api/so-loi/${userId}/ky-nang`);
            const kq = await res.json();
            if (!kq.success) throw new Error(kq.message);
            const { tom_tat: t, ds } = kq.data;
            dsGoc = ds || [];

            const tongLoi = t.loi_chua_hieu || 0;
            const denHan = t.den_han || 0;
            const thongThao = t.thong_thao || 0;
            const tongKn = t.tong || 0;
            const phanTram = tongKn > 0 ? Math.round((thongThao / tongKn) * 100) : 0;
            const chuaVung = dsGoc.filter((k) => k.muc === 0).length;
            const dangLuyen = dsGoc.filter((k) => k.muc === 1 || k.muc === 2).length;

            $("sl-tom-tat").innerHTML = `
                <div class="sl-summary-card">
                    <div class="sl-sum-left">
                        <div class="sl-sum-stat">
                            <span class="sl-sum-num ${tongLoi > 0 ? "alert" : ""}">${tongLoi}</span>
                            <span class="sl-sum-label">Lỗi cần sửa</span>
                        </div>
                        <div class="sl-sum-progress">
                            <div class="sl-progress-bar"><i style="width:${phanTram}%"></i></div>
                            <span class="sl-progress-text">${thongThao}/${tongKn} kỹ năng thông thạo</span>
                        </div>
                    </div>
                    <div class="sl-mini-stats">
                        <div class="sl-mini-item">
                            <b>${chuaVung}</b>
                            <span>Chưa vững</span>
                        </div>
                        <div class="sl-mini-item">
                            <b>${dangLuyen}</b>
                            <span>Đang luyện</span>
                        </div>
                        <div class="sl-mini-item">
                            <b>${thongThao}</b>
                            <span>Thông thạo</span>
                        </div>
                    </div>
                    <div class="sl-sum-right">
                        ${denHan > 0
                            ? `<button type="button" class="sl-quick-btn" id="sl-btn-on-nhanh">
                                 <i class="fa-solid fa-bolt"></i> Ôn ngay (${denHan})
                               </button>`
                            : `<span class="sl-ok-badge"><i class="fa-solid fa-check"></i> Đã sạch lỗi hẹn</span>`
                        }
                    </div>
                </div>
            `;

            const mascotMsg = $("sl-mascot-msg");
            if (mascotMsg) {
                mascotMsg.textContent = denHan > 0
                    ? `Hôm nay có ${denHan} kỹ năng đến hạn ôn. Làm ngay để ghi nhớ sâu nhé!`
                    : (tongLoi > 0
                        ? `Còn ${tongLoi} lỗi chưa sửa. Chọn một kỹ năng để vá lỗ hổng ngay!`
                        : "Mỗi ngày sửa vài câu là lỗ hổng kiến thức tự biến mất ngay!");
            }

            // Bắt sự kiện nút Ôn ngay -> tự động mở thẻ đầu tiên cần làm
            const btnQuick = $("sl-btn-on-nhanh");
            if (btnQuick) {
                btnQuick.addEventListener("click", () => {
                    const theoMon = monDangChon !== "tat-ca"
                        ? dsGoc.filter((k) => (k.mon_ten || "Khác") === monDangChon)
                        : dsGoc;
                    const firstAction = theoMon.find((k) => k.den_han || k.loi_chua_hieu > 0)
                        || dsGoc.find((k) => k.den_han || k.loi_chua_hieu > 0);
                    if (firstAction) moThe(firstAction.bai_key);
                });
            }

            veBoLocMon();
            veDanhSachDaLoc();
        } catch (err) {
            box.innerHTML = `<p class="sl-rong">${esc(err.message === "Failed to fetch" ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé!" : err.message)}</p>`;
        }
    }

    function theKyNang(k) {
        const m = MUC[k.muc] || MUC[0];
        let nut, ghi, badgeCls = "";
        if (k.loi_chua_hieu > 0) {
            nut = `Sửa ${k.loi_chua_hieu} lỗi`;
            ghi = `${k.loi_chua_hieu} lỗi`;
            badgeCls = "is-err";
        } else if (k.den_han) {
            nut = "Chứng minh";
            ghi = "Đến hạn ôn";
            badgeCls = "is-due";
        } else if (k.ngay_on_ke) {
            nut = "Luyện thêm";
            ghi = `Hẹn ${ngayVN(k.ngay_on_ke)}`;
        } else {
            nut = "Luyện thêm";
            ghi = "Đã thông thạo";
        }

        const bac = MUC.map((x, i) => `<span class="${i <= k.muc ? "on" : ""}" style="--c:${x.c}"></span>`).join("");
        const nn = k.nguyen_nhan_chinh && TEN_NN[k.nguyen_nhan_chinh]
            ? `<span class="sl-tag">${esc(TEN_NN[k.nguyen_nhan_chinh])}</span>`
            : "";
        const hiddenGapBadge = k.lo_hong_an
            ? `<span class="sl-hidden-gap-badge" title="Bạn từng chọn Rất chắc nhưng lại sai ở kỹ năng này">🔥 Lỗ hổng ẩn</span>`
            : "";

        // Chỉ giữ tên bài học và thanh mức độ theo yêu cầu
        const tenHienThi = esc(k.ten);

        return `
      <article class="sl-the-kn${k.den_han || k.loi_chua_hieu ? " can-lam" : ""}${k.lo_hong_an ? " is-hidden-gap" : ""}" style="--status-color: ${m.c}">
        <div class="sl-the-top">
          <div class="sl-the-status">
            <span class="sl-status-dot" style="background:${m.c}"></span>
            <span class="sl-muc-text" style="color:${m.c}">${m.ten}</span>
            ${nn}
            ${hiddenGapBadge}
          </div>
          <span class="sl-ghi-badge ${badgeCls}">${esc(ghi)}</span>
        </div>
        <h3 class="sl-ten-kn" title="${tenHienThi}">${tenHienThi}</h3>
        <div class="sl-the-foot">
          <div class="sl-bac" role="img" aria-label="Mức ${m.ten}">${bac}</div>
          <button type="button" class="sl-btn${k.loi_chua_hieu || k.den_han ? " dac" : ""}" data-key="${esc(k.bai_key)}">${nut} <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </article>`;
    }

    const monTabsEl = $("sl-mon-tabs");
    if (monTabsEl) {
        monTabsEl.addEventListener("click", (e) => {
            const pill = e.target.closest("[data-mon]");
            if (!pill) return;
            monDangChon = pill.dataset.mon || "tat-ca";
            veBoLocMon();
            veDanhSachDaLoc();
        });
    }

    const onlyDueEl = $("sl-only-due");
    if (onlyDueEl) {
        onlyDueEl.addEventListener("click", () => {
            chiCanLam = !chiCanLam;
            onlyDueEl.classList.toggle("active", chiCanLam);
            onlyDueEl.setAttribute("aria-pressed", String(chiCanLam));
            veDanhSachDaLoc();
        });
    }

    const searchEl = $("sl-search");
    if (searchEl) {
        searchEl.addEventListener("input", (e) => {
            tuKhoaTim = e.target.value || "";
            veDanhSachDaLoc();
        });
    }

    $("sl-ds").addEventListener("click", (e) => {
        const nut = e.target.closest("[data-key]");
        if (nut) moThe(nut.dataset.key);
    });

    // =========================================================
    // 2. THẺ ÔN
    // =========================================================
    let the = null;        // thẻ đang làm
    let tangDaMo = 0;      // đã mở tới tầng gợi ý mấy
    let daXong = false;    // thẻ đã kết thúc chưa
    let daHoiNguyenNhan = false;

    async function moThe(key) {
        $("sl-ban-do").classList.add("hidden");
        const hop = $("sl-the");
        hop.classList.remove("hidden");
        hop.innerHTML = `<p class="sl-rong">Đang chuẩn bị câu hỏi...</p>`;
        window.scrollTo({ top: 0 });
        try {
            const kq = await goi("/api/so-loi/the", { bai_key: key });
            the = kq.data;
            tangDaMo = 0; daXong = false; daHoiNguyenNhan = false;
            veThe();
            const kSs3 = "saola_da_3buoc_" + uid;
            if (!document.body.classList.contains("tour-dang-chay") && window.SAOLA && !sessionStorage.getItem(kSs3)) {
                sessionStorage.setItem(kSs3, "1");
                window.SAOLA.noi("so_loi_buoc_0");
            }
        } catch (err) {
            hop.innerHTML = `<p class="sl-rong">${esc(err.message)}</p>
        <div class="sl-hanh-dong"><button type="button" class="sl-btn" id="sl-ve">Về Sổ lỗi sai</button></div>`;
            $("sl-ve").addEventListener("click", veBanDo);
        }
    }

    // ảnh minh họa nằm ở img/<môn>/<chương>/<bài học>/<bài tập>/ - đúng bằng bai_key
    const veHinh = (ds) => (ds || []).map((f) =>
        `<img class="tac-pham-hinh" src="img/${the.bai_key}/${encodeURIComponent(f)}" alt="Hình minh hoạ" loading="lazy">`).join("");

    function veThe() {
        const c = the.cau || {}, kn = the.ky_nang || {}, sua = the.loai === "sua";
        const m = MUC[kn.muc] || MUC[0];

        const banner = sua
            ? `<div class="sl-banner sua"><b>Sửa lỗi.</b> Đây là câu bạn từng làm sai${the.loi_con_lai > 1 ? ` (còn ${the.loi_con_lai} lỗi)` : ""}.
         Hãy thử lại trước. Cần thì mở gợi ý từng tầng, lời giải để cuối cùng.</div>`
            : `<div class="sl-banner cm"><b>Chứng minh.</b> Câu mới cùng kỹ năng. Đúng ngay lần đầu và không dùng gợi ý mới được lên mức.
         ${the.tinh_tien_do ? "" : "<i>Chưa đến hạn nên đây chỉ là luyện thêm, không tính lên mức.</i>"}</div>`;

        const tp = the.tac_pham
            ? `<details class="tac-pham-box sl-tp" open><summary>${esc(the.tac_pham.ten || "Tác phẩm")}</summary>
           ${the.tac_pham.tac_gia ? `<p class="tac-gia">Tác giả: ${esc(the.tac_pham.tac_gia)}</p>` : ""}
           ${veHinh(Array.isArray(the.tac_pham.hinh) ? the.tac_pham.hinh : the.tac_pham.hinh ? [the.tac_pham.hinh] : [])}
           <div class="tac-pham-noi-dung">${the.tac_pham.noi_dung || ""}</div></details>`
            : "";

        let tra;
        if (c.type === "trac-nghiem") {
            tra = `<div class="cau-lua-chon">${(c.dap_an || []).map((t, k) => `
        <label class="lua-chon" data-k="${k}">
          <input type="radio" name="sl-q" value="${k}">
          <span class="lua-chon-ky-hieu">${"ABCDEF"[k] ?? k + 1}</span>
          <span class="lua-chon-chu">${t}</span>
        </label>`).join("")}</div>`;
        } else if (c.type === "dung-sai") {
            tra = `<div class="cau-lua-chon cau-dung-sai">
        <label class="lua-chon"><input type="radio" name="sl-q" value="true"><span class="lua-chon-chu">Đúng</span></label>
        <label class="lua-chon"><input type="radio" name="sl-q" value="false"><span class="lua-chon-chu">Sai</span></label></div>`;
        } else {
            tra = `<input class="o-tra-loi" id="sl-text" type="text" placeholder="Nhập câu trả lời..." autocomplete="off">`;
        }

        $("sl-the").innerHTML = `
      <div class="sl-tren">
        <button type="button" class="sl-btn" id="sl-ve"><i class="fa-solid fa-arrow-left"></i> Về Sổ lỗi sai</button>
        <div class="sl-kn"><b>${esc(kn.ten)}</b><span>${esc(kn.mon_ten)} · mức <em style="color:${m.c}">${m.ten}</em></span></div>
      </div>
      ${banner}
      ${tp}
      <div class="question-card q-${c.type}" id="sl-card">
        <div class="cau-dau"><b class="cau-so">Câu ${esc(c.id)}</b></div>
        <div class="cau-de">${c.de_bai}</div>
        ${veHinh(c.hinh)}
        ${tra}
        <div class="sl-thang-goi-y">
          <button type="button" class="sl-gy" data-tang="1">Nhắc khái niệm</button>
          <button type="button" class="sl-gy" data-tang="2" disabled>Gợi ý hướng làm</button>
          <button type="button" class="sl-gy" data-tang="3" disabled>Xem lời giải</button>
        </div>
        <div id="sl-goi-y"></div>
        <div class="sl-hanh-dong"><button type="button" class="sl-btn dac" id="sl-kt">Kiểm tra</button></div>
        <div id="sl-cd"></div>
        <div id="sl-kq" class="ket-qua-cau"></div>
      </div>`;
        veCT($("sl-the"));

        $("sl-ve").addEventListener("click", veBanDo);
        $("sl-kt").addEventListener("click", kiemTra);
        document.querySelectorAll("#sl-card .sl-gy").forEach((b) =>
            b.addEventListener("click", () => xinGoiY(Number(b.dataset.tang))));
        const o = $("sl-text");
        if (o) o.addEventListener("keydown", (e) => { if (e.key === "Enter") kiemTra(); });
    }

    const baoKq = (chu, loai) => { $("sl-kq").innerHTML = `<div class="kq kq-${loai}">${chu}</div>`; };

    function layTraLoi() {
        if (the.cau.type === "tra-loi-ngan") return $("sl-text").value.trim();
        const r = document.querySelector("#sl-card input[type=radio]:checked");
        return r ? r.value : "";
    }

    // Mở khóa nút gợi ý theo từng tầng: phải mở tầng trước mới tới tầng sau
    function capNhatNutGoiY() {
        document.querySelectorAll("#sl-card .sl-gy").forEach((b) => {
            const t = Number(b.dataset.tang);
            b.disabled = daXong || t !== tangDaMo + 1;
            b.classList.toggle("da-mo", t <= tangDaMo);
        });
    }

    async function kiemTra() {
        if (daXong) return;
        const tl = layTraLoi();
        if (!tl) { baoKq("Hãy chọn hoặc nhập câu trả lời trước nhé.", "chua"); return; }
        $("sl-kt").disabled = true;
        try {
            const kq = await goi("/api/so-loi/tra-loi", { the_id: the.the_id, answer: tl });
            if (kq.dung) { ketThuc(kq); return; }

            // Sai: khóa đáp án vừa chọn, KHÔNG hiện đáp án đúng. Mời chẩn đoán + gợi ý
            const nhan = document.querySelector("#sl-card input[type=radio]:checked");
            if (nhan) {
                nhan.checked = false; nhan.disabled = true;
                nhan.closest("label").classList.add("da-loai");
            } else if ($("sl-text")) {
                $("sl-text").select();
            }
            baoKq(`Chưa đúng${kq.so_lan_sai > 1 ? ` (lần ${kq.so_lan_sai})` : ""}. Đừng vội xem đáp án: mở gợi ý kế tiếp hoặc thử lại.`, "sai");
            if (window.AmThanh && window.AmThanh.sai) window.AmThanh.sai();
            if (!daHoiNguyenNhan) {
                daHoiNguyenNhan = true;
                SOLOI.veChanDoan($("sl-cd"), { the_id: the.the_id }, (id) => {
                    if (id === "khai_niem" && tangDaMo === 0) {   // chưa hiểu khái niệm -> chỉ thẳng vào lý thuyết
                        const nutGy = document.querySelector('#sl-card .sl-gy[data-tang="1"]');
                        if (nutGy) { nutGy.classList.add("nhac"); nutGy.focus(); }
                    }
                });
            }
        } catch (err) {
            baoKq(esc(err.message), "sai");
        } finally {
            if (!daXong) $("sl-kt").disabled = false;
        }
    }

    async function xinGoiY(tang) {
        if (daXong || tang !== tangDaMo + 1) return;
        if (tang === 3 && the.loai === "chung_minh" && the.tinh_tien_do &&
            !confirm("Xem lời giải sẽ kết thúc thẻ này và không tính là đạt. Bạn chắc chứ?")) return;
        try {
            const kq = await goi("/api/so-loi/goi-y", { the_id: the.the_id });
            if (window.AmThanh && window.AmThanh.goiY) window.AmThanh.goiY();
            if (!document.body.classList.contains("tour-dang-chay") && window.SAOLA && tang >= 1 && tang <= 3) {
                window.SAOLA.noi("so_loi_buoc_" + tang);
            }
            tangDaMo = kq.tang;
            const g = kq.goi_y;
            const khoi = document.createElement("div");
            khoi.className = `sl-goi-y t${kq.tang}`;
            khoi.innerHTML = `<b>${esc(g.tieu_de)}</b><div class="${g.kieu === "ly_thuyet" ? "noi-dung-ly-thuyet sl-ly-thuyet" : "sl-goi-y-nd"}">${g.html}</div>`
                + (g.dap_an_hien ? `<p class="sl-dap-an">Đáp án: <b>${g.dap_an_hien}</b></p>` : "");
            $("sl-goi-y").appendChild(khoi);
            veCT(khoi);

            // Tầng 2 của câu trắc nghiệm: loại bớt đáp án sai
            (g.loai_bo || []).forEach((i) => {
                const lb = document.querySelector(`#sl-card label[data-k="${i}"]`);
                if (lb) { lb.classList.add("da-loai"); lb.querySelector("input").disabled = true; }
            });

            capNhatNutGoiY();
            if (kq.da_dong) ketThuc({ ket_qua: kq.ket_qua, tien_do: kq.tien_do, xem_loi_giai: true, dap_an_hien: g.dap_an_hien });
        } catch (err) {
            baoKq(esc(err.message), "sai");
        }
    }

    // Kết thúc thẻ: hiện kết quả, lời giải, tiến độ kỹ năng
    function ketThuc(kq) {
        daXong = true;
        $("sl-kt").disabled = true;
        document.querySelectorAll("#sl-card input").forEach((i) => (i.disabled = true));
        capNhatNutGoiY();
        $("sl-cd").innerHTML = "";

        const tt = kq.tien_do || {};
        let loai = "dung", chu = "";
        if (kq.ket_qua === "da_hieu") {
            chu = kq.xem_loi_giai
                ? "Đã mở lời giải. Đọc kỹ cách làm, rồi chứng minh bằng một câu mới nhé."
                : "Đúng rồi! Lỗi này đã được sửa. Bước tiếp theo: chứng minh bằng một câu mới.";
            if (kq.xem_loi_giai) loai = "chua";
        } else if (kq.ket_qua === "dat") {
            if (!tt.tinh) chu = "Đúng ngay lần đầu! (Đây là luyện thêm nên không tính lên mức.)";
            else if (tt.muc_sau > tt.muc_truoc) {
                const mucSau = MUC[tt.muc_sau] || MUC[0];
                const ngayOn = ngayVN(tt.ngay_on_ke) || "";
                chu = `Đạt! Kỹ năng lên mức <b>${mucSau.ten}</b>${tt.thuong_diem ? ` (+${tt.thuong_diem} điểm)` : ""}.${ngayOn ? ` Hẹn ôn lại ngày <b>${ngayOn}</b>.` : ""}`;
            } else {
                chu = `Tuyệt vời! Bạn vẫn nhớ sau nhiều ngày: kỹ năng đã được ghi nhớ lâu dài${tt.thuong_diem ? ` (+${tt.thuong_diem} điểm)` : ""}.`;
            }
        } else if (kq.ket_qua === "dat_goi_y") {
            chu = "Đúng, nhưng bạn đã sai hoặc dùng gợi ý nên chưa tính để lên mức. Thử thêm một câu mới nhé!";
            loai = "chua";
        } else {
            loai = "chua";
            chu = "Đã mở lời giải nên thẻ này chưa đạt.";
            if (tt.tinh && tt.muc_sau < tt.muc_truoc) {
                const mucSau = MUC[tt.muc_sau] || MUC[0];
                const ngayOn = ngayVN(tt.ngay_on_ke) || "";
                chu += ` Kỹ năng tụt về mức <b>${mucSau.ten}</b>${ngayOn ? `, hẹn ôn lại ngày ${ngayOn}` : ""}.`;
            }
            chu += " Hãy thử câu mới để chứng minh bạn đã hiểu.";
        }
        if (loai === "dung" && window.AmThanh) {
            if (kq.ket_qua === "dat" && tt.tinh && window.AmThanh.thuong) window.AmThanh.thuong(true);
            else if (window.AmThanh.dung) window.AmThanh.dung(1);
        }

        const giai = kq.xem_loi_giai ? "" : (kq.loi_giai ? `<div class="kq-loi-giai"><b>Lời giải:</b> ${kq.loi_giai}</div>` : "");
        const dapAn = kq.dap_an_hien && !kq.xem_loi_giai ? `<p class="sl-dap-an">Đáp án: <b>${kq.dap_an_hien}</b></p>` : "";
        $("sl-kq").innerHTML = `
      <div class="kq kq-${loai}">${chu}</div>${dapAn}${giai}
      <div class="sl-hanh-dong">
        <button type="button" class="sl-btn dac" id="sl-tiep">Câu tiếp theo</button>
        <button type="button" class="sl-btn" id="sl-ve2">Về Sổ lỗi sai</button>
      </div>`;
        veCT($("sl-kq"));
        $("sl-tiep").addEventListener("click", () => moThe(the.bai_key));
        $("sl-ve2").addEventListener("click", veBanDo);
        $("sl-tiep").focus();
    }

    const initialKey = new URLSearchParams(location.search).get("key");
    if (initialKey) {
        moThe(initialKey);
    } else {
        veBanDo();
    }

    const noiSoLoi = (tt) => {
        if (!tt || !window.SAOLA || window.SAOLA.vuaChaoMoi) return;
        const laPc = window.matchMedia("(min-width: 641px)").matches;
        const dangNoiTour = sessionStorage.getItem("vnstarl_tour_chain") === "so-loi";
        const chuaXongTourSl = uid && localStorage.getItem("vnstarl_tour_soloi_" + uid) !== "1";
        if (laPc && (dangNoiTour || chuaXongTourSl)) return;
        const kSs = "saola_da_soloi_" + uid;
        if (sessionStorage.getItem(kSs)) return;
        sessionStorage.setItem(kSs, "1");
        window.SAOLA.noi("so_loi_nhac");
    };
    if (window.SAOLA) window.SAOLA.sanSang.then(noiSoLoi);
    else window.addEventListener("saola-san-sang", (e) => noiSoLoi(e.detail), { once: true });
});