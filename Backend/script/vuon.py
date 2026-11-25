"""
Vườn Saoladou V28 (3 thanh chỉ số phân đoạn theo % + Online theo phút / Offline theo giờ + EduCoin Shop).

Bảng dữ liệu riêng (tự tạo khi nạp module / đổi DB_PATH):
  - vuon_trang_thai : 3 chỉ số (no_bung, vui_ve, sach_se kiểu REAL), mốc chăm sóc/online, mốc vuốt ve & tương tác
  - vuon_tui_do     : vật phẩm tiêu hao (thức ăn, nước suối, thảo dược) & dùng mãi (bàn chải, đồ chơi)
  - vuon_trang_tri  : vật phẩm trang trí vườn (mua 1 lần, bật/tắt hiển thị)

Quy tắc kinh tế & suy giảm:
  - Mua vật phẩm chỉ trừ `users.educoin` (KHÔNG bao giờ chạm `users.score` hay `diem_thang`).
  - Bỏ hoàn toàn EXP / Cấp độ và Skin trong Vườn.
  - Suy giảm phân đoạn theo mức %:
      * 70–100%: -1.0/phút (online) | -5.0/giờ (offline)
      * 30–69% : -1.6/phút (online) | -9.0/giờ (offline)
      * 0–29%  : -2.5/phút (online, Vui vẻ -3.0 nếu No hoặc Sạch < 30) | -14.0/giờ (offline)
  - Trong khung giờ ngủ cá nhân hóa (hoặc ban đêm 22:00–06:00 khi offline): hệ số suy giảm giảm còn 0.15x.
"""
import os
import random
import re
import sqlite3
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH
from khoa_bang import uid_tu_token
from pet import (
    FPS_MAC_DINH,
    SKIN_MAC_DINH,
    SO_KHUNG_MAC_DINH,
    THU_MUC_PET,
    URL_PET,
    _doc_manifest,
    _mo_ta_skin,
    _phien_ban_thu_muc,
)

vuon_bp = Blueprint('vuon', __name__)

DINH_DANG_GIO = "%Y-%m-%d %H:%M:%S"
GIO_OFFLINE_TOI_DA = 72
PHUT_ONLINE_TOI_DA = 5
GIAY_CHONG_SPAM_NHIP = 50
HE_SO_KHI_NGU = 0.15

VUOT_VE_HOI_CHIEU = 5 * 60     # 5 phút
VUOT_VE_TOI_DA_NGAY = 3
VUOT_VE_VUI = 6

TAM_SONG_HOI_CHIEU = 30 * 60   # 30 phút
TAM_SONG_TOI_DA_NGAY = 2
TAM_SONG_SACH = 12
TAM_SONG_VUI = 4

NGHI_CAY_HOI_CHIEU = 30 * 60   # 30 phút
NGHI_CAY_TOI_DA_NGAY = 2
NGHI_CAY_VUI = 8

LOI_NGAM_CANH = [
    "Gió Trường Sơn mát quá! Học xong một bài mình lại ra đây ngắm suối nhé!",
    "Từ tảng đá này nhìn thấy cả khu rừng xanh rì — cảm ơn bạn đã chăm sóc mình!",
    "Nghe nói loài Sao La bọn mình được gọi là Kỳ lân châu Á đó, cố gắng học giỏi nha!",
    "Nghỉ mắt vài giây ngắm trời xanh rồi tiếp tục chinh phục mục tiêu nhé!",
    "Tiếng suối chảy róc rách nghe thật bình yên, bạn đã hoàn thành nhiệm vụ hôm nay chưa?",
]

_DA_DAM_BAO_DB = set()
_RE_HHMM = re.compile(r'^\s*(\d{1,2})\s*[:hH]\s*(\d{0,2})\s*$')


