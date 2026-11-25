// StaticData.gs - Toàn bộ cấu hình hằng số cho Backend Google Apps Script (port 1:1 từ Backend/script/)

var SPREADSHEET_ID = "1ucNytz6Pcz9UhHeBkwAWDRyppDsiLrmw18vCmleDIWo";
var TZ_VN = "Asia/Ho_Chi_Minh";

var DIEM_MO_KHOA_SUA = 500;
var DIEM_MO_KHOA_AVATAR = 500;

var BANG_XEP_HANG = {
  "khong-chuyen": ["Không chuyên", ""],
  "ly": ["Chuyên Vật Lý", "ly"],
  "toan": ["Chuyên Toán", "toan"],
  "su": ["Chuyên Lịch Sử", "su"],
  "dia": ["Chuyên Địa Lí", "dia"]
};

var KY_XEP_HANG = {
  "tong": "Tổng",
  "thang": "Tháng này"
};

var MON_CHUYEN_HOP_LE = {
  "": true, "ly": true, "toan": true, "su": true, "dia": true,
  "hoa": true, "sinh": true, "van": true, "anh": true, "tin": true
};

// Danh sách avatar sẵn có trong Frontend/img/avatar/
var AVATAR_LIST = ["binhminh.webp", "cot.webp", "cucquang.webp", "may.webp", "nhatthuc.webp"];
var DRIVE_AVATAR_FOLDER = "VnStarL_Avatars";

// Manifest Sao La (từ Frontend/img/pet/manifest.json)
var PET_MANIFEST = {
  so_khung: 6,
  fps: 6,
  skin: {
    mac_dinh: { ten: "Sao La", gia: 0, hanh_dong: ["idle", "vuon_idle", "di_bo", "tam_song", "nghi_ngoi", "ngoi_ghe", "ngu", "an_la", "choi_vui", "om_met", "hoan_thanh_chang", "khich_le_co_len", "focus_combo", "vui", "noi", "hoc", "khoc"] },
    ao_dai: { ten: "Áo dài (ảnh mẫu)", gia: 100, hanh_dong: ["idle"] }
  },
  hieu_ung: {
    ds: ["muc", "mo_hoi", "nuoc_mat", "zzz", "sao"],
    theo_hanh_dong: { hoc: "muc", chay: "mo_hoi", khoc: "nuoc_mat", ngu: "zzz", vui: "sao" }
  }
};

// 7 Huy hiệu chính thức (từ huy_hieu.py)
var DS_HUY_HIEU = [
  { id: "buoc-chan-dau-tien", ten: "Bước Chân Đầu Tiên", mo_ta: "Hoàn thành ít nhất 1 bài tập có điểm.", anh: "img/huy-hieu/buoc-chan-dau-tien.webp", diem_thuong: 30 },
  { id: "chuyen-can", ten: "Chuyên Cần", mo_ta: "Điểm danh tích lũy 7 ngày hoặc giữ chuỗi học 5 ngày liên tiếp.", anh: "img/huy-hieu/chuyen-can.webp", diem_thuong: 60 },
  { id: "tich-tieu-thanh-dai", ten: "Tích Tiểu Thành Đại", mo_ta: "Hoàn thành trọn bộ Nhiệm vụ hằng ngày 3 ngày hoặc sửa 10 câu trong Sổ lỗi sai.", anh: "img/huy-hieu/tich-tieu-thanh-dai.webp", diem_thuong: 80 },
  { id: "bach-phat-bach-trung", ten: "Bách Phát Bách Trúng", mo_ta: "Đạt 100% điểm ở ít nhất 5 bài tập khác nhau.", anh: "img/huy-hieu/bach-phat-bach-trung.webp", diem_thuong: 120 },
  { id: "giai-nguyen", ten: "Giải Nguyên", mo_ta: "Đạt Giải Nguyên / Top 3 Khoa Bảng, Top 3 Cuộc thi đã kết thúc, hoặc Top 3 Bảng tháng (từ 300 điểm).", anh: "img/huy-hieu/giai-nguyen.webp", diem_thuong: 150 },
  { id: "hoi-nguyen", ten: "Hội Nguyên", mo_ta: "Đạt danh hiệu Hội Nguyên (Khoa Bảng) hoặc tích lũy từ 1.500 điểm và đạt ≥ 80% ở ít nhất 15 bài tập.", anh: "img/huy-hieu/hoi-nguyen.webp", diem_thuong: 220 },
  { id: "trang-nguyen", ten: "Trạng Nguyên", mo_ta: "Đạt danh hiệu Trạng Nguyên (Thi Đình) hoặc giữ Top 1 Bảng Vàng Tổng với ≥ 3.000 điểm và ≥ 30 bài đạt 100%.", anh: "img/huy-hieu/trang-nguyen.webp", diem_thuong: 350 }
];

