"""
Hạng thành tích: lưu % điểm CAO NHẤT của từng bài tập + API tiến độ.

File này tự chứa mọi thứ (giống qua_tang.py):
  - tự thêm cột best_pct vào bảng da_lam (không mất dữ liệu cũ)
  - ghi_diem_cao_nhat(): app.py gọi khi chấm bài xong
  - API: GET /api/tien-do/<môn>?user_id=1[&chuong=chuong-1&bai=bai-01]
"""
import json
import os
import re
import sqlite3
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH, cong_diem_va_educoin, streak_hien_thi

tien_do_bp = Blueprint('tien_do', __name__)

GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_DAP_AN = os.path.join(GOC, '..', 'Dap_an')
TEN_HOP_LE = re.compile(r'^[a-z0-9_-]+$')   # chặn "../" đọc trộm file khác


# ====================== TỰ THÊM CỘT ======================
def dam_bao_cot_hang():
    conn = sqlite3.connect(DB_PATH)
    cac_cot = [c[1] for c in conn.execute("PRAGMA table_info(da_lam)")]
    # cac_cot rỗng = chưa có bảng da_lam (init_db.py sẽ tạo), lúc đó bỏ qua
    if cac_cot and 'best_pct' not in cac_cot:
        conn.execute("ALTER TABLE da_lam ADD COLUMN best_pct INTEGER DEFAULT 0")
    cot_users = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
    if cot_users and 'muc_tieu_tuan' not in cot_users:
        conn.execute("ALTER TABLE users ADD COLUMN muc_tieu_tuan INTEGER NOT NULL DEFAULT 20")
    conn.commit()
    conn.close()

dam_bao_cot_hang()


