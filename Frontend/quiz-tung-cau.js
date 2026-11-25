// quiz-tung-cau.js (v31) - Game hóa bài tập V31 cho Phòng Luyện tập (CHỈ áp dụng ngoài contest)
// - Chia chặng thông minh: Trắc nghiệm tách 5 câu/chặng (nhận biết lên đầu chặng 1);
//   Đúng-sai / Trả lời ngắn / Tự luận gom trọn bộ làm 1 chặng.
// - Không popup Saoladuo / pháo giấy giữa từng câu; Top bar có Segment Pills + Focus Combo (>= 5s/câu).
// - 3 nút Độ tự tin 1 chạm (Đoán thử / Khá chắc / Rất chắc) thay nút Kiểm tra: chấm tức thì + thưởng 2 ví.
// - Giữ quy tắc GIAU_LOI_GIAI_KHI_SAI: trả lời sai tuyệt đối KHÔNG lộ lời giải/đáp án đúng ngay lúc làm.
// - Tổng kết cuối mỗi chặng (#qz-stage-summary) hiện Saoladuo 6 khung + Vá nóng câu sai/đoán thử.
window.QuizTungCau = (() => {
    "use strict";

    const TEN_DANG = {
        "trac-nghiem": "Trắc nghiệm",
        "dung-sai": "Đúng / Sai",
        "tra-loi-ngan": "Trả lời ngắn",
        "tu-luan": "Tự luận",
    };
    const ICON_DANG = {
        "trac-nghiem": "fa-list-ul",
        "dung-sai": "fa-circle-half-stroke",
        "tra-loi-ngan": "fa-pen",
        "tu-luan": "fa-align-left",
    };
    const HUONG_DAN = {
        "trac-nghiem": 'Chọn 1 đáp án rồi chọn mức độ tự tin ở thanh dưới. Chuột phải (hoặc <b class="qz-huong-loai"><i class="fa-solid fa-ban"></i></b>) để loại trừ. <span class="qz-phim">Phím tắt: A–D chọn, 1–3 tự tin, F phân vân.</span>',
        "dung-sai": 'Chọn Đúng hoặc Sai rồi chọn mức độ tự tin. <span class="qz-phim">Phím tắt: D/S chọn, 1–3 tự tin, F phân vân.</span>',
        "tra-loi-ngan": 'Nhập đáp án ngắn gọn rồi bấm mức độ tự tin (hoặc nhấn Enter = Khá chắc). <span class="qz-phim">Phím 🚩 đánh dấu phân vân.</span>',
        "tu-luan": "Viết bài làm đầy đủ ý, nêu các từ khóa quan trọng rồi chọn mức độ tự tin.",
    };
    const CONF_LEVELS = [
        {
            id: "doan_thu",
            ten: "Đoán thử",
            key: "1",
            img: "img/bai-tap/icon_doan_thu.png",
            fb: "🤔",
            cls: "doan",
            sub: "+1 coin",
        },
        {
            id: "kha_chac",
            ten: "Khá chắc",
            key: "2",
            img: "img/bai-tap/icon_kha_chac.png",
            fb: "👍",
            cls: "kha",
            sub: "+2 coin",
        },
        {
            id: "rat_chac",
            ten: "Rất chắc",
            key: "3",
            img: "img/bai-tap/icon_rat_chac.png",
            fb: "🔥",
            cls: "rat",
            sub: "+3 coin",
        },
    ];
    const MAU_DA = ["#2457d6"];

    const an = (f) => {
        try { f(); } catch (e) { console.error("[quiz-tung-cau]", e); }
    };

    /**
     * Tách danh sách câu hỏi thành từng chặng thông minh theo quy tắc V31:
     * - Ưu tiên đưa câu do_kho = 1 lên đầu run trắc nghiệm đầu tiên để tạo Quick Win.
     * - Trắc nghiệm: cứ 5 câu liên tiếp = 1 chặng.
     * - Đúng/sai, Trả lời ngắn, Tự luận: gom trọn bộ liên tiếp của dạng đó = 1 chặng.
     */
    function buildSegments(dsBai) {
        const groupedRuns = [];
        let curRun = null;

        (dsBai || []).forEach((bai) => {
            const dsCau = (bai.cau_hoi || []).filter((c) => TEN_DANG[c.type]);
            dsCau.forEach((cau) => {
                const type = cau.type;
                const item = { cau, bai, key: bai.id + "|" + cau.id };
                const sameTp = curRun && (curRun.baiTp === (bai.tac_pham ? bai.id : null));
                const sameSubBai = curRun && (type !== "trac-nghiem" ? curRun.baiId === bai.id : sameTp);
                if (!curRun || curRun.type !== type || !sameSubBai) {
                    curRun = {
                        type,
                        baiId: bai.id,
                        baiTp: bai.tac_pham ? bai.id : null,
                        baiDoKho: Number(bai.do_kho || 0),
                        items: [],
                    };
                    groupedRuns.push(curRun);
                }
                curRun.items.push(item);
            });
        });

        // Quick Win: trong run trắc nghiệm đầu tiên, đưa câu mức 1 (Nhận biết) lên đầu nếu có trộn nhiều độ khó
        if (groupedRuns.length && groupedRuns[0].type === "trac-nghiem") {
            const first = groupedRuns[0].items;
            const easy = first.filter((it) => Number(it.cau.do_kho ?? it.bai.do_kho ?? 0) === 1);
            const rest = first.filter((it) => Number(it.cau.do_kho ?? it.bai.do_kho ?? 0) !== 1);
            if (easy.length && rest.length) groupedRuns[0].items = [...easy, ...rest];
        }

        const items = [];
        const segments = [];
        let tnCount = 0;

        groupedRuns.forEach((run) => {
            if (run.type === "trac-nghiem") {
                for (let s = 0; s < run.items.length; s += 5) {
                    const slice = run.items.slice(s, s + 5);
                    const start = items.length;
                    const segIdx = segments.length;
                    slice.forEach((it) => {
                        it.segIdx = segIdx;
                        items.push(it);
                    });
                    tnCount++;
                    segments.push({
                        id: `chang-${segIdx + 1}`,
                        idx: segIdx,
                        loai: "trac-nghiem",
                        title: `Chặng ${segIdx + 1} · Trắc nghiệm (Phần ${tnCount})`,
                        shortTitle: `Chặng ${segIdx + 1}`,
                        start,
                        end: items.length - 1,
                        indices: slice.map((_, idx) => start + idx),
                    });
                }
            } else {
                const start = items.length;
                const segIdx = segments.length;
                run.items.forEach((it) => {
                    it.segIdx = segIdx;
                    items.push(it);
                });
                const tenDang = TEN_DANG[run.type] || "Luyện tập";
                segments.push({
                    id: `chang-${segIdx + 1}`,
                    idx: segIdx,
                    loai: run.type,
                    title: `Chặng ${segIdx + 1} · Trọn phần ${tenDang}`,
                    shortTitle: `Phần ${tenDang}`,
                    start,
                    end: items.length - 1,
                    indices: run.items.map((_, idx) => start + idx),
                });
            }
        });

        return { items, segments };
    }

    function chay(ctx) {
        const { API, subject, subjectUrl, chapter, article, userId, dsBai, moPhong, lyThuyet, esc, veCongThuc, Am } = ctx;
        const isPractice = String(subject || "").toLowerCase() !== "contest";
        const hangCua = window.hangCua;
        const giamCD = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

        const { items, segments } = buildSegments(dsBai);
        if (!items.length) return false;
        const n = items.length;

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

        // ---------- Khôi phục tiến độ đang làm dở ----------
        const thamSoQ = new URLSearchParams(window.location.search).get("q");
        const KHOA_LUU_TIEN_TRINH_PHU = `quiz_draft_${(subjectUrl || subject).replace(/_/g, "-")}_${chapter}_${article}`;
        const KHOA_LUU_TIEN_TRINH = `${KHOA_LUU_TIEN_TRINH_PHU}${thamSoQ ? "_" + thamSoQ : ""}`;
        let draftCu = null;
        try {
            draftCu = JSON.parse(localStorage.getItem(KHOA_LUU_TIEN_TRINH) || localStorage.getItem(KHOA_LUU_TIEN_TRINH_PHU));
        } catch (e) {}

        // ---------- Trạng thái ----------
        const S = {
            mode: "lam",        // lam | chang | tong | ketqua | xemlai
            i: (draftCu && typeof draftCu.i === "number" && draftCu.i >= 0 && draftCu.i < n) ? draftCu.i : 0,
            ans: (draftCu && draftCu.ans && typeof draftCu.ans === "object") ? draftCu.ans : {},
            phanVan: new Set((draftCu && Array.isArray(draftCu.phanVan)) ? draftCu.phanVan : []),
            loaiTru: (draftCu && draftCu.loaiTru && typeof draftCu.loaiTru === "object")
                ? Object.fromEntries(Object.entries(draftCu.loaiTru).map(([k, arr]) => [k, new Set(arr)]))
                : {},
            results: (draftCu && draftCu.results && typeof draftCu.results === "object") ? draftCu.results : {},
            timeSpent: (draftCu && draftCu.timeSpent && typeof draftCu.timeSpent === "object") ? draftCu.timeSpent : {},
            focusAwarded: (draftCu && draftCu.focusAwarded && typeof draftCu.focusAwarded === "object") ? draftCu.focusAwarded : {},
            activeSegIdx: (draftCu && typeof draftCu.activeSegIdx === "number") ? draftCu.activeSegIdx : 0,
            questionShownAt: Date.now(),
            isChecking: false,
            stageRetryOpen: false,
            stageRetryState: {}, // key -> { dung, msg, checking }
            kq: null,
            thong: null,
            loiMoi: new Set(),
            dangNop: false,
            daPhat: false,
            modal: false,
        };

        const daTraLoi = (x) => String(S.ans[x.key] ?? "").trim() !== "";
        const soDaLam = () => items.filter(daTraLoi).length;
        const dangPhanVan = (x) => S.phanVan.has(x.key);
        const soPhanVan = () => items.filter(dangPhanVan).length;
        const daLoai = (x, val) => !!(S.loaiTru[x.key] && S.loaiTru[x.key].has(String(val)));
        const daCham = (x) => !!(isPractice && S.results[x.key]);

        const currentSegIdx = () => {
            if (S.mode === "chang") return Math.max(0, Math.min(segments.length - 1, S.activeSegIdx));
            return items[S.i] ? items[S.i].segIdx : 0;
        };

        const tinhComboChang = (segIdx) => {
            const seg = segments[segIdx];
            if (!seg) return { combo: 0, maxCombo: 0, allValid5s: true };
            let cur = 0, maxCombo = 0, curValid = true, bestValid = false;
            seg.indices.forEach((idx) => {
                const it = items[idx];
                const r = S.results[it.key];
                if (r && r.dung === true) {
                    cur++;
                    if (!r.hop_le_focus) curValid = false;
                    if (cur > maxCombo || (cur === maxCombo && curValid)) {
                        maxCombo = cur;
                        bestValid = curValid;
                    }
                } else {
                    cur = 0;
                    curValid = true;
                }
            });
            // Combo đang chạy tính tới câu đã chấm gần nhất trong chặng
            let live = 0, liveValid = true;
            for (let k = seg.indices.length - 1; k >= 0; k--) {
                const r = S.results[items[seg.indices[k]].key];
                if (!r) continue;
                if (r.dung === true) {
                    live++;
                    if (!r.hop_le_focus) liveValid = false;
                } else break;
            }
            return { combo: live, maxCombo, liveValid, bestValid };
        };

        const tongViPhien = () => {
            let coin = 0, score = 0;
            Object.values(S.results).forEach((r) => {
                if (r && r.lan_dau) {
                    coin += Number(r.thuong_coin || 0);
                    score += Number(r.thuong_score || 0);
                }
            });
            Object.values(S.focusAwarded).forEach((f) => {
                if (f && f.thuong_coin) {
                    coin += Number(f.thuong_coin || 0);
                    score += Number(f.thuong_score || 0);
                }
            });
            return { coin, score };
        };

        const tenBaiHienThi = (() => {
            const b0 = dsBai && dsBai[0];
            if (b0 && b0.ten) return (b0.id ? `Bài ${b0.id}: ${b0.ten}` : b0.ten);
            if (items[0] && items[0].bai && items[0].bai.ten) {
                return items[0].bai.id ? `Bài ${items[0].bai.id}: ${items[0].bai.ten}` : items[0].bai.ten;
            }
            return `Bài tập ${chapter} - ${article}`;
        })();
        const linkLamTiep = `form.html?subject=${encodeURIComponent(subjectUrl || subject)}&chapter=${encodeURIComponent(chapter)}&article=${encodeURIComponent(article)}${thamSoQ ? `&q=${encodeURIComponent(thamSoQ)}` : ""}`;

        function layKhoaDoDangBai(subKey) {
            return `baiDangLamBai_${subKey}_${chapter || ""}_${article || ""}${thamSoQ ? "_" + thamSoQ : ""}`;
        }

        function trungBaiDoDang(item, subKey) {
            if (!item) return false;
            if (item.link === linkLamTiep) return true;
            try {
                const sp = new URL(item.link || "", "http://local").searchParams;
                const s = (item.subject || sp.get("subject") || "").replace(/_/g, "-");
                const c = item.chapter || sp.get("chapter") || "";
                const a = item.article || sp.get("article") || "";
                const q = item.q !== undefined && item.q !== "" ? String(item.q) : (sp.get("q") || "");
                return s === subKey && c === String(chapter || "") && a === String(article || "") && q === String(thamSoQ || "");
            } catch (e) {
                return false;
            }
        }

        function dongBoBaiDaiNhatMon(subKey) {
            const prefix = "baiDangLamBai_" + subKey + "_";
            const list = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    try {
                        const it = JSON.parse(localStorage.getItem(k) || "null");
                        if (it && it.daLam > 0 && it.daLam < it.tongCau) list.push(it);
                    } catch (e) {}
                }
            }
            if (list.length === 0) {
                localStorage.removeItem("baiDangLam_" + subKey);
                localStorage.removeItem("baiDangLam_" + subKey.replace(/-/g, "_"));
                try {
                    const c = JSON.parse(localStorage.getItem("baiDangLam") || "null");
                    if (c && (c.subject === subKey || c.subject === subKey.replace(/-/g, "_"))) {
                        localStorage.removeItem("baiDangLam");
                    }
                } catch (e) {}
                return;
            }
            list.sort((a, b) => {
                const ca = a.conLai !== undefined ? Number(a.conLai) : Math.max(0, Number(a.tongCau) - Number(a.daLam));
                const cb = b.conLai !== undefined ? Number(b.conLai) : Math.max(0, Number(b.tongCau) - Number(b.daLam));
                if (cb !== ca) return cb - ca;
                return (b.capNhat || 0) - (a.capNhat || 0);
            });
            localStorage.setItem("baiDangLam_" + subKey, JSON.stringify(list[0]));
        }

        function luuTrangThaiDoDang(daLamSo, tongSo) {
            const subKey = (subjectUrl || subject).replace(/_/g, "-");
            if (subKey === "contest") return;
            if (daLamSo > 0 && (S.mode === "lam" || S.mode === "tong" || S.mode === "chang")) {
                const conLai = Math.max(0, tongSo - daLamSo);
                const thongTin = {
                    subject: subKey,
                    chapter: String(chapter || ""),
                    article: String(article || ""),
                    q: thamSoQ ? String(thamSoQ) : "",
                    ten: tenBaiHienThi,
                    tongCau: tongSo,
                    daLam: daLamSo,
                    conLai,
                    link: linkLamTiep,
                    cauHienTai: S.i,
                    capNhat: Date.now()
                };
                localStorage.setItem(layKhoaDoDangBai(subKey), JSON.stringify(thongTin));
                dongBoBaiDaiNhatMon(subKey);
                localStorage.setItem("baiDangLam", JSON.stringify(thongTin));
                try {
                    localStorage.setItem(KHOA_LUU_TIEN_TRINH, JSON.stringify({
                        ans: S.ans,
                        phanVan: Array.from(S.phanVan),
                        loaiTru: Object.fromEntries(Object.entries(S.loaiTru).map(([k, set]) => [k, Array.from(set)])),
                        results: S.results,
                        timeSpent: S.timeSpent,
                        focusAwarded: S.focusAwarded,
                        activeSegIdx: S.activeSegIdx,
                        i: S.i
                    }));
                } catch (e) {}
            }
        }

        function xoaTrangThaiDoDang() {
            const subKey = (subjectUrl || subject).replace(/_/g, "-");
            localStorage.removeItem(layKhoaDoDangBai(subKey));
            localStorage.removeItem(KHOA_LUU_TIEN_TRINH);
            localStorage.removeItem(KHOA_LUU_TIEN_TRINH_PHU);
            try {
                const legacy = JSON.parse(localStorage.getItem("baiDangLam_" + subKey) || "null");
                if (trungBaiDoDang(legacy, subKey)) localStorage.removeItem("baiDangLam_" + subKey);
                const legacyUnder = JSON.parse(localStorage.getItem("baiDangLam_" + subKey.replace(/-/g, "_")) || "null");
                if (trungBaiDoDang(legacyUnder, subKey)) localStorage.removeItem("baiDangLam_" + subKey.replace(/-/g, "_"));
            } catch (e) {}
            dongBoBaiDaiNhatMon(subKey);
        }

        const xuLyThoatTrang = () => {
            if ((S.mode === "lam" || S.mode === "tong" || S.mode === "chang") && soDaLam() > 0) {
                luuTrangThaiDoDang(soDaLam(), n);
            }
        };
        window.addEventListener("beforeunload", xuLyThoatTrang);
        window.addEventListener("pagehide", xuLyThoatTrang);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") xuLyThoatTrang();
        });

        // ---------- Khung giao diện ----------
        document.body.classList.add("qz-on");
        if (isPractice) document.body.classList.add("qz-v31-practice");
        const app = document.createElement("div");
        app.id = "qz-app";
        app.innerHTML = `
      <header class="qz-top" id="qz-top"><div class="qz-top-in">
        <button type="button" class="qz-x" id="qz-x" aria-label="Thoát">✕</button>
        <div class="qz-tien" id="qz-tien" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ làm bài">
          <div class="qz-segs" id="qz-segs" hidden></div>
          <div class="qz-tien-ray" id="qz-tien-ray"><span class="qz-tien-fill" id="qz-tien-fill"></span></div>
          <span class="qz-tien-moc" id="qz-tien-moc" aria-hidden="true"></span>
        </div>
        <span class="qz-focus-pill" id="qz-focus-pill" hidden></span>
        <span class="qz-dem" id="qz-dem" aria-live="polite"></span>
        ${lyThuyet ? `<button type="button" class="qz-tool" id="qz-lt-nut" title="Xem lại lý thuyết bài học">📘<span>Lý thuyết</span></button>` : ""}
        ${moPhong ? `<a class="qz-tool" href="${esc(moPhong)}" target="_blank" rel="noopener" title="Mở mô phỏng">🔬<span>Mô phỏng</span></a>` : ""}
        <button type="button" class="qz-tool" id="qz-tp-nut" hidden>📖<span>Ngữ liệu</span></button>
        <button type="button" class="qz-tool" id="qz-ds" title="Xem tổng quan các câu và nộp bài"><i class="fa-solid fa-table-cells"></i><span>Tổng quan</span></button>
        <button type="button" class="qz-tool qz-am" id="qz-am" aria-label="Bật hoặc tắt âm thanh"></button>
      </div></header>
      <main class="qz-main" id="qz-main"><div class="qz-layout" id="qz-layout">
        <div class="qz-split" id="qz-split">
          <aside class="qz-tp-side" id="qz-side" hidden></aside>
          <div class="qz-stage" id="qz-stage"></div>
        </div>
        <aside class="qz-nav" id="qz-nav" aria-label="Bảng câu hỏi">
          <section class="qz-nav-card qz-nav-stat" id="qz-nav-stat"></section>
          <section class="qz-nav-card qz-nav-bang">
            <div class="qz-nav-dau"><b><i class="fa-solid fa-table-cells-large"></i>Bảng câu hỏi</b><span id="qz-nav-dem"></span></div>
            <div class="qz-nav-luoi" id="qz-nav-luoi"></div>
            <div class="qz-nav-chuthich" id="qz-nav-chuthich"></div>
          </section>
          <button type="button" class="qz-btn chinh rong qz-nav-nut" id="qz-nav-nut"></button>
        </aside>
      </div></main>
      <footer class="qz-bottom" id="qz-bottom"><div class="qz-bottom-in" id="qz-bottom-in"></div></footer>

      <div class="qz-sheet" id="qz-sheet" hidden>
        <div class="qz-sheet-nen" data-dong></div>
        <div class="qz-sheet-hop" role="dialog" aria-modal="true" aria-labelledby="qz-sheet-tieu">
          <div class="qz-sheet-dau"><b id="qz-sheet-tieu">Ngữ liệu</b><button type="button" class="qz-x" id="qz-sheet-x" aria-label="Đóng">✕</button></div>
          <div class="qz-sheet-than" id="qz-sheet-than"></div>
        </div>
      </div>

      <div class="qz-modal" id="qz-modal" hidden>
        <div class="qz-modal-nen" data-huy></div>
        <div class="qz-modal-hop" role="alertdialog" aria-modal="true" aria-labelledby="qz-m-tieu" aria-describedby="qz-m-nd">
          <div class="qz-m-icon" id="qz-m-icon"></div>
          <h3 id="qz-m-tieu"></h3>
          <p id="qz-m-nd"></p>
          <div class="qz-m-nut">
            <button type="button" class="qz-btn" id="qz-m-huy"></button>
            <button type="button" class="qz-btn chinh" id="qz-m-ok"></button>
          </div>
        </div>
      </div>`;
        document.body.appendChild(app);

        const $ = (id) => document.getElementById(id);
        const topEl = $("qz-top"), stage = $("qz-stage"), main = $("qz-main"), split = $("qz-split"), side = $("qz-side");
        const bottom = $("qz-bottom"), bottomIn = $("qz-bottom-in");
        const tien = $("qz-tien"), segsEl = $("qz-segs"), tienRay = $("qz-tien-ray");
        const demEl = $("qz-dem"), focusPill = $("qz-focus-pill");
        const nutTp = $("qz-tp-nut"), nutLt = $("qz-lt-nut"), nutAm = $("qz-am"), nutDs = $("qz-ds");
        const sheet = $("qz-sheet"), sheetThan = $("qz-sheet-than"), sheetTieu = $("qz-sheet-tieu");
        const modal = $("qz-modal");
        const navStat = $("qz-nav-stat"), navDem = $("qz-nav-dem"), navLuoi = $("qz-nav-luoi");
        const navChuThich = $("qz-nav-chuthich"), navNut = $("qz-nav-nut");
        const tienFill = $("qz-tien-fill"), tienMoc = $("qz-tien-moc");

        navLuoi.innerHTML = items.map((_, k) => `<button type="button" class="qz-n" data-nav="${k}">${k + 1}</button>`).join("");
        const tongDiem = Math.round(items.reduce((s, x) => s + diemCua(x.cau), 0) * 100) / 100;

        const viTriCau = (clientX) => {
            const r = tien.getBoundingClientRect();
            const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 0.9999);
            return Math.floor(t * n);
        };

        const vv = window.visualViewport;
        const canKhung = () => {
            app.style.height = (vv ? vv.height : innerHeight) + "px";
            app.style.top = (vv ? vv.offsetTop : 0) + "px";
        };
        if (vv) { vv.addEventListener("resize", canKhung); vv.addEventListener("scroll", canKhung); }
        addEventListener("resize", canKhung);
        canKhung();

        const datChieuCaoDay = () => {
            document.body.style.setProperty("--qz-foot", bottom.offsetHeight + "px");
            if (topEl) document.body.style.setProperty("--qz-top", topEl.offsetHeight + "px");
        };
        if (window.ResizeObserver) new ResizeObserver(datChieuCaoDay).observe(bottom);
        datChieuCaoDay();

        const capNhatPhu = () => document.body.classList.toggle("qz-phu-on", S.modal || !sheet.hidden);

        const veAm = () => {
            const b = Am.dangBat();
            nutAm.textContent = b ? "🔊" : "🔇";
            nutAm.setAttribute("aria-pressed", String(b));
            nutAm.title = b ? "Đang bật âm thanh" : "Đang tắt âm thanh";
        };
        nutAm.addEventListener("click", () => { Am.batTat(); veAm(); });
        window.addEventListener("amthanh:doi", veAm);
        veAm();

        function hoi(o) {
            return new Promise((xong) => {
                if (S.modal) { xong(false); return; }
                S.modal = true;
                const truocFocus = document.activeElement;
                const huy = $("qz-m-huy"), ok = $("qz-m-ok");
                const vungNen = [topEl, main, bottom];

                $("qz-m-icon").className = "qz-m-icon " + (o.mau || "xanh");
                $("qz-m-icon").innerHTML = `<i class="fa-solid ${o.icon || "fa-circle-question"}"></i>`;
                $("qz-m-tieu").textContent = o.tieuDe;
                $("qz-m-nd").textContent = o.noiDung;
                huy.textContent = o.huy || "Hủy";
                ok.textContent = o.ok || "Đồng ý";
                ok.classList.toggle("nguy", !!o.nguy);

                modal.hidden = false;
                vungNen.forEach((el) => { el.inert = true; });
                capNhatPhu();

                const dong = (kq) => {
                    modal.hidden = true;
                    S.modal = false;
                    huy.onclick = ok.onclick = modal.onclick = modal.onkeydown = null;
                    vungNen.forEach((el) => { el.inert = false; });
                    capNhatPhu();
                    if (truocFocus && truocFocus.focus) truocFocus.focus({ preventScroll: true });
                    xong(kq);
                };
                huy.onclick = () => dong(false);
                ok.onclick = () => dong(true);
                modal.onclick = (e) => { if (e.target.matches("[data-huy]")) dong(false); };
                modal.onkeydown = (e) => {
                    if (e.key === "Escape") { e.stopPropagation(); dong(false); return; }
                    if (e.key !== "Tab") return;
                    const dau = e.shiftKey ? huy : ok, cuoi = e.shiftKey ? ok : huy;
                    if (document.activeElement === dau) { e.preventDefault(); cuoi.focus(); }
                };
                huy.focus();
            });
        }

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

        function htmlInstantFeedback(x, inst) {
            if (!inst) return "";
            const confLabel = CONF_LEVELS.find((c) => c.id === inst.do_tu_tin)?.ten || "";
            const thuongBadges = inst.dung && inst.lan_dau && inst.thuong_coin > 0
                ? `<span class="qz-ifb-reward"><i class="fa-solid fa-coins"></i> +${inst.thuong_coin} EduCoin · +${inst.thuong_score} Điểm</span>`
                : inst.dung && !inst.lan_dau
                    ? `<span class="qz-ifb-reward is-muted">Đã tính thưởng ở lần đầu</span>`
                    : "";

            if (inst.dung) {
                const mayMan = inst.may_man;
                const savedBtn = mayMan
                    ? (inst.saved_lucky
                        ? `<span class="qz-lucky-saved"><i class="fa-solid fa-bookmark"></i> Đã lưu vào Sổ lỗi sai</span>`
                        : `<button type="button" class="qz-btn-lucky" data-act="save-lucky"><i class="fa-solid fa-thumbtack"></i> Lưu vào Sổ lỗi sai</button>`)
                    : "";
                const tlList = x.cau.type === "tu-luan" && inst.tu_luan
                    ? `<ul class="tl-y">${inst.tu_luan.map((yy) => `<li class="${yy.dat ? "dat" : "chua"}"><b>${yy.dat ? "✔" : "✘"}</b> ${esc(yy.noi_dung || "")}</li>`).join("")}</ul>`
                    : "";
                const giai = inst.loi_giai
                    ? `<details class="qz-ifb-giai"><summary><i class="fa-solid fa-book-open"></i> Xem giải thích chi tiết</summary><div class="qz-ifb-giai-nd">${inst.loi_giai}</div></details>`
                    : "";
                return `
                  <div class="qz-instant-fb ${mayMan ? "is-lucky" : "is-right"}">
                    <div class="qz-ifb-top">
                      <span class="qz-ifb-badge">${mayMan ? "🍀 Đúng do may mắn" : "✔ Chính xác"} · ${esc(confLabel)}</span>
                      ${thuongBadges}
                    </div>
                    <p class="qz-ifb-msg">${esc(inst.thong_diep || "")}</p>
                    ${tlList}
                    ${savedBtn ? `<div class="qz-ifb-actions">${savedBtn}</div>` : ""}
                    ${giai}
                  </div>`;
            }

            // SAI -> TUYỆT ĐỐI KHÔNG lộ lời giải / đáp án đúng (Hypercorrection cuối chặng)
            const gapBadge = inst.lo_hong_an
                ? `<span class="qz-ifb-gap">🔥 Lỗ hổng ẩn (Ưu tiên 1)</span>`
                : `<span class="qz-ifb-gap soft"><i class="fa-solid fa-bookmark"></i> Đã ghi Sổ lỗi sai</span>`;
            const goiY = inst.goi_y
                ? `<div class="qz-ifb-hint"><b><i class="fa-solid fa-lightbulb"></i> Gợi ý Tầng 1:</b> ${inst.goi_y}</div>`
                : "";
            const tlWrong = x.cau.type === "tu-luan" && inst.tu_luan
                ? `<p class="qz-ifb-sub">Bài tự luận đạt <b>${inst.diem_dat}/${inst.diem}</b> điểm — bạn có thể kiểm tra lại ở tổng kết chặng.</p>`
                : "";

            return `
              <div class="qz-instant-fb is-wrong${inst.lo_hong_an ? " is-gap" : ""}">
                <div class="qz-ifb-top">
                  <span class="qz-ifb-badge">✘ Chưa đúng · ${esc(confLabel)}</span>
                  ${gapBadge}
                </div>
                <p class="qz-ifb-msg">${esc(inst.thong_diep || "")}</p>
                ${tlWrong}
                ${goiY}
                <p class="qz-ifb-lock"><i class="fa-solid fa-lock"></i> Đáp án &amp; lời giải tạm ẩn để bạn tự "Vá nóng" ở cuối chặng.</p>
              </div>`;
        }

        function htmlCau(x, dang) {
            const { cau, bai } = x;
            const v = S.ans[x.key] ?? "";
            const r = S.kq && S.kq[x.key];
            const inst = isPractice ? S.results[x.key] : null;
            const xem = dang === "xem";
            const locked = xem || !!inst;
            const pv = dangPhanVan(x);
            const { chung, y } = deHienThi(x);
            const loai = (b) => {
                if (xem && b) return r && r.dung === true ? " dung" : r && r.dung === false ? " sai" : "";
                if (inst && b) return inst.dung ? " dung" : " sai";
                return "";
            };
            const tick = (b) => `<i class="fa-solid ${((xem && r && r.dung === false) || (inst && !inst.dung)) && b ? "fa-xmark" : "fa-check"} qz-tick"></i>`;
            let tra = "";

            if (cau.type === "trac-nghiem") {
                const ds = cau.dap_an || [];
                const dai = ds.some((t) => boThe(t).length > 38);
                tra = `<div class="qz-opts${dai ? " mot" : ""}${locked ? " khoa" : ""}" role="radiogroup">` + ds.map((t, k) => {
                    const chon = String(v) === String(k);
                    const biLoai = !locked && daLoai(x, k);
                    const nutLoai = locked ? "" : `<span class="qz-loai-nut${biLoai ? " on" : ""}" data-loai="${k}" role="button" tabindex="0" aria-label="${biLoai ? "Bỏ gạch đáp án" : "Gạch loại trừ đáp án"} ${"ABCDEF"[k] ?? k + 1}" title="${biLoai ? "Bỏ gạch đáp án này" : "Gạch loại trừ đáp án sai (hoặc chuột phải)"}"><i class="fa-solid ${biLoai ? "fa-rotate-left" : "fa-ban"}"></i></span>`;
                    return `<button type="button" class="qz-opt${chon ? " chon" : ""}${biLoai ? " bi-loai" : ""}${loai(chon)}" role="radio" aria-checked="${chon}"
              data-v="${k}" style="--lc:${MAU_DA[k % MAU_DA.length]}" ${locked ? "disabled" : ""}>
              <span class="qz-k">${"ABCDEF"[k] ?? k + 1}</span><span class="qz-t">${t}</span>${nutLoai}${tick(chon)}</button>`;
                }).join("") + `</div>`;
            } else if (cau.type === "dung-sai") {
                const o = (val, cl, icon, chu) => {
                    const chon = String(v) === val;
                    return `<button type="button" class="qz-opt ${cl}${chon ? " chon" : ""}${loai(chon)}" role="radio" aria-checked="${chon}"
              data-v="${val}" ${locked ? "disabled" : ""}><span class="qz-k"><i class="fa-solid ${icon}"></i></span><span class="qz-t">${chu}</span>${tick(chon)}</button>`;
                };
                tra = `<div class="qz-opts ds${locked ? " khoa" : ""}" role="radiogroup">${o("true", "ds-dung", "fa-check", "Đúng")}${o("false", "ds-sai", "fa-xmark", "Sai")}</div>`;
            } else if (cau.type === "tu-luan") {
                const tu = String(v).trim() ? String(v).trim().split(/\s+/).length : 0;
                tra = `<textarea class="qz-ta${loai(true)}" rows="7" maxlength="6000" placeholder="Viết bài làm của bạn..." ${locked ? "disabled" : ""}>${esc(v)}</textarea>
               <div class="qz-dem-tu">${tu} từ</div>`;
            } else {
                tra = `<input class="qz-in${loai(true)}" type="text" value="${esc(v)}" placeholder="Nhập câu trả lời..."
               autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" ${locked ? "disabled" : ""}>`;
            }

            const seg = segments[x.segIdx] || {};
            const segLabel = seg.shortTitle ? `<span class="qz-chip chang"><i class="fa-solid fa-layer-group"></i>${esc(seg.shortTitle)}</span>` : "";

            return `
      <article class="qz-cau q-${cau.type}${xem && r && r.dung === false ? " lac" : ""}${inst && !inst.dung ? " lac-nhe" : ""}${!locked && pv ? " phan-van" : ""}">
        <header class="qz-head">
          <div class="qz-so"><small>Câu</small><b>${esc(cau.id ?? "")}</b></div>
          <div class="qz-head-tt">
            ${segLabel}
            <span class="qz-chip dang"><i class="fa-solid ${ICON_DANG[cau.type]}"></i>${TEN_DANG[cau.type]}</span>
            <span class="qz-sub">Thứ tự ${items.indexOf(x) + 1} / ${n}</span>
          </div>
          <div class="qz-head-actions">
            ${locked ? "" : `<button type="button" class="qz-flag${pv ? " on" : ""}" data-act="flag" aria-pressed="${pv}" title="Đánh dấu câu chưa chắc chắn để xem lại trước khi nộp (Phím tắt: F)">
              <i class="fa-${pv ? "solid" : "regular"} fa-flag"></i><span>${pv ? "Đang phân vân" : "Chưa chắc"}</span>
            </button>`}
            <span class="qz-chip diem"><i class="fa-solid fa-star"></i>${diemCua(cau)} điểm</span>
          </div>
        </header>
        <div class="qz-than">
          ${chung ? `<div class="qz-chung">${chung}</div>` : ""}
          <div class="qz-de">${y}</div>
          ${veHinh(cau.hinh, bai, "qz-hinh")}
          ${locked ? "" : `<p class="qz-huong"><i class="fa-regular fa-lightbulb"></i><span>${HUONG_DAN[cau.type]}</span></p>`}
          ${tra}
          ${!xem && inst ? htmlInstantFeedback(x, inst) : ""}
        </div>
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
                return `<div class="qz-ph chua"><b>Bạn chưa trả lời câu này.</b></div>`;
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
                (coSoLoi
                    ? `<div class="qz-cd"></div><p class="sl-ghi-chu"><i class="fa-solid fa-lock"></i> Lời giải chi tiết được khóa tạm thời để bạn tự suy nghĩ lại — hãy <a href="so-loi.html">sửa lỗi trong Sổ lỗi sai</a> để mở khóa lời giải nhé!</p>`
                    : giai("Lời giải:"));
        }

        function layDsVaNong(seg) {
            return seg.indices
                .map((idx) => items[idx])
                .filter((x) => {
                    const r = S.results[x.key];
                    return r && (!r.dung || r.may_man);
                });
        }

        function htmlRetryCard(x) {
            const r = S.results[x.key] || {};
            const st = S.stageRetryState[x.key] || {};
            const { cau, bai } = x;
            const { chung, y } = deHienThi(x);
            const curVal = st.ans !== undefined ? st.ans : (S.ans[x.key] ?? "");
            let control = "";
            if (cau.type === "trac-nghiem") {
                control = `<div class="qz-retry-opts">${(cau.dap_an || []).map((t, k) => {
                    const on = String(curVal) === String(k);
                    return `<button type="button" class="qz-retry-opt${on ? " on" : ""}" data-retry-key="${esc(x.key)}" data-retry-val="${k}">
                      <span class="qz-retry-k">${"ABCDEF"[k] ?? k + 1}</span><div class="qz-retry-t">${t}</div>
                    </button>`;
                }).join("")}</div>`;
            } else if (cau.type === "dung-sai") {
                control = `<div class="qz-retry-opts ds">
                  <button type="button" class="qz-retry-opt${String(curVal) === "true" ? " on" : ""}" data-retry-key="${esc(x.key)}" data-retry-val="true"><span class="qz-retry-k">✓</span><div class="qz-retry-t">Đúng</div></button>
                  <button type="button" class="qz-retry-opt${String(curVal) === "false" ? " on" : ""}" data-retry-key="${esc(x.key)}" data-retry-val="false"><span class="qz-retry-k">✕</span><div class="qz-retry-t">Sai</div></button>
                </div>`;
            } else if (cau.type === "tu-luan") {
                control = `<textarea class="qz-retry-ta" rows="3" data-retry-input="${esc(x.key)}" placeholder="Viết lại câu trả lời...">${esc(curVal)}</textarea>`;
            } else {
                control = `<input type="text" class="qz-retry-in" value="${esc(curVal)}" data-retry-input="${esc(x.key)}" placeholder="Nhập đáp án mới...">`;
            }
            const tag = !r.dung ? (r.lo_hong_an ? "🔥 Lỗ hổng ẩn" : "❌ Câu làm sai") : "🍀 Đúng do đoán thử";
            const rsBox = st.msg ? `<div class="qz-retry-rs ${st.dung ? "ok" : "err"}">${esc(st.msg)}</div>` : "";
            return `
              <div class="qz-retry-item${st.dung ? " is-fixed" : ""}">
                <div class="qz-retry-head">
                  <b>Câu ${esc(cau.id)}</b>
                  <span class="qz-retry-tag ${!r.dung ? "err" : "lucky"}">${tag}</span>
                </div>
                ${chung ? `<div class="qz-retry-chung">${chung}</div>` : ""}
                <div class="qz-retry-de">${y}</div>
                ${veHinh(cau.hinh, bai, "qz-hinh")}
                ${control}
                <div class="qz-retry-foot">
                  <button type="button" class="qz-btn-retry-check" data-retry-submit="${esc(x.key)}" ${st.checking ? "disabled" : ""}>
                    <i class="fa-solid fa-check-double"></i> ${st.checking ? "Đang chấm..." : "Kiểm tra lại (ôn sửa lỗi)"}
                  </button>
                </div>
                ${rsBox}
              </div>`;
        }

        function htmlChang() {
            const segIdx = currentSegIdx();
            const seg = segments[segIdx];
            if (!seg) return htmlTong();

            const list = seg.indices.map((idx) => items[idx]);
            let dungCount = 0, saiCount = 0, mayManCount = 0, boCount = 0, coinChang = 0, scoreChang = 0;
            list.forEach((x) => {
                const r = S.results[x.key];
                if (!r) { boCount++; return; }
                if (r.dung) dungCount++; else saiCount++;
                if (r.may_man) mayManCount++;
                if (r.lan_dau) {
                    coinChang += Number(r.thuong_coin || 0);
                    scoreChang += Number(r.thuong_score || 0);
                }
            });

            const focusInfo = tinhComboChang(segIdx);
            const focusBonus = S.focusAwarded[seg.id];
            if (focusBonus && focusBonus.thuong_coin) {
                coinChang += Number(focusBonus.thuong_coin || 0);
                scoreChang += Number(focusBonus.thuong_score || 0);
            }

            const daLamInSeg = list.length - boCount;
            const pct = daLamInSeg ? Math.round((dungCount / list.length) * 100) : 0;
            const isFocusStage = focusInfo.maxCombo >= 3 && focusInfo.bestValid;
            const spriteAction = isFocusStage
                ? "focus_combo"
                : (pct >= 60 ? "hoan_thanh_chang" : "khich_le_co_len");

            const mascotTitle = isFocusStage
                ? "Focus Combo! Tập trung đỉnh cao ⚡"
                : (pct >= 80 ? "Vượt chặng xuất sắc! 🎉" : pct >= 60 ? "Hoàn thành chặng ngon lành! 💪" : "Saoladuo đồng hành cùng bạn 🌱");
            const mascotSpeech = isFocusStage
                ? `Bạn đạt chuỗi ${focusInfo.maxCombo} câu đúng liên tiếp rất chắc chắn! Hãy giữ vững phong độ này nhé.`
                : (saiCount + mayManCount > 0
                    ? `Chặng này có ${saiCount + mayManCount} câu cần chú ý — cùng vá nhanh ngay trước khi sang phần tiếp theo để nhớ sâu gấp đôi!`
                    : `Tuyệt vời! Bạn đã giải quyết trọn vẹn chặng này mà không mắc lỗi nào.`);

            const vaNongDs = layDsVaNong(seg);

            return `
              <section class="qz-stage-summary" id="qz-stage-summary">
                <div class="qz-ss-hero ${spriteAction}">
                  <div class="qz-ss-sprite-wrap">
                    <div class="qz-ss-sprite" style="--sprite-url:url('img/pet/than/mac_dinh/${spriteAction}.webp')" role="img" aria-label="Saoladuo ${spriteAction}"></div>
                  </div>
                  <div class="qz-ss-speech">
                    <span class="qz-ss-badge"><i class="fa-solid fa-flag-checkered"></i> Tổng kết ${esc(seg.shortTitle)} (${segIdx + 1}/${segments.length})</span>
                    <h2>${mascotTitle}</h2>
                    <p>${mascotSpeech}</p>
                    ${focusBonus && focusBonus.du_dieu_kien ? `<div class="qz-ss-combo-pill">⚡ Focus Combo +${focusBonus.thuong_coin} EduCoin &amp; +${focusBonus.thuong_score} Điểm</div>` : ""}
                  </div>
                </div>

                <div class="qz-ss-body">
                  <div class="qz-ss-reward-banner">
                    <div class="qz-ss-reward-ico">
                      <img src="img/bai-tap/tui_thuong_chang.png" alt="" style="display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none'">
                      <span class="qz-ss-reward-fb">🎒</span>
                    </div>
                    <div>
                      <b>Phần thưởng chặng đã nhận</b>
                      <span>+${coinChang} EduCoin vào Vườn Saoladou · +${scoreChang} Điểm tích lũy</span>
                    </div>
                  </div>

                  <div class="qz-ss-stats">
                    <div class="qz-ss-stat ok"><b>${dungCount}/${list.length}</b><span>Câu đúng</span></div>
                    <div class="qz-ss-stat coin"><b>+${coinChang}</b><span>EduCoin &amp; Điểm</span></div>
                    <div class="qz-ss-stat fix"><b>${vaNongDs.length}</b><span>Cần vá lại</span></div>
                  </div>

                  ${vaNongDs.length > 0 ? `
                    <div class="qz-ss-retry-box">
                      <div class="qz-ss-retry-top">
                        <div>
                          <b>🔧 Vá nóng cuối chặng (Hypercorrection)</b>
                          <p>Ôn lại ngay ${vaNongDs.length} câu sai/đoán thử để đánh dấu đã hiểu trong Sổ lỗi sai (không cộng thưởng lại).</p>
                        </div>
                        <button type="button" class="qz-btn-hotfix" id="qz-toggle-hotfix">
                          <i class="fa-solid fa-wrench"></i> ${S.stageRetryOpen ? "Thu gọn" : `Làm lại nhanh ${vaNongDs.length} câu sai/đoán thử`}
                        </button>
                      </div>
                      ${S.stageRetryOpen ? `<div class="qz-retry-list">${vaNongDs.map(htmlRetryCard).join("")}</div>` : ""}
                    </div>` : `<div class="qz-ss-clean"><i class="fa-solid fa-circle-check"></i> Chặng này sạch lỗi! Không có câu nào cần vá lại.</div>`}
                </div>
              </section>`;
        }

        function htmlTong() {
            const xong = soDaLam(), con = n - xong, pv = soPhanVan();
            return `<section class="qz-tong">
        <div class="qz-hero">
          <div class="qz-emoji">${con || pv ? "🧭" : "🎯"}</div>
          <h2>${con ? "Tổng quan bài làm" : pv ? "Kiểm tra lại câu phân vân" : "Làm xong hết rồi!"}</h2>
          <p>Bạn đã trả lời <b>${xong}/${n}</b> câu.${con ? ` Còn <b>${con}</b> câu chưa làm (ô màu cam).` : ""}${pv ? ` Có <b>${pv}</b> câu đánh dấu chưa chắc chắn (🚩).` : ""}${!con && !pv ? " Bấm Nộp bài để lưu tổng kết bài tập." : " Bấm vào số câu để quay lại kiểm tra."}</p>
        </div>
        <div class="qz-tong-than">
        <div class="qz-luoi">${items.map((x, k) => {
                const da = daTraLoi(x);
                const p = dangPhanVan(x);
                const inst = isPractice ? S.results[x.key] : null;
                const cls = inst ? (inst.dung ? "da" : "sai-o") : (da ? "da" : "chua");
                return `<button type="button" class="qz-o ${cls}${p ? " pv" : ""}${k === S.i ? " hien" : ""}" data-goto="${k}" aria-label="Câu ${k + 1}, ${da ? "đã làm" : "chưa làm"}${p ? ", đang phân vân" : ""}">${k + 1}</button>`;
            }).join("")}</div>
        <div class="qz-chuthich">
          <span style="--cc:#b4cbfa">Đã làm</span><span style="--cc:#f0c27a">Chưa làm</span><span style="--cc:#f59e0b">Chưa chắc (🚩)</span><span style="--cc:#2457d6">Câu đang xem</span>
        </div>
        <p class="qz-loi" id="qz-loi" role="alert"></p>
        </div>
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

            const vi = isPractice ? tongViPhien() : { coin: 0, score: 0 };
            const ghi = [];
            if (!userId) ghi.push("Đăng nhập để điểm & EduCoin được lưu nhé!");
            else {
                if (isPractice && vi.coin > 0) {
                    ghi.push(`🪙 Thưởng từng câu & Focus Combo: <b>+${vi.coin} EduCoin</b> &amp; <b>+${vi.score} Điểm</b>.`);
                }
                if (t.daLuu && t.diemCong > 0) {
                    ghi.push(`🏁 Thưởng hoàn thành bài: +${t.diemCong} điểm &amp; EduCoin${t.heSo > 1 ? ` (thưởng ×${t.heSo.toFixed(1)})` : ""}.`);
                } else if (t.diemDat > 0 && t.diemCong > 0) {
                    ghi.push(`🏁 Ôn tập lại bài: +${t.diemCong} điểm &amp; EduCoin.`);
                } else if (t.diemDat > 0 && !t.daLuu && vi.coin === 0) {
                    ghi.push("Bài này bạn đã được cộng điểm trước đó.");
                }
            }
            if (t.soLoi > 0) ghi.push(`<a href="so-loi.html">${t.soLoi} câu sai đã vào Sổ lỗi sai. Sửa ngay</a>`);
            const hang = userId && hangCua ? hangCua(t.bestPct) : null;

            return `<section class="qz-kq" style="--c:${mau};--pct:${pct}">
        <div class="qz-hero">
        <div class="qz-sao" aria-label="${sao} trên 3 sao">${[1, 2, 3].map((k) =>
                `<span class="${k <= sao ? "bat" : ""}" style="animation-delay:${(k - 1) * 0.18}s">★</span>`).join("")}</div>
        <h2>${loi}</h2>
        <div class="qz-vong" role="img" aria-label="${pct} phần trăm"><div><b>${pct}%</b><small>${t.diemDat} / ${t.diemToiDa} điểm</small></div></div>
        </div>
        <div class="qz-kq-than">
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
        </div>
      </section>`;
        }

        // ====================================================================
        // VẼ
        // ====================================================================
        function veTien() {
            const daLam = soDaLam();
            const pct = n ? (daLam / n) * 100 : 0;
            const xemKq = !(S.mode === "lam" || S.mode === "tong" || S.mode === "chang");
            const segIdx = currentSegIdx();
            const seg = segments[segIdx];
            const dungSegBar = isPractice && !xemKq && S.mode !== "tong" && seg;

            tien.classList.toggle("kq", xemKq);
            tien.classList.toggle("is-segs", !!dungSegBar);
            segsEl.hidden = !dungSegBar;
            tienRay.hidden = !!dungSegBar;

            if (dungSegBar) {
                segsEl.innerHTML = seg.indices.map((k) => {
                    const it = items[k];
                    const r = S.results[it.key];
                    let cls = "chua";
                    if (r) cls = r.dung ? "dung" : "sai";
                    else if (daTraLoi(it)) cls = "chon";
                    if (S.mode === "lam" && k === S.i) cls += " dang";
                    return `<button type="button" class="qz-seg-pill ${cls}" data-seg-go="${k}" title="Câu ${k + 1}" aria-label="Câu ${k + 1}"></button>`;
                }).join("");
                tienMoc.hidden = true;
            } else if (!xemKq) {
                tienFill.style.width = pct + "%";
                tienFill.style.background = "";
                tien.title = `Đã làm ${daLam}/${n} câu (${Math.round(pct)}%)`;
                const coMoc = S.mode === "lam" || S.mode === "xemlai";
                tienMoc.hidden = !coMoc;
                if (coMoc) tienMoc.style.left = ((S.i + 0.5) / n) * 100 + "%";
            } else {
                const MAU = { dung: "#22b573", sai: "#e5484d", bo: "#c3ccdc" };
                const dai = [];
                let truoc = null, batDau = 0;
                for (let k = 0; k <= n; k++) {
                    let c = null;
                    if (k < n) {
                        const r = S.kq && S.kq[items[k].key];
                        c = r && r.dung === true ? "dung" : r && r.dung === false ? "sai" : "bo";
                    }
                    if (c !== truoc) {
                        if (truoc) dai.push(`${MAU[truoc]} ${(batDau / n) * 100}% ${(k / n) * 100}%`);
                        truoc = c; batDau = k;
                    }
                }
                tienFill.style.width = "100%";
                tienFill.style.background = `linear-gradient(90deg, ${dai.join(", ")})`;
                tien.title = "Bấm vào thanh để xem lại câu tương ứng";
                const coMoc = S.mode === "lam" || S.mode === "xemlai";
                tienMoc.hidden = !coMoc;
                if (coMoc) tienMoc.style.left = ((S.i + 0.5) / n) * 100 + "%";
            }

            // Focus Combo Aura (chỉ bật khi >= 2 câu đúng liên tiếp có >= 5s/câu)
            const { combo, liveValid } = isPractice && seg ? tinhComboChang(segIdx) : { combo: 0, liveValid: false };
            const isComboOn = isPractice && (S.mode === "lam") && combo >= 2 && liveValid;
            if (topEl) topEl.classList.toggle("is-combo", isComboOn);
            stage.classList.toggle("is-combo", isComboOn);
            focusPill.hidden = !isComboOn;
            if (isComboOn) {
                focusPill.innerHTML = `⚡ Tập trung ×${combo}`;
            }

            tien.setAttribute("aria-valuenow", Math.round(pct));
            tien.setAttribute("aria-valuetext", `Đã làm ${daLam} trên ${n} câu`);

            if (S.mode === "lam") {
                const posInSeg = seg ? (seg.indices.indexOf(S.i) + 1) : (S.i + 1);
                const lenSeg = seg ? seg.indices.length : n;
                demEl.textContent = isPractice
                    ? `Chặng ${segIdx + 1}/${segments.length} · ${posInSeg}/${lenSeg}`
                    : `${S.i + 1}/${n}`;
            } else if (S.mode === "chang") {
                demEl.textContent = `Tổng kết Chặng ${segIdx + 1}/${segments.length}`;
            } else if (S.mode === "xemlai") {
                demEl.textContent = `${S.i + 1}/${n}`;
            } else if (S.mode === "tong") {
                demEl.textContent = `${soDaLam()}/${n} đã làm`;
            } else {
                demEl.textContent = "Kết quả";
            }

            nutDs.hidden = !(S.mode === "lam" || S.mode === "tong" || S.mode === "chang");
            nutDs.classList.toggle("bat", S.mode === "tong");
            $("qz-x").setAttribute("aria-label", S.mode === "xemlai" ? "Về kết quả" : "Thoát");
        }

        function veNav() {
            const xemLai = S.mode === "xemlai";
            const daLam = soDaLam();
            const pvCount = soPhanVan();

            const o = navLuoi.children;
            const dem = { dung: 0, sai: 0, bo: 0 };
            for (let k = 0; k < n; k++) {
                let c = "";
                const p = !xemLai && dangPhanVan(items[k]);
                const inst = isPractice ? S.results[items[k].key] : null;
                if (xemLai) {
                    const r = S.kq && S.kq[items[k].key];
                    c = r && r.dung === true ? "dung" : r && r.dung === false ? "sai" : "bo";
                    dem[c]++;
                } else if (inst) {
                    c = inst.dung ? "dung" : "sai";
                } else if (daTraLoi(items[k])) {
                    c = "da";
                }
                if (p) c += (c ? " " : "") + "pv";
                if (k === S.i && S.mode !== "chang") c += " hien";
                o[k].className = "qz-n " + c;
                o[k].setAttribute("aria-label", `Câu ${k + 1}` + (xemLai ? `, ${c.startsWith("dung") ? "đúng" : c.startsWith("sai") ? "sai" : "bỏ trống"}` : `, ${daTraLoi(items[k]) ? "đã làm" : "chưa làm"}${p ? ", đang phân vân" : ""}`));
                if (k === S.i && S.mode !== "chang") o[k].setAttribute("aria-current", "true"); else o[k].removeAttribute("aria-current");
            }

            const vi = isPractice ? tongViPhien() : { coin: 0, score: 0 };
            navStat.innerHTML = xemLai
                ? `<div class="qz-st d"><b>${dem.dung}</b><span>Đúng</span></div>
                   <div class="qz-st s"><b>${dem.sai}</b><span>Sai</span></div>
                   <div class="qz-st x"><b>${dem.bo}</b><span>Bỏ trống</span></div>`
                : `<div class="qz-st"><b>${daLam}/${n}</b><span>Đã làm</span></div>
                   <div class="qz-st coin"><b>+${vi.coin}</b><span>EduCoin</span></div>
                   <div class="qz-st${pvCount ? " pv" : ""}"><b>${pvCount || tongDiem}</b><span>${pvCount ? "Phân vân 🚩" : "Điểm bài"}</span></div>`;

            navDem.textContent = xemLai ? `Câu ${S.i + 1}/${n}` : `Chặng ${currentSegIdx() + 1}/${segments.length}`;
            navChuThich.innerHTML = xemLai
                ? `<span style="--cc:#8fdcb4">Đúng</span><span style="--cc:#f2a9ab">Sai</span><span style="--cc:#d3dae6">Bỏ trống</span><span style="--cc:#2457d6">Đang xem</span>`
                : `<span style="--cc:#8fdcb4">Đúng</span><span style="--cc:#f2a9ab">Sai</span><span style="--cc:#b4cbfa">Đã chọn</span><span style="--cc:#2457d6">Đang xem</span>`;

            navNut.dataset.navAct = xemLai ? "kq" : "tong";
            navNut.innerHTML = xemLai
                ? '<i class="fa-solid fa-chart-pie"></i><span>Về kết quả</span>'
                : '<i class="fa-solid fa-list-check"></i><span>Tổng quan &amp; nộp bài</span>';
        }

        function veNguLieu() {
            const x = S.mode === "lam" || S.mode === "xemlai" ? items[S.i] : null;
            const tp = x && x.bai.tac_pham;
            nutTp.hidden = !tp;
            split.classList.toggle("co-tp", !!tp);
            document.body.classList.toggle("qz-co-tp", !!tp);
            app.classList.toggle("co-tp", !!tp);
            if (!tp) { side.hidden = true; return; }
            side.hidden = false;
            if (side.dataset.bai !== String(x.bai.id)) {
                side.innerHTML = htmlTp(x.bai);
                side.dataset.bai = x.bai.id;
                veCongThuc(side);
            }
        }

        function veDay() {
            const xCur = items[S.i];
            const hasConf = (S.mode === "lam" && isPractice && xCur && !S.results[xCur.key]);
            bottom.className = "qz-bottom " + S.mode + (hasConf ? " has-conf" : "");
            let h = "";
            if (S.mode === "lam") {
                const x = items[S.i];
                const da = daTraLoi(x);
                const inst = isPractice ? S.results[x.key] : null;
                const seg = segments[x.segIdx];
                const isLastInSeg = seg ? S.i === seg.end : (S.i === n - 1);

                if (isPractice && !inst) {
                    const disAttr = (!da || S.isChecking) ? "disabled" : "";
                    const confHtml = CONF_LEVELS.map((c) => `
                      <button type="button" class="qz-conf-btn ${c.cls}" data-conf="${c.id}" ${disAttr} title="${c.ten} (Phím ${c.key})">
                        <img src="${c.img}" alt="" class="qz-conf-img" style="display:none" onload="this.style.display='inline-block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none'">
                        <span class="qz-conf-fb" aria-hidden="true">${c.fb}</span>
                        <span class="qz-conf-txt"><b>${c.ten}</b><small>${c.sub}</small></span>
                      </button>`).join("");
                    h = `<div class="qz-bottom-util">
                           <button type="button" class="qz-btn phu vuong" data-act="lui" aria-label="Câu trước" ${S.i === 0 || S.isChecking ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                           <button type="button" class="qz-btn ghost qz-skip-sm" data-act="bo" ${da || S.isChecking ? "hidden" : ""}><i class="fa-solid fa-forward-step"></i><span>Bỏ qua</span></button>
                         </div>
                         <div class="qz-conf-group" role="group" aria-label="Chọn mức độ tự tin để kiểm tra">${confHtml}</div>`;
                } else if (isPractice && inst) {
                    const nextTxt = isLastInSeg
                        ? `Tổng kết ${seg.shortTitle}`
                        : "Câu tiếp theo";
                    h = `<button type="button" class="qz-btn phu vuong" data-act="lui" aria-label="Câu trước" ${S.i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                         <span class="qz-gian"></span>
                         <button type="button" class="qz-btn chinh" data-act="tiep"><span>${esc(nextTxt)}</span><i class="fa-solid fa-arrow-right"></i><kbd class="qz-kbd">Enter</kbd></button>`;
                } else {
                    h = `<button type="button" class="qz-btn phu vuong" data-act="lui" aria-label="Câu trước" ${S.i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                         <span class="qz-gian"></span>
                         <div class="qz-nhom">
                           <button type="button" class="qz-btn ghost" data-act="bo" ${da ? "hidden" : ""}><i class="fa-solid fa-forward-step"></i><span>Bỏ qua</span></button>
                           <button type="button" class="qz-btn chinh" data-act="tiep" ${da ? "" : "disabled"}><span>${S.i === n - 1 ? "Hoàn thành" : "Tiếp tục"}</span><i class="fa-solid fa-arrow-right"></i></button>
                         </div>`;
                }
            } else if (S.mode === "chang") {
                const segIdx = currentSegIdx();
                const isLastStage = segIdx >= segments.length - 1;
                const nextSeg = segments[segIdx + 1];
                h = `<button type="button" class="qz-btn phu" data-act="lui-chang"><i class="fa-solid fa-arrow-left"></i><span>Xem lại chặng</span></button>
                     <span class="qz-gian"></span>
                     <button type="button" class="qz-btn chinh ${isLastStage ? "luc " : ""}rong" data-act="tiep-chang" ${S.dangNop ? "disabled" : ""}>
                       <span>${isLastStage ? "Hoàn thành &amp; Lưu tổng kết" : `Tiếp tục ${esc(nextSeg.shortTitle)}`}</span>
                       <i class="fa-solid fa-arrow-right"></i>
                     </button>`;
            } else if (S.mode === "tong") {
                h = `<button type="button" class="qz-btn phu" data-act="lui" ${S.dangNop ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i><span>Làm tiếp</span></button>
                     <span class="qz-gian"></span>
                     <button type="button" class="qz-btn chinh luc rong" data-act="nop" ${S.dangNop ? "disabled" : ""}>${S.dangNop ? '<span class="qz-quay"></span><span>Đang chấm bài...</span>' : '<i class="fa-solid fa-paper-plane"></i><span>Nộp bài</span><kbd class="qz-kbd">Enter</kbd>'}</button>`;
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
            if (S.mode !== "lam") return;
            const x = items[S.i];
            const da = daTraLoi(x);
            if (isPractice && !S.results[x.key]) {
                bottom.querySelectorAll(".qz-conf-btn").forEach((b) => { b.disabled = !da || S.isChecking; });
                const sk = bottom.querySelector('[data-act="bo"]');
                if (sk) sk.hidden = da || S.isChecking;
            } else {
                const t = bottom.querySelector('[data-act="tiep"]'), b = bottom.querySelector('[data-act="bo"]');
                if (t) t.disabled = !da;
                if (b) b.hidden = da;
            }
            an(veTien);
            an(veNav);
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

        function hauVe() {
            if (S.mode === "lam") {
                const x = items[S.i];
                if (!S.results[x.key]) {
                    const o = stage.querySelector(".qz-in, .qz-ta");
                    if (o && matchMedia("(hover:hover)").matches) o.focus({ preventScroll: true });
                }
            } else if (S.mode === "chang") {
                const seg = segments[currentSegIdx()];
                if (seg) {
                    const list = seg.indices.map((idx) => items[idx]);
                    const dungCount = list.filter((x) => S.results[x.key]?.dung).length;
                    const pct = list.length ? Math.round((dungCount / list.length) * 100) : 0;
                    if (pct >= 80 && !S.focusAwarded[seg.id]?.confetti) {
                        phaoGiay(28);
                        (S.focusAwarded[seg.id] ||= {}).confetti = true;
                    }
                }
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
                if (window.SAOLA) {
                    if (pct < 30) { window.SAOLA.hanhDong("khoc", 3000); window.SAOLA.noi("nop_0_29"); }
                    else if (pct < 80) { window.SAOLA.hanhDong("hoc", 3000); window.SAOLA.noi("nop_30_79"); }
                    else { window.SAOLA.hanhDong("vui", 3000); window.SAOLA.noi("nop_80_100"); }
                }
            }
        }

        function ghiNhanThoiGianHienTai() {
            if (S.mode !== "lam" || !items[S.i]) return 0;
            const k = items[S.i].key;
            const delta = Math.max(0, Date.now() - S.questionShownAt);
            S.timeSpent[k] = (S.timeSpent[k] || 0) + delta;
            S.questionShownAt = Date.now();
            return S.timeSpent[k];
        }

        function ve(huong = 1) {
            let html = "";
            try {
                if (S.mode === "lam") html = htmlCau(items[S.i], "lam");
                else if (S.mode === "chang") html = htmlChang();
                else if (S.mode === "tong") html = htmlTong();
                else if (S.mode === "ketqua") html = htmlKetQua();
                else html = htmlCau(items[S.i], "xem") + htmlPhanHoi(items[S.i]);
            } catch (e) {
                console.error("[quiz-tung-cau] lỗi dựng nội dung:", e);
                html = `<section class="qz-tong"><div class="qz-emoji">⚠️</div><h2>Không hiển thị được màn này</h2>
                  <p>Bạn mở Console (F12) để xem dòng lỗi màu đỏ, hoặc bấm Tổng quan để chuyển sang câu khác.</p></section>`;
            }

            stage.className = "qz-stage" + (giamCD ? "" : huong > 0 ? " vao-phai" : " vao-trai");
            stage.innerHTML = html;
            main.scrollTop = 0;
            document.body.classList.toggle("qz-mode-tongket", S.mode === "tong" || S.mode === "ketqua");
            document.body.classList.toggle("qz-practice-lam", isPractice && (S.mode === "lam" || S.mode === "chang"));

            if (S.mode === "lam") S.questionShownAt = Date.now();

            an(veDay);
            an(veTien);
            an(veNav);
            an(veNguLieu);
            an(() => veCongThuc(stage));
            an(hauVe);
            an(datChieuCaoDay);
        }

        // ====================================================================
        // CHẤM TỨC THÌ V31 & FOCUS COMBO
        // ====================================================================
        async function chamCauTucThi(doTuTin) {
            if (!isPractice || S.mode !== "lam" || S.isChecking) return;
            const x = items[S.i];
            if (!x || !daTraLoi(x) || S.results[x.key]) return;

            const elapsedMs = ghiNhanThoiGianHienTai();
            S.isChecking = true;
            capNhatNut();

            try {
                const res = await fetch(`${API}/api/luyen-tap/cham-cau`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: userId ? Number(userId) : null,
                        subject,
                        chapter,
                        article,
                        bai_id: String(x.bai.id),
                        cau_id: String(x.cau.id),
                        answer: String(S.ans[x.key] ?? "").trim(),
                        do_tu_tin: doTuTin,
                        elapsed_ms: elapsedMs,
                    }),
                });
                const kq = await res.json();
                if (!res.ok || !kq.success) throw new Error(kq.message || "Không chấm được câu này");

                S.results[x.key] = { ...kq, elapsedMs };
                S.phanVan.delete(x.key);

                if (kq.dung) {
                    const segCombo = tinhComboChang(x.segIdx).combo;
                    Am.dung(Math.max(0, segCombo - 1));
                } else {
                    Am.sai();
                }
                luuTrangThaiDoDang(soDaLam(), n);
                ve(1);
            } catch (err) {
                console.error("[cham-cau]", err);
                const errText = err.message === "Failed to fetch" ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé!" : err.message;
                const oldErr = stage.querySelector(".qz-ifb-err");
                if (oldErr) oldErr.remove();
                stage.querySelector(".qz-than")?.insertAdjacentHTML("beforeend", `<p class="qz-ifb-err">${esc(errText)}</p>`);
            } finally {
                S.isChecking = false;
                an(capNhatNut);
            }
        }

        async function luuMayMan(x) {
            const inst = S.results[x.key];
            if (!inst || inst.saved_lucky) return;
            if (!userId) {
                inst.saved_lucky = true;
                ve(1);
                return;
            }
            try {
                const res = await fetch(`${API}/api/luyen-tap/luu-may-man`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: Number(userId),
                        subject,
                        chapter,
                        article,
                        bai_id: String(x.bai.id),
                        cau_id: String(x.cau.id),
                    }),
                });
                const kq = await res.json();
                if (kq.success) {
                    inst.saved_lucky = true;
                    luuTrangThaiDoDang(soDaLam(), n);
                    ve(1);
                }
            } catch (e) { console.warn("[luu-may-man]", e); }
        }

        async function thuongFocusChangNeuDat(segIdx) {
            const seg = segments[segIdx];
            if (!seg || !userId || S.focusAwarded[seg.id]?.checked) return;
            const info = tinhComboChang(segIdx);
            const firstItem = items[seg.start];
            const baiKey = firstItem ? `${subject}/${chapter}/${article}/${firstItem.bai.id}` : "";
            const duDieuKien = info.maxCombo >= 3 && info.bestValid;
            S.focusAwarded[seg.id] = { checked: true, du_dieu_kien: false, thuong_coin: 0, thuong_score: 0 };
            if (!duDieuKien || !baiKey) return;

            try {
                const res = await fetch(`${API}/api/luyen-tap/hoan-thanh-chang`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: Number(userId),
                        bai_key: baiKey,
                        chang_id: seg.id,
                        streak_chang: info.maxCombo,
                        tat_ca_hop_le: true,
                    }),
                });
                const kq = await res.json();
                if (kq.success && kq.du_dieu_kien) {
                    S.focusAwarded[seg.id] = {
                        checked: true,
                        du_dieu_kien: true,
                        thuong_coin: kq.thuong_coin || 0,
                        thuong_score: kq.thuong_score || 0,
                    };
                    if (S.mode === "chang") ve(1);
                }
            } catch (e) { console.warn("[hoan-thanh-chang]", e); }
        }

        async function moTongKetChang(segIdx) {
            S.activeSegIdx = segIdx;
            S.stageRetryOpen = false;
            S.mode = "chang";
            ve(1);
            await thuongFocusChangNeuDat(segIdx);
            if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n);
        }

        async function chamLaiTrongChang(keyStr) {
            const x = items.find((it) => it.key === keyStr);
            if (!x) return;
            const st = (S.stageRetryState[keyStr] ||= {});
            const tl = String(st.ans !== undefined ? st.ans : (S.ans[keyStr] ?? "")).trim();
            if (!tl) {
                st.msg = "Hãy chọn hoặc nhập đáp án mới trước nhé!";
                st.dung = false;
                ve(1);
                return;
            }
            st.checking = true;
            ve(1);
            try {
                const res = await fetch(`${API}/api/luyen-tap/cham-cau`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: userId ? Number(userId) : null,
                        subject,
                        chapter,
                        article,
                        bai_id: String(x.bai.id),
                        cau_id: String(x.cau.id),
                        answer: tl,
                        do_tu_tin: "kha_chac",
                        elapsed_ms: 5000,
                    }),
                });
                const kq = await res.json();
                st.checking = false;
                if (kq.success && kq.dung) {
                    st.dung = true;
                    st.msg = "✔ Chuẩn rồi! Câu này đã được đánh dấu Đã hiểu trong Sổ lỗi sai (không cộng thưởng lại).";
                    S.ans[keyStr] = tl;
                    Am.dung(1);
                } else {
                    st.dung = false;
                    st.msg = "✘ Vẫn chưa đúng, thử suy nghĩ lại lần nữa nhé!";
                    Am.sai();
                }
            } catch (e) {
                st.checking = false;
                st.dung = false;
                st.msg = "Không kết nối được máy chủ!";
            }
            ve(1);
        }

        // ====================================================================
        // ĐIỀU HƯỚNG
        // ====================================================================
        function tiep() {
            if (S.mode === "lam") {
                ghiNhanThoiGianHienTai();
                const seg = segments[items[S.i].segIdx];
                if (isPractice && seg && S.i === seg.end) {
                    moTongKetChang(seg.idx);
                } else if (S.i < n - 1) {
                    S.i++;
                    ve(1);
                } else {
                    S.mode = "tong";
                    ve(1);
                }
                if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n);
            } else if (S.mode === "xemlai") {
                if (S.i < n - 1) { S.i++; ve(1); } else { S.mode = "ketqua"; ve(1); }
            }
        }
        function lui() {
            if (S.mode === "lam") {
                ghiNhanThoiGianHienTai();
                if (S.i > 0) { S.i--; ve(-1); if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n); }
            } else if (S.mode === "chang") {
                const seg = segments[currentSegIdx()];
                S.mode = "lam";
                S.i = seg ? seg.end : S.i;
                ve(-1);
            } else if (S.mode === "tong") {
                S.mode = "lam"; ve(-1);
            } else if (S.mode === "xemlai") {
                if (S.i > 0) { S.i--; ve(-1); } else { S.mode = "ketqua"; ve(-1); }
            }
        }
        function nhayToi(k) {
            if (S.modal || S.dangNop || S.isChecking) return;
            ghiNhanThoiGianHienTai();
            const huong = k >= S.i ? 1 : -1;
            if (S.mode === "lam" || S.mode === "tong" || S.mode === "chang") {
                S.mode = "lam"; S.i = k; ve(huong);
                if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n);
            } else {
                S.mode = "xemlai"; S.i = k; ve(huong);
            }
        }
        function moTongQuan() {
            if (S.modal || S.dangNop || S.isChecking) return;
            ghiNhanThoiGianHienTai();
            if (S.mode === "lam" || S.mode === "chang") { S.mode = "tong"; ve(1); }
            else if (S.mode === "tong") { S.mode = "lam"; ve(-1); }
        }

        async function boQua() {
            if (S.mode !== "lam" || S.modal || S.isChecking) return;
            if (daTraLoi(items[S.i])) return;
            const ok = await hoi({
                icon: "fa-forward-step", mau: "cam",
                tieuDe: "Bạn có muốn bỏ qua câu này không?",
                noiDung: "Câu này sẽ chưa có đáp án. Bạn vẫn quay lại làm được bất cứ lúc nào qua nút Tổng quan.",
                huy: "Ở lại làm bài", ok: "Bỏ qua",
            });
            if (ok) tiep();
        }

        async function yeuCauNop() {
            if (S.dangNop || S.modal) return;
            const con = n - soDaLam(), pv = soPhanVan();
            if (con > 0 || pv > 0) {
                const tieuDe = con > 0 && pv > 0
                    ? `Còn ${con} câu chưa làm và ${pv} câu phân vân`
                    : con > 0 ? `Còn ${con} câu chưa làm` : `Còn ${pv} câu đánh dấu chưa chắc chắn 🚩`;
                const noiDung = con > 0
                    ? "Câu bỏ trống sẽ không có điểm. Bạn vẫn muốn nộp bài chứ?"
                    : "Bạn đã đánh dấu một số câu đang phân vân. Bạn muốn kiểm tra lại hay nộp bài luôn?";
                const ok = await hoi({
                    icon: "fa-paper-plane", mau: "cam",
                    tieuDe, noiDung, huy: "Quay lại kiểm tra", ok: "Vẫn nộp bài",
                });
                if (!ok) return;
            }
            nop();
        }

        function chinh() {
            if (S.modal || S.isChecking) return;
            if (S.mode === "lam") {
                const x = items[S.i];
                if (isPractice) {
                    if (S.results[x.key]) tiep();
                    else if (daTraLoi(x)) chamCauTucThi("kha_chac");
                } else if (daTraLoi(x)) {
                    tiep();
                }
            } else if (S.mode === "chang") {
                const segIdx = currentSegIdx();
                if (segIdx < segments.length - 1) {
                    S.mode = "lam"; S.i = segments[segIdx + 1].start; ve(1);
                } else {
                    yeuCauNop();
                }
            } else if (S.mode === "tong") yeuCauNop();
            else if (S.mode === "ketqua") { S.mode = "xemlai"; S.i = 0; ve(1); }
            else tiep();
        }

        function chon(v) {
            const x = items[S.i];
            if (isPractice && S.results[x.key]) return;
            if (daLoai(x, v)) S.loaiTru[x.key].delete(String(v));
            S.ans[x.key] = String(v);
            stage.querySelectorAll(".qz-opt").forEach((b) => {
                const on = b.dataset.v === String(v);
                const biLoai = daLoai(x, b.dataset.v);
                b.classList.toggle("chon", on);
                b.classList.toggle("bi-loai", biLoai);
                b.setAttribute("aria-checked", on ? "true" : "false");
                const nutL = b.querySelector(".qz-loai-nut");
                if (nutL) {
                    nutL.classList.toggle("on", biLoai);
                    nutL.innerHTML = `<i class="fa-solid ${biLoai ? "fa-rotate-left" : "fa-ban"}"></i>`;
                }
            });
            Am.chon();
            capNhatNut();
            luuTrangThaiDoDang(soDaLam(), n);
        }

        function batTatPhanVan() {
            if (S.mode !== "lam") return;
            const x = items[S.i];
            if (isPractice && S.results[x.key]) return;
            if (S.phanVan.has(x.key)) S.phanVan.delete(x.key);
            else S.phanVan.add(x.key);
            const pv = dangPhanVan(x);
            const art = stage.querySelector(".qz-cau");
            if (art) art.classList.toggle("phan-van", pv);
            const btn = stage.querySelector(".qz-flag");
            if (btn) {
                btn.classList.toggle("on", pv);
                btn.setAttribute("aria-pressed", pv ? "true" : "false");
                btn.innerHTML = `<i class="fa-${pv ? "solid" : "regular"} fa-flag"></i><span>${pv ? "Đang phân vân" : "Chưa chắc"}</span>`;
            }
            an(veNav);
            if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n);
        }

        function batTatLoai(v) {
            if (S.mode !== "lam") return;
            const x = items[S.i];
            if (isPractice && S.results[x.key]) return;
            if (x.cau.type !== "trac-nghiem") return;
            const set = (S.loaiTru[x.key] ||= new Set());
            const keyV = String(v);
            if (set.has(keyV)) set.delete(keyV);
            else {
                set.add(keyV);
                if (String(S.ans[x.key]) === keyV) delete S.ans[x.key];
            }
            stage.querySelectorAll(".qz-opt").forEach((b) => {
                const kv = b.dataset.v;
                const on = String(S.ans[x.key] ?? "") === String(kv);
                const biLoai = daLoai(x, kv);
                b.classList.toggle("chon", on);
                b.classList.toggle("bi-loai", biLoai);
                b.setAttribute("aria-checked", on ? "true" : "false");
                const nutL = b.querySelector(".qz-loai-nut");
                if (nutL) {
                    nutL.classList.toggle("on", biLoai);
                    nutL.title = biLoai ? "Bỏ gạch đáp án này" : "Gạch loại trừ đáp án sai (hoặc chuột phải)";
                    nutL.innerHTML = `<i class="fa-solid ${biLoai ? "fa-rotate-left" : "fa-ban"}"></i>`;
                }
            });
            capNhatNut();
            if (soDaLam() > 0) luuTrangThaiDoDang(soDaLam(), n);
        }

        // ====================================================================
        // NỘP BÀI (/api/submit - cân bằng 2 ví với da_thuong_theo_cau)
        // ====================================================================
        async function nop() {
            if (S.dangNop) return;
            S.dangNop = true;
            an(veDay);
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
                            da_thuong_theo_cau: isPractice,
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

                    if (kq.streak !== null && kq.streak !== undefined) {
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

                xoaTrangThaiDoDang();
                ve(1);
            } catch (err) {
                S.dangNop = false;
                an(veDay);
                const l = $("qz-loi");
                if (l) l.textContent = "Không nộp được bài: " + (err.message === "Failed to fetch" ? "không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé!" : err.message);
            }
        }

        // ====================================================================
        // SỰ KIỆN
        // ====================================================================
        stage.addEventListener("click", (e) => {
            if (e.target.closest("#qz-toggle-hotfix") && S.mode === "chang") {
                S.stageRetryOpen = !S.stageRetryOpen;
                ve(1);
                return;
            }
            const rOpt = e.target.closest("[data-retry-key]");
            if (rOpt && S.mode === "chang") {
                const rKey = rOpt.dataset.retryKey;
                (S.stageRetryState[rKey] ||= {}).ans = rOpt.dataset.retryVal;
                stage.querySelectorAll(`[data-retry-key="${CSS.escape(rKey)}"]`).forEach((btn) => {
                    btn.classList.toggle("on", btn.dataset.retryVal === rOpt.dataset.retryVal);
                });
                return;
            }
            const rSub = e.target.closest("[data-retry-submit]");
            if (rSub && S.mode === "chang") {
                chamLaiTrongChang(rSub.dataset.retrySubmit);
                return;
            }
            const luckyBtn = e.target.closest('[data-act="save-lucky"]');
            if (luckyBtn && S.mode === "lam") {
                luuMayMan(items[S.i]);
                return;
            }
            const go = e.target.closest("[data-goto]");
            if (go && S.mode === "tong") { nhayToi(Number(go.dataset.goto)); return; }
            const xem = e.target.closest("[data-xem]");
            if (xem && S.mode === "ketqua") { nhayToi(Number(xem.dataset.xem)); return; }
            const fl = e.target.closest('[data-act="flag"]');
            if (fl && S.mode === "lam") { batTatPhanVan(); return; }
            const loaiBtn = e.target.closest("[data-loai]");
            if (loaiBtn && S.mode === "lam") {
                e.stopPropagation();
                batTatLoai(loaiBtn.dataset.loai);
                return;
            }
            const o = e.target.closest(".qz-opt");
            if (o && S.mode === "lam") chon(o.dataset.v);
        });

        stage.addEventListener("contextmenu", (e) => {
            if (S.mode !== "lam") return;
            const o = e.target.closest(".qz-opt");
            if (!o || items[S.i]?.cau?.type !== "trac-nghiem") return;
            e.preventDefault();
            batTatLoai(o.dataset.v);
        });

        stage.addEventListener("input", (e) => {
            if (S.mode === "chang" && e.target.matches("[data-retry-input]")) {
                const rKey = e.target.dataset.retryInput;
                (S.stageRetryState[rKey] ||= {}).ans = e.target.value;
                return;
            }
            if (S.mode !== "lam" || !e.target.matches(".qz-in, .qz-ta")) return;
            const x = items[S.i];
            if (isPractice && S.results[x.key]) return;
            const truoc = daTraLoi(x);
            S.ans[x.key] = e.target.value;
            if (!truoc && e.target.value.trim()) Am.go();
            if (e.target.matches(".qz-ta")) {
                const v = e.target.value.trim();
                stage.querySelector(".qz-dem-tu").textContent = (v ? v.split(/\s+/).length : 0) + " từ";
            }
            capNhatNut();
            luuTrangThaiDoDang(soDaLam(), n);
        });

        tien.addEventListener("click", (e) => {
            const pill = e.target.closest("[data-seg-go]");
            if (pill) { nhayToi(Number(pill.dataset.segGo)); return; }
            if (!tienRay.hidden) nhayToi(viTriCau(e.clientX));
        });
        tien.addEventListener("mousemove", (e) => {
            if (tienRay.hidden) { delete tien.dataset.goi; return; }
            if (S.mode === "lam" || S.mode === "xemlai") {
                tien.dataset.goi = `Câu ${viTriCau(e.clientX) + 1}`;
                tien.style.setProperty("--x", e.clientX - tien.getBoundingClientRect().left + "px");
            } else delete tien.dataset.goi;
        });

        nutDs.addEventListener("click", moTongQuan);

        $("qz-nav").addEventListener("click", (e) => {
            const g = e.target.closest("[data-nav]");
            if (g) { nhayToi(Number(g.dataset.nav)); return; }
            if (!e.target.closest("#qz-nav-nut") || S.modal || S.dangNop) return;
            if (navNut.dataset.navAct === "kq") { S.mode = "ketqua"; ve(-1); }
            else moTongQuan();
        });

        bottom.addEventListener("click", (e) => {
            const cBtn = e.target.closest("[data-conf]");
            if (cBtn && !cBtn.disabled) {
                chamCauTucThi(cBtn.dataset.conf);
                return;
            }
            const b = e.target.closest("[data-act]");
            if (!b || b.disabled) return;
            const a = b.dataset.act;
            if (a === "tiep") tiep();
            else if (a === "bo") boQua();
            else if (a === "lui") lui();
            else if (a === "lui-chang") lui();
            else if (a === "tiep-chang") {
                const segIdx = currentSegIdx();
                if (segIdx < segments.length - 1) {
                    S.mode = "lam";
                    S.i = segments[segIdx + 1].start;
                    ve(1);
                } else {
                    yeuCauNop();
                }
            }
            else if (a === "nop") yeuCauNop();
            else if (a === "xem") { S.mode = "xemlai"; S.i = 0; ve(1); }
            else if (a === "lai") { xoaTrangThaiDoDang(); location.reload(); }
        });

        $("qz-x").addEventListener("click", async () => {
            if (S.modal || S.dangNop) return;
            if (S.mode === "xemlai") { S.mode = "ketqua"; ve(-1); return; }
            if (S.mode === "lam" || S.mode === "tong" || S.mode === "chang") {
                const da = soDaLam();
                if (da > 0) {
                    const ok = await hoi({
                        icon: "fa-right-from-bracket", mau: "do", nguy: true,
                        tieuDe: "Thoát khỏi bài làm?",
                        noiDung: `Bạn đã làm ${da}/${n} câu. Hệ thống sẽ lưu tiến độ này vào danh sách bài đang làm dở để bạn quay lại làm tiếp bất cứ lúc nào.`,
                        huy: "Ở lại làm bài", ok: "Thoát",
                    });
                    if (!ok) return;
                    luuTrangThaiDoDang(da, n);
                }
            }
            location.href = duongBai;
        });

        function moTp() {
            const x = items[S.i];
            if (!x || !x.bai.tac_pham) return;
            const tieu = $("qz-sheet-tieu");
            if (tieu) tieu.innerHTML = `<i class="fa-solid fa-book-open"></i> Ngữ liệu`;
            sheetThan.innerHTML = htmlTp(x.bai);
            sheet.hidden = false;
            capNhatPhu();
            veCongThuc(sheetThan);
            $("qz-sheet-x").focus();
        }
        function moLyThuyet() {
            if (!lyThuyet) return;
            const tieu = $("qz-sheet-tieu");
            if (tieu) tieu.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> Tóm tắt lý thuyết`;
            sheetThan.innerHTML = `<div class="nd">${lyThuyet}</div>`;
            sheet.hidden = false;
            capNhatPhu();
            veCongThuc(sheetThan);
            $("qz-sheet-x").focus();
        }
        function dongTp() { sheet.hidden = true; capNhatPhu(); }
        nutTp.addEventListener("click", moTp);
        if (nutLt) nutLt.addEventListener("click", moLyThuyet);
        $("qz-sheet-x").addEventListener("click", dongTp);
        sheet.addEventListener("click", (e) => { if (e.target.matches("[data-dong]")) dongTp(); });

        document.addEventListener("keydown", (e) => {
            if (e.defaultPrevented || S.modal || S.isChecking) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "Escape") { if (!sheet.hidden) dongTp(); return; }
            if (!sheet.hidden) return;
            const el = e.target, tag = el.tagName;
            const trongO = tag === "INPUT" || tag === "TEXTAREA";

            if (e.key === "Enter") {
                if (tag === "TEXTAREA" || tag === "A") return;
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
                if (k === "f") {
                    const coF = x.cau.type === "trac-nghiem" && (x.cau.dap_an || []).length >= 6;
                    if (!coF) { e.preventDefault(); batTatPhanVan(); return; }
                }
                if (isPractice && !S.results[x.key] && daTraLoi(x) && ["1", "2", "3"].includes(k)) {
                    const confMap = { "1": "doan_thu", "2": "kha_chac", "3": "rat_chac" };
                    e.preventDefault();
                    chamCauTucThi(confMap[k]);
                    return;
                }
                if (x.cau.type === "trac-nghiem") {
                    const idx = "abcdef".indexOf(k);
                    if (idx >= 0 && idx < (x.cau.dap_an || []).length) { e.preventDefault(); chon(idx); }
                } else if (x.cau.type === "dung-sai") {
                    if (k === "d") { e.preventDefault(); chon("true"); }
                    else if (k === "s") { e.preventDefault(); chon("false"); }
                }
            }
        });

        ve(1);
        return true;
    }

    return { chay };
})();
