# -*- coding: utf-8 -*-
"""
so_loi.py - SỔ LỖI SAI kiểu "ôn kỹ năng bị hổng" (không phải học vẹt đáp án)

Vòng học:   Sai  ->  Hiểu  ->  Chứng minh đã hiểu
  1. Câu làm sai tự vào sổ. Học sinh chọn nguyên nhân: chưa hiểu khái niệm / tính nhầm / đọc sai đề / đoán bừa.
  2. THẺ SỬA LỖI    : làm lại đúng câu đã sai. Lời giải bị khóa, chỉ mở dần qua 3 tầng gợi ý:
                      tầng 1 nhắc lý thuyết -> tầng 2 gợi ý hướng làm -> tầng 3 lời giải.
  3. THẺ CHỨNG MINH : một câu KHÁC cùng kỹ năng. Phải đúng ngay lần đầu, không dùng gợi ý mới được lên mức.
  4. Lên mức theo lịch cách quãng 1 -> 3 -> 7 ngày:
        Chưa vững -> Đang luyện -> Khá -> Thông thạo   (đúng 1 lần chưa tính là nhớ thật)

"Kỹ năng" (bản nhẹ) = 1 bài tập, vd toan/chuong-1/bai-01/1.1, cùng khóa bai_key với bảng da_lam.
Ngân hàng câu để chứng minh = các câu còn lại của chính bài tập đó.
Sau này muốn kỹ năng chi tiết hơn: chỉ cần đổi cách tạo bai_key, phần còn lại giữ nguyên.

Tự tạo bảng (không cần sửa init_db.py): so_loi, ky_nang_user, on_tap_the.

API:
  GET  /api/so-loi/<user_id>/ky-nang   bản đồ kỹ năng + số liệu tóm tắt
  POST /api/so-loi/chan-doan           lưu nguyên nhân sai   {user_id, nguyen_nhan, the_id | (bai_key, cau_id)}
  POST /api/so-loi/the                 mở thẻ mới của 1 kỹ năng   {user_id, bai_key}
  POST /api/so-loi/goi-y               mở tầng gợi ý kế tiếp      {user_id, the_id}
  POST /api/so-loi/tra-loi             nộp đáp án của thẻ         {user_id, the_id, answer}
"""
import html
import json
import os
import random
import re
import sqlite3
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH
from nhiem_vu import ghi_su_kien

so_loi_bp = Blueprint('so_loi', __name__)

# ====================== CẤU HÌNH (chỉnh ở đây) ======================
GIAU_LOI_GIAI_KHI_SAI = True    # True: câu sai ở trang làm bài KHÔNG hiện lời giải ngay, phải qua thẻ sửa lỗi
LICH_ON = {1: 1, 2: 3, 3: 7}    # lên mức m thì hẹn ôn lại sau LICH_ON[m] ngày
THUONG_LEN_MUC = {1: 5, 2: 8, 3: 12}   # điểm thưởng khi lên mức m
THUONG_GHI_NHO_LAU = 10         # thưởng khi qua vòng kiểm tra cuối (sau 7 ngày ở mức Thông thạo)
TEN_MUC = ["Chưa vững", "Đang luyện", "Khá", "Thông thạo"]
NGUYEN_NHAN = ("khai_niem", "tinh_nham", "doc_sai_de", "doan_bua")
LOAI_CAU = ("trac-nghiem", "dung-sai", "tra-loi-ngan")
TEN_MON = {"toan": "Toán", "ngu_van": "Ngữ văn", "vat_ly": "Vật lí",
           "chuyen_toan": "Chuyên Toán", "chuyen_hoa": "Chuyên Hóa học"}

GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_DE = os.path.join(GOC, '..', '..', 'Frontend', 'file_de')   # đề (không đáp án)
THU_MUC_DAP_AN = os.path.join(GOC, '..', 'Dap_an')                  # đáp án (chỉ server đọc)
KEY_RE = re.compile(r'^([a-z0-9_-]+)/([a-z0-9_-]+)/([a-z0-9_-]+)/([0-9.]+)$')   # chặn "../"


