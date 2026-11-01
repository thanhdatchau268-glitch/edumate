// auth.js - xử lý form Đăng nhập / Đăng ký (kiểm tra ngay trên form, báo lỗi dưới từng ô)
(function () {
    const API = "http://127.0.0.1:5000";
    const $ = (id) => document.getElementById(id);

    // Đã đăng nhập rồi thì không cần ở trang này nữa
    if (localStorage.getItem("isLoggedIn") === "true") {
        location.replace("personal.html");
        return;
    }

    // ---------- Hàm nhỏ dùng chung ----------
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Báo lỗi / báo hợp lệ cho 1 ô (field = thẻ .field bao quanh ô đó)
    function datTrangThai(field, loai, chu = "") {
        field.classList.toggle("invalid", loai === "loi");
        field.classList.toggle("valid", loai === "ok");
        field.querySelector(".field-msg").textContent = chu;
    }

    // Thông báo chung phía trên nút gửi
    function baoForm(loai, chu) {
        const el = $("auth-alert");
        el.className = "auth-alert show " + loai;
        el.textContent = chu; // textContent: không chạy được code lạ
    }
    function anBaoForm() {
        $("auth-alert").className = "auth-alert";
    }

    function dangGui(nut, dang, chuCho) {
        nut.disabled = dang;
        nut.classList.toggle("loading", dang);
        if (dang) { nut.dataset.chu = nut.textContent; nut.textContent = chuCho; }
        else if (nut.dataset.chu) nut.textContent = nut.dataset.chu;
    }

    // Nút con mắt hiện / ẩn mật khẩu
    document.querySelectorAll(".toggle-mk").forEach((nut) => {
        nut.addEventListener("click", () => {
            const o = $(nut.dataset.for);
            const hien = o.type === "password";
            o.type = hien ? "text" : "password";
            nut.querySelector("i").className = hien ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
            nut.setAttribute("aria-label", hien ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        });
    });

    // Gắn kiểm tra: rời ô thì kiểm tra, sau đó gõ tới đâu kiểm tra tới đó
    function ganKiemTra(idO, kiemTra) {
        const o = $(idO), field = o.closest(".field");
        let daChamVao = false;
        const chay = () => { const loi = kiemTra(o.value); datTrangThai(field, loi ? "loi" : "ok", loi); return !loi; };
        o.addEventListener("blur", () => { daChamVao = true; if (o.value !== "") chay(); });
        o.addEventListener("input", () => { if (daChamVao) chay(); anBaoForm(); });
        return () => { daChamVao = true; return chay(); };
    }

    // Đổi lỗi mạng thành câu dễ hiểu
    async function goiApi(url, body) {
        let res;
        try {
            res = await fetch(API + url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } catch (e) {
            throw new Error("Không kết nối được server. Bạn bật app.py chưa?");
        }
        if (res.status >= 500) throw new Error("Server đang gặp lỗi (" + res.status + "). Xem terminal chạy app.py nhé!");
        return res.json();
    }

    // =========================================================
    // ĐĂNG NHẬP
    // =========================================================
    const formLogin = $("form-login");
    if (formLogin) {
        const kiemEmail = ganKiemTra("login-email", (v) =>
            !v.trim() ? "Hãy nhập email." : !EMAIL_RE.test(v.trim()) ? "Email chưa đúng dạng (ví dụ: ban@gmail.com)." : "");
        const kiemMk = ganKiemTra("login-password", (v) => (!v ? "Hãy nhập mật khẩu." : ""));

        // Vừa đăng ký xong: điền sẵn email và chúc mừng
        const q = new URLSearchParams(location.search);
        if (q.get("email")) $("login-email").value = q.get("email");
        if (q.get("registered")) {
            baoForm("success", "Đăng ký thành công! Hãy đăng nhập để bắt đầu.");
            $("login-password").focus();
        }

        $("btn-quen-mk").addEventListener("click", () =>
            baoForm("info", "Tính năng khôi phục mật khẩu đang được phát triển. Bạn hãy liên hệ quản trị viên để được hỗ trợ nhé."));

        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            anBaoForm();
            // chạy cả 2 phép kiểm tra để hiện đủ lỗi một lượt
            const okEmail = kiemEmail(), okMk = kiemMk();
            if (!okEmail || !okMk) return;

            const nut = $("btn-login");
            dangGui(nut, true, "Đang đăng nhập...");
            try {
                const data = await goiApi("/api/login", {
                    email: $("login-email").value.trim(),
                    mk: $("login-password").value,
                });
                if (!data.success) {
                    baoForm("error", data.message || "Đăng nhập không thành công.");
                    dangGui(nut, false);
                    return;
                }
                // Lưu thông tin đăng nhập (giống script.js cũ)
                localStorage.setItem("isLoggedIn", "true");
                localStorage.setItem("username", data.user.username);
                localStorage.setItem("userId", data.user.id);
                localStorage.setItem("streak", data.user.streak);
                localStorage.setItem("monChuyen", data.user.mon_chuyen || "");
                localStorage.setItem("avatar", data.user.avatar || "");
                baoForm("success", "Đăng nhập thành công! Đang chuyển trang...");
                // Lần đầu thì khảo sát, các lần sau vào thẳng trang chính
                const quayLai = sessionStorage.getItem("quayLai");   // trang khách đang xem trước khi bị mời đăng nhập
                sessionStorage.removeItem("quayLai");
                location.href = data.user.can_khao_sat ? "khaosat.html" : (quayLai || "personal.html");
            } catch (err) {
                baoForm("error", err.message);
                dangGui(nut, false);
            }
        });
    }

    // =========================================================
    // ĐĂNG KÝ
    // =========================================================
    const formReg = $("form-register");
    if (formReg) {
        const kiemEmail = ganKiemTra("reg-email", (v) =>
            !v.trim() ? "Hãy nhập email." : !EMAIL_RE.test(v.trim()) ? "Email chưa đúng dạng (ví dụ: ban@gmail.com)." : "");
        const kiemTen = ganKiemTra("reg-username", (v) => {
            const t = v.trim();
            return !t ? "Hãy nhập username." : t.length > 30 ? "Username tối đa 30 ký tự." : "";
        });
        const kiemMk = ganKiemTra("reg-password", (v) =>
            !v ? "Hãy nhập mật khẩu." : v.length < 6 ? "Mật khẩu cần ít nhất 6 ký tự." : "");
        const kiemNhapLai = ganKiemTra("reg-confirm-password", (v) =>
            !v ? "Hãy nhập lại mật khẩu." : v !== $("reg-password").value ? "Mật khẩu nhập lại chưa khớp." : "");

        // Đổi mật khẩu thì ô nhập lại phải kiểm tra lại (nếu đã nhập)
        $("reg-password").addEventListener("input", () => {
            veDoManh($("reg-password").value);
            const o = $("reg-confirm-password");
            if (o.value) {
                const f = o.closest(".field");
                const khop = o.value === $("reg-password").value;
                datTrangThai(f, khop ? "ok" : "loi", khop ? "" : "Mật khẩu nhập lại chưa khớp.");
            }
        });

        // Độ mạnh: dài hơn, có chữ hoa + thường, có số, có ký tự đặc biệt
        function veDoManh(mk) {
            let m = 0;
            if (mk.length >= 6) m++;
            if (mk.length >= 8 && /[a-z]/.test(mk) && /[A-Z]/.test(mk)) m++;
            if (/\d/.test(mk) && /[a-zA-Z]/.test(mk)) m++;
            if (mk.length >= 10 && /[^a-zA-Z0-9]/.test(mk)) m++;
            if (!mk) m = 0;
            const box = $("mk-manh");
            box.dataset.m = m;
            $("mk-chu").textContent = !mk
                ? "Dùng 8 ký tự trở lên, gồm chữ hoa, chữ thường và số để an toàn hơn."
                : ["Quá ngắn (cần ít nhất 6 ký tự).", "Yếu: hãy thêm chữ và số.", "Trung bình: thêm chữ hoa hoặc dài hơn.", "Khá tốt!", "Mạnh!"][m];
        }
        veDoManh("");

        formReg.addEventListener("submit", async (e) => {
            e.preventDefault();
            anBaoForm();
            const kq = [kiemEmail(), kiemTen(), kiemMk(), kiemNhapLai()];
            if (kq.includes(false)) return;

            const nut = $("btn-register");
            dangGui(nut, true, "Đang tạo tài khoản...");
            try {
                const email = $("reg-email").value.trim();
                const data = await goiApi("/api/register", {
                    username: $("reg-username").value.trim(),
                    email,
                    mk: $("reg-password").value,
                });
                if (!data.success) {
                    // email trùng thì đánh dấu thẳng vào ô email cho dễ thấy
                    if (/email/i.test(data.message || "")) datTrangThai($("reg-email").closest(".field"), "loi", data.message);
                    else baoForm("error", data.message || "Đăng ký không thành công.");
                    dangGui(nut, false);
                    return;
                }
                baoForm("success", "Đăng ký thành công! Đang chuyển sang trang đăng nhập...");
                setTimeout(() => {
                    location.href = "login.html?registered=1&email=" + encodeURIComponent(email);
                }, 1000);
            } catch (err) {
                baoForm("error", err.message);
                dangGui(nut, false);
            }
        });
    }
})();