# ====================== DANH MỤC VẬT PHẨM VƯỜN ======================
_DANH_MUC_GOC = [
    # --- Thức ăn thực vật (tieu_hao: True) ---
    {
        "id": "duong_xi",
        "nhom": "thuc_an",
        "ten": "Dương xỉ tổ chim (Asplenium)",
        "gia": 15,
        "mo_ta": "Lá dương xỉ non mọc trên thân cây ẩm rừng Trường Sơn, món ăn nhẹ khoái khẩu của Sao La.",
        "hieu_qua": {"no_bung": 25},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🌿",
    },
    {
        "id": "la_sung",
        "nhom": "thuc_an",
        "ten": "Lá sung ven suối (Ficus)",
        "gia": 28,
        "mo_ta": "Lá sung rừng xanh mướt dọc khe suối, giàu chất xơ giúp Sao La khỏe khoắn và vui vẻ.",
        "hieu_qua": {"no_bung": 35, "vui_ve": 8},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🍃",
    },
    {
        "id": "mon_thuc",
        "nhom": "thuc_an",
        "ten": "Thiên niên kiện / Môn thục (Homalomena)",
        "gia": 45,
        "mo_ta": "Loài thảo mộc đặc trưng dưới tán rừng kín thường xanh, bổ sung nhiều dinh dưỡng tự nhiên.",
        "hieu_qua": {"no_bung": 48, "vui_ve": 12},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🌱",
    },
    {
        "id": "ray_rung",
        "nhom": "thuc_an",
        "ten": "Cây chi Ráy rừng (Schismatoglottis)",
        "gia": 65,
        "mo_ta": "Cụm lá ráy rừng mọng nước vùng núi cao, giúp Sao La no lâu và tràn đầy năng lượng.",
        "hieu_qua": {"no_bung": 62, "vui_ve": 16},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🪴",
    },
    {
        "id": "ho_trom",
        "nhom": "thuc_an",
        "ten": "Lá cây họ Trôm (Sterculiaceae)",
        "gia": 95,
        "mo_ta": "Thực phẩm thượng hạng của Sao La ngoài tự nhiên, hồi phục độ no và tăng nhiều niềm vui.",
        "hieu_qua": {"no_bung": 75, "vui_ve": 24},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🍀",
    },
    # --- Chăm sóc & Thảo dược ---
    {
        "id": "nuoc_suoi",
        "nhom": "cham_soc",
        "ten": "Nước suối mát Trường Sơn",
        "gia": 20,
        "mo_ta": "Dòng nước suối đầu nguồn trong vắt giúp tắm mát, làm sạch lông và giải khát nhẹ.",
        "hieu_qua": {"sach_se": 32, "no_bung": 8},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "💧",
    },
    {
        "id": "thao_duoc",
        "nhom": "cham_soc",
        "ten": "Thảo dược hồi sức",
        "gia": 120,
        "mo_ta": "Bài thuốc quý từ rừng già, cấp cứu vực Sao La dậy khi xỉu — nâng mọi chỉ số (No, Vui, Sạch) lên tối thiểu 65%.",
        "hieu_qua": {"min_all": 65},
        "tieu_hao": True,
        "mua_1_lan": False,
        "cooldown_giay": 0,
        "pos": None,
        "icon": "🧪",
    },
    {
        "id": "ban_chai",
        "nhom": "cham_soc",
        "ten": "Bàn chải gỗ mộc",
        "gia": 240,
        "mo_ta": "Bàn chải chải lông thủ công từ gỗ rừng. Mua 1 lần dùng mãi (hồi chiêu 4 giờ).",
        "hieu_qua": {"sach_se": 26, "vui_ve": 10},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 14400,
        "pos": None,
        "icon": "🪥",
    },
    # --- Đồ chơi (mua_1_lan: True) ---
    {
        "id": "bong_may",
        "nhom": "do_choi",
        "ten": "Bóng đan mây tre",
        "gia": 260,
        "mo_ta": "Quả bóng đan từ sợi mây rừng cho Sao La nô đùa trên bãi cỏ (hồi chiêu 3 giờ, hơi lấm bẩn).",
        "hieu_qua": {"vui_ve": 26, "sach_se": -8},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 10800,
        "pos": None,
        "icon": "🧶",
    },
    {
        "id": "sao_truc",
        "nhom": "do_choi",
        "ten": "Sáo trúc ngân vang",
        "gia": 380,
        "mo_ta": "Tiếng sáo trúc du dương giữa núi rừng giúp Sao La thư giãn tuyệt đối (hồi chiêu 4 giờ).",
        "hieu_qua": {"vui_ve": 38},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 14400,
        "pos": None,
        "icon": "🪈",
    },
    # --- Trang trí vườn (mua_1_lan: True) ---
    {
        "id": "lan_rung",
        "nhom": "trang_tri",
        "ten": "Khóm hoa lan rừng",
        "gia": 300,
        "mo_ta": "Khóm phong lan nở rộ bên bờ hồ, thu hút bướm rừng ghé thăm khu vườn.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "43%", "bottom": "18%"},
        "icon": "🌸",
    },
    {
        "id": "den_dom_dom",
        "nhom": "trang_tri",
        "ten": "Đèn lồng đom đóm",
        "gia": 420,
        "mo_ta": "Chiếc đèn lồng mộc treo dưới nhánh cây cổ thụ tỏa ánh sáng ấm áp cùng đom đóm lung linh.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "81%", "bottom": "26%"},
        "icon": "🏮",
    },
    {
        "id": "ghe_da",
        "nhom": "trang_tri",
        "ten": "Ghế đá nghỉ chân",
        "gia": 360,
        "mo_ta": "Băng ghế đá phủ rêu xanh trên thảm cỏ — bấm vào ghế để Sao La chạy tới ngồi thư giãn!",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "65%", "bottom": "20%"},
        "icon": "🪑",
    },
    {
        "id": "bang_ten",
        "nhom": "trang_tri",
        "ten": "Bảng gỗ chủ vườn",
        "gia": 480,
        "mo_ta": "Tấm bảng gỗ khắc tên khu vườn riêng của bạn đặt bên thảm cỏ xanh.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "39%", "bottom": "36%"},
        "icon": "🪵",
    },
    {
        "id": "hoa_sen",
        "nhom": "trang_tri",
        "ten": "Cụm hoa sen & lá súng",
        "gia": 260,
        "mo_ta": "Đóa sen hồng phấn cùng lá súng xanh nổi nhẹ trên mặt hồ nước Trường Sơn.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "14%", "bottom": "16%"},
        "icon": "🪷",
    },
    {
        "id": "leu_trai",
        "nhom": "trang_tri",
        "ten": "Lều dã ngoại Trường Sơn",
        "gia": 460,
        "mo_ta": "Chiếc lều vải tam giác ấm cúng trên bãi cỏ — ban đêm cửa lều tỏa ánh đèn vàng dịu.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "22%", "bottom": "37%"},
        "icon": "⛺",
    },
    {
        "id": "chuong_gio",
        "nhom": "trang_tri",
        "ten": "Chuông gió trúc rừng",
        "gia": 320,
        "mo_ta": "Bộ chuông gió ống trúc treo trên cành cây cổ thụ ngân vang cùng nốt nhạc theo gió.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "94%", "bottom": "29%"},
        "icon": "🎐",
    },
    {
        "id": "suoi_nam",
        "nhom": "trang_tri",
        "ten": "Cụm nấm phát sáng",
        "gia": 290,
        "mo_ta": "Cụm nấm rừng rực sắc cam-xanh cạnh tảng đá lớn, phát sáng lung linh khi màn đêm buông xuống.",
        "hieu_qua": {},
        "tieu_hao": False,
        "mua_1_lan": True,
        "cooldown_giay": 0,
        "pos": {"left": "72%", "bottom": "31%"},
        "icon": "🍄",
    },
]

VAT_PHAM_VUON = {vp["id"]: vp for vp in _DANH_MUC_GOC}


# ====================== CÔNG THỨC SỨC KHỎE & TRỪ PHÂN ĐOẠN ======================
def tinh_suc_khoe(no_bung, vui_ve, sach_se):
    no_r = int(round(float(no_bung)))
    vui_r = int(round(float(vui_ve)))
    sach_r = int(round(float(sach_se)))
    if no_r < 20 or vui_r < 20 or sach_r < 20:
        return "om"
    if no_r < 50 or vui_r < 50 or sach_r < 50:
        return "can_cham"
    return "khoe_vui"


