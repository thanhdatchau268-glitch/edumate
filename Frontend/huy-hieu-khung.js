// huy-hieu-khung.js — Shared avatar badge frame helper (window.HUY_HIEU_KHUNG)
(function (global) {
  "use strict";

  const AVATAR_MAC_DINH_LOCAL = "img/avartar.webp";

  // 7 huy hiệu chính thức và tọa độ vòng tròn trong (tính theo % ảnh 1024x1024)
  const HUY_HIEU_MAP = Object.freeze({
    "buoc-chan-dau-tien": Object.freeze({
      id: "buoc-chan-dau-tien",
      ten: "Bước Chân Đầu Tiên",
      anh: "img/huy-hieu/buoc-chan-dau-tien.webp",
      cx: 49.91,
      cy: 49.16,
      d: 55.49,
    }),
    "chuyen-can": Object.freeze({
      id: "chuyen-can",
      ten: "Chuyên Cần",
      anh: "img/huy-hieu/chuyen-can.webp",
      cx: 49.95,
      cy: 49.70,
      d: 57.50,
    }),
    "tich-tieu-thanh-dai": Object.freeze({
      id: "tich-tieu-thanh-dai",
      ten: "Tích Tiểu Thành Đại",
      anh: "img/huy-hieu/tich-tieu-thanh-dai.webp",
      cx: 49.97,
      cy: 49.55,
      d: 64.57,
    }),
    "bach-phat-bach-trung": Object.freeze({
      id: "bach-phat-bach-trung",
      ten: "Bách Phát Bách Trúng",
      anh: "img/huy-hieu/bach-phat-bach-trung.webp",
      cx: 49.98,
      cy: 49.87,
      d: 57.98,
    }),
    "giai-nguyen": Object.freeze({
      id: "giai-nguyen",
      ten: "Giải Nguyên",
      anh: "img/huy-hieu/giai-nguyen.webp",
      cx: 49.96,
      cy: 49.98,
      d: 52.19,
    }),
    "hoi-nguyen": Object.freeze({
      id: "hoi-nguyen",
      ten: "Hội Nguyên",
      anh: "img/huy-hieu/hoi-nguyen.webp",
      cx: 49.98,
      cy: 49.95,
      d: 60.84,
    }),
    "trang-nguyen": Object.freeze({
      id: "trang-nguyen",
      ten: "Trạng Nguyên",
      anh: "img/huy-hieu/trang-nguyen.webp",
      cx: 49.98,
      cy: 49.94,
      d: 56.91,
    }),
  });

  const DANH_SACH_HUY_HIEU = Object.freeze(Object.keys(HUY_HIEU_MAP));

  const ALL_SIZE_CLASSES = [
    "hh-nav",
    "hh-sm",
    "hh-xs",
    "hh-podium-gold",
    "hh-podium-sub",
    "hh-kb",
    "hh-kb-lon",
    "hh-contest-gold",
    "hh-contest-sub",
    "hh-lg",
  ];

  function escAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function layThongTinKhung(huyHieuId) {
    const id = String(huyHieuId || "").trim();
    return id && HUY_HIEU_MAP[id] ? HUY_HIEU_MAP[id] : null;
  }

  function giaiMaAvatarSrc(avatarSrc) {
    const raw = String(avatarSrc || "").trim();
    if (!raw) return AVATAR_MAC_DINH_LOCAL;
    if (/^(https?:\/\/|data:|blob:|\/|img\/)/i.test(raw)) return raw;
    if (typeof global.duongDanAvatar === "function") {
      return global.duongDanAvatar(raw);
    }
    if (raw.startsWith("drv_")) {
      return "https://lh3.googleusercontent.com/d/" + encodeURIComponent(raw.slice(4)) + "=w256";
    }
    if (raw.startsWith("up_")) {
      const laMayLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
      return laMayLocal ? "http://127.0.0.1:5000/uploads/avatars/" + encodeURIComponent(raw) : AVATAR_MAC_DINH_LOCAL;
    }
    return "img/avatar/" + encodeURIComponent(raw);
  }

  function apDungBienCSSKhung(el, huyHieuId) {
    if (!el) return null;
    const info = layThongTinKhung(huyHieuId);
    if (!info) {
      el.classList.remove("co-khung");
      el.removeAttribute("data-huy-hieu");
      el.style.removeProperty("--hh-cx");
      el.style.removeProperty("--hh-cy");
      el.style.removeProperty("--hh-d");
      return null;
    }
    el.classList.add("co-khung");
    el.setAttribute("data-huy-hieu", info.id);
    el.style.setProperty("--hh-cx", info.cx + "%");
    el.style.setProperty("--hh-cy", info.cy + "%");
    el.style.setProperty("--hh-d", info.d + "%");
    return info;
  }

  /**
   * Tạo chuỗi HTML bọc avatar (dùng được ngay trong template literal).
   * @param {string} avatarSrc - Tên file DB hoặc đường dẫn ảnh avatar
   * @param {string} huyHieuId - ID huy hiệu đang đeo (hoặc rỗng)
   * @param {string} [sizeClass="hh-sm"] - Class kích thước (hh-nav, hh-sm, hh-xs, ...)
   * @param {object} [opts] - { alt, imgClass, extraClass }
   * @returns {string}
   */
  function taoKhungAvatar(avatarSrc, huyHieuId, sizeClass, opts) {
    const info = layThongTinKhung(huyHieuId);
    const src = giaiMaAvatarSrc(avatarSrc);
    const sz = sizeClass || "hh-sm";
    const o = opts || {};
    const alt = escAttr(o.alt || "Avatar");
    const extraCls = o.extraClass ? " " + escAttr(o.extraClass) : "";
    const imgCls = o.imgClass ? " " + escAttr(o.imgClass) : "";

    const styleAttr = info
      ? ` style="--hh-cx:${info.cx}%;--hh-cy:${info.cy}%;--hh-d:${info.d}%;"`
      : "";
    const dataAttr = info ? ` data-huy-hieu="${escAttr(info.id)}"` : "";
    const vienHtml = info
      ? `<img class="hh-khung-vien" src="${escAttr(info.anh)}" alt="" loading="lazy" decoding="async" aria-hidden="true" onerror="this.style.display='none'">`
      : "";

    return (
      `<span class="hh-khung-wrap ${escAttr(sz)}${info ? " co-khung" : ""}${extraCls}"${styleAttr}${dataAttr}>` +
      `<img class="hh-khung-avatar${imgCls}" src="${escAttr(src)}" alt="${alt}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${AVATAR_MAC_DINH_LOCAL}'">` +
      vienHtml +
      `</span>`
    );
  }

  /**
   * Bọc hoặc tháo khung trực tiếp quanh một thẻ <img> đang có trong DOM
   * mà vẫn giữ nguyên tham chiếu DOM node & event listeners của <img>.
   * @param {HTMLImageElement} imgEl
   * @param {string} huyHieuId
   * @param {object|string} [opts] - { sizeClass, onWrapClick } hoặc chuỗi sizeClass
   * @returns {HTMLElement|null}
   */
  function bocKhungAvatar(imgEl, huyHieuId, opts) {
    if (!imgEl || !imgEl.parentNode) return null;
    const o = typeof opts === "string" ? { sizeClass: opts } : (opts || {});
    const info = layThongTinKhung(huyHieuId);
    const existingWrap = imgEl.closest(".hh-khung-wrap");

    if (!info) {
      if (existingWrap && existingWrap.parentNode) {
        existingWrap.parentNode.insertBefore(imgEl, existingWrap);
        existingWrap.remove();
      }
      imgEl.classList.remove("hh-khung-avatar");
      return imgEl;
    }

    let wrap = existingWrap;
    if (!wrap) {
      wrap = document.createElement("span");
      wrap.className = "hh-khung-wrap";
      imgEl.parentNode.insertBefore(wrap, imgEl);
      wrap.appendChild(imgEl);
      if (typeof o.onWrapClick === "function") {
        wrap.addEventListener("click", o.onWrapClick);
      }
    }

    if (o.sizeClass) {
      ALL_SIZE_CLASSES.forEach((c) => wrap.classList.remove(c));
      String(o.sizeClass)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => wrap.classList.add(c));
    }

    imgEl.classList.add("hh-khung-avatar");
    apDungBienCSSKhung(wrap, info.id);

    let vien = wrap.querySelector(":scope > .hh-khung-vien");
    if (!vien) {
      vien = document.createElement("img");
      vien.className = "hh-khung-vien";
      vien.alt = "";
      vien.setAttribute("aria-hidden", "true");
      vien.onerror = function () {
        this.style.display = "none";
      };
      wrap.appendChild(vien);
    }
    vien.style.display = "";
    if (vien.getAttribute("src") !== info.anh) {
      vien.setAttribute("src", info.anh);
    }

    return wrap;
  }

  /**
   * Cập nhật ngay khung huy hiệu cho avatar trên thanh điều hướng (.user-avatar).
   * @param {string} [huyHieuId] - Nếu bỏ trống/undefined, đọc từ localStorage.getItem("huyHieu")
   * @param {object} [opts] - { luuStorage: boolean }
   */
  function capNhatAvatarNavbar(huyHieuId, opts) {
    const o = opts || {};
    let id = huyHieuId;
    if (id === undefined) {
      id = localStorage.getItem("huyHieu") || "";
    } else if (o.luuStorage !== false) {
      localStorage.setItem("huyHieu", id || "");
    }

    const navAvatars = document.querySelectorAll("#user-profile .user-avatar, .user-avatar");
    navAvatars.forEach((imgEl) => {
      bocKhungAvatar(imgEl, id, {
        sizeClass: "hh-nav",
        onWrapClick: () => {
          global.location.href = "profile.html";
        },
      });
    });
  }

  global.HUY_HIEU_KHUNG = Object.freeze({
    HUY_HIEU_MAP,
    DANH_SACH_HUY_HIEU,
    layThongTinKhung,
    giaiMaAvatarSrc,
    apDungBienCSSKhung,
    taoKhungAvatar,
    bocKhungAvatar,
    capNhatAvatarNavbar,
  });
})(window);
