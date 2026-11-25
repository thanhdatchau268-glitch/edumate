// so-loi-chung.js - phần dùng chung của Sổ lỗi sai (nạp ở form.html và so-loi.html)
// Dùng: SOLOI.veChanDoan(hopHtml, { the_id } hoặc { bai_key, cau_id }, (idNguyenNhan) => {...})
window.SOLOI = (() => {
    const API = "http://127.0.0.1:5000";

    // Bước 1 của vòng học: học sinh tự nói vì sao mình sai. Lời khuyên đi kèm đổi theo nguyên nhân.
    const NGUYEN_NHAN = [
        { id: "khai_niem", nhan: "Chưa hiểu khái niệm", khuyen: "Hãy mở phần nhắc khái niệm trước, rồi mới làm lại." },
        { id: "tinh_nham", nhan: "Tính nhầm", khuyen: "Hướng làm của bạn có thể đã đúng. Làm lại chậm từng bước, rồi thử thay kết quả vào đề." },
        { id: "doc_sai_de", nhan: "Đọc sai đề", khuyen: "Đọc lại đề, gạch chân điều kiện, đơn vị và yêu cầu cuối cùng." },
        { id: "doan_bua", nhan: "Đoán bừa", khuyen: "Đoán thì khó nhớ lâu. Dùng gợi ý để hiểu vì sao đáp án đúng." },
    ];

    function veChanDoan(hop, body, khiChon) {
        hop.className = "sl-chan-doan";
        hop.innerHTML =
            `<span class="sl-cd-hoi">Vì sao bạn nghĩ mình sai?</span>
       <div class="sl-cd-chip">${NGUYEN_NHAN.map((n) => `<button type="button" data-id="${n.id}">${n.nhan}</button>`).join("")}</div>
       <p class="sl-cd-khuyen"></p>`;

        hop.querySelector(".sl-cd-chip").addEventListener("click", async (e) => {
            const nut = e.target.closest("button");
            if (!nut) return;
            const nn = NGUYEN_NHAN.find((n) => n.id === nut.dataset.id);
            hop.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === nut));
            hop.querySelector(".sl-cd-khuyen").textContent = nn.khuyen;
            try {
                await fetch(`${API}/api/so-loi/chan-doan`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: Number(localStorage.getItem("userId")), ...body, nguyen_nhan: nn.id }),
                });
            } catch (err) { /* lưu hụt thì thôi, lời khuyên vẫn hiện */ }
            if (khiChon) khiChon(nn.id);
        });
    }

    return { NGUYEN_NHAN, veChanDoan };
})();