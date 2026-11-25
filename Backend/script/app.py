from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import sqlite3
from datetime import date, timedelta, datetime
from werkzeug.security import generate_password_hash, check_password_hash
import os, re, json, uuid, random, secrets, smtplib, base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from PIL import Image, ImageOps
from db_ops import (
    DB_PATH,
    add_user, get_all_users, update_user, delete_user,
    update_streak, update_user_score, get_ranking, update_mon_chuyen,
    get_user, update_avatar, streak_hien_thi, get_my_rank,
    BANG_XEP_HANG, KY_XEP_HANG, MON_CHUYEN_HOP_LE, thang_hien_tai
)
from cham_ngu_nghia import cham_hon_hop as cham_tu_luan, nap_san

from qua_tang import qua_bp, he_so_x15   # điểm danh + vòng quay + buff x1,5


DIEM_MO_KHOA_SUA = 500      # điểm để mở khóa "Sửa hồ sơ"
DIEM_MO_KHOA_AVATAR = 500   # điểm để mở khóa "Tải ảnh avatar riêng"

# ---- NÚT BUFF ĐIỂM: ĐÃ TẮT ĐỂ ĐẢM BẢO BẢO MẬT HỆ THỐNG ----
CHO_PHEP_BUFF = False
DIEM_BUFF = 0

app = Flask(__name__)
CORS(app)  # Cho phép Frontend kết nối tới Backend
app.register_blueprint(qua_bp)
from tien_do import tien_do_bp, ghi_diem_cao_nhat   # hạng thành tích
app.register_blueprint(tien_do_bp)
from so_loi import so_loi_bp, ghi_ket_qua_nop_bai          # Sổ lỗi sai
from nhiem_vu import nhiem_vu_bp, ghi_su_kien_nop_bai      # Nhiệm vụ hằng ngày
app.register_blueprint(so_loi_bp)
app.register_blueprint(nhiem_vu_bp)
from khoa_bang import kb_bp, ghi_hoat_dong, tao_token
app.register_blueprint(kb_bp)
from pet import pet_bp   # Sao La: skin (trang phục) + giới tính giọng nói
app.register_blueprint(pet_bp)
from vuon import vuon_bp   # Vườn Saoladou: chăm sóc, cửa hàng EduCoin
app.register_blueprint(vuon_bp)
from huy_hieu import huy_hieu_bp, cap_nhat_huy_hieu, dam_bao_bang_tren_conn as dam_bao_huy_hieu_conn
app.register_blueprint(huy_hieu_bp)
from muc_tieu import muc_tieu_bp   # Độ sẵn sàng mục tiêu trường & năng lực môn chuyên tự động (V30)
app.register_blueprint(muc_tieu_bp)
from luyen_tap import luyen_tap_bp  # Game hóa bài tập V31: chấm tức thì theo độ tự tin & Focus Combo
app.register_blueprint(luyen_tap_bp)

# Giới hạn dung lượng 1 request là 3MB (ảnh đã được trình duyệt thu nhỏ nên rất nhẹ)
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000   # chặn ảnh "bom" giải nén ra quá lớn

@app.errorhandler(413)
def file_qua_lon(e):
    return jsonify({"success": False, "message": "Ảnh quá lớn (tối đa 3MB)!"}), 413

# Tự thêm cột nếu DB chưa có (tài khoản cũ coi như đã khảo sát)
def dam_bao_cot():
    conn = sqlite3.connect(DB_PATH)
    cac_cot = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
    if 'da_khao_sat' not in cac_cot:
        conn.execute("ALTER TABLE users ADD COLUMN da_khao_sat INTEGER DEFAULT 0")
        conn.execute("UPDATE users SET da_khao_sat = 1")
    if 'avatar' not in cac_cot:
        conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    dam_bao_huy_hieu_conn(conn)

    # Đảm bảo các cột số của tài khoản cũ/mới không bị NULL
    conn.execute("UPDATE users SET score = COALESCE(score, 0), streak = COALESCE(streak, 0) WHERE score IS NULL OR streak IS NULL")
    if 'dd_tong' in cac_cot:
        conn.execute("UPDATE users SET dd_tong = COALESCE(dd_tong, 0) WHERE dd_tong IS NULL")
    if 'the_bao_ho' in cac_cot:
        conn.execute("UPDATE users SET the_bao_ho = COALESCE(the_bao_ho, 0) WHERE the_bao_ho IS NULL")
    if 'luot_quay' in cac_cot:
        conn.execute("UPDATE users SET luot_quay = COALESCE(luot_quay, 0) WHERE luot_quay IS NULL")

    # Đảm bảo bảng password_resets tồn tại
    conn.execute('''
    CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    ''')
    conn.commit()
    conn.close()

dam_bao_cot()

GOC = os.path.dirname(os.path.abspath(__file__))

# thư mục avatar do admin bỏ ảnh vào (nằm trong Frontend để trình duyệt hiện được)
THU_MUC_AVATAR = os.path.join(GOC, '..', '..', 'Frontend', 'img', 'avatar')
DUOI_AVATAR = ('.webp', '.png', '.jpg', '.jpeg', '.gif')

# thư mục ảnh do NGƯỜI DÙNG tải lên (nằm ngoài Frontend, chỉ phục vụ qua route bên dưới)
THU_MUC_UPLOAD = os.path.abspath(os.path.join(GOC, '..', 'uploads', 'avatars'))
os.makedirs(THU_MUC_UPLOAD, exist_ok=True)