// Quà tặng & Vòng quay (từ qua_tang.py)
var QUA_CHU_KY = 7;
var TOI_DA_BAO_HO = 3;
var DIEM_DOI_THE_DAY = 15;
var BUFF_X15_GIAY = 3600;
var THUONG_X15 = 0.5;

var QUA_TUAN_DAU = [
  { ngay: 1, loai: "diem", gia_tri: 20 },
  { ngay: 2, loai: "diem", gia_tri: 30 },
  { ngay: 3, loai: "diem", gia_tri: 40 },
  { ngay: 4, loai: "bao_ho", gia_tri: 1 },
  { ngay: 5, loai: "diem", gia_tri: 50 },
  { ngay: 6, loai: "diem", gia_tri: 60 },
  { ngay: 7, loai: "quay", gia_tri: 1 }
];

var VONG_QUAY = [
  { id: "hut", ten: "Hụt rồi, chúc may mắn!", w: 33 },
  { id: "diem10", ten: "+10 điểm", w: 25, diem: 10 },
  { id: "diem20", ten: "+20 điểm", w: 10, diem: 20 },
  { id: "diem50", ten: "+50 điểm", w: 2, diem: 50 },
  { id: "bao_ho", ten: "Thẻ bảo hộ streak", w: 12 },
  { id: "x15", ten: "x1,5 điểm trong 1 giờ", w: 13 },
  { id: "them_luot", ten: "Thêm 1 lượt quay", w: 5 }
];

// Nhiệm vụ hằng ngày (từ nhiem_vu.py)
var NV_THUONG = {
  de: { ten: "Dễ", diem: 5 },
  vua: { ten: "Vừa", diem: 12 },
  kho: { ten: "Khó", diem: 25 }
};
var NV_LUOT_QUAY_DU_3 = 1;
var NV_THU_TU_KHO = ["de", "vua", "kho"];

var DS_NV = [
  { id: "diem_danh", kho: "de", icon: "fa-calendar-check", muc_tieu: 1, do_type: "dd", do_key: "", ten: "Điểm danh hôm nay", mo_ta: "Vào trang Quà tặng và bấm điểm danh.", link: "qua.html" },
  { id: "ly_thuyet", kho: "de", icon: "fa-book-open-reader", muc_tieu: 1, do_type: "khoa", do_key: "ly_thuyet", ten: "Đọc lý thuyết", mo_ta: "Mở phần lý thuyết của một bài học và đọc ít nhất 20 giây.", link: "subjects.html" },
  { id: "lam_2_bai", kho: "de", icon: "fa-pen", muc_tieu: 2, do_type: "tap", do_key: "bai:", ten: "Làm 2 bài tập", mo_ta: "Nộp 2 bài tập khác nhau (trả lời ít nhất một nửa số câu).", link: "subjects.html" },
  { id: "on_3_the", kho: "vua", icon: "fa-book-bookmark", muc_tieu: 3, do_type: "khoa", do_key: "on_the", can: "co_ky_nang", ten: "Ôn 3 thẻ trong Sổ lỗi sai", mo_ta: "Làm 3 thẻ sửa lỗi hoặc thẻ chứng minh.", link: "so-loi.html" },
  { id: "dat_80", kho: "vua", icon: "fa-medal", muc_tieu: 1, do_type: "khoa", do_key: "bai_80", ten: "Đạt từ 80% ở một bài", mo_ta: "Nộp một bài tập và đạt từ 80% số điểm.", link: "subjects.html" },
  { id: "hai_mon", kho: "vua", icon: "fa-shuffle", muc_tieu: 2, do_type: "tap", do_key: "mon:", ten: "Luyện 2 môn khác nhau", mo_ta: "Nộp bài ở 2 môn học khác nhau trong cùng một ngày.", link: "subjects.html" },
  { id: "nang_hang", kho: "vua", icon: "fa-arrow-up-right-dots", muc_tieu: 1, do_type: "khoa", do_key: "nang_hang", can: "bai_chua_max", ten: "Làm lại để nâng điểm", mo_ta: "Làm lại một bài đã làm và đạt % cao hơn lần trước.", link: "subjects.html" },
  { id: "chung_minh", kho: "kho", icon: "fa-bullseye", muc_tieu: 2, do_type: "khoa", do_key: "chung_minh", can: "den_han_2", ten: "Chứng minh 2 kỹ năng", mo_ta: "Vượt qua 2 thẻ chứng minh ở kỹ năng đã đến hạn: đúng ngay lần đầu, không gợi ý.", link: "so-loi.html" },
  { id: "tuyet_doi", kho: "kho", icon: "fa-gem", muc_tieu: 1, do_type: "khoa", do_key: "bai_100", ten: "Đạt 100% một bài", mo_ta: "Nộp một bài tập và đúng tất cả các câu.", link: "subjects.html" },
  { id: "dung_40", kho: "kho", icon: "fa-circle-check", muc_tieu: 40, do_type: "khoa", do_key: "cau_dung", ten: "Trả lời đúng 40 câu", mo_ta: "Cộng dồn số câu đúng trong ngày (mỗi bài chỉ tính lần nộp đầu tiên trong ngày).", link: "subjects.html" }
];

