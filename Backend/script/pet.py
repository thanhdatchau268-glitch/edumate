"""
Sao La (pet): TRANG PHỤC = SKIN NGUYÊN CON (mục 3b) + GIỚI TÍNH GIỌNG NÓI (mục 3c).

File này tự chứa (giống qua_tang.py):
  - tự tạo bảng pet, pet_do và thêm cột còn thiếu (không mất dữ liệu cũ)
  - đọc danh sách skin từ Frontend/img/pet/manifest.json (nguồn sự thật duy nhất)
  - các API:
        GET  /api/pet?user_id=<id>   xem trạng thái pet + danh sách skin
        POST /api/pet                đổi giới tính giọng nói   {"gioi_tinh": "nam"|"nu"}   (cần token)
        POST /api/pet/mac            mặc skin đã sở hữu        {"skin": "<id>"}            (cần token)
  - hàm cap_do(user_id, skin_id): cấp 1 skin cho người dùng (cửa hàng / quà tặng / nhiệm vụ gọi hàm này)

Quy tắc bảo mật (mục 3b):
  - POST /api/pet/mac chỉ nhận skin ĐÃ SỞ HỮU, kiểm tra ngay trong câu lệnh SQL ở server.
  - Skin CHƯA sở hữu: API chỉ trả id + tên + giá + ảnh xem trước, KHÔNG trả đường dẫn sprite.
"""
import json
import os
import re
import sqlite3
from datetime import datetime

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH
from khoa_bang import uid_tu_token

pet_bp = Blueprint('pet', __name__)

GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_PET = os.path.abspath(os.path.join(GOC, '..', '..', 'Frontend', 'img', 'pet'))
FILE_MANIFEST = os.path.join(THU_MUC_PET, 'manifest.json')
URL_PET = "img/pet/"            # đường dẫn tương đối tính từ thư mục Frontend

# ====================== CẤU HÌNH ======================
SKIN_MAC_DINH = "mac_dinh"      # skin ai cũng có sẵn (không cần ghi vào pet_do)
GIOI_TINH_HOP_LE = ("nam", "nu")
GIOI_TINH_MAC_DINH = "nu"
SO_KHUNG_MAC_DINH = 6           # mỗi hành động có 6 khung
FPS_MAC_DINH = 6
TEN_AN_TOAN = re.compile(r'^[a-z0-9_]{1,40}$')   # id skin / tên hành động: chỉ chữ thường, số, gạch dưới

# ---- Chỉ để thử nghiệm: cấp skin ngay trên máy mình. ĐỂ False KHI ĐƯA LÊN HOSTING! ----
CHO_PHEP_DEV = True


