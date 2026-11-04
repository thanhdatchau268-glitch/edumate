# -*- coding: utf-8 -*-
"""
khoa_bang.py - BẢNG VÀNG KHOA BẢNG (Thi Hương / Thi Hội / Thi Đình)

Đặt ở: Backend/script/khoa_bang.py
File tự chứa (giống qua_tang.py): tự tạo bảng tiền tố kb_, không sửa bảng cũ.

GIAI ĐOẠN 2 (file này): bảng dữ liệu + cấu hình + thuật toán tính điểm.
  - ghi_hoat_dong()      : app.py gọi sau mỗi lần chấm bài, ghi log CÓ GIỜ (nguồn dữ liệu duy nhất để tính điểm)
  - tinh_diem_huong()    : điểm Thi Hương của 1 học sinh trong 1 tuần
  - xep_hang_huong()     : bảng xếp hạng Thi Hương (có xử lý đồng điểm)
  - tinh_diem_hoi/dinh() : công thức điểm Thi Hội / Thi Đình (nhận số đã quy về %, phần lấy dữ liệu làm ở giai đoạn 3)
  - trao_danh_hieu()     : chia danh hiệu theo tỷ lệ cấu hình, KHÔNG mặc định ai cũng có
GIAI ĐOẠN 3 (phần cuối file): kỳ thi, chốt kỳ idempotent, token, API.

Nguyên tắc: mọi thành phần điểm đều quy về thang 0-100 rồi mới nhân trọng số.
Điểm KHÔNG lấy từ users.score (bị nhiễu bởi vòng quay, buff), chỉ lấy từ log chấm bài thật.
"""
import json
import math
import sqlite3
from datetime import date, datetime, timedelta

from flask import Blueprint

from db_ops import DB_PATH, BANG_XEP_HANG

kb_bp = Blueprint('khoa_bang', __name__)   # giai đoạn 3 sẽ thêm route vào đây

# ====================== CẤU HÌNH MẶC ĐỊNH (admin chỉnh trong bảng kb_cau_hinh) ======================
CAU_HINH_MAC_DINH = {
    "huong": {
        "trong_so": {"luyen_de": 50, "chinh_xac": 25, "chuyen_can": 15, "tien_bo": 10},
        "toi_thieu_bai": 3,        # làm ít hơn số bài này trong tuần thì không được xếp hạng
        "prior_k": 3,              # độ "kéo về mức trung bình" (làm mượt Bayes), càng lớn càng khó nhảy top nhờ 1 bài
        "prior_pct": 50,           # mức trung bình giả định
        "diem_san": 40,            # dưới điểm này không nhận danh hiệu
        "toi_thieu_thi_sinh": 3,   # ít hơn số người này thì kỳ không trao danh hiệu
        "danh_hieu": [             # xét từ trên xuống; so_luong cố định hoặc ty_le (% số thí sinh đủ điều kiện)
            {"ma": "giai_nguyen", "so_luong": 1},
            {"ma": "huong_cong", "ty_le": 0.10},
            {"ma": "sinh_do", "ty_le": 0.30},
        ],
    },
    "hoi": {
        "trong_so": {"thi_hoi": 70, "thi_huong": 20, "tien_bo": 10},
        "khao_hach_san": 40,       # có vòng Khảo hạch thì phải đạt từ % này mới được vào Thi chính
        "diem_san": 40, "toi_thieu_thi_sinh": 3,
        "danh_hieu": [
            {"ma": "hoi_nguyen", "so_luong": 1},
            {"ma": "thai_hoc_sinh", "ty_le": 0.10},
            {"ma": "pho_bang", "ty_le": 0.30},
        ],
    },
    "dinh": {
        "trong_so": {"thi_dinh": 60, "thi_hoi": 25, "thi_huong": 15},
        "toi_thieu_ky_hoi": 2, "diem_san": 50, "toi_thieu_thi_sinh": 3,
        "danh_hieu": [
            {"ma": "trang_nguyen", "so_luong": 1},
            {"ma": "bang_nhan", "so_luong": 1},
            {"ma": "tham_hoa", "so_luong": 1},
            {"ma": "hoang_giap", "ty_le": 0.10},
            {"ma": "dong_tien_si", "ty_le": 0.30},
        ],
    },
}

# (mã, tên, cấp, nhóm giáp, thứ tự, điểm tích lũy khoa bảng khi đạt)
DANH_HIEU = [
    ("giai_nguyen", "Giải nguyên", "huong", "", 1, 10),
    ("huong_cong", "Hương cống", "huong", "", 2, 5),
    ("sinh_do", "Sinh đồ", "huong", "", 3, 2),
    ("hoi_nguyen", "Hội nguyên", "hoi", "", 1, 40),
    ("thai_hoc_sinh", "Thái học sinh", "hoi", "", 2, 20),
    ("pho_bang", "Phó bảng", "hoi", "", 3, 8),
    ("trang_nguyen", "Trạng nguyên", "dinh", "Đệ nhất giáp - Tam khôi", 1, 150),
    ("bang_nhan", "Bảng nhãn", "dinh", "Đệ nhất giáp - Tam khôi", 2, 100),
    ("tham_hoa", "Thám hoa", "dinh", "Đệ nhất giáp - Tam khôi", 3, 70),
    ("hoang_giap", "Hoàng giáp", "dinh", "Đệ nhị giáp", 4, 40),
    ("dong_tien_si", "Đồng tiến sĩ xuất thân", "dinh", "Đệ tam giáp", 5, 20),
]

# Trộm "nộp quá nhanh": 2 lần nộp cách nhau dưới số giây này (và bài có từ 5 câu) thì đưa vào danh sách chờ duyệt
GIAY_NOP_NHANH = 3


