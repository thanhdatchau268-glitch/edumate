// thong-bao.js - nhắc giữ chuỗi, nhắc cuộc thi, nhắc lịch học cá nhân hoá
// Nạp từ script.js (mọi trang) và nạp thẳng ở profile.html / personal.html.
// Thông báo chạy khi VnStarL đang mở trong trình duyệt (kể cả tab nền).
(function () {
    if (window.THONGBAO) return; // nạp 2 lần cũng chỉ chạy 1 bản

    const API = "http://127.0.0.1:5000";
    const CHU_KY_KIEM_TRA = 30 * 1000;      // 30 giây kiểm tra một lần
    const CHU_KY_TAI_THI = 5 * 60 * 1000;   // 5 phút mới hỏi server danh sách cuộc thi một lần
    const BAO_TRUOC_LICH = 5;               // báo trước giờ học 5 phút
    const BAO_TRUOC_THI = 30;               // báo trước cuộc thi 30 phút

    // Cài đặt mặc định (mỗi tài khoản một bản, lưu trong localStorage)
    const MAC_DINH = { bat: false, chuoi: true, gioChuoi: "20:00", thi: true, lich: true };

    // ---------- Hàm nhỏ ----------
    const pad = (n) => String(n).padStart(2, "0");
    const uid = () => localStorage.getItem("userId");
    const dangNhap = () => localStorage.getItem("isLoggedIn") === "true" && !!uid();
    const ngayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const gioStr = (p) => `${pad(Math.floor(p / 60))}:${pad(p % 60)}`;
    const phutCua = (s) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
        return m ? +m[1] * 60 + +m[2] : NaN;
    };
    const parseGio = (s) => new Date(String(s).replace(" ", "T")); // "2026-11-01 19:00" -> giờ máy

    // ---------- Cài đặt ----------
    const khoaCauHinh = () => "saola_tb_" + uid();
    function doc() {
        try {
            return { ...MAC_DINH, ...JSON.parse(localStorage.getItem(khoaCauHinh()) || "{}") };
        } catch (e) {
            return { ...MAC_DINH };
        }
    }
    function luu(c) {
        localStorage.setItem(khoaCauHinh(), JSON.stringify(c));
    }

    // ---------- Quyền của trình duyệt ----------
    const hoTro = () => "Notification" in window;
    const quyen = () => (hoTro() ? Notification.permission : "unsupported");

    // ---------- Nhớ thông báo nào đã gửi (mỗi thông báo chỉ gửi 1 lần) ----------
    // Mọi khoá đều bắt đầu bằng ngày YYYY-MM-DD nên dọn được khoá của những ngày đã qua
    const khoaDaGui = () => "saola_tb_da_" + uid();
    function docDaGui() {
        let d = {};
        try { d = JSON.parse(localStorage.getItem(khoaDaGui()) || "{}"); } catch (e) { /* hỏng thì coi như rỗng */ }
        const hn = ngayStr();
        Object.keys(d).forEach((k) => { if (k.slice(0, 10) < hn) delete d[k]; });
        return d;
    }
    const daGui = (k) => !!docDaGui()[k];
    function danhDau(k) {
        const d = docDaGui();
        d[k] = 1;
        localStorage.setItem(khoaDaGui(), JSON.stringify(d));
    }

    // ---------- Gửi 1 thông báo ----------
    function dangKySW() {
        if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
    }

    async function gui(tieu, noi, tag, url) {
        if (quyen() !== "granted") return false;
        const opt = {
            body: noi,
            icon: "img/logo.webp",
            badge: "img/logo.webp",
            tag, // cùng tag thì thay thế thông báo cũ, không chồng chất
            data: { url: url || "index.html" },
        };
        try {
            // Điện thoại (Android) bắt buộc đi qua service worker
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.active) {
                    await reg.showNotification(tieu, opt);
                    return true;
                }
            }
        } catch (e) { /* thử cách thường bên dưới */ }
        try {
            const n = new Notification(tieu, opt);
            n.onclick = () => {
                window.focus();
                if (url) location.href = url;
                n.close();
            };
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---------- 1. Nhắc giữ chuỗi ----------
    let lanThuChuoi = 0;
    async function nhacChuoi(c, phutNay) {
        const gio = phutCua(c.gioChuoi);
        if (isNaN(gio) || phutNay < gio) return; // chưa tới giờ nhắc
        const key = `${ngayStr()}|chuoi`;
        if (daGui(key)) return;
        if (Date.now() - lanThuChuoi < 5 * 60 * 1000) return; // server lỗi thì 5 phút mới thử lại
        lanThuChuoi = Date.now();
        try {
            const kq = await (await fetch(`${API}/api/users/${uid()}`)).json();
            if (!kq.success) return;
            const u = kq.data;
            danhDau(key); // dù học rồi hay chưa, hôm nay cũng chỉ kiểm tra 1 lần
            if (u.hoc_hom_nay) return; // hôm nay đã làm bài thì khỏi nhắc
            const coChuoi = u.streak > 0;
            await gui(
                coChuoi ? `🔥 Chuỗi ${u.streak} ngày sắp mất!` : "📚 Hôm nay anh/chị chưa học bài nào",
                coChuoi
                    ? "Làm ít nhất 1 bài tập trước 24:00 để giữ chuỗi nhé."
                    : "Làm 1 bài tập ngay để bắt đầu chuỗi ngày học mới.",
                "saola-chuoi",
                "subjects.html",
            );
        } catch (e) { /* server chưa bật thì bỏ qua, lần sau thử lại */ }
    }

    // ---------- 2. Nhắc cuộc thi ----------
    let dsThi = [];
    let lanTaiThi = 0;
    async function nhacThi(now) {
        if (Date.now() - lanTaiThi > CHU_KY_TAI_THI) {
            lanTaiThi = Date.now();
            try {
                const kq = await (await fetch(`${API}/api/contests`)).json();
                dsThi = kq.success ? kq.data : [];
            } catch (e) {
                dsThi = [];
            }
        }
        for (const c of dsThi) {
            const bd = parseGio(c.bat_dau), kt = parseGio(c.ket_thuc);
            if (isNaN(bd) || isNaN(kt)) continue;
            const conLai = (bd - now) / 60000; // số phút nữa cuộc thi bắt đầu

            let loai = null, tieu = "", noi = "";
            if (conLai > 0 && conLai <= BAO_TRUOC_THI) {
                loai = "sap";
                tieu = `🏆 ${Math.ceil(conLai)} phút nữa có cuộc thi`;
                noi = `"${c.ten}" bắt đầu lúc ${gioStr(bd.getHours() * 60 + bd.getMinutes())}. Chuẩn bị sẵn sàng nhé!`;
            } else if (conLai <= 0 && now < kt) {
                loai = "bd";
                tieu = "🏆 Cuộc thi đã bắt đầu!";
                noi = `"${c.ten}" đang diễn ra, kết thúc lúc ${gioStr(kt.getHours() * 60 + kt.getMinutes())}. Vào thi ngay!`;
            }
            if (!loai) continue;

            const key = `${ngayStr()}|thi|${c.id}|${loai}`;
            if (daGui(key)) continue;
            danhDau(key);
            await gui(tieu, noi, `saola-thi-${c.id}-${loai}`, "contest.html");
        }
    }

    // ---------- 3. Nhắc lịch học cá nhân hoá ----------
    // personal.js lưu lịch cả tuần vào localStorage: { "2026-11-01": [{s, e, loai, ten}, ...] }
    function nhacLich(now, phutNay) {
        let lich = {};
        try { lich = JSON.parse(localStorage.getItem("saola_lich_" + uid()) || "{}"); } catch (e) { /* bỏ qua */ }
        const hn = ngayStr(now);
        (lich[hn] || []).forEach((m) => {
            if (m.loai === "truong") return; // giờ ở trường thì không cần nhắc
            if (phutNay < m.s - BAO_TRUOC_LICH || phutNay >= m.s + 10) return;
            const key = `${hn}|lich|${m.s}|${m.ten}`;
            if (daGui(key)) return;
            danhDau(key);
            gui(
                phutNay < m.s ? `⏰ Sắp tới giờ học (${gioStr(m.s)})` : "⏰ Đến giờ rồi!",
                `${gioStr(m.s)}–${gioStr(m.e)}: ${m.ten}`,
                `saola-lich-${hn}-${m.s}`,
                m.loai === "edumate" ? "subjects.html" : "personal.html",
            );
        });
    }

    // ---------- Vòng kiểm tra ----------
    async function kiemTra() {
        if (!dangNhap()) return;
        const c = doc();
        if (!c.bat || quyen() !== "granted") return;

        // Mở nhiều tab thì chỉ 1 tab được kiểm tra mỗi lượt, tránh báo trùng
        const khoaLock = "saola_tb_lock_" + uid();
        if (Date.now() - (+localStorage.getItem(khoaLock) || 0) < 20000) return;
        localStorage.setItem(khoaLock, String(Date.now()));

        const now = new Date();
        const phutNay = now.getHours() * 60 + now.getMinutes();
        if (c.lich) nhacLich(now, phutNay);
        if (c.chuoi) await nhacChuoi(c, phutNay);
        if (c.thi) await nhacThi(now);
    }

    let timer = null;
    function khoiDong() {
        if (timer || !dangNhap() || !doc().bat) return;
        dangKySW();
        timer = setInterval(kiemTra, CHU_KY_KIEM_TRA);
        kiemTra();
    }
    function dung() {
        clearInterval(timer);
        timer = null;
    }

    // ---------- Hàm cho giao diện gọi ----------
    // Bật: xin quyền trình duyệt (phải gọi ngay trong lúc người dùng bấm nút)
    async function bat() {
        if (!dangNhap()) return { ok: false, loi: "Hãy đăng nhập trước." };
        if (!hoTro()) return { ok: false, loi: "Trình duyệt này không hỗ trợ thông báo." };
        let q = Notification.permission;
        if (q === "default") q = await Notification.requestPermission();
        if (q !== "granted") {
            return {
                ok: false,
                loi: q === "denied"
                    ? "Thông báo đang bị chặn. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → cho phép Thông báo, rồi bật lại."
                    : "Bạn chưa cho phép thông báo.",
            };
        }
        const c = doc();
        c.bat = true;
        luu(c);
        khoiDong();
        return { ok: true };
    }

    function tat() {
        const c = doc();
        c.bat = false;
        luu(c);
        dung();
    }

    async function thu() {
        return gui("🔔 Thông báo đã hoạt động!", "VnStarL sẽ nhắc anh/chị đúng lúc để giữ nhịp học.", "saola-thu", "profile.html");
    }

    window.THONGBAO = { doc, luu, hoTro, quyen, bat, tat, thu, khoiDong, dung };
    khoiDong(); // đã bật từ trước thì tự chạy ngay khi mở trang
})();