# tên file người dùng tải lên luôn có dạng up_<32 ký tự hex>.webp
TEN_UPLOAD = re.compile(r'^up_[a-f0-9]{32}\.webp$')

def ds_avatar():
    # đọc thẳng thư mục: admin bỏ ảnh vào là có ngay, không cần sửa file nào
    # bỏ qua tên bắt đầu bằng "up_" để không lẫn với ảnh người dùng tải lên
    if not os.path.isdir(THU_MUC_AVATAR):
        return []
    return sorted(
        f for f in os.listdir(THU_MUC_AVATAR)
        if f.lower().endswith(DUOI_AVATAR) and not f.startswith('up_')
    )

def xoa_anh_upload(ten):
    # xóa file ảnh người dùng đã tải lên (chỉ xóa đúng file có tên hợp lệ)
    if ten and TEN_UPLOAD.match(ten):
        try:
            os.remove(os.path.join(THU_MUC_UPLOAD, ten))
        except OSError:
            pass

# thư mục chứa đáp án, nằm ở Backend nên trình duyệt không đọc được
THU_MUC_DAP_AN = os.path.join(GOC, '..', 'Dap_an')

# chỉ cho chữ thường, số, gạch ngang, gạch dưới
# để không ai gõ "../" đọc trộm file khác trên máy
TEN_HOP_LE = re.compile(r'^[a-z0-9_-]+$')

def cham(dap_an_dung, tra_loi):
    # đổi cả hai về chữ thường rồi so: 1 -> "1", True -> "true", "Lão Hạc" -> "lão hạc"
    return str(tra_loi).strip().lower() == str(dap_an_dung).strip().lower()

# 1. API Đăng ký tài khoản (Create)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}         # không có dữ liệu thì thành {}, không bị sập
    username = (data.get('username') or '').strip()    # cắt dấu cách thừa hai đầu
    email = (data.get('email') or '').strip().lower()  # đổi hết về chữ thường
    mk = data.get('mk') or ''
    bio = data.get('bio', '')

    # kiểm tra từng thứ một, sai thì báo luôn
    if not username or not email or not mk:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ thông tin!"}), 400
    if len(mk) < 6:
        return jsonify({"success": False, "message": "Mật khẩu cần ít nhất 6 ký tự!"}), 400
    if len(username) > 30:
        return jsonify({"success": False, "message": "Username tối đa 30 ký tự!"}), 400

    try:
        # lưu mật khẩu đã xáo trộn, không lưu chữ thật
        new_id = add_user(username, email, generate_password_hash(mk), bio)
        if new_id:
            return jsonify({
                "success": True,
                "message": "Đăng ký thành công!",
                "user": {"id": new_id, "username": username, "streak": 0, "mon_chuyen": "", "huy_hieu": ""}
            }), 201
        return jsonify({"success": False, "message": "Email này đã được đăng ký!"}), 409
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi: {str(e)}"}), 500

# 2. API Đăng nhập (Read)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    mk = data.get('mk') or ''

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, username, email, bio, mon_chuyen, mk, COALESCE(streak, 0) AS streak, "
        "last_active_date, da_khao_sat, avatar, COALESCE(huy_hieu, '') AS huy_hieu, COALESCE(the_bao_ho, 0) AS the_bao_ho "
        "FROM users WHERE LOWER(email) = LOWER(?)", (email,)
    ).fetchone()

    if not row or not check_password_hash(row['mk'], mk):
        conn.close()
        return jsonify({"success": False, "message": "Sai email hoặc mật khẩu!"}), 401

    # Chỉ đánh dấu đã khảo sát khi người dùng bấm "Chốt 3 nguyện vọng" ở khaosat.js
    can_khao_sat = (row['da_khao_sat'] == 0)
    conn.close()

    streak_dang_nhap = streak_hien_thi(row['streak'] or 0, row['last_active_date'], row['the_bao_ho'] or 0)

    info = {
        "id": row['id'], "username": row['username'], "email": row['email'],
        "bio": row['bio'] or "", "mon_chuyen": row['mon_chuyen'] or "", "streak": streak_dang_nhap,
        "can_khao_sat": can_khao_sat, "avatar": row['avatar'] or "", "huy_hieu": row['huy_hieu'] or ""
    }
    return jsonify({"success": True, "message": "Đăng nhập thành công!", "user": info,
                "token": tao_token(row['id'])}), 200

# ---------------------------------------------------------
# QUÊN MẬT KHẨU & ĐỔI MẬT KHẨU QUA GMAIL / GOOGLE
# ---------------------------------------------------------
SMTP_CONFIG_FILE = os.path.join(GOC, 'smtp_config.json')

def doc_cau_hinh_smtp():
    cfg = {
        "smtp_email": os.environ.get('SMTP_EMAIL') or os.environ.get('SMTP_USER', ''),
        "smtp_password": os.environ.get('SMTP_PASS') or os.environ.get('SMTP_PASSWORD', ''),
        "smtp_server": os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
        "smtp_port": int(os.environ.get('SMTP_PORT', 587))
    }
    if os.path.isfile(SMTP_CONFIG_FILE):
        try:
            with open(SMTP_CONFIG_FILE, 'r', encoding='utf-8') as f:
                file_cfg = json.load(f)
                if file_cfg.get('smtp_email'):
                    cfg['smtp_email'] = file_cfg['smtp_email'].strip()
                if file_cfg.get('smtp_password'):
                    cfg['smtp_password'] = file_cfg['smtp_password'].replace(' ', '').strip()
                if file_cfg.get('smtp_server'):
                    cfg['smtp_server'] = file_cfg['smtp_server'].strip()
                if file_cfg.get('smtp_port'):
                    cfg['smtp_port'] = int(file_cfg['smtp_port'])
        except Exception as e:
            print(f"[SMTP Config Read Warning] {e}")
    return cfg


