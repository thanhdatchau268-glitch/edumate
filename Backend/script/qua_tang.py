"""
Điểm danh 7 ngày + Vòng quay thưởng + Thẻ bảo hộ streak + Buff x1,5 điểm.

File này tự chứa mọi thứ của tính năng quà tặng:
  - tự thêm cột còn thiếu vào bảng users (không mất dữ liệu cũ)
  - các API: /api/users/<id>/qua, /api/diem-danh, /api/quay-thuong
  - hàm he_so_x15(user_id) để /api/submit nhân thêm điểm
"""
import random
import sqlite3
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH, streak_hien_thi

qua_bp = Blueprint('qua', __name__)

# ====================== CẤU HÌNH (chỉnh ở đây để cân bằng điểm) ======================
CHU_KY = 7                 # cứ 7 lần điểm danh thì được 1 lượt quay
TOI_DA_BAO_HO = 3          # giữ tối đa 3 thẻ bảo hộ cùng lúc
DIEM_DOI_THE_DAY = 15      # thẻ đã đầy mà trúng thẻ nữa thì đổi thành ngần này điểm
BUFF_X15_GIAY = 3600       # x1,5 điểm kéo dài 1 giờ
THUONG_X15 = 0.5           # +0.5 vào hệ số điểm (cộng dồn với thưởng streak, KHÔNG nhân)

# Quà 7 ngày đầu. loai: 'diem' | 'bao_ho' | 'quay'. Tổng điểm = 200 (dưới mốc 500)
QUA_TUAN_DAU = [
    {"ngay": 1, "loai": "diem",   "gia_tri": 20},
    {"ngay": 2, "loai": "diem",   "gia_tri": 30},
    {"ngay": 3, "loai": "diem",   "gia_tri": 40},
    {"ngay": 4, "loai": "bao_ho", "gia_tri": 1},
    {"ngay": 5, "loai": "diem",   "gia_tri": 50},
    {"ngay": 6, "loai": "diem",   "gia_tri": 60},
    {"ngay": 7, "loai": "quay",   "gia_tri": 1},   # ngày 7 = lượt quay (cấp bởi quy tắc 7 ngày)
]

# Vòng quay. w = trọng số (tổng 100 -> w chính là % trúng).
# Kỳ vọng điểm mỗi lượt = 0.25*10 + 0.10*20 + 0.02*50 = 5.5 điểm -> không gây lạm phát.
VONG_QUAY = [
    {"id": "hut",       "ten": "Hụt rồi, chúc may mắn!",   "w": 33},
    {"id": "diem10",    "ten": "+10 điểm",                 "w": 25, "diem": 10},
    {"id": "diem20",    "ten": "+20 điểm",                 "w": 10, "diem": 20},
    {"id": "diem50",    "ten": "+50 điểm",                 "w": 2,  "diem": 50},
    {"id": "bao_ho",    "ten": "Thẻ bảo hộ streak",        "w": 12},
    {"id": "x15",       "ten": "x1,5 điểm trong 1 giờ",    "w": 13},
    {"id": "them_luot", "ten": "Thêm 1 lượt quay",         "w": 5},
]
_RNG = random.SystemRandom()   # ngẫu nhiên an toàn, người dùng không đoán được

DINH_DANG_GIO = "%Y-%m-%d %H:%M:%S"


# ====================== TỰ THÊM CỘT ======================
def dam_bao_cot_qua():
    conn = sqlite3.connect(DB_PATH)
    cac_cot = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
    them = {
        'dd_tong':    "INTEGER DEFAULT 0",   # tổng số ngày đã điểm danh
        'dd_last':    "TEXT DEFAULT ''",     # ngày điểm danh gần nhất
        'the_bao_ho': "INTEGER DEFAULT 0",   # số thẻ bảo hộ streak đang có
        'luot_quay':  "INTEGER DEFAULT 0",   # số lượt quay đang có
        'x15_den':    "TEXT DEFAULT ''",     # buff x1,5 hết hạn lúc nào
    }
    for ten, kieu in them.items():
        if ten not in cac_cot:
            conn.execute(f"ALTER TABLE users ADD COLUMN {ten} {kieu}")
    conn.commit()
    conn.close()