def dam_bao_bang_ruong():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ruong_chuong (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            chuong TEXT NOT NULL,
            diem_thuong INTEGER NOT NULL,
            ngay_mo TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, subject, chuong)
        )
    ''')
    conn.commit()
    conn.close()


dam_bao_bang_ruong()


# ====================== HÀM DÙNG CHUNG ======================
def ghi_diem_cao_nhat(cur, user_id, bai_key, pct):
    """Chỉ ghi đè khi điểm mới CAO HƠN điểm cũ. Trả về điểm cao nhất sau khi cập nhật.
    cur là con trỏ của app.py, app.py tự commit sau đó."""
    cur.execute(
        "UPDATE da_lam SET best_pct = ? "
        "WHERE user_id = ? AND bai_key = ? AND COALESCE(best_pct, 0) < ?",
        (pct, user_id, bai_key, pct))
    row = cur.execute(
        "SELECT COALESCE(best_pct, 0) FROM da_lam WHERE user_id = ? AND bai_key = ?",
        (user_id, bai_key)).fetchone()
    return row[0] if row else pct

def _khoa_id(s):
    """Sắp xếp id kiểu '1.2' < '1.10'"""
    return tuple(int(x) if x.isdigit() else 0 for x in s.split('.'))


# ====================== API ======================
# Trả về: { "chuong-1": { "bai-01": { "1.1": 86, "1.2": 0 } } }
# Danh sách bài tập lấy từ thư mục đáp án (nằm ở server), điểm lấy từ bảng da_lam.
@tien_do_bp.route('/api/tien-do/<subject>', methods=['GET'])
def tien_do(subject):
    subject = subject.replace('-', '_')
    chuong_loc = request.args.get('chuong', '')
    bai_loc = request.args.get('bai', '')
    if (not TEN_HOP_LE.match(subject)
            or (chuong_loc and not TEN_HOP_LE.match(chuong_loc))
            or (bai_loc and not TEN_HOP_LE.match(bai_loc))):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    thu_muc_mon = os.path.join(THU_MUC_DAP_AN, subject)
    if not os.path.isdir(thu_muc_mon):
        return jsonify({"success": True, "data": {}, "ruong_da_mo": []}), 200

    # điểm cao nhất mỗi bài của người dùng (chưa đăng nhập thì để trống)
    best = {}
    ruong_da_mo = []
    user_id = request.args.get('user_id', type=int)
    if user_id:
        conn = sqlite3.connect(DB_PATH)
        for key, pct in conn.execute(
                "SELECT bai_key, best_pct FROM da_lam WHERE user_id = ?", (user_id,)):
            best[key] = pct or 0
        ruong_da_mo = [
            row[0] for row in conn.execute(
                "SELECT chuong FROM ruong_chuong WHERE user_id = ? AND subject = ? ORDER BY id ASC",
                (user_id, subject),
            )
        ]
        conn.close()

    data = {}
    for chuong in sorted(os.listdir(thu_muc_mon)):
        if chuong_loc and chuong != chuong_loc:
            continue
        p_chuong = os.path.join(thu_muc_mon, chuong)
        if not os.path.isdir(p_chuong):
            continue
        for ten_file in sorted(os.listdir(p_chuong)):
            if not ten_file.endswith('.json'):
                continue
            article = ten_file[:-5]          # "bai-01"
            if bai_loc and article != bai_loc:
                continue
            try:
                with open(os.path.join(p_chuong, ten_file), encoding='utf-8') as f:
                    dap_an = json.load(f)
            except (ValueError, OSError):
                continue                      # file trống / lỗi thì bỏ qua, không làm sập
            if not isinstance(dap_an, dict):
                continue
            ds = {}
            for bai_id in sorted(dap_an.keys(), key=_khoa_id):
                ds[bai_id] = best.get(f"{subject}/{chuong}/{article}/{bai_id}", 0)
            data.setdefault(chuong, {})[article] = ds

    return jsonify({"success": True, "data": data, "ruong_da_mo": ruong_da_mo}), 200


@tien_do_bp.route('/api/tien-do/mo-ruong', methods=['POST'])
def mo_ruong():
    body = request.get_json(silent=True) or {}
    raw_user_id = body.get('user_id')
    subject = str(body.get('subject') or '').strip().replace('-', '_')
    chuong = str(body.get('chuong') or '').strip()

    if not subject or not chuong or not TEN_HOP_LE.match(subject) or not TEN_HOP_LE.match(chuong):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    if raw_user_id is None or isinstance(raw_user_id, bool):
        return jsonify({"success": False, "message": "Bạn cần đăng nhập để mở rương!"}), 400
    try:
        user_id = int(raw_user_id)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "ID người dùng không hợp lệ!"}), 400
    if user_id <= 0:
        return jsonify({"success": False, "message": "ID người dùng không hợp lệ!"}), 400

    p_chuong = os.path.join(THU_MUC_DAP_AN, subject, chuong)
    if not os.path.isdir(p_chuong):
        return jsonify({"success": False, "message": "Không tìm thấy chương này!"}), 404

    conn = sqlite3.connect(DB_PATH)
    try:
        if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

        best = {}
        for key, pct in conn.execute(
                "SELECT bai_key, best_pct FROM da_lam WHERE user_id = ?", (user_id,)):
            best[key] = max(0, min(100, int(pct or 0)))

        so_bai_hoc = 0
        tong_toi_da = 0
        tong_dat_duoc = 0
        for ten_file in sorted(os.listdir(p_chuong)):
            if not ten_file.endswith('.json'):
                continue
            article = ten_file[:-5]
            try:
                with open(os.path.join(p_chuong, ten_file), encoding='utf-8') as f:
                    dap_an = json.load(f)
            except (ValueError, OSError):
                continue
            if not isinstance(dap_an, dict) or len(dap_an) == 0:
                continue
            so_bai_hoc += 1
            tong_toi_da += len(dap_an) * 100
            for bai_id in dap_an.keys():
                tong_dat_duoc += best.get(f"{subject}/{chuong}/{article}/{bai_id}", 0)

        if so_bai_hoc == 0 or tong_toi_da == 0:
            return jsonify({"success": False, "message": "Chương này chưa có bài tập để mở rương!"}), 400

        if tong_dat_duoc < tong_toi_da:
            return jsonify({
                "success": False,
                "message": "Bạn cần hoàn thành 100% điểm của chương này trước khi mở rương!",
            }), 403

        diem_thuong = min(500, round(tong_toi_da / so_bai_hoc))
        try:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "INSERT INTO ruong_chuong (user_id, subject, chuong, diem_thuong) VALUES (?, ?, ?, ?)",
                (user_id, subject, chuong, diem_thuong),
            )
            cong_diem_va_educoin(conn, user_id, diem_thuong, cong_thang=True)
            conn.commit()
        except sqlite3.IntegrityError:
            conn.rollback()
            return jsonify({"success": False, "message": "Bạn đã mở rương chương này rồi!"}), 409

        return jsonify({
            "success": True,
            "diem_thuong": diem_thuong,
            "chuong": chuong,
        }), 200
    finally:
        conn.close()


@tien_do_bp.route('/api/muc-tieu-tuan/<int:user_id>', methods=['GET', 'PUT'])
def muc_tieu_tuan(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        u = conn.execute(
            "SELECT COALESCE(muc_tieu_tuan, 20) AS muc_tieu_tuan, COALESCE(streak, 0) AS streak, "
            "last_active_date, COALESCE(the_bao_ho, 0) AS the_bao_ho "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not u:
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

        if request.method == 'PUT':
            body = request.get_json(silent=True) or {}
            try:
                mt = int(body.get('muc_tieu'))
            except (TypeError, ValueError):
                return jsonify({"success": False, "message": "Mục tiêu tuần phải là số nguyên!"}), 400
            if mt < 5 or mt > 200:
                return jsonify({"success": False, "message": "Mục tiêu tuần phải từ 5 đến 200 bài!"}), 400
            conn.execute("UPDATE users SET muc_tieu_tuan = ? WHERE id = ?", (mt, user_id))
            conn.commit()
            muc_tieu = mt
        else:
            muc_tieu = max(5, min(200, int(u['muc_tieu_tuan'] or 20)))

        hom_nay = date.today()
        thu_hai = hom_nay - timedelta(days=hom_nay.weekday())
        chu_nhat = thu_hai + timedelta(days=6)

        dem_theo_ngay = {}
        try:
            rows = conn.execute(
                "SELECT ngay, COUNT(DISTINCT bai_key) AS so_bai "
                "FROM kb_hoat_dong WHERE user_id = ? AND ngay >= ? AND ngay <= ? GROUP BY ngay",
                (user_id, str(thu_hai), str(chu_nhat)),
            ).fetchall()
            for r in rows:
                dem_theo_ngay[r['ngay']] = int(r['so_bai'] or 0)
        except sqlite3.OperationalError:
            pass

        ten_thu = ("T2", "T3", "T4", "T5", "T6", "T7", "CN")
        theo_ngay = []
        da_lam_tuan = 0
        for i in range(7):
            ng = thu_hai + timedelta(days=i)
            ng_str = str(ng)
            sb = dem_theo_ngay.get(ng_str, 0)
            da_lam_tuan += sb
            theo_ngay.append({
                "thu": ten_thu[i],
                "ngay": ng_str,
                "so_bai": sb,
                "is_today": ng == hom_nay,
            })

        streak = streak_hien_thi(u['streak'] or 0, u['last_active_date'], u['the_bao_ho'] or 0)
        return jsonify({
            "success": True,
            "data": {
                "muc_tieu": muc_tieu,
                "da_lam_tuan": da_lam_tuan,
                "theo_ngay": theo_ngay,
                "streak": streak,
                "da_hoc_hom_nay": u['last_active_date'] == str(hom_nay),
            },
        }), 200
    finally:
        conn.close()