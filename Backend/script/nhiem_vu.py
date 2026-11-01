# -*- coding: utf-8 -*-
"""
nhiem_vu.py - NHIỆM VỤ HẰNG NGÀY (file tự chứa, giống qua_tang.py: tự tạo bảng, app.py chỉ đăng ký blueprint)

Luật chơi:
  - Có 10 nhiệm vụ (DS_NV bên dưới), chia 3 độ khó: Dễ / Vừa / Khó.
  - Mỗi ngày mỗi người nhận 3 nhiệm vụ: đúng 1 Dễ + 1 Vừa + 1 Khó.
  - Sang ngày mới, 3 nhiệm vụ mới luôn KHÁC 3 nhiệm vụ của hôm qua.
  - Làm xong thì bấm "Nhận thưởng": điểm tùy độ khó. Nhận đủ cả 3 thì thêm 1 lượt quay.

Cách tính tiến độ (để thêm nhiệm vụ mới rất dễ):
  - Các chỗ khác trong web chỉ cần gọi ghi_su_kien(user_id, "ten_su_kien") là bộ đếm của HÔM NAY tăng lên.
  - Mỗi nhiệm vụ khai báo "đo bằng bộ đếm nào" và "mục tiêu bao nhiêu". Bộ đếm chạy ngầm cho mọi sự kiện,
    nên làm việc trước khi nhiệm vụ hiện ra thì tiến độ vẫn được tính.

API:
  GET  /api/nhiem-vu/<user_id>     3 nhiệm vụ hôm nay + tiến độ
  POST /api/nhiem-vu/nhan          nhận thưởng 1 nhiệm vụ  {user_id, nv_id}
  POST /api/nhiem-vu/su-kien       trình duyệt báo sự kiện (chỉ nhận "ly_thuyet")
"""
import random
import sqlite3
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH
import qua_tang  # noqa: F401  (import để chắc chắn bảng users đã có cột dd_last, luot_quay)

nhiem_vu_bp = Blueprint('nhiem_vu', __name__)

# ====================== CẤU HÌNH (chỉnh ở đây để cân bằng) ======================
THUONG = {
    "de":  {"ten": "Dễ",  "diem": 5},
    "vua": {"ten": "Vừa", "diem": 12},
    "kho": {"ten": "Khó", "diem": 25},
}
LUOT_QUAY_DU_3 = 1                    # nhận đủ 3 nhiệm vụ trong ngày thì được thêm ngần này lượt quay
THU_TU_KHO = ("de", "vua", "kho")

# do = cách đo tiến độ:
#   ("dd",)          : đã điểm danh hôm nay chưa (lấy thẳng từ bảng users, không cần sự kiện)
#   ("khoa", "xxx")  : giá trị bộ đếm xxx của hôm nay
#   ("tap", "yyy:")  : đếm số bộ đếm KHÁC NHAU bắt đầu bằng "yyy:" (vd số môn khác nhau, số bài khác nhau)
# can = điều kiện để nhiệm vụ được chọn (tránh giao việc không thể làm được):
#   "co_ky_nang" | "den_han_2" | "bai_chua_max"
DS_NV = [
    # ---- DỄ ----
    {"id": "diem_danh", "kho": "de", "icon": "fa-calendar-check", "muc_tieu": 1, "do": ("dd",),
     "ten": "Điểm danh hôm nay", "mo_ta": "Vào trang Quà tặng và bấm điểm danh.", "link": "qua.html"},
    {"id": "ly_thuyet", "kho": "de", "icon": "fa-book-open-reader", "muc_tieu": 1, "do": ("khoa", "ly_thuyet"),
     "ten": "Đọc lý thuyết", "mo_ta": "Mở phần lý thuyết của một bài học và đọc ít nhất 20 giây.", "link": "subjects.html"},
    {"id": "lam_2_bai", "kho": "de", "icon": "fa-pen", "muc_tieu": 2, "do": ("tap", "bai:"),
     "ten": "Làm 2 bài tập", "mo_ta": "Nộp 2 bài tập khác nhau (trả lời ít nhất một nửa số câu).", "link": "subjects.html"},
    # ---- VỪA ----
    {"id": "on_3_the", "kho": "vua", "icon": "fa-book-bookmark", "muc_tieu": 3, "do": ("khoa", "on_the"), "can": "co_ky_nang",
     "ten": "Ôn 3 thẻ trong Sổ lỗi sai", "mo_ta": "Làm 3 thẻ sửa lỗi hoặc thẻ chứng minh.", "link": "so-loi.html"},
    {"id": "dat_80", "kho": "vua", "icon": "fa-medal", "muc_tieu": 1, "do": ("khoa", "bai_80"),
     "ten": "Đạt từ 80% ở một bài", "mo_ta": "Nộp một bài tập và đạt từ 80% số điểm.", "link": "subjects.html"},
    {"id": "hai_mon", "kho": "vua", "icon": "fa-shuffle", "muc_tieu": 2, "do": ("tap", "mon:"),
     "ten": "Luyện 2 môn khác nhau", "mo_ta": "Nộp bài ở 2 môn học khác nhau trong cùng một ngày.", "link": "subjects.html"},
    {"id": "nang_hang", "kho": "vua", "icon": "fa-arrow-up-right-dots", "muc_tieu": 1, "do": ("khoa", "nang_hang"), "can": "bai_chua_max",
     "ten": "Làm lại để nâng điểm", "mo_ta": "Làm lại một bài đã làm và đạt % cao hơn lần trước.", "link": "subjects.html"},
    # ---- KHÓ ----
    {"id": "chung_minh", "kho": "kho", "icon": "fa-bullseye", "muc_tieu": 2, "do": ("khoa", "chung_minh"), "can": "den_han_2",
     "ten": "Chứng minh 2 kỹ năng", "mo_ta": "Vượt qua 2 thẻ chứng minh ở kỹ năng đã đến hạn: đúng ngay lần đầu, không gợi ý.", "link": "so-loi.html"},
    {"id": "tuyet_doi", "kho": "kho", "icon": "fa-gem", "muc_tieu": 1, "do": ("khoa", "bai_100"),
     "ten": "Đạt 100% một bài", "mo_ta": "Nộp một bài tập và đúng tất cả các câu.", "link": "subjects.html"},
    {"id": "dung_40", "kho": "kho", "icon": "fa-circle-check", "muc_tieu": 40, "do": ("khoa", "cau_dung"),
     "ten": "Trả lời đúng 40 câu", "mo_ta": "Cộng dồn số câu đúng trong ngày (mỗi bài chỉ tính lần nộp đầu tiên trong ngày).", "link": "subjects.html"},
]
NV = {n["id"]: n for n in DS_NV}

