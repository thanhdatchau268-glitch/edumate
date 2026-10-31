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

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH

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
        conn.commit()
    conn.close()

dam_bao_cot_hang()


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
        return jsonify({"success": True, "data": {}}), 200

    # điểm cao nhất mỗi bài của người dùng (chưa đăng nhập thì để trống)
    best = {}
    user_id = request.args.get('user_id', type=int)
    if user_id:
        conn = sqlite3.connect(DB_PATH)
        for key, pct in conn.execute(
                "SELECT bai_key, best_pct FROM da_lam WHERE user_id = ?", (user_id,)):
            best[key] = pct or 0
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

    return jsonify({"success": True, "data": data}), 200