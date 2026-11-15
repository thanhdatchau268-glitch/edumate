# -*- coding: utf-8 -*-
"""
huy_hieu.py - HỆ THỐNG HUY HIỆU (7 huy hiệu chính thức)

Tự tạo bảng user_huy_hieu và đảm bảo cột users.huy_hieu tồn tại.
API:
  GET  /api/huy-hieu/<user_id>   kiểm tra mở khóa + trả danh sách 7 huy hiệu + trạng thái
  POST /api/huy-hieu/deo         đeo hoặc tháo huy hiệu { user_id, huy_hieu }
"""
import sqlite3
from datetime import datetime

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH, cong_diem_thang, streak_hien_thi

huy_hieu_bp = Blueprint('huy_hieu', __name__)

# ====================== CẤU HÌNH 7 HUY HIỆU CHÍNH THỨC ======================
DS_HUY_HIEU = [
    {
        "id": "buoc-chan-dau-tien",
        "ten": "Bước Chân Đầu Tiên",
        "mo_ta": "Hoàn thành ít nhất 1 bài tập có điểm.",
        "anh": "img/huy-hieu/buoc-chan-dau-tien.webp",
        "diem_thuong": 30,
    },
    {
        "id": "chuyen-can",
        "ten": "Chuyên Cần",
        "mo_ta": "Điểm danh tích lũy 7 ngày hoặc giữ chuỗi học 5 ngày liên tiếp.",
        "anh": "img/huy-hieu/chuyen-can.webp",
        "diem_thuong": 60,
    },
    {
        "id": "tich-tieu-thanh-dai",
        "ten": "Tích Tiểu Thành Đại",
        "mo_ta": "Hoàn thành trọn bộ Nhiệm vụ hằng ngày 3 ngày hoặc sửa 10 câu trong Sổ lỗi sai.",
        "anh": "img/huy-hieu/tich-tieu-thanh-dai.webp",
        "diem_thuong": 80,
    },
    {
        "id": "bach-phat-bach-trung",
        "ten": "Bách Phát Bách Trúng",
        "mo_ta": "Đạt 100% điểm ở ít nhất 5 bài tập khác nhau.",
        "anh": "img/huy-hieu/bach-phat-bach-trung.webp",
        "diem_thuong": 120,
    },
    {
        "id": "giai-nguyen",
        "ten": "Giải Nguyên",
        "mo_ta": "Đạt Giải Nguyên / Top 3 Khoa Bảng, Top 3 Cuộc thi đã kết thúc, hoặc Top 3 Bảng tháng (từ 300 điểm).",
        "anh": "img/huy-hieu/giai-nguyen.webp",
        "diem_thuong": 150,
    },
    {
        "id": "hoi-nguyen",
        "ten": "Hội Nguyên",
        "mo_ta": "Đạt danh hiệu Hội Nguyên (Khoa Bảng) hoặc tích lũy từ 1.500 điểm và đạt ≥ 80% ở ít nhất 15 bài tập.",
        "anh": "img/huy-hieu/hoi-nguyen.webp",
        "diem_thuong": 220,
    },
    {
        "id": "trang-nguyen",
        "ten": "Trạng Nguyên",
        "mo_ta": "Đạt danh hiệu Trạng Nguyên (Thi Đình) hoặc giữ Top 1 Bảng Vàng Tổng với ≥ 3.000 điểm và ≥ 30 bài đạt 100%.",
        "anh": "img/huy-hieu/trang-nguyen.webp",
        "diem_thuong": 350,
    },
]
HUY_HIEU_MAP = {b["id"]: b for b in DS_HUY_HIEU}


