// ky-thi.js - định nghĩa kỳ thi + lưu điểm, dùng chung cho khaosat.js và personal.js
window.KYTHI = (() => {
    // bd/kt = [tháng, ngày]. w = trọng số khi tính điểm TB (kỳ càng gần thi càng nặng)
    const KY_THI = [
        { id: "l8", ten: "Cả năm lớp 8", luon: true, w: 1 },
        { id: "gk1", ten: "Giữa kỳ 1", bd: [10, 25], kt: [11, 15], namSau: false, w: 2 },
        { id: "ck1", ten: "Cuối kỳ 1", bd: [12, 15], kt: [12, 31], namSau: false, w: 3 },
        { id: "gk2", ten: "Giữa kỳ 2", bd: [3, 15], kt: [3, 31], namSau: true, w: 4 },
        { id: "ck2", ten: "Cuối kỳ 2", bd: [4, 25], kt: [5, 15], namSau: true, w: 5 },
    ];
    const dm = (d, m) => String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0");

    // Năm học bắt đầu từ tháng 8
    function capNhatKy() {
        const now = new Date();
        const nam = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
        return KY_THI.map((k) => {
            if (k.luon) return { ...k, mo: true };
            const ngayMo = new Date(k.namSau ? nam + 1 : nam, k.bd[0] - 1, k.bd[1]);
            return { ...k, mo: now >= ngayMo };
        });
    }

    const khoa = () => "edumate_diem_" + (localStorage.getItem("userId") || "khach");
    const doc = () => { try { return JSON.parse(localStorage.getItem(khoa()) || "{}"); } catch (e) { return {}; } };
    const luu = (d) => localStorage.setItem(khoa(), JSON.stringify(d));

    return { KY_THI, dm, capNhatKy, khoa, doc, luu };
})();