# ====================== TẠO BẢNG ======================
def dam_bao_bang():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS so_loi (            -- từng câu đã làm sai
            user_id INTEGER, bai_key TEXT, cau_id TEXT,
            nguyen_nhan TEXT DEFAULT '',               -- khai_niem | tinh_nham | doc_sai_de | doan_bua
            so_lan_sai INTEGER DEFAULT 1,
            lan_cuoi TEXT DEFAULT '',
            da_hieu INTEGER DEFAULT 0,                 -- 1 = đã sửa lỗi (làm đúng lại hoặc đã xem lời giải)
            PRIMARY KEY (user_id, bai_key, cau_id)
        );
        CREATE TABLE IF NOT EXISTS ky_nang_user (      -- mức thành thạo của từng kỹ năng
            user_id INTEGER, bai_key TEXT,
            muc INTEGER DEFAULT 0,                     -- 0 Chưa vững, 1 Đang luyện, 2 Khá, 3 Thông thạo
            ngay_on_ke TEXT DEFAULT '',                -- ngày đến hạn chứng minh ('' = đã xong hết lịch)
            so_lan_dat INTEGER DEFAULT 0,
            so_lan_chua_dat INTEGER DEFAULT 0,
            lan_on_cuoi TEXT DEFAULT '',
            PRIMARY KEY (user_id, bai_key)
        );
        CREATE TABLE IF NOT EXISTS on_tap_the (        -- mỗi lần mở 1 thẻ là 1 dòng (để biết câu nào đã dùng, đã gợi ý tầng mấy)
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, bai_key TEXT, cau_id TEXT,
            loai TEXT,                                 -- sua | chung_minh
            tang_goi_y INTEGER DEFAULT 0,
            so_lan_sai INTEGER DEFAULT 0,
            nguyen_nhan TEXT DEFAULT '',
            ket_qua TEXT DEFAULT '',                   -- '' đang mở | da_hieu | dat | dat_goi_y | chua_dat
            tao_luc TEXT DEFAULT ''
        );
    ''')
    conn.close()

dam_bao_bang()


# ====================== ĐỌC ĐỀ + ĐÁP ÁN ======================
_CACHE = {}   # {đường dẫn: (thời điểm sửa file, nội dung)} -> khỏi đọc lại file mỗi request

def _doc_json(path):
    try:
        mt = os.path.getmtime(path)
    except OSError:
        return None
    c = _CACHE.get(path)
    if c and c[0] == mt:
        return c[1]
    try:
        with open(path, encoding='utf-8-sig') as f:
            data = json.load(f)
    except (ValueError, OSError):
        return None
    _CACHE[path] = (mt, data)
    return data

def _ds_bai(de):
    """File mới có bai_tap; file cũ chỉ có cau_hoi (mỗi câu coi như 1 bài) - giống bai-tap.js."""
    if isinstance(de.get('bai_tap'), list):
        return de['bai_tap']
    return [{"id": c.get("id"), "ten": "", "tac_pham": de.get("tac_pham"), "cau_hoi": [c]}
            for c in de.get("cau_hoi", [])]

def _tai_bai(bai_key):
    """Trả về {de, bai, dap_an} của 1 bài tập, hoặc None nếu thiếu file."""
    m = KEY_RE.match(bai_key or '')
    if not m:
        return None
    subject, chapter, article, bai_id = m.groups()
    de = _doc_json(os.path.join(THU_MUC_DE, subject, chapter, article + '.json'))
    da = _doc_json(os.path.join(THU_MUC_DAP_AN, subject, chapter, article + '.json'))
    if not isinstance(de, dict) or not isinstance(da, dict):
        return None
    dap_an = da.get(bai_id)
    bai = next((b for b in _ds_bai(de) if str(b.get('id')) == bai_id), None)
    if not bai or not isinstance(dap_an, dict):
        return None
    return {"de": de, "bai": bai, "dap_an": dap_an}

def _tim_cau(tai, cau_id):
    return next((c for c in tai["bai"].get("cau_hoi", []) if str(c.get("id")) == str(cau_id)), None)

def _de_day_du(bai, cau):
    """Câu đúng/sai: chỉ ý a) mới ghi đề chung. Ý b), c), d) thì ghép đề chung vào để đọc một mình vẫn hiểu."""
    de = cau.get("de_bai", "")
    m = re.match(r'^(\d+)([b-h])$', str(cau.get("id")))
    if cau.get("type") == "dung-sai" and m:
        a = next((c for c in bai.get("cau_hoi", []) if str(c.get("id")) == m.group(1) + "a"), None)
        if a:
            return a.get("de_bai", "").split("<br><b>a)</b>")[0] + "<br>" + de
    return de

def _ds(x):
    return x if isinstance(x, list) else ([x] if x else [])

def _cau_cho_client(bai, cau):
    """Chỉ gửi phần ĐỀ cho trình duyệt (tuyệt đối không có đáp án)."""
    return {"id": str(cau.get("id")), "type": cau.get("type"), "de_bai": _de_day_du(bai, cau),
            "dap_an": cau.get("dap_an") if cau.get("type") == "trac-nghiem" else None,
            "hinh": _ds(cau.get("hinh")), "diem": cau.get("diem")}

def _ten_ky_nang(bai_key):
    subject, chapter, article, bai_id = KEY_RE.match(bai_key).groups()
    tong = _doc_json(os.path.join(THU_MUC_DE, subject, 'tong-hop.json')) or {}
    bai_hoc = ''
    for c in tong.get('chuong_list', []):
        if c.get('id_chuong') == chapter:
            for b in c.get('danh_sach_bai', []):
                if f"bai-{b.get('id')}" == article:
                    bai_hoc = b.get('ten_bai', '')
    de = _doc_json(os.path.join(THU_MUC_DE, subject, chapter, article + '.json')) or {}
    ten = next((b.get('ten') for b in _ds_bai(de) if str(b.get('id')) == bai_id), '') or ''
    return {"mon": subject, "bai_hoc": bai_hoc,
            "mon_ten": tong.get('mon') or TEN_MON.get(subject) or subject.replace('_', ' ').title(),
            "ten": f"Bài {bai_id}" + (f": {ten}" if ten else "")}


# ====================== CHẤM ======================
def _chuan(s):
    return str(s).strip().lower().replace(',', '.').replace(' ', '')

def _cham(dap_an_dung, tra_loi):
    """So chữ không phân biệt hoa/thường; riêng số thì so bằng số (0,5 = 0.5 = .50)."""
    a, b = _chuan(dap_an_dung), _chuan(tra_loi)
    if a == b:
        return True
    try:
        return abs(float(a) - float(b)) < 1e-9
    except ValueError:
        return False

def _dap_an_hien(cau, dap):
    d = dap.get("dap_an_dung")
    if cau.get("type") == "trac-nghiem":
        try:
            i = int(d)
            return f'{"ABCDEF"[i]}. {cau["dap_an"][i]}'
        except (ValueError, IndexError, TypeError, KeyError):
            return html.escape(str(d))
    if cau.get("type") == "dung-sai":
        return "Đúng" if str(d).strip().lower() == "true" else "Sai"
    return html.escape(str(d))

def _noi_dung_goi_y(tang, tai, cau, dap, the_id):
    """3 tầng gợi ý, tầng sau lộ nhiều hơn tầng trước."""
    if tang == 1:    # nhắc khái niệm: lý thuyết của bài học
        return {"kieu": "ly_thuyet", "tieu_de": "Nhắc lại khái niệm",
                "html": tai["de"].get("ly_thuyet") or "<p>Bài này chưa có lý thuyết. Hãy đọc kỹ đề và các dữ kiện đã cho.</p>"}
    if tang == 2:    # gợi ý hướng làm
        if cau.get("goi_y"):
            return {"kieu": "huong", "tieu_de": "Gợi ý hướng làm", "html": cau["goi_y"]}
        loai = cau.get("type")
        if loai == "trac-nghiem":      # chưa có gợi ý viết tay thì loại bớt đáp án sai
            try:
                dung = int(dap.get("dap_an_dung"))
            except (TypeError, ValueError):
                dung = -1
            sai = [i for i in range(len(cau.get("dap_an", []))) if i != dung]
            random.Random(the_id).shuffle(sai)
            loai_bo = sai[:max(0, min(2, len(sai) - 1))]
            return {"kieu": "huong", "tieu_de": "Gợi ý hướng làm", "loai_bo": loai_bo,
                    "html": f"Mình đã loại bớt {len(loai_bo)} đáp án sai. Hãy cân nhắc các đáp án còn lại."}
        if loai == "tra-loi-ngan":
            return {"kieu": "huong", "tieu_de": "Gợi ý hướng làm",
                    "html": f"Đáp án gồm <b>{len(str(dap.get('dap_an_dung')))}</b> ký tự. Hãy kiểm tra lại từng bước tính."}
        return {"kieu": "huong", "tieu_de": "Gợi ý hướng làm",
                "html": "Hãy tách đề thành từng vế, đối chiếu từng vế với định nghĩa hoặc công thức trong phần lý thuyết."}
    return {"kieu": "loi_giai", "tieu_de": "Lời giải",   # tầng 3: lời giải đầy đủ
            "html": dap.get("loi_giai") or "<p>Câu này chưa có lời giải chi tiết.</p>",
            "dap_an_hien": _dap_an_hien(cau, dap)}


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _hom_nay():
    return str(date.today())

def _uid(data):
    try:
        return int(data.get('user_id'))
    except (TypeError, ValueError):
        return None

def _loi(thong_bao, ma=400):
    return jsonify({"success": False, "message": thong_bao}), ma

def _co_user(conn, uid):
    return conn.execute("SELECT 1 FROM users WHERE id = ?", (uid,)).fetchone() is not None

def _lay_the_dang_mo(conn, uid, the_id):
    """Trả về (thẻ, None) nếu hợp lệ, (None, phản hồi lỗi) nếu không."""
    try:
        the = conn.execute("SELECT * FROM on_tap_the WHERE id = ? AND user_id = ?", (int(the_id), uid)).fetchone()
    except (TypeError, ValueError):
        the = None
    if not the:
        return None, _loi("Không tìm thấy thẻ này!", 404)
    if the["ket_qua"] != '':
        return None, _loi("Thẻ này đã kết thúc rồi, hãy mở thẻ mới!", 409)
    return the, None

def _ghi_loi(conn, uid, bai_key, cau_id, hom_nay, them_lan=True):
    """Thêm (hoặc cộng dồn) 1 câu sai vào sổ, đánh dấu chưa hiểu."""
    conn.execute(
        "INSERT INTO so_loi (user_id, bai_key, cau_id, so_lan_sai, lan_cuoi) VALUES (?, ?, ?, 1, ?) "
        "ON CONFLICT(user_id, bai_key, cau_id) DO UPDATE SET "
        "so_lan_sai = so_lan_sai + ?, lan_cuoi = excluded.lan_cuoi, da_hieu = 0",
        (uid, bai_key, cau_id, hom_nay, 1 if them_lan else 0))

def _mo_lai_ky_nang(conn, uid, bai_key, hom_nay):
    """Sai ở bài thường nghĩa là chưa vững: tạo kỹ năng (nếu chưa có) hoặc cho rớt 1 mức và ôn ngay."""
    conn.execute("INSERT OR IGNORE INTO ky_nang_user (user_id, bai_key, muc, ngay_on_ke) VALUES (?, ?, 0, ?)",
                 (uid, bai_key, hom_nay))
    # đang đến hạn ôn rồi thì thôi, khỏi rớt thêm mỗi lần nộp lại
    conn.execute("UPDATE ky_nang_user SET muc = MAX(muc - 1, 0), ngay_on_ke = ? "
                 "WHERE user_id = ? AND bai_key = ? AND (ngay_on_ke = '' OR ngay_on_ke > ?)",
                 (hom_nay, uid, bai_key, hom_nay))


# ====================== app.py GỌI SAU KHI CHẤM BÀI ======================
def ghi_ket_qua_nop_bai(user_id, bai_key, ket_qua):
    """ket_qua = {cau_id: {"dung": True/False/None, "loi_giai": ...}} do /api/submit tạo ra (hàm này SỬA TRỰC TIẾP dict đó).
    - Câu sai: ghi vào sổ, mở kỹ năng; nếu GIAU_LOI_GIAI_KHI_SAI thì xóa lời giải để khỏi thấy đáp án ngay.
    - Câu đúng mà từng sai: coi như đã sửa (còn phải qua thẻ chứng minh mới tính là nhớ thật).
    Trả về danh sách cau_id đã ghi vào sổ."""
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return []
    sai = [c for c, r in ket_qua.items() if r.get("dung") is False]
    dung = [c for c, r in ket_qua.items() if r.get("dung") is True]
    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return []
    hom_nay = _hom_nay()
    for cid in sai:
        _ghi_loi(conn, user_id, bai_key, str(cid), hom_nay)
        if GIAU_LOI_GIAI_KHI_SAI:
            ket_qua[cid]["loi_giai"] = ""
    for cid in dung:
        conn.execute("UPDATE so_loi SET da_hieu = 1 WHERE user_id = ? AND bai_key = ? AND cau_id = ?",
                     (user_id, bai_key, str(cid)))
    if sai:
        _mo_lai_ky_nang(conn, user_id, bai_key, hom_nay)
    conn.commit()
    conn.close()
    return [str(c) for c in sai]


# ====================== LÊN MỨC / XUỐNG MỨC ======================
def _cap_nhat_muc(conn, uid, bai_key, ket_qua, hom_nay):
    """Áp kết quả của THẺ CHỨNG MINH lên mức kỹ năng. Chỉ có tác dụng khi kỹ năng ĐÃ ĐẾN HẠN
    (nhờ vậy mở 2 thẻ cùng lúc cũng không lên mức 2 lần trong 1 ngày)."""
    kn = conn.execute("SELECT muc, ngay_on_ke FROM ky_nang_user WHERE user_id = ? AND bai_key = ?",
                      (uid, bai_key)).fetchone()
    tt = {"tinh": False, "muc_truoc": 0, "muc_sau": 0, "ngay_on_ke": "", "thuong_diem": 0}
    if not kn:
        return tt
    muc, hen = kn["muc"], kn["ngay_on_ke"]
    tt.update(muc_truoc=muc, muc_sau=muc, ngay_on_ke=hen)
    if not (hen and hen <= hom_nay):          # chưa đến hạn (hoặc đã xong lịch): chỉ là luyện thêm
        return tt
    tt["tinh"] = True
    moi, hen_moi, diem = muc, hen, 0
    homnay_d = date.fromisoformat(hom_nay)

    if ket_qua == 'dat':
        if muc < 3:
            moi = muc + 1
            hen_moi = str(homnay_d + timedelta(days=LICH_ON[moi]))
            diem = THUONG_LEN_MUC[moi]
        else:                                  # qua vòng kiểm tra ghi nhớ dài hạn: xong lịch
            hen_moi, diem = '', THUONG_GHI_NHO_LAU
    elif ket_qua == 'chua_dat' and muc > 0:    # bỏ cuộc / xem lời giải ở thẻ đến hạn: tụt 1 mức, mai ôn lại
        moi = muc - 1
        hen_moi = str(homnay_d + timedelta(days=1))
    # 'dat_goi_y': giữ nguyên mức và hạn (đã học được nhưng chưa chứng minh)

    conn.execute(
        "UPDATE ky_nang_user SET muc = ?, ngay_on_ke = ?, lan_on_cuoi = ?, "
        "so_lan_dat = so_lan_dat + ?, so_lan_chua_dat = so_lan_chua_dat + ? WHERE user_id = ? AND bai_key = ?",
        (moi, hen_moi, hom_nay, 1 if ket_qua == 'dat' else 0, 1 if ket_qua == 'chua_dat' else 0, uid, bai_key))
    if diem:
        conn.execute("UPDATE users SET score = score + ? WHERE id = ?", (diem, uid))
    tt.update(muc_sau=moi, ngay_on_ke=hen_moi, thuong_diem=diem)
    return tt

def _ket_thuc_the(conn, uid, the, ket_qua):
    """Đóng thẻ, cập nhật mức kỹ năng, báo sự kiện cho nhiệm vụ. Trả về thông tin tiến độ cho trình duyệt."""
    hom_nay = _hom_nay()
    conn.execute("UPDATE on_tap_the SET ket_qua = ? WHERE id = ?", (ket_qua, the["id"]))
    if the["loai"] == 'sua':
        conn.execute("UPDATE so_loi SET da_hieu = 1 WHERE user_id = ? AND bai_key = ? AND cau_id = ?",
                     (uid, the["bai_key"], the["cau_id"]))
        tt = {"tinh": False}
    else:
        tt = _cap_nhat_muc(conn, uid, the["bai_key"], ket_qua, hom_nay)
        if ket_qua == 'dat' and tt["tinh"]:
            ghi_su_kien(uid, "chung_minh", 1, conn)
    ghi_su_kien(uid, "on_the", 1, conn)
    return tt


# ====================== API ======================
# Bản đồ kỹ năng
@so_loi_bp.route('/api/so-loi/<int:user_id>/ky-nang', methods=['GET'])
def ky_nang(user_id):
    conn = _ket_noi()
    if not _co_user(conn, user_id):
        conn.close()
        return _loi("Không tìm thấy người dùng!", 404)
    hom_nay = _hom_nay()
    ds = []
    for r in conn.execute("SELECT * FROM ky_nang_user WHERE user_id = ?", (user_id,)).fetchall():
        key = r["bai_key"]
        if not KEY_RE.match(key):
            continue
        tong, chua = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(1 - da_hieu), 0) FROM so_loi WHERE user_id = ? AND bai_key = ?",
            (user_id, key)).fetchone()
        nn = conn.execute(
            "SELECT nguyen_nhan FROM so_loi WHERE user_id = ? AND bai_key = ? AND nguyen_nhan != '' "
            "GROUP BY nguyen_nhan ORDER BY COUNT(*) DESC LIMIT 1", (user_id, key)).fetchone()
        ds.append({**_ten_ky_nang(key), "bai_key": key, "muc": r["muc"], "ten_muc": TEN_MUC[r["muc"]],
                   "ngay_on_ke": r["ngay_on_ke"], "den_han": bool(r["ngay_on_ke"]) and r["ngay_on_ke"] <= hom_nay,
                   "tong_loi": tong, "loi_chua_hieu": chua, "nguyen_nhan_chinh": nn[0] if nn else ""})
    conn.close()
    ds.sort(key=lambda k: (not k["den_han"], k["muc"], k["bai_key"]))   # đến hạn lên đầu, mức thấp trước
    tom_tat = {"tong": len(ds), "den_han": sum(1 for k in ds if k["den_han"]),
               "thong_thao": sum(1 for k in ds if k["muc"] == 3),
               "loi_chua_hieu": sum(k["loi_chua_hieu"] for k in ds)}
    return jsonify({"success": True, "data": {"tom_tat": tom_tat, "ds": ds}}), 200


# Bước 1: tự chẩn đoán vì sao sai
@so_loi_bp.route('/api/so-loi/chan-doan', methods=['POST'])
def chan_doan():
    data = request.get_json(silent=True) or {}
    uid, nn = _uid(data), data.get('nguyen_nhan')
    if not uid or nn not in NGUYEN_NHAN:
        return _loi("Dữ liệu không hợp lệ!")
    conn = _ket_noi()
    if data.get('the_id') is not None:
        the = conn.execute("SELECT * FROM on_tap_the WHERE id = ? AND user_id = ?", (data.get('the_id'), uid)).fetchone()
        if not the:
            conn.close()
            return _loi("Không tìm thấy thẻ này!", 404)
        conn.execute("UPDATE on_tap_the SET nguyen_nhan = ? WHERE id = ?", (nn, the["id"]))
        key, cau_id = the["bai_key"], the["cau_id"]
    else:
        key, cau_id = str(data.get('bai_key', '')), str(data.get('cau_id', ''))
        if not KEY_RE.match(key):
            conn.close()
            return _loi("Dữ liệu không hợp lệ!")
    conn.execute("UPDATE so_loi SET nguyen_nhan = ? WHERE user_id = ? AND bai_key = ? AND cau_id = ?",
                 (nn, uid, key, cau_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


# Mở 1 thẻ mới: còn lỗi chưa sửa thì ra THẺ SỬA LỖI, hết lỗi thì ra THẺ CHỨNG MINH (câu khác)
@so_loi_bp.route('/api/so-loi/the', methods=['POST'])
def tao_the():
    data = request.get_json(silent=True) or {}
    uid, key = _uid(data), str(data.get('bai_key', ''))
    if not uid or not KEY_RE.match(key):
        return _loi("Dữ liệu không hợp lệ!")
    tai = _tai_bai(key)
    if not tai:
        return _loi("Không tìm thấy đề hoặc đáp án của bài này!", 404)

    conn = _ket_noi()
    kn = conn.execute("SELECT * FROM ky_nang_user WHERE user_id = ? AND bai_key = ?", (uid, key)).fetchone()
    if not kn:
        conn.close()
        return _loi("Kỹ năng này chưa có trong sổ của bạn!", 404)
    hom_nay = _hom_nay()

    loai, cau_id, con_lai = None, None, 0
    chua_hieu = [r["cau_id"] for r in conn.execute(
        "SELECT cau_id FROM so_loi WHERE user_id = ? AND bai_key = ? AND da_hieu = 0 ORDER BY lan_cuoi, rowid",
        (uid, key))]
    for cid in chua_hieu:
        if _tim_cau(tai, cid) and cid in tai["dap_an"]:
            if loai is None:
                loai, cau_id = 'sua', cid
            con_lai += 1
        else:       # câu không còn trong đề (đề đã sửa): bỏ qua cho khỏi kẹt
            conn.execute("UPDATE so_loi SET da_hieu = 1 WHERE user_id = ? AND bai_key = ? AND cau_id = ?", (uid, key, cid))
    if loai is None:
        cau_id = _chon_cau_chung_minh(conn, uid, key, tai)
        if cau_id is None:
            conn.commit()
            conn.close()
            return _loi("Bài này chưa đủ câu để ôn.", 409)
        loai = 'chung_minh'

    cur = conn.execute("INSERT INTO on_tap_the (user_id, bai_key, cau_id, loai, tao_luc) VALUES (?, ?, ?, ?, ?)",
                       (uid, key, cau_id, loai, hom_nay))
    conn.commit()
    conn.close()

    cau = _tim_cau(tai, cau_id)
    den_han = bool(kn["ngay_on_ke"]) and kn["ngay_on_ke"] <= hom_nay
    return jsonify({"success": True, "data": {
        "the_id": cur.lastrowid, "loai": loai, "bai_key": key,
        "tinh_tien_do": loai == 'chung_minh' and den_han,       # false = chỉ luyện thêm, không lên mức
        "loi_con_lai": con_lai,
        "ky_nang": {**_ten_ky_nang(key), "muc": kn["muc"], "ten_muc": TEN_MUC[kn["muc"]]},
        "cau": _cau_cho_client(tai["bai"], cau),
        "tac_pham": tai["bai"].get("tac_pham") or None,         # bài đọc hiểu: đề phải kèm văn bản
    }}), 200

def _chon_cau_chung_minh(conn, uid, key, tai):
    """Chọn 1 câu KHÁC: ưu tiên câu chưa từng sai, chưa từng ôn, rồi tới câu lâu nhất chưa ôn."""
    hop_le = [str(c.get("id")) for c in tai["bai"].get("cau_hoi", [])
              if c.get("type") in LOAI_CAU and str(c.get("id")) in tai["dap_an"]]
    if not hop_le:
        return None
    da_sai = {r[0] for r in conn.execute("SELECT cau_id FROM so_loi WHERE user_id = ? AND bai_key = ?", (uid, key))}
    gan_day = {r[0]: r[1] for r in conn.execute(
        "SELECT cau_id, MAX(id) FROM on_tap_the WHERE user_id = ? AND bai_key = ? GROUP BY cau_id", (uid, key))}
    pool = [i for i in hop_le if i not in da_sai] or hop_le
    pool.sort(key=lambda i: (gan_day.get(i, 0), random.random()))   # chưa từng ôn = 0 nên đứng đầu
    return pool[0]


# Bước 2: mở tầng gợi ý kế tiếp (tầng 3 = xem lời giải = kết thúc thẻ)
@so_loi_bp.route('/api/so-loi/goi-y', methods=['POST'])
def goi_y():
    data = request.get_json(silent=True) or {}
    uid = _uid(data)
    if not uid:
        return _loi("Dữ liệu không hợp lệ!")
    conn = _ket_noi()
    the, loi = _lay_the_dang_mo(conn, uid, data.get('the_id'))
    if loi:
        conn.close()
        return loi
    tang = the["tang_goi_y"] + 1
    if tang > 3:
        conn.close()
        return _loi("Bạn đã mở hết gợi ý rồi!", 409)
    tai = _tai_bai(the["bai_key"])
    cau = _tim_cau(tai, the["cau_id"]) if tai else None
    if not cau:
        conn.close()
        return _loi("Không tìm thấy câu hỏi này!", 404)

    nd = _noi_dung_goi_y(tang, tai, cau, tai["dap_an"][the["cau_id"]], the["id"])
    conn.execute("UPDATE on_tap_the SET tang_goi_y = ? WHERE id = ?", (tang, the["id"]))
    phan_hoi = {"success": True, "tang": tang, "goi_y": nd, "da_dong": False}
    if tang == 3:      # đã xem lời giải: thẻ kết thúc. Thẻ sửa lỗi = đã hiểu; thẻ chứng minh = chưa đạt
        kq = 'da_hieu' if the["loai"] == 'sua' else 'chua_dat'
        phan_hoi.update(da_dong=True, ket_qua=kq, tien_do=_ket_thuc_the(conn, uid, the, kq))
    conn.commit()
    conn.close()
    return jsonify(phan_hoi), 200


# Nộp đáp án của thẻ
@so_loi_bp.route('/api/so-loi/tra-loi', methods=['POST'])
def tra_loi():
    data = request.get_json(silent=True) or {}
    uid, tl = _uid(data), str(data.get('answer', '')).strip()
    if not uid:
        return _loi("Dữ liệu không hợp lệ!")
    if not tl:
        return _loi("Hãy chọn hoặc nhập câu trả lời trước nhé!")
    conn = _ket_noi()
    the, loi = _lay_the_dang_mo(conn, uid, data.get('the_id'))
    if loi:
        conn.close()
        return loi
    tai = _tai_bai(the["bai_key"])
    cau = _tim_cau(tai, the["cau_id"]) if tai else None
    dap = tai["dap_an"].get(the["cau_id"]) if tai else None
    if not cau or not dap:
        conn.close()
        return _loi("Không tìm thấy câu hỏi này!", 404)

    if not _cham(dap["dap_an_dung"], tl):
        so_sai = the["so_lan_sai"] + 1
        conn.execute("UPDATE on_tap_the SET so_lan_sai = ? WHERE id = ?", (so_sai, the["id"]))
        if the["loai"] == 'chung_minh':   # sai ở câu mới = lộ thêm 1 chỗ hổng, ghi vào sổ để sửa
            _ghi_loi(conn, uid, the["bai_key"], the["cau_id"], _hom_nay(), them_lan=False)
        conn.commit()
        conn.close()
        return jsonify({"success": True, "dung": False, "so_lan_sai": so_sai, "tang_goi_y": the["tang_goi_y"]}), 200

    # ĐÚNG
    if the["loai"] == 'sua':
        kq = 'da_hieu'
    else:    # đúng ngay lần đầu và không gợi ý mới là "đạt"; còn lại là học được nhưng chưa chứng minh
        kq = 'dat' if (the["so_lan_sai"] == 0 and the["tang_goi_y"] == 0) else 'dat_goi_y'
    tt = _ket_thuc_the(conn, uid, the, kq)
    conn.commit()
    conn.close()
    return jsonify({"success": True, "dung": True, "ket_qua": kq, "tien_do": tt,
                    "loi_giai": dap.get("loi_giai", ""), "dap_an_hien": _dap_an_hien(cau, dap)}), 200