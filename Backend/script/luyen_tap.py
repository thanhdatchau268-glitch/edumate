# -*- coding: utf-8 -*-
"""
luyen_tap.py - Game hoa bai tap V31 cho che do Luyen tap (KHONG ap dung phong thi Khoa bang).

Chuc nang:
  1. Cham cau tuc thi + thuong 2 vi theo do tu tin (chong farm chi cong lan cham dau qua bang cham_cau_log):
       - rat_chac  + Dung : +3 EduCoin, +3 Score
       - kha_chac  + Dung : +2 EduCoin, +2 Score
       - doan_thu  + Dung : +1 EduCoin, +1 Score (+ co gan co may man luu So loi sai neu muon)
       - rat_chac  + Sai  : 0/0, luu So loi sai voi uu_tien_cao = 2 ("Lo hong an")
       - kha_chac  + Sai  : 0/0, luu So loi sai voi uu_tien_cao = 1
       - doan_thu  + Sai  : 0/0, luu So loi sai voi uu_tien_cao = 0, tra them goi y Tang 1 (khong lo loi giai)
     Tuyet doi giu quy tac GIAU_LOI_GIAI_KHI_SAI = True (khong tra dap_an_dung / loi_giai khi sai).
  2. Luu cau doan dung may man vao So loi sai theo yeu cau nguoi choi.
  3. Thuong Focus Combo cuoi chang (+2 EduCoin, +2 Score) neu streak_chang >= 3 va khong click nhanh (< 5s),
     co gioi han chong spam cooldown >= 10 giay & 1 lan moi chang.
"""
import re
import sqlite3
import time

from flask import Blueprint, jsonify, request

from cham_ngu_nghia import cham_hon_hop as cham_tu_luan
from db_ops import DB_PATH, cong_diem_va_educoin
from huy_hieu import kiem_tra_huy_hieu
from so_loi import (
    GIAU_LOI_GIAI_KHI_SAI,
    _cham,
    _co_user,
    _ghi_loi,
    _hom_nay,
    _ket_noi,
    _mo_lai_ky_nang,
    _tai_bai,
    _tim_cau,
)

luyen_tap_bp = Blueprint('luyen_tap', __name__)

DO_TU_TIN_HOP_LE = ("doan_thu", "kha_chac", "rat_chac")
THUONG_TU_TIN = {"doan_thu": 1, "kha_chac": 2, "rat_chac": 3}
THUONG_FOCUS_CHANG = 2
COOLDOWN_FOCUS_GIAY = 10.0
TEN_HOP_LE = re.compile(r'^[a-z0-9_-]+$')
BAI_ID_HOP_LE = re.compile(r'^[0-9.]+$')


