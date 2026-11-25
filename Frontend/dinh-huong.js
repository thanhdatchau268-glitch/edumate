// dinh-huong.js - Đánh giá đầu vào môn chuyên (VnStarL - ML V2 Dual-Head Calibrated MLP)
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const API_BASE = "http://127.0.0.1:5000";

  // 6 đầu điểm chuẩn GDPT 2018 (gộp Lý-Hóa-Sinh -> KHTN và Sử-Địa -> LS&ĐL)
  const MON_DIEM = [
    ["toan", "Toán"],
    ["van", "Văn"],
    ["anh", "Anh"],
    ["khtn", "KHTN"],
    ["lsdl", "LS&ĐL"],
    ["tin", "Tin"]
  ];

  const MON_SUBLABEL = {
    khtn: "(Lý-Hóa-Sinh)",
    lsdl: "(Sử-Địa)"
  };

  const THICH = [
    "Mình thích ngồi giải một bài khó đến khi ra mới thôi",
    "Mình thích đọc, viết và phân tích câu chữ",
    "Mình thích làm thí nghiệm, tìm hiểu vì sao hiện tượng xảy ra",
    "Mình nhớ nhanh sự kiện, số liệu, tên riêng",
    "Mình hay tự học thêm ngoài chương trình",
    "Mình thích lập trình hoặc làm việc với máy tính",
    "Mình thích học ngoại ngữ"
  ];

  const KHTN_PREF_PROMPT = "Trong môn KHTN (Lý – Hóa – Sinh), phân môn nào bạn hứng thú hoặc tự tin nhất?";
  const KHTN_PREF_OPTS = [
    { key: "ly", ten: "Vật Lý", mota: "Cơ học, điện học, quang học & giải bài công thức" },
    { key: "hoa", ten: "Hóa học", mota: "Phản ứng hóa học, chất, bảng tuần hoàn & thí nghiệm" },
    { key: "sinh", ten: "Sinh học", mota: "Tế bào, cơ thể người, di truyền & thế giới tự nhiên" },
    { key: "deu", ten: "Ngang nhau / Không thiên KHTN", mota: "Các phần KHTN bình thường ngang nhau" }
  ];
  const TEN_KHTN_PREF = { ly: "Vật Lý", hoa: "Hóa học", sinh: "Sinh học", deu: "Ngang nhau" };

  const LSDL_PREF_PROMPT = "Trong môn LS&ĐL (Lịch sử – Địa lí), phân môn nào bạn hứng thú hoặc tự tin nhất?";
  const LSDL_PREF_OPTS = [
    { key: "su", ten: "Lịch sử", mota: "Sự kiện, nhân vật, diễn biến lịch sử & phân tích tư liệu" },
    { key: "dia", ten: "Địa lí", mota: "Bản đồ, khí hậu, kinh tế – xã hội & phân tích biểu đồ số liệu" },
    { key: "deu", ten: "Ngang nhau / Không thiên LS&ĐL", mota: "Cả hai phân môn Sử & Địa bình thường ngang nhau", wide: true }
  ];
  const TEN_LSDL_PREF = { su: "Lịch sử", dia: "Địa lí", deu: "Ngang nhau" };

  const Q_KHTN_IDX = THICH.length;       // Câu 8 (index 7)
  const Q_LSDL_IDX = THICH.length + 1;   // Câu 9 (index 8)
  const TONG_CAU = THICH.length + 2;     // Tổng 9 câu

  const MUC_THANG = [
    [1, "Không giống"],
    [2, "Ít giống"],
    [3, "Bình thường"],
    [4, "Khá giống"],
    [5, "Rất giống"]
  ];

  const MAP_MON_KEY = {
    "Toán": "toan", "Văn": "van", "Anh": "anh",
    "Lý": "ly", "Hóa": "hoa", "Sinh": "sinh",
    "Sử": "su", "Địa": "dia", "Tin": "tin",
    "Không học chuyên": ""
  };

  const KHTN_SUBS = ["Lý", "Hóa", "Sinh"];
  const LSDL_SUBS = ["Sử", "Địa"];

  const MON_CHUYEN_OPTS = [
    { mon: "Toán", icon: "fa-square-root-variable", nhom: "Tự nhiên" },
    { mon: "Văn", icon: "fa-feather-pointed", nhom: "Xã hội" },
    { mon: "Anh", icon: "fa-language", nhom: "Ngoại ngữ" },
    { mon: "Lý", icon: "fa-atom", nhom: "KHTN" },
    { mon: "Hóa", icon: "fa-flask-vial", nhom: "KHTN" },
    { mon: "Sinh", icon: "fa-dna", nhom: "KHTN" },
    { mon: "Sử", icon: "fa-landmark", nhom: "LS&ĐL" },
    { mon: "Địa", icon: "fa-earth-asia", nhom: "LS&ĐL" },
    { mon: "Tin", icon: "fa-laptop-code", nhom: "Công nghệ" },
    { mon: "Không học chuyên", icon: "fa-graduation-cap", nhom: "Hệ đại trà" }
  ];

  const S = {
    buoc: 0,
    qIdx: 0,
    diem: {},
    thich: Array(THICH.length).fill(0),
    khtnPref: "",
    lsdlPref: "",
    monMuon: "",
    lastKq: null,
    goiY3: [],
    selectedMon: "",
    autoNextTimer: null
  };

  const panes = [...document.querySelectorAll(".dh-pane")];
  const stepTabs = [...document.querySelectorAll("[data-step-tab]")];

  // ---------- Bước 1: Dựng lưới điểm 6 môn chuẩn GDPT 2018 ----------
  $("luoiDiem").innerHTML = MON_DIEM.map(([k, t]) => `
    <div class="dh-o-diem">
      <label for="d_${k}">${t}${MON_SUBLABEL[k] ? ` <small>${MON_SUBLABEL[k]}</small>` : ""} <span class="req">*</span></label>
      <input type="text" id="d_${k}" inputmode="decimal" placeholder="0-10" aria-required="true">
    </div>
  `).join("");

  function docDiem(danhDauThieu = false) {
    const d = {};
    MON_DIEM.forEach(([k]) => {
      const el = $("d_" + k);
      const raw = el.value.trim();
      if (raw === "") {
        el.classList.toggle("sai", danhDauThieu);
        d[k] = null;
      } else {
        const v = Number(raw.replace(",", "."));
        const hopLe = Number.isFinite(v) && v >= 0 && v <= 10;
        el.classList.toggle("sai", !hopLe);
        d[k] = hopLe ? v : "loi";
      }
    });
    return d;
  }

  function veRadar(svg, d) {
    if (!svg) return;
    const cx = 160, cy = 150, R = 100, n = MON_DIEM.length;
    const goc = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const toaDo = (i, r) => [cx + r * Math.cos(goc(i)), cy + r * Math.sin(goc(i))];
    let h = "";
    [0.25, 0.5, 0.75, 1].forEach((m) => {
      h += `<polygon points="${MON_DIEM.map((_, i) => toaDo(i, R * m).join(",")).join(" ")}" fill="none" stroke="#c7d7f4" stroke-width="1"/>`;
    });
    MON_DIEM.forEach(([, t], i) => {
      const [x, y] = toaDo(i, R);
      const [lx, ly] = toaDo(i, R + 24);
      h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#c7d7f4"/>`;
      h += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#0f2b6b">${esc(t)}</text>`;
    });
    const co = MON_DIEM.map(([k]) => (typeof d[k] === "number" ? d[k] : 0));
    if (co.some((v) => v > 0)) {
      const pts = co.map((v, i) => toaDo(i, (R * v) / 10));
      h += `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="rgba(37, 99, 235, 0.24)" stroke="#2457d6" stroke-width="2.8" stroke-linejoin="round"/>`;
      pts.forEach((p, i) => {
        if (co[i] > 0) h += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fbbf24" stroke="#0f2b6b" stroke-width="2"/>`;
      });
    }
    svg.innerHTML = h;
  }

  function monManhNhat(d) {
    let best = null;
    MON_DIEM.forEach(([k, t]) => {
      if (typeof d[k] === "number" && (best === null || d[k] > best.v)) best = { t, v: d[k] };
    });
    return best;
  }

  function capNhatRadar() {
    const d = docDiem(false);
    veRadar($("radar"), d);
    const daNhap = MON_DIEM.filter(([k]) => typeof d[k] === "number").length;
    const b = monManhNhat(d);
    if (!b) {
      $("radarChu").textContent = "Nhập đủ điểm 6 môn để phác họa biểu đồ năng lực của bạn.";
    } else {
      $("radarChu").innerHTML = `Đã nhập <b>${daNhap}/6 môn</b> · Điểm cao nhất: <b>${esc(b.t)} (${b.v})</b>.`;
    }
  }

  $("luoiDiem").addEventListener("input", () => {
    $("loi").textContent = "";
    capNhatRadar();
  });

  veRadar($("radar"), {});

  // ---------- Bước 2: Thẻ trượt 7 câu sở thích + Câu 8 KHTN + Câu 9 LS&ĐL ----------
  function capNhatNutBuoc2() {
    if (S.buoc !== 1) return;
    const conThieu = S.thich.includes(0) || !S.khtnPref || !S.lsdlPref;
    $("btnTiep").disabled = conThieu;
  }

  function capNhatNutBuoc3() {
    if (S.buoc !== 2) return;
    $("btnTiep").disabled = !S.monMuon;
  }

  function renderChonMon() {
    $("chonMonGrid").innerHTML = MON_CHUYEN_OPTS.map((o) => `
      <button type="button" class="dh-mon-btn" role="radio" aria-checked="${S.monMuon === o.mon}" data-mon="${esc(o.mon)}">
        <span class="dh-mon-ico"><i class="fa-solid ${o.icon}"></i></span>
        <span class="dh-mon-ten">${esc(o.mon === "Không học chuyên" ? "Không học chuyên" : `Chuyên ${o.mon}`)}</span>
        <span class="dh-mon-nhom">${esc(o.nhom)}</span>
      </button>
    `).join("");
    capNhatNutBuoc3();
  }

  $("chonMonGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mon]");
    if (!btn) return;
    S.monMuon = btn.dataset.mon;
    $("loi").textContent = "";
    if (window.AmThanh && window.AmThanh.chon) window.AmThanh.chon();
    renderChonMon();
  });

  function renderCauHoi(idx) {
    S.qIdx = Math.max(0, Math.min(TONG_CAU - 1, idx));
    const q = S.qIdx;
    const laCauKhtn = q === Q_KHTN_IDX;
    const laCauLsdl = q === Q_LSDL_IDX;

    $("qCounter").textContent = `Câu ${q + 1} / ${TONG_CAU}`;
    $("qBarFill").style.width = `${Math.round(((q + 1) / TONG_CAU) * 100)}%`;

    $("qDots").innerHTML = Array.from({ length: TONG_CAU }, (_, i) => {
      const cls = ["dh-q-dot"];
      const answered =
        i < THICH.length ? S.thich[i] > 0 :
        i === Q_KHTN_IDX ? Boolean(S.khtnPref) :
        Boolean(S.lsdlPref);
      if (answered) cls.push("is-answered");
      if (i === q) cls.push("is-current");
      return `<button type="button" class="${cls.join(" ")}" data-qdot="${i}" aria-label="Câu ${i + 1}">${i + 1}</button>`;
    }).join("");

    const scaleEl = $("qScale");
    const hintsEl = $("qHints");
    if (laCauKhtn) {
      $("qPrompt").textContent = `${q + 1}. ${KHTN_PREF_PROMPT}`;
      scaleEl.classList.add("is-khtn-opts");
      if (hintsEl) hintsEl.hidden = true;
      scaleEl.innerHTML = KHTN_PREF_OPTS.map((o) => `
        <button type="button" class="dh-khtn-opt" role="radio" aria-checked="${S.khtnPref === o.key}" data-khtn="${o.key}">
          <span class="dh-khtn-opt-title">${esc(o.ten)}</span>
          <span class="dh-khtn-opt-sub">${esc(o.mota)}</span>
        </button>
      `).join("");
    } else if (laCauLsdl) {
      $("qPrompt").textContent = `${q + 1}. ${LSDL_PREF_PROMPT}`;
      scaleEl.classList.add("is-khtn-opts");
      if (hintsEl) hintsEl.hidden = true;
      scaleEl.innerHTML = LSDL_PREF_OPTS.map((o) => `
        <button type="button" class="dh-khtn-opt${o.wide ? " is-wide" : ""}" role="radio" aria-checked="${S.lsdlPref === o.key}" data-lsdl="${o.key}">
          <span class="dh-khtn-opt-title">${esc(o.ten)}</span>
          <span class="dh-khtn-opt-sub">${esc(o.mota)}</span>
        </button>
      `).join("");
    } else {
      const val = S.thich[q];
      $("qPrompt").textContent = `${q + 1}. ${THICH[q]}`;
      scaleEl.classList.remove("is-khtn-opts");
      if (hintsEl) hintsEl.hidden = false;
      scaleEl.innerHTML = MUC_THANG.map(([v, lbl]) => `
        <button type="button" class="dh-scale-btn" role="radio" aria-checked="${val === v}" data-v="${v}">
          <span class="dh-scale-val">${v}</span>
          <span class="dh-scale-lbl">${lbl}</span>
        </button>
      `).join("");
    }

    $("btnCauTruoc").hidden = q === 0;
    const daTraLoi = S.thich.filter((x) => x > 0).length + (S.khtnPref ? 1 : 0) + (S.lsdlPref ? 1 : 0);
    if (daTraLoi === TONG_CAU) {
      $("qStatus").textContent = `Đã hoàn thành ${daTraLoi}/${TONG_CAU} câu — sẵn sàng chọn môn muốn chuyên!`;
    } else if (laCauLsdl) {
      $("qStatus").textContent = `Đã trả lời ${daTraLoi}/${TONG_CAU} câu · Chọn phân môn LS&ĐL để sang bước tiếp`;
    } else {
      $("qStatus").textContent = `Đã trả lời ${daTraLoi}/${TONG_CAU} câu · Chọn 1 mức để tự chuyển câu tiếp`;
    }

    capNhatNutBuoc2();
  }

  function lenLichChuyenCau(cur) {
    if (S.autoNextTimer) clearTimeout(S.autoNextTimer);
    if (cur < TONG_CAU - 1) {
      S.autoNextTimer = setTimeout(() => {
        S.autoNextTimer = null;
        renderCauHoi(cur + 1);
      }, 260);
    }
  }

  $("qDots").addEventListener("click", (e) => {
    const dot = e.target.closest("[data-qdot]");
    if (!dot) return;
    if (S.autoNextTimer) {
      clearTimeout(S.autoNextTimer);
      S.autoNextTimer = null;
    }
    renderCauHoi(Number(dot.dataset.qdot));
  });

  $("qScale").addEventListener("click", (e) => {
    const khtnBtn = e.target.closest("button[data-khtn]");
    if (khtnBtn) {
      S.khtnPref = khtnBtn.dataset.khtn;
      $("loi").textContent = "";
      if (window.AmThanh && window.AmThanh.chon) window.AmThanh.chon();
      const cur = S.qIdx;
      renderCauHoi(cur);
      lenLichChuyenCau(cur);
      return;
    }
    const lsdlBtn = e.target.closest("button[data-lsdl]");
    if (lsdlBtn) {
      S.lsdlPref = lsdlBtn.dataset.lsdl;
      $("loi").textContent = "";
      if (window.AmThanh && window.AmThanh.chon) window.AmThanh.chon();
      renderCauHoi(S.qIdx);
      return;
    }
    const btn = e.target.closest("button[data-v]");
    if (!btn) return;
    const val = Number(btn.dataset.v);
    const cur = S.qIdx;
    S.thich[cur] = val;
    $("loi").textContent = "";

    $("qScale").querySelectorAll(".dh-scale-btn").forEach((b) => {
      b.setAttribute("aria-checked", String(Number(b.dataset.v) === val));
    });
    renderCauHoi(cur);
    lenLichChuyenCau(cur);
  });

  $("btnCauTruoc").addEventListener("click", () => {
    if (S.autoNextTimer) {
      clearTimeout(S.autoNextTimer);
      S.autoNextTimer = null;
    }
    if (S.qIdx > 0) renderCauHoi(S.qIdx - 1);
  });

  // ---------- Điều hướng & Kiểm tra hợp lệ ----------
  function hienBuoc(chiMuc) {
    if (typeof chiMuc === "number") S.buoc = chiMuc;
    if (S.autoNextTimer) {
      clearTimeout(S.autoNextTimer);
      S.autoNextTimer = null;
    }

    $("dhForm").hidden = false;
    $("dhProgress").hidden = false;
    $("resultPanel").hidden = true;

    panes.forEach((p, i) => p.classList.toggle("is-visible", i === S.buoc));
    stepTabs.forEach((t, i) => {
      t.classList.toggle("is-active", i === S.buoc);
      t.classList.toggle("is-done", i < S.buoc);
    });

    $("btnLui").hidden = S.buoc === 0;
    if (S.buoc === 0) {
      $("btnTiep").innerHTML = `Tiếp tục sang Sở thích <i class="fa-solid fa-arrow-right"></i>`;
      $("btnTiep").disabled = false;
    } else if (S.buoc === 1) {
      $("btnLui").innerHTML = `<i class="fa-solid fa-arrow-left"></i> Sửa lại điểm`;
      $("btnTiep").innerHTML = `Chọn môn muốn chuyên <i class="fa-solid fa-arrow-right"></i>`;
      renderCauHoi(S.qIdx);
    } else {
      $("btnLui").innerHTML = `<i class="fa-solid fa-arrow-left"></i> Xem lại câu trả lời`;
      $("btnTiep").innerHTML = `Xem kết quả đánh giá <i class="fa-solid fa-check"></i>`;
      renderChonMon();
    }
    $("loi").textContent = "";
  }

  function kiemTra(chiBuoc = S.buoc) {
    if (chiBuoc === 0) {
      const d = docDiem(true);
      if (Object.values(d).includes("loi")) {
        return "Điểm các môn phải nằm trong khoảng 0 đến 10.";
      }
      const thieu = MON_DIEM.filter(([k]) => d[k] === null).map(([, ten]) => ten);
      if (thieu.length > 0) {
        return `Vui lòng nhập đủ điểm 6 môn (còn thiếu: ${thieu.join(", ")}).`;
      }
    }
    if (chiBuoc === 1) {
      if (S.thich.includes(0)) {
        const thieuIdx = S.thich.findIndex((x) => x === 0);
        if (thieuIdx >= 0) renderCauHoi(thieuIdx);
        return `Bạn còn câu ${thieuIdx + 1} chưa chọn mức (1–5).`;
      }
      if (!S.khtnPref) {
        renderCauHoi(Q_KHTN_IDX);
        return "Vui lòng chọn phân môn KHTN bạn hứng thú nhất ở câu 8.";
      }
      if (!S.lsdlPref) {
        renderCauHoi(Q_LSDL_IDX);
        return "Vui lòng chọn phân môn LS&ĐL bạn hứng thú nhất ở câu 9.";
      }
    }
    if (chiBuoc === 2 && !S.monMuon) {
      return "Vui lòng chọn môn bạn muốn thi chuyên.";
    }
    return "";
  }

  $("btnLui").addEventListener("click", () => hienBuoc(Math.max(0, S.buoc - 1)));

  $("btnTiep").addEventListener("click", () => {
    const err = kiemTra(S.buoc);
    if (err) {
      $("loi").textContent = err;
      return;
    }
    if (S.buoc === 0) {
      S.diem = docDiem(false);
      hienBuoc(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (S.buoc === 1) {
      hienBuoc(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      chayDuDoan();
    }
  });

  // ---------- Mô hình ML V2 Dual-Head Calibrated MLP (6 môn GDPT 2018 + 48 đặc trưng) ----------
  function computeAlignedInterests(thich, khtnPref, lsdlPref) {
    const u = thich.map((x) => (Number(x) - 1) / 4);
    const [u1, u2, u3, u4, u5, u6, u7] = u;

    const khtnBaseLy = 0.62 * u3 + 0.24 * u1 + 0.14 * u5;
    const khtnBaseHoa = 0.72 * u3 + 0.14 * u1 + 0.14 * u5;
    const khtnBaseSinh = 0.62 * u3 + 0.24 * u4 + 0.14 * u5;

    const modKhtn = (val, key) => {
      if (khtnPref === key) return Math.min(1, val * 0.88 + 0.16);
      if (khtnPref === "ly" || khtnPref === "hoa" || khtnPref === "sinh") return val * 0.56;
      return val;
    };

    const lsdlBaseSu = 0.64 * u4 + 0.24 * u2 + 0.12 * u5;
    const lsdlBaseDia = 0.64 * u4 + 0.24 * u3 + 0.12 * u5;

    const modLsdl = (val, key) => {
      if (lsdlPref === key) return Math.min(1, val * 0.88 + 0.16);
      if (lsdlPref === "su" || lsdlPref === "dia") return val * 0.56;
      return val;
    };

    return {
      "Toán": 0.78 * u1 + 0.14 * u5 + 0.08 * u3,
      "Văn": 0.78 * u2 + 0.14 * u5 + 0.08 * u4,
      "Anh": 0.82 * u7 + 0.12 * u5 + 0.06 * u2,
      "Tin": 0.76 * u6 + 0.14 * u1 + 0.10 * u5,
      "Lý": modKhtn(khtnBaseLy, "ly"),
      "Hóa": modKhtn(khtnBaseHoa, "hoa"),
      "Sinh": modKhtn(khtnBaseSinh, "sinh"),
      "Sử": modLsdl(lsdlBaseSu, "su"),
      "Địa": modLsdl(lsdlBaseDia, "dia")
    };
  }

  function extractFeatures48(d6, thich, khtnPref, lsdlPref) {
    const d = d6.map((v) => Math.max(0, Math.min(10, Number(v))));
    const t = thich.map((v) => Math.max(1, Math.min(5, Number(v))));
    const s = d.map((v) => v / 10);

    const mean6 = d.reduce((a, b) => a + b, 0) / 6;
    const max6 = Math.max(...d);
    const min6 = Math.min(...d);
    const std6 = Math.sqrt(d.reduce((acc, v) => acc + (v - mean6) ** 2, 0) / 6);
    const core3 = (d[0] + d[1] + d[2]) / 3;

    const diffs = d.map((v) => Math.max(-1, Math.min(1, (v - mean6) / 3)));
    const u = t.map((v) => (v - 1) / 4);

    const subjU = [u[0], u[1], u[2], u[3], u[5], u[6]];
    const meanU = subjU.reduce((a, b) => a + b, 0) / 6;
    const maxU = Math.max(...subjU);
    const minU = Math.min(...subjU);
    const stdU = Math.sqrt(subjU.reduce((acc, v) => acc + (v - meanU) ** 2, 0) / 6);

    const pLy = khtnPref === "ly" ? 1 : 0;
    const pHoa = khtnPref === "hoa" ? 1 : 0;
    const pSinh = khtnPref === "sinh" ? 1 : 0;
    const pKhtnDeu = (pLy || pHoa || pSinh) ? 0 : 1;

    const pSu = lsdlPref === "su" ? 1 : 0;
    const pDia = lsdlPref === "dia" ? 1 : 0;
    const pLsdlDeu = (pSu || pDia) ? 0 : 1;

    const ai = computeAlignedInterests(t, khtnPref, lsdlPref);
    const sMap = {
      "Toán": s[0], "Văn": s[1], "Anh": s[2], "Tin": s[5],
      "Lý": s[3], "Hóa": s[3], "Sinh": s[3], "Sử": s[4], "Địa": s[4]
    };
    const syn = ["Toán", "Văn", "Anh", "Tin", "Lý", "Hóa", "Sinh", "Sử", "Địa"].map(
      (m) => Math.sqrt(Math.max(0, sMap[m]) * Math.max(0, ai[m]))
    );

    const lowScoreSig = Math.max(0, Math.min(1, (8.3 - mean6) / 3.5));
    const lowCoreSig = Math.max(0, Math.min(1, (7.6 - core3) / 3.5));
    const lowMotSig = Math.max(0, Math.min(1, 1 - (0.72 * maxU + 0.28 * u[4])));
    const kcSignal = Math.min(1, Math.max(lowScoreSig, lowCoreSig * 0.9, lowMotSig));

    return [
      ...s,
      ...diffs,
      ...u,
      mean6 / 10, max6 / 10, min6 / 10, Math.min(1, std6 / 3), core3 / 10,
      meanU, maxU, minU, Math.min(1, stdU / 0.5),
      pLy, pHoa, pSinh, pKhtnDeu, pSu, pDia, pLsdlDeu,
      ...syn,
      kcSignal,
      u[2] - u[3], u[5] - u[0], u[0] - u[1]
    ];
  }

  function forwardMlpLayers(layers, hIn) {
    let h = hIn;
    for (let li = 0; li < layers.length; li++) {
      const { W, b } = layers[li];
      const outDim = b.length;
      const isLast = li === layers.length - 1;
      const nxt = new Array(outDim);
      for (let j = 0; j < outDim; j++) {
        let sum = b[j];
        for (let i = 0; i < h.length; i++) {
          sum += h[i] * W[i][j];
        }
        nxt[j] = isLast ? sum : Math.tanh(sum);
      }
      h = nxt;
    }
    return h;
  }

  function taoLyDo(mon, d, thich, mean6, khtnPref, lsdlPref) {
    const core3 = (d.toan + d.van + d.anh) / 3;
    const minCore3 = Math.min(d.toan, d.van, d.anh);
    const maxSubjThich = Math.max(thich[0], thich[1], thich[2], thich[3], thich[5], thich[6]);

    const map = {
      "Toán": ["toan", "Toán", 0, "Thích giải bài khó"],
      "Văn": ["van", "Văn", 1, "Thích đọc, viết & phân tích"],
      "Anh": ["anh", "Anh", 6, "Thích học ngoại ngữ"],
      "Tin": ["tin", "Tin", 5, "Thích lập trình & máy tính"],
      "Lý": ["khtn", "KHTN", 2, "Thích thí nghiệm & tìm hiểu hiện tượng"],
      "Hóa": ["khtn", "KHTN", 2, "Thích thí nghiệm & tìm hiểu hiện tượng"],
      "Sinh": ["khtn", "KHTN", 2, "Thích thí nghiệm & tìm hiểu hiện tượng"],
      "Sử": ["lsdl", "LS&ĐL", 3, "Nhớ nhanh sự kiện & số liệu"],
      "Địa": ["lsdl", "LS&ĐL", 3, "Nhớ nhanh số liệu & hiện tượng tự nhiên"]
    };

    if (map[mon]) {
      const [k, tenDiem, tIdx, lbl] = map[mon];
      const val = d[k];
      const diff = val - mean6;
      const res = [
        `Điểm ${tenDiem}: ${val.toFixed(1)} (${diff >= 0 ? "+" : ""}${diff.toFixed(2)} so với TB 6 môn)`,
        `${lbl}: ${thich[tIdx]}/5 · Tự học ngoài giờ: ${thich[4]}/5`
      ];
      if (KHTN_SUBS.includes(mon) && khtnPref && TEN_KHTN_PREF[khtnPref]) {
        res.push(`Thiên hướng KHTN bạn chọn: ${TEN_KHTN_PREF[khtnPref]}`);
      }
      if (LSDL_SUBS.includes(mon) && lsdlPref && TEN_LSDL_PREF[lsdlPref]) {
        res.push(`Thiên hướng LS&ĐL bạn chọn: ${TEN_LSDL_PREF[lsdlPref]}`);
      }
      if (minCore3 < 3.5 || core3 < 5.0) {
        res.push(`Lưu ý: Nền 3 môn cơ sở Toán–Văn–Anh (TB ${core3.toFixed(2)}) đang yếu, rất khó qua ngưỡng tuyển sinh chuyên.`);
      } else if (thich[tIdx] <= 2 && val >= 8.5) {
        res.push(`Điểm ${tenDiem} khá tốt nhưng mức hứng thú (${thich[tIdx]}/5) còn thấp, dễ nản khi học chuyên sâu.`);
      } else if (val < 7.8 && thich[tIdx] >= 4) {
        res.push(`Bạn có hứng thú tốt nhưng điểm ${tenDiem} (${val.toFixed(1)}) cần nâng thêm lên mốc 8.5+ để đủ sức thi chuyên.`);
      }
      return res;
    }

    const kcRes = [
      `Điểm TB 6 môn: ${mean6.toFixed(2)} (TB 3 môn cơ sở Toán–Văn–Anh: ${core3.toFixed(2)})`,
      `Mức hứng thú cao nhất các môn: ${maxSubjThich}/5 · Tự học ngoài giờ: ${thich[4]}/5`
    ];
    if (mean6 >= 8.5 && maxSubjThich <= 2 && thich[4] <= 2) {
      kcRes.push("Học lực tốt nhưng hiện bạn chưa có hứng thú hay động lực tự học chuyên sâu — học hệ đại trà giúp giữ tâm lý thoải mái hơn.");
    } else if (minCore3 < 3.5 || mean6 < 7.5) {
      kcRes.push("Nền tảng điểm hiện tại phù hợp hơn với mục tiêu chắc kiến thức hệ đại trà trước khi đặt áp lực thi chuyên.");
    }
    return kcRes;
  }

  function duDoanMLV2(diemRaw, thich, khtnPref, lsdlPref) {
    const M = window.DH_ML_V2;
    if (!M || !M.head_fit || !M.head_rank) {
      throw new Error("Chưa nạp được tệp trọng số mô hình ML V2 (dinh-huong-model-v2.js).");
    }

    const d = {};
    MON_DIEM.forEach(([k]) => {
      d[k] = typeof diemRaw[k] === "number" ? diemRaw[k] : 0;
    });
    const d6 = [d.toan, d.van, d.anh, d.khtn, d.lsdl, d.tin];
    const mean6 = d6.reduce((a, b) => a + b, 0) / 6;

    const xVec = extractFeatures48(d6, thich, khtnPref, lsdlPref);
    const xScaled = xVec.map((v, i) => (v - M.mean[i]) / M.scale[i]);

    // Head 1: Multi-Label Suitability logits (Temperature-Calibrated Sigmoid)
    const zFit = forwardMlpLayers(M.head_fit, xScaled);
    const T = M.temp_fit || 1.85;

    // Head 2: Multi-Class Relative Ranker (Softmax tie-breaker mượt, chống hòa bảng chữ cái)
    const zRk = forwardMlpLayers(M.head_rank, xScaled);
    const maxZ = Math.max(...zRk);
    const exps = zRk.map((z) => Math.exp((z - maxZ) / 1.5));
    const sumE = exps.reduce((a, b) => a + b, 0) || 1;
    const pRk = exps.map((e) => e / sumE);

    const ai = computeAlignedInterests(thich, khtnPref, lsdlPref);
    const sMap = {
      "Toán": d.toan / 10, "Văn": d.van / 10, "Anh": d.anh / 10, "Tin": d.tin / 10,
      "Lý": d.khtn / 10, "Hóa": d.khtn / 10, "Sinh": d.khtn / 10,
      "Sử": d.lsdl / 10, "Địa": d.lsdl / 10, "Không học chuyên": 0
    };
    const wRk = M.rank_tiebreak_weight ?? 0.45;

    const list = M.classes.map((mon, i) => {
      const zCal = zFit[i] / T + wRk * (pRk[i] - 0.1) + 0.08 * (0.45 * sMap[mon] + 0.55 * (ai[mon] || 0) - 0.5);
      const zClip = Math.max(-25, Math.min(25, zCal));
      const pComb = 1 / (1 + Math.exp(-zClip));
      const fitVal = Math.max(0.01, Math.min(0.985, pComb));
      const fitPct = Math.round(fitVal * 1000) / 10;
      return {
        mon,
        xac_suat: fitPct,
        sort_key: fitVal + 1e-4 * pRk[i],
        ly_do: taoLyDo(mon, d, thich, mean6, khtnPref, lsdlPref)
      };
    }).sort((a, b) => b.sort_key - a.sort_key);

    return {
      yes_threshold: M.yes_threshold || 50,
      top3: list.slice(0, 3),
      tat_ca: list,
      tom_tat: {
        mean_6: Math.round(mean6 * 100) / 100,
        diem_dung: d
      }
    };
  }

  // ---------- Hiển thị kết quả Đánh giá đầu vào (CÓ / KHÔNG) ----------
  function tenHienThi(mon) {
    return mon === "Không học chuyên" ? "Không học chuyên" : `Chuyên ${mon}`;
  }

  function chonMucTieuHienTai(mon, laPhuHop) {
    if (!S.lastKq) return;
    S.selectedMon = mon;
    const item = S.lastKq.tat_ca.find((x) => x.mon === mon);
    if (!item) return;

    $("goiYGrid").querySelectorAll(".dh-goiy-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.goiyMon === mon);
    });

    const ten = tenHienThi(item.mon);
    const daiTra = S.lastKq.tat_ca.find((x) => x.mon === "Không học chuyên");
    const nenDaiTra = !laPhuHop && daiTra && daiTra.xac_suat >= S.lastKq.yes_threshold && item.mon !== "Không học chuyên";
    const rankGoiY = S.goiY3.findIndex((x) => x.mon === item.mon);
    const tag = laPhuHop
      ? `✓ Đạt mức phù hợp (${item.xac_suat}%)`
      : rankGoiY >= 0
        ? `★ Gợi ý Top ${rankGoiY + 1} · Độ phù hợp ${item.xac_suat}%`
        : `Độ phù hợp ${item.xac_suat}%`;

    $("resultDetail").innerHTML = `
      <div class="dh-result-info">
        <span class="dh-result-tag">${esc(tag)}</span>
        <h3>${esc(ten)}</h3>
        <ul class="dh-reasons">
          ${(item.ly_do || []).map((r) => `<li>${esc(r)}</li>`).join("")}
        </ul>
      </div>
      <div class="dh-result-cta-box">
        <button type="button" class="dh-nut-chinh" id="btnChotMucTieu">
          Chọn ${esc(ten)} làm mục tiêu &amp; Tiếp tục <i class="fa-solid fa-arrow-right"></i>
        </button>
        ${nenDaiTra ? `<button type="button" class="dh-nut-phu dh-nut-daitra" id="btnChonDaiTra">Chọn Không học chuyên (${daiTra.xac_suat}% phù hợp)</button>` : ""}
        <span class="dh-save-msg" id="saveMsg" aria-live="polite"></span>
      </div>
    `;

    $("btnChotMucTieu").addEventListener("click", () => chonMucTieu(item.mon));
    const nutDaiTra = $("btnChonDaiTra");
    if (nutDaiTra) {
      nutDaiTra.addEventListener("click", () => chonMucTieu("Không học chuyên"));
    }
  }

  function chayDuDoan() {
    const err = kiemTra(0) || kiemTra(1) || kiemTra(2);
    if (err) {
      $("loi").textContent = err;
      return;
    }

    const diemDung = docDiem(false);
    S.diem = diemDung;

    let kq;
    try {
      kq = duDoanMLV2(diemDung, S.thich, S.khtnPref, S.lsdlPref);
    } catch (e) {
      $("loi").textContent = e.message || "Không thể chạy mô hình đánh giá.";
      return;
    }
    S.lastKq = kq;

    const monMuon = S.monMuon;
    const itemMuon = kq.tat_ca.find((x) => x.mon === monMuon) || kq.tat_ca[0];
    const hangMuon = kq.tat_ca.findIndex((x) => x.mon === monMuon) + 1;
    // Phán quyết CÓ / KHÔNG dựa trực tiếp trên xác suất phù hợp độc lập (Multi-Label Calibrated >= 50%)
    const laPhuHop = itemMuon.xac_suat >= kq.yes_threshold;
    const itemDaiTra = kq.tat_ca.find((x) => x.mon === "Không học chuyên");
    const daiTraUuTien = Boolean(itemDaiTra && itemDaiTra.xac_suat >= kq.yes_threshold);

    $("dhForm").hidden = true;
    $("dhProgress").hidden = true;
    $("resultPanel").hidden = false;
    $("techDetails").open = false;

    const tenMuon = tenHienThi(monMuon);
    const lyDoMuon = (itemMuon.ly_do || []).map((r) => `<li>${esc(r)}</li>`).join("");
    if (laPhuHop) {
      $("verdictBox").innerHTML = `
        <div class="dh-verdict is-yes">
          <div class="dh-verdict-top">
            <span class="dh-verdict-badge">CÓ</span>
            <div>
              <h2>CÓ — Bạn phù hợp với ${esc(tenMuon)}</h2>
              <p>Mô hình đánh giá <strong>${esc(tenMuon)}</strong> đạt mức phù hợp độc lập <strong>${itemMuon.xac_suat}%</strong> (xếp hạng <strong>#${hangMuon}/10</strong> trong hồ sơ của bạn).</p>
            </div>
          </div>
        </div>
      `;
      $("goiYKhung").hidden = true;
      S.goiY3 = [];
      chonMucTieuHienTai(monMuon, true);
      if (window.AmThanh && window.AmThanh.dung) window.AmThanh.dung(1);
    } else {
      const goiY3 = kq.tat_ca.filter((x) => x.mon !== "Không học chuyên").slice(0, 3);
      S.goiY3 = goiY3;
      const moTaPhu = (daiTraUuTien && monMuon !== "Không học chuyên")
        ? `${esc(tenMuon)} hiện chỉ đạt <strong>${itemMuon.xac_suat}%</strong>. Hồ sơ hiện nghiêng mạnh về <strong>Không học chuyên (${itemDaiTra.xac_suat}%)</strong>; nếu bạn vẫn muốn tham khảo hướng chuyên, dưới đây là 3 môn gần nhất:`
        : `${esc(tenMuon)} hiện chỉ đạt <strong>${itemMuon.xac_suat}%</strong> (xếp <strong>#${hangMuon}/10</strong>). Dưới đây là 3 môn chuyên phù hợp nhất với bạn:`;

      $("verdictBox").innerHTML = `
        <div class="dh-verdict is-no">
          <div class="dh-verdict-top">
            <span class="dh-verdict-badge">KHÔNG</span>
            <div>
              <h2>KHÔNG — ${esc(tenMuon)} chưa phù hợp nhất lúc này</h2>
              <p>${moTaPhu}</p>
            </div>
          </div>
          <ul class="dh-verdict-reasons">${lyDoMuon}</ul>
        </div>
      `;

      $("goiYGrid").innerHTML = goiY3.map((item, idx) => `
        <button type="button" class="dh-goiy-card" data-goiy-mon="${esc(item.mon)}">
          <span class="dh-goiy-rank">${idx === 0 ? "🏆 Gợi ý #1" : `★ Gợi ý #${idx + 1}`}</span>
          <span class="dh-goiy-name">${esc(tenHienThi(item.mon))}</span>
          <span class="dh-goiy-pct">${item.xac_suat}% phù hợp</span>
        </button>
      `).join("");
      $("goiYKhung").hidden = false;
      chonMucTieuHienTai(goiY3[0].mon, false);
      if (window.AmThanh && window.AmThanh.chon) window.AmThanh.chon();
    }

    veRadar($("radar2"), kq.tom_tat.diem_dung);
    const b = monManhNhat(kq.tom_tat.diem_dung);
    $("radarChu2").innerHTML = b
      ? `Điểm TB 6 môn: <b>${kq.tom_tat.mean_6}</b> · Cao nhất: <b>${esc(b.t)} (${b.v.toFixed(1)})</b>`
      : `Điểm TB 6 môn: <b>${kq.tom_tat.mean_6}</b>`;

    $("bangTatCa").innerHTML = kq.tat_ca.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${esc(item.mon)}</b></td>
        <td>
          <span class="dh-mini-bar" style="width:${Math.max(4, Math.round(item.xac_suat * 1.05))}px"></span>
          <b>${item.xac_suat}%</b>
        </td>
      </tr>
    `).join("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("goiYGrid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-goiy-mon]");
    if (!card) return;
    if (window.AmThanh && window.AmThanh.chon) window.AmThanh.chon();
    chonMucTieuHienTai(card.dataset.goiyMon, false);
  });

  $("btnSuaLai").addEventListener("click", () => {
    hienBuoc(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- Chốt mục tiêu & Chuyển sang Khảo sát trường ----------
  async function chonMucTieu(monTen) {
    const monKey = Object.prototype.hasOwnProperty.call(MAP_MON_KEY, monTen) ? MAP_MON_KEY[monTen] : "";
    const btn = $("btnChotMucTieu");
    const msg = $("saveMsg");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu mục tiêu...`;
    }

    localStorage.setItem("monChuyen", monKey);
    if (window.KYTHI) {
      const cur = window.KYTHI.doc();
      if (typeof S.diem.toan === "number") cur["d-l8-toan"] = S.diem.toan;
      if (typeof S.diem.van === "number") cur["d-l8-van"] = S.diem.van;
      if (monKey && typeof S.diem[monKey] === "number") {
        cur["d-l8-chuyen"] = S.diem[monKey];
      } else if ((monKey === "ly" || monKey === "hoa" || monKey === "sinh") && typeof S.diem.khtn === "number") {
        cur["d-l8-chuyen"] = S.diem.khtn;
      } else if ((monKey === "su" || monKey === "dia") && typeof S.diem.lsdl === "number") {
        cur["d-l8-chuyen"] = S.diem.lsdl;
      }
      window.KYTHI.luu(cur);
    }
    sessionStorage.setItem("tuDinhHuong", "1");

    const userId = localStorage.getItem("userId");
    if (userId) {
      try {
        const res = await fetch(`${API_BASE}/api/users/${userId}/mon-chuyen`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mon_chuyen: monKey })
        });
        const kq = await res.json();
        if (!res.ok || !kq.success) {
          throw new Error(kq.message || `Lỗi ${res.status}`);
        }
        if (msg) msg.textContent = "Đã lưu vào tài khoản! Đang chuyển sang khảo sát trường...";
        if (window.AmThanh && window.AmThanh.thuong) window.AmThanh.thuong(false);
      } catch (err) {
        if (msg) msg.textContent = `Đã lưu trên máy (${err.message}). Đang chuyển sang khảo sát trường...`;
        if (window.AmThanh && window.AmThanh.thuong) window.AmThanh.thuong(false);
      }
    } else {
      if (msg) msg.textContent = "Đã lưu trên máy! Đang chuyển sang khảo sát trường...";
      if (window.AmThanh && window.AmThanh.thuong) window.AmThanh.thuong(false);
    }

    setTimeout(() => {
      location.href = "khaosat.html";
    }, 350);
  }

  hienBuoc(0);
})();
