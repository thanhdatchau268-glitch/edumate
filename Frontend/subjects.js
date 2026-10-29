document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("subject-grid");
  if (!grid) return;

  // anh = tên file hình trong img/subject/ (đuôi .webp)
  // coBai = false thì ô hiện "Sắp có" và chưa bấm vào được
  const MON_CHUNG = [
    {
      ten: "Toán",
      subject: "toan",
      anh: "toan",
      icon: "fa-calculator",
      coBai: true,
    },
    {
      ten: "Ngữ Văn",
      subject: "ngu-van",
      anh: "ngu_van",
      icon: "fa-feather-pointed",
      coBai: true,
    },
  ];

  const MON_CHUYEN = {
    toan: {
      ten: "Chuyên Toán",
      subject: "chuyen-toan",
      anh: "chuyen_toan",
      icon: "fa-shapes",
      coBai: true,
    },
    ly: {
      ten: "Chuyên Vật Lý",
      subject: "vat-ly", // dùng bài Vật Lí hiện có (thư mục vat_ly)
      anh: "chuyen_ly",
      icon: "fa-atom",
      coBai: true,
    },
    hoa: {
      ten: "Chuyên Hóa Học",
      subject: "chuyen-hoa",
      anh: "chuyen_hoa",
      icon: "fa-flask",
      coBai: false,
    },
  };

  // Môn chuyên đã lưu lúc khảo sát / đăng nhập ("" = không thi chuyên)
  const monChuyen = localStorage.getItem("monChuyen") || "";
  const dsMon = [...MON_CHUNG];
  if (MON_CHUYEN[monChuyen]) dsMon.push(MON_CHUYEN[monChuyen]);

  dsMon.forEach((m) => {
    // Có bài thì là link, chưa có thì là ô xám
    const the = document.createElement(m.coBai ? "a" : "div");
    the.className = "subject-card" + (m.coBai ? "" : " subject-card--soon");
    if (m.coBai) the.href = `problems.html?subject=${m.subject}`;

    // Ô hình: chưa có file ảnh thì hiện ô giữ chỗ có icon
    const khungAnh = document.createElement("div");
    khungAnh.className = "subject-img";

    const taoOGiuCho = () => {
      const ph = document.createElement("div");
      ph.className = "subject-placeholder";
      ph.innerHTML = `<i class="fa-solid ${m.icon}"></i>`;
      return ph;
    };

    const img = document.createElement("img");
    img.src = `img/subject/${m.anh}.webp`;
    img.alt = m.ten;
    img.addEventListener("error", () => img.replaceWith(taoOGiuCho()));
    khungAnh.appendChild(img);

    const ten = document.createElement("span");
    ten.className = "subject-name";
    ten.textContent = m.ten;

    the.append(khungAnh, ten);

    if (!m.coBai) {
      const nhan = document.createElement("span");
      nhan.className = "subject-badge";
      nhan.textContent = "Sắp có";
      the.appendChild(nhan);
    }

    grid.appendChild(the);
  });
});