# ====================== MIGRATION & BẢNG ======================
def dam_bao_bang_tren_conn(conn):
    """Đảm bảo bảng user_huy_hieu và cột users.huy_hieu tồn tại trên connection đang mở."""
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_huy_hieu (
            user_id INTEGER,
            badge_id TEXT,
            unlocked_at TEXT,
            diem_thuong INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, badge_id)
        )
    ''')
    cot_users = [r[1] for r in conn.execute("PRAGMA table_info(users)")]
    if cot_users and 'huy_hieu' not in cot_users:
        conn.execute("ALTER TABLE users ADD COLUMN huy_hieu TEXT DEFAULT ''")
    if cot_users:
        conn.execute("UPDATE users SET huy_hieu = '' WHERE huy_hieu IS NULL")


def dam_bao_bang(db_path=None):
    """Chạy migration an toàn trên database (không làm mất dữ liệu cũ)."""
    conn = sqlite3.connect(db_path or DB_PATH, timeout=10)
    try:
        dam_bao_bang_tren_conn(conn)
        conn.commit()
    finally:
        conn.close()


dam_bao_bang()


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    return sqlite3.connect(DB_PATH, timeout=10)


def _bay_gio():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _dem(conn, sql, *args):
    try:
        row = conn.execute(sql, args).fetchone()
        return row[0] if row and row[0] is not None else 0
    except sqlite3.Error:
        return 0


def _co_bang(conn, ten_bang):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (ten_bang,)
    ).fetchone()
    return row is not None


def _doc_user(conn, user_id):
    """Đọc thông tin user an toàn bằng tuple index (hoạt động với mọi row_factory)."""
    cot = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
    if not cot:
        return None
    sel_score = "COALESCE(score, 0)" if "score" in cot else "0"
    sel_streak = "COALESCE(streak, 0)" if "streak" in cot else "0"
    sel_last = "COALESCE(last_active_date, '')" if "last_active_date" in cot else "''"
    sel_mon = "COALESCE(mon_chuyen, '')" if "mon_chuyen" in cot else "''"
    sel_dd = "COALESCE(dd_tong, 0)" if "dd_tong" in cot else "0"
    sel_bh = "COALESCE(the_bao_ho, 0)" if "the_bao_ho" in cot else "0"
    sel_hh = "COALESCE(huy_hieu, '')" if "huy_hieu" in cot else "''"
    row = conn.execute(
        f"SELECT id, {sel_score}, {sel_streak}, {sel_last}, {sel_mon}, {sel_dd}, {sel_bh}, {sel_hh} "
        "FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "score": int(row[1] or 0),
        "streak": int(row[2] or 0),
        "last_active_date": row[3] or "",
        "mon_chuyen": row[4] or "",
        "dd_tong": int(row[5] or 0),
        "the_bao_ho": int(row[6] or 0),
        "huy_hieu": row[7] or "",
        "co_cot_score": "score" in cot,
    }


def _lay_danh_hieu_kb(conn, user_id):
    if not _co_bang(conn, "kb_user_danh_hieu"):
        return set()
    try:
        rows = conn.execute(
            "SELECT ma_danh_hieu FROM kb_user_danh_hieu WHERE user_id = ?", (user_id,)
        ).fetchall()
        return {r[0] for r in rows if r[0]}
    except sqlite3.Error:
        return set()


def _la_giai_nguyen(conn, user_id, mon_chuyen, kb_titles):
    if kb_titles & {"giai_nguyen", "hoi_nguyen", "trang_nguyen", "bang_nhan", "tham_hoa"}:
        return True
    if _co_bang(conn, "kb_user_danh_hieu"):
        if _dem(conn, "SELECT COUNT(*) FROM kb_user_danh_hieu WHERE user_id = ? AND hang = 1", user_id) > 0:
            return True
    if _co_bang(conn, "kb_ket_qua") and _co_bang(conn, "kb_ky"):
        cnt = _dem(
            conn,
            "SELECT COUNT(*) FROM kb_ket_qua r JOIN kb_ky k ON k.id = r.ky_id "
            "WHERE r.user_id = ? AND k.trang_thai = 'da_khoa' AND r.hang <= 3",
            user_id,
        )
        if cnt > 0:
            return True
    if _co_bang(conn, "contest_ket_qua") and _co_bang(conn, "contests"):
        now_hm = datetime.now().strftime("%Y-%m-%d %H:%M")
        cnt = _dem(
            conn,
            "SELECT COUNT(*) FROM contest_ket_qua k "
            "JOIN contests c ON c.id = k.contest_id "
            "WHERE k.user_id = ? AND k.diem > 0 AND c.ket_thuc <= ? "
            "AND (SELECT COUNT(*) FROM contest_ket_qua k2 "
            "     WHERE k2.contest_id = k.contest_id AND k2.diem > k.diem) < 3",
            user_id,
            now_hm,
        )
        if cnt > 0:
            return True
    if _co_bang(conn, "diem_thang"):
        cnt = _dem(
            conn,
            "SELECT COUNT(*) FROM diem_thang t "
            "WHERE t.user_id = ? AND COALESCE(t.diem, 0) >= 300 "
            "AND (SELECT COUNT(*) FROM diem_thang t2 JOIN users u2 ON u2.id = t2.user_id "
            "     WHERE t2.thang = t.thang AND COALESCE(u2.mon_chuyen, '') = ? "
            "     AND (COALESCE(t2.diem, 0) > COALESCE(t.diem, 0) "
            "          OR (COALESCE(t2.diem, 0) = COALESCE(t.diem, 0) AND u2.id < t.user_id))) < 3",
            user_id,
            mon_chuyen,
        )
        if cnt > 0:
            return True
    return False


def _la_top1_tong(conn, user_id, score, mon_chuyen, co_cot_score):
    if not co_cot_score:
        return False
    truoc = _dem(
        conn,
        "SELECT COUNT(*) FROM users WHERE COALESCE(mon_chuyen, '') = ? "
        "AND (COALESCE(score, 0) > ? OR (COALESCE(score, 0) = ? AND id < ?))",
        mon_chuyen,
        score,
        score,
        user_id,
    )
    return truoc == 0


def _tien_do_ket_hop(tien_do_a, muc_a, tien_do_b, muc_b):
    """Chọn nhánh gần hoàn thành hơn cho điều kiện HOẶC."""
    if tien_do_a >= muc_a:
        return muc_a, muc_a
    if tien_do_b >= muc_b:
        return muc_b, muc_b
    if (tien_do_a / muc_a) >= (tien_do_b / muc_b):
        return tien_do_a, muc_a
    return tien_do_b, muc_b


def _tien_do_hai_dieu_kien(tien_do_a, muc_a, tien_do_b, muc_b):
    """Chọn nhánh còn thiếu nhiều hơn cho điều kiện VÀ để không hiện 100% khi chưa mở khóa."""
    if (tien_do_a / muc_a) <= (tien_do_b / muc_b):
        return min(tien_do_a, muc_a), muc_a
    return min(tien_do_b, muc_b), muc_b


def _danh_gia_tat_ca(conn, u):
    """Tính trạng thái đạt điều kiện và (tien_do, muc_tieu) cho cả 7 huy hiệu."""
    uid = u["id"]
    score = u["score"]
    mon = u["mon_chuyen"]
    dd = u["dd_tong"]
    st = streak_hien_thi(u["streak"], u["last_active_date"], u["the_bao_ho"])

    cnt_bai = _dem(conn, "SELECT COUNT(*) FROM da_lam WHERE user_id = ?", uid)
    cnt_80 = _dem(conn, "SELECT COUNT(*) FROM da_lam WHERE user_id = ? AND COALESCE(best_pct, 0) >= 80", uid)
    cnt_100 = _dem(conn, "SELECT COUNT(*) FROM da_lam WHERE user_id = ? AND COALESCE(best_pct, 0) >= 100", uid)

    nv_days = _dem(
        conn,
        "SELECT COUNT(*) FROM ("
        "  SELECT ngay FROM nv_ngay WHERE user_id = ? AND da_nhan = 1 "
        "  GROUP BY ngay "
        "  HAVING SUM(CASE WHEN nv_id = '_du3' THEN 1 ELSE 0 END) > 0 "
        "      OR SUM(CASE WHEN nv_id != '_du3' THEN 1 ELSE 0 END) >= 3"
        ")",
        uid,
    )
    loi_da_sua = _dem(conn, "SELECT COUNT(*) FROM so_loi WHERE user_id = ? AND da_hieu = 1", uid)

    kb_titles = _lay_danh_hieu_kb(conn, uid)
    dat_gn = _la_giai_nguyen(conn, uid, mon, kb_titles)
    dat_hn = bool(kb_titles & {"hoi_nguyen", "trang_nguyen"}) or (score >= 1500 and cnt_80 >= 15)
    top1_tong = _la_top1_tong(conn, uid, score, mon, u["co_cot_score"])
    dat_tn = ("trang_nguyen" in kb_titles) or (score >= 3000 and cnt_100 >= 30 and top1_tong)

    td_cc, mt_cc = _tien_do_ket_hop(st, 5, dd, 7)
    td_tt, mt_tt = _tien_do_ket_hop(nv_days, 3, loi_da_sua, 10)

    if dat_hn:
        td_hn, mt_hn = 15, 15
    else:
        td_hn, mt_hn = _tien_do_hai_dieu_kien(max(0, score), 1500, cnt_80, 15)

    if dat_tn:
        td_tn, mt_tn = 30, 30
    elif score >= 3000 and cnt_100 >= 30:
        td_tn, mt_tn = 0, 1
    else:
        td_tn, mt_tn = _tien_do_hai_dieu_kien(max(0, score), 3000, cnt_100, 30)

    return {
        "buoc-chan-dau-tien": (cnt_bai >= 1, min(cnt_bai, 1), 1),
        "chuyen-can": ((dd >= 7 or st >= 5), td_cc, mt_cc),
        "tich-tieu-thanh-dai": ((nv_days >= 3 or loi_da_sua >= 10), td_tt, mt_tt),
        "bach-phat-bach-trung": (cnt_100 >= 5, min(cnt_100, 5), 5),
        "giai-nguyen": (dat_gn, 1 if dat_gn else 0, 1),
        "hoi-nguyen": (dat_hn, td_hn, mt_hn),
        "trang-nguyen": (dat_tn, td_tn, mt_tn),
    }


def kiem_tra_huy_hieu(conn, user_id):
    """Kiểm tra và mở khóa các huy hiệu đủ điều kiện cho user trên connection đang mở.
    Cộng điểm thưởng vào users.score và diem_thang (idempotent, mỗi huy hiệu tối đa 1 lần).
    Không tự commit/close connection. Trả về danh sách huy hiệu vừa mở khóa."""
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return []

    dam_bao_bang_tren_conn(conn)
    co_diem_thang = _co_bang(conn, "diem_thang")
    moi_mo = []

    for _ in range(len(DS_HUY_HIEU)):
        u = _doc_user(conn, uid)
        if not u:
            break
        da_mo = {
            r[0]
            for r in conn.execute("SELECT badge_id FROM user_huy_hieu WHERE user_id = ?", (uid,)).fetchall()
        }
        ket_qua = _danh_gia_tat_ca(conn, u)
        mo_trong_luot = False
        bay_gio = _bay_gio()

        for b in DS_HUY_HIEU:
            bid = b["id"]
            if bid in da_mo or not ket_qua[bid][0]:
                continue
            thuong = b["diem_thuong"]
            cur = conn.execute(
                "INSERT OR IGNORE INTO user_huy_hieu (user_id, badge_id, unlocked_at, diem_thuong) "
                "VALUES (?, ?, ?, ?)",
                (uid, bid, bay_gio, thuong),
            )
            if cur.rowcount == 1:
                mo_trong_luot = True
                if thuong > 0:
                    if u["co_cot_score"]:
                        conn.execute(
                            "UPDATE users SET score = COALESCE(score, 0) + ? WHERE id = ?",
                            (thuong, uid),
                        )
                    if co_diem_thang:
                        cong_diem_thang(conn, uid, thuong)
                moi_mo.append({
                    "id": bid,
                    "ten": b["ten"],
                    "diem_thuong": thuong,
                    "anh": b["anh"],
                })
        if not mo_trong_luot:
            break

    return moi_mo


def cap_nhat_huy_hieu(user_id):
    """Mở connection riêng để kiểm tra và lưu huy hiệu mới (dùng cho app.py sau /api/submit)."""
    if not user_id:
        return []
    conn = _ket_noi()
    try:
        moi_mo = kiem_tra_huy_hieu(conn, user_id)
        conn.commit()
        return moi_mo
    except Exception:
        return []
    finally:
        conn.close()


def lay_du_lieu_huy_hieu(conn, user_id):
    """Chạy kiểm tra mở khóa và trả về dữ liệu đầy đủ cho GET /api/huy-hieu/<user_id>."""
    moi_mo = kiem_tra_huy_hieu(conn, user_id)
    u = _doc_user(conn, user_id)
    if not u:
        return None
    unlocked_rows = {
        r[0]: r[1]
        for r in conn.execute(
            "SELECT badge_id, unlocked_at FROM user_huy_hieu WHERE user_id = ?", (user_id,)
        ).fetchall()
    }
    dang_deo = u["huy_hieu"] if u["huy_hieu"] in unlocked_rows else ""
    if u["huy_hieu"] and not dang_deo:
        conn.execute("UPDATE users SET huy_hieu = '' WHERE id = ?", (user_id,))

    ket_qua = _danh_gia_tat_ca(conn, u)
    ds = []
    for b in DS_HUY_HIEU:
        bid = b["id"]
        da_mo = bid in unlocked_rows
        _, td, mt = ket_qua[bid]
        ds.append({
            "id": bid,
            "ten": b["ten"],
            "mo_ta": b["mo_ta"],
            "anh": b["anh"],
            "diem_thuong": b["diem_thuong"],
            "da_mo": da_mo,
            "dang_deo": da_mo and (dang_deo == bid),
            "tien_do": mt if da_mo else td,
            "muc_tieu": mt,
            "unlocked_at": unlocked_rows.get(bid, ""),
        })

    return {
        "ds": ds,
        "dang_deo": dang_deo,
        "moi_mo": moi_mo,
        "score": u["score"],
    }


# ====================== API ======================
@huy_hieu_bp.route('/api/huy-hieu/<int:user_id>', methods=['GET'])
def api_xem_huy_hieu(user_id):
    conn = _ket_noi()
    try:
        data = lay_du_lieu_huy_hieu(conn, user_id)
        if data is None:
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
        conn.commit()
        return jsonify({"success": True, "data": data}), 200
    finally:
        conn.close()


@huy_hieu_bp.route('/api/huy-hieu/deo', methods=['POST'])
def api_deo_huy_hieu():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    raw_uid = data.get('user_id')
    if isinstance(raw_uid, bool) or raw_uid is None:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400
    try:
        user_id = int(raw_uid)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    raw_badge = data.get('huy_hieu', '')
    if raw_badge is None:
        raw_badge = ''
    if not isinstance(raw_badge, str):
        return jsonify({"success": False, "message": "Huy hiệu không hợp lệ!"}), 400
    badge_id = raw_badge.strip()

    if badge_id and badge_id not in HUY_HIEU_MAP:
        return jsonify({"success": False, "message": "Huy hiệu không tồn tại!"}), 400

    conn = _ket_noi()
    try:
        if not _doc_user(conn, user_id):
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

        if badge_id:
            kiem_tra_huy_hieu(conn, user_id)
            co = conn.execute(
                "SELECT 1 FROM user_huy_hieu WHERE user_id = ? AND badge_id = ?",
                (user_id, badge_id),
            ).fetchone()
            if not co:
                conn.commit()
                return jsonify({"success": False, "message": "Bạn chưa mở khóa huy hiệu này!"}), 400

        conn.execute("UPDATE users SET huy_hieu = ? WHERE id = ?", (badge_id, user_id))
        conn.commit()
        return jsonify({
            "success": True,
            "message": "Đã đeo huy hiệu!" if badge_id else "Đã tháo huy hiệu!",
            "huy_hieu": badge_id,
            "data": {"huy_hieu": badge_id, "dang_deo": badge_id},
        }), 200
    finally:
        conn.close()
