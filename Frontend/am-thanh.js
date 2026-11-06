// am-thanh.js - hiệu ứng âm thanh cho trang làm bài (nạp TRƯỚC bai-tap.js)
// Dùng Web Audio API nên KHÔNG cần file mp3. Trình duyệt chỉ cho phát tiếng sau khi người dùng bấm/chạm,
// nên AudioContext được tạo lười ở lần phát đầu tiên (luôn nằm trong cú bấm của người dùng).
// Dùng: AmThanh.chon() / .dung(combo) / .sai() / .xong() / .nop() / .hoanThanh(phanTram) / .batTat()
(function () {
    const KHOA = "amThanhBat";
    let ctx = null;

    const doc = () => { try { return localStorage.getItem(KHOA); } catch (e) { return null; } };
    const ghi = (v) => { try { localStorage.setItem(KHOA, v); } catch (e) { /* bỏ qua */ } };
    let bat = doc() !== "0"; // mặc định BẬT

    function lay() {
        if (!bat) return null;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            if (!ctx) ctx = new AC();
            if (ctx.state === "suspended") ctx.resume();
            return ctx;
        } catch (e) {
            return null;
        }
    }

    // Phát 1 nốt: tần số, thời điểm bắt đầu (giây, tính từ bây giờ), độ dài, kiểu sóng, âm lượng
    function not(c, tanSo, batDau, dai, kieu = "sine", vol = 0.16, tanSoCuoi = null) {
        const t0 = c.currentTime + batDau;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = kieu;
        o.frequency.setValueAtTime(tanSo, t0);
        if (tanSoCuoi) o.frequency.exponentialRampToValueAtTime(tanSoCuoi, t0 + dai);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);       // vào nhanh cho tiếng "tinh"
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);      // tắt mượt, không bị "bụp"
        o.connect(g).connect(c.destination);
        o.start(t0);
        o.stop(t0 + dai + 0.03);
    }

    const nhac = (n) => 440 * Math.pow(2, (n - 9) / 12); // n = số nửa cung so với nốt Đô giữa (C4 = 0)

    const AmThanh = {
        // Chọn đáp án: tiếng "bóp" nhỏ
        chon() {
            const c = lay(); if (!c) return;
            not(c, 520, 0, 0.07, "triangle", 0.12, 700);
        },
        // Điền xong 1 ô chữ: tiếng "tích"
        go() {
            const c = lay(); if (!c) return;
            not(c, 880, 0, 0.05, "square", 0.04);
        },
        // Trả lời xong hết: tiếng chuông báo sẵn sàng nộp
        xong() {
            const c = lay(); if (!c) return;
            [nhac(12), nhac(16), nhac(19)].forEach((f, i) => not(c, f, i * 0.09, 0.28, "sine", 0.13));
        },
        // Đáp án đúng: "ting-ting", liên tiếp đúng thì cao dần (combo)
        dung(combo = 0) {
            const c = lay(); if (!c) return;
            const nang = Math.min(combo, 7);
            not(c, nhac(7 + nang), 0, 0.16, "sine", 0.17);
            not(c, nhac(14 + nang), 0.08, 0.3, "sine", 0.15);
        },
        // Đáp án sai: tiếng trầm nhẹ, không gắt
        sai() {
            const c = lay(); if (!c) return;
            not(c, 240, 0, 0.28, "triangle", 0.16, 150);
        },
        // Bấm Nộp bài: tiếng "vút"
        nop() {
            const c = lay(); if (!c) return;
            not(c, 300, 0, 0.28, "sawtooth", 0.05, 1000);
        },
        // Kết thúc: càng điểm cao nhạc càng vui
        hoanThanh(phanTram) {
            const c = lay(); if (!c) return;
            if (phanTram >= 80) {
                [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => not(c, nhac(n + 12), i * 0.1, 0.4, "triangle", 0.15));
                not(c, nhac(36), 0.7, 0.9, "sine", 0.12);
            } else if (phanTram >= 50) {
                [0, 4, 7, 12].forEach((n, i) => not(c, nhac(n + 12), i * 0.13, 0.35, "triangle", 0.15));
            } else {
                [7, 4].forEach((n, i) => not(c, nhac(n + 12), i * 0.2, 0.4, "sine", 0.14));
            }
        },
        dangBat: () => bat,
        // Bật/tắt tiếng (nhớ lại cho lần sau). Trả về trạng thái mới.
        batTat() {
            bat = !bat;
            ghi(bat ? "1" : "0");
            if (bat) AmThanh.chon();
            return bat;
        },
    };

    window.AmThanh = AmThanh;
})();