def dam_bao_bang():
    """Tao bang cham_cau_log va chang_focus_log neu chua ton tai."""
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS cham_cau_log (
            user_id INTEGER,
            bai_key TEXT,
            cau_id TEXT,
            do_tu_tin TEXT DEFAULT 'kha_chac',
            dung INTEGER DEFAULT 0,
            thuong_coin INTEGER DEFAULT 0,
            thuong_score INTEGER DEFAULT 0,
            thoi_gian_ms INTEGER DEFAULT 0,
            lan_dau TEXT DEFAULT '',
            PRIMARY KEY (user_id, bai_key, cau_id)
        );
        CREATE TABLE IF NOT EXISTS chang_focus_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bai_key TEXT,
            chang_id TEXT,
            tao_luc REAL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_focus_user_time ON chang_focus_log(user_id, tao_luc);
    ''')
    conn.commit()
    conn.close()


dam_bao_bang()


def _xay_bai_key(data):
    """Tao bai_key hop le tu bai_key hoac (subject, chapter, article, bai_id)."""
    raw_key = str(data.get('bai_key') or '').strip()
    if raw_key:
        parts = raw_key.split('/')
        if len(parts) == 4:
            sub = parts[0].replace('-', '_')
            chap, art, bid = parts[1], parts[2], parts[3]
            if (TEN_HOP_LE.match(sub) and TEN_HOP_LE.match(chap)
                    and TEN_HOP_LE.match(art) and BAI_ID_HOP_LE.match(bid)):
                return f"{sub}/{chap}/{art}/{bid}"
        return None
    sub = str(data.get('subject') or '').replace('-', '_').strip()
    chap = str(data.get('chapter') or '').strip()
    art = str(data.get('article') or '').strip()
    bid = str(data.get('bai_id') or '').strip()
    if (TEN_HOP_LE.match(sub) and TEN_HOP_LE.match(chap)
            and TEN_HOP_LE.match(art) and BAI_ID_HOP_LE.match(bid)):
        return f"{sub}/{chap}/{art}/{bid}"
    return None


def _trich_goi_y_tang_1(tai, cau):
    """Tra ve goi y Tang 1 an toan (khong lo dap an hay loi giai chi tiet)."""
    if cau.get("goi_y"):
        return str(cau["goi_y"])
    ly = str((tai.get("de") or {}).get("ly_thuyet") or "").strip()
    if ly:
        # Lay doan mo dau gon nhe tu ly_thuyet
        cat = re.sub(r'<[^>]+>', ' ', ly)
        cat = re.sub(r'\s+', ' ', cat).strip()
        if len(cat) > 220:
            cat = cat[:217].rstrip() + "..."
        if cat:
            return f"Nhắc lại lý thuyết: {cat}"
    return "Hãy đọc lại định nghĩa và các dữ kiện chính của bài trước khi thử lại nhé!"


def _thong_tin_vi(conn, uid):
    row = conn.execute(
        "SELECT COALESCE(score, 0), COALESCE(educoin, 0) FROM users WHERE id = ?",
        (uid,),
    ).fetchone()
    if not row:
        return 0, 0
    return int(row[0] or 0), int(row[1] or 0)


@luyen_tap_bp.route('/api/luyen-tap/cham-cau', methods=['POST'])
def cham_cau():
    """Cham 1 cau tuc thi trong che do Luyen tap kem muc Do tu tin & thuong 2 vi."""
    data = request.get_json(silent=True) or {}
    bai_key = _xay_bai_key(data)
    cau_id = str(data.get('cau_id') or '').strip()
    answer = data.get('answer')
    do_tu_tin = str(data.get('do_tu_tin') or 'kha_chac').strip()

    if not bai_key or not cau_id or do_tu_tin not in DO_TU_TIN_HOP_LE:
        return jsonify({"success": False, "message": "Dữ liệu chấm câu không hợp lệ!"}), 400
    if bai_key.startswith('contest/'):
        return jsonify({"success": False, "message": "Phòng thi không hỗ trợ chấm từng câu!"}), 403
    if answer is None or str(answer).strip() == '':
        return jsonify({"success": False, "message": "Hãy chọn hoặc nhập câu trả lời trước nhé!"}), 400

    try:
        elapsed_ms = max(0, int(data.get('elapsed_ms') or 0))
    except (TypeError, ValueError):
        elapsed_ms = 0

    tai = _tai_bai(bai_key)
    cau = _tim_cau(tai, cau_id) if tai else None
    dap = (tai["dap_an"].get(cau_id) if tai else None)
    if not cau or not dap:
        return jsonify({"success": False, "message": "Không tìm thấy câu hỏi hoặc đáp án!"}), 404

    # Cham bai (ho tro ca trac-nghiem, dung-sai, tra-loi-ngan, tu-luan)
    is_tu_luan = (dap.get('loai') == 'tu-luan' or cau.get('type') == 'tu-luan')
    diem = float(dap.get('diem', cau.get('diem', 10)) or 10)
    tu_luan_chi_tiet = None
    diem_dat = 0.0
    if is_tu_luan:
        diem_dat, tu_luan_chi_tiet = cham_tu_luan(dap, answer)
        dung = bool(diem_dat >= diem / 2.0)
    else:
        dung = bool(_cham(dap.get('dap_an_dung', ''), answer))
        diem_dat = diem if dung else 0.0

    uid = None
    raw_uid = data.get('user_id')
    if raw_uid not in (None, '', 'null', 'undefined'):
        try:
            uid = int(raw_uid)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Mã người dùng không hợp lệ!"}), 400

    lan_dau = False
    thuong_coin = 0
    thuong_score = 0
    da_luu_so_loi = False
    uu_tien_cao = 0
    score_moi = None
    educoin_moi = None
    hom_nay = _hom_nay()

    conn = _ket_noi()
    try:
        if uid and _co_user(conn, uid):
            da_cham = conn.execute(
                "SELECT 1 FROM cham_cau_log WHERE user_id = ? AND bai_key = ? AND cau_id = ?",
                (uid, bai_key, cau_id),
            ).fetchone() is not None
            lan_dau = not da_cham

            if dung:
                if lan_dau:
                    muc_thuong = THUONG_TU_TIN[do_tu_tin]
                    thuong_coin = muc_thuong
                    thuong_score = muc_thuong
                    cong_diem_va_educoin(conn, uid, muc_thuong, cong_thang=True)
                # Neu cau nay tung nam trong So loi sai thi danh dau da hieu; tang so_lan_dat neu rat_chac
                conn.execute(
                    "UPDATE so_loi SET da_hieu = 1 WHERE user_id = ? AND bai_key = ? AND cau_id = ?",
                    (uid, bai_key, cau_id),
                )
                if do_tu_tin == 'rat_chac':
                    conn.execute(
                        "UPDATE ky_nang_user SET so_lan_dat = COALESCE(so_lan_dat, 0) + 1 "
                        "WHERE user_id = ? AND bai_key = ?",
                        (uid, bai_key),
                    )
            else:
                uu_tien_cao = 2 if do_tu_tin == 'rat_chac' else (1 if do_tu_tin == 'kha_chac' else 0)
                _ghi_loi(
                    conn, uid, bai_key, cau_id, hom_nay,
                    them_lan=lan_dau, do_tu_tin=do_tu_tin, uu_tien_cao=uu_tien_cao,
                )
                if do_tu_tin == 'doan_thu':
                    conn.execute(
                        "UPDATE so_loi SET nguyen_nhan = 'doan_bua' "
                        "WHERE user_id = ? AND bai_key = ? AND cau_id = ? AND COALESCE(nguyen_nhan, '') = ''",
                        (uid, bai_key, cau_id),
                    )
                _mo_lai_ky_nang(conn, uid, bai_key, hom_nay)
                da_luu_so_loi = True

            if lan_dau:
                conn.execute(
                    "INSERT OR IGNORE INTO cham_cau_log "
                    "(user_id, bai_key, cau_id, do_tu_tin, dung, thuong_coin, thuong_score, thoi_gian_ms, lan_dau) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (uid, bai_key, cau_id, do_tu_tin, 1 if dung else 0,
                     thuong_coin, thuong_score, elapsed_ms, hom_nay),
                )

            kiem_tra_huy_hieu(conn, uid)
            score_moi, educoin_moi = _thong_tin_vi(conn, uid)
            conn.commit()
    finally:
        conn.close()

    # Thong diep phan hoi & bao mat loi giai (GIAU_LOI_GIAI_KHI_SAI)
    may_man = bool(dung and do_tu_tin == 'doan_thu')
    goi_y_tang_1 = ""
    loi_giai = ""

    if dung:
        if do_tu_tin == 'rat_chac':
            thong_diep = "Chính xác! Năng lực rất vững."
        elif do_tu_tin == 'kha_chac':
            thong_diep = "Đúng rồi! Tiếp tục giữ nhịp nhé."
        else:
            thong_diep = "Trùng khớp, nhưng bạn đang đoán thử — lưu lại để ôn cho chắc nhé!"
        loi_giai = dap.get('loi_giai', '') or ""
    else:
        uu_tien_cao = 2 if do_tu_tin == 'rat_chac' else (1 if do_tu_tin == 'kha_chac' else 0)
        if do_tu_tin == 'rat_chac':
            thong_diep = "Chưa đúng! Đây là lỗ hổng ẩn dễ mất điểm khi thi, đã đưa lên đầu Sổ lỗi sai."
        elif do_tu_tin == 'kha_chac':
            thong_diep = "Gần đúng rồi! Đã lưu vào Sổ lỗi sai để bạn tự kiểm tra lại ở cuối chặng."
        else:
            thong_diep = "Chưa chính xác. Đã lưu lại kèm gợi ý lý thuyết Tầng 1 trong Sổ lỗi sai."
            goi_y_tang_1 = _trich_goi_y_tang_1(tai, cau)

        if not GIAU_LOI_GIAI_KHI_SAI:
            loi_giai = dap.get('loi_giai', '') or ""

    res = {
        "success": True,
        "dung": dung,
        "do_tu_tin": do_tu_tin,
        "lan_dau": lan_dau,
        "thuong_coin": thuong_coin,
        "thuong_score": thuong_score,
        "may_man": may_man,
        "co_the_luu_so_loi": may_man,
        "da_luu_so_loi": da_luu_so_loi,
        "uu_tien_cao": uu_tien_cao,
        "lo_hong_an": (not dung and do_tu_tin == 'rat_chac'),
        "thong_diep": thong_diep,
        "goi_y": goi_y_tang_1,
        "loi_giai": loi_giai,
        "diem": diem,
        "diem_dat": round(diem_dat, 2),
        "hop_le_focus": elapsed_ms >= 5000,
    }
    if tu_luan_chi_tiet is not None:
        res["tu_luan"] = tu_luan_chi_tiet
    if score_moi is not None:
        res["score_moi"] = score_moi
        res["educoin_moi"] = educoin_moi

    return jsonify(res), 200


@luyen_tap_bp.route('/api/luyen-tap/luu-may-man', methods=['POST'])
def luu_may_man():
    """Luu cau 'Doan thu + Dung' vao So loi sai khi hoc sinh bam nut Ghim on cho chac."""
    data = request.get_json(silent=True) or {}
    bai_key = _xay_bai_key(data)
    cau_id = str(data.get('cau_id') or '').strip()
    try:
        uid = int(data.get('user_id'))
    except (TypeError, ValueError):
        uid = None

    if not uid or not bai_key or not cau_id:
        return jsonify({"success": False, "message": "Dữ liệu lưu câu chưa hợp lệ!"}), 400
    if not _tai_bai(bai_key):
        return jsonify({"success": False, "message": "Không tìm thấy bài tập!"}), 404

    conn = _ket_noi()
    try:
        if not _co_user(conn, uid):
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
        hom_nay = _hom_nay()
        _ghi_loi(conn, uid, bai_key, cau_id, hom_nay, them_lan=False, do_tu_tin='doan_thu', uu_tien_cao=1)
        conn.execute(
            "UPDATE so_loi SET nguyen_nhan = 'doan_bua' "
            "WHERE user_id = ? AND bai_key = ? AND cau_id = ? AND COALESCE(nguyen_nhan, '') = ''",
            (uid, bai_key, cau_id),
        )
        _mo_lai_ky_nang(conn, uid, bai_key, hom_nay)
        conn.commit()
    finally:
        conn.close()

    return jsonify({"success": True, "message": "Đã lưu vào Sổ lỗi sai để bạn ôn chắc kiến thức này!"}), 200


@luyen_tap_bp.route('/api/luyen-tap/hoan-thanh-chang', methods=['POST'])
def hoan_thanh_chang():
    """Thuong them +2 EduCoin & +2 Score cuoi chang neu dat Focus Combo >= 3 (du >= 5s/cau)."""
    data = request.get_json(silent=True) or {}
    bai_key = _xay_bai_key(data)
    chang_id = str(data.get('chang_id') or '').strip()[:64]
    tat_ca_hop_le = bool(data.get('tat_ca_hop_le', False))
    try:
        uid = int(data.get('user_id'))
        streak_chang = int(data.get('streak_chang') or 0)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    if not bai_key or not chang_id:
        return jsonify({"success": False, "message": "Thiếu thông tin chặng!"}), 400

    du_dieu_kien = (streak_chang >= 3 and tat_ca_hop_le)
    if not du_dieu_kien:
        return jsonify({
            "success": True,
            "du_dieu_kien": False,
            "thuong_coin": 0,
            "thuong_score": 0,
            "ly_do": "Chưa đạt Focus Combo >= 3 câu liên tiếp (>= 5 giây/câu).",
        }), 200

    conn = _ket_noi()
    try:
        if not _co_user(conn, uid):
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

        da_nhan_chang = conn.execute(
            "SELECT 1 FROM chang_focus_log WHERE user_id = ? AND bai_key = ? AND chang_id = ?",
            (uid, bai_key, chang_id),
        ).fetchone() is not None
        if da_nhan_chang:
            score_moi, educoin_moi = _thong_tin_vi(conn, uid)
            return jsonify({
                "success": True,
                "du_dieu_kien": False,
                "thuong_coin": 0,
                "thuong_score": 0,
                "ly_do": "Chặng này đã nhận thưởng Focus Combo trước đó.",
                "score_moi": score_moi,
                "educoin_moi": educoin_moi,
            }), 200

        now = time.time()
        last = conn.execute(
            "SELECT tao_luc FROM chang_focus_log WHERE user_id = ? ORDER BY id DESC LIMIT 1",
            (uid,),
        ).fetchone()
        if last and (now - float(last["tao_luc"] or 0)) < COOLDOWN_FOCUS_GIAY:
            score_moi, educoin_moi = _thong_tin_vi(conn, uid)
            return jsonify({
                "success": True,
                "du_dieu_kien": False,
                "thuong_coin": 0,
                "thuong_score": 0,
                "ly_do": "Bạn đang thao tác quá nhanh, thưởng Focus cần thời gian tập trung thực tế.",
                "score_moi": score_moi,
                "educoin_moi": educoin_moi,
            }), 200

        cong_diem_va_educoin(conn, uid, THUONG_FOCUS_CHANG, cong_thang=True)
        conn.execute(
            "INSERT INTO chang_focus_log (user_id, bai_key, chang_id, tao_luc) VALUES (?, ?, ?, ?)",
            (uid, bai_key, chang_id, now),
        )
        kiem_tra_huy_hieu(conn, uid)
        score_moi, educoin_moi = _thong_tin_vi(conn, uid)
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        "success": True,
        "du_dieu_kien": True,
        "thuong_coin": THUONG_FOCUS_CHANG,
        "thuong_score": THUONG_FOCUS_CHANG,
        "score_moi": score_moi,
        "educoin_moi": educoin_moi,
        "thong_diep": f"Focus Combo! Thưởng thêm +{THUONG_FOCUS_CHANG} EduCoin & +{THUONG_FOCUS_CHANG} Điểm tích lũy.",
    }), 200
