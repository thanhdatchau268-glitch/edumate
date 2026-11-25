// Lucian UX/UI Prompt #041 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#041
(function () {
  "use strict";

  const daDangNhap = localStorage.getItem("isLoggedIn") === "true";

  // Danh sách 4 tab chuẩn theo đúng bộ icon người dùng yêu cầu
  const TABS_DATA = [
    {
      id: "nav-gioi-thieu",
      href: daDangNhap ? "personal.html" : "index.html",
      label: daDangNhap ? "Cá nhân" : "Giới thiệu",
      iconHtml: daDangNhap
        ? '<i class="fa-solid fa-graduation-cap"></i>'
        : '<i class="fa-solid fa-graduation-cap"></i>', // Luôn hiển thị Mũ cử nhân theo yêu cầu ảnh mẫu
    },
    {
      id: "nav-bai-tap",
      href: "subjects.html",
      label: "Bài tập",
      iconHtml: '<i class="fa-solid fa-book-open"></i>',
    },
    {
      id: "nav-khoa-bang",
      href: "khoa-bang.html",
      label: "Khoa cử",
      iconHtml: '<i class="fa-solid fa-scroll"></i>',
    },
    {
      id: "nav-xep-hang",
      href: "ranking.html",
      label: "Xếp hạng",
      iconHtml: '<i class="fa-solid fa-ranking-star"></i>',
    },
    {
      id: "nav-vuon-saoladou",
      href: "vuon-saoladou.html",
      label: "Vườn Saoladou",
      iconHtml: '<i class="fa-solid fa-seedling"></i>',
    },
  ];

  // Map các trang con về tab cha tương ứng
  const NHOM_TRANG = {
    "problems.html": "subjects.html",
    "lesson.html": "subjects.html",
    "form.html": "subjects.html",
    "so-loi.html": "subjects.html",
    "bai-tap.html": "subjects.html",
    "contest.html": "khoa-bang.html",
    "personal.html": daDangNhap ? "personal.html" : "index.html",
    "index.html": "index.html",
  };

  function layTrangHienTai() {
    const file = location.pathname.split("/").pop() || "index.html";
    return NHOM_TRANG[file] || file;
  }

  function taoNotchedBar() {
    if (document.querySelector(".u041")) return;

    // Đảm bảo có CSS notched-nav.css
    if (!document.querySelector('link[href*="notched-nav.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "notched-nav.css?v=3";
      document.head.appendChild(link);
    }

    const trangDich = layTrangHienTai();
    const coTabActive = TABS_DATA.some((t) => t.href === trangDich);

    const wrapper = document.createElement("nav");
    wrapper.className = coTabActive ? "ux u041" : "ux u041 u041-retracted";
    if (!coTabActive) wrapper.style.setProperty("--notch-r", "0px");
    wrapper.setAttribute("aria-label", "Thanh điều hướng Notched");

    const tabsHtml = TABS_DATA.map((t, idx) => {
      const isSelected = t.href === trangDich;
      return `
        <li role="none">
          <button class="u041-tab" type="button" role="tab" data-href="${t.href}" data-index="${idx}" aria-selected="${isSelected ? "true" : "false"}" tabindex="${isSelected ? "0" : "-1"}">
            <span class="u041-ic" aria-hidden="true">${t.iconHtml}</span>
            <span class="u041-lab">${t.label}</span>
          </button>
        </li>
      `;
    }).join("");

    wrapper.innerHTML = `
      <span class="u041-shadow" aria-hidden="true"></span>
      <div class="u041-bar" aria-hidden="true"></div>
      <span class="u041-bub" aria-hidden="true"></span>
      <ul class="u041-tabs" role="tablist" aria-label="Điều hướng chính VnStarL">
        ${tabsHtml}
      </ul>
    `;

    document.body.appendChild(wrapper);
    kichHoatNotchedBar(wrapper);
  }

  function kichHoatNotchedBar(root) {
    const tabs = Array.prototype.slice.call(root.querySelectorAll(".u041-tab"));
    if (!tabs.length) return;

    const rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = 0, v = 0, target = 0;
    let notchR = 36, vR = 0, targetR = 36;
    let raf = 0;
    let retractTimer = null;
    const THOI_GIAN_DOI_THU_VE = 650; // Đợi 0.65s rồi tự động thu về

    function center(t) {
      if (!t || !t.offsetWidth) {
        const idx = Number(t?.getAttribute("data-index") || 0);
        const w = root.offsetWidth || 360;
        return (w / tabs.length) * (idx + 0.5);
      }
      return t.offsetLeft + t.offsetWidth / 2;
    }

    function step() {
      // 1. Spring physics cho tọa độ X
      const a = (target - x) * 0.16 - v * 0.42;
      v += a;
      x += v;
      root.style.setProperty("--x", x.toFixed(2) + "px");

      // 2. Physics mượt mà cho bán kính rãnh Notch
      const aR = (targetR - notchR) * 0.22 - vR * 0.42;
      vR += aR;
      notchR += vR;
      if (targetR === 0 && notchR < 0.2) notchR = 0;
      root.style.setProperty("--notch-r", Math.max(0, notchR).toFixed(2) + "px");

      const dangDiChuyenX = Math.abs(target - x) > 0.25 || Math.abs(v) > 0.25;
      const dangThayDoiR = Math.abs(targetR - notchR) > 0.25 || Math.abs(vR) > 0.25;

      if (dangDiChuyenX || dangThayDoiR) {
        raf = requestAnimationFrame(step);
      } else {
        x = target;
        v = 0;
        notchR = targetR;
        vR = 0;
        root.style.setProperty("--x", x + "px");
        root.style.setProperty("--notch-r", notchR + "px");
        raf = 0;
      }
    }

    function datHenThuVe() {
      if (retractTimer) clearTimeout(retractTimer);
      retractTimer = setTimeout(() => {
        // Thu quả cầu về: notch khép lại phẳng phiu, tab chuyển sang dạng pill nền xanh nhạt
        root.classList.add("u041-retracted");
        targetR = 0;
        if (rm) {
          notchR = 0;
          root.style.setProperty("--notch-r", "0px");
        } else {
          if (!raf) raf = requestAnimationFrame(step);
        }
      }, THOI_GIAN_DOI_THU_VE);
    }

    function bungNotch() {
      if (retractTimer) clearTimeout(retractTimer);
      root.classList.remove("u041-retracted");
      targetR = 36;
      if (rm) {
        notchR = 36;
        root.style.setProperty("--notch-r", "36px");
      } else {
        if (!raf) raf = requestAnimationFrame(step);
      }
      datHenThuVe();
    }

    function select(i, focus, navigate) {
      if (i < 0 || i >= tabs.length) return;

      tabs.forEach((t, k) => {
        const isCurrent = k === i;
        t.setAttribute("aria-selected", String(isCurrent));
        t.tabIndex = isCurrent ? 0 : -1;
      });

      if (focus) tabs[i].focus();
      target = center(tabs[i]);

      if (rm) {
        x = target;
        root.style.setProperty("--x", x + "px");
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(step);
      }

      bungNotch();

      if (navigate) {
        const href = tabs[i].getAttribute("data-href");
        if (href) {
          const fileHienTai = location.pathname.split("/").pop() || "index.html";
          if (fileHienTai !== href) {
            // Chờ hiệu ứng quả cầu bung lên mượt mà rồi mới chuyển trang
            setTimeout(() => {
              window.location.href = href;
            }, 220);
          }
        }
      }
    }

    // Gắn sự kiện click & bàn phím cho các tab
    tabs.forEach((t, i) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        select(i, false, true);
      });

      t.addEventListener("keydown", (e) => {
        let d = 0;
        if (e.key === "ArrowRight") d = 1;
        else if (e.key === "ArrowLeft") d = -1;

        if (d !== 0) {
          e.preventDefault();
          const next = (i + d + tabs.length) % tabs.length;
          select(next, true, false);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(i, false, true);
        }
      });
    });

    // Xác định tab ban đầu của trang
    const trangDich = layTrangHienTai();
    const indexBanDau = tabs.findIndex((t) => t.getAttribute("data-href") === trangDich);
    const khongCoTabMacDinh = indexBanDau === -1;

    const datViTriBanDau = () => {
      if (khongCoTabMacDinh) {
        // Trang phụ (như login/register): giữ thanh thu gọn, không tô sáng tab nào
        target = center(tabs[0]);
        x = target;
        notchR = 0;
        targetR = 0;
        root.classList.add("u041-retracted");
        root.style.setProperty("--x", x + "px");
        root.style.setProperty("--notch-r", "0px");
        tabs.forEach((t, k) => {
          t.setAttribute("aria-selected", "false");
          t.tabIndex = k === 0 ? 0 : -1;
        });
        return;
      }

      target = center(tabs[indexBanDau]);
      x = target;
      root.style.setProperty("--x", x + "px");

      tabs.forEach((t, k) => {
        const isCurrent = k === indexBanDau;
        t.setAttribute("aria-selected", String(isCurrent));
        t.tabIndex = isCurrent ? 0 : -1;
      });

      // Ban đầu mở quả cầu 600ms để người dùng thấy rõ tab vừa vào, sau đó tự thu về
      bungNotch();
    };

    // Đợi layout render xong tọa độ
    setTimeout(datViTriBanDau, 40);
    window.addEventListener("load", datViTriBanDau);

    // Cập nhật tọa độ khi xoay màn hình hoặc resize
    window.addEventListener("resize", () => {
      const tabActive = root.querySelector('.u041-tab[aria-selected="true"]') || tabs[0];
      target = center(tabActive);
      x = target;
      root.style.setProperty("--x", x + "px");
    });
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", taoNotchedBar);
  } else {
    taoNotchedBar();
  }
})();
