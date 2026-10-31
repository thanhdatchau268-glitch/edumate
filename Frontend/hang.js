// hang.js - 5 hạng thành tích theo % điểm cao nhất của từng bài tập (dùng chung nhiều trang)
// Nạp file này TRƯỚC bai-tap.js / lesson.js

// Xếp từ cao xuống thấp. min = % thấp nhất để đạt hạng đó
window.HANG = [
    { id: "gem", min: 100, nhan: "100%", ten: "Kim cương", icon: "fa-gem", c: "#0891b2" },
    { id: "vang", min: 80, nhan: "80–99%", ten: "Huy chương vàng", icon: "fa-medal", c: "#d99a06" },
    { id: "bac", min: 60, nhan: "60–79%", ten: "Huy chương bạc", icon: "fa-medal", c: "#7b8aa0" },
    { id: "dong", min: 40, nhan: "40–59%", ten: "Huy chương đồng", icon: "fa-medal", c: "#b4531a" },
    { id: "mam", min: 1, nhan: "1–39%", ten: "Mầm xanh", icon: "fa-seedling", c: "#16a34a" },
];

// % điểm -> hạng (null = chưa làm / 0%)
window.hangCua = (p) => HANG.find((h) => p >= h.min) || null;

// hạng kế tiếp phía trên (null = đã ở hạng cao nhất). Chưa có hạng thì trả về hạng thấp nhất
window.hangTren = (h) => (h ? HANG[HANG.indexOf(h) - 1] || null : HANG[HANG.length - 1]);

// Biểu tượng nhỏ của 1 bài tập (HTML), dùng ở danh sách bài học
window.iconHang = (p) => {
    const h = hangCua(p);
    return h
        ? `<span class="hang-mini" style="--c:${h.c}" title="${h.ten} (${p}%)"><i class="fa-solid ${h.icon}"></i></span>`
        : `<span class="hang-mini chua" title="Chưa làm"></span>`;
};

// ---------- Lưu thầm số lượng từng hạng (localStorage) để sau này làm danh hiệu ----------
// Dạng lưu: { toan: {gem:3, vang:1, bac:0, dong:2, mam:1, tong:7}, ngu_van: {...}, cap_nhat: 1730000000000 }
// tienDo = dữ liệu API /api/tien-do/<môn>:  { "chuong-1": { "bai-01": { "1.1": 86, ... } } }
window.luuThongKeHang = (subject, tienDo) => {
    try {
        const uid = localStorage.getItem("userId");
        if (!uid || !tienDo) return;
        const dem = { gem: 0, vang: 0, bac: 0, dong: 0, mam: 0, tong: 0 };
        Object.values(tienDo).forEach((chuong) =>
            Object.values(chuong).forEach((bai) =>
                Object.values(bai).forEach((p) => {
                    const h = hangCua(p);
                    if (h) { dem[h.id]++; dem.tong++; }
                })
            )
        );
        const khoa = "saola_hang_" + uid;
        const cu = JSON.parse(localStorage.getItem(khoa) || "{}");
        cu[subject] = dem;
        cu.cap_nhat = Date.now();
        localStorage.setItem(khoa, JSON.stringify(cu));
    } catch (e) { /* bị chặn lưu thì bỏ qua, không ảnh hưởng trang */ }
};

// Lấy lại thống kê đã lưu (để sau này xài cho danh hiệu): layThongKeHang() -> object hoặc {}
window.layThongKeHang = () => {
    try { return JSON.parse(localStorage.getItem("saola_hang_" + localStorage.getItem("userId")) || "{}"); }
    catch (e) { return {}; }
};