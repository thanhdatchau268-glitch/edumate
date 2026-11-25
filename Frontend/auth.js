// auth.js - xử lý form Đăng nhập / Đăng ký & Khôi phục mật khẩu qua Gmail
(function () {
    const API = "http://127.0.0.1:5000";
    const $ = (id) => document.getElementById(id);

    // ---------- Hàm nhỏ dùng chung ----------
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function datTrangThai(field, loai, chu = "") {
        if (!field) return;
        field.classList.toggle("invalid", loai === "loi");
        field.classList.toggle("valid", loai === "ok");
        const msg = field.querySelector(".field-msg");
        if (msg) msg.textContent = chu;
    }

    function baoForm(loai, chu) {
        const el = $("auth-alert");
        if (!el) return;
        el.className = "auth-alert show " + loai;
        el.textContent = chu;
    }

    function anBaoForm() {
        const el = $("auth-alert");
        if (el) el.className = "auth-alert";
    }

    function dangGui(nut, dang, chuCho) {
        if (!nut) return;
        nut.disabled = dang;
        nut.classList.toggle("loading", dang);
        if (dang) {
            nut.dataset.chu = nut.innerHTML;
            nut.textContent = chuCho;
        } else if (nut.dataset.chu) {
            nut.innerHTML = nut.dataset.chu;
        }
    }

    // Nút con mắt hiện / ẩn mật khẩu
    document.querySelectorAll(".toggle-mk").forEach((nut) => {
        nut.addEventListener("click", () => {
            const o = $(nut.dataset.for);
            if (!o) return;
            const hien = o.type === "password";
            o.type = hien ? "text" : "password";
            const ico = nut.querySelector("i");
            if (ico) ico.className = hien ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
            nut.setAttribute("aria-label", hien ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        });
    });

    function ganKiemTra(idO, kiemTra) {
        const o = $(idO);
        if (!o) return () => true;
        const field = o.closest(".field");
        let daChamVao = false;
        const chay = () => {
            const loi = kiemTra(o.value);
            datTrangThai(field, loi ? "loi" : "ok", loi);
            return !loi;
        };
        o.addEventListener("blur", () => {
            daChamVao = true;
            if (o.value !== "") chay();
        });
        o.addEventListener("input", () => {
            if (daChamVao) chay();
            anBaoForm();
        });
        return () => {
            daChamVao = true;
            return chay();
        };
    }

    async function goiApi(url, body, method = "POST") {
        let res;
        try {
            const opts = {
                method,
                headers: { "Content-Type": "application/json" },
            };
            if (method !== "GET" && body !== undefined) {
                opts.body = JSON.stringify(body);
            }
            res = await fetch(API + url, opts);
        } catch (e) {
            throw new Error("Không kết nối được server. Bạn bật app.py chưa?");
        }
        if (res.status >= 500) {
            throw new Error("Server đang gặp lỗi (" + res.status + "). Xem terminal chạy app.py nhé!");
        }
        return res.json();
    }

    // =========================================================
    // DANH SÁCH TÀI KHOẢN GMAIL ĐÃ LƯU TRÊN TRÌNH DUYỆT CỦA BẠN
    // =========================================================
    const TAI_KHOAN_MAC_DINH = [];

    function layDanhSachTaiKhoanMay() {
        const map = new Map();
        // Ưu tiên tài khoản mặc định trên máy trước
        TAI_KHOAN_MAC_DINH.forEach((acc) => {
            map.set(acc.email.toLowerCase(), { ...acc });
        });
        try {
            const raw = localStorage.getItem("vnstarl_known_accounts");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach((acc) => {
                        if (acc && acc.email) {
                            const key = acc.email.toLowerCase();
                            if (!map.has(key)) {
                                map.set(key, acc);
                            }
                        }
                    });
                }
            }
        } catch (e) {}
        return Array.from(map.values());
    }

    function luuTaiKhoanMay(name, email) {
        if (!email) return;
        const cleanEmail = email.trim().toLowerCase();
        const ds = layDanhSachTaiKhoanMay().filter((acc) => acc.email.toLowerCase() !== cleanEmail);
        const colors = ["#673ab7", "#e65100", "#1a73e8", "#0f9d58", "#d93025"];
        const color = colors[Math.abs(cleanEmail.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)) % colors.length];
        const macDinh = TAI_KHOAN_MAC_DINH.find((a) => a.email.toLowerCase() === cleanEmail);
        ds.unshift({
            name: (macDinh && macDinh.name) || name || cleanEmail.split("@")[0],
            email: cleanEmail,
            color: (macDinh && macDinh.color) || color,
            isMain: ds.length === 0,
        });
        try {
            localStorage.setItem("vnstarl_known_accounts", JSON.stringify(ds.slice(0, 8)));
        } catch (e) {}
        renderTatCaDanhSachGmail();
    }

    async function dongBoTaiKhoanTuServer() {
        try {
            const data = await goiApi("/api/accounts-hint", undefined, "GET");
            if (data && data.success && Array.isArray(data.accounts)) {
                const hienTai = layDanhSachTaiKhoanMay();
                const seen = new Set(hienTai.map((a) => a.email.toLowerCase()));
                data.accounts.forEach((acc) => {
                    if (acc && acc.email && !seen.has(acc.email.toLowerCase())) {
                        seen.add(acc.email.toLowerCase());
                        hienTai.push(acc);
                    }
                });
                localStorage.setItem("vnstarl_known_accounts", JSON.stringify(hienTai.slice(0, 8)));
                renderTatCaDanhSachGmail();
            }
        } catch (e) {
            // Không sao nếu server chưa bật
        }
    }

    function taoHtmlDanhSachGmail(ds, coNutGuiMa = false) {
        if (!ds || !ds.length) {
            return '<div style="padding:14px;color:#94a3b8;font-size:0.85rem;text-align:center;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:6px"></i>Chưa có tài khoản nào được lưu trên trình duyệt này.</div>';
        }
        return ds
            .map((acc, idx) => {
                const chuDau = (acc.name || acc.email)[0].toUpperCase();
                const isMain = idx === 0 || acc.isMain;
                return `
                <button type="button" class="g-acc-item" data-email="${acc.email}" data-name="${acc.name || ""}">
                    <div class="g-avatar" style="background-color: ${acc.color || "#673ab7"}">
                        <span>${chuDau}</span>
                        ${isMain ? '<span class="g-badge-edit"><i class="fa-solid fa-pencil"></i></span>' : ""}
                    </div>
                    <div class="g-acc-info">
                        <b class="g-name">${acc.name || acc.email.split("@")[0]}</b>
                        <span class="g-email">${acc.email}</span>
                    </div>
                    ${
                        coNutGuiMa
                            ? '<span class="g-chon-badge">Gửi mã <i class="fa-solid fa-arrow-right"></i></span>'
                            : isMain
                            ? '<i class="fa-solid fa-chevron-up" style="color: #9aa6b8; font-size: 0.85rem; margin-left: auto;"></i>'
                            : ""
                    }
                </button>
                `;
            })
            .join("");
    }

    let chonGmailTrongQmkCallback = null;
    let kiemEmailLoginFn = null;
    let kiemEmailRegFn = null;

    function renderTatCaDanhSachGmail() {
        const ds = layDanhSachTaiKhoanMay();

        // 1. Danh sách trong Modal Quên mật khẩu
        const qmkList = $("g-accounts-list");
        if (qmkList) {
            qmkList.innerHTML = taoHtmlDanhSachGmail(ds, true);
            qmkList.querySelectorAll(".g-acc-item").forEach((btn) => {
                btn.addEventListener("click", () => {
                    if (chonGmailTrongQmkCallback) {
                        chonGmailTrongQmkCallback(btn.dataset.email, btn.dataset.name);
                    }
                });
            });
        }

        // 2. Danh sách trên form Đăng nhập
        const loginList = $("login-g-accounts-list");
        if (loginList) {
            loginList.innerHTML = taoHtmlDanhSachGmail(ds, false);
            loginList.querySelectorAll(".g-acc-item").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const oEmail = $("login-email");
                    if (oEmail) {
                        oEmail.value = btn.dataset.email;
                        if (kiemEmailLoginFn) kiemEmailLoginFn();
                    }
                    anPopupGmailForm("login");
                    if ($("login-password")) $("login-password").focus();
                });
            });
        }

        // 3. Danh sách trên form Đăng ký
        const regList = $("reg-g-accounts-list");
        if (regList) {
            regList.innerHTML = taoHtmlDanhSachGmail(ds, false);
            regList.querySelectorAll(".g-acc-item").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const oEmail = $("reg-email");
                    if (oEmail) {
                        oEmail.value = btn.dataset.email;
                        if (kiemEmailRegFn) kiemEmailRegFn();
                    }
                    const oUser = $("reg-username");
                    if (oUser && !oUser.value.trim() && btn.dataset.name) {
                        oUser.value = btn.dataset.name;
                    }
                    anPopupGmailForm("reg");
                    if ($("reg-password")) $("reg-password").focus();
                });
            });
        }

        // 4. Datalist gợi ý
        const dl = $("list-goi-y-gmail");
        if (dl) {
            dl.innerHTML = ds.map((a) => `<option value="${a.email}">${a.name || a.email}</option>`).join("");
        }
    }

    function hienPopupGmailForm(loai) {
        const popup = $(loai === "login" ? "login-google-popup" : "reg-google-popup");
        const nut = $(loai === "login" ? "btn-toggle-login-gmail" : "btn-toggle-reg-gmail");
        if (popup) popup.classList.remove("hidden");
        if (nut) nut.classList.add("open");
    }

    function anPopupGmailForm(loai) {
        const popup = $(loai === "login" ? "login-google-popup" : "reg-google-popup");
        const nut = $(loai === "login" ? "btn-toggle-login-gmail" : "btn-toggle-reg-gmail");
        if (popup) popup.classList.add("hidden");
        if (nut) nut.classList.remove("open");
    }

    // Gắn sự kiện mở/đóng popup chọn Gmail trên form Đăng nhập & Đăng ký
    ["login", "reg"].forEach((loai) => {
        const oInput = $(loai === "login" ? "login-email" : "reg-email");
        const nutToggle = $(loai === "login" ? "btn-toggle-login-gmail" : "btn-toggle-reg-gmail");
        const nutDong = $(loai === "login" ? "btn-dong-login-g" : "btn-dong-reg-g");
        const nutKhac = $(loai === "login" ? "btn-login-gmail-khac" : "btn-reg-gmail-khac");
        const popup = $(loai === "login" ? "login-google-popup" : "reg-google-popup");

        if (oInput) {
            oInput.addEventListener("focus", () => {
                hienPopupGmailForm(loai);
            });
            oInput.addEventListener("click", (e) => {
                e.stopPropagation();
                hienPopupGmailForm(loai);
            });
        }
        if (nutToggle) {
            nutToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                const dangMo = popup && !popup.classList.contains("hidden");
                if (dangMo) anPopupGmailForm(loai);
                else hienPopupGmailForm(loai);
            });
        }
        if (nutDong) {
            nutDong.addEventListener("click", (e) => {
                e.stopPropagation();
                anPopupGmailForm(loai);
            });
        }
        if (nutKhac) {
            nutKhac.addEventListener("click", (e) => {
                e.stopPropagation();
                anPopupGmailForm(loai);
                if (oInput) {
                    oInput.value = "";
                    oInput.focus();
                }
            });
        }
    });

    // Click ra ngoài thì đóng popup trên form chính
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".google-field-wrap")) {
            anPopupGmailForm("login");
            anPopupGmailForm("reg");
        }
    });

    // Khởi tạo danh sách tài khoản ngay lập tức
    renderTatCaDanhSachGmail();
    dongBoTaiKhoanTuServer();

    // =========================================================
    // ĐĂNG NHẬP & QUÊN MẬT KHẨU QUA GMAIL
    // =========================================================
    const formLogin = $("form-login");
    if (formLogin) {
        const kiemEmail = ganKiemTra("login-email", (v) =>
            !v.trim() ? "Hãy nhập hoặc chọn email." : !EMAIL_RE.test(v.trim()) ? "Email chưa đúng dạng (ví dụ: ban@gmail.com)." : ""
        );
        kiemEmailLoginFn = kiemEmail;
        const kiemMk = ganKiemTra("login-password", (v) => (!v ? "Hãy nhập mật khẩu." : ""));

        const q = new URLSearchParams(location.search);
        if (q.get("email") && $("login-email")) {
            $("login-email").value = q.get("email");
        }
        if (q.get("registered")) {
            baoForm("success", "Đăng ký thành công! Hãy đăng nhập để bắt đầu.");
            if ($("login-password")) $("login-password").focus();
        }

        // =========================================================
        // MODAL QUÊN MẬT KHẨU & ĐỔI MẬT KHẨU QUA GMAIL
        // =========================================================
        const modalQmk = $("modal-quen-mk");
        const QMK = {
            currentStep: 1,
            email: "",
            resetToken: "",
            demGiayTimer: null,
            giayConLai: 60,
        };

        function baoQmk(loai, chu) {
            const el = $("qmk-alert");
            if (!el) return;
            if (!chu) {
                el.className = "auth-alert";
                el.textContent = "";
                return;
            }
            el.className = "auth-alert show " + loai;
            el.textContent = chu;
        }

        function chuyenBuoc(buoc) {
            QMK.currentStep = buoc;
            baoQmk("", "");

            if ($("qmk-step-1")) $("qmk-step-1").classList.toggle("active", buoc === 1);
            if ($("qmk-step-2")) $("qmk-step-2").classList.toggle("active", buoc === 2);
            if ($("qmk-step-3")) $("qmk-step-3").classList.toggle("active", buoc === 3);

            if ($("dot-step-1")) $("dot-step-1").className = "qmk-buoc-item " + (buoc === 1 ? "active" : buoc > 1 ? "done" : "");
            if ($("dot-step-2")) $("dot-step-2").className = "qmk-buoc-item " + (buoc === 2 ? "active" : buoc > 2 ? "done" : "");
            if ($("dot-step-3")) $("dot-step-3").className = "qmk-buoc-item " + (buoc === 3 ? "active" : "");

            if ($("line-step-1")) $("line-step-1").className = "qmk-line " + (buoc > 1 ? "done" : "");
            if ($("line-step-2")) $("line-step-2").className = "qmk-line " + (buoc > 2 ? "done" : "");

            if (buoc === 2) {
                if ($("qmk-target-email")) $("qmk-target-email").textContent = QMK.email;
                if ($("smtp-sender-email") && !$("smtp-sender-email").value) {
                    $("smtp-sender-email").value = QMK.email || "";
                }
                if ($("qmk-otp")) {
                    $("qmk-otp").value = "";
                    setTimeout(() => $("qmk-otp").focus(), 150);
                }
            } else if (buoc === 3) {
                if ($("qmk-reset-email")) $("qmk-reset-email").textContent = QMK.email;
                if ($("qmk-new-password")) {
                    $("qmk-new-password").value = "";
                    if ($("qmk-confirm-password")) $("qmk-confirm-password").value = "";
                    veDoManhQmk("");
                    setTimeout(() => $("qmk-new-password").focus(), 150);
                }
            }
        }

        function moModalQmk(emailKhoiTao = "") {
            if (!modalQmk) return;
            anPopupGmailForm("login");
            modalQmk.hidden = false;
            document.body.style.overflow = "hidden";
            renderTatCaDanhSachGmail();

            // Luôn mở sẵn danh sách tài khoản Gmail trên máy trong Bước 1
            const p = $("google-accounts-popup");
            if (p) p.classList.remove("hidden");
            const b = $("btn-chon-gmail-may");
            if (b) b.classList.add("open");

            if (emailKhoiTao) {
                if ($("qmk-email")) $("qmk-email").value = emailKhoiTao;
            } else if ($("login-email") && $("login-email").value.trim()) {
                if ($("qmk-email")) $("qmk-email").value = $("login-email").value.trim();
            }

            chuyenBuoc(1);
        }

        function dongModalQmk() {
            if (!modalQmk) return;
            modalQmk.hidden = true;
            document.body.style.overflow = "";
            if (QMK.demGiayTimer) clearInterval(QMK.demGiayTimer);
        }

        // BƯỚC 1: Gửi mã xác thực OTP về Gmail
        async function guiOtpGmail(emailTruyenVao = "") {
            const email = (emailTruyenVao || ($("qmk-email") ? $("qmk-email").value : "")).trim();
            if ($("qmk-email") && emailTruyenVao) {
                $("qmk-email").value = email;
            }
            if (!email) {
                baoQmk("error", "Vui lòng chọn 1 tài khoản Gmail bên trên hoặc nhập địa chỉ Gmail!");
                if ($("qmk-email")) $("qmk-email").focus();
                return;
            }
            if (!EMAIL_RE.test(email)) {
                baoQmk("error", "Địa chỉ Gmail chưa đúng định dạng (ví dụ: ban@gmail.com)!");
                if ($("qmk-email")) $("qmk-email").focus();
                return;
            }

            QMK.email = email;
            const nut = $("btn-gui-otp");
            dangGui(nut, true, "Đang gửi mã về Gmail...");
            baoQmk("info", `Đang gửi mã xác thực 6 chữ số tới ${email}...`);

            try {
                const res = await goiApi("/api/forgot-password/send-otp", { email });
                dangGui(nut, false);
                if (!res.success) {
                    baoQmk("error", res.message || "Không gửi được mã xác thực.");
                    return;
                }

                luuTaiKhoanMay(email.split("@")[0], email);

                if ($("smtp-sender-email") && res.smtp_email) {
                    $("smtp-sender-email").value = res.smtp_email;
                }

                if (res.demo_otp && $("qmk-demo-box")) {
                    $("qmk-demo-box").classList.remove("hidden");
                    if ($("qmk-demo-otp-val")) $("qmk-demo-otp-val").textContent = res.demo_otp;
                    if ($("btn-copy-demo-otp")) {
                        $("btn-copy-demo-otp").onclick = () => {
                            if ($("qmk-otp")) {
                                $("qmk-otp").value = res.demo_otp;
                                xacNhanOtp();
                            }
                        };
                    }
                } else if ($("qmk-demo-box")) {
                    $("qmk-demo-box").classList.add("hidden");
                }

                chuyenBuoc(2);
                batDauDemGiay();
                if (res.sent_via_smtp) {
                    baoQmk("success", `Đã gửi email chứa mã OTP về hộp thư Gmail (${email})! Hãy mở Gmail để xem mã.`);
                } else {
                    baoQmk(
                        "success",
                        `Đã tạo mã xác thực cho ${email}! Bạn có thể nhấn "Điền nhanh mã này" hoặc cài Mật khẩu ứng dụng Gmail bên dưới để nhận thư thật trong Gmail.`
                    );
                }
            } catch (err) {
                dangGui(nut, false);
                baoQmk("error", err.message);
            }
        }

        // Khi người dùng bấm chọn 1 tài khoản Gmail có sẵn trong Modal -> điền và gửi OTP về email đó luôn!
        chonGmailTrongQmkCallback = (email, name) => {
            if ($("qmk-email")) $("qmk-email").value = email;
            luuTaiKhoanMay(name, email);
            guiOtpGmail(email);
        };

        if ($("btn-quen-mk")) {
            $("btn-quen-mk").addEventListener("click", () => {
                moModalQmk();
            });
        }

        if ($("btn-dong-qmk")) $("btn-dong-qmk").addEventListener("click", dongModalQmk);
        if (modalQmk) {
            modalQmk.addEventListener("click", (e) => {
                if (e.target === modalQmk) dongModalQmk();
            });
        }

        if ($("btn-chon-gmail-may")) {
            $("btn-chon-gmail-may").addEventListener("click", (e) => {
                e.stopPropagation();
                const p = $("google-accounts-popup");
                const b = $("btn-chon-gmail-may");
                if (!p) return;
                const isHidden = p.classList.toggle("hidden");
                if (b) b.classList.toggle("open", !isHidden);
            });
        }

        if ($("btn-nhap-gmail-khac")) {
            $("btn-nhap-gmail-khac").addEventListener("click", () => {
                if ($("qmk-email")) {
                    $("qmk-email").value = "";
                    $("qmk-email").focus();
                }
                baoQmk("", "");
            });
        }

        // Bật/tắt form cấu hình Gmail SMTP thật
        if ($("btn-mo-cai-smtp")) {
            $("btn-mo-cai-smtp").addEventListener("click", () => {
                const f = $("qmk-smtp-form");
                if (f) f.classList.toggle("hidden");
            });
        }

        if ($("btn-luu-smtp")) {
            $("btn-luu-smtp").addEventListener("click", async () => {
                const smtpEmail = $("smtp-sender-email") ? $("smtp-sender-email").value.trim() : "";
                const smtpPass = $("smtp-app-pass") ? $("smtp-app-pass").value.trim() : "";
                const msgEl = $("smtp-status-msg");
                if (!smtpEmail || !smtpPass) {
                    if (msgEl) {
                        msgEl.style.color = "#d62424";
                        msgEl.textContent = "Hãy nhập cả địa chỉ Gmail gửi và Mật khẩu ứng dụng 16 ký tự!";
                    }
                    return;
                }
                const nut = $("btn-luu-smtp");
                dangGui(nut, true, "Đang kết nối Gmail SMTP...");
                if (msgEl) {
                    msgEl.style.color = "#2457d6";
                    msgEl.textContent = "Đang đăng nhập smtp.gmail.com và gửi thư...";
                }
                try {
                    const res = await goiApi("/api/forgot-password/smtp-config", {
                        smtp_email: smtpEmail,
                        smtp_password: smtpPass,
                        to_email: QMK.email,
                    });
                    dangGui(nut, false);
                    if (res.success) {
                        if (msgEl) {
                            msgEl.style.color = "#178a5a";
                            msgEl.textContent = "✅ " + res.message;
                        }
                        baoQmk("success", res.message);
                    } else {
                        if (msgEl) {
                            msgEl.style.color = "#d62424";
                            msgEl.textContent = "❌ " + (res.message || "Lỗi cấu hình SMTP");
                        }
                    }
                } catch (err) {
                    dangGui(nut, false);
                    if (msgEl) {
                        msgEl.style.color = "#d62424";
                        msgEl.textContent = "❌ " + err.message;
                    }
                }
            });
        }

        function batDauDemGiay() {
            QMK.giayConLai = 60;
            if ($("btn-gui-lai-otp")) {
                $("btn-gui-lai-otp").disabled = true;
                $("btn-gui-lai-otp").innerHTML = `Gửi lại mã (<span id="qmk-dem-giay">60</span>s)`;
            }
            if (QMK.demGiayTimer) clearInterval(QMK.demGiayTimer);

            QMK.demGiayTimer = setInterval(() => {
                QMK.giayConLai--;
                const demEl = $("qmk-dem-giay");
                if (demEl) demEl.textContent = QMK.giayConLai;
                if (QMK.giayConLai <= 0) {
                    clearInterval(QMK.demGiayTimer);
                    if ($("btn-gui-lai-otp")) {
                        $("btn-gui-lai-otp").disabled = false;
                        $("btn-gui-lai-otp").textContent = "Gửi lại mã ngay";
                    }
                }
            }, 1000);
        }

        if ($("btn-gui-otp")) {
            $("btn-gui-otp").addEventListener("click", () => guiOtpGmail());
        }
        if ($("qmk-email")) {
            $("qmk-email").addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    guiOtpGmail();
                }
            });
        }

        // BƯỚC 2: Xác nhận mã OTP
        async function xacNhanOtp() {
            const otp = $("qmk-otp") ? $("qmk-otp").value.trim() : "";
            if (!otp) {
                baoQmk("error", "Vui lòng nhập mã OTP 6 chữ số!");
                if ($("qmk-otp")) $("qmk-otp").focus();
                return;
            }
            if (otp.length < 6) {
                baoQmk("error", "Mã OTP gồm đủ 6 chữ số!");
                if ($("qmk-otp")) $("qmk-otp").focus();
                return;
            }

            const nut = $("btn-xac-nhan-otp");
            dangGui(nut, true, "Đang xác thực...");
            baoQmk("", "");

            try {
                const res = await goiApi("/api/forgot-password/verify-otp", {
                    email: QMK.email,
                    otp,
                });
                dangGui(nut, false);
                if (!res.success) {
                    baoQmk("error", res.message || "Mã xác thực không chính xác!");
                    return;
                }

                QMK.resetToken = res.reset_token;
                chuyenBuoc(3);
                baoQmk("success", "Xác thực mã OTP thành công! Hãy đặt mật khẩu mới.");
            } catch (err) {
                dangGui(nut, false);
                baoQmk("error", err.message);
            }
        }

        if ($("btn-xac-nhan-otp")) $("btn-xac-nhan-otp").addEventListener("click", xacNhanOtp);
        if ($("qmk-otp")) {
            $("qmk-otp").addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    xacNhanOtp();
                }
            });
            $("qmk-otp").addEventListener("input", (e) => {
                e.target.value = e.target.value.replace(/\D/g, "");
                if (e.target.value.length === 6) {
                    xacNhanOtp();
                }
            });
        }

        if ($("btn-gui-lai-otp")) {
            $("btn-gui-lai-otp").addEventListener("click", () => {
                if (QMK.giayConLai > 0 && $("btn-gui-lai-otp").disabled) return;
                guiOtpGmail(QMK.email);
            });
        }

        document.querySelectorAll('.btn-quay-lai-step[data-to="1"]').forEach((btn) => {
            btn.addEventListener("click", () => {
                chuyenBuoc(1);
            });
        });

        // BƯỚC 3: Đặt mật khẩu mới
        function veDoManhQmk(mk) {
            let m = 0;
            if (mk.length >= 6) m++;
            if (mk.length >= 8 && /[a-z]/.test(mk) && /[A-Z]/.test(mk)) m++;
            if (/\d/.test(mk) && /[a-zA-Z]/.test(mk)) m++;
            if (mk.length >= 10 && /[^a-zA-Z0-9]/.test(mk)) m++;
            if (!mk) m = 0;
            if ($("qmk-mk-manh")) $("qmk-mk-manh").dataset.m = m;
            if ($("qmk-mk-chu")) {
                $("qmk-mk-chu").textContent = !mk
                    ? "Dùng 8 ký tự trở lên, gồm chữ hoa, chữ thường và số để an toàn hơn."
                    : [
                          "Quá ngắn (cần ít nhất 6 ký tự).",
                          "Yếu: hãy thêm chữ và số.",
                          "Trung bình: thêm chữ hoa hoặc dài hơn.",
                          "Khá tốt!",
                          "Mạnh!",
                      ][m];
            }
        }

        if ($("qmk-new-password")) {
            $("qmk-new-password").addEventListener("input", () => {
                veDoManhQmk($("qmk-new-password").value);
            });
        }

        async function hoanTatDoiMk() {
            const newMk = $("qmk-new-password") ? $("qmk-new-password").value : "";
            const confirmMk = $("qmk-confirm-password") ? $("qmk-confirm-password").value : "";

            if (!newMk) {
                baoQmk("error", "Vui lòng nhập mật khẩu mới!");
                if ($("qmk-new-password")) $("qmk-new-password").focus();
                return;
            }
            if (newMk.length < 6) {
                baoQmk("error", "Mật khẩu mới cần ít nhất 6 ký tự!");
                if ($("qmk-new-password")) $("qmk-new-password").focus();
                return;
            }
            if (newMk !== confirmMk) {
                baoQmk("error", "Mật khẩu xác nhận không khớp!");
                if ($("qmk-confirm-password")) $("qmk-confirm-password").focus();
                return;
            }

            const nut = $("btn-doi-mk-xong");
            dangGui(nut, true, "Đang lưu mật khẩu...");
            baoQmk("", "");

            try {
                const res = await goiApi("/api/forgot-password/reset-password", {
                    email: QMK.email,
                    reset_token: QMK.resetToken,
                    new_mk: newMk,
                });
                dangGui(nut, false);
                if (!res.success) {
                    baoQmk("error", res.message || "Không thể đặt lại mật khẩu.");
                    return;
                }

                baoQmk("success", "Đổi mật khẩu thành công! Đang điền vào form đăng nhập...");

                if ($("login-email")) $("login-email").value = QMK.email;
                if ($("login-password")) $("login-password").value = newMk;

                setTimeout(() => {
                    dongModalQmk();
                    baoForm("success", "Đã đổi mật khẩu mới thành công! Nhấn Đăng nhập để vào học ngay.");
                    if ($("btn-login")) $("btn-login").focus();
                }, 1000);
            } catch (err) {
                dangGui(nut, false);
                baoQmk("error", err.message);
            }
        }

        if ($("btn-doi-mk-xong")) $("btn-doi-mk-xong").addEventListener("click", hoanTatDoiMk);
        if ($("qmk-confirm-password")) {
            $("qmk-confirm-password").addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    hoanTatDoiMk();
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modalQmk && !modalQmk.hidden) {
                dongModalQmk();
            }
        });

        // Nếu mở trang với ?forgot=1 hoặc #forgot thì tự động bật modal Quên mật khẩu
        if (q.get("forgot") || location.hash === "#forgot") {
            moModalQmk(q.get("email") || "");
        }

        // Xử lý submit form Đăng nhập
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            anBaoForm();
            const okEmail = kiemEmail();
            const okMk = kiemMk();
            if (!okEmail || !okMk) return;

            const nut = $("btn-login");
            dangGui(nut, true, "Đang đăng nhập...");
            try {
                const emailVal = $("login-email").value.trim();
                const data = await goiApi("/api/login", {
                    email: emailVal,
                    mk: $("login-password").value,
                });
                if (!data.success) {
                    baoForm("error", data.message || "Đăng nhập không thành công.");
                    dangGui(nut, false);
                    return;
                }
                localStorage.setItem("isLoggedIn", "true");
                localStorage.setItem("username", data.user.username);
                localStorage.setItem("userId", data.user.id);
                localStorage.setItem("streak", data.user.streak);
                localStorage.setItem("monChuyen", data.user.mon_chuyen || "");
                localStorage.setItem("avatar", data.user.avatar || "");
                if (data.token) localStorage.setItem("kbToken", data.token);
                luuTaiKhoanMay(data.user.username, emailVal);
                baoForm("success", "Đăng nhập thành công! Đang chuyển trang...");
                const quayLai = sessionStorage.getItem("quayLai");
                sessionStorage.removeItem("quayLai");
                location.href = data.user.can_khao_sat ? "dinh-huong.html" : quayLai || "personal.html";
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
            !v.trim() ? "Hãy nhập hoặc chọn email." : !EMAIL_RE.test(v.trim()) ? "Email chưa đúng dạng (ví dụ: ban@gmail.com)." : ""
        );
        kiemEmailRegFn = kiemEmail;
        const kiemTen = ganKiemTra("reg-username", (v) => {
            const t = v.trim();
            return !t ? "Hãy nhập username." : t.length > 30 ? "Username tối đa 30 ký tự." : "";
        });
        const kiemMk = ganKiemTra("reg-password", (v) =>
            !v ? "Hãy nhập mật khẩu." : v.length < 6 ? "Mật khẩu cần ít nhất 6 ký tự." : ""
        );
        const kiemNhapLai = ganKiemTra("reg-confirm-password", (v) =>
            !v ? "Hãy nhập lại mật khẩu." : v !== $("reg-password").value ? "Mật khẩu nhập lại chưa khớp." : ""
        );

        $("reg-password").addEventListener("input", () => {
            veDoManh($("reg-password").value);
            const o = $("reg-confirm-password");
            if (o.value) {
                const f = o.closest(".field");
                const khop = o.value === $("reg-password").value;
                datTrangThai(f, khop ? "ok" : "loi", khop ? "" : "Mật khẩu nhập lại chưa khớp.");
            }
        });

        function veDoManh(mk) {
            let m = 0;
            if (mk.length >= 6) m++;
            if (mk.length >= 8 && /[a-z]/.test(mk) && /[A-Z]/.test(mk)) m++;
            if (/\d/.test(mk) && /[a-zA-Z]/.test(mk)) m++;
            if (mk.length >= 10 && /[^a-zA-Z0-9]/.test(mk)) m++;
            if (!mk) m = 0;
            const box = $("mk-manh");
            if (box) box.dataset.m = m;
            if ($("mk-chu")) {
                $("mk-chu").textContent = !mk
                    ? "Dùng 8 ký tự trở lên, gồm chữ hoa, chữ thường và số để an toàn hơn."
                    : [
                          "Quá ngắn (cần ít nhất 6 ký tự).",
                          "Yếu: hãy thêm chữ và số.",
                          "Trung bình: thêm chữ hoa hoặc dài hơn.",
                          "Khá tốt!",
                          "Mạnh!",
                      ][m];
            }
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
                const username = $("reg-username").value.trim();
                const data = await goiApi("/api/register", {
                    username,
                    email,
                    mk: $("reg-password").value,
                });
                if (!data.success) {
                    if (/email/i.test(data.message || "")) {
                        datTrangThai($("reg-email").closest(".field"), "loi", data.message);
                    } else {
                        baoForm("error", data.message || "Đăng ký không thành công.");
                    }
                    dangGui(nut, false);
                    return;
                }
                baoForm("success", "Đăng ký thành công! Đang chuyển sang trang đăng nhập...");
                luuTaiKhoanMay(username, email);
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