def luu_cau_hinh_smtp(smtp_email, smtp_password, smtp_server='smtp.gmail.com', smtp_port=587):
    cfg = {
        "smtp_email": (smtp_email or '').strip(),
        "smtp_password": (smtp_password or '').replace(' ', '').strip(),
        "smtp_server": (smtp_server or 'smtp.gmail.com').strip(),
        "smtp_port": int(smtp_port or 587)
    }
    with open(SMTP_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


@app.route('/api/accounts-hint', methods=['GET'])
def get_accounts_hint():
    """
    Bảo mật: Không lộ danh sách email người dùng khác cho client.
    """
    return jsonify({"success": True, "accounts": []}), 200


@app.route('/api/forgot-password/smtp-config', methods=['GET', 'POST'])
def forgot_password_smtp_config():
    if request.method == 'GET':
        cfg = doc_cau_hinh_smtp()
        return jsonify({
            "success": True,
            "configured": bool(cfg.get('smtp_email') and cfg.get('smtp_password')),
            "smtp_email": cfg.get('smtp_email', '')
        }), 200

    data = request.get_json(silent=True) or {}
    smtp_email = (data.get('smtp_email') or '').strip().lower()
    smtp_password = (data.get('smtp_password') or '').replace(' ', '').strip()
    to_email = (data.get('to_email') or '').strip().lower()

    if not smtp_email or not smtp_password:
        return jsonify({
            "success": False,
            "message": "Vui lòng nhập đầy đủ Gmail gửi và Mật khẩu ứng dụng (16 ký tự)!"
        }), 400

    luu_cau_hinh_smtp(smtp_email, smtp_password)

    # Nếu đang có yêu cầu gửi lại OTP tới to_email thì gửi ngay để kiểm tra
    if to_email:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT otp FROM password_resets WHERE LOWER(email) = ? AND used = 0 AND otp != 'VERIFIED' AND otp != 'GOOGLE_VERIFIED' ORDER BY id DESC LIMIT 1",
            (to_email,)
        ).fetchone()
        user = conn.execute("SELECT username FROM users WHERE LOWER(email) = ?", (to_email,)).fetchone()
        conn.close()
        otp = row['otp'] if row else f"{random.randint(100000, 999999)}"
        uname = user['username'] if user else to_email.split('@')[0]
        sent, err = gui_email_otp(to_email, otp, uname)
        if sent:
            return jsonify({
                "success": True,
                "sent": True,
                "message": f"Đã lưu cấu hình SMTP và gửi mã xác thực thành công tới hộp thư {to_email}!"
            }), 200
        else:
            return jsonify({
                "success": False,
                "sent": False,
                "message": f"Không thể đăng nhập Gmail SMTP: {err}. Hãy chắc chắn bạn dùng Mật khẩu ứng dụng 16 ký tự của Google (App Password), không phải mật khẩu đăng nhập thường."
            }), 400

    return jsonify({
        "success": True,
        "message": "Đã lưu cấu hình Gmail SMTP thành công!"
    }), 200