def _tru_phan_doan_1_buoc(val, muc_cao, muc_vua, muc_thap, he_so=1.0):
    """Trừ 1 bước theo ngưỡng % hiện tại: >=70% (muc_cao), 30..69% (muc_vua), <30% (muc_thap)."""
    v = max(0.0, min(100.0, float(val)))
    if v >= 70.0:
        muc = muc_cao
    elif v >= 30.0:
        muc = muc_vua
    else:
        muc = muc_thap
    return max(0.0, round(v - muc * float(he_so), 4))


def _phan_tich_phut(chuoi_gio, mac_dinh):
    if not chuoi_gio:
        return mac_dinh
    m = _RE_HHMM.match(str(chuoi_gio))
    if not m:
        return mac_dinh
    h = int(m.group(1))
    p = int(m.group(2) or 0)
    if 0 <= h < 24 and 0 <= p < 60:
        return h * 60 + p
    return mac_dinh


def _dang_trong_gio_ngu(dt, phut_ngu, phut_day):
    p = dt.hour * 60 + dt.minute
    if phut_ngu == phut_day:
        return False
    if phut_ngu > phut_day:
        return p >= phut_ngu or p < phut_day
    return phut_ngu <= p < phut_day


def _ap_dung_tru_online(no_bung, vui_ve, sach_se, so_phut, dang_ngu=False):
    he_so = HE_SO_KHI_NGU if dang_ngu else 1.0
    no_v = float(no_bung)
    vui_v = float(vui_ve)
    sach_v = float(sach_se)
    for _ in range(max(0, int(so_phut))):
        no_v = _tru_phan_doan_1_buoc(no_v, 1.0, 1.6, 2.5, he_so)
        sach_v = _tru_phan_doan_1_buoc(sach_v, 1.0, 1.6, 2.5, he_so)
        vui_thap = 3.0 if (no_v < 30.0 or sach_v < 30.0) else 2.5
        vui_v = _tru_phan_doan_1_buoc(vui_v, 1.0, 1.6, vui_thap, he_so)
    return no_v, vui_v, sach_v


def _ap_dung_tru_offline(no_bung, vui_ve, sach_se, moc_bat_dau, so_gio, phut_ngu=22 * 60, phut_day=6 * 60):
    no_v = float(no_bung)
    vui_v = float(vui_ve)
    sach_v = float(sach_se)
    for i in range(max(0, int(so_gio))):
        thoi_diem_giua = moc_bat_dau + timedelta(hours=i, minutes=30)
        he_so = HE_SO_KHI_NGU if _dang_trong_gio_ngu(thoi_diem_giua, phut_ngu, phut_day) else 1.0
        no_v = _tru_phan_doan_1_buoc(no_v, 5.0, 9.0, 14.0, he_so)
        sach_v = _tru_phan_doan_1_buoc(sach_v, 5.0, 9.0, 14.0, he_so)
        vui_v = _tru_phan_doan_1_buoc(vui_v, 5.0, 9.0, 14.0, he_so)
    return no_v, vui_v, sach_v


def _doc_moc_gio(moc_str):
    if not moc_str:
        return None
    try:
        return datetime.strptime(str(moc_str), DINH_DANG_GIO)
    except ValueError:
        return None


def _giay_hoi_chieu_con(moc_str, cooldown_giay, now_dt):
    if not moc_str or cooldown_giay <= 0:
        return 0
    cu = _doc_moc_gio(moc_str)
    if cu is None:
        return 0
    da_qua = (now_dt - cu).total_seconds()
    return max(0, int(cooldown_giay - da_qua))


