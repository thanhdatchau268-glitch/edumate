// quiz-tung-cau.js - Làm bài TỪNG CÂU MỘT (kiểu Duolingo) cho Toán / Ngữ văn thường
// Nạp TRƯỚC bai-tap.js. bai-tap.js gọi:  if (QuizTungCau.chay({...})) return;
// Không đụng tới server: vẫn nộp qua /api/submit như cũ, nên điểm, hạng, streak,
// Sổ lỗi sai, nhiệm vụ hằng ngày... đều giữ nguyên.
//
// Luồng:  làm từng câu  ->  màn xem lại (lưới số câu)  ->  nộp  ->  kết quả  ->  xem lại từng câu
window.QuizTungCau = (() => {
    "use strict";

    const TEN_DANG = {
        "trac-nghiem": "Trắc nghiệm",
        "dung-sai": "Đúng / Sai",
        "tra-loi-ngan": "Trả lời ngắn",
        "tu-luan": "Tự luận",
    };
    const MAU_DA = ["#2457d6", "#178a5a", "#e07a1f", "#7b4bd8", "#d93a8a", "#0e9aa7"];

    function chay(ctx) {
        const { API, subject, subjectUrl, chapter, article, userId, dsBai, moPhong, esc, veCongThuc, Am } = ctx;
        const hangCua = window.hangCua;
        const giamCD = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

        // ---------- Gom mọi câu của mọi bài thành 1 danh sách phẳng ----------
        const items = [];
        dsBai.forEach((bai) =>
            (bai.cau_hoi || []).forEach((cau) => {
                if (TEN_DANG[cau.type]) items.push({ cau, bai, key: bai.id + "|" + cau.id });
            }),
        );
        if (!items.length) return false; // không có gì để hiện: để bai-tap.js tự xử lý
        const n = items.length;

        // ---------- Hàm nhỏ ----------
        const diemCua = (c) => c.diem ?? 10;
        const boThe = (s) => String(s ?? "").replace(/<[^>]*>/g, "");
        const duongBai =
            `lesson.html?subject=${encodeURIComponent(subjectUrl || subject)}` +
            `&chapter=${encodeURIComponent(chapter)}&article=${encodeURIComponent(article)}`;

        const veHinh = (ds, bai, lop) => {
            const mang = !ds ? [] : Array.isArray(ds) ? ds : [ds];
            return mang
                .map((t) => `<img class="${lop}" src="img/${subject}/${chapter}/${article}/${bai.id}/${encodeURIComponent(t)}" alt="Hình minh hoạ" loading="lazy">`)
                .join("");
        };

        // ---------- Trạng thái ----------
        const S = {
            mode: "lam",        // lam | tong | ketqua | xemlai
            i: 0,               // câu đang hiện
            ans: {},            // key -> câu trả lời (chuỗi)
            kq: null,           // key -> kết quả server trả về
            thong: null,        // tổng điểm, điểm cộng...
            loiMoi: new Set(),  // các câu sai vừa vào Sổ lỗi sai
            dangNop: false,
            daPhat: false,      // đã phát nhạc / pháo giấy ở màn kết quả chưa
        };
        const daTraLoi = (x) => String(S.ans[x.key] ?? "").trim() !== "";
        const soDaLam = () => items.filter(daTraLoi).length;

        // ---------- Khung giao diện (dựng 1 lần) ----------
        document.body.classList.add("qz-on");
        const app = document.createElement("div");
        app.id = "qz-app";
        app.innerHTML = `
      <header class="qz-top"><div class="qz-top-in">
        <button type="button" class="qz-x" id="qz-x" aria-label="Thoát">✕</button>
        <div class="qz-tien" id="qz-tien" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ"><i></i></div>
        <span class="qz-dem" id="qz-dem"></span>
        ${moPhong ? `<a class="qz-tool" href="${esc(moPhong)}" target="_blank" rel="noopener" title="Mở mô phỏng">🔬<span>Mô phỏng</span></a>` : ""}
        <button type="button" class="qz-tool" id="qz-tp-nut" hidden>📖<span>Ngữ liệu</span></button>
        <button type="button" class="qz-tool qz-am" id="qz-am" aria-label="Bật hoặc tắt âm thanh"></button>
      </div></header>
      <main class="qz-main" id="qz-main"><div class="qz-split" id="qz-split">
        <aside class="qz-tp-side" id="qz-side" hidden></aside>
        <div class="qz-stage" id="qz-stage"></div>
      </div></main>
      <footer class="qz-bottom" id="qz-bottom"><div class="qz-bottom-in" id="qz-bottom-in"></div></footer>
      <div class="qz-sheet" id="qz-sheet" hidden>
        <div class="qz-sheet-nen" data-dong></div>
        <div class="qz-sheet-hop" role="dialog" aria-modal="true" aria-label="Ngữ liệu">
          <div class="qz-sheet-dau"><b>Ngữ liệu</b><button type="button" class="qz-x" id="qz-sheet-x" aria-label="Đóng">✕</button></div>
          <div class="qz-sheet-than" id="qz-sheet-than"></div>
        </div>
      </div>`;
        document.body.appendChild(app);

        const $ = (id) => document.getElementById(id);
        const stage = $("qz-stage"), main = $("qz-main"), split = $("qz-split"), side = $("qz-side");
        const bottom = $("qz-bottom"), bottomIn = $("qz-bottom-in");
        const tien = $("qz-tien"), demEl = $("qz-dem"), nutTp = $("qz-tp-nut"), nutAm = $("qz-am");
        const sheet = $("qz-sheet"), sheetThan = $("qz-sheet-than");

        // Điện thoại: bàn phím ảo bật lên thì co khung lại để thanh nút dưới không bị che
        const vv = window.visualViewport;
        const canKhung = () => {
            app.style.height = (vv ? vv.height : innerHeight) + "px";
            app.style.top = (vv ? vv.offsetTop : 0) + "px";
        };
        if (vv) { vv.addEventListener("resize", canKhung); vv.addEventListener("scroll", canKhung); }
        addEventListener("resize", canKhung);
        canKhung();

        const veAm = () => {
            const b = Am.dangBat();
            nutAm.textContent = b ? "🔊" : "🔇";
            nutAm.setAttribute("aria-pressed", String(b));
            nutAm.title = b ? "Đang bật âm thanh" : "Đang tắt âm thanh";
        };
        nutAm.addEventListener("click", () => { Am.batTat(); veAm(); });
        veAm();

        // ====================================================================
        // DỰNG HTML
        // ====================================================================

        // Câu Đúng/Sai: ý a) mang đề chung, ý b) c) d) chỉ có phần ý. Ghép đề chung lại để mỗi màn đọc một mình vẫn hiểu.
        function deHienThi(x) {
            const { cau, bai } = x;
            let chung = "", y = cau.de_bai || "";
            if (cau.type === "dung-sai") {
                const m = /^(\d+)([a-h])$/.exec(String(cau.id));
                const a = m && (bai.cau_hoi || []).find((c) => String(c.id) === m[1] + "a");
                if (a) {
                    const cat = (a.de_bai || "").indexOf("<br><b>a)</b>");
                    if (cat >= 0) {
                        chung = a.de_bai.slice(0, cat);
                        if (chung && y.startsWith(chung)) y = y.slice(chung.length).replace(/^<br>/, "");
                    }
                }
            }
            return { chung, y };
        }

        function htmlCau(x, dang) {
            const { cau, bai } = x;
            const v = S.ans[x.key] ?? "";
            const r = S.kq && S.kq[x.key];
            const xem = dang === "xem";
            const { chung, y } = deHienThi(x);
            const loai = (b) => (xem && b ? (r && r.dung === true ? " dung" : r && r.dung === false ? " sai" : "") : "");
            let tra = "";

            if (cau.type === "trac-nghiem") {
                const ds = cau.dap_an || [];
                const dai = ds.some((t) => boThe(t).length > 38);
                tra = `<div class="qz-opts${dai ? " mot" : ""}${xem ? " khoa" : ""}" role="radiogroup">` + ds.map((t, k) => {
                    const chon = String(v) === String(k);
                    return `<button type="button" class="qz-opt${chon ? " chon" : ""}${loai(chon)}" role="radio" aria-checked="${chon}"
              data-v="${k}" style="--lc:${MAU_DA[k % MAU_DA.length]}" ${xem ? "disabled" : ""}>
              <span class="qz-k">${"ABCDEF"[k] ?? k + 1}</span><span class="qz-t">${t}</span></button>`;
                }).join("") + `</div>`;
            } else if (cau.type === "dung-sai") {
                const o = (val, cl, icon, chu) => {
                    const chon = String(v) === val;
                    return `<button type="button" class="qz-opt ${cl}${chon ? " chon" : ""}${loai(chon)}" role="radio" aria-checked="${chon}"
              data-v="${val}" ${xem ? "disabled" : ""}><span class="qz-k"><i class="fa-solid ${icon}"></i></span><span class="qz-t">${chu}</span></button>`;
                };
                tra = `<div class="qz-opts ds${xem ? " khoa" : ""}" role="radiogroup">${o("true", "ds-dung", "fa-check", "Đúng")}${o("false", "ds-sai", "fa-xmark", "Sai")}</div>`;
            } else if (cau.type === "tu-luan") {
                const tu = String(v).trim() ? String(v).trim().split(/\s+/).length : 0;
                tra = `<textarea class="qz-ta${loai(true)}" rows="7" maxlength="6000" placeholder="Viết bài làm của anh/chị..." ${xem ? "disabled" : ""}>${esc(v)}</textarea>
               <div class="qz-dem-tu">${tu} từ</div>`;
            } else {
                tra = `<input class="qz-in${loai(true)}" type="text" value="${esc(v)}" placeholder="Nhập câu trả lời..."
               autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" ${xem ? "disabled" : ""}>`;
            }

            return `
      <article class="qz-cau q-${cau.type}${xem && r && r.dung === false ? " lac" : ""}">
        <div class="qz-chips">
          <span class="qz-chip dang">${TEN_DANG[cau.type]}</span>
          <span class="qz-chip">Câu ${esc(cau.id ?? "")}</span>
          <span class="qz-chip diem">${diemCua(cau)} điểm</span>
        </div>
        ${chung ? `<div class="qz-chung">${chung}</div>` : ""}
        <div class="qz-de">${y}</div>
        ${veHinh(cau.hinh, bai, "qz-hinh")}
        ${tra}
      </article>`;
        }

        function htmlTp(bai) {
            const tp = bai.tac_pham;
            return `<h3>${tp.ten || ""}</h3>${tp.tac_gia ? `<p class="tg">Tác giả: ${tp.tac_gia}</p>` : ""}` +
                `${veHinh(tp.hinh, bai, "qz-hinh")}<div class="nd">${tp.noi_dung || ""}</div>`;
        }

        function htmlPhanHoi(x) {
            const r = S.kq[x.key], cau = x.cau;
            if (!r || r.dung === null || r.dung === undefined) {
                return `<div class="qz-ph chua"><b>Anh/chị chưa trả lời câu này.</b></div>`;
            }
            const giai = (t) => (r.loi_giai ? `<div class="qz-giai"><b>${t}</b> ${r.loi_giai}</div>` : "");
            if (cau.type === "tu-luan" && r.tu_luan) {
                return `<div class="qz-ph ${r.dung ? "dung" : "sai"}"><b>Đạt ${r.diem_dat} / ${r.diem} điểm</b>
          <ul class="tl-y">${r.tu_luan.map((y) => `<li class="${y.dat ? "dat" : "chua"}"><b>${y.dat ? "✔" : "✘"}</b> ${esc(y.noi_dung || "")}
            <small>${y.qua_ngan ? " (bài viết quá ngắn nên chưa tính)" : y.ngu_nghia ? " (chấm theo ý nghĩa)" : ""}</small></li>`).join("")}</ul>
          <p class="tl-luu-y">Hệ thống chấm theo từ khóa nên chỉ gần đúng. Hãy đối chiếu với đáp án mẫu.</p></div>` + giai("Đáp án mẫu:");
            }
            if (r.dung) return `<div class="qz-ph dung"><b>✔ Chính xác! +${r.diem} điểm</b></div>` + giai("Lời giải:");
            const coSoLoi = S.loiMoi.has(x.key) && window.SOLOI;
            return `<div class="qz-ph sai"><b>✘ Chưa đúng.</b>${cau.goi_y ? ` <span>Gợi ý: ${cau.goi_y}</span>` : ""}</div>` +
                giai("Lời giải:") +
                (coSoLoi ? `<div class="qz-cd"></div><p class="sl-ghi-chu">Lời giải sẽ mở khi anh/chị <a href="so-loi.html">sửa lỗi trong Sổ lỗi sai</a>.</p>` : "");
        }

        function htmlTong() {
            const xong = soDaLam(), con = n - xong;
            return `<section class="qz-tong">
        <div class="qz-emoji">🎯</div>
        <h2>${con ? "Gần xong rồi!" : "Làm xong hết rồi!"}</h2>
        <p>Anh/chị đã trả lời <b>${xong}/${n}</b> câu.${con ? ` Còn <b>${con}</b> câu chưa làm (ô màu cam), bấm vào số để quay lại.` : " Bấm Nộp bài để xem kết quả."}</p>
        <div class="qz-luoi">${items.map((x, k) => {
                const da = daTraLoi(x);
                return `<button type="button" class="qz-o ${da ? "da" : "chua"}" data-goto="${k}" aria-label="Câu ${k + 1}, ${da ? "đã làm" : "chưa làm"}">${k + 1}</button>`;
            }).join("")}</div>
        <p class="qz-loi" id="qz-loi" role="alert"></p>
      </section>`;
        }

        function htmlKetQua() {
            const t = S.thong;
            const pct = t.diemToiDa ? Math.round((t.diemDat / t.diemToiDa) * 100) : 0;
            const sao = pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0;
            const loi =
                pct >= 100 ? "Tuyệt đối! Không sai câu nào 🏆" :
                    pct >= 80 ? "Xuất sắc! Gần như hoàn hảo 🎉" :
                        pct >= 60 ? "Làm tốt lắm! Thêm chút nữa là hoàn hảo 💪" :
                            pct >= 30 ? "Cố lên! Xem lại rồi làm lại nhé 📘" :
                                "Đừng nản! Mỗi câu sai là một bài học 🌱";
            const mau = pct >= 80 ? "#22b573" : pct >= 50 ? "#2457d6" : "#e07a1f";
            const dem = { dung: 0, sai: 0, bo: 0 };
            items.forEach((x) => {
                const r = S.kq[x.key];
                if (r && r.dung === true) dem.dung++; else if (r && r.dung === false) dem.sai++; else dem.bo++;
            });

            const ghi = [];
            if (!userId) ghi.push("Đăng nhập để điểm được lưu nhé!");
            else if (t.daLuu && t.diemCong > 0) ghi.push(`+${t.diemCong} điểm lên bảng xếp hạng${t.heSo > 1 ? ` (thưởng ×${t.heSo.toFixed(1)})` : ""}.`);
            else if (t.diemDat > 0 && !t.daLuu) ghi.push("Bài này anh/chị đã được cộng điểm trước đó.");
            if (t.soLoi > 0) ghi.push(`<a href="so-loi.html">${t.soLoi} câu sai đã vào Sổ lỗi sai. Sửa ngay</a>`);
            const hang = userId && hangCua ? hangCua(t.bestPct) : null;

            return `<section class="qz-kq" style="--c:${mau};--pct:${pct}">
        <div class="qz-sao" aria-label="${sao} trên 3 sao">${[1, 2, 3].map((k) =>
                `<span class="${k <= sao ? "bat" : ""}" style="animation-delay:${(k - 1) * 0.18}s">★</span>`).join("")}</div>
        <h2>${loi}</h2>
        <div class="qz-vong" role="img" aria-label="${pct} phần trăm"><div><b>${pct}%</b><small>${t.diemDat} / ${t.diemToiDa} điểm</small></div></div>
        <div class="qz-thongke">
          <div class="d"><b>${dem.dung}</b><span>Đúng</span></div>
          <div class="s"><b>${dem.sai}</b><span>Sai</span></div>
          <div class="b"><b>${dem.bo}</b><span>Bỏ trống</span></div>
        </div>
        ${hang ? `<div class="qz-hang"><span class="hang-mini" style="--c:${hang.c}"><i class="fa-solid ${hang.icon}"></i></span>
          <span>Hạng cao nhất của bài này: <b style="color:${hang.c}">${hang.ten}</b> (${t.bestPct}%)</span></div>` : ""}
        ${ghi.map((g) => `<p class="qz-ghi">${g}</p>`).join("")}
        <h3>Xem lại từng câu</h3>
        <div class="qz-luoi">${items.map((x, k) => {
                    const r = S.kq[x.key];
                    const c = r && r.dung === true ? "dung" : r && r.dung === false ? "sai" : "bo";
                    return `<button type="button" class="qz-o ${c}" data-xem="${k}" aria-label="Câu ${k + 1}, ${c === "dung" ? "đúng" : c === "sai" ? "sai" : "bỏ trống"}">${k + 1}</button>`;
                }).join("")}</div>
      </section>`;
        }

        // ====================================================================
        // VẼ
        // ====================================================================
        function veTien() {
            let pct, dem;
            if (S.mode === "lam") { pct = (S.i / n) * 100; dem = `${S.i + 1}/${n}`; }
            else if (S.mode === "xemlai") { pct = ((S.i + 1) / n) * 100; dem = `${S.i + 1}/${n}`; }
            else { pct = 100; dem = S.mode === "tong" ? "Xem lại" : "Kết quả"; }
            tien.firstElementChild.style.width = pct + "%";
            tien.setAttribute("aria-valuenow", Math.round(pct));
            demEl.textContent = dem;
            $("qz-x").setAttribute("aria-label", S.mode === "xemlai" ? "Về kết quả" : "Thoát");
        }

        function veNguLieu() {
            const x = S.mode === "lam" || S.mode === "xemlai" ? items[S.i] : null;
            const tp = x && x.bai.tac_pham;
            nutTp.hidden = !tp;
            split.classList.toggle("co-tp", !!tp);
            app.classList.toggle("co-tp", !!tp);
            if (!tp) { side.hidden = true; return; }
            side.hidden = false;
            if (side.dataset.bai !== String(x.bai.id)) {   // chỉ dựng lại khi sang bài khác (giữ nguyên vị trí cuộn)
                side.innerHTML = htmlTp(x.bai);
                side.dataset.bai = x.bai.id;
                veCongThuc(side);
            }
        }

        function veDay() {
            bottom.className = "qz-bottom " + S.mode;
            let h = "";
            if (S.mode === "lam") {
                const x = items[S.i];
                h = `<button type="button" class="qz-btn phu vuong" data-act="lui" aria-label="Câu trước" ${S.i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
             <button type="button" class="qz-btn phu" data-act="bo">Bỏ qua</button>
             <span class="qz-gian"></span>
             <button type="button" class="qz-btn chinh rong" data-act="tiep" ${daTraLoi(x) ? "" : "disabled"}>${S.i === n - 1 ? "Hoàn thành" : "Tiếp tục"}</button>`;
            } else if (S.mode === "tong") {
                h = `<button type="button" class="qz-btn phu" data-act="lui" ${S.dangNop ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i><span>Sửa lại</span></button>
             <span class="qz-gian"></span>
             <button type="button" class="qz-btn chinh luc rong" data-act="nop" ${S.dangNop ? "disabled" : ""}>${S.dangNop ? '<span class="qz-quay"></span>Đang chấm bài...' : "Nộp bài"}</button>`;
            } else if (S.mode === "ketqua") {
                h = `<a class="qz-btn phu vuong" href="${duongBai}" title="Về bài học" aria-label="Về bài học"><i class="fa-solid fa-house"></i></a>
             <button type="button" class="qz-btn phu vuong" data-act="lai" title="Làm lại bài này" aria-label="Làm lại bài này"><i class="fa-solid fa-rotate-right"></i></button>
             <span class="qz-gian"></span>
             <button type="button" class="qz-btn chinh rong" data-act="xem">Xem lại từng câu</button>`;
            } else {
                const r = S.kq[items[S.i].key];
                const c = r && r.dung === true ? "dung" : r && r.dung === false ? "sai" : "chua";
                bottom.classList.add(c);
                const nhan = c === "dung" ? '<i class="fa-solid fa-circle-check"></i> Chính xác' : c === "sai" ? '<i class="fa-solid fa-circle-xmark"></i> Chưa đúng' : "Chưa trả lời";
                h = `<button type="button" class="qz-btn phu vuong" data-act="lui" aria-label="Câu trước"><i class="fa-solid fa-arrow-left"></i></button>
             <span class="qz-ph-nhan">${nhan}</span>
             <button type="button" class="qz-btn chinh" data-act="tiep">${S.i === n - 1 ? "Kết quả" : "Câu tiếp"}</button>`;
            }
            bottomIn.innerHTML = h;
        }

        function capNhatNut() {
            const b = bottom.querySelector('[data-act="tiep"]');
            if (b && S.mode === "lam") b.disabled = !daTraLoi(items[S.i]);
        }

        const comboTruoc = (i) => {
            let c = 0;
            for (let k = i - 1; k >= 0; k--) { const r = S.kq[items[k].key]; if (r && r.dung === true) c++; else break; }
            return c;
        };

        function phaoGiay(soHat) {
            if (giamCD) return;
            const mau = ["#2457d6", "#178a5a", "#e07a1f", "#7b4bd8", "#f59e0b", "#d93a3a"];
            const lop = document.createElement("div");
            lop.className = "phao-giay";
            for (let i = 0; i < soHat; i++) {
                const h = document.createElement("i");
                h.style.left = Math.random() * 100 + "%";
                h.style.background = mau[i % mau.length];
                h.style.animationDelay = Math.random() * 0.4 + "s";
                h.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
                h.style.setProperty("--lech", Math.random() * 160 - 80 + "px");
                h.style.transform = `rotate(${Math.random() * 360}deg)`;
                lop.appendChild(h);
            }
            document.body.appendChild(lop);
            setTimeout(() => lop.remove(), 3500);
        }

        // huong: 1 = đi tới (trượt từ phải), -1 = quay lại (trượt từ trái)
        function ve(huong = 1) {
            let html = "";
            if (S.mode === "lam") html = htmlCau(items[S.i], "lam");
            else if (S.mode === "tong") html = htmlTong();
            else if (S.mode === "ketqua") html = htmlKetQua();
            else html = htmlCau(items[S.i], "xem") + htmlPhanHoi(items[S.i]);

            stage.className = "qz-stage" + (giamCD ? "" : huong > 0 ? " vao-phai" : " vao-trai");
            stage.innerHTML = html;
            main.scrollTop = 0;
            veTien(); veDay(); veNguLieu();
            veCongThuc(stage);

            if (S.mode === "lam") {
                // máy tính: tự đưa con trỏ vào ô nhập. Điện thoại thì không, để khỏi bật bàn phím mỗi câu
                const o = stage.querySelector(".qz-in, .qz-ta");
                if (o && matchMedia("(hover:hover)").matches) o.focus({ preventScroll: true });
            } else if (S.mode === "xemlai") {
                const r = S.kq[items[S.i].key];
                if (r && r.dung === true) Am.dung(comboTruoc(S.i));
                else if (r && r.dung === false) Am.sai();
                const hop = stage.querySelector(".qz-cd");
                if (hop && window.SOLOI) {
                    const x = items[S.i];
                    SOLOI.veChanDoan(hop, { bai_key: `${subject}/${chapter}/${article}/${x.bai.id}`, cau_id: String(x.cau.id) });
                }
            } else if (S.mode === "ketqua" && !S.daPhat) {
                S.daPhat = true;
                const t = S.thong, pct = t.diemToiDa ? Math.round((t.diemDat / t.diemToiDa) * 100) : 0;
                Am.hoanThanh(pct);
                if (pct >= 60) phaoGiay(pct >= 90 ? 70 : 40);
            }
        }

        // ====================================================================
        // ĐIỀU HƯỚNG
        // ====================================================================
        function tiep() {
            if (S.mode === "lam") {
                if (S.i < n - 1) { S.i++; ve(1); } else { S.mode = "tong"; ve(1); }
            } else if (S.mode === "xemlai") {
                if (S.i < n - 1) { S.i++; ve(1); } else { S.mode = "ketqua"; ve(1); }
            }
        }
        function lui() {
            if (S.mode === "lam") { if (S.i > 0) { S.i--; ve(-1); } }
            else if (S.mode === "tong") { S.mode = "lam"; S.i = n - 1; ve(-1); }
            else if (S.mode === "xemlai") {
                if (S.i > 0) { S.i--; ve(-1); } else { S.mode = "ketqua"; ve(-1); }
            }
        }
        // phím Enter = nút chính của màn hiện tại
        function chinh() {
            if (S.mode === "lam") { if (daTraLoi(items[S.i])) tiep(); }
            else if (S.mode === "tong") nop();
            else if (S.mode === "ketqua") { S.mode = "xemlai"; S.i = 0; ve(1); }
            else tiep();
        }

        function chon(v) {
            const x = items[S.i];
            S.ans[x.key] = String(v);
            stage.querySelectorAll(".qz-opt").forEach((b) => {
                const on = b.dataset.v === String(v);
                b.classList.toggle("chon", on);
                b.setAttribute("aria-checked", on ? "true" : "false");
            });
            Am.chon();
            capNhatNut();
        }

        // ====================================================================
        // NỘP BÀI (dùng đúng API cũ /api/submit, mỗi bài một lần)
        // ====================================================================
        async function nop() {
            if (S.dangNop) return;
            S.dangNop = true;
            veDay();
            Am.nop();
            try {
                const theoBai = {};
                items.forEach((x) => (theoBai[x.bai.id] ||= []).push(x));
                const ket = {};
                const t = { diemDat: 0, diemToiDa: 0, daLuu: false, diemCong: 0, heSo: 1, bestPct: 0, soLoi: 0 };
                const loiMoi = new Set();

                for (const baiId of Object.keys(theoBai)) {
                    const answers = {};
                    theoBai[baiId].forEach((x) => (answers[x.cau.id] = String(S.ans[x.key] ?? "").trim()));
                    const res = await fetch(`${API}/api/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            user_id: userId ? Number(userId) : null,
                            subject, chapter, article, bai_id: String(baiId), answers,
                        }),
                    });
                    const kq = await res.json();
                    if (!kq.success) throw new Error(kq.message);

                    t.diemDat += kq.diem_dat;
                    t.diemToiDa += kq.diem_toi_da;
                    if (kq.da_luu) t.daLuu = true;
                    t.diemCong += kq.diem_cong || 0;
                    t.heSo = Math.max(t.heSo, kq.he_so || 1);
                    if (typeof kq.best_pct === "number") t.bestPct = Math.max(t.bestPct, kq.best_pct);
                    (kq.so_loi_ghi || []).forEach((id) => loiMoi.add(baiId + "|" + id));
                    theoBai[baiId].forEach((x) => (ket[x.key] = kq.ket_qua[x.cau.id] || null));

                    if (kq.streak !== null && kq.streak !== undefined) {   // cập nhật chuỗi ngày
                        localStorage.setItem("streak", kq.streak);
                        const el = document.querySelector(".streak-box span");
                        if (el) el.textContent = kq.streak;
                    }
                }
                t.soLoi = loiMoi.size;
                t.diemDat = Math.round(t.diemDat * 100) / 100;
                S.kq = ket; S.thong = t; S.loiMoi = loiMoi;
                S.dangNop = false;
                S.mode = "ketqua";
                ve(1);
            } catch (err) {
                S.dangNop = false;
                veDay();
                const l = $("qz-loi");
                if (l) l.textContent = "Không nộp được bài: " + (err.message === "Failed to fetch" ? "không kết nối được server. Bật app.py nhé!" : err.message);
            }
        }

        // ====================================================================
        // SỰ KIỆN
        // ====================================================================
        stage.addEventListener("click", (e) => {
            const go = e.target.closest("[data-goto]");
            if (go && S.mode === "tong") { S.mode = "lam"; S.i = Number(go.dataset.goto); ve(1); return; }
            const xem = e.target.closest("[data-xem]");
            if (xem && S.mode === "ketqua") { S.mode = "xemlai"; S.i = Number(xem.dataset.xem); ve(1); return; }
            const o = e.target.closest(".qz-opt");
            if (o && S.mode === "lam") chon(o.dataset.v);
        });

        stage.addEventListener("input", (e) => {
            if (S.mode !== "lam" || !e.target.matches(".qz-in, .qz-ta")) return;
            const x = items[S.i];
            const truoc = daTraLoi(x);
            S.ans[x.key] = e.target.value;
            if (!truoc && e.target.value.trim()) Am.go();
            if (e.target.matches(".qz-ta")) {
                const v = e.target.value.trim();
                stage.querySelector(".qz-dem-tu").textContent = (v ? v.split(/\s+/).length : 0) + " từ";
            }
            capNhatNut();
        });

        bottom.addEventListener("click", (e) => {
            const b = e.target.closest("[data-act]");
            if (!b || b.disabled) return;
            const a = b.dataset.act;
            if (a === "tiep" || a === "bo") tiep();
            else if (a === "lui") lui();
            else if (a === "nop") nop();
            else if (a === "xem") { S.mode = "xemlai"; S.i = 0; ve(1); }
            else if (a === "lai") location.reload();
        });

        $("qz-x").addEventListener("click", () => {
            if (S.mode === "xemlai") { S.mode = "ketqua"; ve(-1); return; }
            if ((S.mode === "lam" || S.mode === "tong") && soDaLam() > 0 &&
                !confirm("Thoát khỏi bài làm? Các câu anh/chị đã chọn sẽ không được lưu.")) return;
            location.href = duongBai;
        });

        // ---------- Ngữ liệu (điện thoại / màn hình nhỏ: mở dạng tờ giấy trượt lên) ----------
        function moTp() {
            const x = items[S.i];
            if (!x || !x.bai.tac_pham) return;
            sheetThan.innerHTML = htmlTp(x.bai);
            sheet.hidden = false;
            veCongThuc(sheetThan);
            $("qz-sheet-x").focus();
        }
        function dongTp() { sheet.hidden = true; }
        nutTp.addEventListener("click", moTp);
        $("qz-sheet-x").addEventListener("click", dongTp);
        sheet.addEventListener("click", (e) => { if (e.target.matches("[data-dong]")) dongTp(); });

        // ---------- Bàn phím (máy tính) ----------
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "Escape") { if (!sheet.hidden) dongTp(); return; }
            if (!sheet.hidden) return;
            const el = e.target, tag = el.tagName;
            const trongO = tag === "INPUT" || tag === "TEXTAREA";

            if (e.key === "Enter") {
                if (tag === "TEXTAREA" || tag === "A") return;
                // nút bình thường: để trình duyệt tự bấm. Riêng đáp án ĐANG chọn thì Enter = tiếp tục
                if (tag === "BUTTON" && !(el.classList.contains("qz-opt") && el.classList.contains("chon"))) return;
                e.preventDefault();
                chinh();
                return;
            }
            if (trongO) return;
            if (e.key === "ArrowLeft") { lui(); return; }
            if (e.key === "ArrowRight" && S.mode === "xemlai") { tiep(); return; }

            if (S.mode === "lam") {
                const x = items[S.i], k = e.key.toLowerCase();
                if (k.length !== 1) return;
                if (x.cau.type === "trac-nghiem") {
                    let idx = "abcdef".indexOf(k);
                    if (idx < 0) idx = "123456".indexOf(k);
                    if (idx >= 0 && idx < (x.cau.dap_an || []).length) { e.preventDefault(); chon(idx); }
                } else if (x.cau.type === "dung-sai") {
                    if (k === "1" || k === "d") { e.preventDefault(); chon("true"); }
                    else if (k === "2" || k === "s") { e.preventDefault(); chon("false"); }
                }
            }
        });

        ve(1);
        return true;
    }

    return { chay };
})();