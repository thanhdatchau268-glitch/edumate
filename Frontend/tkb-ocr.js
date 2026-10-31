// tkb-ocr.js - đọc thời khóa biểu từ ảnh (cần nạp tesseract.js trước file này)
// Dùng: const kq = await TKB_OCR.docAnh(fileAnh, (thongBao, phanTram) => {...});
// kq = { days:[2..7], rows:[{ nhan, buoi:"Sáng"|"Chiều", cells:[chữ OCR mỗi cột] }] }
window.TKB_OCR = (() => {
    let tienDo = () => { };
    // ===================== 1. DANH SÁCH MÔN =====================
    // Mỗi dòng: [tên hiển thị, các cách viết đã bỏ dấu/viết liền để so khớp...]
    // ===================== 1. DANH SÁCH MÔN =====================
    // [tên hiển thị, các cách viết đã bỏ dấu/viết liền...]
    // "Tiếng Anh" đã được gộp vào "Ngoại ngữ" (mọi cách viết đều ra "Ngoại ngữ")
    const MON = [
        ["Toán", "toan"],
        ["Ngữ văn", "nguvan", "van", "nv"],
        ["Ngoại ngữ", "ngoaingu", "ngoaingu1", "tienganh", "anh", "av", "ta", "english", "nn"],
        ["Vật lí", "vatli", "vatly", "ly", "li"],
        ["Hóa học", "hoahoc", "hoa"],
        ["Sinh học", "sinhhoc", "sinh"],
        ["Lịch sử", "lichsu", "su"],
        ["Địa lí", "diali", "dialy", "dia"],
        ["Sử-Địa", "sudia"],
        ["Lịch sử và Địa lí", "lichsuvadiali", "lichsuvadialy", "lsvdl", "lsdl"],
        ["GDCD", "gdcd"], ["Giáo dục công dân", "giaoduccongdan"],
        ["GDTC", "gdtc"], ["Giáo dục thể chất", "giaoducthechat", "theduc", "thechat"],
        ["GDĐP", "gddp"], ["Giáo dục địa phương", "giaoducdiaphuong"],
        ["Tin học", "tinhoc", "tin"], ["Công nghệ", "congnghe", "cn"],
        ["Âm nhạc", "amnhac", "nhac"], ["Mĩ thuật", "mithuat", "mythuat", "mt"],
        ["NT(MT)", "ntmt"], ["NT(AN)", "ntan"], ["Nghệ thuật", "nghethuat"],
        ["Nghệ thuật (Âm nhạc)", "nghethuatamnhac"], ["Nghệ thuật (Mĩ thuật)", "nghethuatmithuat", "nghethuatmythuat"],
        ["HĐTN", "hdtn", "hdtnhn", "hdtnhuongnghiep"],
        ["Hoạt động trải nghiệm - hướng nghiệp", "hoatdongtrainghiemhuongnghiep", "hoatdongtrainghiem"],
        ["SHL", "shl", "sinhhoatlop", "sinhhoat"], ["Chào cờ", "chaoco"],
        ["KHTN", "khtn"], ["Khoa học tự nhiên", "khoahoctunhien"], ["Tự chọn", "tuchon"],
        ["Chuyên đề", "chuyende"], ["Ôn tập", "ontap"],
    ];

    // bỏ dấu, chữ thường, chỉ giữ chữ + số
    const chuanHoa = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đðĐÐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Gộp các ký tự OCR hay đọc nhầm về cùng 1 dạng (dùng cho CẢ chữ đọc được lẫn alias)
    const canon = (s) => s.replace(/rn/g, "m").replace(/vv/g, "w")
        .replace(/[ij1!|]/g, "l").replace(/0/g, "o").replace(/5/g, "s").replace(/8/g, "b");

    // Chuẩn bị sẵn alias đã canon (làm 1 lần)
    const ALIAS = [];
    MON.forEach((m) => m.slice(1).forEach((k) => ALIAS.push({ ten: m[0], k: canon(k), goc: k })));

    // khoảng cách chỉnh sửa giữa 2 chuỗi (Levenshtein)
    function lev(a, b) {
        let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
        for (let i = 1; i <= a.length; i++) {
            const cur = [i];
            for (let j = 1; j <= b.length; j++)
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = cur;
        }
        return prev[b.length];
    }

    // Tìm môn khớp nhất trong chữ OCR của 1 ô.
    // Thử mọi cụm 1-6 từ liền nhau; ưu tiên cụm ở đầu ô, tên dài, ít lỗi.
    function timMon(raw, opt) {
        const chiTen = opt && opt.chiTen, them = (opt && opt.them) || 0;
        const tu = (raw || "").split(/\s+/).filter(Boolean), cs = [];
        for (let i = 0; i < tu.length; i++)
            for (let n = 1; n <= 6 && i + n <= tu.length; n++) {
                const c0 = chuanHoa(tu.slice(i, i + n).join(""));
                if (c0.length < 2 || /^\d+$/.test(c0)) continue;
                cs.push({ c: canon(c0), i, tron: tu.length === n });
                const c1 = c0.replace(/\d+/g, "");
                if (c1.length >= 2 && c1 !== c0) cs.push({ c: canon(c1), i, tron: tu.length === n });
            }
        let tot = null;
        for (const x of cs) for (const a of ALIAS) {
            if (chiTen && !chiTen.has(a.ten)) continue;
            const L = a.k.length;
            const cho = (L <= 3 ? 0 : L <= 6 ? 1 : L <= 12 ? 2 : 3) + (L <= 3 ? 0 : them);
            if (Math.abs(x.c.length - L) > cho) continue;
            if (L <= 3 && !(x.i === 0 || x.tron)) continue;
            const d = lev(x.c, a.k);
            if (d > cho) continue;
            const diem = d * 10 - L + x.i * 1.5;
            if (!tot || diem < tot.diem) tot = { diem, d, ten: a.ten };
        }
        return tot ? { ten: tot.ten, kieu: tot.d === 0 ? "chuan" : "gan" } : { ten: raw, kieu: "la" };
    }

    // "T2" / "Thứ 2" / "12" (đọc nhầm) -> 2 ; "CN" -> 8 ; không phải -> 0
    function parseThu(raw) {
        const n = chuanHoa(raw);
        const m = n.match(/^(?:thu|th|t|l|i|1|f)?([2-7])$/);
        return m ? +m[1] : n === "cn" || n === "chunhat" ? 8 : 0;
    }


    // ---- Nạp ảnh -> mảng xám (không vẽ ra trang) ----
    let W = 0, H = 0, gray = null;
    function nap(blob) {
        return new Promise((ok, loi) => {
            const img = new Image();
            img.onload = () => {
                const s = Math.min(1, 2400 / img.width);
                W = Math.round(img.width * s); H = Math.round(img.height * s);
                const c = document.createElement("canvas"); c.width = W; c.height = H;
                const x = c.getContext("2d", { willReadFrequently: true });
                x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
                const d = x.getImageData(0, 0, W, H).data;
                gray = new Uint8Array(W * H);
                for (let i = 0; i < W * H; i++) gray[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
                ok();
            };
            img.onerror = () => loi(new Error("Không mở được ảnh này."));
            img.src = URL.createObjectURL(blob);
        });
    }
    // ===================== 3. TÌM LƯỚI BẢNG =====================
    // Chỉ coi pixel RẤT TỐI là đường kẻ, nên các vạch xám/tím nhạt của nền bị bỏ qua.
    // Với mỗi cột (hàng) tìm đoạn đen liền mạch dài nhất (cho phép đứt <= 3px).
    function doanDai(bin, n, m, lay) {
        const r = new Uint16Array(n);
        for (let i = 0; i < n; i++) {
            let best = 0, cur = 0, gap = 0;
            for (let j = 0; j < m; j++) {
                if (lay(i, j)) { cur += gap + 1; gap = 0; if (cur > best) best = cur; }
                else if (cur > 0 && ++gap > 3) { cur = 0; gap = 0; }
            }
            r[i] = best;
        }
        return r;
    }

    // Gom các chỉ số liên tiếp có giá trị >= th thành 1 đường: {c: tâm, t: độ dày}
    function gom(arr, th) {
        const kq = []; let i = 0;
        while (i < arr.length) {
            if (arr[i] >= th) {
                const s = i; let e = i;
                while (i < arr.length && (arr[i] >= th || i - e <= 2)) { if (arr[i] >= th) e = i; i++; }
                kq.push({ c: (s + e) / 2, t: e - s + 1 });
            } else i++;
        }
        return kq;
    }

    // Trả về { Vw: các đường dọc của cột ngày, lab: cột nhãn tiết, HL: các đường ngang, pitch }
    function timLuoi(thr, nDay) {
        const bin = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) bin[i] = gray[i] < thr ? 1 : 0;

        const V = gom(doanDai(bin, W, H, (x, y) => bin[y * W + x]), H * 0.12);
        // chọn nDay+1 đường dọc liên tiếp có khoảng cách đều nhau nhất (loại bảng bên cạnh, thanh cuộn)
        let best = null;
        for (let i = 0; i + nDay < V.length; i++) {
            const kc = []; for (let j = 0; j < nDay; j++) kc.push(V[i + j + 1].c - V[i + j].c);
            const tb = kc.reduce((a, b) => a + b) / nDay;
            if (tb < W * 0.03) continue;
            const cvar = Math.sqrt(kc.reduce((a, b) => a + (b - tb) ** 2, 0) / nDay) / tb;
            if (!best || cvar < best.cvar - 0.01) best = { i, cvar };
        }
        if (!best || best.cvar > 0.2) return null;
        const Vw = V.slice(best.i, best.i + nDay + 1);
        const lab = best.i > 0 ? [V[best.i - 1], Vw[0]] : null;

        // đường ngang: chỉ xét trong phạm vi các cột ngày, đoạn phải phủ >= 60% chiều rộng
        const x0 = Math.round(Vw[0].c), x1 = Math.round(Vw[nDay].c);
        const Hs = gom(doanDai(bin, H, x1 - x0 + 1, (y, k) => bin[y * W + x0 + k]), (x1 - x0) * 0.6);
        if (Hs.length < 3) return null;
        const kc = Hs.slice(1).map((l, i) => l.c - Hs[i].c);
        const med = [...kc].sort((a, b) => a - b)[kc.length >> 1];
        const blocks = [[Hs[0]]];
        kc.forEach((k, i) => (k > med * 1.8 ? blocks.push([Hs[i + 1]]) : blocks[blocks.length - 1].push(Hs[i + 1])));
        const HL = blocks.sort((a, b) => b.length - a.length)[0]; // khối đường ngang đều nhau, dài nhất
        if (HL.length < 3) return null;
        const kc2 = HL.slice(1).map((l, i) => l.c - HL[i].c);
        return { Vw, lab, HL, pitch: [...kc2].sort((a, b) => a - b)[kc2.length >> 1] };
    }

    // ô nằm giữa 2 đường dọc (xa, xb) và 2 đường ngang (ya, yb), chừa mép để khỏi dính nét kẻ
    const hop = (xa, xb, ya, yb) => ({
        x0: xa.c + xa.t / 2 + 3, x1: xb.c - xb.t / 2 - 3,
        y0: ya.c + ya.t / 2 + 3, y1: yb.c - yb.t / 2 - 3,
    });

    // ===================== 4. CẮT Ô VÀ OCR =====================
    function otsu(hist, tot) {
        let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
        let sB = 0, wB = 0, max = 0, thr = 127;
        for (let t = 0; t < 256; t++) {
            wB += hist[t]; if (!wB) continue;
            const wF = tot - wB; if (!wF) break;
            sB += t * hist[t];
            const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
            if (v > max) { max = v; thr = t; }
        }
        return thr;
    }

    // Cắt 1 ô -> canvas sạch (nền trắng, chữ đen, phóng to). Trả null nếu ô trống.
    function catO(b) {
        const x0 = Math.round(b.x0), x1 = Math.round(b.x1), y0 = Math.round(b.y0), y1 = Math.round(b.y1);
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
        if (bw < 6 || bh < 6) return null;
        const hist = new Uint32Array(256);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) hist[gray[(y0 + y) * W + x0 + x]]++;
        const thr = otsu(hist, bw * bh);
        let sd = 0, nd = 0, sl = 0, nl = 0;
        for (let v = 0; v < 256; v++) { if (v <= thr) { sd += v * hist[v]; nd += hist[v]; } else { sl += v * hist[v]; nl += hist[v]; } }
        if (!nd || !nl || sl / nl - sd / nd < 70) return null; // ít tương phản = ô trống

        // xóa vệt kẻ còn sót ở mép (hàng/cột đen > 85%)
        const ink = (x, y) => gray[(y0 + y) * W + x0 + x] <= thr;
        const xoaH = new Uint8Array(bh), xoaC = new Uint8Array(bw);
        for (let y = 0; y < bh; y++) { let c = 0; for (let x = 0; x < bw; x++) c += ink(x, y); if (c > bw * 0.85) xoaH[y] = 1; }
        for (let x = 0; x < bw; x++) { let c = 0; for (let y = 0; y < bh; y++) c += ink(x, y); if (c > bh * 0.85) xoaC[x] = 1; }

        // khung bao quanh phần chữ
        let ix0 = 1e9, iy0 = 1e9, ix1 = -1, iy1 = -1, dem = 0;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++)
            if (!xoaH[y] && !xoaC[x] && ink(x, y)) { dem++; if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y; }
        if (dem < Math.max(20, bw * bh * 0.003)) return null;

        // vẽ lại: giữ độ xám của chữ (cho nét mịn), mọi thứ khác thành trắng
        const tw = ix1 - ix0 + 1, th = iy1 - iy0 + 1;
        const t = document.createElement("canvas"); t.width = tw; t.height = th;
        const tc = t.getContext("2d"), id = tc.createImageData(tw, th);
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
            const g = gray[(y0 + iy0 + y) * W + x0 + ix0 + x];
            const v = g <= thr + 25 && !xoaH[iy0 + y] && !xoaC[ix0 + x] ? g : 255;
            const k = (y * tw + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255;
        }
        tc.putImageData(id, 0, 0);
        const s = Math.max(1.5, Math.min(5, 90 / th)), pad = 12; // chữ nhỏ thì phóng to nhiều hơn
        const out = document.createElement("canvas");
        out.width = Math.round(tw * s) + pad * 2; out.height = Math.round(th * s) + pad * 2;
        const oc = out.getContext("2d");
        oc.fillStyle = "#fff"; oc.fillRect(0, 0, out.width, out.height);
        oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
        oc.drawImage(t, pad, pad, Math.round(tw * s), Math.round(th * s));
        return out;
    }

    let worker = null, psmHienTai = null, gallery = [], oDaDoc = [], soO = 0;

    async function layWorker() {
        if (worker) return worker;
        tienDo("Đang tải dữ liệu tiếng Việt (lần đầu hơi lâu)...", 0);
        worker = await Tesseract.createWorker("vie", 1, {
            logger: (m) => { if (m.status === "loading language traineddata") tienDo("Đang tải dữ liệu tiếng Việt...", Math.round(m.progress * 100)); },
        });
        return worker;
    }

    async function dungPsm(p) { // 6 = khối chữ nhiều dòng, 7 = một dòng
        if (psmHienTai !== p) { await worker.setParameters({ tessedit_pageseg_mode: p, preserve_interword_spaces: "1" }); psmHienTai = p; }
    }

    // Đọc 1 ô. Trả {raw, c} (raw rỗng nếu ô trống)
    async function docO(b, tag, psm = "6") {
        const c = catO(b);
        if (!c) return { raw: "" };
        await dungPsm(psm);
        const { data } = await worker.recognize(c);
        const raw = data.text.replace(/[|\\_~]+/g, " ").replace(/\s+/g, " ").trim();
        gallery.push({ tag, raw, url: c.toDataURL() });
        oDaDoc.push(b);
        tienDo(`Đang đọc từng ô... đã đọc ${++soO} ô`, Math.min(95, soO * 2));
        return { raw, c };
    }

    // Đọc 1 ô môn học: nếu không nhận ra môn thì thử lại với chế độ một dòng
    const rong = (b, m) => ({ x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m });
    const HANG = { chuan: 0, gan: 1, la: 2 };

    async function docMon(b, tag) {
        const cach = [[b, "6"], [b, "7"], [rong(b, 2), "7"], [rong(b, 2), "6"]];
        let tot = "", tk = 9;
        for (let i = 0; i < cach.length; i++) {
            const o = await docO(cach[i][0], tag, cach[i][1]);
            if (i === 0 && !o.c) return "";                 // ô trống thật sự
            if (!o.raw) continue;
            const k = timMon(o.raw).kieu;
            if (HANG[k] < tk) { tot = o.raw; tk = HANG[k]; }
            if (k === "chuan") break;
        }
        return tot;
    }

    // Đọc 1 hàng tiêu đề giả định -> số Thứ mỗi cột + độ lệch phổ biến nhất
    async function docTieuDe(L, ya, yb) {
        const ds = [];
        for (let j = 0; j < L.Vw.length - 1; j++) ds.push(parseThu((await docO(hop(L.Vw[j], L.Vw[j + 1], ya, yb), "tiêu đề " + (j + 1), "7")).raw));
        const phieu = {};
        ds.forEach((d, j) => { if (d) phieu[d - j] = (phieu[d - j] || 0) + 1; });
        const [lech, so] = Object.entries(phieu).sort((a, b) => b[1] - a[1])[0] || [2, 0];
        return { lech: +lech, so };
    }

    // chia buổi Sáng/Chiều: ưu tiên số tiết người dùng nhập, sau đó theo nhãn S/C, cuối cùng chia đôi
    function chiaBuoi(nhan, soSang) {
        const n = nhan.length;
        if (soSang > 0) return nhan.map((_, i) => (i < soSang ? "Sáng" : "Chiều"));
        const g = nhan.map((t) => { const c = chuanHoa(t)[0]; return c === "s" || c === "5" ? "S" : c === "c" || c === "e" ? "C" : "?"; });
        let k = Math.ceil(n / 2);
        if (g.filter((x) => x !== "?").length >= 3) {
            let bestSc = -1;
            for (let i = 0; i <= n; i++) { // vị trí cắt có nhiều nhãn khớp nhất
                const sc = g.filter((x, j) => (j < i ? x === "S" : x === "C")).length;
                if (sc > bestSc || (sc === bestSc && Math.abs(i - n / 2) < Math.abs(k - n / 2))) { bestSc = sc; k = i; }
            }
        }
        return nhan.map((_, i) => (i < k ? "Sáng" : "Chiều"));
    }


    // ---- Hàm chính: ảnh -> bảng chữ ----
    async function docAnh(blob, onProgress) {
        tienDo = onProgress || (() => { });
        gallery = []; oDaDoc = []; soO = 0;
        await nap(blob);
        let L = null;

        for (const n of [6, 5, 7]) { // thử 6 cột (T2-T7), rồi 5, rồi 7
            for (const d of [0, 30, -25, 60, -45]) { L = timLuoi(110 + d, n); if (L) break; } // thử nhiều độ đậm
            if (L) break;
        }
        if (!L) throw new Error("Không tìm thấy khung bảng. Hãy chụp thẳng, thấy đủ các đường kẻ.");
        await layWorker();
        const { HL, pitch, Vw, lab } = L, nDay = Vw.length - 1;
        // hàng tiêu đề T2...T7 nằm phía trên đường ngang đầu, hoặc là khoảng đầu tiên
        const A = await docTieuDe(L, { c: HL[0].c - pitch, t: 0 }, HL[0]);
        const B = await docTieuDe(L, HL[0], HL[1]);
        const tren = A.so > B.so || (A.so === B.so && HL.length - 1 < 11);
        const td = tren ? A : B, moc = tren ? HL : HL.slice(1);
        const lech = td.so >= 2 ? td.lech : 2;
        const rows = [], nhan = [];
        const cuoi = moc[moc.length - 1], conLai = H - cuoi.c;
        if (conLai > pitch * 0.5 && conLai < pitch * 1.05) moc.push({ c: Math.min(cuoi.c + pitch, H - 2), t: 0 });
        for (let r = 0; r + 1 < moc.length; r++) {
            nhan.push(lab ? (await docO(hop(lab[0], lab[1], moc[r], moc[r + 1]), "nhãn", "7")).raw : "");
            const cells = [];
            for (let j = 0; j < nDay; j++) cells.push(await docMon(hop(Vw[j], Vw[j + 1], moc[r], moc[r + 1]), "ô"));
            rows.push({ nhan: nhan[r], cells });
        }
        const dem = {};
        rows.forEach((r) => r.cells.forEach((c) => {
            if (!c) return; const m = timMon(c);
            if (m.kieu === "chuan") dem[m.ten] = (dem[m.ten] || 0) + 1;
        }));
        const daThay = new Set(Object.keys(dem));
        if (daThay.size) rows.forEach((r) => (r.cells = r.cells.map((c) => {
            if (!c || timMon(c).kieu !== "la") return c;
            const m = timMon(c, { chiTen: daThay, them: 1 });
            return m.kieu === "la" ? c : m.ten;
        })));

        const buoi = chiaBuoi(nhan, 0);
        rows.forEach((r, i) => (r.buoi = buoi[i]));

        return { days: Array.from({ length: nDay }, (_, j) => lech + j), rows, gallery };
    }


})();