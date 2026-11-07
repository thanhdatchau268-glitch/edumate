// khoa-bang.js - trang Bảng vàng khoa bảng (Thi Hương / Thi Hội / Thi Đình)
// Dữ liệu 100% từ API /api/khoa-bang (server tự tính điểm, trình duyệt chỉ hiển thị).
// Cần nạp sau script.js (dùng hàm datAvatar).
(function () {
    "use strict";
    const API = "http://127.0.0.1:5000/api/khoa-bang";
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("kbToken");

    const ICON_CAP = { huong: "fa-feather-pointed", hoi: "fa-landmark", dinh: "fa-crown" };
    const ICON_DH = {
        trang_nguyen: "fa-crown", bang_nhan: "fa-award", tham_hoa: "fa-medal", hoang_giap: "fa-scroll",
        dong_tien_si: "fa-stamp", hoi_nguyen: "fa-landmark", thai_hoc_sinh: "fa-book-open-reader",
        pho_bang: "fa-bookmark", giai_nguyen: "fa-feather-pointed", huong_cong: "fa-pen-nib", sinh_do: "fa-graduation-cap",
    };
    const TAB_CAP = ["huong", "hoi", "dinh"];

    let cauHinh = null;   // { bang:[{id,ten,mon}], cap:[...] }
    let bang = "khong-chuyen";
    let luot = 0;         // chống kết quả cũ ghi đè kết quả mới khi bấm nhanh
    let hen = null;       // bộ đếm ngược

    // ---------- Hàm nhỏ ----------
    async function goi(url, opt) {
        let res;
        try { res = await fetch(API + url, opt); }
        catch (e) { throw new Error("Không kết nối được server. Bật app.py nhé!"); }
        const kq = await res.json();
        if (!kq.success) throw new Error(kq.message || "Có lỗi xảy ra.");
        return kq;
    }
    const ngayVN = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
    const fmt = (x) => Number(x).toFixed(1);
    const tenKy = (cap, ma) => {
        if (cap === "huong") return "Tuần " + ma.split("-W")[1] + "/" + ma.slice(0, 4);
        if (cap === "hoi") return "Tháng " + Number(ma.slice(5)) + "/" + ma.slice(0, 4);
        return "Quý " + ma.slice(-1) + "/" + ma.slice(0, 4);
    };
    const avatar = (ten, lon) => `<img class="kb-av${lon ? " lon" : ""}" data-av="${esc(ten)}" alt="">`;
    function ganAvatar(goc) { goc.querySelectorAll("img[data-av]").forEach((i) => datAvatar(i, i.dataset.av)); }
    const hsLink = (d) => `<a href="#ho-so/${d.user_id}">${esc(d.username)}</a>`;

    function vao(html) {
        const el = $("kb-noi-dung");
        el.innerHTML = html;
        ganAvatar(el);
        return el;
    }

    // ---------- Đếm ngược ----------
    function demNguoc(goc) {
        clearInterval(hen);
        const ds = [...goc.querySelectorAll(".kb-dem[data-giay]")];
        if (!ds.length) return;
        const het = ds.map((e) => Date.now() + Number(e.dataset.giay) * 1000);
        const ve = () => ds.forEach((e, i) => {
            let s = Math.max(0, Math.floor((het[i] - Date.now()) / 1000));
            const d = Math.floor(s / 86400); s -= d * 86400;
            const h = String(Math.floor(s / 3600)).padStart(2, "0"); s %= 3600;
            e.textContent = `Còn ${d} ngày ${h}:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        });
        ve();
        hen = setInterval(ve, 1000);
    }

    // ---------- Bảng xếp hạng ----------
    function bangXh(cap, ds, quyChe) {
        if (!ds.length) return `<p class="kb-trong">Chưa có ai đủ điều kiện xếp hạng ở kỳ này.</p>`;
        const ngan = {};
        quyChe.cach_tinh.forEach((c) => (ngan[c.ma] = c.ngan));
        return `<div class="kb-cuon"><table class="kb-bang-xh">
      <thead><tr><th>Hạng</th><th>Học sinh</th><th>Điểm</th><th class="kb-ct-cot">Thành phần</th><th>Danh hiệu</th></tr></thead>
      <tbody>${ds.map((d) => `
        <tr class="${userId && String(d.user_id) === userId ? "toi" : ""}">
          <td class="hang">${d.hang}</td>
          <td><span class="kb-ten-hs">${avatar(d.avatar)}${hsLink(d)}</span></td>
          <td class="kb-diem">${fmt(d.diem_tong)}</td>
          <td class="kb-ct-cot"><span class="kb-chi-tiet">${Object.keys(ngan).map((k) =>
            d.chi_tiet[k] === undefined ? "" : `<span>${esc(ngan[k])} ${fmt(d.chi_tiet[k])}</span>`).join("")}</span></td>
          <td>${d.danh_hieu ? `<span class="kb-dh${d.tam_tinh ? " du-kien" : ""}">${esc(d.danh_hieu.ten)}</span>` : ""}</td>
        </tr>`).join("")}</tbody></table></div>`;
    }

    // ---------- TAB: Tổng quan ----------
    async function veTongQuan(l) {
        const kq = await goi(`/tong-quan?bang=${encodeURIComponent(bang)}`);
        if (l !== luot) return;
        const the = kq.cap.map((c) => {
            const g = c.nguoi_giu_ngoi;
            return `<article class="kb-the kb-cap">
        <div class="kb-cap-dau"><i class="fa-solid ${ICON_CAP[c.cap]}"></i>
          <div><h2>${esc(c.ten)}</h2><small>${esc(c.chu_ky)} · ${esc(tenKy(c.cap, c.ky.ma))}</small></div></div>
        <div class="kb-dem" data-giay="${c.ky.con_lai_giay}"></div>
        ${g ? `<div class="kb-giu-ngoi">${avatar(g.avatar)}<div><small>${c.tam_tinh ? "Đang dẫn đầu" : "Người giữ ngôi"}</small>
              <b>${hsLink(g)}</b> · <span class="kb-diem">${fmt(g.diem_tong)}</span></div></div>`
                    : `<p class="kb-trong" style="padding:10px">Chưa có ai trên bảng. Hãy là người đầu tiên!</p>`}
        <ul class="kb-mini">${c.top.slice(1).map((d) =>
                        `<li><span>${d.hang}. ${esc(d.username)}</span><b>${fmt(d.diem_tong)}</b></li>`).join("")}</ul>
        <a class="kb-nut" href="#${c.cap}">Xem chi tiết</a>
      </article>`;
        }).join("");

        const noiBat = kq.noi_bat.length
            ? kq.noi_bat.map((n) => `<div class="kb-the" style="margin-bottom:12px">
          <h3>${esc(n.ten)} · ${esc(tenKy(n.cap, n.ma_ky))}</h3>
          <div class="kb-huy-chuong" style="margin-top:8px">${n.ds.map((d) => `
            <div><i class="fa-solid ${ICON_DH[d.ma] || "fa-medal"}"></i>${esc(d.ten)}: ${hsLink(d)}</div>`).join("")}</div></div>`).join("")
            : `<p class="kb-trong kb-the">Chưa có kỳ thi nào được chốt. Danh hiệu đầu tiên sẽ xuất hiện khi kỳ đầu tiên kết thúc.</p>`;

        const el = vao(`<div class="kb-luoi-3">${the}</div>
      <section class="kb-khoi"><h2>Danh hiệu nổi bật</h2>${noiBat}</section>`);
        demNguoc(el);
    }

    // ---------- TAB: chi tiết từng kỳ ----------
    async function veKy(cap, ma, l) {
        const kq = await goi(`/ky/${cap}?bang=${encodeURIComponent(bang)}` + (ma ? `&ma=${encodeURIComponent(ma)}` : ""));
        if (l !== luot) return;
        const ky = kq.ky, q = kq.quy_che, mo = ky.trang_thai === "mo";
        const dsKy = [{ ma: kq.ma_hien_tai, nhan: tenKy(cap, kq.ma_hien_tai) + " (hiện tại)" },
        ...kq.lich_su.filter((h) => h.ma !== kq.ma_hien_tai).map((h) => ({ ma: h.ma, nhan: tenKy(cap, h.ma) }))];
        const bangDs = kq.ds.map((d) => ({ ...d, tam_tinh: kq.tam_tinh }));
        const coThiChinh = cap === "hoi" || cap === "dinh";

        const el = vao(`
      <div class="kb-tieu-ky">
        <h2><i class="fa-solid ${ICON_CAP[cap]}"></i> ${esc(ky.ten)} · ${esc(tenKy(cap, ky.ma))}</h2>
        <select id="kb-chon-ky" class="kb-chon" aria-label="Chọn kỳ">${dsKy.map((k) =>
            `<option value="${esc(k.ma)}"${k.ma === ky.ma ? " selected" : ""}>${esc(k.nhan)}</option>`).join("")}</select>
      </div>
      <div class="kb-the" style="margin-bottom:14px">
        ${ngayVN(ky.bat_dau)} → ${ngayVN(ky.ket_thuc)} ·
        ${mo ? `<span class="kb-dem" data-giay="${ky.con_lai_giay}" style="display:inline-block"></span>` : `<b>Đã chốt kết quả chính thức</b>`}
      
      </div>
      ${kq.tam_tinh ? `<p class="kb-tam-tinh">Bảng xếp hạng đang <b>tạm tính</b>, danh hiệu là <b>dự kiến</b>. Kết quả sẽ được khóa khi kỳ kết thúc. ${esc(q.luu_y)}</p>` : ""}
      ${bangXh(cap, bangDs, q)}
      <p class="kb-ghi" style="margin-top:8px;font-size:.85rem;opacity:.8">Tổng ${kq.tong} thí sinh đủ điều kiện xếp hạng.</p>

      <section class="kb-khoi"><h2>Quy chế</h2>
        <div class="kb-quy-che">
          <div class="kb-the"><h3>Cách tính điểm (${esc(q.chu_ky)})</h3>
            ${q.cach_tinh.map((c) => `<div class="kb-ty-trong"><span>${esc(c.nhan)}</span><b>${c.ty_trong}%</b><i style="width:${c.ty_trong}%"></i></div>`).join("")}
          </div>
          <div class="kb-the"><h3>Điều kiện tham gia</h3><ul>${q.dieu_kien.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="kb-the" style="grid-column:1/-1"><h3>Danh hiệu và phần thưởng</h3>
            <ul class="kb-thuong">${q.danh_hieu.map((d) => `<li><b><i class="fa-solid ${ICON_DH[d.ma] || "fa-medal"}"></i> ${esc(d.ten)}</b>
              <span>+${d.diem_tich_luy} điểm khoa bảng</span><small>${esc(d.giap ? d.giap + " · " : "")}${esc(d.suat)}</small></li>`).join("")}</ul>
            <p style="margin-top:8px;font-size:.88rem">${esc(q.luu_y)} Đồng điểm xét lần lượt: điểm tổng, điểm bài thi chính, độ chính xác, chuyên cần, nộp sớm hơn.</p>
          </div>
        </div></section>

      ${!mo && userId ? `<section class="kb-khoi kb-phuc-khao"><details class="kb-the"><summary><b>Phúc khảo kết quả kỳ này</b></summary>
        <p style="margin-top:8px;font-size:.9rem">Nếu thấy điểm hoặc thứ hạng có sai sót, hãy nêu rõ lý do. Ban quản trị sẽ xem xét.</p>
        <textarea id="kb-pk-nd" rows="3" maxlength="500" placeholder="Nội dung phúc khảo (10 đến 500 ký tự)"></textarea>
        <button type="button" class="kb-nut" id="kb-pk-gui">Gửi phúc khảo</button><p class="kb-tb" id="kb-pk-tb"></p></details></section>` : ""}

      <section class="kb-khoi"><h2>Lịch sử các kỳ trước</h2>
        ${kq.lich_su.length ? `<div class="kb-cuon"><table class="kb-bang-xh"><thead><tr><th>Kỳ</th><th>Thời gian</th><th>Đứng đầu</th><th>Điểm</th><th>Số người</th></tr></thead>
          <tbody>${kq.lich_su.map((h) => `<tr><td><a href="#${cap}/${esc(h.ma)}">${esc(tenKy(cap, h.ma))}</a></td>
            <td>${ngayVN(h.bat_dau)} - ${ngayVN(h.ket_thuc)}</td><td>${esc(h.nguoi_dau || "")}</td>
            <td class="kb-diem">${h.diem_dau == null ? "" : fmt(h.diem_dau)}</td><td>${h.so_nguoi}</td></tr>`).join("")}</tbody></table></div>`
                : `<p class="kb-trong kb-the">Chưa có kỳ nào được chốt.</p>`}</section>`);

        demNguoc(el);
        $("kb-chon-ky").addEventListener("change", (e) => { location.hash = `#${cap}/${e.target.value}`; });
        const gui = $("kb-pk-gui");
        if (gui) gui.addEventListener("click", () => guiPhucKhao(ky.id));
    }

    async function guiPhucKhao(kyId) {
        const tb = $("kb-pk-tb");
        const nd = $("kb-pk-nd").value.trim();
        tb.className = "kb-tb";
        if (!token) { tb.className = "kb-tb loi"; tb.textContent = "Hãy đăng xuất rồi đăng nhập lại để gửi phúc khảo."; return; }
        if (nd.length < 10) { tb.className = "kb-tb loi"; tb.textContent = "Nội dung cần ít nhất 10 ký tự."; return; }
        $("kb-pk-gui").disabled = true;
        try {
            const kq = await goi("/phuc-khao", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                body: JSON.stringify({ ky_id: kyId, noi_dung: nd }),
            });
            tb.className = "kb-tb ok"; tb.textContent = kq.message;
        } catch (err) {
            tb.className = "kb-tb loi"; tb.textContent = err.message;
            $("kb-pk-gui").disabled = false;
        }
    }

    // ---------- TAB: Vinh danh (bảng vàng + hiệu ứng xướng danh) ----------
    let henXuong = [];
    function xuongDanh(sec, nhanh) {
        henXuong.forEach(clearTimeout); henXuong = [];
        const the = [...sec.querySelectorAll(".kb-khoi-the")].sort((a, b) => b.dataset.thu - a.dataset.thu); // Thám hoa -> Trạng nguyên
        const tb = sec.querySelector(".kb-xuong-tb");
        the.forEach((t) => t.classList.remove("hien"));
        sec.classList.remove("da-mo");
        if (nhanh || matchMedia("(prefers-reduced-motion: reduce)").matches) {
            the.forEach((t) => t.classList.add("hien")); sec.classList.add("da-mo"); tb.textContent = ""; return;
        }
        tb.textContent = "🥁 Thùng... thùng... Triều đình xướng danh!";
        the.forEach((t, i) => henXuong.push(setTimeout(() => {
            t.classList.add("hien");
            tb.textContent = `✦ ${t.querySelector("b.dh").textContent}: ${t.querySelector(".ten").textContent} ✦`;
        }, 1100 + i * 1500)));
        henXuong.push(setTimeout(() => { sec.classList.add("da-mo"); tb.textContent = "Bảng vàng đã treo!"; }, 1100 + the.length * 1500));
    }

    async function veVinhDanh(l) {
        const kq = await goi(`/vinh-danh?bang=${encodeURIComponent(bang)}`);
        if (l !== luot) return;
        if (!kq.ds.length) {
            vao(`<p class="kb-trong kb-the">Bảng vàng còn trống. Kỳ Thi Đình đầu tiên chưa kết thúc.<br>
        <a class="kb-nut" style="display:inline-block;margin-top:12px" href="#dinh">Xem Thi Đình hiện tại</a></p>`);
            return;
        }
        const daXem = JSON.parse(localStorage.getItem("kb_da_xem") || "[]");
        const el = vao(kq.ds.map((k) => {
            const tam = k.danh_hieu.filter((d) => ["trang_nguyen", "bang_nhan", "tham_hoa"].includes(d.ma));
            const giap = (ma) => k.danh_hieu.filter((d) => d.ma === ma);
            const nhom = (ma, tieu) => giap(ma).length
                ? `<div class="kb-giap"><h3>${esc(tieu)}</h3><ul>${giap(ma).map((d) => `<li>${hsLink(d)}</li>`).join("")}</ul></div>` : "";
            return `<section class="kb-bv" data-ky="${k.id}">
        <div class="kb-bv-tieu"><small>ĐỆ NHẤT GIÁP · TAM KHÔI</small><h2>Bảng vàng ${esc(tenKy("dinh", k.ma))}</h2></div>
        <p class="kb-xuong-tb" aria-live="polite"></p>
        <ol class="kb-tam-khoi">${tam.map((d) => `<li class="kb-khoi-the" data-thu="${d.thu_tu}">
          <i class="fa-solid ${ICON_DH[d.ma]} bieu"></i><b class="dh">${esc(d.ten)}</b>
          ${avatar(d.avatar, true)}<span class="ten">${esc(d.username)}</span>
          <small>${d.diem == null ? "" : fmt(d.diem) + " điểm"}</small></li>`).join("")}</ol>
        ${nhom("hoang_giap", "ĐỆ NHỊ GIÁP · HOÀNG GIÁP")}${nhom("dong_tien_si", "ĐỆ TAM GIÁP · ĐỒNG TIẾN SĨ XUẤT THÂN")}
        <p style="text-align:center;margin-top:16px"><button type="button" class="kb-nut phu" data-xuong>🔔 Xướng danh lại</button></p>
      </section>`;
        }).join(""));

        // Kỳ mới nhất chưa xem thì công bố có hiệu ứng, còn lại hiện ngay
        el.querySelectorAll(".kb-bv").forEach((sec, i) => {
            const id = Number(sec.dataset.ky);
            const moi = i === 0 && !daXem.includes(id);
            xuongDanh(sec, !moi);
            if (moi) { daXem.push(id); localStorage.setItem("kb_da_xem", JSON.stringify(daXem.slice(-50))); }
            sec.querySelector("[data-xuong]").addEventListener("click", () => xuongDanh(sec, false));
        });
    }

    // ---------- TAB: Hồ sơ khoa bảng ----------
    async function veHoSo(uid, l) {
        if (!uid) {
            vao(`<p class="kb-trong kb-the">Hãy <a href="login.html" style="color:var(--son);font-weight:700">đăng nhập</a> để xem hồ sơ khoa bảng của anh/chị.</p>`);
            return;
        }
        const d = (await goi(`/ho-so/${encodeURIComponent(uid)}`)).data;
        if (l !== luot) return;
        const nhanCap = { huong: "Thi Hương", hoi: "Thi Hội", dinh: "Thi Đình" };
        vao(`
      <section class="kb-the"><div class="kb-ho-so-dau">${avatar(d.user.avatar, true)}
        <div><h2>${esc(d.user.username)}</h2><p>${esc(d.user.bio || "Chưa có giới thiệu")}</p></div></div>
        <div class="kb-chi-so">
          <div><b>${d.cao_nhat ? esc(d.cao_nhat.ten) : "—"}</b><span>Danh hiệu cao nhất</span></div>
          <div><b>${d.tong_danh_hieu}</b><span>Tổng danh hiệu</span></div>
          <div><b>${d.diem_tich_luy}</b><span>Điểm tích lũy khoa bảng</span></div>
          <div><b>${d.hang_tich_luy ? "#" + d.hang_tich_luy : "—"}</b><span>Hạng tích lũy</span></div>
        </div></section>
      <section class="kb-khoi"><h2>Huy chương khoa bảng</h2>
        ${d.dem.length ? `<div class="kb-huy-chuong">${d.dem.map((x) =>
            `<div><i class="fa-solid ${ICON_DH[x.ma] || "fa-medal"}"></i>${esc(x.ten)} <small>×${x.so_lan}</small></div>`).join("")}</div>`
                : `<p class="kb-trong kb-the">Chưa có danh hiệu nào. Hãy tham gia Thi Hương tuần này!</p>`}</section>
      <section class="kb-khoi"><h2>Lịch sử khoa bảng</h2>
        ${d.lich_su.length ? `<div class="kb-cuon"><table class="kb-bang-xh"><thead><tr><th>Kỳ</th><th>Cấp</th><th>Hạng</th><th>Điểm</th><th>Danh hiệu</th></tr></thead>
          <tbody>${d.lich_su.map((h) => `<tr><td>${esc(tenKy(h.cap, h.ma))}</td><td>${nhanCap[h.cap]}</td><td>${h.hang}</td>
            <td class="kb-diem">${fmt(h.diem)}</td><td>${h.danh_hieu ? `<span class="kb-dh">${esc(h.danh_hieu)}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`
                : `<p class="kb-trong kb-the">Chưa tham gia kỳ nào đã chốt kết quả.</p>`}</section>`);
    }

    // ---------- Điều hướng bằng #hash: #tong-quan | #huong/2026-W44 | #ho-so/12 ----------
    function doc() {
        const [tab, tham] = location.hash.slice(1).split("/");
        return { tab: ["tong-quan", ...TAB_CAP, "vinh-danh", "ho-so"].includes(tab) ? tab : "tong-quan", tham: tham ? decodeURIComponent(tham) : "" };
    }

    async function ve() {
        const { tab, tham } = doc();
        const l = ++luot;
        clearInterval(hen);
        document.querySelectorAll("#kb-tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
        $("kb-noi-dung").innerHTML = `<p class="kb-trong">Đang mở bảng vàng...</p>`;
        try {
            if (tab === "tong-quan") await veTongQuan(l);
            else if (TAB_CAP.includes(tab)) await veKy(tab, tham, l);
            else if (tab === "vinh-danh") await veVinhDanh(l);
            else await veHoSo(tham || userId, l);
        } catch (err) {
            if (l === luot) $("kb-noi-dung").innerHTML = `<p class="kb-trong kb-the">${esc(err.message)}</p>`;
        }
    }

    function veNhom() {
        $("kb-bang").innerHTML = cauHinh.bang.map((b) =>
            `<button type="button" class="kb-chip${b.id === bang ? " on" : ""}" data-b="${esc(b.id)}" role="tab" aria-selected="${b.id === bang}">${esc(b.ten)}</button>`).join("");
    }

    async function khoiDong() {
        try { cauHinh = await goi("/cau-hinh"); }
        catch (err) { $("kb-noi-dung").innerHTML = `<p class="kb-trong kb-the">${esc(err.message)}</p>`; return; }
        // Mặc định mở nhóm đúng môn chuyên của anh/chị
        const cuaToi = cauHinh.bang.find((b) => b.mon === (localStorage.getItem("monChuyen") || ""));
        bang = (cuaToi || cauHinh.bang[0]).id;
        veNhom();
        $("kb-bang").addEventListener("click", (e) => {
            const n = e.target.closest("[data-b]");
            if (!n) return;
            bang = n.dataset.b; veNhom(); ve();
        });
        window.addEventListener("hashchange", ve);
        ve();
    }

    khoiDong();
})();