# ====================== TỰ TẠO BẢNG / CỘT ======================
def dam_bao_bang_pet():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS pet (
            user_id INTEGER PRIMARY KEY,
            skin_dang_mac TEXT DEFAULT 'mac_dinh',
            gioi_tinh TEXT DEFAULT 'nu'
        )''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS pet_do (
            user_id INTEGER,
            skin_id TEXT,
            ngay_nhan TEXT DEFAULT '',
            PRIMARY KEY (user_id, skin_id)
        )''')
    # bảng pet đã có từ trước mà thiếu cột thì thêm vào
    cac_cot = [c[1] for c in conn.execute("PRAGMA table_info(pet)")]
    if 'skin_dang_mac' not in cac_cot:
        conn.execute("ALTER TABLE pet ADD COLUMN skin_dang_mac TEXT DEFAULT 'mac_dinh'")
    if 'gioi_tinh' not in cac_cot:
        conn.execute("ALTER TABLE pet ADD COLUMN gioi_tinh TEXT DEFAULT 'nu'")
    conn.commit()
    conn.close()

dam_bao_bang_pet()


# ====================== ĐỌC MANIFEST ======================
_CACHE_MANIFEST = {"mtime": None, "du_lieu": None}

def _manifest_rong():
    return {"so_khung": SO_KHUNG_MAC_DINH, "fps": FPS_MAC_DINH, "skin": {},
            "hieu_ung": {"ds": [], "theo_hanh_dong": {}}}

def _doc_manifest():
    """Đọc + làm sạch manifest.json. Chỉ đọc lại từ đĩa khi file đổi (so giờ sửa file)."""
    try:
        mtime = os.path.getmtime(FILE_MANIFEST)
    except OSError:
        return _CACHE_MANIFEST["du_lieu"] or _manifest_rong()
    if _CACHE_MANIFEST["mtime"] == mtime and _CACHE_MANIFEST["du_lieu"] is not None:
        return _CACHE_MANIFEST["du_lieu"]

    try:
        with open(FILE_MANIFEST, encoding='utf-8') as f:
            tho = json.load(f)
        if not isinstance(tho, dict):
            raise ValueError("manifest phải là một object")
    except (ValueError, OSError) as e:
        print(f"[pet] manifest.json lỗi, giữ bản cũ: {e}")
        return _CACHE_MANIFEST["du_lieu"] or _manifest_rong()

    kq = _manifest_rong()
    kq["so_khung"] = _so_nguyen(tho.get("so_khung"), SO_KHUNG_MAC_DINH, 1, 60)
    kq["fps"] = _so_nguyen(tho.get("fps"), FPS_MAC_DINH, 1, 30)

    for sid, info in (tho.get("skin") or {}).items():
        if not isinstance(info, dict) or not TEN_AN_TOAN.match(str(sid)):
            continue
        ds = [h for h in (info.get("hanh_dong") or []) if isinstance(h, str) and TEN_AN_TOAN.match(h)]
        if "idle" not in ds:   # mỗi skin BẮT BUỘC có idle, thiếu thì bỏ skin này
            print(f"[pet] skin '{sid}' không có 'idle' trong manifest, bỏ qua")
            continue
        kq["skin"][sid] = {
            "ten": str(info.get("ten") or sid)[:40],
            "gia": _so_nguyen(info.get("gia"), 0, 0, 10**9),
            "hanh_dong": list(dict.fromkeys(ds)),   # bỏ trùng, giữ thứ tự
        }

    hu = tho.get("hieu_ung") or {}
    ds_hu = [h for h in (hu.get("ds") or []) if isinstance(h, str) and TEN_AN_TOAN.match(h)]
    theo = {k: v for k, v in (hu.get("theo_hanh_dong") or {}).items()
            if isinstance(k, str) and TEN_AN_TOAN.match(k) and v in ds_hu}
    kq["hieu_ung"] = {"ds": ds_hu, "theo_hanh_dong": theo}

    _CACHE_MANIFEST["mtime"] = mtime
    _CACHE_MANIFEST["du_lieu"] = kq
    return kq

def _so_nguyen(v, mac_dinh, thap, cao):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return mac_dinh
    return max(thap, min(cao, n))


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def _loi(msg, ma=400):
    return jsonify({"success": False, "message": msg}), ma

def _body():
    d = request.get_json(silent=True)
    return d if isinstance(d, dict) else {}

def _co_user(conn, user_id):
    return conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None

def _skin_so_huu(conn, user_id):
    ds = {r[0] for r in conn.execute("SELECT skin_id FROM pet_do WHERE user_id = ?", (user_id,))}
    ds.add(SKIN_MAC_DINH)
    return ds

def _phien_ban_thu_muc(duong_dan):
    """Mốc thời gian sửa file mới nhất trong thư mục. Gắn vào đuôi URL ảnh (?v=...) để khi họa sĩ thay ảnh
    (tên file giữ nguyên) thì trình duyệt và service worker tự nạp bản mới, không dính ảnh cũ trong cache."""
    try:
        with os.scandir(duong_dan) as it:
            return max((int(e.stat().st_mtime) for e in it if e.is_file()), default=0)
    except OSError:
        return 0

def _mo_ta_skin(sid, info, so_huu):
    """Skin chưa sở hữu: KHÔNG có thu_muc / hanh_dong (không lộ đường dẫn sprite)."""
    thu_muc = os.path.join(THU_MUC_PET, "than", sid)
    v = _phien_ban_thu_muc(thu_muc)
    d = {
        "id": sid,
        "ten": info["ten"],
        "gia": info["gia"],
        "xem_truoc": f"{URL_PET}than/{sid}/_xem_truoc.webp?v={v}",
        "so_huu": so_huu,
    }
    if so_huu:
        d["thu_muc"] = f"{URL_PET}than/{sid}/"
        d["hanh_dong"] = info["hanh_dong"]
        d["v"] = v          # web nối ?v=<v> sau mỗi file sprite
    return d

def _trang_thai(conn, user_id):
    mf = _doc_manifest()
    row = conn.execute("SELECT skin_dang_mac, gioi_tinh FROM pet WHERE user_id = ?", (user_id,)).fetchone()
    so_huu = _skin_so_huu(conn, user_id)

    gioi_tinh = row['gioi_tinh'] if row and row['gioi_tinh'] in GIOI_TINH_HOP_LE else GIOI_TINH_MAC_DINH
    dang_mac = row['skin_dang_mac'] if row else SKIN_MAC_DINH
    # skin đang mặc đã bị xóa khỏi manifest hoặc không còn sở hữu -> quay về skin mặc định
    if dang_mac not in mf["skin"] or dang_mac not in so_huu:
        dang_mac = SKIN_MAC_DINH if SKIN_MAC_DINH in mf["skin"] else None

    ds_skin = [_mo_ta_skin(sid, info, sid in so_huu) for sid, info in mf["skin"].items()]
    hien_tai = next((s for s in ds_skin if s["id"] == dang_mac), None)
    return {
        "gioi_tinh": gioi_tinh,
        "skin_dang_mac": dang_mac,
        "skin_hien_tai": hien_tai,
        "skin": ds_skin,                   # danh sách cho màn hình chọn đồ / cửa hàng
        "so_khung": mf["so_khung"],
        "fps": mf["fps"],
        "hieu_ung": {"thu_muc": f"{URL_PET}hieu_ung/", "v": _phien_ban_thu_muc(os.path.join(THU_MUC_PET, "hieu_ung")),
                     **mf["hieu_ung"]},
    }

def _lay_uid_tu_token():
    """Ghi vào pet cần token (đăng nhập lại để có token). Trả (uid, None) hoặc (None, response lỗi)."""
    uid = uid_tu_token()
    if not uid:
        return None, _loi("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401)
    return uid, None

def cap_do(user_id, skin_id):
    """Cấp 1 skin cho người dùng. Trả True nếu mới được cấp, False nếu đã có hoặc skin không tồn tại.
    Cửa hàng / quà tặng / nhiệm vụ gọi hàm này sau khi đã tự xử lý việc thanh toán."""
    if skin_id not in _doc_manifest()["skin"]:
        return False
    conn = _ket_noi()
    try:
        cur = conn.execute(
            "INSERT OR IGNORE INTO pet_do (user_id, skin_id, ngay_nhan) VALUES (?, ?, ?)",
            (user_id, skin_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
        return cur.rowcount == 1
    finally:
        conn.close()


# ====================== API ======================
# Xem pet của 1 người dùng (công khai giống /api/users/<id>/qua; không có thông tin nhạy cảm)
@pet_bp.route('/api/pet', methods=['GET'])
def xem_pet():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return _loi("Thiếu user_id!", 400)
    conn = _ket_noi()
    try:
        if not _co_user(conn, user_id):
            return _loi("Không tìm thấy người dùng!", 404)
        return jsonify({"success": True, "data": _trang_thai(conn, user_id)}), 200
    finally:
        conn.close()


# Đổi giới tính giọng nói (chỉ ảnh hưởng giọng, không đổi hình)
@pet_bp.route('/api/pet', methods=['POST'])
def doi_gioi_tinh():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi
    gioi_tinh = str(_body().get('gioi_tinh') or '').strip().lower()
    if gioi_tinh not in GIOI_TINH_HOP_LE:
        return _loi("Giới tính chỉ có thể là 'nam' hoặc 'nu'!", 400)

    conn = _ket_noi()
    try:
        if not _co_user(conn, uid):
            return _loi("Không tìm thấy người dùng!", 404)
        conn.execute("INSERT OR IGNORE INTO pet (user_id) VALUES (?)", (uid,))
        conn.execute("UPDATE pet SET gioi_tinh = ? WHERE user_id = ?", (gioi_tinh, uid))
        conn.commit()
        return jsonify({"success": True, "data": _trang_thai(conn, uid)}), 200
    finally:
        conn.close()


# Mặc skin: kiểm tra quyền sở hữu NGAY TRONG câu lệnh UPDATE (không tin giao diện)
@pet_bp.route('/api/pet/mac', methods=['POST'])
def mac_skin():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi
    skin = str(_body().get('skin') or '').strip()
    if not TEN_AN_TOAN.match(skin) or skin not in _doc_manifest()["skin"]:
        return _loi("Trang phục không tồn tại!", 404)

    conn = _ket_noi()
    try:
        if not _co_user(conn, uid):
            return _loi("Không tìm thấy người dùng!", 404)
        conn.execute("INSERT OR IGNORE INTO pet (user_id) VALUES (?)", (uid,))
        cur = conn.execute(
            "UPDATE pet SET skin_dang_mac = ? WHERE user_id = ? "
            "AND (? = ? OR EXISTS (SELECT 1 FROM pet_do WHERE user_id = ? AND skin_id = ?))",
            (skin, uid, skin, SKIN_MAC_DINH, uid, skin))
        conn.commit()
        if cur.rowcount == 0:
            return _loi("Bạn chưa sở hữu trang phục này!", 403)
        return jsonify({"success": True, "data": _trang_thai(conn, uid)}), 200
    finally:
        conn.close()


# NÚT CẤP SKIN (chỉ để thử nghiệm, giống /api/dev/buff-diem)
@pet_bp.route('/api/dev/pet-cap-do', methods=['POST'])
def dev_cap_do():
    if not CHO_PHEP_DEV or request.remote_addr not in ('127.0.0.1', '::1'):
        return _loi("Tính năng này đã tắt!", 403)
    d = _body()
    try:
        user_id = int(d.get('user_id'))
    except (TypeError, ValueError):
        return _loi("Thiếu user_id!", 400)
    skin = str(d.get('skin') or '')
    conn = _ket_noi()
    co_user = _co_user(conn, user_id)
    conn.close()
    if not co_user:
        return _loi("Không tìm thấy người dùng!", 404)
    if skin not in _doc_manifest()["skin"]:
        return _loi("Trang phục không tồn tại!", 404)
    moi = cap_do(user_id, skin)
    return jsonify({"success": True, "moi": moi}), 200
