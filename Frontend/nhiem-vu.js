// nhiem-vu.js - thanh "Nhiệm vụ hôm nay"
// Dùng: đặt <div id="nhiem-vu"></div> vào trang, nạp nhiem-vu.css và file này (cần Font Awesome).
(function () {
    const khung = document.getElementById("nhiem-vu");
    const userId = localStorage.getItem("userId");
    if (!khung || !userId) return;   // chưa đăng nhập thì không hiện

    const API = "http://127.0.0.1:5000";
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let dangNhan = false;   // chống bấm nhận 2 lần

    async function tai() {
        try {
            const res = await fetch(`${API}/api/nhiem-vu/${userId}`);
            const kq = await res.json();
            if (!kq.success) throw new Error(kq.message);
            ve(kq.data);
        } catch (err) {
            khung.innerHTML = `<section class="nv-khung"><p class="nv-loi">Không tải được nhiệm vụ. Bật app.py nhé!</p></section>`;
        }
    }

    function theNv(n) {
        const pt = Math.round((n.tien_do / n.muc_tieu) * 100);
        let phai;
        if (n.da_nhan) phai = `<span class="nv-da-nhan"><i class="fa-solid fa-check"></i> Đã nhận</span>`;
        else if (n.xong) phai = `<button type="button" class="nv-nut dac" data-nhan="${esc(n.id)}">Nhận +${n.thuong_diem} điểm</button>`;
        else phai = `<span class="nv-qua">+${n.thuong_diem} điểm</span><a class="nv-nut" href="${esc(n.link)}">Đi làm</a>`;
        return `
      <li class="nv-the kho-${n.kho}${n.da_nhan ? " da-nhan" : ""}">
        <span class="nv-icon"><i class="fa-solid ${esc(n.icon)}"></i></span>
        <div class="nv-giua">
          <b>${esc(n.ten)}</b><span class="nv-kho">${esc(n.ten_kho)}</span>
          <small>${esc(n.mo_ta)}</small>
          <div class="nv-tien" role="progressbar" aria-valuemin="0" aria-valuemax="${n.muc_tieu}" aria-valuenow="${n.tien_do}"
               aria-label="Tiến độ ${esc(n.ten)}"><i style="width:${pt}%"></i></div>
          <span class="nv-so">${n.tien_do}/${n.muc_tieu}</span>
        </div>
        <div class="nv-phai">${phai}</div>
      </li>`;
    }

    function ve(d) {
        const tong = d.ds.length;
        khung.innerHTML = `
      <section class="nv-khung" aria-label="Nhiệm vụ hôm nay">
        <div class="nv-dau">
          <h2>Nhiệm vụ hôm nay</h2>
          <span class="nv-dem">${d.so_da_nhan}/${tong} đã nhận</span>
        </div>
        <ul class="nv-ds">${d.ds.map(theNv).join("")}</ul>
        <p class="nv-du3${d.da_nhan_du_3 ? " xong" : ""}">
          <i class="fa-solid fa-ticket"></i>
          Nhận đủ ${tong} nhiệm vụ: thêm ${d.thuong_du_3.luot_quay} lượt quay${d.da_nhan_du_3 ? " (đã nhận)" : ""}
        </p>
        <p class="nv-tb" id="nv-tb" aria-live="polite"></p>
      </section>`;
    }

    khung.addEventListener("click", async (e) => {
        const nut = e.target.closest("[data-nhan]");
        if (!nut || dangNhan) return;
        dangNhan = true;
        nut.disabled = true;
        try {
            const res = await fetch(`${API}/api/nhiem-vu/nhan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: Number(userId), nv_id: nut.dataset.nhan }),
            });
            const kq = await res.json();
            if (!kq.success) throw new Error(kq.message);
            ve(kq.trang_thai);
            const tb = document.getElementById("nv-tb");
            tb.className = "nv-tb ok";
            tb.textContent = `+${kq.diem} điểm` + (kq.luot_quay_them ? `, và +${kq.luot_quay_them} lượt quay vì đã nhận đủ nhiệm vụ!` : "");
        } catch (err) {
            nut.disabled = false;
            const tb = document.getElementById("nv-tb");
            if (tb) { tb.className = "nv-tb loi"; tb.textContent = err.message; }
        } finally {
            dangNhan = false;
        }
    });

    tai();
    // Quay lại từ trang khác (nút Back / chuyển tab) thì cập nhật tiến độ mới
    window.addEventListener("pageshow", (e) => { if (e.persisted) tai(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tai(); });
})();