def gui_email_otp(to_email, otp, username=""):
    """
    Gửi mã OTP về email của người dùng qua Gmail SMTP (nếu đã cấu hình) hoặc ghi log console server.
    Trả về (sent: bool, error_msg: str)
    """
    cfg = doc_cau_hinh_smtp()
    smtp_user = cfg.get('smtp_email', '')
    smtp_pass = cfg.get('smtp_password', '')
    smtp_server = cfg.get('smtp_server', 'smtp.gmail.com')
    smtp_port = int(cfg.get('smtp_port', 587))

    sent = False
    error_msg = ""
    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"VnStarL - Mã xác thực đổi mật khẩu: {otp}"
            msg['From'] = f"VnStarL Ôn Thi <{smtp_user}>"
            msg['To'] = to_email

            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e1e7f0; border-radius: 16px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2457d6; margin: 0; font-size: 24px;">Vn<span style="color: #ff9800;">StarL</span></h2>
                    <p style="color: #5b6b82; font-size: 14px; margin-top: 4px;">Nền tảng ôn thi vào lớp 10</p>
                </div>
                <div style="padding: 20px; background: #f4f7fc; border-radius: 12px; text-align: center;">
                    <p style="font-size: 15px; color: #1b2a41; margin-bottom: 12px;">Xin chào <b>{username or to_email}</b>,</p>
                    <p style="font-size: 14px; color: #5b6b82; margin-bottom: 16px;">Bạn đã yêu cầu đặt lại mật khẩu tài khoản VnStarL. Mã xác thực (OTP) của bạn là:</p>
                    <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2457d6; background: #ffffff; padding: 12px 20px; border-radius: 8px; border: 2px dashed #2457d6; display: inline-block; margin-bottom: 16px;">
                        {otp}
                    </div>
                    <p style="font-size: 13px; color: #e07a1f; margin: 0;">Mã này có hiệu lực trong <b>10 phút</b>. Không chia sẻ mã này cho bất kỳ ai.</p>
                </div>
                <p style="font-size: 12px; color: #9aa6b8; text-align: center; margin-top: 24px;">Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>
            </div>
            """
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))

            with smtplib.SMTP(smtp_server, smtp_port, timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, to_email, msg.as_string())
            sent = True
            print(f"[SMTP] Đã gửi mã OTP {otp} tới {to_email}")
        except Exception as e:
            error_msg = str(e)
            print(f"[SMTP Lỗi] Không gửi được mail tới {to_email}: {e}")
    else:
        error_msg = "Chưa nhập Mật khẩu ứng dụng Gmail (App Password 16 ký tự)"

    # Luôn ghi ra console server để tiện theo dõi
    print(f"\n========================================================")
    print(f" [VnStarL - KHÔI PHỤC MẬT KHẨU]")
    print(f" -> Email người nhận : {to_email}")
    print(f" -> Mã OTP xác thực  : {otp}")
    print(f" -> Trạng thái gửi mail : {'ĐÃ GỬI QUA GMAIL SMTP' if sent else 'Chưa gửi SMTP (' + error_msg + ')'}")
    print(f"========================================================\n")

    return sent, error_msg


@app.route('/api/forgot-password/send-otp', methods=['POST'])
def forgot_password_send_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({"success": False, "message": "Vui lòng nhập địa chỉ Gmail!"}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    user = conn.execute("SELECT id, username, email FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
    if not user:
        # Tự động khởi tạo tài khoản cho Gmail nếu chưa có để người dùng trên máy đổi mật khẩu mượt mà
        ten_mac_dinh = email.split('@')[0]
        try:
            add_user(ten_mac_dinh[:30], email, generate_password_hash("123456"), "")
            user = conn.execute("SELECT id, username, email FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        except Exception:
            pass
        if not user:
            conn.close()
            return jsonify({"success": False, "message": "Địa chỉ Gmail này chưa được đăng ký tài khoản trên hệ thống!"}), 404

    # Sinh mã OTP 6 chữ số
    otp = f"{random.randint(100000, 999999)}"
    token = secrets.token_hex(24)
    expires_at = (datetime.now() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

    # Lưu mã vào DB
    conn.execute(
        "INSERT INTO password_resets (email, otp, token, expires_at, used) VALUES (?, ?, ?, ?, 0)",
        (email, otp, token, expires_at)
    )
    conn.commit()
    conn.close()

    # Thử gửi qua SMTP nếu có cấu hình
    sent, err_msg = gui_email_otp(email, otp, user['username'])
    cfg = doc_cau_hinh_smtp()

    res_data = {
        "success": True,
        "message": f"Đã gửi email chứa mã OTP về hộp thư Gmail: {email}!" if sent else f"Mã xác thực đã được gửi tới console quản trị hệ thống!",
        "email": email,
        "sent_via_smtp": sent,
        "smtp_email": cfg.get("smtp_email", ""),
        "smtp_error": err_msg if not sent else "",
        "demo_otp": otp
    }

    return jsonify(res_data), 200


@app.route('/api/forgot-password/verify-otp', methods=['POST'])
def forgot_password_verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    otp = (data.get('otp') or '').strip()

    if not email or not otp:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ email và mã OTP!"}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute('''
        SELECT id, token, expires_at, used FROM password_resets 
        WHERE LOWER(email) = ? AND otp = ? 
        ORDER BY id DESC LIMIT 1
    ''', (email, otp)).fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Mã xác thực OTP không chính xác!"}), 400

    if row['used']:
        conn.close()
        return jsonify({"success": False, "message": "Mã xác thực OTP này đã được sử dụng rồi!"}), 400

    try:
        exp_time = datetime.strptime(row['expires_at'], "%Y-%m-%d %H:%M:%S")
        if datetime.now() > exp_time:
            conn.close()
            return jsonify({"success": False, "message": "Mã xác thực đã hết hạn (10 phút). Vui lòng yêu cầu mã mới!"}), 400
    except Exception:
        pass

    # Đánh dấu mã OTP đã dùng
    conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row['id'],))

    # Cấp reset_token có hiệu lực 15 phút cho bước nhập mật khẩu mới
    reset_token = secrets.token_hex(24)
    expires_at = (datetime.now() + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "INSERT INTO password_resets (email, otp, token, expires_at, used) VALUES (?, 'VERIFIED', ?, ?, 0)",
        (email, reset_token, expires_at)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Xác thực OTP thành công! Hãy đặt mật khẩu mới.",
        "reset_token": reset_token,
        "email": email
    }), 200


@app.route('/api/forgot-password/google-verify', methods=['POST'])
def forgot_password_google_verify():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    credential = data.get('credential')

    # Nếu có Google ID token credential (JWT)
    if credential and isinstance(credential, str):
        try:
            parts = credential.split('.')
            if len(parts) >= 2:
                payload_b64 = parts[1]
                rem = len(payload_b64) % 4
                if rem > 0:
                    payload_b64 += '=' * (4 - rem)
                payload_json = base64.urlsafe_b64decode(payload_b64.encode('utf-8')).decode('utf-8')
                payload = json.loads(payload_json)
                google_email = (payload.get('email') or '').strip().lower()
                if google_email:
                    email = google_email
        except Exception as e:
            print(f"[Google Credential Decode Warning] {e}")

    if not email:
        return jsonify({"success": False, "message": "Không tìm thấy thông tin email từ Google!"}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    user = conn.execute("SELECT id, username, email FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Tài khoản Gmail ({email}) chưa được đăng ký trên VnStarL! Vui lòng đăng ký tài khoản trước nhé."
        }), 404

    # Cấp reset_token
    reset_token = secrets.token_hex(24)
    expires_at = (datetime.now() + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "INSERT INTO password_resets (email, otp, token, expires_at, used) VALUES (?, 'GOOGLE_VERIFIED', ?, ?, 0)",
        (email, reset_token, expires_at)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Đã xác thực tài khoản Google ({email}) thành công! Bạn có thể đặt mật khẩu mới ngay.",
        "email": email,
        "username": user['username'],
        "reset_token": reset_token
    }), 200


@app.route('/api/forgot-password/reset-password', methods=['POST'])
def forgot_password_reset():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    reset_token = (data.get('reset_token') or '').strip()
    new_mk = data.get('new_mk') or ''

    if not email or not reset_token or not new_mk:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ thông tin!"}), 400

    if len(new_mk) < 6:
        return jsonify({"success": False, "message": "Mật khẩu mới cần ít nhất 6 ký tự!"}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Kiểm tra token
    row = conn.execute('''
        SELECT id, expires_at, used FROM password_resets 
        WHERE LOWER(email) = ? AND token = ? AND used = 0
        ORDER BY id DESC LIMIT 1
    ''', (email, reset_token)).fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Phiên đặt lại mật khẩu không hợp lệ hoặc đã sử dụng!"}), 400

    try:
        exp_time = datetime.strptime(row['expires_at'], "%Y-%m-%d %H:%M:%S")
        if datetime.now() > exp_time:
            conn.close()
            return jsonify({"success": False, "message": "Phiên đổi mật khẩu đã hết hạn. Vui lòng thử lại!"}), 400
    except Exception:
        pass

    # Cập nhật mật khẩu mới cho user
    hashed_mk = generate_password_hash(new_mk)
    conn.execute("UPDATE users SET mk = ? WHERE LOWER(email) = ?", (hashed_mk, email))
    conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row['id'],))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới của bạn."
    }), 200

# 3. API Lấy danh sách tất cả user (Read)
#@app.route('/api/users', methods=['GET'])
#def list_users():
#    users = get_all_users()
#    return jsonify({"success": True, "data": users}), 200

# 4. API Cập nhật thông tin user (Update)
#@app.route('/api/users/<int:user_id>', methods=['PUT'])
#def update_profile(user_id):
#    data = request.get_json()
#    new_username = data.get('username')
#    new_bio = data.get('bio', '')

#    update_user(user_id, new_username, new_bio)
#    return jsonify({"success": True, "message": "Cập nhật thành công!"}), 200

# 5. API Xóa user (Delete)
#@app.route('/api/users/<int:user_id>', methods=['DELETE'])
#def remove_user(user_id):
#    delete_user(user_id)
#    return jsonify({"success": True, "message": "Đã xóa tài khoản!"}), 200

# 6. API nộp bài: server tự chấm, tự cộng điểm
@app.route('/api/submit', methods=['POST'])
def submit():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')                         # có thể là None nếu chưa đăng nhập
    subject = str(data.get('subject', '')).replace('-', '_')   # ngu-van -> ngu_van
    chapter = str(data.get('chapter', ''))
    article = str(data.get('article', ''))
    bai_id = str(data.get('bai_id', ''))
    answers = data.get('answers')

    # kiểm tra dữ liệu gửi lên có hợp lệ không
    ok = (TEN_HOP_LE.match(subject) and TEN_HOP_LE.match(chapter)
          and TEN_HOP_LE.match(article) and re.match(r'^[0-9.]+$', bai_id)
          and isinstance(answers, dict))
    if not ok:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    # mở file đáp án của bài học
    duong_dan = os.path.join(THU_MUC_DAP_AN, subject, chapter, article + '.json')
    if not os.path.isfile(duong_dan):
        return jsonify({"success": False, "message": "Không tìm thấy đáp án bài này!"}), 404
    # file trống hoặc viết sai thì báo nhẹ nhàng, không để server sập
    try:
        with open(duong_dan, encoding='utf-8') as f:
            dap_an_bai = json.load(f).get(bai_id)
    except (ValueError, OSError):
        return jsonify({"success": False, "message": "Bài này chưa có đáp án!"}), 404
    if not dap_an_bai:
        return jsonify({"success": False, "message": "Không tìm thấy đáp án bài này!"}), 404

    # chấm từng câu
    ket_qua = {}
    diem_dat = 0
    diem_toi_da = 0
    for cau_id, info in dap_an_bai.items():
        diem = info.get('diem', 10)
        diem_toi_da += diem
        tra_loi = answers.get(cau_id)

        if tra_loi is None or str(tra_loi).strip() == '':
            # bỏ trống thì không tính điểm
            ket_qua[cau_id] = {"dung": None, "diem": diem}
            continue
                # ---- Câu tự luận: chấm từ khóa, có điểm từng phần ----
        if info.get('loai') == 'tu-luan':
            got, chi_tiet = cham_tu_luan(info, tra_loi)
            diem_dat += got
            ket_qua[cau_id] = {"dung": got >= diem / 2, "diem": diem, "diem_dat": got,
                               "tu_luan": chi_tiet, "loi_giai": info.get('loi_giai', '')}
            continue
        dung = cham(info['dap_an_dung'], tra_loi)
        if dung:
            diem_dat += diem
        # lời giải chỉ gửi về SAU khi đã nộp
        ket_qua[cau_id] = {"dung": dung, "diem": diem, "loi_giai": info.get('loi_giai', '')}
    diem_dat, diem_toi_da = round(diem_dat, 2), round(diem_toi_da, 2)

    # lưu điểm (chỉ khi đã đăng nhập và có điểm)
    da_luu = False
    streak = None
    diem_cong = 0   # điểm thật sự cộng vào tài khoản (đã nhân thưởng streak)
    he_so = 1.0
    pct = int(diem_dat * 100 // diem_toi_da) if diem_toi_da else 0   # % điểm lần này (làm tròn xuống)
    best_pct = None
    best_cu = None
    if user_id and diem_dat > 0:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        co_user = cur.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        if co_user:
            # INSERT OR IGNORE: bài này làm rồi thì không thêm được nữa -> rowcount = 0
            bai_key = f"{subject}/{chapter}/{article}/{bai_id}"
            # MỚI: đọc điểm cũ TRƯỚC khi ghi đè
            row_cu = cur.execute("SELECT COALESCE(best_pct, 0) FROM da_lam WHERE user_id = ? AND bai_key = ?",
                                 (user_id, bai_key)).fetchone()
            best_cu = row_cu[0] if row_cu else None
            cur.execute("INSERT OR IGNORE INTO da_lam (user_id, bai_key) VALUES (?, ?)",
                        (user_id, bai_key))
            da_luu = (cur.rowcount == 1)
            best_pct = ghi_diem_cao_nhat(cur, user_id, bai_key, pct)
        conn.commit()
        conn.close()

        if co_user:
            update_streak(user_id)   # cập nhật chuỗi ngày TRƯỚC để biết streak hôm nay
            conn = sqlite3.connect(DB_PATH)
            row_st = conn.execute("SELECT COALESCE(streak, 0) FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.close()
            streak = (row_st[0] if row_st else 0) or 0

            # Chuỗi streak: mỗi ngày +0,1% (0.001), tối đa +5% (0.05); mất chuỗi không bảo hộ sẽ tính lại từ 0,1%
            he_so = round(1 + min(streak * 0.001, 0.05) + he_so_x15(user_id), 4)
            # Làm lần đầu: 100% điểm; làm lại lần sau: 50% điểm
            he_so_lan_lam = 1.0 if da_luu else 0.5
            # V31: Luyện tập đã thưởng dần từng câu -> thưởng tổng kết bài nhân 0.45 để cân bằng ~100-110 điểm/bài
            he_so_thuong_cau = 0.45 if bool(data.get('da_thuong_theo_cau', False)) else 1.0
            diem_cong = round(diem_dat * he_so_lan_lam * he_so * he_so_thuong_cau)
            if diem_cong > 0:
                update_user_score(user_id, diem_cong)
        # ---- Sổ lỗi sai + nhiệm vụ hằng ngày ----
    so_loi_ghi = []
    huy_hieu_moi = []
    if user_id:
        bai_key = f"{subject}/{chapter}/{article}/{bai_id}"
        so_loi_ghi = ghi_ket_qua_nop_bai(user_id, bai_key, {k: v for k, v in ket_qua.items() if "tu_luan" not in v})
        ghi_su_kien_nop_bai(user_id, subject, bai_key, ket_qua, pct, best_cu)
        ghi_hoat_dong(user_id, bai_key, ket_qua, pct)   # log có giờ cho Khoa bảng
        huy_hieu_moi = cap_nhat_huy_hieu(user_id)
    return jsonify({"success": True, "diem_dat": diem_dat, "diem_toi_da": diem_toi_da, "ket_qua": ket_qua, "da_luu": da_luu, "streak": streak, "diem_cong": diem_cong, "he_so": he_so, "pct": pct, "best_pct": best_pct, "so_loi_ghi": so_loi_ghi, "huy_hieu_moi": huy_hieu_moi}), 200

# 7. API bảng xếp hạng: /api/ranking?bang=toan&ky=thang
@app.route('/api/ranking', methods=['GET'])
def ranking():
    bang = request.args.get('bang', 'khong-chuyen')
    ky = request.args.get('ky', 'tong')
    user_id = request.args.get('user_id', type=int)
    if bang not in BANG_XEP_HANG or ky not in KY_XEP_HANG:
        return jsonify({"success": False, "message": "Bảng xếp hạng không hợp lệ!"}), 400

    ds = get_ranking(bang, ky)   # top 20
    me = None
    if user_id and not any(u['id'] == user_id for u in ds):   # chỉ gửi khi nằm ngoài top 20
        me = get_my_rank(user_id, bang, ky)
    return jsonify({"success": True, "bang": bang, "ky": ky, "data": ds, "me": me}), 200

# 7b. Danh sách bảng + kỳ để giao diện tự vẽ tab
@app.route('/api/ranking/cau-hinh', methods=['GET'])
def ranking_cau_hinh():
    return jsonify({
        "success": True,
        "bang": [{"id": k, "ten": v[0], "mon": v[1]} for k, v in BANG_XEP_HANG.items()],
        "ky": [{"id": k, "ten": v} for k, v in KY_XEP_HANG.items()],
        "thang": thang_hien_tai(),
    }), 200

# 8. API lưu môn chuyên
@app.route('/api/users/<int:user_id>/mon-chuyen', methods=['PUT'])
def save_mon_chuyen(user_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    mon = data.get('mon_chuyen', '')
    hoan_thanh = bool(data.get('hoan_thanh_khao_sat', False))

    if not isinstance(mon, str) or mon not in MON_CHUYEN_HOP_LE:
        return jsonify({"success": False, "message": "Môn chuyên không hợp lệ!"}), 400

    update_mon_chuyen(user_id, mon, hoan_thanh_khao_sat=hoan_thanh)
    return jsonify({"success": True, "message": "Đã lưu môn chuyên!"}), 200

# 9. API xem hồ sơ
@app.route('/api/users/<int:user_id>', methods=['GET'])
def profile(user_id):
    u = get_user(user_id)
    if not u:
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    return jsonify({"success": True, "data": u}), 200

# 10. API sửa tên và giới thiệu
@app.route('/api/users/<int:user_id>', methods=['PUT'])
def edit_profile(user_id):
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    bio = (data.get('bio') or '').strip()

    # lấy người dùng trước để biết họ có bao nhiêu điểm
    u = get_user(user_id)
    if not u:
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

    # chưa đủ điểm thì từ chối, 403 = không được phép
    if (u.get('score') or 0) < DIEM_MO_KHOA_SUA:
        return jsonify({"success": False,
                        "message": f"Bạn phải đủ {DIEM_MO_KHOA_SUA} điểm mới mở khóa tính năng này!"}), 403

    if not username:
        return jsonify({"success": False, "message": "Tên không được để trống!"}), 400
    if len(username) > 30:
        return jsonify({"success": False, "message": "Tên tối đa 30 ký tự!"}), 400
    if len(bio) > 150:
        return jsonify({"success": False, "message": "Giới thiệu tối đa 150 ký tự!"}), 400

    update_user(user_id, username, bio)
    return jsonify({"success": True, "username": username, "bio": bio}), 200

# Lấy danh sách cuộc thi, kèm trạng thái
@app.route('/api/contests', methods=['GET'])
def list_contests():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM contests ORDER BY bat_dau DESC").fetchall()
    conn.close()

    bay_gio = datetime.now().strftime("%Y-%m-%d %H:%M")
    ds = []
    for r in rows:
        c = dict(r)
        # so sánh chuỗi ngày giờ là so được vì cùng định dạng
        if bay_gio < c['bat_dau']:
            c['trang_thai'] = "sap-dien-ra"
        elif bay_gio <= c['ket_thuc']:
            c['trang_thai'] = "dang-dien-ra"
        else:
            c['trang_thai'] = "da-ket-thuc"
        ds.append(c)
    return jsonify({"success": True, "data": ds}), 200


# Nộp bài cuộc thi: server tự kiểm tra giờ và chấm
@app.route('/api/contests/<int:cid>/submit', methods=['POST'])
def contest_submit(cid):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    raw_user_id = data.get('user_id')
    if not raw_user_id:
        return jsonify({"success": False, "message": "Hãy đăng nhập để thi!"}), 401
    if isinstance(raw_user_id, bool):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400
    try:
        user_id = int(raw_user_id)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ!"}), 400

    answers = data.get('answers')
    if answers is None:
        answers = {}
    elif not isinstance(answers, dict):
        return jsonify({"success": False, "message": "Dữ liệu bài làm không hợp lệ!"}), 400

    conn = sqlite3.connect(DB_PATH, timeout=10)
    try:
        cs = conn.execute("SELECT bat_dau, ket_thuc FROM contests WHERE id = ?", (cid,)).fetchone()
        if not cs:
            return jsonify({"success": False, "message": "Không có cuộc thi này!"}), 404

        # Kiểm tra giờ ở SERVER (không tin trình duyệt, vì học sinh có thể sửa giờ máy)
        bay_gio = datetime.now().strftime("%Y-%m-%d %H:%M")
        if not (cs[0] <= bay_gio <= cs[1]):
            return jsonify({"success": False, "message": "Cuộc thi không trong giờ làm bài!"}), 403

        # Đọc đáp án rồi chấm bằng hàm cham() / cham_tu_luan() có sẵn
        duong_dan = os.path.join(THU_MUC_DAP_AN, 'contest', f'{cid}.json')
        if not os.path.isfile(duong_dan):
            return jsonify({"success": False, "message": "Không tìm thấy đáp án cuộc thi này!"}), 404
        try:
            with open(duong_dan, encoding='utf-8') as f:
                dap_an = json.load(f)
        except (ValueError, OSError):
            return jsonify({"success": False, "message": "Cuộc thi này chưa có đáp án!"}), 404
        if not isinstance(dap_an, dict) or not dap_an:
            return jsonify({"success": False, "message": "Không tìm thấy đáp án cuộc thi này!"}), 404

        diem = 0
        for cau_id, info in dap_an.items():
            if not isinstance(info, dict):
                continue
            tra_loi = answers.get(cau_id)
            if tra_loi is None or str(tra_loi).strip() == '':
                continue
            if info.get('loai') == 'tu-luan' or ('dap_an_dung' not in info and ('y' in info or 'nhom_tu_khoa' in info)):
                got, _ = cham_tu_luan(info, tra_loi)
                diem += got
                continue
            if 'dap_an_dung' in info and info['dap_an_dung'] is not None:
                if cham(info['dap_an_dung'], tra_loi):
                    diem_cau = info.get('diem', 10)
                    diem += diem_cau if isinstance(diem_cau, (int, float)) else 10
        diem = int(diem) if diem == int(diem) else round(diem, 2)

        # INSERT OR IGNORE: nộp lần 2 sẽ bị bỏ qua (rowcount = 0)
        cur = conn.execute("INSERT OR IGNORE INTO contest_ket_qua VALUES (?, ?, ?)",
                           (user_id, cid, diem))
        da_luu = (cur.rowcount == 1)
        conn.commit()
    finally:
        conn.close()

    if not da_luu:
        return jsonify({"success": False, "message": "Bạn đã nộp bài này rồi!"}), 409
    return jsonify({"success": True, "diem": diem}), 200


# Bảng xếp hạng riêng của 1 cuộc thi
@app.route('/api/contests/<int:cid>/ranking', methods=['GET'])
def contest_ranking(cid):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('''
        SELECT u.id AS user_id, u.username, u.avatar, COALESCE(u.huy_hieu, '') AS huy_hieu, k.diem FROM contest_ket_qua k
        JOIN users u ON u.id = k.user_id
        WHERE k.contest_id = ? ORDER BY k.diem DESC LIMIT 50
    ''', (cid,)).fetchall()
    conn.close()
    return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200

# 11. API lấy danh sách avatar admin đã thêm
@app.route('/api/avatars', methods=['GET'])
def list_avatars():
    return jsonify({"success": True, "data": ds_avatar()}), 200

# 12. API chọn avatar có sẵn (chỉ nhận tên file có trong thư mục avatar, hoặc '' để về mặc định)
@app.route('/api/users/<int:user_id>/avatar', methods=['PUT'])
def save_avatar(user_id):
    data = request.get_json(silent=True) or {}
    avatar = (data.get('avatar') or '').strip()

    u = get_user(user_id)
    if not u:
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    if avatar != '' and avatar not in ds_avatar():
        return jsonify({"success": False, "message": "Avatar không tồn tại!"}), 400

    update_avatar(user_id, avatar)
    xoa_anh_upload(u.get('avatar'))   # đang dùng ảnh tự tải lên mà chuyển sang ảnh khác thì dọn file cũ
    return jsonify({"success": True, "avatar": avatar}), 200

# 13. API người dùng tự tải ảnh avatar lên (cần đủ điểm)
@app.route('/api/users/<int:user_id>/avatar-upload', methods=['POST'])
def upload_avatar(user_id):
    u = get_user(user_id)
    if not u:
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

    # chưa đủ điểm thì từ chối (kiểm tra ở server, không tin giao diện)
    if (u.get('score') or 0) < DIEM_MO_KHOA_AVATAR:
        return jsonify({"success": False,
                        "message": f"Bạn phải đủ {DIEM_MO_KHOA_AVATAR} điểm mới tải được avatar riêng!"}), 403

    f = request.files.get('file')
    if not f:
        return jsonify({"success": False, "message": "Chưa chọn ảnh!"}), 400

    try:
        img = Image.open(f.stream)
        # kiểm tra ảnh thật bằng nội dung, không tin đuôi file hay Content-Type
        if img.format not in ('JPEG', 'PNG', 'WEBP', 'GIF'):
            raise ValueError("định dạng không hỗ trợ")
        img.load()                              # đọc hết ảnh: file hỏng sẽ báo lỗi ở đây
        img = ImageOps.exif_transpose(img)      # xoay đúng chiều nếu ảnh chụp điện thoại
        img = ImageOps.fit(img.convert('RGBA'), (256, 256), Image.LANCZOS)  # cắt vuông giữa ảnh + thu về 256x256
    except Exception:
        return jsonify({"success": False, "message": "File không phải ảnh hợp lệ (chỉ nhận JPG, PNG, WEBP, GIF)!"}), 400

    # tên ngẫu nhiên: không ai đoán được, cũng không bị trùng
    ten_moi = f"up_{uuid.uuid4().hex}.webp"
    img.save(os.path.join(THU_MUC_UPLOAD, ten_moi), 'WEBP', quality=85)

    update_avatar(user_id, ten_moi)
    xoa_anh_upload(u.get('avatar'))   # xóa ảnh cũ (nếu ảnh cũ cũng là ảnh tự tải lên)
    return jsonify({"success": True, "avatar": ten_moi}), 200

# 14. Phục vụ ảnh người dùng đã tải lên (chỉ nhận đúng dạng tên up_<hex>.webp)
@app.route('/uploads/avatars/<ten>', methods=['GET'])
def xem_avatar_upload(ten):
    if not TEN_UPLOAD.match(ten):
        abort(404)
    # tên ngẫu nhiên, mỗi lần đổi ảnh là tên mới -> cho trình duyệt nhớ lâu
    return send_from_directory(THU_MUC_UPLOAD, ten, max_age=31536000)

# 15. NÚT BUFF ĐIỂM (ĐÃ VÔ HIỆU HÓA HOÀN TOÀN ĐỂ BẢO MẬT)
@app.route('/api/dev/buff-diem', methods=['POST'])
def buff_diem():
    return jsonify({"success": False, "message": "Tính năng này đã bị vô hiệu hóa vì lý do bảo mật!"}), 403

if __name__ == '__main__':
    # Chế độ debug chạy 2 tiến trình, chỉ tiến trình con mới nạp model ở luồng nền để server mở cổng 5000 ngay lập tức
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        import threading
        threading.Thread(target=nap_san, daemon=True).start()
    app.run(debug=True)