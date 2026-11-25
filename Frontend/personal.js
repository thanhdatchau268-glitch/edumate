// personal.js - trang "Học tập cá nhân hoá" (V30 PC Master)
// Dữ liệu lưu trong localStorage theo từng tài khoản (khóa edumate_hoctap_<userId>)
document.addEventListener("DOMContentLoaded", () => {
    const uid = localStorage.getItem("userId");
    if (!uid) { location.href = "login.html"; return; }

    const API = (window.VNSTARL_API || "http://127.0.0.1:5000").replace(/\/+$/, "");
    const $ = (id) => document.getElementById(id);
    const KEY = "edumate_hoctap_" + uid;
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // ---------- Hàm giờ giấc (đồng hồ 24h, tính bằng phút từ 00:00) ----------
    const phut = (s) => {
        const m = String(s ?? "").trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{0,2})$/);
        if (!m) return NaN;
        const h = +m[1], p = +(m[2] || 0);
        return h < 24 && p < 60 ? h * 60 + p : NaN;
    };
    const gioStr = (p) => {
        const c = Math.max(0, Math.min(1440, Math.round(p)));
        return String(Math.floor(c / 60)).padStart(2, "0") + ":" + String(c % 60).padStart(2, "0");
    };

    const chi = (t) => (t === 8 ? 6 : t - 2);
    const tenIdx = (d) => (d === 6 ? "CN" : "T" + (d + 2));

    const LOAI = {
        "Kiểm tra 15 phút": 60,
        "Kiểm tra 1 tiết": 120,
        "Kiểm tra học kì": 240,
        "Bài tập / nộp bài": 60,
        "Khác": 45,
    };
    const KHONG_HOC = new Set(["Chào cờ", "SHL"]);

    // ---------- Dữ liệu ----------
    const MAC_DINH = () => ({
        tkb: Array.from({ length: 10 }, () => Array(6).fill("")),
        gio: { sang: "07:00", chieu: "13:30", tiet: 45, nghi: 5, batDau: "06:00", ngu: "21:30", edumate: 30 },
        extra: [],
        viec: [],
        uuTien: [],
        nhomUuTien: { cao: [], deu: [], nhe: [] },
        daXong: {},
    });

    let S = MAC_DINH();
    try {
        const cu = JSON.parse(localStorage.getItem(KEY) || "{}");
        S = {
            ...S,
            ...cu,
            gio: { ...S.gio, ...(cu.gio || {}) },
            nhomUuTien: {
                cao: Array.isArray(cu.nhomUuTien?.cao) ? cu.nhomUuTien.cao.slice() : [],
                deu: Array.isArray(cu.nhomUuTien?.deu) ? cu.nhomUuTien.deu.slice() : [],
                nhe: Array.isArray(cu.nhomUuTien?.nhe) ? cu.nhomUuTien.nhe.slice() : [],
            },
            daXong: cu.daXong || {},
        };
    } catch (e) { /* dùng mặc định */ }

    const luuTonTai = () => localStorage.setItem(KEY, JSON.stringify(S));
    const luu = () => {
        luuTonTai();
        dongBoLichNgam();
        capNhatTrangThaiSetup();
    };

    // ---------- 1. Bảng thời khóa biểu 10 hàng x 6 cột ----------
    function veBang() {
        let h = "<thead><tr><th></th>" + [2, 3, 4, 5, 6, 7].map((t) => `<th>T${t}</th>`).join("") + "</tr></thead><tbody>";
        S.tkb.forEach((r, i) => {
            h += `<tr${i === 5 ? ' class="chia"' : ""}><td class="nhan">${i < 5 ? "S" + (i + 1) : "C" + (i - 4)}</td>` +
                r.map((v, j) => `<td><input list="ds-mon" data-r="${i}" data-c="${j}" value="${esc(v)}"
          class="${v && window.TKB_OCR && TKB_OCR.timMon(v).kieu === "la" ? "la" : ""}"></td>`).join("") + "</tr>";
        });
        $("tkb").innerHTML = h + "</tbody>";
    }
    $("tkb").addEventListener("input", (e) => {
        if (e.target.dataset.r == null) return;
        S.tkb[+e.target.dataset.r][+e.target.dataset.c] = e.target.value.trim();
        capNhatUuTien(false);
        luu();
    });
    $("tkb").addEventListener("change", () => { capNhatUuTien(false); luu(); });
    if (window.TKB_OCR) $("ds-mon").innerHTML = TKB_OCR.TEN_MON.map((m) => `<option value="${esc(m)}">`).join("");

    $("file").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const tt = $("ocr-tt");
        try {
            if (!window.TKB_OCR) throw new Error("Không nạp được tkb-ocr.js.");
            await napTesseract();
            const kq = await TKB_OCR.docAnh(f, (m, p) => { tt.textContent = m; if (p != null) $("thanh").style.width = p + "%"; });
            const t = MAC_DINH().tkb, dem = { S: 0, C: 0 };
            kq.rows.forEach((r) => {
                const k = r.buoi === "Sáng" ? "S" : "C", i = dem[k]++;
                if (i >= 5) return;
                kq.days.forEach((d, j) => { if (d >= 2 && d <= 7 && r.cells[j]) t[(k === "S" ? 0 : 5) + i][d - 2] = TKB_OCR.timMon(r.cells[j]).ten; });
            });
            S.tkb = t;
            veBang();
            capNhatUuTien(false);
            luu();
            tt.textContent = "Đã đọc xong. Hãy kiểm tra và sửa các ô sai (ô viền vàng là chưa nhận ra môn).";
        } catch (err) { tt.textContent = "Lỗi: " + err.message; }
        $("thanh").style.width = "0";
        e.target.value = "";
    });
    $("btn-xoa-tkb").addEventListener("click", () => {
        S.tkb = MAC_DINH().tkb;
        veBang();
        capNhatUuTien(false);
        luu();
    });

    const mqMobile = window.matchMedia("(max-width: 640px)");
    const tkbHeader = $("tkb-header");
    const tkbNoiDung = $("tkb-noi-dung");
    if (tkbHeader && tkbNoiDung) {
        function toggleTkb(e) {
            if (!mqMobile.matches) return;
            if (e) e.preventDefault();
            const dangMo = !tkbNoiDung.hidden;
            tkbNoiDung.hidden = dangMo;
            tkbHeader.classList.toggle("mo", !dangMo);
            tkbHeader.setAttribute("aria-expanded", !dangMo);
            const chu = tkbHeader.querySelector(".tkb-toggle-chu");
            if (chu) chu.textContent = dangMo ? "Xem bảng" : "Thu gọn";
        }
        tkbHeader.addEventListener("click", toggleTkb);
        tkbHeader.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTkb(); }
        });
    }

    // ---------- 2. Học thêm và 3. Công việc tuần này ----------
    const bao = (id, chu) => { const el = $(id); if (el) el.textContent = chu; };

    $("btn-them-extra").addEventListener("click", () => {
        const tu = phut($("ex-tu").value), den = phut($("ex-den").value);
        if (isNaN(tu) || isNaN(den) || den <= tu) return bao("ex-tt", "Nhập giờ dạng 24h, ví dụ 19:00 đến 20:30.");
        S.extra.push({ thu: +$("ex-thu").value, tu, den, mon: $("ex-mon").value.trim() });
        bao("ex-tt", "");
        $("ex-mon").value = "";
        capNhatUuTien(false);
        luu();
        veDanhSach();
    });

    $("vi-loai").addEventListener("change", () => ($("vi-phut").value = LOAI[$("vi-loai").value]));
    $("btn-them-viec").addEventListener("click", () => {
        const mon = $("vi-mon").value.trim();
        if (!mon) return bao("vi-tt", "Hãy nhập tên môn.");
        S.viec.push({
            thu: +$("vi-thu").value,
            mon,
            loai: $("vi-loai").value,
            phut: Math.max(15, +$("vi-phut").value || 45),
            ghi: $("vi-ghi").value.trim(),
        });
        bao("vi-tt", "");
        $("vi-mon").value = "";
        $("vi-ghi").value = "";
        capNhatUuTien(false);
        luu();
        veDanhSach();
    });

    function veDanhSach() {
        $("ds-extra").innerHTML = S.extra.map((e, i) =>
            `<li>${tenIdx(chi(e.thu))} ${gioStr(e.tu)}–${gioStr(e.den)} ${esc(e.mon)} <button data-xoa="extra" data-i="${i}">Xóa</button></li>`
        ).join("") || '<li class="phu">Chưa có.</li>';

        $("ds-viec").innerHTML = S.viec.map((v, i) =>
            `<li class="${v.xong ? "da-xong" : ""}">
               <button type="button" class="viec-tick${v.xong ? " on" : ""}" data-tick-viec="${i}" aria-pressed="${!!v.xong}" title="${v.xong ? "Bỏ đánh dấu hoàn thành" : "Đánh dấu đã hoàn thành"}">
                 <i class="fa-solid fa-check"></i>
               </button>
               <span class="viec-nd"><b>${tenIdx(chi(v.thu))}</b> · ${esc(v.mon)} · ${esc(v.loai)} (${v.phut} phút) ${esc(v.ghi)}</span>
               <button data-xoa="viec" data-i="${i}">Xóa</button>
             </li>`
        ).join("") || '<li class="phu">Chưa có.</li>';
    }

    document.addEventListener("click", (e) => {
        const tickViec = e.target.closest("[data-tick-viec]");
        if (tickViec) {
            const idx = +tickViec.dataset.tickViec;
            if (S.viec[idx]) { S.viec[idx].xong = !S.viec[idx].xong; luu(); veDanhSach(); }
            return;
        }
        const delBtn = e.target.closest("[data-xoa]");
        if (!delBtn) return;
        const x = delBtn.dataset.xoa;
        S[x].splice(+delBtn.dataset.i, 1);
        capNhatUuTien(false);
        luu();
        veDanhSach();
    });

    // ---------- 4. Phân tầng 3 nhóm ưu tiên môn (Kéo-thả + Gợi ý theo mục tiêu) ----------
    const chuanChu = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();

    const MON_CHUYEN_KEYWORDS = {
        toan: ["toan"],
        ly: ["vat li", "vat ly", "ly", "khtn"],
        hoa: ["hoa hoc", "hoa", "khtn"],
        sinh: ["sinh hoc", "sinh", "khtn"],
        van: ["ngu van", "van"],
        anh: ["tieng anh", "ngoai ngu", "anh"],
        su: ["lich su", "su", "ls&dl"],
        dia: ["dia li", "dia ly", "dia", "ls&dl"],
        tin: ["tin hoc", "tin"],
    };

    function laMonNhe(mon) {
        const k = chuanChu(mon);
        return /^(the duc|gdtc|mi thuat|my thuat|am nhac|hdtn|nghe thuat|gddp|giao duc dia phuong|trai nghiem)/.test(k);
    }

    function laMonThiChinh(mon) {
        const k = chuanChu(mon);
        if (/^(toan|ngu van|van|tieng anh|ngoai ngu|anh)$/.test(k)) return true;
        const mc = (localStorage.getItem("monChuyen") || "").trim().toLowerCase();
        const kws = MON_CHUYEN_KEYWORDS[mc] || [];
        return kws.some((kw) => k === kw || k.includes(kw));
    }

    function thuTuGoiYCao(mon) {
        const k = chuanChu(mon);
        if (k.startsWith("toan")) return 0;
        const mc = (localStorage.getItem("monChuyen") || "").trim().toLowerCase();
        const kws = MON_CHUYEN_KEYWORDS[mc] || [];
        if (mc && mc !== "toan" && kws.some((kw) => k === kw || k.includes(kw))) return 1;
        if (k.includes("van")) return 2;
        if (k.includes("anh") || k.includes("ngoai ngu")) return 3;
        return 10;
    }

    function phanLoaiMacDinh(mon) {
        if (laMonNhe(mon)) return "nhe";
        if (laMonThiChinh(mon)) return "cao";
        return "deu";
    }

    function dongBoMangUuTienPhang() {
        S.uuTien = [
            ...S.nhomUuTien.cao,
            ...S.nhomUuTien.deu,
            ...S.nhomUuTien.nhe,
        ];
    }

    function layTapMonHienCo() {
        const ds = new Set();
        S.tkb.flat().forEach((m) => { const v = String(m || "").trim(); if (v && !KHONG_HOC.has(v)) ds.add(v); });
        S.extra.forEach((e) => { const v = String(e.mon || "").trim(); if (v && !KHONG_HOC.has(v)) ds.add(v); });
        S.viec.forEach((v) => { const m = String(v.mon || "").trim(); if (m && !KHONG_HOC.has(m)) ds.add(m); });
        return ds;
    }

    function capNhatUuTien(goiYLai = false) {
        const ds = layTapMonHienCo();
        if (goiYLai) {
            S.nhomUuTien = { cao: [], deu: [], nhe: [] };
            Array.from(ds).forEach((m) => {
                S.nhomUuTien[phanLoaiMacDinh(m)].push(m);
            });
            S.nhomUuTien.cao.sort((a, b) => thuTuGoiYCao(a) - thuTuGoiYCao(b) || a.localeCompare(b, "vi"));
        } else {
            // Lọc bỏ môn không còn tồn tại
            const daCo = new Set();
            ["cao", "deu", "nhe"].forEach((tier) => {
                S.nhomUuTien[tier] = (S.nhomUuTien[tier] || []).filter((m) => {
                    if (!ds.has(m) || daCo.has(m)) return false;
                    daCo.add(m);
                    return true;
                });
            });
            // Nếu có dữ liệu cũ từ S.uuTien nhưng chưa có nhomUuTien thì chuyển mượt sang 3 nhóm
            const nguon = [...S.uuTien, ...Array.from(ds)];
            nguon.forEach((m) => {
                if (!ds.has(m) || daCo.has(m)) return;
                daCo.add(m);
                S.nhomUuTien[phanLoaiMacDinh(m)].push(m);
            });
        }
        dongBoMangUuTienPhang();
        veUuTien3Nhom();
    }

    let dragState = null;

    function veUuTien3Nhom() {
        ["cao", "deu", "nhe"].forEach((tier) => {
            const box = $("tier-list-" + tier);
            if (!box) return;
            const list = S.nhomUuTien[tier] || [];
            if (!list.length) {
                box.innerHTML = `<div class="tier-empty-drop">Kéo thẻ môn thả vào nhóm này</div>`;
                return;
            }
            box.innerHTML = list.map((mon, idx) => `
                <div class="tier-pill" draggable="true" data-tier="${tier}" data-mon="${esc(mon)}" data-idx="${idx}" title="Kéo thả để đổi thứ tự hoặc chuyển nhóm">
                    <i class="fa-solid fa-grip-vertical tier-pill-grip" aria-hidden="true"></i>
                    <span class="tier-pill-name">${tier === "cao" ? `${idx + 1}. ` : ""}${esc(mon)}</span>
                </div>
            `).join("");
        });
    }

    const tiersWrap = $("uu-tien-tiers");
    if (tiersWrap) {
        tiersWrap.addEventListener("dragstart", (e) => {
            const pill = e.target.closest(".tier-pill");
            if (!pill) return;
            dragState = { tier: pill.dataset.tier, mon: pill.dataset.mon };
            pill.classList.add("is-dragging");
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", pill.dataset.mon);
            }
        });
        tiersWrap.addEventListener("dragend", () => {
            tiersWrap.querySelectorAll(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
            tiersWrap.querySelectorAll(".is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
            dragState = null;
        });
        tiersWrap.addEventListener("dragover", (e) => {
            if (!dragState) return;
            const zone = e.target.closest(".tier-box[data-tier]");
            if (!zone) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            tiersWrap.querySelectorAll(".tier-box.is-drag-over").forEach((el) => {
                if (el !== zone) el.classList.remove("is-drag-over");
            });
            zone.classList.add("is-drag-over");
        });
        tiersWrap.addEventListener("dragleave", (e) => {
            const zone = e.target.closest(".tier-box[data-tier]");
            if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("is-drag-over");
        });
        tiersWrap.addEventListener("drop", (e) => {
            if (!dragState) return;
            const zone = e.target.closest(".tier-box[data-tier]");
            if (!zone) return;
            e.preventDefault();
            zone.classList.remove("is-drag-over");

            const toTier = zone.dataset.tier;
            const fromTier = dragState.tier;
            const mon = dragState.mon;
            const targetPill = e.target.closest(".tier-pill");

            S.nhomUuTien[fromTier] = S.nhomUuTien[fromTier].filter((m) => m !== mon);
            if (targetPill && targetPill.dataset.tier === toTier && targetPill.dataset.mon !== mon) {
                const pos = S.nhomUuTien[toTier].indexOf(targetPill.dataset.mon);
                if (pos >= 0) S.nhomUuTien[toTier].splice(pos, 0, mon);
                else S.nhomUuTien[toTier].push(mon);
            } else {
                S.nhomUuTien[toTier].push(mon);
            }
            dongBoMangUuTienPhang();
            veUuTien3Nhom();
            luu();
        });
    }

    const btnGoiY = $("btn-goi-y-uutien");
    if (btnGoiY) {
        btnGoiY.addEventListener("click", () => {
            capNhatUuTien(true);
            luu();
        });
    }

    const btnToggleNhe = $("btn-toggle-nhe");
    if (btnToggleNhe) {
        btnToggleNhe.addEventListener("click", () => {
            const box = $("tier-box-nhe");
            if (!box) return;
            const collapsed = box.classList.toggle("is-collapsed");
            btnToggleNhe.setAttribute("aria-expanded", String(!collapsed));
        });
    }

    // ---------- 5. Giờ giấc ----------
    document.querySelectorAll("[data-g]").forEach((el) => {
        el.value = S.gio[el.dataset.g];
        el.addEventListener("change", () => {
            const k = el.dataset.g, laGio = el.dataset.kieu === "gio";
            if (laGio && isNaN(phut(el.value))) { el.value = S.gio[k]; return; }
            S.gio[k] = laGio ? gioStr(phut(el.value)) : Math.max(1, +el.value || 1);
            el.value = S.gio[k];
            luu();
        });
    });

    // ---------- 6. Thuật toán xếp lịch ngầm (giữ cho thong-bao.js & vuon-saoladou.js) ----------
    function keHoach() {
        const now = new Date(), ti = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes();
        const g = S.gio, tiet = +g.tiet, nghi = +g.nghi, ngu = phut(g.ngu), ed = Math.max(10, +g.edumate || 30);
        const rank = (m) => { const i = S.uuTien.indexOf(m); return i < 0 ? 99 : i; };
        const ngay = [], canhbao = [];

        for (let d = ti; d < 7; d++) {
            const muc = [];
            if (d < 6) [[0, phut(g.sang), "Sáng"], [5, phut(g.chieu), "Chiều"]].forEach(([bd, st, b]) => {
                const m = S.tkb.slice(bd, bd + 5).map((r) => r[d]);
                let k = -1; m.forEach((x, i) => x && (k = i));
                if (k >= 0) muc.push({ s: st, e: st + (k + 1) * tiet + k * nghi, loai: "truong", ten: `Ở trường (${b}): ` + m.slice(0, k + 1).filter(Boolean).join(", ") });
            });
            S.extra.filter((e) => chi(e.thu) === d).forEach((e) => muc.push({ s: e.tu, e: e.den, loai: "them", ten: "Học thêm" + (e.mon ? ": " + e.mon : "") }));

            let win = [[phut(g.batDau), ngu]];
            [...muc.map((m) => [m.s, m.e]), [690, 780], [1080, 1140]].forEach(([s, e]) => {
                win = win.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, Math.min(b, s)], [Math.max(a, e), b]].filter((w) => w[1] - w[0] > 0)));
            });
            win = win.filter((w) => w[1] - w[0] >= 20);
            const x = {
                d, muc, tong: 0,
                dat(len) {
                    for (const w of win) if (w[1] - w[0] >= len) { const s = w[0]; w[0] = s + len + 10; return [s, s + len]; }
                    return null;
                },
            };
            const wEd = [...win].reverse().find((w) => w[1] - w[0] >= ed);
            if (wEd) { muc.push({ s: wEd[0], e: wEd[0] + ed, loai: "edumate", ten: "Luyện tập trên VnStarL" }); wEd[0] += ed + 10; }
            ngay.push(x);
        }

        S.viec.filter((v) => !v.xong).map((v) => ({ ...v, du: chi(v.thu) })).filter((v) => v.du >= ti)
            .sort((a, b) => a.du - b.du || rank(a.mon) - rank(b.mon)).forEach((v) => {
                const cuoi = Math.max(ti, v.du - 1);
                let con = v.phut;
                while (con > 0) {
                    const len = Math.max(20, Math.min(45, con));
                    let sl = null;
                    for (const x of ngay.filter((n) => n.d <= cuoi).sort((a, b) => a.tong - b.tong || a.d - b.d)) {
                        const o = x.dat(len);
                        if (o) { sl = [x, o]; break; }
                    }
                    if (!sl) { canhbao.push(`Thiếu ${con} phút ôn ${v.mon}`); break; }
                    sl[0].muc.push({ s: sl[1][0], e: sl[1][1], loai: "hoc", ten: `Ôn ${v.mon} (${v.loai})` });
                    sl[0].tong += len; con -= len;
                }
            });

        const top = S.uuTien.filter((m) => S.tkb.flat().includes(m)).slice(0, 2);
        ngay.forEach((x) => top.forEach((m) => { const s = x.dat(30); if (s) x.muc.push({ s: s[0], e: s[1], loai: "on", ten: "Ôn bài " + m }); }));
        return { ngay, ti, nowMin, canhbao };
    }

    function ngayKeyCua(d, ti) {
        const hn = new Date();
        const dt = new Date(hn.getFullYear(), hn.getMonth(), hn.getDate() + (d - ti));
        return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    }

    function luuLichChoThongBao(kh) {
        try {
            const lich = {};
            kh.ngay.forEach((x) => {
                const key = ngayKeyCua(x.d, kh.ti);
                lich[key] = x.muc.filter((m) => m.loai !== "truong").map((m) => ({ s: m.s, e: m.e, loai: m.loai, ten: m.ten }));
            });
            localStorage.setItem("saola_lich_" + uid, JSON.stringify(lich));
        } catch (e) { /* bỏ qua */ }
    }

    function dongBoLichNgam() {
        const kh = keHoach();
        luuLichChoThongBao(kh);
    }

    // ---------- 7. Hai trạng thái Thiết lập + Card "Xem trước nhịp học trong ngày" ----------
    function coDuLieuTkb() {
        return S.tkb.flat().some((x) => String(x || "").trim() !== "") || S.viec.length > 0;
    }

    function veXemTruocNhipHoc() {
        const tlEl = $("timeline-24h");
        const listEl = $("preview-slot-list");
        const dayTag = $("preview-day-tag");
        if (!tlEl || !listEl) return;

        const g = S.gio;
        const batDau = isNaN(phut(g.batDau)) ? 360 : phut(g.batDau);
        const ngu = isNaN(phut(g.ngu)) ? 1290 : phut(g.ngu);
        const sang = isNaN(phut(g.sang)) ? 420 : phut(g.sang);
        const chieu = isNaN(phut(g.chieu)) ? 810 : phut(g.chieu);
        const tiet = Math.max(15, +g.tiet || 45);
        const nghi = Math.max(0, +g.nghi || 5);
        const ed = Math.max(10, +g.edumate || 30);

        // Chọn ngày đại diện có nhiều tiết nhất (ưu tiên hôm nay nếu T2..T7 và có tiết)
        const now = new Date();
        const todayIdx = (now.getDay() + 6) % 7;
        let dChon = todayIdx < 6 ? todayIdx : 0;
        const demTietNgay = (d) => S.tkb.reduce((acc, r) => acc + (String(r[d] || "").trim() ? 1 : 0), 0);
        if (demTietNgay(dChon) === 0) {
            let bestD = 0, bestN = -1;
            for (let d = 0; d < 6; d++) {
                const n = demTietNgay(d);
                if (n > bestN) { bestN = n; bestD = d; }
            }
            dChon = bestD;
        }
        if (dayTag) dayTag.textContent = dChon === todayIdx ? `Hôm nay (${tenIdx(dChon)})` : `Ngày mẫu (${tenIdx(dChon)})`;

        const busy = [];
        // Học sáng / chiều
        [[0, sang, "sang", "Học sáng trên trường"], [5, chieu, "chieu", "Học chiều trên trường"]].forEach(([bd, st, cls, lbl]) => {
            const col = S.tkb.slice(bd, bd + 5).map((r) => r[dChon]);
            let last = -1;
            col.forEach((v, i) => { if (String(v || "").trim()) last = i; });
            if (last >= 0) {
                busy.push({ s: st, e: st + (last + 1) * tiet + last * nghi, cls, lbl });
            }
        });
        // Học thêm của ngày đại diện
        S.extra.filter((e) => chi(e.thu) === dChon).forEach((e) => {
            busy.push({ s: e.tu, e: e.den, cls: "them", lbl: "Học thêm" + (e.mon ? ` (${e.mon})` : "") });
        });

        // Tìm khoảng trống tự học (ưu tiên buổi tối sau 18:30 hoặc khoảng trống dài nhất trước giờ ngủ)
        const chan = [...busy.map((b) => [b.s, b.e]), [690, 780], [1080, 1140]];
        let free = [[batDau, ngu]];
        chan.forEach(([s, e]) => {
            free = free.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, Math.min(b, s)], [Math.max(a, e), b]].filter((w) => w[1] - w[0] > 0)));
        });
        free = free.filter((w) => w[1] - w[0] >= 25);

        const topMon = (S.nhomUuTien.cao.length ? S.nhomUuTien.cao : S.uuTien).slice(0, 2);
        const topLabel = topMon.length ? topMon.join(", ") : "môn trọng tâm";

        // Xếp 2 khối tự học nổi bật trên timeline: Ôn ưu tiên cao + Luyện tập VnStarL
        let slotUuTien = null;
        let slotVnStarL = null;
        const winToi = [...free].reverse().find((w) => w[1] - w[0] >= ed + 35) || [...free].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
        if (winToi) {
            const tongRanh = winToi[1] - winToi[0];
            const lenVn = Math.min(ed, Math.max(15, Math.floor(tongRanh * 0.4)));
            const lenUu = Math.max(25, Math.min(90, tongRanh - lenVn));
            slotUuTien = { s: winToi[0], e: winToi[0] + lenUu, cls: "uutien", lbl: `Ôn ưu tiên cao (${topLabel})` };
            slotVnStarL = { s: slotUuTien.e, e: Math.min(winToi[1], slotUuTien.e + lenVn), cls: "vnstarl", lbl: `Luyện tập VnStarL (${lenVn} phút)` };
        } else {
            // Fallback an toàn nếu lịch kín
            const s1 = Math.max(batDau, ngu - ed - 75);
            slotUuTien = { s: s1, e: Math.max(s1 + 30, ngu - ed), cls: "uutien", lbl: `Ôn ưu tiên cao (${topLabel})` };
            slotVnStarL = { s: slotUuTien.e, e: ngu, cls: "vnstarl", lbl: `Luyện tập VnStarL (${ed} phút)` };
        }

        // Hợp nhất toàn bộ các đoạn trong 0..1440 phút không chồng lấn
        const fixedSegs = [
            { s: 0, e: batDau, cls: "ngu", lbl: "Ngủ đêm & nghỉ ngơi", icon: "🌙" },
            ...busy,
            slotUuTien,
            slotVnStarL,
            { s: ngu, e: 1440, cls: "ngu", lbl: "Nghỉ ngơi bảo vệ giấc ngủ", icon: "🌙" },
        ].filter((x) => x && x.e > x.s).sort((a, b) => a.s - b.s);

        const finalSegs = [];
        let cursor = 0;
        fixedSegs.forEach((seg) => {
            const s = Math.max(cursor, seg.s);
            const e = Math.min(1440, seg.e);
            if (s > cursor) {
                finalSegs.push({ s: cursor, e: s, cls: "dem", lbl: "Nghỉ ngơi / Sinh hoạt" });
            }
            if (e > s) {
                finalSegs.push({ ...seg, s, e });
                cursor = e;
            }
        });
        if (cursor < 1440) finalSegs.push({ s: cursor, e: 1440, cls: "dem", lbl: "Nghỉ ngơi / Sinh hoạt" });

        tlEl.innerHTML = finalSegs.map((seg) => {
            const wPct = ((seg.e - seg.s) / 1440) * 100;
            const showMoon = seg.icon && wPct >= 6.5;
            return `<span class="tl-seg tl-seg--${seg.cls}" style="width:${wPct.toFixed(2)}%" title="${esc(`${gioStr(seg.s)} – ${gioStr(seg.e)} · ${seg.lbl}`)}">${showMoon ? seg.icon : ""}</span>`;
        }).join("");

        listEl.innerHTML = `
            <li class="preview-slot-item">
                <span class="preview-slot-dot preview-slot-dot--uutien"></span>
                <span><b>${gioStr(slotUuTien.s)} - ${gioStr(slotUuTien.e)}:</b> Ôn ưu tiên cao (${esc(topLabel)})</span>
            </li>
            <li class="preview-slot-item">
                <span class="preview-slot-dot preview-slot-dot--vnstarl"></span>
                <span><b>${gioStr(slotVnStarL.s)} - ${gioStr(slotVnStarL.e)}:</b> Luyện tập VnStarL (${Math.round(slotVnStarL.e - slotVnStarL.s)} phút)</span>
            </li>
            <li class="preview-slot-item">
                <span class="preview-slot-dot preview-slot-dot--ngu"></span>
                <span><b>${esc(g.ngu)}:</b> Nghỉ ngơi bảo vệ giấc ngủ</span>
            </li>
        `;
    }

    function capNhatTrangThaiSetup() {
        const hasTkb = coDuLieuTkb();
        const grid = $("setup-bottom-grid");
        const emptyBox = $("uu-tien-empty");
        const tiersBox = $("uu-tien-tiers");
        const btnGoiYEl = $("btn-goi-y-uutien");
        const previewCard = $("setup-preview-card");

        if (grid) grid.classList.toggle("has-tkb", hasTkb);
        if (emptyBox) emptyBox.hidden = hasTkb;
        if (tiersBox) tiersBox.hidden = !hasTkb;
        if (btnGoiYEl) btnGoiYEl.hidden = !hasTkb;
        if (previewCard) previewCard.hidden = !hasTkb;

        if (hasTkb) veXemTruocNhipHoc();

        const bSetup = $("tab-badge-setup");
        if (bSetup) {
            const soViec = S.viec.filter((v) => !v.xong).length;
            bSetup.textContent = hasTkb ? (soViec ? `${soViec} việc tuần` : "Đã có TKB") : "Chưa có TKB";
        }
    }

    const btnApDung = $("btn-ap-dung-nhip-hoc");
    if (btnApDung) {
        btnApDung.addEventListener("click", () => {
            luu();
            const msg = $("preview-save-msg");
            if (msg) {
                msg.textContent = "✔ Đã lưu thiết lập & cập nhật nhịp học!";
                setTimeout(() => { if (msg.textContent.includes("Đã lưu")) msg.textContent = ""; }, 3200);
            }
            if (window.AmThanh && window.AmThanh.dung) window.AmThanh.dung(1);
        });
    }

    // ---------- 8. Panel Tab 1: Bản đồ Sổ lỗi sai (#pn-so-loi) ----------
    const MUC_SL = [
        { ten: "Chưa hiểu", pct: 20, c: "#dc2626" },
        { ten: "Đang ôn", pct: 48, c: "#d97706" },
        { ten: "Sắp vững", pct: 76, c: "#2563eb" },
        { ten: "Thông thạo", pct: 100, c: "#059669" },
    ];
    const TEN_NN = {
        khai_niem: "Chưa hiểu khái niệm",
        tinh_nham: "Tính nhầm",
        doc_sai_de: "Đọc sai đề",
        doan_bua: "Đoán bừa",
    };

    let pslData = [];
    let pslMonChon = "all";
    let pslOnlyDue = false;

    function veBoLocSoLoi() {
        const box = $("psl-mon-pills");
        if (!box) return;
        const map = new Map();
        pslData.forEach((k) => {
            const m = k.mon_ten || "Khác";
            map.set(m, (map.get(m) || 0) + 1);
        });
        if (pslMonChon !== "all" && !map.has(pslMonChon)) pslMonChon = "all";
        let html = `<button type="button" class="psl-mon-pill${pslMonChon === "all" ? " active" : ""}" data-mon="all">Tất cả (${pslData.length})</button>`;
        map.forEach((cnt, mon) => {
            html += `<button type="button" class="psl-mon-pill${pslMonChon === mon ? " active" : ""}" data-mon="${esc(mon)}">${esc(mon)} (${cnt})</button>`;
        });
        box.innerHTML = html;
    }

    function veDanhSachSoLoi() {
        const grid = $("psl-grid");
        if (!grid) return;
        if (!pslData.length) {
            grid.innerHTML = `
                <div class="psl-empty">
                    <strong>🎉 Sổ lỗi sai đang hoàn toàn sạch bóng!</strong>
                    <span>Khi bạn làm sai câu nào trong bài tập, kỹ năng đó sẽ tự động xuất hiện tại đây để vá lỗ hổng.</span><br>
                    <a href="subjects.html"><i class="fa-solid fa-book-open"></i> Sang kho bài tập luyện ngay ➔</a>
                </div>`;
            return;
        }

        const dsLoc = pslData.filter((k) => {
            if (pslMonChon !== "all" && (k.mon_ten || "Khác") !== pslMonChon) return false;
            if (pslOnlyDue && !(k.den_han || k.loi_chua_hieu > 0)) return false;
            return true;
        });

        if (!dsLoc.length) {
            grid.innerHTML = `
                <div class="psl-empty">
                    <strong>Không có kỹ năng nào khớp bộ lọc hiện tại.</strong>
                    <span>Thử tắt lọc "Chỉ hiện cần làm ngay" hoặc chọn môn khác nhé.</span>
                </div>`;
            return;
        }

        grid.innerHTML = dsLoc.map((k) => {
            const mInfo = MUC_SL[Math.max(0, Math.min(3, Number(k.muc) || 0))];
            const isDue = Boolean(k.den_han || k.loi_chua_hieu > 0);
            const stateCls = k.lo_hong_an ? "gap" : (isDue ? "due" : (k.muc >= 3 ? "ok" : "mid"));
            const stateTxt = k.lo_hong_an
                ? "🔥 Lỗ hổng ẩn"
                : (k.den_han ? "⚡ Đến hạn ôn" : (k.loi_chua_hieu > 0 ? `Cần vá (${k.loi_chua_hieu})` : mInfo.ten));
            const nnTxt = k.nguyen_nhan_chinh && TEN_NN[k.nguyen_nhan_chinh] ? ` · ${TEN_NN[k.nguyen_nhan_chinh]}` : "";
            return `
                <article class="psl-card${isDue ? " is-due" : ""}${k.lo_hong_an ? " is-hidden-gap" : ""}">
                    <div class="psl-card-top">
                        <span class="psl-mon-tag">${esc(k.mon_ten || "Môn học")}</span>
                        <span class="psl-state-tag ${stateCls}">${esc(stateTxt)}</span>
                    </div>
                    <h3 class="psl-card-title">${esc(k.ten || k.bai_key)}</h3>
                    <div class="psl-mastery-row">
                        <div class="psl-mastery-bar"><i style="width:${mInfo.pct}%;background:${mInfo.c}"></i></div>
                        <span class="psl-mastery-txt" style="color:${mInfo.c}">${mInfo.ten}</span>
                    </div>
                    <div class="psl-card-foot">
                        <span class="psl-meta">Lỗi chưa hiểu: <b>${k.loi_chua_hieu || 0}</b>${esc(nnTxt)}</span>
                        <a class="psl-go-btn" href="so-loi.html?key=${encodeURIComponent(k.bai_key)}">Ôn thẻ ngay ➔</a>
                    </div>
                </article>`;
        }).join("");
    }

    async function taiSoLoiSai() {
        const grid = $("psl-grid");
        const badge = $("tab-badge-so-loi");
        try {
            const res = await fetch(`${API}/api/so-loi/${uid}/ky-nang`);
            const kq = await res.json();
            if (!res.ok || !kq.success || !kq.data) throw new Error(kq.message || "Lỗi tải Sổ lỗi sai");
            const tt = kq.data.tom_tat || {};
            pslData = Array.isArray(kq.data.ds) ? kq.data.ds : [];

            const tong = Number(tt.tong) || 0;
            const denHan = Number(tt.den_han) || 0;
            const loi = Number(tt.loi_chua_hieu) || 0;
            const ok = Number(tt.thong_thao) || 0;

            if ($("psl-num-tong")) $("psl-num-tong").textContent = tong;
            if ($("psl-num-denhan")) $("psl-num-denhan").textContent = denHan;
            if ($("psl-num-loi")) $("psl-num-loi").textContent = loi;
            if ($("psl-num-ok")) $("psl-num-ok").textContent = ok;

            if (badge) {
                const soCan = denHan > 0 ? denHan : loi;
                badge.classList.toggle("is-due", soCan > 0);
                badge.classList.toggle("is-clean", soCan === 0);
                badge.textContent = soCan > 0 ? `${soCan} cần ôn` : "Sạch lỗi ✔";
            }

            veBoLocSoLoi();
            veDanhSachSoLoi();
        } catch (e) {
            if (badge) badge.textContent = "Mở xem";
            if (grid) {
                grid.innerHTML = `
                    <div class="psl-empty">
                        <strong>Chưa tải được dữ liệu Sổ lỗi sai</strong>
                        <span>Hãy chắc chắn backend <code>app.py</code> đang chạy, hoặc bấm nút bên trên để vào phòng ôn trực tiếp.</span>
                    </div>`;
            }
        }
    }

    const monPillsEl = $("psl-mon-pills");
    if (monPillsEl) {
        monPillsEl.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-mon]");
            if (!btn) return;
            pslMonChon = btn.dataset.mon;
            veBoLocSoLoi();
            veDanhSachSoLoi();
        });
    }
    const onlyDueBtn = $("psl-only-due");
    if (onlyDueBtn) {
        onlyDueBtn.addEventListener("click", () => {
            pslOnlyDue = !pslOnlyDue;
            onlyDueBtn.classList.toggle("active", pslOnlyDue);
            onlyDueBtn.setAttribute("aria-pressed", String(pslOnlyDue));
            veDanhSachSoLoi();
        });
    }

    // ---------- 9. Điểm số V30 (Điểm nền Toán/Văn 45% + Môn Chuyên đo tự động từ VnStarL 55%) ----------
    const KT = window.KYTHI;
    const TEN_CHUYEN = {
        toan: "Chuyên Toán",
        ly: "Chuyên Vật Lý",
        hoa: "Chuyên Hóa Học",
        sinh: "Chuyên Sinh Học",
        van: "Chuyên Ngữ Văn",
        anh: "Chuyên Tiếng Anh",
        su: "Chuyên Lịch Sử",
        dia: "Chuyên Địa Lí",
        tin: "Chuyên Tin Học",
    };

    let sanSangData = null;

    async function taiSanSangMucTieu() {
        const mon = (localStorage.getItem("monChuyen") || "").trim();
        try {
            const qs = mon ? `?mon_chuyen=${encodeURIComponent(mon)}` : "";
            const res = await fetch(`${API}/api/muc-tieu/san-sang/${uid}${qs}`);
            const kq = await res.json();
            if (res.ok && kq.success && kq.data) {
                sanSangData = kq.data;
            }
        } catch (e) { /* offline fallback */ }
        veDiem();
    }

    function tinhDiemNenToanVan() {
        if (!KT) return { toan: null, van: null, daNhapKy: 0, kyMo: 0 };
        const kyAll = KT.capNhatKy();
        const luu = KT.doc();
        const dsT = [], dsV = [];
        let kyMo = 0, daNhapKy = 0;
        kyAll.forEach((k) => {
            if (!k.mo) return;
            if (!k.luon) kyMo++;
            const vt = luu[`d-${k.id}-toan`];
            const vv = luu[`d-${k.id}-van`];
            const okT = vt !== "" && vt != null && Number.isFinite(Number(vt));
            const okV = vv !== "" && vv != null && Number.isFinite(Number(vv));
            if (!k.luon && okT && okV) daNhapKy++;
            if (okT) dsT.push({ w: k.w, v: Number(vt) });
            if (okV) dsV.push({ w: k.w, v: Number(vv) });
        });
        const avg = (arr) => arr.length ? +(arr.reduce((s, x) => s + x.w * x.v, 0) / arr.reduce((s, x) => s + x.w, 0)).toFixed(2) : null;
        return { toan: avg(dsT), van: avg(dsV), daNhapKy, kyMo };
    }

    function veDiem() {
        if (!KT) return;
        const ky = KT.capNhatKy().filter((k) => !k.luon); // 4 kỳ lớp 9
        const luuDiem = KT.doc();
        const mon = (localStorage.getItem("monChuyen") || "").trim().toLowerCase();
        const tenMonChuyen = TEN_CHUYEN[mon] || "";
        const nen = tinhDiemNenToanVan();
        const ss = sanSangData;

        // Cập nhật huy hiệu giai đoạn & trần sẵn sàng
        const stageEl = $("diem-stage-pill");
        if (stageEl) {
            if (ss) {
                stageEl.classList.toggle("is-top", ss.tran_toi_da >= 95);
                stageEl.innerHTML = `<i class="fa-solid fa-gauge-high"></i><span>Giai đoạn: ${esc(ss.giai_doan)} · Trần ${ss.tran_toi_da}%</span>`;
            } else {
                stageEl.innerHTML = `<i class="fa-solid fa-gauge-high"></i><span>Trần khởi động: 65%</span>`;
            }
        }

        // Vẽ 2 thẻ tổng quan (Trái: Điểm nền 45% | Phải: Môn chuyên đo tự động 55%)
        const ovEl = $("diem-overview");
        if (ovEl) {
            const tp = ss?.thanh_phan_chuyen || {};
            const autoScore = ss?.diem_chuyen_auto;
            const kcPct = tp.khoa_cu_10 != null ? Math.round(tp.khoa_cu_10 * 10) : 0;
            const btPct = tp.bai_tap_10 != null ? Math.round(tp.bai_tap_10 * 10) : 0;
            const slPct = tp.so_loi_10 != null ? Math.round(tp.so_loi_10 * 10) : 0;
            const autoTitle = tenMonChuyen ? `Năng lực ${tenMonChuyen} (Tự động)` : "Độ thực chiến học thật trên VnStarL";
            const autoBig = tenMonChuyen
                ? (autoScore != null ? `<span class="diem-big-num">${autoScore.toFixed(1)}<small> / 10</small></span>` : `<span class="diem-ov-sub">Chưa có dữ liệu đo — luyện bài hoặc thi Khoa cử</span>`)
                : (ss ? `<span class="diem-big-num">${ss.diem_thuc_chien_co_so}%<small> thực chiến</small></span>` : `<span class="diem-ov-sub">Đang đồng bộ...</span>`);

            ovEl.innerHTML = `
                <div class="diem-ov-card">
                    <div class="diem-ov-top">
                        <span class="diem-ov-title">📚 Điểm nền học lực (Toán &amp; Văn)</span>
                        <span class="diem-ov-weight">45% trọng số</span>
                    </div>
                    <div class="diem-ov-nums">
                        <span class="diem-big-num">${nen.toan != null ? nen.toan.toFixed(1) : "—"}<small> Toán</small></span>
                        <span class="diem-big-num">${nen.van != null ? nen.van.toFixed(1) : "—"}<small> Văn</small></span>
                    </div>
                    <span class="diem-ov-sub">Đã nhập đủ ${nen.daNhapKy}/${nen.kyMo} kỳ lớp 9 đã mở · Kỳ gần thi có trọng số cao hơn.</span>
                </div>
                <div class="diem-ov-card diem-ov-card--auto">
                    <div class="diem-ov-top">
                        <span class="diem-ov-title">⚡ ${esc(autoTitle)}</span>
                        <span class="diem-ov-weight">55% thực chiến</span>
                    </div>
                    <div class="diem-ov-nums">${autoBig}</div>
                    <div class="diem-mini-metrics">
                        <div class="diem-mm-row">
                            <span>🏆 Khoa cử (35%)</span>
                            <span class="diem-mm-bar"><i style="width:${kcPct}%"></i></span>
                            <span class="diem-mm-val">${tp.khoa_cu_10 != null ? tp.khoa_cu_10.toFixed(1) + "/10" : "Chưa thi"}</span>
                        </div>
                        <div class="diem-mm-row">
                            <span>📘 Bài tập (35%)</span>
                            <span class="diem-mm-bar"><i style="width:${btPct}%"></i></span>
                            <span class="diem-mm-val">${tp.bai_tap_10 != null ? tp.bai_tap_10.toFixed(1) + "/10" : "Chưa làm"}</span>
                        </div>
                        <div class="diem-mm-row">
                            <span>🩺 Sổ lỗi (30%)</span>
                            <span class="diem-mm-bar"><i style="width:${slPct}%"></i></span>
                            <span class="diem-mm-val">${tp.so_loi_10 != null ? tp.so_loi_10.toFixed(1) + "/10" : "Chưa có"}</span>
                        </div>
                    </div>
                </div>`;
        }

        // Bảng 4 kỳ thi: CHỈ có input cho Toán & Văn; cột Môn Chuyên gộp rowspan=4 đo tự động (KHÔNG có input nhập tay!)
        const coChuyen = Boolean(tenMonChuyen);
        let h = `<thead><tr>
            <th>Kỳ thi lớp 9</th>
            <th>Toán <span class="th-tag">Điểm nền · 45%</span></th>
            <th>Văn <span class="th-tag">Điểm nền · 45%</span></th>
            ${coChuyen ? `<th>${esc(tenMonChuyen)} <span class="th-tag">Tự động đo</span></th>` : ""}
        </tr></thead><tbody>`;

        const autoCellHtml = (() => {
            if (!coChuyen) return "";
            const tp = ss?.thanh_phan_chuyen || {};
            const autoScore = ss?.diem_chuyen_auto;
            const slugUrl = ss?.chuyen_slug ? `problems.html?subject=${ss.chuyen_slug.replace("_", "-")}` : "khoa-bang.html";
            const ctaLabel = ss?.chuyen_slug ? "Luyện bài chuyên ➔" : "Thi Khoa cử chuyên ➔";
            return `
                <td class="diem-auto-cell" rowspan="${ky.length}">
                    <div class="diem-auto-box">
                        <span class="diem-auto-chip"><i class="fa-solid fa-bolt"></i> Tự động từ VnStarL</span>
                        ${autoScore != null
                            ? `<div class="diem-auto-score">${autoScore.toFixed(1)}<small> / 10</small></div>`
                            : `<div class="diem-auto-empty">Chưa có dữ liệu đo — hãy luyện bài hoặc thi Khoa cử</div>`
                        }
                        <div class="diem-auto-pills">
                            <div>🏆 Khoa cử (35%): <b>${tp.khoa_cu_10 != null ? tp.khoa_cu_10.toFixed(1) + "/10" : "—"}</b></div>
                            <div>📘 Bài tập (35%): <b>${tp.bai_tap_10 != null ? tp.bai_tap_10.toFixed(1) + "/10" : "—"}</b></div>
                            <div>🩺 Sổ lỗi (30%): <b>${tp.so_loi_10 != null ? tp.so_loi_10.toFixed(1) + "/10" : "—"}</b></div>
                        </div>
                        <a class="diem-auto-cta" href="${slugUrl}">${ctaLabel}</a>
                    </div>
                </td>`;
        })();

        ky.forEach((k, idx) => {
            const ghi = k.mo ? `Thi ${KT.dm(k.bd[1], k.bd[0])} – ${KT.dm(k.kt[1], k.kt[0])}` : `Mở từ ${KT.dm(k.bd[1], k.bd[0])}`;
            const vt = k.mo ? (luuDiem[`d-${k.id}-toan`] ?? "") : "";
            const vv = k.mo ? (luuDiem[`d-${k.id}-van`] ?? "") : "";
            const duCa2 = k.mo && String(vt).trim() !== "" && String(vv).trim() !== "";
            const thieuMo = k.mo && !duCa2;
            const badgeHtml = !k.mo
                ? `<span class="diem-ky-badge lock">Chưa tới kỳ</span>`
                : duCa2
                    ? `<span class="diem-ky-badge done">Đã lưu ✔</span>`
                    : `<span class="diem-ky-badge open">Đang mở nhập</span>`;

            h += `<tr class="${thieuMo ? "is-open-missing" : ""}">
                <td>
                    <div class="diem-ky-name">${esc(k.ten)} ${badgeHtml}</div>
                    <small class="phu">${ghi}</small>
                </td>
                <td>
                    <input type="number" class="diem-inp" step="any" min="0" max="10" data-id="d-${k.id}-toan"
                        placeholder="${k.mo ? "0–10" : "Chưa mở"}" aria-label="${esc(k.ten)} - Toán"
                        value="${esc(vt)}" ${k.mo ? "" : "disabled"}>
                </td>
                <td>
                    <input type="number" class="diem-inp" step="any" min="0" max="10" data-id="d-${k.id}-van"
                        placeholder="${k.mo ? "0–10" : "Chưa mở"}" aria-label="${esc(k.ten)} - Văn"
                        value="${esc(vv)}" ${k.mo ? "" : "disabled"}>
                </td>
                ${idx === 0 ? autoCellHtml : ""}
            </tr>`;
        });

        $("bang-diem").innerHTML = h + "</tbody>";
        capNhatBadgeDiem();
    }

    function capNhatBadgeDiem() {
        const bDiem = $("tab-badge-diem");
        if (!bDiem || !KT) return;
        const luuDiem = KT.doc();
        const daNhap = Object.keys(luuDiem).filter((k) =>
            /^d-(l8|gk1|ck1|gk2|ck2)-(toan|van)$/.test(k) && String(luuDiem[k] ?? "").trim() !== ""
        ).length;
        bDiem.textContent = daNhap > 0 ? `${daNhap} điểm đã lưu` : "4 kỳ thi";
    }

    $("bang-diem").addEventListener("input", (e) => {
        const el = e.target;
        if (!el.dataset.id) return;
        const v = el.value, hopLe = v === "" || (Number(v) >= 0 && Number(v) <= 10);
        el.classList.toggle("sai", !hopLe);
        if (!hopLe) return;
        const d = KT.doc();
        d[el.dataset.id] = v;
        KT.luu(d);
        capNhatBadgeDiem();
        window.dispatchEvent(new CustomEvent("vnstarl:diem-updated"));
    });
    $("bang-diem").addEventListener("change", () => veDiem());

    // ---------- 10. Tự hiện Modal nhập điểm khi tới kỳ thi nhưng chưa nhập ----------
    let kyModalHienTai = null;

    function timKyMoChuaNhap() {
        if (!KT) return null;
        const kyMo = KT.capNhatKy().filter((k) => !k.luon && k.mo);
        if (!kyMo.length) return null;
        const luuDiem = KT.doc();
        // Ưu tiên kỳ mới nhất đã mở nhưng còn thiếu điểm Toán hoặc Văn
        for (let i = kyMo.length - 1; i >= 0; i--) {
            const k = kyMo[i];
            const vt = String(luuDiem[`d-${k.id}-toan`] ?? "").trim();
            const vv = String(luuDiem[`d-${k.id}-van`] ?? "").trim();
            if (vt === "" || vv === "") return k;
        }
        return null;
    }

    function dongModalKyThi(boQuaSession) {
        const ov = $("ky-thi-modal-overlay");
        if (ov) ov.hidden = true;
        if (boQuaSession && kyModalHienTai) {
            sessionStorage.setItem(`vnstarl_skip_ky_${uid}_${kyModalHienTai.id}`, "1");
        }
        kyModalHienTai = null;
    }

    function kiemTraHienModalKyThi() {
        if (mqMobile.matches) return;
        if (document.body.classList.contains("tour-dang-chay")) {
            window.addEventListener("vnstarl:tour-ket-thuc", () => setTimeout(kiemTraHienModalKyThi, 250), { once: true });
            return;
        }
        const dc = $("daily-checkin-overlay");
        if (dc && !dc.classList.contains("hidden")) {
            window.addEventListener("daily-checkin:closed", () => setTimeout(kiemTraHienModalKyThi, 250), { once: true });
            return;
        }

        const ky = timKyMoChuaNhap();
        if (!ky) return;
        if (sessionStorage.getItem(`vnstarl_skip_ky_${uid}_${ky.id}`) === "1") return;

        kyModalHienTai = ky;
        const luuDiem = KT.doc();
        $("kt-modal-badge").textContent = `📅 Đã tới kỳ ${ky.ten} lớp 9`;
        $("kt-modal-title").textContent = `Nhập nhanh điểm ${ky.ten}`;
        $("kt-modal-desc").textContent = `Kỳ ${ky.ten} (${KT.dm(ky.bd[1], ky.bd[0])} – ${KT.dm(ky.kt[1], ky.kt[0])}) đã mở. Điền điểm Toán & Văn để cập nhật chuẩn Độ sẵn sàng vào trường mục tiêu nhé!`;
        $("kt-in-toan").value = luuDiem[`d-${ky.id}-toan`] ?? "";
        $("kt-in-van").value = luuDiem[`d-${ky.id}-van`] ?? "";
        $("kt-modal-err").textContent = "";
        $("ky-thi-modal-overlay").hidden = false;
        setTimeout(() => {
            const firstEmpty = !$("kt-in-toan").value ? $("kt-in-toan") : $("kt-in-van");
            if (firstEmpty) firstEmpty.focus();
        }, 60);
    }

    const ktBtnLuu = $("kt-btn-luu");
    if (ktBtnLuu) {
        ktBtnLuu.addEventListener("click", () => {
            if (!kyModalHienTai || !KT) return;
            const rawT = $("kt-in-toan").value.trim();
            const rawV = $("kt-in-van").value.trim();
            const vt = Number(rawT), vv = Number(rawV);
            if (rawT === "" || rawV === "" || !Number.isFinite(vt) || !Number.isFinite(vv) || vt < 0 || vt > 10 || vv < 0 || vv > 10) {
                $("kt-modal-err").textContent = "Vui lòng nhập đủ điểm Toán và Văn hợp lệ trong khoảng 0 đến 10.";
                return;
            }
            const d = KT.doc();
            d[`d-${kyModalHienTai.id}-toan`] = String(vt);
            d[`d-${kyModalHienTai.id}-van`] = String(vv);
            KT.luu(d);
            dongModalKyThi(false);
            veDiem();
            window.dispatchEvent(new CustomEvent("vnstarl:diem-updated"));
            if (window.AmThanh && window.AmThanh.dung) window.AmThanh.dung(1);
        });
    }
    if ($("kt-btn-de-sau")) $("kt-btn-de-sau").addEventListener("click", () => dongModalKyThi(true));
    if ($("kt-modal-close")) $("kt-modal-close").addEventListener("click", () => dongModalKyThi(true));
    if ($("ky-thi-modal-overlay")) {
        $("ky-thi-modal-overlay").addEventListener("click", (e) => {
            if (e.target.id === "ky-thi-modal-overlay") dongModalKyThi(true);
        });
    }

    // ---------- 11. Chuyển giữa 3 Tab chính PC (Sổ lỗi sai | Thiết lập | Điểm số) ----------
    let tabHienTai = "so-loi";

    function cuonToiKhungTab() {
        if (mqMobile.matches || document.body.classList.contains("tour-dang-chay")) return;
        const bar = document.querySelector(".tab-chinh");
        if (!bar) return;
        const r = bar.getBoundingClientRect();
        if (r.top <= 10 && window.scrollY > 140) {
            const topDich = bar.offsetTop - 6;
            if (topDich >= 0) window.scrollTo({ top: topDich, behavior: "smooth" });
        }
    }

    const tabBarEl = document.querySelector(".tab-chinh");
    if (tabBarEl) {
        const capNhatTabStuck = () => {
            if (mqMobile.matches) { tabBarEl.classList.remove("is-stuck"); return; }
            const stuck = tabBarEl.getBoundingClientRect().top <= 1 && window.scrollY > 40;
            tabBarEl.classList.toggle("is-stuck", stuck);
        };
        window.addEventListener("scroll", capNhatTabStuck, { passive: true });
        window.addEventListener("resize", capNhatTabStuck, { passive: true });
        capNhatTabStuck();
    }

    function chonTab(t, tuClick) {
        const mobile = mqMobile.matches;
        if (t === "lich") t = "so-loi";
        if (!mobile && t === "nv") t = "so-loi";
        tabHienTai = t;
        const khu = { nv: $("nhiem-vu"), "so-loi": $("pn-so-loi"), setup: $("pn-setup"), diem: $("pn-diem") };
        Object.keys(khu).forEach((x) => {
            if (khu[x]) khu[x].hidden = !mobile && x === "nv" ? false : x !== t;
            const tb = $("tab-" + x);
            if (tb) {
                tb.classList.toggle("on", x === t);
                tb.setAttribute("aria-selected", String(x === t));
            }
        });
        if (t === "diem") veDiem();
        if (t === "setup") capNhatTrangThaiSetup();
        if (t === "so-loi") taiSoLoiSai();
        if (t === "nv" && khu.nv && !khu.nv.firstElementChild) {
            khu.nv.innerHTML = '<p class="phu" style="padding:12px 4px">Đăng nhập để xem nhiệm vụ hằng ngày nhé.</p>';
        }
        if (tuClick) cuonToiKhungTab();
    }

    mqMobile.addEventListener("change", () => chonTab(tabHienTai));
    if ($("tab-nv")) $("tab-nv").addEventListener("click", () => chonTab("nv", true));
    if ($("tab-so-loi")) $("tab-so-loi").addEventListener("click", () => chonTab("so-loi", true));
    if ($("tab-setup")) $("tab-setup").addEventListener("click", () => chonTab("setup", true));
    if ($("tab-diem")) $("tab-diem").addEventListener("click", () => chonTab("diem", true));

    document.querySelectorAll(".setup-jump-btn[data-jump]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = document.querySelector(btn.dataset.jump);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    // Nhắc lịch học gọn trên thanh Thiết lập (vẫn giữ trọn tính năng thong-bao.js)
    function veNutThongBaoNho() {
        const el = $("setup-tb-inline"), TB = window.THONGBAO;
        if (!el || !TB) return;
        const c = TB.doc();
        if (c.bat && c.lich && TB.quyen() === "granted") {
            el.innerHTML = '🔔 Đang bật nhắc lịch tự học';
            return;
        }
        el.innerHTML = '🔔 <button id="tb-bat-nhanh" class="btn-tb-mini" type="button">Bật nhắc giờ tự học</button>';
        $("tb-bat-nhanh").addEventListener("click", async () => {
            const kq = await TB.bat();
            if (!kq.ok) { el.textContent = kq.loi; return; }
            const cc = TB.doc(); cc.lich = true; TB.luu(cc);
            veNutThongBaoNho();
        });
    }
    veNutThongBaoNho();

    // ---------- Khởi động ----------
    veBang();
    capNhatUuTien(false);
    veDanhSach();
    dongBoLichNgam();
    capNhatTrangThaiSetup();
    capNhatBadgeDiem();
    taiSanSangMucTieu();

    // Mặc định PC mở tab Sổ lỗi sai (hoặc theo hash #diem / #setup / #so-loi)
    const h = (location.hash || "").toLowerCase();
    const tabDau = h === "#diem" ? "diem" : h === "#setup" ? "setup" : "so-loi";
    chonTab(tabDau);

    // Chờ nhẹ 450ms sau khi các script khác (tour / daily-checkin) khởi tạo xong rồi mới kiểm tra modal nhập điểm kỳ thi
    setTimeout(kiemTraHienModalKyThi, 450);

    const noiPersonal = (tt) => {
        if (!tt || !window.SAOLA || window.SAOLA.vuaChaoMoi) return;
        const kSs = "saola_da_personal_" + uid;
        if (sessionStorage.getItem(kSs)) return;
        sessionStorage.setItem(kSs, "1");
        window.SAOLA.noi("personal_nhiem_vu");
    };
    if (window.SAOLA) window.SAOLA.sanSang.then(noiPersonal);
    else window.addEventListener("saola-san-sang", (e) => noiPersonal(e.detail), { once: true });
});

function napTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((ok, loi) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        s.onload = ok;
        s.onerror = () => loi(new Error("Không tải được thư viện Tesseract từ mạng."));
        document.head.appendChild(s);
    });
}
