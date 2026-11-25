// am-thanh.js - hệ thống hiệu ứng âm thanh Web Audio toàn trang (tự chứa, không cần file mp3)
// Nạp trước bai-tap.js ở form.html hoặc được script.js tự động nạp trên mọi trang.
(function () {
    "use strict";
    if (window.AmThanh) return;

    const KHOA = "amThanhBat";
    let ctx = null;
    let masterOut = null;
    let quayGain = null;
    let lastSfx = 0;

    const doc = () => { try { return localStorage.getItem(KHOA); } catch (e) { return null; } };
    const ghi = (v) => { try { localStorage.setItem(KHOA, v); } catch (e) { /* bỏ qua */ } };
    let bat = doc() !== "0"; // mặc định BẬT

    function lay(taoMoi = true) {
        if (!bat) return null;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            if (!ctx) {
                if (!taoMoi) return null;
                ctx = new AC();
                if (typeof ctx.createDynamicsCompressor === "function") {
                    const comp = ctx.createDynamicsCompressor();
                    comp.threshold.setValueAtTime(-14, ctx.currentTime);
                    comp.knee.setValueAtTime(18, ctx.currentTime);
                    comp.ratio.setValueAtTime(4, ctx.currentTime);
                    comp.attack.setValueAtTime(0.005, ctx.currentTime);
                    comp.release.setValueAtTime(0.12, ctx.currentTime);
                    comp.connect(ctx.destination);
                    masterOut = comp;
                } else {
                    masterOut = ctx.destination;
                }
            }
            if (ctx.state === "suspended") {
                const p = ctx.resume();
                if (p && typeof p.catch === "function") p.catch(() => { });
            }
            return ctx;
        } catch (e) {
            return null;
        }
    }

    // Phát 1 nốt mượt (tránh "bụp" ở đầu/cuối), nối qua DynamicsCompressorNode tránh méo tiếng
    function not(c, tanSo, batDau, dai, kieu = "sine", vol = 0.18, tanSoCuoi = null, dich = null) {
        const t0 = c.currentTime + batDau;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = kieu;
        o.frequency.setValueAtTime(Math.max(40, tanSo), t0);
        if (tanSoCuoi) o.frequency.exponentialRampToValueAtTime(Math.max(40, tanSoCuoi), t0 + dai);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.014, dai * 0.35));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);
        o.connect(g).connect(dich || masterOut || c.destination);
        o.start(t0);
        o.stop(t0 + dai + 0.03);
    }

    const nhac = (n) => 440 * Math.pow(2, (n - 9) / 12); // n = số nửa cung so với C4 (C4 = 0)

    const AmThanh = {
        // Tiếng gõ nút nhẹ toàn UI
        bam() {
            const c = lay(); if (!c) return;
            not(c, 580, 0, 0.045, "triangle", 0.11, 760);
        },
        // Tiếng chuyển tab êm ái
        tab() {
            const c = lay(); if (!c) return;
            not(c, 440, 0, 0.06, "triangle", 0.115);
            not(c, 587, 0.035, 0.06, "sine", 0.105);
        },
        // Mở modal / hộp thoại
        mo() {
            const c = lay(); if (!c) return;
            not(c, 360, 0, 0.09, "sine", 0.14, 620);
        },
        // Đóng modal / hộp thoại
        dong() {
            const c = lay(); if (!c) return;
            not(c, 500, 0, 0.08, "sine", 0.12, 310);
        },
        // Lỗi thao tác nhẹ (2 nốt trầm ngắn)
        loi() {
            const c = lay(); if (!c) return;
            not(c, 195, 0, 0.11, "triangle", 0.19, 175);
            not(c, 160, 0.11, 0.15, "triangle", 0.18, 130);
        },
        // Mở gợi ý / Sổ lỗi sai
        goiY() {
            const c = lay(); if (!c) return;
            not(c, nhac(24), 0, 0.09, "sine", 0.18);       // C6
            not(c, nhac(28), 0.07, 0.16, "sine", 0.18);    // E6
        },
        // Điểm danh thành công (ngày 7 phát fanfare dài hơn)
        diemDanh(laNgay7 = false) {
            const c = lay(); if (!c) return;
            const nots = laNgay7 ? [12, 16, 19, 24, 28] : [12, 16, 19]; // C5 E5 G5 (C6 E6)
            nots.forEach((n, i) => {
                not(c, nhac(n), i * 0.07, 0.18, "triangle", 0.21);
                not(c, nhac(n), i * 0.07, 0.2, "sine", 0.14);
            });
            if (laNgay7) {
                not(c, nhac(28), 0.34, 0.42, "sine", 0.17);
            }
        },
        // Nhận thưởng nhiệm vụ / lưu mục tiêu
        thuong(lon = false) {
            const c = lay(); if (!c) return;
            if (!lon) {
                not(c, nhac(23), 0, 0.07, "sine", 0.2);     // B5
                not(c, nhac(28), 0.06, 0.22, "sine", 0.22);  // E6
                return;
            }
            [12, 16, 19, 23, 24].forEach((n, i) => not(c, nhac(n), i * 0.065, 0.22, "triangle", 0.21));
            not(c, nhac(28), 0.32, 0.4, "sine", 0.19);
        },
        // Mở rương kho báu chương 100%
        ruong() {
            const c = lay(); if (!c) return;
            not(c, 280, 0, 0.18, "sine", 0.16, 840);
            [12, 16, 19, 24, 28, 31].forEach((n, i) => {
                not(c, nhac(n), 0.14 + i * 0.075, 0.34, "triangle", 0.22);
                not(c, nhac(n), 0.14 + i * 0.075, 0.36, "sine", 0.15);
            });
        },
        // Vòng quay may mắn: lên lịch ~28 tiếng tách gỗ chậm dần đều theo ease-out bậc 3
        quay(tongGiay = 4.2) {
            const c = lay(); if (!c) return;
            const mg = c.createGain();
            mg.gain.setValueAtTime(1, c.currentTime);
            mg.connect(masterOut || c.destination);
            quayGain = mg;

            const buoc = 28;
            const ketThuc = Math.max(1.2, tongGiay - 0.15);
            for (let i = 0; i < buoc; i++) {
                const p = i / (buoc - 1);
                const t = ketThuc * (1 - Math.pow(1 - p, 3));
                not(c, 920 - p * 180, t, 0.024, "triangle", 0.13, 600, mg);
            }
        },
        // Kết quả vòng quay (trúng / hụt)
        trungQua(laTrung = true) {
            const c = lay(); if (!c) return;
            if (laTrung) {
                [12, 16, 19, 24, 26, 28].forEach((n, i) => not(c, nhac(n), i * 0.075, 0.32, "triangle", 0.23));
                not(c, nhac(28), 0.44, 0.5, "sine", 0.18);
            } else {
                not(c, nhac(4), 0, 0.18, "triangle", 0.21, nhac(2));
                not(c, nhac(0), 0.16, 0.28, "triangle", 0.19, 190);
            }
        },
        // Xoay la bàn định hướng (~2.8s): 8 nhịp lách cách + sóng gió vũ trụ mềm
        laBan() {
            const c = lay(); if (!c) return;
            not(c, 220, 0, 2.75, "sine", 0.12, 520);
            [0.05, 0.28, 0.54, 0.84, 1.18, 1.56, 2.0, 2.5].forEach((t, i) => {
                not(c, 740 + i * 32, t, 0.032, "triangle", 0.11, 520);
            });
        },
        // Nở 3 chòm sao định hướng (hợp âm pha lê)
        chomSao() {
            const c = lay(); if (!c) return;
            [16, 20, 23, 28, 32, 35].forEach((n, i) => not(c, nhac(n), i * 0.075, 0.38, "sine", 0.2));
        },

        // ---------- API cho form làm bài ----------
        chon() {
            const c = lay(); if (!c) return;
            not(c, 520, 0, 0.07, "triangle", 0.22, 700);
        },
        go() {
            const c = lay(); if (!c) return;
            not(c, 880, 0, 0.05, "square", 0.09);
        },
        xong() {
            const c = lay(); if (!c) return;
            [nhac(12), nhac(16), nhac(19)].forEach((f, i) => not(c, f, i * 0.09, 0.28, "sine", 0.24));
        },
        dung(combo = 0) {
            const c = lay(); if (!c) return;
            const nang = Math.min(combo, 7);
            not(c, nhac(7 + nang), 0, 0.16, "sine", 0.26);
            not(c, nhac(14 + nang), 0.08, 0.3, "sine", 0.24);
        },
        sai() {
            const c = lay(); if (!c) return;
            not(c, 240, 0, 0.28, "triangle", 0.24, 150);
        },
        nop() {
            const c = lay(); if (!c) return;
            not(c, 300, 0, 0.28, "sawtooth", 0.11, 1000);
        },
        hoanThanh(phanTram) {
            const c = lay(); if (!c) return;
            if (phanTram >= 80) {
                [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => not(c, nhac(n + 12), i * 0.1, 0.4, "triangle", 0.24));
                not(c, nhac(36), 0.7, 0.9, "sine", 0.2);
            } else if (phanTram >= 50) {
                [0, 4, 7, 12].forEach((n, i) => not(c, nhac(n + 12), i * 0.13, 0.35, "triangle", 0.22));
            } else {
                [7, 4].forEach((n, i) => not(c, nhac(n + 12), i * 0.2, 0.4, "sine", 0.22));
            }
        },
        dangBat: () => bat,
        batTat() {
            bat = !bat;
            ghi(bat ? "1" : "0");
            if (!bat && quayGain && ctx) {
                try { quayGain.gain.setValueAtTime(0.0001, ctx.currentTime); } catch (e) { /* ignore */ }
            }
            window.dispatchEvent(new CustomEvent("amthanh:doi", { detail: { bat } }));
            if (bat) AmThanh.chon();
            return bat;
        },
    };

    window.AmThanh = AmThanh;

    // ---------- Nút loa bật/tắt âm thanh toàn cục trên #header ----------
    function capNhatNutHeader(btn) {
        if (!btn) return;
        const ico = btn.querySelector("i");
        if (ico) ico.className = bat ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
        btn.classList.toggle("is-muted", !bat);
        btn.setAttribute("aria-pressed", String(bat));
        btn.title = bat ? "Đang bật âm thanh web (bấm để tắt)" : "Đang tắt âm thanh web (bấm để bật)";
        btn.setAttribute("aria-label", btn.title);
    }

    function ganNutHeader() {
        const area = document.querySelector("#header .user-account-area");
        if (!area) return;
        let btn = document.getElementById("btn-am-thanh-global");
        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.id = "btn-am-thanh-global";
            btn.className = "btn-am-thanh-nav";
            btn.innerHTML = '<i class="fa-solid fa-volume-high" aria-hidden="true"></i>';
            area.prepend(btn);
            btn.addEventListener("click", () => AmThanh.batTat());
        }
        capNhatNutHeader(btn);
    }

    window.addEventListener("amthanh:doi", () => capNhatNutHeader(document.getElementById("btn-am-thanh-global")));
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ganNutHeader);
    else ganNutHeader();

    // ---------- Delegated UI click SFX toàn trang (nhẹ, chống spam) ----------
    document.addEventListener("click", (e) => {
        if (!bat) return;
        const now = Date.now();
        if (now - lastSfx < 65) return;

        const t = e.target;
        if (!t || typeof t.closest !== "function") return;
        if (t.closest("#quiz-container, #btn-am-thanh-global, [data-no-sfx], .pl-tong-chest, #daily-btn-claim, #btn-diem-danh, #btn-quay, [data-nhan], #btnChotMucTieu, #sl-kt, .sl-gy")) {
            return;
        }

        if (t.closest(".tab-chinh button, #kb-tabs a, #rk-bang button, #rk-ky button, .pf-tab, .pf-tab-btn, .contest-tab, .pl-chap, .pl-chip, .kb-chip")) {
            lastSfx = now;
            AmThanh.tab();
        } else if (t.closest("#nav a, .u041-tab, .btn, .btn-tour-replay, .tour-btn-next, .nv-nut, .dh-nut-chinh, .dh-nut-phu, .rk-rules-toggle, .sl-btn, .kb-pt-btn, .auth-link, #btn-logout")) {
            lastSfx = now;
            AmThanh.bam();
        }
    });
})();
