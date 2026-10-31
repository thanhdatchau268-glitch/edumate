// personal.js - trang "Học tập cá nhân hoá"
// Dữ liệu lưu trong localStorage theo từng tài khoản (khóa edumate_hoctap_<userId>)
document.addEventListener("DOMContentLoaded", () => {
    const uid = localStorage.getItem("userId");
    if (!uid) { location.href = "login.html"; return; } // chưa đăng nhập thì về trang đăng nhập

    const $ = (id) => document.getElementById(id);
    const KEY = "edumate_hoctap_" + uid;
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

    // ---------- Hàm giờ giấc (đồng hồ 24h, tính bằng phút từ 00:00) ----------
    const phut = (s) => { // "19:30", "19h30", "19h" -> 1170 ; sai định dạng -> NaN
        const m = String(s).trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{0,2})$/);
        if (!m) return NaN;
        const h = +m[1], p = +(m[2] || 0);
        return h < 24 && p < 60 ? h * 60 + p : NaN;
    };
    const gioStr = (p) => String(Math.floor(p / 60)).padStart(2, "0") + ":" + String(p % 60).padStart(2, "0");

    // Thứ: 2..7 = T2..T7, 8 = CN. "idx" của ngày trong tuần: 0 = T2 ... 6 = CN
    const chi = (t) => (t === 8 ? 6 : t - 2);
    const tenIdx = (d) => (d === 6 ? "CN" : "T" + (d + 2));

    // Số phút ôn gợi ý cho từng loại công việc
    const LOAI = { "Kiểm tra 15 phút": 60, "Kiểm tra 1 tiết": 120, "Kiểm tra học kì": 240, "Bài tập / nộp bài": 60, "Khác": 45 };
    const KHONG_HOC = new Set(["Chào cờ", "SHL"]); // tiết sinh hoạt, không đưa vào danh sách ưu tiên

    // ---------- Dữ liệu ----------
    const MAC_DINH = () => ({
        tkb: Array.from({ length: 10 }, () => Array(6).fill("")), // 5 tiết sáng + 5 tiết chiều x T2..T7
        gio: { sang: "07:00", chieu: "13:30", tiet: 45, nghi: 5, batDau: "06:00", ngu: "21:30", edumate: 30 },
        extra: [],   // học thêm: {thu, tu, den, mon}
        viec: [],    // công việc tuần này: {thu, mon, loai, phut, ghi}
        uuTien: [],  // tên môn, đứng trước = ưu tiên hơn
    });
    let S = MAC_DINH();
    try {
        const cu = JSON.parse(localStorage.getItem(KEY) || "{}");
        S = { ...S, ...cu, gio: { ...S.gio, ...(cu.gio || {}) } };
    } catch (e) { /* dữ liệu hỏng thì dùng mặc định */ }

    const luu = () => { localStorage.setItem(KEY, JSON.stringify(S)); veKeHoach(); };

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
        luu();
    });
    $("tkb").addEventListener("change", capNhatUuTien);
    if (window.TKB_OCR) $("ds-mon").innerHTML = TKB_OCR.TEN_MON.map((m) => `<option value="${esc(m)}">`).join("");

    // Tải ảnh lên -> OCR -> đổ vào bảng (người dùng sửa lại ô sai, ô tô vàng là chưa nhận ra môn)
    $("file").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const tt = $("ocr-tt");
        try {
            if (!window.TKB_OCR) throw new Error("Không nạp được tkb-ocr.js (kiểm tra file có nằm cùng thư mục personal.html không).");
            if (!window.Tesseract) throw new Error("Không tải được thư viện Tesseract từ mạng (jsdelivr bị chặn?).");
            const kq = await TKB_OCR.docAnh(f, (m, p) => { tt.textContent = m; if (p != null) $("thanh").style.width = p + "%"; });
            const t = MAC_DINH().tkb, dem = { S: 0, C: 0 };
            kq.rows.forEach((r) => {
                const k = r.buoi === "Sáng" ? "S" : "C", i = dem[k]++;
                if (i >= 5) return; // mỗi buổi chỉ có 5 tiết
                kq.days.forEach((d, j) => { if (d >= 2 && d <= 7 && r.cells[j]) t[(k === "S" ? 0 : 5) + i][d - 2] = TKB_OCR.timMon(r.cells[j]).ten; });
            });
            S.tkb = t; veBang(); capNhatUuTien(); luu();
            tt.textContent = "Đã đọc xong. Hãy kiểm tra và sửa các ô sai (ô viền vàng là chưa nhận ra môn).";
        } catch (err) { tt.textContent = "Lỗi: " + err.message; }
        $("thanh").style.width = "0"; e.target.value = "";
    });
    $("btn-xoa-tkb").addEventListener("click", () => { S.tkb = MAC_DINH().tkb; veBang(); capNhatUuTien(); luu(); });

    // ---------- 2. Học thêm và 3. Công việc tuần này ----------
    const bao = (id, chu) => { $(id).textContent = chu; };

    $("btn-them-extra").addEventListener("click", () => {
        const tu = phut($("ex-tu").value), den = phut($("ex-den").value);
        if (isNaN(tu) || isNaN(den) || den <= tu) return bao("ex-tt", "Nhập giờ dạng 24h, ví dụ 19:00 đến 20:30.");
        S.extra.push({ thu: +$("ex-thu").value, tu, den, mon: $("ex-mon").value.trim() });
        bao("ex-tt", ""); $("ex-mon").value = ""; capNhatUuTien(); luu(); veDanhSach();
    });

    $("vi-loai").addEventListener("change", () => ($("vi-phut").value = LOAI[$("vi-loai").value]));
    $("btn-them-viec").addEventListener("click", () => {
        const mon = $("vi-mon").value.trim();
        if (!mon) return bao("vi-tt", "Hãy nhập tên môn.");
        S.viec.push({ thu: +$("vi-thu").value, mon, loai: $("vi-loai").value, phut: Math.max(15, +$("vi-phut").value || 45), ghi: $("vi-ghi").value.trim() });
        bao("vi-tt", ""); $("vi-mon").value = ""; $("vi-ghi").value = ""; capNhatUuTien(); luu(); veDanhSach();
    });

    function veDanhSach() {
        $("ds-extra").innerHTML = S.extra.map((e, i) =>
            `<li>${tenIdx(chi(e.thu))} ${gioStr(e.tu)}–${gioStr(e.den)} ${esc(e.mon)} <button data-xoa="extra" data-i="${i}">Xóa</button></li>`).join("") || '<li class="phu">Chưa có.</li>';
        $("ds-viec").innerHTML = S.viec.map((v, i) =>
            `<li><b>${tenIdx(chi(v.thu))}</b> · ${esc(v.mon)} · ${esc(v.loai)} (${v.phut} phút) ${esc(v.ghi)} <button data-xoa="viec" data-i="${i}">Xóa</button></li>`).join("") || '<li class="phu">Chưa có.</li>';
    }
    document.addEventListener("click", (e) => {
        const x = e.target.dataset.xoa;
        if (!x) return;
        S[x].splice(+e.target.dataset.i, 1);
        capNhatUuTien(); luu(); veDanhSach();
    });

    // ---------- 4. Ưu tiên môn ----------
    function capNhatUuTien() {
        const ds = new Set();
        S.tkb.flat().forEach((m) => m && !KHONG_HOC.has(m) && ds.add(m));
        S.extra.forEach((e) => e.mon && ds.add(e.mon));
        S.viec.forEach((v) => ds.add(v.mon));
        S.uuTien = S.uuTien.filter((m) => ds.has(m));          // bỏ môn không còn
        ds.forEach((m) => !S.uuTien.includes(m) && S.uuTien.push(m)); // thêm môn mới xuống cuối
        veUuTien();
    }
    function veUuTien() {
        $("ds-uu-tien").innerHTML = S.uuTien.map((m, i) =>
            `<li>${i + 1}. ${esc(m)} <button data-dich="-1" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Lên">▲</button>
       <button data-dich="1" data-i="${i}" ${i === S.uuTien.length - 1 ? "disabled" : ""} aria-label="Xuống">▼</button></li>`).join("") || '<li class="phu">Nhập thời khóa biểu hoặc công việc để có môn.</li>';
    }
    $("ds-uu-tien").addEventListener("click", (e) => {
        const d = e.target.dataset.dich;
        if (!d) return;
        const i = +e.target.dataset.i, j = i + +d;
        [S.uuTien[i], S.uuTien[j]] = [S.uuTien[j], S.uuTien[i]];
        veUuTien(); luu();
    });

    // ---------- 5. Giờ giấc ----------
    document.querySelectorAll("[data-g]").forEach((el) => {
        el.value = S.gio[el.dataset.g];
        el.addEventListener("change", () => {
            const k = el.dataset.g, laGio = el.dataset.kieu === "gio";
            if (laGio && isNaN(phut(el.value))) { el.value = S.gio[k]; return; } // giờ sai thì trả lại giá trị cũ
            S.gio[k] = laGio ? gioStr(phut(el.value)) : Math.max(1, +el.value || 1);
            el.value = S.gio[k]; luu();
        });
    });

    // ---------- 6. Thuật toán xếp lịch ----------
    function keHoach() {
        const now = new Date(), ti = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes(); // ti: hôm nay là ngày thứ mấy (0 = T2)
        const g = S.gio, tiet = +g.tiet, nghi = +g.nghi, ngu = phut(g.ngu), ed = Math.max(10, +g.edumate || 30);
        const rank = (m) => { const i = S.uuTien.indexOf(m); return i < 0 ? 99 : i; };
        const ngay = [], canhbao = [];

        for (let d = ti; d < 7; d++) {
            const muc = []; // các mục trong ngày: {s, e, loai, ten}  (s, e là phút)
            // a) Giờ ở trường: từ đầu buổi tới hết tiết cuối có môn
            if (d < 6) [[0, phut(g.sang), "Sáng"], [5, phut(g.chieu), "Chiều"]].forEach(([bd, st, b]) => {
                const m = S.tkb.slice(bd, bd + 5).map((r) => r[d]);
                let k = -1; m.forEach((x, i) => x && (k = i));
                if (k >= 0) muc.push({ s: st, e: st + (k + 1) * tiet + k * nghi, loai: "truong", ten: `Ở trường (${b}): ` + m.slice(0, k + 1).filter(Boolean).join(", ") });
            });
            // b) Học thêm
            S.extra.filter((e) => chi(e.thu) === d).forEach((e) => muc.push({ s: e.tu, e: e.den, loai: "them", ten: "Học thêm" + (e.mon ? ": " + e.mon : "") }));

            // c) Khoảng trống = [giờ bắt đầu học, giờ đi ngủ] trừ giờ bận và bữa ăn (11:30-13:00, 18:00-19:00)
            let win = [[Math.max(phut(g.batDau), d === ti ? Math.ceil((nowMin + 5) / 5) * 5 : 0), ngu]];
            [...muc.map((m) => [m.s, m.e]), [690, 780], [1080, 1140]].forEach(([s, e]) => {
                win = win.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, Math.min(b, s)], [Math.max(a, e), b]].filter((w) => w[1] - w[0] > 0)));
            });
            win = win.filter((w) => w[1] - w[0] >= 20);
            const x = {
                d, muc, tong: 0, // tong: số phút học đã xếp (để dàn đều các ngày)
                dat(len) { // lấy khoảng trống đầu tiên đủ dài, chừa 10 phút nghỉ sau mỗi khối
                    for (const w of win) if (w[1] - w[0] >= len) { const s = w[0]; w[0] = s + len + 10; return [s, s + len]; }
                    return null;
                }
            };
            // d) Giờ cho SaoLaEdu: ưu tiên khoảng trống muộn nhất trong ngày
            const wEd = [...win].reverse().find((w) => w[1] - w[0] >= ed);
            if (wEd) { muc.push({ s: wEd[0], e: wEd[0] + ed, loai: "edumate", ten: "Luyện tập trên SaoLaEdu" }); wEd[0] += ed + 10; }
            ngay.push(x);
        }

        // e) Xếp công việc: gần hạn trước, cùng hạn thì môn ưu tiên trước. Dàn đều các ngày từ hôm nay tới ngày trước hạn
        S.viec.map((v) => ({ ...v, du: chi(v.thu) })).filter((v) => v.du >= ti)
            .sort((a, b) => a.du - b.du || rank(a.mon) - rank(b.mon)).forEach((v) => {
                const cuoi = Math.max(ti, v.du - 1);
                let con = v.phut;
                while (con > 0) {
                    const len = Math.max(20, Math.min(45, con));
                    let sl = null; // ngày ít việc nhất mà còn chỗ trống
                    for (const x of ngay.filter((n) => n.d <= cuoi).sort((a, b) => a.tong - b.tong || a.d - b.d)) {
                        const o = x.dat(len);
                        if (o) { sl = [x, o]; break; }
                    }
                    if (!sl) { canhbao.push(`Chưa đủ giờ trống để ôn ${v.mon} (${v.loai}, ${tenIdx(v.du)}): còn thiếu ${con} phút.`); break; }
                    sl[0].muc.push({ s: sl[1][0], e: sl[1][1], loai: "hoc", ten: `${v.loai === "Bài tập / nộp bài" ? "Làm bài" : "Ôn"} ${v.mon} (${v.loai})` });
                    sl[0].tong += len; con -= len;
                }
            });

        // f) Còn giờ trống thì ôn bài 2 môn ưu tiên nhất có trong thời khóa biểu
        const top = S.uuTien.filter((m) => S.tkb.flat().includes(m)).slice(0, 2);
        ngay.forEach((x) => top.forEach((m) => { const s = x.dat(30); if (s) x.muc.push({ s: s[0], e: s[1], loai: "on", ten: "Ôn bài " + m }); }));
        return { ngay, ti, canhbao };
    }

    // ---------- 7. Hiển thị lịch ----------
    let ngayChon = null;
    function veKeHoach() {
        const kh = keHoach();
        if (ngayChon === null || ngayChon < kh.ti) ngayChon = kh.ti;
        $("hom-nay").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });
        $("tabs-ngay").innerHTML = kh.ngay.map((x) =>
            `<button data-d="${x.d}" class="${x.d === ngayChon ? "on" : ""}">${x.d === kh.ti ? "Hôm nay" : tenIdx(x.d)}</button>`).join("");
        const x = kh.ngay.find((n) => n.d === ngayChon);
        $("lich-ngay").innerHTML = x.muc.slice().sort((a, b) => a.s - b.s).map((m) =>
            `<li class="m-${m.loai}"><time>${gioStr(m.s)}–${gioStr(m.e)}</time><span>${esc(m.ten)}</span>` +
            (m.loai === "edumate" ? ' <a class="btn" href="subjects.html">Vào luyện tập</a>' : "") + "</li>").join("");
        $("canhbao").innerHTML = kh.canhbao.map((c) => `<p class="canhbao">⚠ ${esc(c)}</p>`).join("");
    }
    $("tabs-ngay").addEventListener("click", (e) => { if (e.target.dataset.d) { ngayChon = +e.target.dataset.d; veKeHoach(); } });
    $("btn-xep").addEventListener("click", veKeHoach); // xếp lại từ giờ hiện tại

    // ---------- 8. Điểm các kỳ thi lớp 9 ----------
    const KT = window.KYTHI;
    const TEN_CHUYEN = { toan: "Chuyên Toán", ly: "Chuyên Vật lí", hoa: "Chuyên Hóa học" };

    function veDiem() {
        const ky = KT.capNhatKy().filter((k) => !k.luon); // 4 kỳ lớp 9
        const luu = KT.doc();
        const mon = localStorage.getItem("monChuyen") || "";
        const cot = ["toan", "van"].concat(mon ? ["chuyen"] : []);
        const ten = { toan: "Toán", van: "Văn", chuyen: TEN_CHUYEN[mon] || "Chuyên" };
        let h = "<thead><tr><th>Kỳ thi</th>" + cot.map((m) => `<th>${ten[m]}</th>`).join("") + "</tr></thead><tbody>";
        ky.forEach((k) => {
            const ghi = k.mo ? `Thi ${KT.dm(k.bd[1], k.bd[0])} – ${KT.dm(k.kt[1], k.kt[0])}` : `Mở từ ${KT.dm(k.bd[1], k.bd[0])}`;
            h += `<tr><td class="nhan">${esc(k.ten)}<br><small class="phu">${ghi}</small></td>` +
                cot.map((m) => {
                    const id = `d-${k.id}-${m}`;
                    return `<td><input type="number" step="any" min="0" max="10" data-id="${id}" placeholder="${k.mo ? "0-10" : "Chưa mở"}"
                  aria-label="${esc(k.ten)} - ${ten[m]}" value="${esc(k.mo ? luu[id] ?? "" : "")}" ${k.mo ? "" : "disabled"}></td>`;
                }).join("") + "</tr>";
        });
        $("bang-diem").innerHTML = h + "</tbody>";
    }
    $("bang-diem").addEventListener("input", (e) => {
        const el = e.target;
        if (!el.dataset.id) return;
        const v = el.value, hopLe = v === "" || (Number(v) >= 0 && Number(v) <= 10);
        el.classList.toggle("sai", !hopLe);
        if (!hopLe) return; // điểm sai thì chưa lưu
        const d = KT.doc();
        d[el.dataset.id] = v;
        KT.luu(d);
    });

    // ---------- Chuyển giữa "Lịch học", "Thiết lập" và "Điểm số" ----------
    function chonTab(t) {
        ["lich", "setup", "diem"].forEach((x) => {
            $("pn-" + x).hidden = x !== t;
            $("tab-" + x).classList.toggle("on", x === t);
        });
        if (t === "diem") veDiem();
    }
    $("tab-lich").addEventListener("click", () => { veKeHoach(); chonTab("lich"); });
    $("tab-setup").addEventListener("click", () => chonTab("setup"));
    $("tab-diem").addEventListener("click", () => chonTab("diem"));

    // ---------- Khởi động ----------
    veBang(); capNhatUuTien(); veDanhSach(); veKeHoach();
    chonTab(location.hash === "#diem" ? "diem"
        : S.tkb.flat().some(Boolean) || S.viec.length ? "lich" : "setup");
});