// Sổ lỗi sai (từ so_loi.py)
var GIAU_LOI_GIAI_KHI_SAI = true;
var SL_LICH_ON = { 1: 1, 2: 3, 3: 7 };
var SL_THUONG_LEN_MUC = { 1: 5, 2: 8, 3: 12 };
var SL_THUONG_GHI_NHO_LAU = 10;
var SL_TEN_MUC = ["Chưa vững", "Đang luyện", "Khá", "Thông thạo"];
var SL_NGUYEN_NHAN = { khai_niem: true, tinh_nham: true, doc_sai_de: true, doan_bua: true };
var SL_LOAI_CAU = { "trac-nghiem": true, "dung-sai": true, "tra-loi-ngan": true };
var SL_TEN_MON = { toan: "Toán", ngu_van: "Ngữ văn", vat_ly: "Vật lí", chuyen_toan: "Chuyên Toán", chuyen_dia: "Chuyên Địa Lí" };

// Khoa bảng (từ khoa_bang.py)
var KB_HAN_TOKEN_SEC = 30 * 24 * 3600;
var KB_HAN_PHUC_KHAO_NGAY = 7;
var KB_GIAY_NOP_NHANH = 3;
var KB_CAP = ["huong", "hoi", "dinh"];
var KB_TEN_CAP = { huong: "Thi Hương", hoi: "Thi Hội", dinh: "Thi Đình" };
var KB_CHU_KY = { huong: "Hằng tuần", hoi: "Hằng tháng", dinh: "Hằng quý" };

var KB_NHAN_TP = {
  huong: {
    luyen_de: ["Kết quả luyện đề, bài kiểm tra", "Luyện đề"],
    chinh_xac: ["Độ chính xác và mức độ hoàn thành", "Chính xác"],
    chuyen_can: ["Chuyên cần, duy trì học tập", "Chuyên cần"],
    tien_bo: ["Tiến bộ so với kết quả trước", "Tiến bộ"]
  },
  hoi: {
    thi_hoi: ["Bài thi Hội chính thức", "Bài thi"],
    thi_huong: ["Thành tích Thi Hương trong tháng", "Thi Hương"],
    tien_bo: ["Tiến bộ học tập", "Tiến bộ"]
  },
  dinh: {
    thi_dinh: ["Bài thi Đình chính thức", "Bài thi"],
    thi_hoi: ["Thành tích các kỳ Thi Hội trong quý", "Thi Hội"],
    thi_huong: ["Thành tích Thi Hương trong quý", "Thi Hương"]
  }
};

var KB_CAU_HINH_MAC_DINH = {
  huong: {
    trong_so: { luyen_de: 50, chinh_xac: 25, chuyen_can: 15, tien_bo: 10 },
    toi_thieu_bai: 3, prior_k: 3, prior_pct: 50, diem_san: 40, toi_thieu_thi_sinh: 3,
    danh_hieu: [{ ma: "giai_nguyen", so_luong: 1 }, { ma: "huong_cong", ty_le: 0.40 }, { ma: "sinh_do", con_lai: true }]
  },
  hoi: {
    trong_so: { thi_hoi: 70, thi_huong: 20, tien_bo: 10 },
    khao_hach_san: 40, diem_san: 40, toi_thieu_thi_sinh: 3,
    danh_hieu: [{ ma: "hoi_nguyen", so_luong: 1 }, { ma: "thai_hoc_sinh", ty_le: 0.50 }, { ma: "pho_bang", con_lai: true }]
  },
  dinh: {
    trong_so: { thi_dinh: 60, thi_hoi: 25, thi_huong: 15 },
    toi_thieu_ky_hoi: 2, diem_san: 50, toi_thieu_thi_sinh: 3,
    danh_hieu: [
      { ma: "trang_nguyen", so_luong: 1 }, { ma: "bang_nhan", so_luong: 1 },
      { ma: "tham_hoa", so_luong: 1 }, { ma: "hoang_giap", ty_le: 0.30 },
      { ma: "dong_tien_si", con_lai: true }
    ]
  }
};

function getDapAnData(relPath) {
  return (typeof DAP_AN_BUNDLE !== "undefined" && DAP_AN_BUNDLE[relPath]) ? DAP_AN_BUNDLE[relPath] : null;
}

function getDeData(relPath) {
  if (typeof DE_BUNDLE_1 !== "undefined" && DE_BUNDLE_1[relPath]) return DE_BUNDLE_1[relPath];
  if (typeof DE_BUNDLE_2 !== "undefined" && DE_BUNDLE_2[relPath]) return DE_BUNDLE_2[relPath];
  if (typeof DE_BUNDLE_3 !== "undefined" && DE_BUNDLE_3[relPath]) return DE_BUNDLE_3[relPath];
  return null;
}