dam_bao_cot_qua()


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _x15_con_lai(x15_den):
    """Số giây buff x1,5 còn lại (0 nếu hết hoặc chưa có)."""
    if not x15_den:
        return 0
    try:
        het = datetime.strptime(x15_den, DINH_DANG_GIO)
    except ValueError:
        return 0
    return max(0, int((het - datetime.now()).total_seconds()))

def he_so_x15(user_id):
    """Phần hệ số cộng thêm khi đang có buff x1,5 (0.5 hoặc 0). app.py gọi khi chấm điểm."""
    conn = _ket_noi()
    row = conn.execute("SELECT x15_den FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return THUONG_X15 if row and _x15_con_lai(row['x15_den']) > 0 else 0

def _ten_qua(q):
    if q["loai"] == "diem":
        return f"+{q['gia_tri']} điểm"
    if q["loai"] == "bao_ho":
        return "Thẻ bảo hộ streak"
    return "Vòng quay"

def _trang_thai(conn, user_id):
    u = conn.execute(
        "SELECT score, streak, last_active_date, dd_tong, dd_last, the_bao_ho, luot_quay, x15_den "
        "FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not u:
        return None
    tong = u['dd_tong'] or 0
    tien_do = ((tong - 1) % CHU_KY) + 1 if tong > 0 else 0     # đã điểm danh mấy ô trong vòng hiện tại
    tuan_dau = tong <= CHU_KY                                   # còn trong 7 ngày đầu thì hiện quà từng ngày

    lich = []
    for q in QUA_TUAN_DAU:
        if tuan_dau:
            ten = _ten_qua(q)
        else:   # các tuần sau: chỉ ô cuối có quà (lượt quay)
            ten = "Vòng quay" if q["ngay"] == CHU_KY else "Điểm danh"
        lich.append({"ngay": q["ngay"], "ten": ten, "da_nhan": q["ngay"] <= tien_do})

    return {
        "da_diem_danh_hom_nay": u['dd_last'] == str(date.today()),
        "tong_ngay": tong,
        "tien_do": tien_do,
        "tuan_dau": tuan_dau,
        "lich": lich,
        "luot_quay": u['luot_quay'] or 0,
        "the_bao_ho": u['the_bao_ho'] or 0,
        "toi_da_bao_ho": TOI_DA_BAO_HO,
        "x15_con_lai": _x15_con_lai(u['x15_den']),
        "score": u['score'],
        "streak": streak_hien_thi(u['streak'], u['last_active_date'], u['the_bao_ho'] or 0),
    }

def _cong_bao_ho(conn, user_id):
    """Cộng 1 thẻ bảo hộ. Trả về True nếu cộng được, False nếu đã đầy."""
    cur = conn.execute(
        "UPDATE users SET the_bao_ho = the_bao_ho + 1 WHERE id = ? AND the_bao_ho < ?",
        (user_id, TOI_DA_BAO_HO))
    return cur.rowcount == 1

def _cong_diem(conn, user_id, diem):
    conn.execute("UPDATE users SET score = score + ? WHERE id = ?", (diem, user_id))

def _lay_user_id():
    data = request.get_json(silent=True) or {}
    try:
        return int(data.get('user_id'))
    except (TypeError, ValueError):
        return None


# ====================== API ======================
# Xem trạng thái quà của 1 người dùng (kèm danh sách ô của vòng quay để vẽ)
@qua_bp.route('/api/users/<int:user_id>/qua', methods=['GET'])
def xem_qua(user_id):
    conn = _ket_noi()
    tt = _trang_thai(conn, user_id)
    conn.close()
    if not tt:
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    tt["vong_quay"] = [{"id": o["id"], "ten": o["ten"]} for o in VONG_QUAY]
    return jsonify({"success": True, "data": tt}), 200


# Điểm danh hôm nay
@qua_bp.route('/api/diem-danh', methods=['POST'])
def diem_danh():
    user_id = _lay_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Hãy đăng nhập để điểm danh!"}), 401

    hom_nay = str(date.today())
    conn = _ket_noi()
    # Đánh dấu hôm nay NGAY trong 1 câu lệnh: bấm 2 lần cùng lúc thì chỉ 1 lần thắng
    cur = conn.execute(
        "UPDATE users SET dd_last = ?, dd_tong = dd_tong + 1 "
        "WHERE id = ? AND COALESCE(dd_last, '') != ?", (hom_nay, user_id, hom_nay))
    if cur.rowcount == 0:
        co_user = conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        if not co_user:
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
        return jsonify({"success": False, "message": "Hôm nay bạn đã điểm danh rồi!"}), 409

    tong = conn.execute("SELECT dd_tong FROM users WHERE id = ?", (user_id,)).fetchone()[0]
    nhan = []   # danh sách quà nhận hôm nay để báo cho người dùng

    if tong <= CHU_KY:   # 7 ngày đầu: quà từng ngày
        q = QUA_TUAN_DAU[tong - 1]
        if q["loai"] == "diem":
            _cong_diem(conn, user_id, q["gia_tri"])
            nhan.append(f"+{q['gia_tri']} điểm")
        elif q["loai"] == "bao_ho":
            if _cong_bao_ho(conn, user_id):
                nhan.append("1 thẻ bảo hộ streak")
            else:
                _cong_diem(conn, user_id, DIEM_DOI_THE_DAY)
                nhan.append(f"+{DIEM_DOI_THE_DAY} điểm (thẻ bảo hộ đã đầy)")

    if tong % CHU_KY == 0:   # đủ 7 lần điểm danh -> 1 lượt quay (lặp lại mỗi 7 ngày)
        conn.execute("UPDATE users SET luot_quay = luot_quay + 1 WHERE id = ?", (user_id,))
        nhan.append("1 lượt quay vòng quay thưởng")

    if not nhan:
        nhan.append("Điểm danh thành công! Cố lên, sắp tới quà rồi")

    conn.commit()
    tt = _trang_thai(conn, user_id)
    conn.close()
    return jsonify({"success": True, "tong_ngay": tong, "nhan": nhan, "trang_thai": tt}), 200


# Quay thưởng (mỗi lượt trừ 1 lượt quay)
@qua_bp.route('/api/quay-thuong', methods=['POST'])
def quay_thuong():
    user_id = _lay_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Hãy đăng nhập để quay!"}), 401

    conn = _ket_noi()
    # Trừ lượt trước: có lượt thì mới quay được, bấm nhanh nhiều lần cũng không quay lố
    cur = conn.execute(
        "UPDATE users SET luot_quay = luot_quay - 1 WHERE id = ? AND luot_quay > 0", (user_id,))
    if cur.rowcount == 0:
        co_user = conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        if not co_user:
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
        return jsonify({"success": False, "message": "Bạn chưa có lượt quay nào!"}), 403

    trung = _RNG.choices(VONG_QUAY, weights=[o["w"] for o in VONG_QUAY])[0]
    ghi_chu = ""

    if trung["id"] in ("diem10", "diem20", "diem50"):
        _cong_diem(conn, user_id, trung["diem"])
    elif trung["id"] == "bao_ho":
        if not _cong_bao_ho(conn, user_id):
            _cong_diem(conn, user_id, DIEM_DOI_THE_DAY)
            ghi_chu = f"Thẻ bảo hộ đã đầy nên được đổi thành +{DIEM_DOI_THE_DAY} điểm"
    elif trung["id"] == "x15":
        row = conn.execute("SELECT x15_den FROM users WHERE id = ?", (user_id,)).fetchone()
        # đang có buff thì cộng nối thêm 1 giờ, chưa có thì tính từ bây giờ
        bat_dau = datetime.now() + timedelta(seconds=_x15_con_lai(row['x15_den']))
        het = bat_dau + timedelta(seconds=BUFF_X15_GIAY)
        conn.execute("UPDATE users SET x15_den = ? WHERE id = ?",
                     (het.strftime(DINH_DANG_GIO), user_id))
    elif trung["id"] == "them_luot":
        conn.execute("UPDATE users SET luot_quay = luot_quay + 1 WHERE id = ?", (user_id,))
    # "hut" thì không làm gì

    conn.commit()
    tt = _trang_thai(conn, user_id)
    conn.close()
    vi_tri = next(i for i, o in enumerate(VONG_QUAY) if o["id"] == trung["id"])
    return jsonify({"success": True, "trung": trung["id"], "ten": trung["ten"],
                    "vi_tri": vi_tri, "ghi_chu": ghi_chu, "trang_thai": tt}), 200