# ====================== TẠO BẢNG ======================
def dam_bao_bang():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS kb_hoat_dong (      -- log MỖI lần nộp bài (chỉ ghi thêm, không sửa)
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, bai_key TEXT,
            thoi_diem TEXT, ngay TEXT,                 -- "2026-11-03 20:15:00" và "2026-11-03"
            so_cau INTEGER, so_tra_loi INTEGER, so_dung INTEGER, pct INTEGER
        );
        CREATE INDEX IF NOT EXISTS ix_kb_hd ON kb_hoat_dong (user_id, ngay);

        CREATE TABLE IF NOT EXISTS kb_cau_hinh (        -- trọng số, ngưỡng, tỷ lệ danh hiệu (JSON mỗi cấp)
            khoa TEXT PRIMARY KEY, gia_tri TEXT
        );
        CREATE TABLE IF NOT EXISTS kb_danh_hieu (       -- danh mục danh hiệu
            ma TEXT PRIMARY KEY, ten TEXT, cap TEXT, giap TEXT DEFAULT '',
            thu_tu INTEGER, diem_tich_luy INTEGER
        );
        CREATE TABLE IF NOT EXISTS kb_ky (              -- các kỳ thi (exam_periods)
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cap TEXT, ma TEXT,                          -- cap: huong | hoi | dinh ; ma: 2026-W45 | 2026-11 | 2026-Q4
            bat_dau TEXT, ket_thuc TEXT,
            bang TEXT DEFAULT 'khong-chuyen',           -- mỗi nhóm (không chuyên/toán/lý/hóa) xếp riêng
            trang_thai TEXT DEFAULT 'mo',               -- mo | da_khoa
            contest_id INTEGER,                         -- Thi Hội/Đình dùng lại bảng contests
            UNIQUE (cap, ma, bang)
        );
        CREATE TABLE IF NOT EXISTS kb_tham_gia (        -- lịch sử tham gia (exam_participations)
            ky_id INTEGER, user_id INTEGER, tao_luc TEXT,
            PRIMARY KEY (ky_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS kb_ket_qua (         -- kết quả kỳ, KHÓA sau khi chốt (exam_results + rankings)
            ky_id INTEGER, user_id INTEGER,
            diem_tong REAL, hang INTEGER,
            chi_tiet TEXT,                              -- JSON: điểm từng thành phần để minh bạch
            PRIMARY KEY (ky_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS kb_user_danh_hieu (  -- danh hiệu đã đạt (user_titles + honor_rolls)
            user_id INTEGER, ky_id INTEGER, ma_danh_hieu TEXT, hang INTEGER, trao_luc TEXT,
            PRIMARY KEY (user_id, ky_id)
        );
        CREATE TABLE IF NOT EXISTS kb_diem_tich_luy (   -- sổ cái điểm khoa bảng, mỗi dòng một lần cộng
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, ky_id INTEGER, diem INTEGER, ly_do TEXT, tao_luc TEXT,
            UNIQUE (user_id, ky_id, ly_do)              -- chốt 2 lần cũng không cộng trùng
        );
        CREATE TABLE IF NOT EXISTS kb_phuc_khao (       -- khiếu nại kết quả
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ky_id INTEGER, user_id INTEGER, noi_dung TEXT,
            trang_thai TEXT DEFAULT 'cho', ghi_chu_admin TEXT DEFAULT '', tao_luc TEXT
        );
        CREATE TABLE IF NOT EXISTS kb_vi_pham (         -- bất thường / vi phạm quy chế
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, ky_id INTEGER, ly_do TEXT, bai_key TEXT,
            trang_thai TEXT DEFAULT 'cho_duyet',        -- cho_duyet | xac_nhan | bo_qua
            tao_luc TEXT
        );
    ''')
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS kb_nhat_ky (         -- nhật ký thao tác quản trị (mở lại kỳ, chỉnh kết quả...)
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thoi_diem TEXT, hanh_dong TEXT, ky_id INTEGER, ghi_chu TEXT
        );
    ''')
    # DB cũ thiếu cột nào thì thêm (không mất dữ liệu)
    if 'khao_hach_id' not in [c[1] for c in conn.execute("PRAGMA table_info(kb_ky)")]:
        conn.execute("ALTER TABLE kb_ky ADD COLUMN khao_hach_id INTEGER")   # cuộc thi Khảo hạch của kỳ Hội
    cot_ct = [c[1] for c in conn.execute("PRAGMA table_info(contests)")]
    if cot_ct and 'loai' not in cot_ct:                                       # contests: '' | hoi | dinh | khao_hach
        conn.execute("ALTER TABLE contests ADD COLUMN loai TEXT DEFAULT ''")
    # nạp danh mục + cấu hình mặc định (đã có thì giữ nguyên, không ghi đè chỉnh sửa của admin)
    conn.executemany("INSERT OR IGNORE INTO kb_danh_hieu (ma, ten, cap, giap, thu_tu, diem_tich_luy) VALUES (?,?,?,?,?,?)", DANH_HIEU)
    for khoa, gt in CAU_HINH_MAC_DINH.items():
        conn.execute("INSERT OR IGNORE INTO kb_cau_hinh (khoa, gia_tri) VALUES (?, ?)", (khoa, json.dumps(gt)))
    conn.commit()
    conn.close()

dam_bao_bang()


def doc_cau_hinh(conn, cap):
    """Cấu hình của 1 cấp: lấy từ DB, khoá nào thiếu thì dùng mặc định."""
    cfg = json.loads(json.dumps(CAU_HINH_MAC_DINH[cap]))
    row = conn.execute("SELECT gia_tri FROM kb_cau_hinh WHERE khoa = ?", (cap,)).fetchone()
    if row:
        try:
            cfg.update(json.loads(row[0]))
        except ValueError:
            pass
    return cfg


# ====================== KỲ THI: tuần / tháng / quý ======================
def khoang_ky(cap, ngay=None):
    """Trả về (mã kỳ, ngày bắt đầu, ngày kết thúc) của kỳ chứa `ngay`.
    Tuần: Thứ Hai -> Chủ Nhật. Tháng và quý theo lịch dương."""
    ngay = ngay or date.today()
    if cap == "huong":
        bd = ngay - timedelta(days=ngay.weekday())
        kt = bd + timedelta(days=6)
        nam, tuan, _ = bd.isocalendar()
        return f"{nam}-W{tuan:02d}", bd, kt
    if cap == "hoi":
        bd = ngay.replace(day=1)
        kt = (bd + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        return f"{ngay.year}-{ngay.month:02d}", bd, kt
    if cap == "dinh":
        q = (ngay.month - 1) // 3
        bd = date(ngay.year, q * 3 + 1, 1)
        kt = (date(ngay.year + (q == 3), (q * 3 + 3) % 12 + 1, 1)) - timedelta(days=1)
        return f"{ngay.year}-Q{q + 1}", bd, kt
    raise ValueError("cap phải là huong, hoi hoặc dinh")


def ky_truoc(cap, bd):
    """Kỳ liền trước kỳ bắt đầu ở ngày bd."""
    return khoang_ky(cap, bd - timedelta(days=1))


def con_lai_den_het_ky(kt):
    """Số giây còn lại đến hết ngày kết thúc (để đếm ngược trên giao diện)."""
    het = datetime.combine(kt, datetime.max.time())
    return max(0, int((het - datetime.now()).total_seconds()))


# ====================== GHI LOG HOẠT ĐỘNG (app.py gọi) ======================
def ghi_hoat_dong(user_id, bai_key, ket_qua, pct):
    """Gọi trong /api/submit sau khi chấm xong. Chỉ ghi khi có ít nhất 1 câu được trả lời.
    ket_qua = {cau_id: {"dung": True/False/None, ...}}.  Không bao giờ làm hỏng việc nộp bài (lỗi thì bỏ qua)."""
    try:
        uid = int(user_id)
        so_cau = len(ket_qua)
        so_tra_loi = sum(1 for r in ket_qua.values() if r.get("dung") is not None)
        if not so_cau or not so_tra_loi:
            return
        so_dung = sum(1 for r in ket_qua.values() if r.get("dung"))
        bay_gio = datetime.now()
        conn = sqlite3.connect(DB_PATH)
        if not conn.execute("SELECT 1 FROM users WHERE id = ?", (uid,)).fetchone():
            conn.close()
            return
        # phát hiện nộp bất thường: 2 lần nộp bài dài cách nhau quá ngắn -> chờ admin duyệt
        truoc = conn.execute("SELECT thoi_diem FROM kb_hoat_dong WHERE user_id = ? ORDER BY id DESC LIMIT 1", (uid,)).fetchone()
        if truoc and so_cau >= 5:
            khoang = (bay_gio - datetime.strptime(truoc[0], "%Y-%m-%d %H:%M:%S")).total_seconds()
            if khoang < GIAY_NOP_NHANH:
                conn.execute("INSERT INTO kb_vi_pham (user_id, ky_id, ly_do, bai_key, tao_luc) VALUES (?, NULL, ?, ?, ?)",
                             (uid, f"Nộp 2 bài cách nhau {khoang:.1f} giây", bai_key, bay_gio.strftime("%Y-%m-%d %H:%M:%S")))
        conn.execute(
            "INSERT INTO kb_hoat_dong (user_id, bai_key, thoi_diem, ngay, so_cau, so_tra_loi, so_dung, pct) VALUES (?,?,?,?,?,?,?,?)",
            (uid, bai_key, bay_gio.strftime("%Y-%m-%d %H:%M:%S"), str(bay_gio.date()), so_cau, so_tra_loi, so_dung, int(pct)))
        conn.commit()
        conn.close()
    except Exception as e:      # log lỗi ra terminal nhưng không chặn học sinh
        print("[khoa_bang] không ghi được hoạt động:", e)


# ====================== THI HƯƠNG: TÍNH ĐIỂM ======================
def lam_muot(tong_pct, n, k, prior):
    """Trung bình có làm mượt Bayes: làm 1 bài 100% chỉ đạt (100 + k*prior)/(1 + k), không vượt người làm đều 20 bài."""
    return (tong_pct + k * prior) / (n + k) if (n + k) else prior


def _thong_ke_huong(conn, uid, bd, kt, cfg):
    """Gom số liệu thô của 1 học sinh trong khoảng [bd, kt]."""
    rows = conn.execute(
        "SELECT id, bai_key, so_cau, so_tra_loi, so_dung, pct, thoi_diem, ngay FROM kb_hoat_dong "
        "WHERE user_id = ? AND ngay BETWEEN ? AND ? AND so_tra_loi > 0 ORDER BY id",
        (uid, str(bd), str(kt))).fetchall()
    dau, tot = {}, {}                       # dau: lần nộp ĐẦU của mỗi bài, tot: % cao nhất của mỗi bài
    for r in rows:
        dau.setdefault(r[1], r)
        tot[r[1]] = max(tot.get(r[1], 0), r[5])
    n = len(tot)
    luyen_de = lam_muot(sum(tot.values()), n, cfg["prior_k"], cfg["prior_pct"])
    tra_loi = sum(r[3] for r in dau.values())
    so_cau = sum(r[2] for r in dau.values())
    so_ngay = len({r[7] for r in rows})
    so_ngay_ky = (kt - bd).days + 1
    return {
        "n_bai": n,
        "luyen_de": luyen_de,                                                    # 0-100
        "chinh_xac": (100 * sum(r[4] for r in dau.values()) / tra_loi) if tra_loi else 0,
        "hoan_thanh": (100 * tra_loi / so_cau) if so_cau else 0,
        "chuyen_can": min(100, 100 * so_ngay / so_ngay_ky),
        "lan_cuoi": rows[-1][6] if rows else "9999",
    }


def tinh_diem_huong(conn, uid, bd, kt, cfg=None):
    """Điểm Thi Hương (0-100) + chi tiết từng thành phần. cfg mặc định đọc từ DB."""
    cfg = cfg or doc_cau_hinh(conn, "huong")
    w = cfg["trong_so"]
    tk = _thong_ke_huong(conn, uid, bd, kt, cfg)

    # Tiến bộ: so với tuần trước. Chưa có tuần trước (học sinh mới) thì để trung tính 50, không bị phạt.
    _, bd0, kt0 = ky_truoc("huong", bd)
    cu = _thong_ke_huong(conn, uid, bd0, kt0, cfg)
    tien_bo = 50.0 if cu["n_bai"] == 0 else max(0.0, min(100.0, 50 + 2 * (tk["luyen_de"] - cu["luyen_de"])))

    chinh_xac_hoan_thanh = (tk["chinh_xac"] + tk["hoan_thanh"]) / 2             # mục 25%: gộp độ chính xác + mức hoàn thành
    tp = {"luyen_de": tk["luyen_de"], "chinh_xac": chinh_xac_hoan_thanh,
          "chuyen_can": tk["chuyen_can"], "tien_bo": tien_bo}
    tong = sum(w[k] * tp[k] for k in w) / sum(w.values())
    return {"diem_tong": round(tong, 4), "thanh_phan": {k: round(v, 2) for k, v in tp.items()},
            "n_bai": tk["n_bai"], "chinh_xac": round(tk["chinh_xac"], 2), "lan_cuoi": tk["lan_cuoi"]}


def xep_hang_huong(conn, ngay=None, bang="khong-chuyen"):
    """Bảng xếp hạng Thi Hương của tuần chứa `ngay`, trong 1 nhóm (không chuyên / toán / ...).
    Chỉ xếp người đủ số bài tối thiểu. Đồng điểm xử lý xác định, không ngẫu nhiên:
    điểm tổng -> luyện đề -> độ chính xác -> chuyên cần -> hoạt động cuối sớm hơn -> user_id."""
    cfg = doc_cau_hinh(conn, "huong")
    ma, bd, kt = khoang_ky("huong", ngay)
    mon = BANG_XEP_HANG[bang][1]
    ids = [r[0] for r in conn.execute(
        "SELECT DISTINCT h.user_id FROM kb_hoat_dong h JOIN users u ON u.id = h.user_id "
        "WHERE h.ngay BETWEEN ? AND ? AND COALESCE(u.mon_chuyen, '') = ?", (str(bd), str(kt), mon))]
    ds = []
    for uid in ids:
        d = tinh_diem_huong(conn, uid, bd, kt, cfg)
        if d["n_bai"] >= cfg["toi_thieu_bai"]:
            d["user_id"] = uid
            ds.append(d)
    ds.sort(key=lambda d: (-d["diem_tong"], -d["thanh_phan"]["luyen_de"], -d["chinh_xac"],
                           -d["thanh_phan"]["chuyen_can"], d["lan_cuoi"], d["user_id"]))
    for i, d in enumerate(ds):
        d["hang"] = i + 1
    return {"ma": ma, "bat_dau": str(bd), "ket_thuc": str(kt), "ds": ds}


# ====================== THI HỘI / THI ĐÌNH: CÔNG THỨC ======================
# Các đầu vào đều đã quy về thang 0-100. Giai đoạn 3 sẽ lấy dữ liệu từ contests + kb_ket_qua đã khóa.
def _co_trong_so(w, tp):
    return round(sum(w[k] * tp[k] for k in w) / sum(w.values()), 4)


def tinh_diem_hoi(thi_hoi, thi_huong_tb, tien_bo, cfg):
    """70% bài thi Hội + 20% TB Thi Hương trong tháng + 10% tiến bộ."""
    return _co_trong_so(cfg["trong_so"], {"thi_hoi": thi_hoi, "thi_huong": thi_huong_tb, "tien_bo": tien_bo})


def tinh_diem_dinh(thi_dinh, hoi_tb, huong_tb, cfg):
    """60% bài thi Đình + 25% TB ba kỳ Hội + 15% TB Thi Hương trong quý."""
    return _co_trong_so(cfg["trong_so"], {"thi_dinh": thi_dinh, "thi_hoi": hoi_tb, "thi_huong": huong_tb})


def du_dieu_kien_dinh(so_ky_hoi, diem_dinh_tho, co_vi_pham, cfg):
    """Thi Đình: đủ số kỳ Hội, đạt điểm tối thiểu, không vi phạm."""
    return so_ky_hoi >= cfg["toi_thieu_ky_hoi"] and diem_dinh_tho >= cfg["diem_san"] and not co_vi_pham


# ====================== CHIA DANH HIỆU ======================
def trao_danh_hieu(bang_xep_hang, cfg):
    """bang_xep_hang: list dict đã sắp theo hạng, mỗi dict có 'user_id' và 'diem_tong'.
    Trả về list (user_id, ma_danh_hieu, hang). Quy tắc:
      - Dưới `toi_thieu_thi_sinh` người đủ điều kiện: không trao ai.
      - Người dưới `diem_san` không bao giờ nhận.
      - Số suất: so_luong cố định, hoặc ty_le x số người đủ điều kiện (làm tròn, tối thiểu 1).
    Không mặc định ai tham gia cũng có danh hiệu."""
    du = [d for d in bang_xep_hang if d["diem_tong"] >= cfg["diem_san"]]
    if len(du) < cfg["toi_thieu_thi_sinh"]:
        return []
    ket_qua, vi_tri = [], 0
    for bac in cfg["danh_hieu"]:
        suat = bac["so_luong"] if "so_luong" in bac else max(1, int(math.floor(bac["ty_le"] * len(du) + 0.5)))
        for d in du[vi_tri: vi_tri + suat]:
            ket_qua.append((d["user_id"], bac["ma"], d["hang"]))
        vi_tri += suat
        if vi_tri >= len(du):
            break
    return ket_qua


# ======================================================================
# PHẦN 3: KỲ THI, CHỐT KỲ, TOKEN, API
# ======================================================================
import os
import secrets
import threading
import time

from flask import jsonify, request
from itsdangerous import BadSignature, URLSafeTimedSerializer

GOC = os.path.dirname(os.path.abspath(__file__))
FILE_KHOA = os.path.join(GOC, '..', 'Database', 'kb_secret.key')   # khóa ký token, sinh tự động lần đầu (KHÔNG commit)
THU_MUC_DAP_AN = os.path.join(GOC, '..', 'Dap_an')
HAN_TOKEN = 30 * 24 * 3600          # token sống 30 ngày
HAN_PHUC_KHAO_NGAY = 7              # được phúc khảo trong 7 ngày sau khi kỳ kết thúc
CAP = ("huong", "hoi", "dinh")
TEN_CAP = {"huong": "Thi Hương", "hoi": "Thi Hội", "dinh": "Thi Đình"}
CHU_KY = {"huong": "Hằng tuần", "hoi": "Hằng tháng", "dinh": "Hằng quý"}
# (tên đầy đủ, tên ngắn) của từng thành phần điểm
NHAN_TP = {
    "huong": {"luyen_de": ("Kết quả luyện đề, bài kiểm tra", "Luyện đề"),
              "chinh_xac": ("Độ chính xác và mức độ hoàn thành", "Chính xác"),
              "chuyen_can": ("Chuyên cần, duy trì học tập", "Chuyên cần"),
              "tien_bo": ("Tiến bộ so với kết quả trước", "Tiến bộ")},
    "hoi": {"thi_hoi": ("Bài thi Hội chính thức", "Bài thi"),
            "thi_huong": ("Thành tích Thi Hương trong tháng", "Thi Hương"),
            "tien_bo": ("Tiến bộ học tập", "Tiến bộ")},
    "dinh": {"thi_dinh": ("Bài thi Đình chính thức", "Bài thi"),
             "thi_hoi": ("Thành tích các kỳ Thi Hội trong quý", "Thi Hội"),
             "thi_huong": ("Thành tích Thi Hương trong quý", "Thi Hương")},
}


# ---------------------------------------------------------------- token
def _khoa_bi_mat():
    try:
        with open(FILE_KHOA) as f:
            s = f.read().strip()
        if s:
            return s
    except OSError:
        pass
    s = secrets.token_hex(32)
    with open(FILE_KHOA, "w") as f:
        f.write(s)
    return s

_SER = URLSafeTimedSerializer(_khoa_bi_mat(), salt="kb-token")

def tao_token(user_id):
    """app.py gọi khi đăng nhập thành công, gửi kèm cho trình duyệt."""
    return _SER.dumps({"uid": int(user_id)})

def uid_tu_token():
    """Đọc user_id từ header 'Authorization: Bearer <token>'. Sai/hết hạn -> None."""
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        return None
    try:
        return int(_SER.loads(h[7:], max_age=HAN_TOKEN)["uid"])
    except (BadSignature, KeyError, ValueError, TypeError):
        return None


# ---------------------------------------------------------------- hàm dùng chung
def _ket_noi():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def _loi(msg, ma=400):
    return jsonify({"success": False, "message": msg}), ma

def _bay_gio():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _d(s):
    return date.fromisoformat(s)

def han_chot(cap, kt):
    """Ngày cuối cùng còn 'chưa chốt'. Thi Hội/Đình phải đợi tuần chứa ngày cuối kỳ kết thúc,
    vì tuần đó (tính theo ngày bắt đầu tuần) thuộc về tháng/quý này."""
    return kt if cap == "huong" else khoang_ky("huong", kt)[2]

def _bi_loai(conn, bd, kt):
    """Học sinh bị admin XÁC NHẬN vi phạm trong kỳ: không được xếp hạng."""
    return {r[0] for r in conn.execute(
        "SELECT DISTINCT user_id FROM kb_vi_pham WHERE trang_thai = 'xac_nhan' AND substr(tao_luc, 1, 10) BETWEEN ? AND ?",
        (str(bd), str(kt)))}


# ---------------------------------------------------------------- cuộc thi Hội / Đình (dùng lại bảng contests)
def _tim_cuoc_thi(conn, loai, bd, kt):
    try:
        r = conn.execute("SELECT id FROM contests WHERE loai = ? AND substr(bat_dau, 1, 10) BETWEEN ? AND ? "
                         "ORDER BY bat_dau DESC LIMIT 1", (loai, str(bd), str(kt))).fetchone()
    except sqlite3.Error:
        return None
    return r[0] if r else None

def _tong_diem_cuoc_thi(cid):
    try:
        with open(os.path.join(THU_MUC_DAP_AN, "contest", f"{cid}.json"), encoding="utf-8-sig") as f:
            data = json.load(f)
        return sum(v.get("diem", 10) for v in data.values()) or None
    except (OSError, ValueError, AttributeError):
        return None

def _ket_qua_cuoc_thi(conn, cid, bang):
    """{user_id: % điểm} của 1 cuộc thi, chỉ lấy học sinh thuộc nhóm `bang`."""
    tong = _tong_diem_cuoc_thi(cid)
    if not cid or not tong:
        return {}
    try:
        rows = conn.execute(
            "SELECT k.user_id, k.diem FROM contest_ket_qua k JOIN users u ON u.id = k.user_id "
            "WHERE k.contest_id = ? AND COALESCE(u.mon_chuyen, '') = ?", (cid, BANG_XEP_HANG[bang][1])).fetchall()
    except sqlite3.Error:
        return {}
    return {r[0]: min(100.0, 100.0 * r[1] / tong) for r in rows}


# ---------------------------------------------------------------- tạo kỳ
def lay_hoac_tao_ky(conn, cap, bang, ngay=None):
    """Lấy (hoặc tạo) kỳ chứa `ngay` của 1 nhóm. Kỳ còn mở thì tự gắn cuộc thi Hội/Đình/Khảo hạch nếu có."""
    ma, bd, kt = khoang_ky(cap, ngay)
    conn.execute("INSERT OR IGNORE INTO kb_ky (cap, ma, bat_dau, ket_thuc, bang) VALUES (?,?,?,?,?)",
                 (cap, ma, str(bd), str(kt), bang))
    ky = conn.execute("SELECT * FROM kb_ky WHERE cap = ? AND ma = ? AND bang = ?", (cap, ma, bang)).fetchone()
    if ky["trang_thai"] == "mo" and cap in ("hoi", "dinh"):
        if ky["contest_id"] is None:
            cid = _tim_cuoc_thi(conn, cap, bd, kt)
            if cid:
                conn.execute("UPDATE kb_ky SET contest_id = ? WHERE id = ?", (cid, ky["id"]))
        if cap == "hoi" and ky["khao_hach_id"] is None:
            cid = _tim_cuoc_thi(conn, "khao_hach", bd, kt)
            if cid:
                conn.execute("UPDATE kb_ky SET khao_hach_id = ? WHERE id = ?", (cid, ky["id"]))
        ky = conn.execute("SELECT * FROM kb_ky WHERE id = ?", (ky["id"],)).fetchone()
    return ky

def tao_ky_con_thieu(conn):
    """Tạo các kỳ từ ngày có dữ liệu đầu tiên đến nay (cho mọi nhóm) để chốt được cả khi không ai gọi API."""
    dau = [conn.execute("SELECT MIN(ngay) FROM kb_hoat_dong").fetchone()[0]]
    try:
        dau.append((conn.execute("SELECT MIN(substr(bat_dau, 1, 10)) FROM contests WHERE COALESCE(loai, '') != ''").fetchone()[0]))
    except sqlite3.Error:
        pass
    dau = [x for x in dau if x]
    hom_nay = date.today()
    d0 = _d(min(dau)) if dau else hom_nay
    for cap in CAP:
        d = d0
        while d <= hom_nay:
            for bang in BANG_XEP_HANG:
                lay_hoac_tao_ky(conn, cap, bang, d)
            d = khoang_ky(cap, d)[2] + timedelta(days=1)
    conn.commit()


# ---------------------------------------------------------------- tính kết quả 1 kỳ
def _tb_cac_ky(conn, cap_con, bang, bd, kt):
    """Điểm trung bình của từng học sinh qua các kỳ con ĐÃ CHỐT có ngày bắt đầu trong [bd, kt].
    Kỳ nào không tham gia tính 0 (chia cho tổng số kỳ). Trả về (tb, số kỳ, số kỳ đã tham gia)."""
    kys = [r[0] for r in conn.execute(
        "SELECT id FROM kb_ky WHERE cap = ? AND bang = ? AND trang_thai = 'da_khoa' AND bat_dau BETWEEN ? AND ?",
        (cap_con, bang, str(bd), str(kt)))]
    tong, dem = {}, {}
    for kid in kys:
        for r in conn.execute("SELECT user_id, diem_tong FROM kb_ket_qua WHERE ky_id = ?", (kid,)):
            tong[r[0]] = tong.get(r[0], 0) + r[1]
            dem[r[0]] = dem.get(r[0], 0) + 1
    n = len(kys)
    return ({u: t / n for u, t in tong.items()} if n else {}), n, dem

def tinh_ket_qua_ky(conn, ky):
    """Bảng xếp hạng của 1 kỳ: list dict {user_id, diem_tong, chi_tiet, hang}, đã sắp theo hạng.
    Dùng chung cho bảng TẠM TÍNH (kỳ đang mở) và khi CHỐT kỳ."""
    cap, bang = ky["cap"], ky["bang"]
    bd, kt = _d(ky["bat_dau"]), _d(ky["ket_thuc"])
    cfg = doc_cau_hinh(conn, cap)
    ds = []

    if cap == "huong":
        for d in xep_hang_huong(conn, bd, bang)["ds"]:
            ds.append({"user_id": d["user_id"], "diem_tong": d["diem_tong"],
                       "chi_tiet": {**d["thanh_phan"], "n_bai": d["n_bai"]}})

    elif cap == "hoi":
        kq = _ket_qua_cuoc_thi(conn, ky["contest_id"], bang)
        kh = _ket_qua_cuoc_thi(conn, ky["khao_hach_id"], bang) if ky["khao_hach_id"] else None
        huong_tb, _, _ = _tb_cac_ky(conn, "huong", bang, bd, kt)
        ma_truoc = khoang_ky("hoi", bd - timedelta(days=1))[0]
        truoc = conn.execute("SELECT id FROM kb_ky WHERE cap = 'hoi' AND ma = ? AND bang = ?", (ma_truoc, bang)).fetchone()
        pct_truoc = {}
        if truoc:
            for r in conn.execute("SELECT user_id, chi_tiet FROM kb_ket_qua WHERE ky_id = ?", (truoc["id"],)):
                pct_truoc[r[0]] = json.loads(r[1] or "{}").get("thi_hoi")
        for uid, pct in kq.items():
            if kh is not None and kh.get(uid, 0) < cfg["khao_hach_san"]:
                continue                       # chưa qua Khảo hạch
            cu = pct_truoc.get(uid)
            tien_bo = 50.0 if cu is None else max(0.0, min(100.0, 50 + (pct - cu)))
            tp = {"thi_hoi": pct, "thi_huong": huong_tb.get(uid, 0.0), "tien_bo": tien_bo}
            ds.append({"user_id": uid, "diem_tong": tinh_diem_hoi(tp["thi_hoi"], tp["thi_huong"], tp["tien_bo"], cfg),
                       "chi_tiet": {k: round(v, 2) for k, v in tp.items()}})
        ds.sort(key=lambda d: (-d["diem_tong"], -d["chi_tiet"]["thi_hoi"], d["user_id"]))

    else:   # dinh
        kq = _ket_qua_cuoc_thi(conn, ky["contest_id"], bang)
        hoi_tb, _, so_ky_hoi = _tb_cac_ky(conn, "hoi", bang, bd, kt)
        huong_tb, _, _ = _tb_cac_ky(conn, "huong", bang, bd, kt)
        vi_pham = _bi_loai(conn, bd, kt)
        for uid, pct in kq.items():
            if not du_dieu_kien_dinh(so_ky_hoi.get(uid, 0), pct, uid in vi_pham, cfg):
                continue
            tp = {"thi_dinh": pct, "thi_hoi": hoi_tb.get(uid, 0.0), "thi_huong": huong_tb.get(uid, 0.0)}
            ds.append({"user_id": uid, "diem_tong": tinh_diem_dinh(tp["thi_dinh"], tp["thi_hoi"], tp["thi_huong"], cfg),
                       "chi_tiet": {k: round(v, 2) for k, v in tp.items()}})
        ds.sort(key=lambda d: (-d["diem_tong"], -d["chi_tiet"]["thi_dinh"], d["user_id"]))

    loai = _bi_loai(conn, bd, kt)
    ds = [d for d in ds if d["user_id"] not in loai]
    for i, d in enumerate(ds):
        d["hang"] = i + 1
    return ds


# ---------------------------------------------------------------- CHỐT KỲ (idempotent)
def chot_ky(conn, ky_id):
    """Khóa kết quả kỳ, lưu hạng, trao danh hiệu, cộng điểm tích lũy. Gọi bao nhiêu lần cũng chỉ chốt đúng 1 lần.
    Trả về True nếu lần gọi này đã chốt kỳ."""
    ky = conn.execute("SELECT * FROM kb_ky WHERE id = ?", (ky_id,)).fetchone()
    if not ky or ky["trang_thai"] != "mo":
        return False
    if date.today() <= han_chot(ky["cap"], _d(ky["ket_thuc"])):
        return False                            # chưa hết kỳ
    try:
        # Đổi trạng thái TRƯỚC: 2 tiến trình cùng chốt thì chỉ 1 bên thắng
        if conn.execute("UPDATE kb_ky SET trang_thai = 'da_khoa' WHERE id = ? AND trang_thai = 'mo'", (ky_id,)).rowcount == 0:
            return False
        cfg = doc_cau_hinh(conn, ky["cap"])
        ds = tinh_ket_qua_ky(conn, ky)
        bay_gio = _bay_gio()
        for d in ds:
            conn.execute("INSERT OR REPLACE INTO kb_ket_qua (ky_id, user_id, diem_tong, hang, chi_tiet) VALUES (?,?,?,?,?)",
                         (ky_id, d["user_id"], d["diem_tong"], d["hang"], json.dumps(d["chi_tiet"])))
            conn.execute("INSERT OR IGNORE INTO kb_tham_gia (ky_id, user_id, tao_luc) VALUES (?,?,?)", (ky_id, d["user_id"], bay_gio))
        for uid, ma, hang in trao_danh_hieu(ds, cfg):
            conn.execute("INSERT OR REPLACE INTO kb_user_danh_hieu (user_id, ky_id, ma_danh_hieu, hang, trao_luc) VALUES (?,?,?,?,?)",
                         (uid, ky_id, ma, hang, bay_gio))
            diem = conn.execute("SELECT diem_tich_luy FROM kb_danh_hieu WHERE ma = ?", (ma,)).fetchone()[0]
            conn.execute("INSERT OR IGNORE INTO kb_diem_tich_luy (user_id, ky_id, diem, ly_do, tao_luc) VALUES (?,?,?,?,?)",
                         (uid, ky_id, diem, ma, bay_gio))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise

def chot_tat_ca(conn):
    """Tạo kỳ còn thiếu rồi chốt mọi kỳ đã hết hạn, theo thứ tự Hương -> Hội -> Đình (kỳ sau cần kết quả kỳ trước)."""
    tao_ky_con_thieu(conn)
    da_chot = []
    for cap in CAP:
        for ky in conn.execute("SELECT id FROM kb_ky WHERE cap = ? AND trang_thai = 'mo' ORDER BY bat_dau", (cap,)).fetchall():
            if chot_ky(conn, ky["id"]):
                da_chot.append(ky["id"])
    return da_chot

def mo_lai_ky(conn, ky_id, ly_do):
    """ADMIN: hủy kết quả đã khóa của 1 kỳ để tính lại (sau phúc khảo / xử lý vi phạm). Có ghi nhật ký.
    Lưu ý: các kỳ lớn hơn dùng kỳ này (Hội, Đình) cần được mở lại và chốt lại theo thứ tự."""
    for bang in ("kb_ket_qua", "kb_user_danh_hieu", "kb_diem_tich_luy", "kb_tham_gia"):
        conn.execute(f"DELETE FROM {bang} WHERE ky_id = ?", (ky_id,))
    conn.execute("UPDATE kb_ky SET trang_thai = 'mo' WHERE id = ?", (ky_id,))
    conn.execute("INSERT INTO kb_nhat_ky (thoi_diem, hanh_dong, ky_id, ghi_chu) VALUES (?, 'mo_lai', ?, ?)", (_bay_gio(), ky_id, ly_do))
    conn.commit()

_KHOA_CHOT, _LAN_CHOT = threading.Lock(), [0.0]

def _chot_luoi(giay=60):
    """'Chốt lười': mỗi lần có người xem, tối đa 1 phút/lần kiểm tra và chốt kỳ đã hết hạn."""
    if time.time() - _LAN_CHOT[0] < giay or not _KHOA_CHOT.acquire(blocking=False):
        return
    try:
        _LAN_CHOT[0] = time.time()
        conn = _ket_noi()
        try:
            chot_tat_ca(conn)
        finally:
            conn.close()
    except Exception as e:
        print("[khoa_bang] chốt kỳ lỗi:", e)
    finally:
        _KHOA_CHOT.release()


# ---------------------------------------------------------------- dữ liệu cho giao diện
def _gan_ten(conn, ds):
    if not ds:
        return
    ids = [d["user_id"] for d in ds]
    m = {r["id"]: r for r in conn.execute(f"SELECT id, username, avatar FROM users WHERE id IN ({','.join('?' * len(ids))})", ids)}
    for d in ds:
        u = m.get(d["user_id"])
        d["username"], d["avatar"] = (u["username"], u["avatar"] or "") if u else ("(đã xóa)", "")

def _ky_info(ky):
    kt = _d(ky["ket_thuc"])
    mo = ky["trang_thai"] == "mo"
    return {"id": ky["id"], "cap": ky["cap"], "ten": TEN_CAP[ky["cap"]], "ma": ky["ma"], "bang": ky["bang"],
            "bat_dau": ky["bat_dau"], "ket_thuc": ky["ket_thuc"], "trang_thai": ky["trang_thai"],
            "co_cuoc_thi": ky["contest_id"] is not None,
            "con_lai_giay": con_lai_den_het_ky(kt) if mo else 0}

def bang_cua_ky(conn, ky, gioi_han=50):
    """(danh sách, tổng số người, có phải tạm tính không). Kỳ đã khóa đọc bản lưu, kỳ đang mở tính trực tiếp."""
    cfg = doc_cau_hinh(conn, ky["cap"])
    ten_dh = {r["ma"]: r["ten"] for r in conn.execute("SELECT ma, ten FROM kb_danh_hieu")}
    if ky["trang_thai"] == "da_khoa":
        ds = [{"user_id": r["user_id"], "diem_tong": r["diem_tong"], "hang": r["hang"], "chi_tiet": json.loads(r["chi_tiet"] or "{}")}
              for r in conn.execute("SELECT user_id, diem_tong, hang, chi_tiet FROM kb_ket_qua WHERE ky_id = ? ORDER BY hang", (ky["id"],))]
        dh = {r[0]: r[1] for r in conn.execute("SELECT user_id, ma_danh_hieu FROM kb_user_danh_hieu WHERE ky_id = ?", (ky["id"],))}
        tam_tinh = False
    else:
        ds = tinh_ket_qua_ky(conn, ky)
        dh = {u: ma for u, ma, _ in trao_danh_hieu(ds, cfg)}
        tam_tinh = True
    tong = len(ds)
    ds = ds[:gioi_han]
    _gan_ten(conn, ds)
    for d in ds:
        ma = dh.get(d["user_id"])
        d["danh_hieu"] = {"ma": ma, "ten": ten_dh.get(ma, ma)} if ma else None
    return ds, tong, tam_tinh

def _danh_hieu_ky(conn, ky_id):
    return [dict(r) for r in conn.execute(
        "SELECT t.user_id, t.ma_danh_hieu AS ma, t.hang, d.ten, d.giap, d.thu_tu, u.username, u.avatar, r.diem_tong AS diem "
        "FROM kb_user_danh_hieu t JOIN kb_danh_hieu d ON d.ma = t.ma_danh_hieu JOIN users u ON u.id = t.user_id "
        "LEFT JOIN kb_ket_qua r ON r.ky_id = t.ky_id AND r.user_id = t.user_id "
        "WHERE t.ky_id = ? ORDER BY d.thu_tu, t.hang", (ky_id,))]

def quy_che(conn, cap):
    "Thi chính là một cuộc thi riêng trong tháng, nộp trong khung giờ quy định."
    cfg = doc_cau_hinh(conn, cap)
    dh = {r["ma"]: r for r in conn.execute("SELECT * FROM kb_danh_hieu")}
    tong = sum(cfg["trong_so"].values())
    cach = [{"ma": k, "nhan": NHAN_TP[cap][k][0], "ngan": NHAN_TP[cap][k][1], "ty_trong": round(100 * v / tong)}
            for k, v in cfg["trong_so"].items()]
    if cap == "huong":
        dk = ["Mọi học sinh có tài khoản đều được tham gia.",
              f"Cần hoàn thành ít nhất {cfg['toi_thieu_bai']} bài trong tuần để được xếp hạng.",
              "Điểm chỉ tính từ kết quả hệ thống tự chấm; độ chính xác tính theo lần nộp đầu tiên của mỗi bài trong tuần.",
              "Làm 1 bài điểm cao không đủ để dẫn đầu: kết quả luyện đề được làm mượt theo số bài đã làm."]
    elif cap == "hoi":
        dk = ["Thi chính là một cuộc thi riêng trong tháng (xem mục Tranh tài), nộp trong khung giờ quy định.",
              f"Nếu tháng có vòng Khảo hạch, cần đạt từ {cfg['khao_hach_san']}% để vào Thi chính.",
              f"Phúc khảo: gửi trong {HAN_PHUC_KHAO_NGAY} ngày sau khi kỳ thi kết thúc."]
    else:
        dk = [f"Đã tham gia ít nhất {cfg['toi_thieu_ky_hoi']} kỳ Thi Hội trong quý.",
              f"Điểm bài thi Đình từ {cfg['diem_san']}% trở lên.", "Không vi phạm quy chế thi."]
    thuong = []
    for bac in cfg["danh_hieu"]:
        r = dh[bac["ma"]]
        suat = "1 người" if bac.get("so_luong") == 1 else (f"{bac['so_luong']} người" if "so_luong" in bac
                else f"{round(bac['ty_le'] * 100)}% thí sinh đủ điều kiện (tối thiểu 1)")
        thuong.append({"ma": r["ma"], "ten": r["ten"], "giap": r["giap"], "suat": suat, "diem_tich_luy": r["diem_tich_luy"]})
    return {"chu_ky": CHU_KY[cap], "cach_tinh": cach, "dieu_kien": dk, "danh_hieu": thuong,
            "luu_y": f"Kỳ chỉ trao danh hiệu khi có ít nhất {cfg['toi_thieu_thi_sinh']} thí sinh đủ điều kiện và đạt từ {cfg['diem_san']} điểm."}

def _bang_hop_le(b):
    b = b or "khong-chuyen"
    return b if b in BANG_XEP_HANG else None


# ---------------------------------------------------------------- API (đọc: công khai, gửi phúc khảo: cần token)
@kb_bp.route("/api/khoa-bang/cau-hinh", methods=["GET"])
def api_cau_hinh():
    return jsonify({"success": True,
                    "bang": [{"id": k, "ten": v[0], "mon": v[1]} for k, v in BANG_XEP_HANG.items()],
                    "cap": [{"id": c, "ten": TEN_CAP[c], "chu_ky": CHU_KY[c]} for c in CAP]}), 200

@kb_bp.route("/api/khoa-bang/tong-quan", methods=["GET"])
def api_tong_quan():
    bang = _bang_hop_le(request.args.get("bang"))
    if not bang:
        return _loi("Nhóm thi không hợp lệ!")
    _chot_luoi()
    conn = _ket_noi()
    cacs = []
    for cap in CAP:
        ky = lay_hoac_tao_ky(conn, cap, bang)
        ds, tong, tam_tinh = bang_cua_ky(conn, ky, 5)
        cacs.append({"cap": cap, "ten": TEN_CAP[cap], "chu_ky": CHU_KY[cap], "ky": _ky_info(ky), "top": ds,
                     "tong": tong, "tam_tinh": tam_tinh, "nguoi_giu_ngoi": ds[0] if ds else None})
    conn.commit()
    noi_bat = []
    for cap in ("dinh", "hoi", "huong"):    # danh hiệu cao nhất của kỳ gần nhất đã chốt, mỗi cấp một dòng
        r = conn.execute("SELECT * FROM kb_ky WHERE cap = ? AND bang = ? AND trang_thai = 'da_khoa' "
                         "AND EXISTS (SELECT 1 FROM kb_user_danh_hieu WHERE ky_id = kb_ky.id) ORDER BY bat_dau DESC LIMIT 1",
                         (cap, bang)).fetchone()
        if r:
            noi_bat.append({"cap": cap, "ten": TEN_CAP[cap], "ma_ky": r["ma"], "ds": _danh_hieu_ky(conn, r["id"])[:3]})
    conn.close()
    return jsonify({"success": True, "cap": cacs, "noi_bat": noi_bat}), 200

@kb_bp.route("/api/khoa-bang/ky/<cap>", methods=["GET"])
def api_ky(cap):
    if cap not in TEN_CAP:
        return _loi("Cấp thi không tồn tại!", 404)
    bang = _bang_hop_le(request.args.get("bang"))
    if not bang:
        return _loi("Nhóm thi không hợp lệ!")
    _chot_luoi()
    conn = _ket_noi()
    hien_tai = lay_hoac_tao_ky(conn, cap, bang)
    conn.commit()
    ma = request.args.get("ma")
    ky = hien_tai
    if ma and ma != hien_tai["ma"]:
        ky = conn.execute("SELECT * FROM kb_ky WHERE cap = ? AND ma = ? AND bang = ?", (cap, ma, bang)).fetchone()
        if not ky:
            conn.close()
            return _loi("Không tìm thấy kỳ này!", 404)
    ds, tong, tam_tinh = bang_cua_ky(conn, ky, 50)
    lich_su = []
    for r in conn.execute("SELECT k.id, k.ma, k.bat_dau, k.ket_thuc FROM kb_ky k WHERE k.cap = ? AND k.bang = ? "
                          "AND k.trang_thai = 'da_khoa' AND EXISTS (SELECT 1 FROM kb_ket_qua WHERE ky_id = k.id) "
                          "ORDER BY k.bat_dau DESC LIMIT 12", (cap, bang)).fetchall():
        dau = conn.execute("SELECT u.username, q.diem_tong FROM kb_ket_qua q JOIN users u ON u.id = q.user_id "
                           "WHERE q.ky_id = ? AND q.hang = 1", (r["id"],)).fetchone()
        so = conn.execute("SELECT COUNT(*) FROM kb_ket_qua WHERE ky_id = ?", (r["id"],)).fetchone()[0]
        lich_su.append({"ma": r["ma"], "bat_dau": r["bat_dau"], "ket_thuc": r["ket_thuc"], "so_nguoi": so,
                        "nguoi_dau": dau["username"] if dau else None, "diem_dau": dau["diem_tong"] if dau else None})
    out = {"success": True, "ky": _ky_info(ky), "ma_hien_tai": hien_tai["ma"], "quy_che": quy_che(conn, cap),
           "ds": ds, "tong": tong, "tam_tinh": tam_tinh, "lich_su": lich_su}
    conn.close()
    return jsonify(out), 200

@kb_bp.route("/api/khoa-bang/vinh-danh", methods=["GET"])
def api_vinh_danh():
    """Bảng vàng: các kỳ Thi Đình đã chốt, mới nhất trước."""
    bang = _bang_hop_le(request.args.get("bang"))
    if not bang:
        return _loi("Nhóm thi không hợp lệ!")
    _chot_luoi()
    conn = _ket_noi()
    ds = []
    for ky in conn.execute("SELECT * FROM kb_ky WHERE cap = 'dinh' AND bang = ? AND trang_thai = 'da_khoa' "
                           "AND EXISTS (SELECT 1 FROM kb_user_danh_hieu WHERE ky_id = kb_ky.id) ORDER BY bat_dau DESC LIMIT 12",
                           (bang,)).fetchall():
        ds.append({"id": ky["id"], "ma": ky["ma"], "bat_dau": ky["bat_dau"], "ket_thuc": ky["ket_thuc"],
                   "danh_hieu": _danh_hieu_ky(conn, ky["id"])})
    conn.close()
    return jsonify({"success": True, "ds": ds}), 200

@kb_bp.route("/api/khoa-bang/ho-so/<int:uid>", methods=["GET"])
def api_ho_so(uid):
    conn = _ket_noi()
    u = conn.execute("SELECT id, username, avatar, bio FROM users WHERE id = ?", (uid,)).fetchone()
    if not u:
        conn.close()
        return _loi("Không tìm thấy học sinh!", 404)
    rows = conn.execute(
        "SELECT t.ma_danh_hieu AS ma, d.ten, d.cap, d.thu_tu, k.ma AS ky_ma FROM kb_user_danh_hieu t "
        "JOIN kb_danh_hieu d ON d.ma = t.ma_danh_hieu JOIN kb_ky k ON k.id = t.ky_id WHERE t.user_id = ?", (uid,)).fetchall()
    uu_tien = {"dinh": 0, "hoi": 1, "huong": 2}
    cao = min(rows, key=lambda r: (uu_tien[r["cap"]], r["thu_tu"])) if rows else None
    dem = {}
    for r in rows:
        dem.setdefault(r["ma"], {"ma": r["ma"], "ten": r["ten"], "cap": r["cap"], "thu_tu": r["thu_tu"], "so_lan": 0})["so_lan"] += 1
    diem = conn.execute("SELECT COALESCE(SUM(diem), 0) FROM kb_diem_tich_luy WHERE user_id = ?", (uid,)).fetchone()[0]
    hang = conn.execute("SELECT COUNT(*) FROM (SELECT SUM(diem) s FROM kb_diem_tich_luy GROUP BY user_id) WHERE s > ?", (diem,)).fetchone()[0] + 1
    lich_su = [dict(r) for r in conn.execute(
        "SELECT k.id AS ky_id, k.cap, k.ma, k.bang, k.ket_thuc, r.hang, r.diem_tong AS diem, d.ten AS danh_hieu "
        "FROM kb_ket_qua r JOIN kb_ky k ON k.id = r.ky_id "
        "LEFT JOIN kb_user_danh_hieu t ON t.ky_id = r.ky_id AND t.user_id = r.user_id "
        "LEFT JOIN kb_danh_hieu d ON d.ma = t.ma_danh_hieu WHERE r.user_id = ? ORDER BY k.bat_dau DESC, k.cap LIMIT 60", (uid,))]
    conn.close()
    return jsonify({"success": True, "data": {
        "user": dict(u), "tong_danh_hieu": len(rows), "cao_nhat": ({"ma": cao["ma"], "ten": cao["ten"], "ky_ma": cao["ky_ma"]} if cao else None),
        "dem": sorted(dem.values(), key=lambda x: (uu_tien[x["cap"]], x["thu_tu"])),
        "diem_tich_luy": diem, "hang_tich_luy": hang if diem else None, "lich_su": lich_su}}), 200

@kb_bp.route("/api/khoa-bang/phuc-khao", methods=["POST"])
def api_phuc_khao():
    """Học sinh khiếu nại kết quả 1 kỳ đã chốt. Cần token (đăng nhập lại để lấy token)."""
    uid = uid_tu_token()
    if not uid:
        return _loi("Hãy đăng xuất rồi đăng nhập lại để gửi phúc khảo.", 401)
    data = request.get_json(silent=True) or {}
    noi_dung = (data.get("noi_dung") or "").strip()
    if not (10 <= len(noi_dung) <= 500):
        return _loi("Nội dung phúc khảo cần từ 10 đến 500 ký tự!")
    conn = _ket_noi()
    ky = conn.execute("SELECT * FROM kb_ky WHERE id = ?", (data.get("ky_id"),)).fetchone()
    if not ky or ky["trang_thai"] != "da_khoa":
        conn.close()
        return _loi("Chỉ phúc khảo được kỳ đã có kết quả chính thức!", 409)
    if not conn.execute("SELECT 1 FROM kb_tham_gia WHERE ky_id = ? AND user_id = ?", (ky["id"], uid)).fetchone():
        conn.close()
        return _loi("Bạn không tham gia kỳ này!", 403)
    if date.today() > han_chot(ky["cap"], _d(ky["ket_thuc"])) + timedelta(days=HAN_PHUC_KHAO_NGAY):
        conn.close()
        return _loi(f"Đã quá hạn phúc khảo ({HAN_PHUC_KHAO_NGAY} ngày sau khi kỳ kết thúc)!", 409)
    if conn.execute("SELECT 1 FROM kb_phuc_khao WHERE ky_id = ? AND user_id = ?", (ky["id"], uid)).fetchone():
        conn.close()
        return _loi("Bạn đã gửi phúc khảo cho kỳ này rồi!", 409)
    conn.execute("INSERT INTO kb_phuc_khao (ky_id, user_id, noi_dung, tao_luc) VALUES (?,?,?,?)", (ky["id"], uid, noi_dung, _bay_gio()))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã nhận phúc khảo, ban quản trị sẽ xem xét."}), 200


# ====================== TỰ KIỂM TRA ======================
if __name__ == "__main__":
    # Chạy: py khoa_bang.py  -> kiểm tra các hàm thuần (không ghi gì vào database)
    print("Kỳ hôm nay:", {c: khoang_ky(c)[0] for c in ("huong", "hoi", "dinh")})
    assert khoang_ky("dinh", date(2026, 12, 31))[2] == date(2026, 12, 31)
    assert khoang_ky("hoi", date(2026, 2, 10))[2] == date(2026, 2, 28)
    assert lam_muot(100, 1, 3, 50) < lam_muot(80 * 20, 20, 3, 50)       # 1 bài 100% < 20 bài đều 80%
    bxh = [{"user_id": i, "diem_tong": 90 - i * 5, "hang": i + 1} for i in range(10)]
    cfg = CAU_HINH_MAC_DINH["huong"]
    print("Danh hiệu 10 người:", trao_danh_hieu(bxh, cfg))
    assert trao_danh_hieu(bxh[:2], cfg) == []                           # chưa đủ thí sinh
    print("OK")