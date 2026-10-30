(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  };

  const viTri = { lat: null, lng: null };
  let truong = [];
  let truongChuyenData = {};
  let monChuyenHienTai = "";
  let ST = null; // trạng thái kết quả (để đổi / ghim trường mà không tính lại từ đầu)
  let KY = []; // danh sách kỳ thi + trạng thái mở/khóa

  const KEY_MON = { toan: "Toan", ly: "Ly", hoa: "Hoa" };
  const TEN_MON = { toan: "Toán", ly: "Vật Lý", hoa: "Hóa Học" };
  const ANH = {
    thuong: { thuMuc: "img/school/", tienTo: "" },
    chuyen: { thuMuc: "img/school/", tienTo: "chuyen_" },
  };
  const DUOI_ANH = ["webp"];

  const HESO_DUONG = 1.3;
  const TOC_DO = { xedap: 12, xemay: 30, xebuyt: 22, giadinh: 30 }; // km/giờ (gia đình chở = tốc độ xe máy)
  const TEN_PT = { xedap: "xe đạp", xemay: "xe máy", xebuyt: "xe buýt", giadinh: "xe (gia đình chở)" };
  // Giới hạn phút đi khi KHÔNG ở ký túc xá. Xe đạp chậm nên ràng buộc "gần nhà" chặt hơn.
  const GIOI_HAN_PHUT = { xedap: 30, xemay: 45, xebuyt: 45, giadinh: 45 };

  // ---------- Kỳ thi (bd/kt = [tháng, ngày]) ----------
  const { dm, capNhatKy, khoa: tenKhoa, doc: docDiem } = window.KYTHI;
  const KHOA_LUU = tenKhoa();

  // ---------- Công thức ----------
  function tinhKhoangCach(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dlat = rad(lat2 - lat1);
    const dlon = rad(lon2 - lon1);
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const coToaDo = (t) => t.vi_do !== null && t.kinh_do !== null;
  const laGDTX = (t) => /^(GDTX|Giáo Dục Thường Xuyên)/i.test(t.ten_truong);
  const hopLeDiem = (x) => Number.isFinite(x) && x >= 0 && x <= 10;
  const fmtGio = (p) => (p < 60 ? `${p} phút` : `${Math.floor(p / 60)}g${p % 60 ? String(p % 60).padStart(2, "0") : ""}`);

  // Hàm phân phối chuẩn: dùng để đổi "chênh lệch điểm" thành "xác suất đỗ"
  function erf(x) {
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

  // Dự đoán điểm chuẩn kỳ tuyển sinh sắp tới: trung bình có trọng số 2 năm + độ lệch (sigma)
  function duBao(t, chuyen) {
    const a = t.diem_2026, b = t.diem_2025;
    const coA = Number.isFinite(a), coB = Number.isFinite(b);
    const sMin = chuyen ? 2.5 : 1.5;      // độ lệch tối thiểu
    const sDon = chuyen ? 3.5 : 2.5;      // chỉ có 1 năm dữ liệu -> kém chắc chắn hơn
    const nguongBD = chuyen ? 5 : 3;      // chênh 2 năm từ ngưỡng này = biến động mạnh
    if (coA && coB) {
      const lech = Math.abs(a - b);
      return { du: 0.65 * a + 0.35 * b, sigma: Math.max(sMin, lech * 0.6), nam: 2, bienDong: lech >= nguongBD, a, b };
    }
    if (coA || coB) return { du: coA ? a : b, sigma: sDon, nam: 1, bienDong: false };
    return null;
  }

  function nhanXs(p) {
    if (p >= 0.8) return { ten: "Cao", lop: "cao" };
    if (p >= 0.5) return { ten: "Khá", lop: "kha" };
    if (p >= 0.25) return { ten: "Trung bình", lop: "tb" };
    return { ten: "Thấp", lop: "thap" };
  }

  function canhBao(c) {
    const r = [], d = c.dub;
    if (!d) return r;
    if (d.bienDong) r.push(`Điểm chuẩn trường này biến động mạnh (2025: ${d.b} → 2026: ${d.a}), dự đoán kém chắc chắn.`);
    if (d.nam === 1) r.push("Mới có dữ liệu 1 năm nên độ tin cậy thấp.");
    if (c.phut > 60) r.push("Khá xa nhà, cần tính phương án ở trọ / ký túc xá.");
    return r;
  }

  // ---------- 3 nguyện vọng ----------
  // min/max: khoảng xác suất đỗ của vai trò; dich: xác suất lý tưởng (dùng khi không có trường nào lọt khoảng)
  const VAI_TRO = [
    { ten: "NV1", nhan: "Thử sức", loai: "thusuc", min: 0.25, max: 0.65, dich: 0.45, mota: "Trường mơ ước, cao hơn mức bạn đang đạt một chút." },
    { ten: "NV2", nhan: "Vừa sức", loai: "vuasuc", min: 0.55, max: 0.9, dich: 0.72, mota: "Sát với năng lực hiện tại của bạn." },
    { ten: "NV3", nhan: "An toàn", loai: "antoan", min: 0.85, max: 1.01, dich: 0.95, mota: "Phương án dự phòng chắc chắn." },
  ];

  function khoaUuTien(uuTien) {
    if (uuTien === "gan") return (c) => c.km;
    if (uuTien === "chatluong") return (c) => -c.dub.du;
    return (c) => -c.xs;
  }

  function xepHang(ds, vt, key) {
    const trong = ds.filter((c) => c.xs >= vt.min && c.xs < vt.max).sort((a, b) => key(a) - key(b));
    const ngoai = ds.filter((c) => !(c.xs >= vt.min && c.xs < vt.max))
      .sort((a, b) => Math.abs(a.xs - vt.dich) - Math.abs(b.xs - vt.dich));
    return [...trong, ...ngoai].slice(0, 15);
  }

  // Xếp lại các nguyện vọng chưa ghim (nguyện vọng đã ghim giữ nguyên)
  function xepLai() {
    const dung = new Set(ST.slots.filter((s) => s.ghim && s.t).map((s) => s.t.id));
    ST.slots.forEach((s) => {
      if (s.ghim && s.t) return;
      const t = s.ds.find((c) => !dung.has(c.id));
      if (t) { s.t = t; dung.add(t.id); }
    });
  }

  // Đổi sang ứng viên kế tiếp trong danh sách của nguyện vọng đó
  function doi(i) {
    const s = ST.slots[i];
    if (!s || s.ghim) return;
    const dung = new Set(ST.slots.filter((_, j) => j !== i).map((x) => x.t.id));
    const pos = s.ds.findIndex((c) => c.id === s.t.id);
    for (let k = 1; k <= s.ds.length; k++) {
      const c = s.ds[(pos + k) % s.ds.length];
      if (!dung.has(c.id) && c.id !== s.t.id) { s.t = c; break; }
    }
  }

  // ---------- Lưu môn chuyên ----------
  async function luuMonChuyen(mon) {
    localStorage.setItem("monChuyen", mon);
    const userId = localStorage.getItem("userId");
    if (!userId) return "local";
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}/mon-chuyen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mon_chuyen: mon }),
      });
      const kq = await res.json();
      return kq.success ? "server" : "loi";
    } catch (err) {
      return "loi";
    }
  }

  async function chot() {
    const out = $("ketqua");
    if (out.dataset.dangLuu === "1") return;
    out.dataset.dangLuu = "1";

    localStorage.setItem("nguyenVong", JSON.stringify(ST.slots.map((s) => ({ id: s.t.id, ten: s.t.ten_truong }))));
    if (ST.chuyen) localStorage.setItem("truongChuyen", JSON.stringify({ id: ST.chuyen.chon.id, ten: ST.chuyen.chon.ten_truong }));

    const tb = $("chon-thong-bao");
    tb.hidden = false;
    tb.textContent = "Đang lưu lựa chọn...";
    tb.scrollIntoView({ behavior: "smooth", block: "center" });

    const kq = await luuMonChuyen(monChuyenHienTai);
    const hau = kq === "server" ? "Đã lưu vào tài khoản."
      : kq === "local" ? "Hãy đăng nhập để lưu vào tài khoản."
        : "Chưa lưu được lên server.";
    tb.textContent = `Đã chốt 3 nguyện vọng. ${hau} Đang về trang chủ...`;
    setTimeout(() => { window.location.href = "index.html"; }, 1500);
  }

  // ---------- Bảng điểm các kỳ thi ----------
  function veKyThi() {
    KY = capNhatKy();
    const luu = docDiem();
    const mon = $("mon-chuyen").value;
    const thiC = $("survey-3-specialized_high_school").checked && mon;
    const box = $("ky-thi");
    box.classList.toggle("co-chuyen", !!thiC);

    const cot = ["toan", "van"].concat(thiC ? ["chuyen"] : []);
    const tenCot = { toan: "Toán", van: "Văn", chuyen: thiC ? TEN_MON[mon] : "" };

    let h = `<div class="ky-hang ky-dau"><span>Kỳ</span>${cot.map((m) => `<span>${esc(tenCot[m])}</span>`).join("")}</div>`;
    // Chỉ còn dòng "Cả năm lớp 8" trong khảo sát
    KY.filter((k) => k.luon).forEach((k) => {
      h += `<div class="ky-hang">
      <div class="ky-ten"><b>${k.ten}</b><small>Luôn nhập được (dùng khi chưa có điểm lớp 9)</small></div>
      ${cot.map((m) => {
        const id = `d-${k.id}-${m}`;
        return `<input type="number" step="any" min="0" max="10" id="${id}" placeholder="0-10"
                 aria-label="${k.ten} - ${esc(tenCot[m])}" value="${esc(luu[id] ?? "")}">`;
      }).join("")}
    </div>`;
    });

    // Báo các kỳ lớp 9 đã nhập ở trang Học tập cá nhân hoá
    const daCo = KY.filter((k) => !k.luon && k.mo &&
      ["toan", "van", "chuyen"].some((m) => (luu[`d-${k.id}-${m}`] ?? "") !== ""));
    h += `<p class="form-ghi-chu">${daCo.length ? "Đã có điểm: " + daCo.map((k) => k.ten).join(", ") + ". Hệ thống tự dùng các điểm này. " : ""}
    Điểm các kỳ lớp 9 nhập tại <a href="personal.html#diem" style="color:var(--nhan);font-weight:600">Học tập cá nhân hoá → Điểm số</a>.</p>`;
    box.innerHTML = h;
  }

  // Đọc điểm: { toan:[{w,v}], van:[...], chuyen:[...] }. Ô nào không có trên form thì lấy từ bộ nhớ đã lưu.
  function layDiem() {
    const ds = { toan: [], van: [], chuyen: [] };
    const luu = docDiem();
    KY.forEach((k) => {
      if (!k.mo) return;
      Object.keys(ds).forEach((m) => {
        const id = `d-${k.id}-${m}`;
        const el = $(id);
        const raw = el ? el.value : (luu[id] ?? "");
        if (raw === "") return;
        const v = Number(raw);
        if (!hopLeDiem(v)) throw new Error(`Điểm "${k.ten}" phải nằm trong khoảng 0 đến 10.`);
        ds[m].push({ w: k.w, v });
      });
    });
    return ds;
  }
  // ---------- Nộp form ----------
  function xuLyNop(e) {
    e.preventDefault();
    const out = $("ketqua");

    if (viTri.lat === null) return baoLoi(out, "Cần cho phép lấy vị trí trước khi nộp.");
    if (!truong.length) return baoLoi(out, "Chưa tải được dữ liệu trường.");

    let ds;
    try { ds = layDiem(); } catch (err) { return baoLoi(out, err.message); }
    if (!ds.toan.length || !ds.van.length)
      return baoLoi(out, "Hãy nhập điểm Toán và Văn của ít nhất một kỳ.");

    const toan = trungBinh(ds.toan), van = trungBinh(ds.van);
    const diem = +(toan + van + (toan + van) / 2).toFixed(1);

    const thiChuyen = $("survey-3-specialized_high_school").checked;
    const mon = $("mon-chuyen").value;
    monChuyenHienTai = thiChuyen ? mon : "";
    const dorm = $("survey-4-dorm").checked;
    const chuyenXa = $("chuyen-xa").checked;
    const uuTien = $("uu-tien").value;
    const pt = $("phuong-tien").value;
    const phutDi = (km) => Math.round((km * HESO_DUONG / TOC_DO[pt]) * 60);

    // ----- ứng viên trường thường -----
    const tatCa = truong.map((t) => {
      const km = tinhKhoangCach(viTri.lat, viTri.lng, t.vi_do, t.kinh_do);
      const dub = duBao(t, false);
      return { ...t, km, phut: phutDi(km), dub, xs: dub ? phi((diem - dub.du) / dub.sigma) : null };
    }).filter((c) => c.xs !== null).sort((a, b) => a.km - b.km);

    let ungVien = dorm ? tatCa : tatCa.filter((c) => c.phut <= GIOI_HAN_PHUT[pt]);
    if (ungVien.length < 3) ungVien = tatCa.slice(0, 8); // vùng thưa trường: lấy các trường gần nhất

    const key = khoaUuTien(uuTien);
    const slots = VAI_TRO.map((vt, vi) => ({ vt: vi, ds: xepHang(ungVien, vt, key), t: null, ghim: false }));
    ST = {
      slots, diem, uuTien, pt, dorm, chuyenXa, toan, van, ds,
      gannhatId: (ungVien.filter((c) => c.xs >= 0.5)[0] || {}).id,
      chuyen: null, thongBaoChuyen: "", diemChuyen: null,
    };
    xepLai();
    ST.slots = ST.slots.filter((s) => s.t);

    // ----- trường chuyên -----
    if (thiChuyen) {
      if (!mon) ST.thongBaoChuyen = "Bạn chưa chọn môn chuyên nên chưa gợi ý trường chuyên.";
      else if (!ds.chuyen.length) ST.thongBaoChuyen = `Hãy nhập điểm môn ${TEN_MON[mon]} để gợi ý trường chuyên.`;
      else {
        const ch = trungBinh(ds.chuyen);
        // điểm chuyên = (toán-1) + (văn-1) + (toán+văn)/2 + chuyên*2 - 3
        ST.diemChuyen = +(toan - 1 + (van - 1) + (toan + van) / 2 + ch * 2 - 3).toFixed(1);
        const dsC = (truongChuyenData[KEY_MON[mon]] || []).filter(coToaDo).map((t) => {
          const km = tinhKhoangCach(viTri.lat, viTri.lng, t.vi_do, t.kinh_do);
          const dub = duBao(t, true);
          return { ...t, km, phut: phutDi(km), dub, xs: dub ? phi((ST.diemChuyen - dub.du) / dub.sigma) : null };
        }).sort((a, b) => a.km - b.km);

        if (dsC.length) {
          const gan = dsC[0];
          const tot = [...dsC].sort((a, b) => (b.xs ?? -1) - (a.xs ?? -1))[0];
          // chấp nhận xa: chọn trường dễ đỗ nhất, trừ khi chỉ hơn trường gần nhất rất ít
          const chon = chuyenXa && tot.id !== gan.id && (tot.xs ?? -1) - (gan.xs ?? -1) >= 0.08 ? tot : gan;
          let lyDo = `Điểm xét chuyên ước tính ${ST.diemChuyen}. `;
          if (chon.id === gan.id) lyDo += "Trường chuyên gần nhà bạn nhất.";
          else lyDo += `Khả năng đỗ cao hơn trường gần nhất (${gan.ten_truong}) khoảng ${Math.round((chon.xs - (gan.xs ?? 0)) * 100)}%, đổi lại cách nhà ${chon.km.toFixed(1)} km nên cần ở trọ / ký túc xá.`;
          const goiY = (!chuyenXa && tot.id !== chon.id && (tot.xs ?? -1) - (chon.xs ?? 0) >= 0.15)
            ? `${tot.ten_truong} dễ vào hơn (khả năng đỗ ~${Math.round(tot.xs * 100)}%) nhưng cách nhà ${tot.km.toFixed(1)} km. Nếu bạn chấp nhận học xa, hãy tích ô "chấp nhận học chuyên ở trường xa" rồi nộp lại.` : "";
          ST.chuyen = { ds: dsC, chon, tot, lyDo, goiY };
        }
      }
    }

    ve(true);
  }

  // ---------- Hiển thị ----------
  function baoLoi(out, msg) {
    ST = null;
    out.innerHTML = `<p class="thong-bao">${esc(msg)}</p>`;
  }

  function ganXuLyAnh(out) {
    out.querySelectorAll("img.truong-img").forEach((img) => {
      img.addEventListener("error", () => {
        const i = Number(img.dataset.i) + 1;
        if (i < DUOI_ANH.length) {
          img.dataset.i = i;
          img.src = `${img.dataset.base}.${DUOI_ANH[i]}`;
        } else {
          img.replaceWith(Object.assign(document.createElement("div"), { className: "truong-null", textContent: "null" }));
        }
      });
    });
  }

  function lyDoTruong(c, vt) {
    let s = `${VAI_TRO[vt].mota} Điểm chuẩn dự đoán ${c.dub.du.toFixed(1)}, điểm ước tính của bạn ${ST.diem}.`;
    if (c.id === ST.gannhatId) s += " Gần nhất trong các trường bạn có khả năng đỗ.";
    return s;
  }

  function theHtml(c, o) {
    const ten = esc(c.ten_truong);
    const base = `${o.cfg.thuMuc}${o.cfg.tienTo}${c.id}`;
    const co = c.xs !== null && c.xs !== undefined;
    const n = co ? nhanXs(c.xs) : null;
    const p = co ? Math.round(c.xs * 100) : 0;
    const xs = co
      ? `<div class="truong-xs xs-${n.lop}">
           <div class="xs-nhan"><span>Khả năng đỗ: <b>${n.ten}</b></span><span>~${p}%</span></div>
           <div class="xs-thanh"><i style="width:${p}%"></i></div>
         </div>`
      : `<p class="truong-lydo">Chưa có điểm chuẩn để ước tính khả năng đỗ.</p>`;
    const du = c.dub ? c.dub.du.toFixed(1) : "chưa có";
    return `
      <article class="truong-card truong-card--${o.loai}${o.ghim ? " da-ghim" : ""}" style="--i:${o.i}" tabindex="0">
        <div class="truong-anh">
          <img class="truong-img" src="${base}.${DUOI_ANH[0]}" data-base="${base}" data-i="0" alt="Ảnh ${ten}" loading="lazy">
          <span class="truong-nhan">${esc(o.nhan)}</span>
        </div>
        <div class="truong-noidung">
          <h3>${ten}</h3>
          <p class="truong-km"><i class="fa-solid fa-location-dot"></i>
            Cách nhà <b>${c.km.toFixed(1)} km</b> · khoảng <b>${fmtGio(c.phut)}</b> bằng ${TEN_PT[ST.pt]}</p>
          ${xs}
          <p class="truong-diem">
            <span>Dự đoán <b>${du}</b></span>
            <span>2026 <b>${c.diem_2026 ?? "chưa có"}</b></span>
            <span>2025 <b>${c.diem_2025 ?? "chưa có"}</b></span>
          </p>
          <p class="truong-lydo">${esc(o.lyDo)}</p>
          ${canhBao(c).map((w) => `<p class="canh-bao">⚠ ${esc(w)}</p>`).join("")}
          ${o.hanhDong || ""}
        </div>
      </article>`;
  }

  function chuyenHtml() {
    if (ST.thongBaoChuyen) return `<p class="thong-bao">${esc(ST.thongBaoChuyen)}</p>`;
    const C = ST.chuyen;
    if (!C) return "";
    const xa = C.chon.km > 40
      ? `<p class="canh-bao khoi-canh-bao">⚠ Trường ở xa / có thể khác tỉnh: hãy kiểm tra điều kiện đăng ký dự thi (hộ khẩu, học bạ, hạn nộp hồ sơ) trước khi quyết định.</p>` : "";
    const hang = C.ds.map((c) => {
      const ghiChu = c.id === C.chon.id ? "Đang chọn" : c.id === C.tot.id ? "Dễ vào hơn" : "";
      return `<tr class="${c.id === C.chon.id ? "dang-chon" : ""}">
        <td>${esc(c.ten_truong)}</td>
        <td>${c.km.toFixed(1)} km · ${fmtGio(c.phut)}</td>
        <td>${c.dub ? c.dub.du.toFixed(1) : "—"}</td>
        <td>${c.xs === null ? "—" : `${nhanXs(c.xs).ten} (~${Math.round(c.xs * 100)}%)`}</td>
        <td>${ghiChu}</td></tr>`;
    }).join("");
    return `
      <h2 class="ketqua-tieu-de nho">Trường chuyên môn ${esc(TEN_MON[monChuyenHienTai] || "")}</h2>
      <div class="truong-grid truong-grid--mot">
        ${theHtml(C.chon, { nhan: "Trường chuyên", loai: "chuyen", cfg: ANH.chuyen, i: 0, lyDo: C.lyDo })}
      </div>
      ${xa}
      ${C.goiY ? `<p class="thong-bao">${esc(C.goiY)}</p>` : ""}
      <div class="bang-cuon">
        <table class="so-sanh">
          <thead><tr><th>Trường chuyên</th><th>Đi lại</th><th>Điểm chuẩn dự đoán</th><th>Khả năng đỗ</th><th></th></tr></thead>
          <tbody>${hang}</tbody>
        </table>
      </div>`;
  }

  function ve(animate) {
    const out = $("ketqua");
    const S = ST;
    const xh = textXH("Toán", S.ds.toan) + textXH("Văn", S.ds.van);
    const tomTat = `
      <div class="tom-tat">
        <b>Điểm xét tuyển ước tính: ${S.diem}</b>
        (Toán TB ${S.toan.toFixed(1)}, Văn TB ${S.van.toFixed(1)}${S.diemChuyen !== null ? `, điểm xét chuyên ${S.diemChuyen}` : ""}).
        ${esc(xh)}Ưu tiên của bạn: <b>${{ gan: "gần nhà", chatluong: "chất lượng", antoan: "chắc đỗ" }[S.uuTien]}</b>
        · ${S.dorm ? "có thể ở ký túc xá nên xét cả trường xa" : `chỉ xét trường đi được trong ${GIOI_HAN_PHUT[S.pt]} phút`}.
      </div>`;

    const off = S.chuyen ? 1 : 0;
    const cards = S.slots.map((s, i) => {
      const vt = VAI_TRO[s.vt];
      return theHtml(s.t, {
        nhan: `${vt.ten} · ${vt.nhan}`, loai: vt.loai, cfg: ANH.thuong, i: i + off,
        lyDo: lyDoTruong(s.t, s.vt), ghim: s.ghim,
        hanhDong: `<div class="truong-hanhdong">
          <button type="button" data-act="doi" data-i="${i}" ${s.ghim ? "disabled" : ""}>Đổi trường này</button>
          <button type="button" data-act="ghim" data-i="${i}">${s.ghim ? "Bỏ ghim" : "Ghim"}</button>
        </div>`,
      });
    }).join("");

    const hang = S.slots.map((s) => `
      <tr><td><b>${VAI_TRO[s.vt].ten}</b></td><td>${esc(s.t.ten_truong)}</td>
      <td>${s.t.km.toFixed(1)} km · ${fmtGio(s.t.phut)}</td><td>${s.t.dub.du.toFixed(1)}</td>
      <td>${nhanXs(s.t.xs).ten} (~${Math.round(s.t.xs * 100)}%)</td></tr>`).join("");

    out.dataset.dangLuu = "0";
    out.innerHTML = `
      <div class="ket-qua-khoi${animate ? "" : " khong-anim"}">
        <h2 class="ketqua-tieu-de">Gợi ý dành cho bạn</h2>
        ${tomTat}
        ${chuyenHtml()}
        <h2 class="ketqua-tieu-de nho">3 nguyện vọng trường thường</h2>
        <p class="chon-goi-y">Bấm "Đổi trường này" để xem trường thay thế, "Ghim" để giữ lại trường bạn thích.</p>
        <div class="truong-grid">${cards}</div>
        <div class="bang-cuon">
          <table class="so-sanh">
            <thead><tr><th>NV</th><th>Trường</th><th>Đi lại</th><th>Điểm chuẩn dự đoán</th><th>Khả năng đỗ</th></tr></thead>
            <tbody>${hang}</tbody>
          </table>
        </div>
        <p class="luu-y-nho">Khả năng đỗ chỉ là ước tính từ điểm chuẩn 2 năm gần nhất, không phải cam kết.</p>
        <div class="chot-khung">
          <button type="button" data-act="xep-lai" class="nut-phu">Xếp lại các NV chưa ghim</button>
          <button type="button" data-act="chot" class="nut-chot">Chốt 3 nguyện vọng này</button>
        </div>
        <p id="chon-thong-bao" class="thong-bao" hidden></p>
      </div>`;
    ganXuLyAnh(out);
    if (animate) out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function xuLyBam(e) {
    const nut = e.target.closest("[data-act]");
    if (!nut || !ST) return;
    const act = nut.dataset.act, i = Number(nut.dataset.i);
    if (act === "doi") { doi(i); ve(false); }
    else if (act === "ghim") { ST.slots[i].ghim = !ST.slots[i].ghim; ve(false); }
    else if (act === "xep-lai") { xepLai(); ve(false); }
    else if (act === "chot") chot();
  }

  // ---------- Chuẩn bị giao diện ----------
  function chuanBiGiaoDien() {
    const form = $("input-survey");
    form.querySelectorAll('input[type="checkbox"], select').forEach((el) => (el.required = false));

    if (!document.querySelector(".survey-dau")) {
      const dau = document.createElement("div");
      dau.className = "survey-dau";
      dau.innerHTML = `
        <a class="nut-quay-lai" href="index.html">
          <i class="fa-solid fa-arrow-left"></i><span>Quay lại</span>
        </a>
        <p class="luu-y" role="note">
          <i class="fa-solid fa-circle-info"></i>
          <span><b>Lưu ý:</b> Kết quả chỉ mang tính tham khảo. Khoảng cách tính theo đường chim bay
          rồi quy ra thời gian đi lại. Điểm chuẩn dự đoán là trung bình có trọng số của hai năm gần nhất.</span>
        </p>`;
      form.parentElement.insertBefore(dau, form);
    }

    let kq = $("kq");
    if (!kq) {
      kq = document.createElement("p");
      kq.id = "kq";
      form.insertBefore(kq, form.querySelector('button[type="submit"]'));
    }

    let ketqua = $("ketqua");
    if (!ketqua) {
      ketqua = document.createElement("div");
      ketqua.id = "ketqua";
      ketqua.setAttribute("aria-live", "polite");
      form.insertAdjacentElement("afterend", ketqua);
    }
    ketqua.addEventListener("click", xuLyBam);
  }

  async function taiDuLieu() {
    const res = await fetch("diem_chuan_2026.json");
    const data = await res.json();
    // bỏ trường không có tọa độ và trường GDTX (điểm chuẩn ảo ~1,1)
    truong = data["Dong Thap"].filter(coToaDo).filter((t) => !laGDTX(t));
    truongChuyenData = data["Dong Thap Chuyen"] || {};
  }

  function layViTri() {
    const kq = $("kq");
    if (!navigator.geolocation) { kq.textContent = "Trình duyệt không hỗ trợ định vị."; return; }
    kq.textContent = "Đang lấy vị trí...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        viTri.lat = pos.coords.latitude;
        viTri.lng = pos.coords.longitude;
        kq.textContent = "Đã lấy được vị trí của bạn.";
      },
      (err) => {
        kq.textContent = "Chưa lấy được vị trí (" + err.message + "). Hãy cho phép định vị rồi tải lại trang.";
      },
    );
  }

  // ---------- Hiện/ẩn phần chuyên + lưu điểm ----------
  function ganSuKien() {
    const chk = $("survey-3-specialized_high_school");
    const section = $("chuyen-section");
    const mon = $("mon-chuyen");

    chk.addEventListener("change", () => {
      section.hidden = !chk.checked;
      if (!chk.checked) { mon.value = ""; $("chuyen-xa").checked = false; }
      veKyThi();
    });
    mon.addEventListener("change", veKyThi);

    // mỗi lần gõ điểm là lưu lại ngay (đổi môn chuyên cũng không mất)
    $("ky-thi").addEventListener("input", (e) => {
      if (!e.target.id || !e.target.id.startsWith("d-")) return;
      const d = docDiem();
      d[e.target.id] = e.target.value;
      localStorage.setItem(KHOA_LUU, JSON.stringify(d));
    });

    $("input-survey").addEventListener("reset", () => {
      const d = docDiem();
      Object.keys(d).forEach((k) => { if (k.startsWith("d-l8-")) delete d[k]; }); // chỉ xóa điểm lớp 8
      localStorage.setItem(KHOA_LUU, JSON.stringify(d));
      section.hidden = true;
      $("ketqua").innerHTML = "";
      ST = null;
      setTimeout(veKyThi, 0);
    });
  }

  function khoiDong() {
    chuanBiGiaoDien();
    veKyThi();
    ganSuKien();
    taiDuLieu().catch((e) => { $("kq").textContent = "Không đọc được diem_chuan_2026.json: " + e.message; });
    layViTri();
    $("input-survey").addEventListener("submit", xuLyNop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", khoiDong);
  else khoiDong();
})();