# Sự kiện mà trình duyệt được phép tự báo (chỉ những cái điểm thưởng thấp, không ảnh hưởng xếp hạng)
SU_KIEN_TU_TRINH_DUYET = ("ly_thuyet",)


# ====================== TẠO BẢNG ======================
def dam_bao_bang():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS nv_tien_do (   -- bộ đếm sự kiện theo từng ngày
            user_id INTEGER, ngay TEXT, khoa TEXT, gia_tri INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, ngay, khoa)
        );
        CREATE TABLE IF NOT EXISTS nv_ngay (      -- nhiệm vụ của từng ngày + đã nhận thưởng chưa
            user_id INTEGER, ngay TEXT, nv_id TEXT, da_nhan INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, ngay, nv_id)
        );
    ''')
    conn.close()

dam_bao_bang()


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _hom_nay():
    return str(date.today())

def _co_user(conn, user_id):
    return conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None

def _lay_user_id(data):
    try:
        return int(data.get('user_id'))
    except (TypeError, ValueError):
        return None


# ====================== GHI SỰ KIỆN (các file khác gọi) ======================
def ghi_su_kien(user_id, khoa, them=1, conn=None):
    """Cộng `them` vào bộ đếm `khoa` của hôm nay. Truyền conn nếu đang trong 1 giao dịch khác (tránh khóa DB)."""
    dong = conn is None
    if dong:
        conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO nv_tien_do (user_id, ngay, khoa, gia_tri) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(user_id, ngay, khoa) DO UPDATE SET gia_tri = gia_tri + excluded.gia_tri",
        (user_id, _hom_nay(), khoa, them))
    if dong:
        conn.commit()
        conn.close()

def _danh_dau_moi(conn, user_id, khoa):
    """Ghi 1 mốc 'chỉ tính một lần'. Trả về True nếu hôm nay đây là lần đầu."""
    cur = conn.execute("INSERT OR IGNORE INTO nv_tien_do (user_id, ngay, khoa, gia_tri) VALUES (?, ?, ?, 1)",
                       (user_id, _hom_nay(), khoa))
    return cur.rowcount == 1

def ghi_su_kien_nop_bai(user_id, subject, bai_key, ket_qua, pct, best_cu=None):
    """app.py gọi sau khi chấm 1 bài tập.
    ket_qua = dict kết quả từng câu {cau_id: {"dung": True/False/None, ...}}
    pct     = % điểm lần này; best_cu = % cao nhất trước đó (None nếu chưa làm bài này bao giờ)."""
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return
    so_cau = len(ket_qua)
    da_tra_loi = sum(1 for r in ket_qua.values() if r.get("dung") is not None)
    if not so_cau or da_tra_loi * 2 < so_cau:      # bỏ trống quá nửa: không tính (chống nộp bừa lấy nhiệm vụ)
        return
    so_dung = sum(1 for r in ket_qua.values() if r.get("dung"))

    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return
    lan_dau_hom_nay = _danh_dau_moi(conn, user_id, "bai:" + bai_key)   # bài khác nhau mới tính là bài mới
    _danh_dau_moi(conn, user_id, "mon:" + subject)
    if lan_dau_hom_nay:                                                # nộp lại cùng bài không cày thêm câu đúng
        ghi_su_kien(user_id, "cau_dung", so_dung, conn)
    if pct >= 80:
        ghi_su_kien(user_id, "bai_80", 1, conn)
    if pct >= 100:
        ghi_su_kien(user_id, "bai_100", 1, conn)
    if best_cu is not None and pct > best_cu:
        ghi_su_kien(user_id, "nang_hang", 1, conn)
    conn.commit()
    conn.close()


# ====================== CHỌN 3 NHIỆM VỤ MỖI NGÀY ======================
def _dem(conn, sql, *tham_so):
    try:
        return conn.execute(sql, tham_so).fetchone()[0]
    except sqlite3.Error:      # bảng chưa có (vd Sổ lỗi sai chưa khởi tạo) thì coi như 0
        return 0

def _du_dieu_kien(conn, user_id, nv):
    can = nv.get("can")
    if can == "co_ky_nang":
        return _dem(conn, "SELECT COUNT(*) FROM ky_nang_user WHERE user_id = ?", user_id) >= 1
    if can == "den_han_2":
        return _dem(conn, "SELECT COUNT(*) FROM ky_nang_user WHERE user_id = ? AND ngay_on_ke != '' AND ngay_on_ke <= ?",
                    user_id, _hom_nay()) >= 2
    if can == "bai_chua_max":
        return _dem(conn, "SELECT COUNT(*) FROM da_lam WHERE user_id = ? AND COALESCE(best_pct, 0) < 100", user_id) >= 1
    return True

def _doc_ds(conn, user_id, ngay):
    ids = {r["nv_id"] for r in conn.execute(
        "SELECT nv_id FROM nv_ngay WHERE user_id = ? AND ngay = ?", (user_id, ngay))} & set(NV)
    return sorted(ids, key=lambda i: THU_TU_KHO.index(NV[i]["kho"]))

def _chon_nv(conn, user_id, ngay):
    """Mỗi độ khó chọn 1 nhiệm vụ, không trùng hôm qua. Cùng (người, ngày) thì luôn ra cùng kết quả
    nên 2 lần tải trang cùng lúc cũng không sinh ra 2 bộ khác nhau."""
    hom_qua = str(date.fromisoformat(ngay) - timedelta(days=1))
    da_ra = set(_doc_ds(conn, user_id, hom_qua))
    rng = random.Random(f"{user_id}|{ngay}")
    chon = []
    for kho in THU_TU_KHO:
        cung_kho = [n for n in DS_NV if n["kho"] == kho]
        pool = [n for n in cung_kho if n["id"] not in da_ra and _du_dieu_kien(conn, user_id, n)]
        pool = pool or [n for n in cung_kho if _du_dieu_kien(conn, user_id, n)] or cung_kho   # kẹt thì nới dần
        chon.append(rng.choice(pool))
    return chon

def _ds_hom_nay(conn, user_id, ngay):
    """Trả về id các nhiệm vụ hôm nay (lần đầu trong ngày thì tự sinh)."""
    ids = _doc_ds(conn, user_id, ngay)
    if len(ids) < 3:
        for nv in _chon_nv(conn, user_id, ngay):
            conn.execute("INSERT OR IGNORE INTO nv_ngay (user_id, ngay, nv_id) VALUES (?, ?, ?)",
                         (user_id, ngay, nv["id"]))
        conn.commit()
        ids = _doc_ds(conn, user_id, ngay)
    return ids


# ====================== TIẾN ĐỘ + TRẠNG THÁI ======================
def _tien_do(conn, user_id, ngay, nv):
    kieu = nv["do"]
    if kieu[0] == "dd":
        r = conn.execute("SELECT dd_last FROM users WHERE id = ?", (user_id,)).fetchone()
        v = 1 if r and r[0] == ngay else 0
    elif kieu[0] == "khoa":
        r = conn.execute("SELECT gia_tri FROM nv_tien_do WHERE user_id = ? AND ngay = ? AND khoa = ?",
                         (user_id, ngay, kieu[1])).fetchone()
        v = r[0] if r else 0
    else:   # "tap"
        v = conn.execute("SELECT COUNT(*) FROM nv_tien_do WHERE user_id = ? AND ngay = ? AND khoa LIKE ?",
                         (user_id, ngay, kieu[1] + "%")).fetchone()[0]
    return min(v, nv["muc_tieu"])

def _trang_thai(conn, user_id):
    ngay = _hom_nay()
    ids = _ds_hom_nay(conn, user_id, ngay)
    nhan = {r["nv_id"]: r["da_nhan"] for r in conn.execute(
        "SELECT nv_id, da_nhan FROM nv_ngay WHERE user_id = ? AND ngay = ?", (user_id, ngay))}
    ds = []
    for nv_id in ids:
        nv = NV[nv_id]
        td = _tien_do(conn, user_id, ngay, nv)
        ds.append({
            "id": nv_id, "ten": nv["ten"], "mo_ta": nv["mo_ta"], "icon": nv["icon"], "link": nv["link"],
            "kho": nv["kho"], "ten_kho": THUONG[nv["kho"]]["ten"], "thuong_diem": THUONG[nv["kho"]]["diem"],
            "muc_tieu": nv["muc_tieu"], "tien_do": td,
            "xong": td >= nv["muc_tieu"], "da_nhan": bool(nhan.get(nv_id)),
        })
    return {
        "ngay": ngay, "ds": ds,
        "so_da_nhan": sum(1 for x in ds if x["da_nhan"]),
        "da_nhan_du_3": bool(nhan.get("_du3")),
        "thuong_du_3": {"luot_quay": LUOT_QUAY_DU_3},
    }


# ====================== API ======================
@nhiem_vu_bp.route('/api/nhiem-vu/<int:user_id>', methods=['GET'])
def xem_nhiem_vu(user_id):
    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    tt = _trang_thai(conn, user_id)
    conn.close()
    return jsonify({"success": True, "data": tt}), 200


@nhiem_vu_bp.route('/api/nhiem-vu/nhan', methods=['POST'])
def nhan_thuong():
    data = request.get_json(silent=True) or {}
    user_id, nv_id = _lay_user_id(data), data.get('nv_id')
    nv = NV.get(nv_id)
    if not user_id or not nv:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

    ngay = _hom_nay()
    if nv_id not in _ds_hom_nay(conn, user_id, ngay):
        conn.close()
        return jsonify({"success": False, "message": "Nhiệm vụ này không có trong hôm nay!"}), 403
    if _tien_do(conn, user_id, ngay, nv) < nv["muc_tieu"]:
        conn.close()
        return jsonify({"success": False, "message": "Bạn chưa hoàn thành nhiệm vụ này!"}), 409

    # Đánh dấu đã nhận NGAY trong 1 câu lệnh: bấm 2 lần cùng lúc thì chỉ 1 lần thắng (giống điểm danh)
    cur = conn.execute("UPDATE nv_ngay SET da_nhan = 1 WHERE user_id = ? AND ngay = ? AND nv_id = ? AND da_nhan = 0",
                       (user_id, ngay, nv_id))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"success": False, "message": "Bạn đã nhận thưởng nhiệm vụ này rồi!"}), 409

    diem = THUONG[nv["kho"]]["diem"]
    conn.execute("UPDATE users SET score = score + ? WHERE id = ?", (diem, user_id))

    # Nhận đủ 3 nhiệm vụ trong ngày -> thưởng thêm lượt quay (cũng chỉ được 1 lần/ngày)
    ids = _ds_hom_nay(conn, user_id, ngay)
    so_nhan = conn.execute(
        "SELECT COUNT(*) FROM nv_ngay WHERE user_id = ? AND ngay = ? AND da_nhan = 1 AND nv_id IN (%s)"
        % ",".join("?" * len(ids)), (user_id, ngay, *ids)).fetchone()[0]
    thuong_them = 0
    if so_nhan >= len(ids):
        cur = conn.execute("INSERT OR IGNORE INTO nv_ngay (user_id, ngay, nv_id, da_nhan) VALUES (?, ?, '_du3', 1)",
                           (user_id, ngay))
        if cur.rowcount == 1:
            conn.execute("UPDATE users SET luot_quay = luot_quay + ? WHERE id = ?", (LUOT_QUAY_DU_3, user_id))
            thuong_them = LUOT_QUAY_DU_3
    conn.commit()
    tt = _trang_thai(conn, user_id)
    conn.close()
    return jsonify({"success": True, "diem": diem, "luot_quay_them": thuong_them, "trang_thai": tt}), 200


@nhiem_vu_bp.route('/api/nhiem-vu/su-kien', methods=['POST'])
def bao_su_kien():
    data = request.get_json(silent=True) or {}
    user_id, loai = _lay_user_id(data), data.get('loai')
    if not user_id or loai not in SU_KIEN_TU_TRINH_DUYET:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400
    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    ghi_su_kien(user_id, loai, 1, conn)
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200