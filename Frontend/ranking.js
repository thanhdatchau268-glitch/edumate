document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("ranking-list");
  if (!tbody) return; // không phải trang xếp hạng thì thôi

  const API = "http://127.0.0.1:5000";
  const $ = (id) => document.getElementById(id);
  const userId = localStorage.getItem("userId");
  const monCuaToi = (localStorage.getItem("monChuyen") || "").trim().toLowerCase();

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let cauHinh = null; // { bang:[{id,ten,mon}], ky:[{id,ten}], thang }
  let bang = null;    // id bảng đang xem
  let ky = "tong";    // id kỳ đang xem
  let luot = 0;       // chống kết quả cũ ghi đè kết quả mới khi bấm nhanh

  const btnToggleRules = $("btn-toggle-rules");
  const rulesDrawer = $("rk-rules-drawer");
  if (btnToggleRules && rulesDrawer) {
    btnToggleRules.addEventListener("click", () => {
      const willOpen = rulesDrawer.hasAttribute("hidden");
      if (willOpen) {
        rulesDrawer.removeAttribute("hidden");
      } else {
        rulesDrawer.setAttribute("hidden", "");
      }
      btnToggleRules.setAttribute("aria-expanded", String(willOpen));
      btnToggleRules.classList.toggle("is-open", willOpen);
    });
  }

  const LOI_CHUC_MAC_DINH = '"Cố lên nhé! Chỉ cần thêm một chút nỗ lực là bạn sẽ chạm tay vào Cúp Vàng!"';

  function baoDong(chu) {
    tbody.innerHTML = `<tr class="rk-trong-row"><td colspan="4" class="rk-trong"></td></tr>`;
    tbody.querySelector("td").textContent = chu;
  }

  function bocKhungPodium(the, imgEl, huyHieuId, hang) {
    if (!the || !imgEl) return;
    const sizeCls = hang === 1 ? "hh-podium-gold" : "hh-podium-sub";
    const coKhung = Boolean(
      window.HUY_HIEU_KHUNG &&
        huyHieuId &&
        window.HUY_HIEU_KHUNG.layThongTinKhung(huyHieuId),
    );
    the.classList.toggle("co-khung-card", coKhung);
    if (window.HUY_HIEU_KHUNG) {
      window.HUY_HIEU_KHUNG.bocKhungAvatar(imgEl, huyHieuId || "", {
        sizeClass: sizeCls,
      });
    }
  }

  function taoKhungAvatarHtml(avatarSrc, huyHieuId, sizeClass, alt) {
    if (window.HUY_HIEU_KHUNG) {
      return window.HUY_HIEU_KHUNG.taoKhungAvatar(
        avatarSrc,
        huyHieuId,
        sizeClass,
        { alt },
      );
    }
    const src = typeof duongDanAvatar === "function" ? duongDanAvatar(avatarSrc) : "img/avartar.webp";
    return `<img class="rk-av-fallback" src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy" decoding="async">`;
  }

  function taoDongXepHang(hang, u, laToi) {
    const tr = document.createElement("tr");
    if (laToi) tr.className = "rk-toi";

    const tdHang = document.createElement("td");
    tdHang.textContent = hang;

    const tdUser = document.createElement("td");
    const cell = document.createElement("div");
    cell.className = "rk-user-cell";
    cell.innerHTML = taoKhungAvatarHtml(u.avatar, u.huy_hieu, "hh-sm", u.username);
    const nameSpan = document.createElement("span");
    nameSpan.className = "rk-user-name";
    nameSpan.textContent = u.username;
    cell.appendChild(nameSpan);
    tdUser.appendChild(cell);

    const tdBio = document.createElement("td");
    tdBio.textContent = u.bio || "";

    const tdScore = document.createElement("td");
    tdScore.textContent = u.score;

    tr.append(tdHang, tdUser, tdBio, tdScore);
    return tr;
  }

  function datLaiThanhTich() {
    const myRankNumEl = $("my-standing-rank");
    const myAvEl = $("my-standing-avatar");
    const myNameEl = $("my-standing-name");
    const myPtsEl = $("my-pts-val");
    const myGapTextEl = $("my-gap-text");
    const myGapFillEl = $("my-gap-fill");
    const speechEl = $("mascot-speech-text");

    if (myRankNumEl) myRankNumEl.textContent = "--";
    if (myAvEl) myAvEl.innerHTML = "";
    if (myNameEl) {
      myNameEl.textContent = userId
        ? (localStorage.getItem("username") || "Bạn")
        : "Chưa đăng nhập";
    }
    if (myPtsEl) myPtsEl.textContent = "0";
    if (myGapTextEl) myGapTextEl.innerHTML = 'Cách Top 1: <b id="my-gap-val">--</b>';
    if (myGapFillEl) myGapFillEl.style.width = "0%";
    if (speechEl) speechEl.textContent = LOI_CHUC_MAC_DINH;
  }

  // Xóa sạch bục để đổi bảng không còn dư người của bảng trước
  function xoaBuc() {
    [1, 2, 3].forEach((h) => {
      const the = $(`podium-${h}`);
      if (!the) return;
      const nameEl = the.querySelector(".podium-name");
      if (nameEl) nameEl.innerHTML = "";
      const avEl = the.querySelector(".avatar");
      datAvatar(avEl, ""); // hàm nằm trong script.js
      bocKhungPodium(the, avEl, "", h);
    });
    const sb = $("rk-my-sticky");
    if (sb) sb.classList.add("hidden");
    datLaiThanhTich();
  }

  function veTab() {
    $("rk-bang").innerHTML = "";
    cauHinh.bang.forEach((b) => {
      const n = document.createElement("button");
      n.type = "button";
      n.className = "rk-chip" + (b.id === bang ? " on" : "");
      n.textContent = b.ten;
      n.setAttribute("role", "tab");
      n.setAttribute("aria-selected", b.id === bang);
      n.addEventListener("click", () => { bang = b.id; veTab(); taiBang(); });
      $("rk-bang").appendChild(n);
    });

    $("rk-ky").innerHTML = "";
    cauHinh.ky.forEach((k) => {
      const n = document.createElement("button");
      n.type = "button";
      n.className = k.id === ky ? "on" : "";
      n.textContent = k.ten;
      n.setAttribute("role", "tab");
      n.setAttribute("aria-selected", k.id === ky);
      n.addEventListener("click", () => { ky = k.id; veTab(); taiBang(); });
      $("rk-ky").appendChild(n);
    });

    // Dòng ghi chú cho biết đang xem bảng nào
    const tenBang = cauHinh.bang.find((b) => b.id === bang).ten;
    const [nam, thang] = cauHinh.thang.split("-");
    $("rk-ghi").textContent = ky === "thang"
      ? `${tenBang} · điểm tích lũy trong tháng ${Number(thang)}/${nam}, sang tháng mới tính lại từ đầu.`
      : `${tenBang} · tổng điểm từ trước đến nay.`;

    const heroEl = document.querySelector(".rk-center-hero");
    if (heroEl) heroEl.classList.toggle("is-monthly", ky === "thang");
  }

  async function taiBang() {
    const l = ++luot;
    xoaBuc();
    baoDong("Đang tải...");
    try {
      const uq = userId ? `&user_id=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`${API}/api/ranking?bang=${encodeURIComponent(bang)}&ky=${encodeURIComponent(ky)}${uq}`);
      const kq = await res.json();
      if (l !== luot) return; // đã bấm sang bảng khác
      if (!kq.success) throw new Error(kq.message);

      if (!Array.isArray(kq.data) || kq.data.length === 0) {
        datLaiThanhTich();
        baoDong("Chưa có ai trên bảng xếp hạng này.");
        return;
      }

      // 3 người đầu lên bục Podium 2.0
      [1, 2, 3].forEach((hang) => {
        const u = kq.data[hang - 1];
        const the = $(`podium-${hang}`);
        if (!the) return;
        const nameEl = the.querySelector(".podium-name");
        const avEl = the.querySelector(".avatar");
        if (!u) {
          if (nameEl) nameEl.innerHTML = `<span class="rk-p-name">Trống</span>`;
          datAvatar(avEl, "");
          bocKhungPodium(the, avEl, "", hang);
          return;
        }
        if (nameEl) {
          nameEl.innerHTML = `
            <span class="rk-p-name">${esc(u.username)}</span>
            <span class="rk-p-pill">${Number(u.score).toLocaleString()} đ</span>
          `;
        }
        datAvatar(avEl, u.avatar);
        bocKhungPodium(the, avEl, u.huy_hieu || "", hang);
      });

      // Mỗi người = 1 dòng: Hạng, Sĩ tử (avatar + khung + username), Giới thiệu, Điểm
      tbody.innerHTML = "";
      kq.data.forEach((u, i) => {
        const laToi = Boolean(userId && String(u.id) === userId);
        tbody.appendChild(taoDongXepHang(i + 1, u, laToi));
      });
      // Bạn nằm ngoài top 20: hiện thêm dòng của bạn ngay dưới bảng
      if (kq.me) {
        const cach = document.createElement("tr");
        cach.innerHTML = `<td colspan="4" class="rk-cach">⋯</td>`;
        tbody.appendChild(cach);
        tbody.appendChild(taoDongXepHang(kq.me.hang, kq.me, true));
      }

      // Render thanh ghim Vị trí của tôi sát đáy màn hình (Mobile Sticky)
      const stickyBox = $("rk-my-sticky");
      const myData = kq.me || kq.data.find((u) => userId && String(u.id) === String(userId));
      const top1 = kq.data[0];

      if (stickyBox) {
        if (myData && userId) {
          const hangCuaToi = myData.hang || (kq.data.indexOf(myData) + 1);
          stickyBox.classList.remove("hidden");
          stickyBox.innerHTML = `
            <div class="rk-sticky-inner">
              <div class="rk-sticky-left">
                <span class="rk-sticky-rank">#${hangCuaToi}</span>
                ${taoKhungAvatarHtml(myData.avatar, myData.huy_hieu, "hh-xs", myData.username)}
                <span class="rk-sticky-name">${esc(myData.username)} (Bạn)</span>
              </div>
              <div class="rk-sticky-right">
                <span class="rk-sticky-score">${Number(myData.score).toLocaleString()} đ</span>
              </div>
            </div>
          `;
        } else {
          stickyBox.classList.add("hidden");
        }
      }

      // Cập nhật thanh Vị trí của bạn
      const myRankNumEl = $("my-standing-rank");
      const myAvEl = $("my-standing-avatar");
      const myNameEl = $("my-standing-name");
      const myPtsEl = $("my-pts-val");
      const myGapTextEl = $("my-gap-text");
      const myGapFillEl = $("my-gap-fill");
      const speechEl = $("mascot-speech-text");

      if (myData && userId) {
        const hangCuaToi = myData.hang || (kq.data.indexOf(myData) + 1);
        if (myRankNumEl) myRankNumEl.textContent = `#${hangCuaToi}`;
        if (myAvEl) {
          myAvEl.innerHTML = taoKhungAvatarHtml(
            myData.avatar,
            myData.huy_hieu,
            "hh-xs",
            myData.username,
          );
        }
        if (myNameEl) myNameEl.textContent = myData.username || "Bạn";
        if (myPtsEl) myPtsEl.textContent = Number(myData.score || 0).toLocaleString();

        if (top1 && top1.score != null) {
          const top1Score = Number(top1.score);
          const myScore = Number(myData.score || 0);
          const gap = Math.max(0, top1Score - myScore);
          const top2 = kq.data[1];
          if (myGapTextEl) {
            if (hangCuaToi === 1) {
              if (top2 && top2.score != null) {
                const gapTop2 = Math.max(0, top1Score - Number(top2.score));
                myGapTextEl.innerHTML = `Top 2 (${esc(top2.username)}) còn cách Top 1: <b id="my-gap-val">${gapTop2.toLocaleString()} điểm</b>`;
              } else {
                myGapTextEl.innerHTML = `<b id="my-gap-val">Đang dẫn đầu!</b>`;
              }
            } else {
              myGapTextEl.innerHTML = `Cách Top 1: <b id="my-gap-val">${gap.toLocaleString()} điểm</b>`;
            }
          }
          if (myGapFillEl) {
            const pct = top1Score > 0 ? Math.min(100, Math.round((myScore / top1Score) * 100)) : 100;
            myGapFillEl.style.width = `${pct}%`;
          }
          if (speechEl) {
            if (hangCuaToi === 1) {
              speechEl.textContent = `"Xuất sắc! Bạn đang giữ vị trí Quán Quân bảng vàng! Tiếp tục phát huy nhé!"`;
            } else {
              speechEl.textContent = `"Cố lên nhé! Chỉ cần thêm ${gap.toLocaleString()} điểm nữa là bạn sẽ chạm tay vào Cúp Vàng!"`;
            }
          }
        } else {
          if (myGapTextEl) myGapTextEl.innerHTML = 'Cách Top 1: <b id="my-gap-val">--</b>';
          if (myGapFillEl) myGapFillEl.style.width = "0%";
          if (speechEl) speechEl.textContent = LOI_CHUC_MAC_DINH;
        }
      } else {
        datLaiThanhTich();
      }
    } catch (err) {
      if (l !== luot) return;
      datLaiThanhTich();
      baoDong("Không kết nối được server. Bật app.py nhé!");
    }
  }

  // ----- Khởi động: lấy danh sách bảng từ server -----
  try {
    const res = await fetch(`${API}/api/ranking/cau-hinh`);
    const kq = await res.json();
    if (!kq.success) throw new Error(kq.message);
    const thuTuMon = ["khong-chuyen", "ly", "toan", "su", "dia"];
    const theoId = new Map((kq.bang || []).map((b) => [b.id, b]));
    const bangLoc = thuTuMon.map((id) => theoId.get(id)).filter(Boolean);
    cauHinh = { ...kq, bang: bangLoc.length ? bangLoc : kq.bang };
  } catch (err) {
    xoaBuc();
    baoDong("Không kết nối được server. Bật app.py nhé!");
    return;
  }

  // Mặc định mở bảng đúng môn của bạn (không thi chuyên -> bảng Không chuyên)
  const cuaToi = cauHinh.bang.find((b) => String(b.mon || "").trim().toLowerCase() === monCuaToi);
  bang = (cuaToi || cauHinh.bang[0]).id;
  veTab();
  taiBang();
});