# ====================== TỰ TẠO BẢNG / CỘT ======================
def dam_bao_bang_vuon():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS vuon_trang_thai (
                user_id INTEGER PRIMARY KEY,
                cap INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                no_bung REAL DEFAULT 80,
                vui_ve REAL DEFAULT 80,
                sach_se REAL DEFAULT 80,
                lan_cham TEXT,
                lan_online TEXT DEFAULT '',
                lan_vuot_ve TEXT DEFAULT '',
                vuot_ve_ngay TEXT DEFAULT '',
                vuot_ve_dem INTEGER DEFAULT 0,
                tuong_tac_ngay TEXT DEFAULT '',
                tam_song_dem INTEGER DEFAULT 0,
                tam_song_cuoi TEXT DEFAULT '',
                nghi_cay_dem INTEGER DEFAULT 0,
                nghi_cay_cuoi TEXT DEFAULT ''
            )''')
        cot_vuon = [c[1] for c in conn.execute("PRAGMA table_info(vuon_trang_thai)")]
        for ten_cot, kieu_cot in (
            ("lan_online", "TEXT DEFAULT ''"),
            ("tuong_tac_ngay", "TEXT DEFAULT ''"),
            ("tam_song_dem", "INTEGER DEFAULT 0"),
            ("tam_song_cuoi", "TEXT DEFAULT ''"),
            ("nghi_cay_dem", "INTEGER DEFAULT 0"),
            ("nghi_cay_cuoi", "TEXT DEFAULT ''"),
        ):
            if cot_vuon and ten_cot not in cot_vuon:
                conn.execute(f"ALTER TABLE vuon_trang_thai ADD COLUMN {ten_cot} {kieu_cot}")
        conn.execute('''
            CREATE TABLE IF NOT EXISTS vuon_tui_do (
                user_id INTEGER,
                item_id TEXT,
                so_luong INTEGER DEFAULT 0,
                lan_dung_cuoi TEXT DEFAULT '',
                PRIMARY KEY (user_id, item_id)
            )''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS vuon_trang_tri (
                user_id INTEGER,
                item_id TEXT,
                dang_bat INTEGER DEFAULT 1,
                PRIMARY KEY (user_id, item_id)
            )''')
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
        cac_cot_users = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
        if cac_cot_users and 'educoin' not in cac_cot_users:
            conn.execute("ALTER TABLE users ADD COLUMN educoin INTEGER DEFAULT 0")
        conn.commit()
        _DA_DAM_BAO_DB.add(DB_PATH)
    finally:
        conn.close()


dam_bao_bang_vuon()


# ====================== HÀM DÙNG CHUNG ======================
def _ket_noi():
    if DB_PATH not in _DA_DAM_BAO_DB:
        dam_bao_bang_vuon()
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _loi(msg, ma=400, **extra):
    payload = {"success": False, "message": msg}
    payload.update(extra)
    return jsonify(payload), ma


def _body():
    d = request.get_json(silent=True)
    return d if isinstance(d, dict) else {}


def _lay_uid_tu_token():
    uid = uid_tu_token()
    if not uid:
        return None, _loi("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401)
    return uid, None


def _lay_user(conn, user_id):
    return conn.execute(
        "SELECT id, username, COALESCE(score, 0) AS score, COALESCE(educoin, 0) AS educoin "
        "FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def _lay_hoac_tao_trang_thai(conn, user_id, now_dt, cap_nhat_online=True, phut_ngu=22 * 60, phut_day=6 * 60):
    now_str = now_dt.strftime(DINH_DANG_GIO)
    row = conn.execute("SELECT * FROM vuon_trang_thai WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        conn.execute(
            "INSERT OR IGNORE INTO vuon_trang_thai "
            "(user_id, cap, exp, no_bung, vui_ve, sach_se, lan_cham, lan_online, lan_vuot_ve, vuot_ve_ngay, vuot_ve_dem) "
            "VALUES (?, 1, 0, 80.0, 80.0, 80.0, ?, ?, '', '', 0)",
            (user_id, now_str, now_str),
        )
        row = conn.execute("SELECT * FROM vuon_trang_thai WHERE user_id = ?", (user_id,)).fetchone()
        st = dict(row)
        st["no_bung"] = float(st.get("no_bung") if st.get("no_bung") is not None else 80.0)
        st["vui_ve"] = float(st.get("vui_ve") if st.get("vui_ve") is not None else 80.0)
        st["sach_se"] = float(st.get("sach_se") if st.get("sach_se") is not None else 80.0)
        return st, True

    st = dict(row)
    no_bung = max(0.0, min(100.0, float(st.get("no_bung") if st.get("no_bung") is not None else 80.0)))
    vui_ve = max(0.0, min(100.0, float(st.get("vui_ve") if st.get("vui_ve") is not None else 80.0)))
    sach_se = max(0.0, min(100.0, float(st.get("sach_se") if st.get("sach_se") is not None else 80.0)))
    lan_cham = st.get("lan_cham") or ""
    lan_online = st.get("lan_online") or ""

    dt_cham = _doc_moc_gio(lan_cham)
    dt_online = _doc_moc_gio(lan_online)
    moc_cu = max([d for d in (dt_cham, dt_online) if d is not None], default=None)

    changed = False
    if moc_cu is None:
        lan_cham = now_str
        if cap_nhat_online:
            lan_online = now_str
        changed = True
    else:
        delta_s = max(0.0, (now_dt - moc_cu).total_seconds())
        if delta_s >= 3600.0:
            so_gio_thuc = int(delta_s // 3600)
            so_gio = min(GIO_OFFLINE_TOI_DA, so_gio_thuc)
            no_bung, vui_ve, sach_se = _ap_dung_tru_offline(
                no_bung, vui_ve, sach_se, moc_cu, so_gio, phut_ngu, phut_day
            )
            if so_gio_thuc >= GIO_OFFLINE_TOI_DA:
                lan_cham = now_str
            else:
                lan_cham = (moc_cu + timedelta(hours=so_gio)).strftime(DINH_DANG_GIO)
            if cap_nhat_online:
                lan_online = now_str
            changed = True
        elif cap_nhat_online and lan_online != now_str:
            lan_online = now_str
            changed = True

    if changed:
        conn.execute(
            "UPDATE vuon_trang_thai SET no_bung = ?, vui_ve = ?, sach_se = ?, lan_cham = ?, lan_online = ? "
            "WHERE user_id = ?",
            (no_bung, vui_ve, sach_se, lan_cham, lan_online, user_id),
        )

    st["no_bung"] = no_bung
    st["vui_ve"] = vui_ve
    st["sach_se"] = sach_se
    st["lan_cham"] = lan_cham
    st["lan_online"] = lan_online
    st["lan_vuot_ve"] = st.get("lan_vuot_ve") or ""
    st["vuot_ve_ngay"] = st.get("vuot_ve_ngay") or ""
    st["vuot_ve_dem"] = int(st.get("vuot_ve_dem") or 0)
    st["tuong_tac_ngay"] = st.get("tuong_tac_ngay") or ""
    st["tam_song_dem"] = int(st.get("tam_song_dem") or 0)
    st["tam_song_cuoi"] = st.get("tam_song_cuoi") or ""
    st["nghi_cay_dem"] = int(st.get("nghi_cay_dem") or 0)
    st["nghi_cay_cuoi"] = st.get("nghi_cay_cuoi") or ""
    return st, changed


def _xay_dung_du_lieu_vuon(conn, user_id, now_dt=None, cap_nhat_online=True, phut_ngu=22 * 60, phut_day=6 * 60):
    now_dt = now_dt or datetime.now()
    user = _lay_user(conn, user_id)
    if not user:
        return None, False

    st, changed = _lay_hoac_tao_trang_thai(
        conn, user_id, now_dt, cap_nhat_online=cap_nhat_online, phut_ngu=phut_ngu, phut_day=phut_day
    )
    today_str = now_dt.strftime("%Y-%m-%d")
    da_vuot_ve = st["vuot_ve_dem"] if st["vuot_ve_ngay"] == today_str else 0
    vuot_ve_con_lai = max(0, VUOT_VE_TOI_DA_NGAY - da_vuot_ve)
    vuot_ve_hoi_con = _giay_hoi_chieu_con(st["lan_vuot_ve"], VUOT_VE_HOI_CHIEU, now_dt)

    cung_ngay_tt = (st.get("tuong_tac_ngay") == today_str)
    da_tam_song = int(st.get("tam_song_dem") or 0) if cung_ngay_tt else 0
    da_nghi_cay = int(st.get("nghi_cay_dem") or 0) if cung_ngay_tt else 0
    tuong_tac_out = {
        "tam_song_con": max(0, TAM_SONG_TOI_DA_NGAY - da_tam_song),
        "tam_song_toi_da": TAM_SONG_TOI_DA_NGAY,
        "tam_song_cho_giay": _giay_hoi_chieu_con(st.get("tam_song_cuoi") or "", TAM_SONG_HOI_CHIEU, now_dt),
        "nghi_cay_con": max(0, NGHI_CAY_TOI_DA_NGAY - da_nghi_cay),
        "nghi_cay_toi_da": NGHI_CAY_TOI_DA_NGAY,
        "nghi_cay_cho_giay": _giay_hoi_chieu_con(st.get("nghi_cay_cuoi") or "", NGHI_CAY_HOI_CHIEU, now_dt),
    }

    no_hien = max(0, min(100, int(round(st["no_bung"]))))
    vui_hien = max(0, min(100, int(round(st["vui_ve"]))))
    sach_hien = max(0, min(100, int(round(st["sach_se"]))))
    sk = tinh_suc_khoe(no_hien, vui_hien, sach_hien)
    trang_thai_out = {
        "no_bung": no_hien,
        "vui_ve": vui_hien,
        "sach_se": sach_hien,
        "suc_khoe": sk,
        "vuot_ve_con_lai": vuot_ve_con_lai,
        "vuot_ve_toi_da": VUOT_VE_TOI_DA_NGAY,
        "vuot_ve_hoi_con": vuot_ve_hoi_con,
    }

    # Túi đồ
    tui_rows = conn.execute(
        "SELECT item_id, so_luong, lan_dung_cuoi FROM vuon_tui_do WHERE user_id = ? AND so_luong > 0",
        (user_id,),
    ).fetchall()
    tui_map = {r["item_id"]: r for r in tui_rows}
    tui_do = []
    for vp in _DANH_MUC_GOC:
        r = tui_map.get(vp["id"])
        if not r:
            continue
        lan_cuoi = r["lan_dung_cuoi"] or ""
        tui_do.append({
            "id": vp["id"],
            "item_id": vp["id"],
            "nhom": vp["nhom"],
            "ten": vp["ten"],
            "gia": vp["gia"],
            "mo_ta": vp["mo_ta"],
            "hieu_qua": dict(vp["hieu_qua"]),
            "tieu_hao": vp["tieu_hao"],
            "mua_1_lan": vp["mua_1_lan"],
            "cooldown_giay": vp["cooldown_giay"],
            "icon": vp["icon"],
            "so_luong": int(r["so_luong"] or 0),
            "lan_dung_cuoi": lan_cuoi,
            "hoi_chieu_con": _giay_hoi_chieu_con(lan_cuoi, vp["cooldown_giay"], now_dt),
        })

    # Trang trí
    tt_rows = conn.execute(
        "SELECT item_id, dang_bat FROM vuon_trang_tri WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    tt_map = {r["item_id"]: r for r in tt_rows}
    trang_tri = []
    for vp in _DANH_MUC_GOC:
        if vp["nhom"] != "trang_tri":
            continue
        r = tt_map.get(vp["id"])
        if not r:
            continue
        trang_tri.append({
            "item_id": vp["id"],
            "id": vp["id"],
            "ten": vp["ten"],
            "mo_ta": vp["mo_ta"],
            "pos": vp["pos"],
            "icon": vp["icon"],
            "dang_bat": 1 if r["dang_bat"] else 0,
        })

    # Nhân vật duy nhất mặc định (đã bỏ hoàn toàn tính năng Skin)
    mf = _doc_manifest()
    dang_mac = SKIN_MAC_DINH if SKIN_MAC_DINH in mf["skin"] else None
    skin_hien_tai = _mo_ta_skin(dang_mac, mf["skin"][dang_mac], True) if dang_mac else None

    catalog = [
        {
            "id": vp["id"],
            "nhom": vp["nhom"],
            "ten": vp["ten"],
            "gia": vp["gia"],
            "mo_ta": vp["mo_ta"],
            "hieu_qua": dict(vp["hieu_qua"]),
            "tieu_hao": vp["tieu_hao"],
            "mua_1_lan": vp["mua_1_lan"],
            "cooldown_giay": vp["cooldown_giay"],
            "pos": vp["pos"],
            "icon": vp["icon"],
        }
        for vp in _DANH_MUC_GOC
    ]

    data = {
        "trang_thai": trang_thai_out,
        "tuong_tac": tuong_tac_out,
        "suc_khoe": sk,
        "educoin": int(user["educoin"] or 0),
        "score": int(user["score"] or 0),
        "username": user["username"],
        "tui_do": tui_do,
        "trang_tri": trang_tri,
        "skin_hien_tai": skin_hien_tai,
        "so_khung": mf.get("so_khung", SO_KHUNG_MAC_DINH),
        "fps": mf.get("fps", FPS_MAC_DINH),
        "hieu_ung": {
            "thu_muc": f"{URL_PET}hieu_ung/",
            "v": _phien_ban_thu_muc(os.path.join(THU_MUC_PET, "hieu_ung")),
            **mf.get("hieu_ung", {}),
        },
        "catalog": catalog,
    }
    return data, changed


# ====================== API ROUTES ======================
@vuon_bp.route('/api/vuon', methods=['GET'])
def xem_vuon():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return _loi("Thiếu user_id!", 400)
    phut_ngu = _phan_tich_phut(request.args.get('ngu_tu'), 22 * 60)
    phut_day = _phan_tich_phut(request.args.get('ngu_den'), 6 * 60)
    conn = _ket_noi()
    try:
        data, changed = _xay_dung_du_lieu_vuon(
            conn, user_id, cap_nhat_online=True, phut_ngu=phut_ngu, phut_day=phut_day
        )
        if data is None:
            return _loi("Không tìm thấy người dùng!", 404)
        if changed:
            conn.commit()
        return jsonify({"success": True, "data": data}), 200
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/nhip', methods=['POST'])
def nhip_online_vuon():
    """Nhịp định kỳ mỗi 60 giây khi người dùng đang mở tab Vườn: trừ phân đoạn theo PHÚT."""
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    body = _body()
    dang_ngu = bool(body.get("dang_ngu"))
    phut_ngu = _phan_tich_phut(body.get("ngu_tu"), 22 * 60)
    phut_day = _phan_tich_phut(body.get("ngu_den"), 6 * 60)

    now_dt = datetime.now()
    now_str = now_dt.strftime(DINH_DANG_GIO)
    conn = _ket_noi()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = _lay_user(conn, uid)
        if not user:
            conn.rollback()
            return _loi("Không tìm thấy người dùng!", 404)

        # Kiểm tra nếu trước đó máy ngủ / offline >= 1 giờ thì tính bước offline trước
        st, _ = _lay_hoac_tao_trang_thai(
            conn, uid, now_dt, cap_nhat_online=False, phut_ngu=phut_ngu, phut_day=phut_day
        )
        dt_online = _doc_moc_gio(st.get("lan_online")) or _doc_moc_gio(st.get("lan_cham"))
        if dt_online is None:
            conn.execute(
                "UPDATE vuon_trang_thai SET lan_online = ?, lan_cham = ? WHERE user_id = ?",
                (now_str, now_str, uid),
            )
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({"success": True, "tick_applied": False, "so_phut": 0, "data": data}), 200

        delta_s = max(0.0, (now_dt - dt_online).total_seconds())
        if delta_s < GIAY_CHONG_SPAM_NHIP:
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({"success": True, "tick_applied": False, "so_phut": 0, "data": data}), 200

        if delta_s >= 3600.0:
            # Đã trừ bước giờ ở _lay_hoac_tao_trang_thai phía trên; chỉ cập nhật mốc online mới
            conn.execute(
                "UPDATE vuon_trang_thai SET lan_online = ? WHERE user_id = ?",
                (now_str, uid),
            )
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({"success": True, "tick_applied": True, "so_phut": 0, "offline_synced": True, "data": data}), 200

        so_phut = min(PHUT_ONLINE_TOI_DA, max(1, int(delta_s // 60)))
        no_moi, vui_moi, sach_moi = _ap_dung_tru_online(
            st["no_bung"], st["vui_ve"], st["sach_se"], so_phut, dang_ngu=dang_ngu
        )
        conn.execute(
            "UPDATE vuon_trang_thai "
            "SET no_bung = ?, vui_ve = ?, sach_se = ?, lan_cham = ?, lan_online = ? "
            "WHERE user_id = ?",
            (no_moi, vui_moi, sach_moi, now_str, now_str, uid),
        )
        data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
        conn.commit()
        return jsonify({
            "success": True,
            "tick_applied": True,
            "so_phut": so_phut,
            "dang_ngu": dang_ngu,
            "data": data,
        }), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/mua', methods=['POST'])
def mua_vuon():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    body = _body()
    loai = str(body.get("loai") or "").strip()
    item_id = str(body.get("id") or "").strip()
    if loai != "vat_pham":
        return _loi("Cửa hàng Vườn hiện chỉ bán vật phẩm chăm sóc và trang trí!", 400)
    if not item_id:
        return _loi("Thiếu mã vật phẩm!", 400)

    raw_sl = body.get("so_luong", 1)
    try:
        so_luong = int(1 if raw_sl is None else raw_sl)
    except (TypeError, ValueError):
        return _loi("Số lượng không hợp lệ!", 400)

    item = VAT_PHAM_VUON.get(item_id)
    if not item:
        return _loi("Vật phẩm không tồn tại!", 404)
    if item["mua_1_lan"]:
        if so_luong != 1:
            return _loi("Vật phẩm này chỉ mua 1 lần với số lượng 1!", 400)
    elif not (1 <= so_luong <= 99):
        return _loi("Số lượng phải từ 1 đến 99!", 400)
    tong_tien = int(item["gia"]) * so_luong
    ten_mua = item["ten"]

    now_dt = datetime.now()
    conn = _ket_noi()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = _lay_user(conn, uid)
        if not user:
            conn.rollback()
            return _loi("Không tìm thấy người dùng!", 404)

        if item["nhom"] == "trang_tri":
            da_co = conn.execute(
                "SELECT 1 FROM vuon_trang_tri WHERE user_id = ? AND item_id = ?",
                (uid, item_id),
            ).fetchone()
            if da_co:
                conn.rollback()
                return _loi("Bạn đã sở hữu món trang trí này rồi!", 409)
        elif item["mua_1_lan"]:
            da_co = conn.execute(
                "SELECT so_luong FROM vuon_tui_do WHERE user_id = ? AND item_id = ?",
                (uid, item_id),
            ).fetchone()
            if da_co and (da_co["so_luong"] or 0) >= 1:
                conn.rollback()
                return _loi("Bạn đã sở hữu vật phẩm này rồi!", 409)

        # Chỉ trừ users.educoin, TUYỆT ĐỐI không đụng users.score hay diem_thang
        cur = conn.execute(
            "UPDATE users SET educoin = COALESCE(educoin, 0) - ? "
            "WHERE id = ? AND COALESCE(educoin, 0) >= ?",
            (tong_tien, uid, tong_tien),
        )
        if cur.rowcount == 0:
            conn.rollback()
            return _loi("Bạn không đủ EduCoin để mua!", 400)

        if item["nhom"] == "trang_tri":
            conn.execute(
                "INSERT INTO vuon_trang_tri (user_id, item_id, dang_bat) VALUES (?, ?, 1)",
                (uid, item_id),
            )
        else:
            conn.execute(
                "INSERT INTO vuon_tui_do (user_id, item_id, so_luong, lan_dung_cuoi) "
                "VALUES (?, ?, ?, '') "
                "ON CONFLICT(user_id, item_id) DO UPDATE SET "
                "so_luong = COALESCE(vuon_tui_do.so_luong, 0) + excluded.so_luong",
                (uid, item_id, so_luong),
            )

        data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt)
        conn.commit()
        return jsonify({
            "success": True,
            "message": f"Đã mua {ten_mua}" + (f" x{so_luong}" if so_luong > 1 else "") + "!",
            "data": data,
        }), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/dung', methods=['POST'])
def dung_vat_pham():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    item_id = str(_body().get("item_id") or "").strip()
    item = VAT_PHAM_VUON.get(item_id)
    if not item or item["nhom"] == "trang_tri":
        return _loi("Vật phẩm không hợp lệ để sử dụng!", 400)

    now_dt = datetime.now()
    now_str = now_dt.strftime(DINH_DANG_GIO)
    conn = _ket_noi()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = _lay_user(conn, uid)
        if not user:
            conn.rollback()
            return _loi("Không tìm thấy người dùng!", 404)

        st, _ = _lay_hoac_tao_trang_thai(conn, uid, now_dt)

        row_tui = conn.execute(
            "SELECT so_luong, lan_dung_cuoi FROM vuon_tui_do WHERE user_id = ? AND item_id = ?",
            (uid, item_id),
        ).fetchone()
        if not row_tui or int(row_tui["so_luong"] or 0) <= 0:
            conn.rollback()
            return _loi("Bạn chưa có vật phẩm này trong túi!", 400)

        if item["tieu_hao"]:
            cur = conn.execute(
                "UPDATE vuon_tui_do SET so_luong = so_luong - 1, lan_dung_cuoi = ? "
                "WHERE user_id = ? AND item_id = ? AND so_luong >= 1",
                (now_str, uid, item_id),
            )
            if cur.rowcount == 0:
                conn.rollback()
                return _loi("Bạn đã hết vật phẩm này trong túi!", 400)
        else:
            hoi_con = _giay_hoi_chieu_con(row_tui["lan_dung_cuoi"] or "", item["cooldown_giay"], now_dt)
            if hoi_con > 0:
                conn.rollback()
                return _loi(
                    f"Vật phẩm đang hồi chiêu, hãy đợi thêm {hoi_con} giây nữa nhé!",
                    429,
                    hoi_chieu_con=hoi_con,
                )
            conn.execute(
                "UPDATE vuon_tui_do SET lan_dung_cuoi = ? WHERE user_id = ? AND item_id = ?",
                (now_str, uid, item_id),
            )

        hq = item["hieu_qua"]
        no_bung = float(st["no_bung"])
        vui_ve = float(st["vui_ve"])
        sach_se = float(st["sach_se"])
        da_om_truoc = (tinh_suc_khoe(no_bung, vui_ve, sach_se) == "om")

        if "min_all" in hq:
            muc_min = float(hq["min_all"])
            no_bung = max(no_bung, muc_min)
            vui_ve = max(vui_ve, muc_min)
            sach_se = max(sach_se, muc_min)

        no_bung = max(0.0, min(100.0, no_bung + float(hq.get("no_bung", 0))))
        vui_ve = max(0.0, min(100.0, vui_ve + float(hq.get("vui_ve", 0))))
        sach_se = max(0.0, min(100.0, sach_se + float(hq.get("sach_se", 0))))
        het_om = da_om_truoc and (tinh_suc_khoe(no_bung, vui_ve, sach_se) != "om")

        conn.execute(
            "UPDATE vuon_trang_thai "
            "SET no_bung = ?, vui_ve = ?, sach_se = ?, lan_cham = ?, lan_online = ? "
            "WHERE user_id = ?",
            (no_bung, vui_ve, sach_se, now_str, now_str, uid),
        )

        data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
        conn.commit()
        if het_om:
            msg = f"Tuyệt vời! {item['ten']} đã giúp SaoLa tỉnh lại và khỏe khoắn rồi!"
        else:
            msg = f"Đã dùng {item['ten']}! SaoLa cảm thấy dễ chịu hơn nhiều."
        return jsonify({
            "success": True,
            "het_om": het_om,
            "message": msg,
            "data": data,
        }), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/vuot-ve', methods=['POST'])
def vuot_ve():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    now_dt = datetime.now()
    now_str = now_dt.strftime(DINH_DANG_GIO)
    today_str = now_dt.strftime("%Y-%m-%d")

    conn = _ket_noi()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = _lay_user(conn, uid)
        if not user:
            conn.rollback()
            return _loi("Không tìm thấy người dùng!", 404)

        st, _ = _lay_hoac_tao_trang_thai(conn, uid, now_dt)
        sk = tinh_suc_khoe(st["no_bung"], st["vui_ve"], st["sach_se"])
        if sk == "om":
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "om": True,
                "vui_cong": 0,
                "message": "SaoLa đang xỉu vì kiệt sức! Hãy cho ăn lá rừng, uống nước suối hoặc dùng Thảo dược để hồi sức nhé!",
                "data": data,
            }), 200

        hoi_con = _giay_hoi_chieu_con(st["lan_vuot_ve"], VUOT_VE_HOI_CHIEU, now_dt)
        if hoi_con > 0:
            conn.rollback()
            return _loi(
                f"Hãy đợi thêm {hoi_con} giây nữa để vuốt ve Saoladuo nhé!",
                429,
                hoi_chieu_con=hoi_con,
            )

        dem_hom_nay = st["vuot_ve_dem"] if st["vuot_ve_ngay"] == today_str else 0
        if dem_hom_nay >= VUOT_VE_TOI_DA_NGAY:
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "het_luot": True,
                "vui_cong": 0,
                "message": f"Hôm nay Saoladuo đã nhận đủ {VUOT_VE_TOI_DA_NGAY} lượt thưởng vuốt ve rồi! Mai quay lại nhé.",
                "data": data,
            }), 200

        vui_moi = max(0.0, min(100.0, float(st["vui_ve"]) + VUOT_VE_VUI))
        vui_cong = int(round(vui_moi - float(st["vui_ve"])))
        dem_moi = dem_hom_nay + 1

        conn.execute(
            "UPDATE vuon_trang_thai "
            "SET vui_ve = ?, lan_cham = ?, lan_online = ?, lan_vuot_ve = ?, vuot_ve_ngay = ?, vuot_ve_dem = ? "
            "WHERE user_id = ?",
            (vui_moi, now_str, now_str, now_str, today_str, dem_moi, uid),
        )

        data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
        conn.commit()
        return jsonify({
            "success": True,
            "vui_cong": vui_cong,
            "message": f"Saoladuo rất thích được vuốt ve! (+{VUOT_VE_VUI} Vui vẻ)",
            "data": data,
        }), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/trang-tri', methods=['POST'])
def bat_tat_trang_tri():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    body = _body()
    item_id = str(body.get("item_id") or "").strip()
    item = VAT_PHAM_VUON.get(item_id)
    if not item or item["nhom"] != "trang_tri":
        return _loi("Vật phẩm trang trí không hợp lệ!", 400)

    raw_bat = body.get("bat")
    if isinstance(raw_bat, str):
        bat = 0 if raw_bat.strip().lower() in ("0", "false", "no", "off", "") else 1
    else:
        bat = 1 if raw_bat else 0

    conn = _ket_noi()
    try:
        cur = conn.execute(
            "UPDATE vuon_trang_tri SET dang_bat = ? WHERE user_id = ? AND item_id = ?",
            (bat, uid, item_id),
        )
        if cur.rowcount == 0:
            return _loi("Bạn chưa sở hữu món trang trí này!", 403)
        data, _ = _xay_dung_du_lieu_vuon(conn, uid)
        conn.commit()
        trang_thai_chu = "bật" if bat else "ẩn"
        return jsonify({
            "success": True,
            "message": f"Đã {trang_thai_chu} {item['ten']}!",
            "data": data,
        }), 200
    finally:
        conn.close()


@vuon_bp.route('/api/vuon/tuong-tac', methods=['POST'])
def tuong_tac_moi_truong():
    uid, loi = _lay_uid_tu_token()
    if loi:
        return loi

    hanh_dong = str(_body().get("hanh_dong") or "").strip()
    if hanh_dong not in ("tam_song", "nghi_cay", "ngam_canh"):
        return _loi("Hành động tương tác không hợp lệ!", 400)

    now_dt = datetime.now()
    now_str = now_dt.strftime(DINH_DANG_GIO)
    today_str = now_dt.strftime("%Y-%m-%d")

    conn = _ket_noi()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = _lay_user(conn, uid)
        if not user:
            conn.rollback()
            return _loi("Không tìm thấy người dùng!", 404)

        st, _ = _lay_hoac_tao_trang_thai(conn, uid, now_dt)
        if tinh_suc_khoe(st["no_bung"], st["vui_ve"], st["sach_se"]) == "om":
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "om": True,
                "cong_diem": False,
                "cho_giay": 0,
                "message": "SaoLa đang xỉu vì kiệt sức! Hãy cho ăn lá rừng, uống nước suối hoặc dùng Thảo dược để hồi sức nhé!",
                "data": data,
            }), 200

        if hanh_dong == "ngam_canh":
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "cong_diem": False,
                "cho_giay": 0,
                "message": random.choice(LOI_NGAM_CANH),
                "data": data,
            }), 200

        cung_ngay = (st["tuong_tac_ngay"] == today_str)
        dem_tam = st["tam_song_dem"] if cung_ngay else 0
        dem_nghi = st["nghi_cay_dem"] if cung_ngay else 0

        if hanh_dong == "tam_song":
            if dem_tam >= TAM_SONG_TOI_DA_NGAY:
                data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
                conn.commit()
                return jsonify({
                    "success": True,
                    "cong_diem": False,
                    "het_luot": True,
                    "cho_giay": 0,
                    "message": f"Hôm nay SaoLa đã tắm hồ đủ {TAM_SONG_TOI_DA_NGAY} lượt nhận thưởng rồi, bơi thêm cho mát thôi nhé!",
                    "data": data,
                }), 200
            cho_giay = _giay_hoi_chieu_con(st["tam_song_cuoi"], TAM_SONG_HOI_CHIEU, now_dt)
            if cho_giay > 0:
                phut = max(1, (cho_giay + 59) // 60)
                data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
                conn.commit()
                return jsonify({
                    "success": True,
                    "cong_diem": False,
                    "cho_giay": cho_giay,
                    "message": f"Nước hồ mát quá! Đợi khoảng {phut} phút nữa mới nhận thêm thưởng tắm hồ nhé.",
                    "data": data,
                }), 200

            sach_moi = max(0.0, min(100.0, float(st["sach_se"]) + TAM_SONG_SACH))
            vui_moi = max(0.0, min(100.0, float(st["vui_ve"]) + TAM_SONG_VUI))
            conn.execute(
                "UPDATE vuon_trang_thai "
                "SET sach_se = ?, vui_ve = ?, lan_cham = ?, lan_online = ?, "
                "tuong_tac_ngay = ?, tam_song_dem = ?, tam_song_cuoi = ?, nghi_cay_dem = ? "
                "WHERE user_id = ?",
                (sach_moi, vui_moi, now_str, now_str, today_str, dem_tam + 1, now_str, dem_nghi, uid),
            )
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "cong_diem": True,
                "cho_giay": 0,
                "sach_cong": TAM_SONG_SACH,
                "vui_cong": TAM_SONG_VUI,
                "message": f"Tắm hồ thật sảng khoái! (+{TAM_SONG_SACH} Sạch sẽ, +{TAM_SONG_VUI} Vui vẻ)",
                "data": data,
            }), 200

        # nghi_cay
        if dem_nghi >= NGHI_CAY_TOI_DA_NGAY:
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "cong_diem": False,
                "het_luot": True,
                "cho_giay": 0,
                "message": f"Hôm nay SaoLa đã nghỉ dưới gốc cây đủ {NGHI_CAY_TOI_DA_NGAY} lượt thưởng rồi, nằm hóng mát chút nha!",
                "data": data,
            }), 200
        cho_giay = _giay_hoi_chieu_con(st["nghi_cay_cuoi"], NGHI_CAY_HOI_CHIEU, now_dt)
        if cho_giay > 0:
            phut = max(1, (cho_giay + 59) // 60)
            data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
            conn.commit()
            return jsonify({
                "success": True,
                "cong_diem": False,
                "cho_giay": cho_giay,
                "message": f"Bóng cây râm mát quá! Đợi khoảng {phut} phút nữa để nhận thêm thưởng nghỉ ngơi nhé.",
                "data": data,
            }), 200

        vui_moi = max(0.0, min(100.0, float(st["vui_ve"]) + NGHI_CAY_VUI))
        conn.execute(
            "UPDATE vuon_trang_thai "
            "SET vui_ve = ?, lan_cham = ?, lan_online = ?, "
            "tuong_tac_ngay = ?, tam_song_dem = ?, nghi_cay_dem = ?, nghi_cay_cuoi = ? "
            "WHERE user_id = ?",
            (vui_moi, now_str, now_str, today_str, dem_tam, dem_nghi + 1, now_str, uid),
        )
        data, _ = _xay_dung_du_lieu_vuon(conn, uid, now_dt, cap_nhat_online=False)
        conn.commit()
        return jsonify({
            "success": True,
            "cong_diem": True,
            "cho_giay": 0,
            "vui_cong": NGHI_CAY_VUI,
            "message": f"Nghỉ dưới tán cây thật dễ chịu! (+{NGHI_CAY_VUI} Vui vẻ)",
            "data": data,
        }), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
