from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import os, re, json
from datetime import datetime
from db_ops import (
    DB_PATH,
    add_user, get_all_users, update_user, delete_user,
    update_streak, update_user_score, get_ranking, update_mon_chuyen,
    get_user, update_avatar
)

DIEM_MO_KHOA_SUA = 500

app = Flask(__name__)
CORS(app)  # Cho phép Frontend kết nối tới Backend
# Tự thêm cột da_khao_sat nếu DB chưa có (tài khoản cũ coi như đã khảo sát)
def dam_bao_cot():
    conn = sqlite3.connect(DB_PATH)
    cac_cot = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
    if 'da_khao_sat' not in cac_cot:
        conn.execute("ALTER TABLE users ADD COLUMN da_khao_sat INTEGER DEFAULT 0")
        conn.execute("UPDATE users SET da_khao_sat = 1")
    if 'avatar' not in cac_cot:
        conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    conn.commit()
    conn.close()

dam_bao_cot()

# thư mục avatar do admin bỏ ảnh vào (nằm trong Frontend để trình duyệt hiện được)
THU_MUC_AVATAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'Frontend', 'img', 'avatar')
DUOI_AVATAR = ('.webp', '.png', '.jpg', '.jpeg', '.gif')

def ds_avatar():
    # đọc thẳng thư mục: admin bỏ ảnh vào là có ngay, không cần sửa file nào
    if not os.path.isdir(THU_MUC_AVATAR):
        return []
    return sorted(f for f in os.listdir(THU_MUC_AVATAR) if f.lower().endswith(DUOI_AVATAR))

# thư mục chứa đáp án, nằm ở Backend nên trình duyệt không đọc được
THU_MUC_DAP_AN = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Dap_an')

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
                "user": {"id": new_id, "username": username, "streak": 0, "mon_chuyen": ""}
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
        "SELECT id, username, email, bio, mon_chuyen, mk, streak, last_active_date, da_khao_sat, avatar "
        "FROM users WHERE email = ?", (email,)
    ).fetchone()

    if not row or not check_password_hash(row['mk'], mk):
        conn.close()
        return jsonify({"success": False, "message": "Sai email hoặc mật khẩu!"}), 401

    # chưa khảo sát lần nào thì đánh dấu luôn: các lần đăng nhập sau không hiện khảo sát nữa
    can_khao_sat = (row['da_khao_sat'] == 0)
    if can_khao_sat:
        conn.execute("UPDATE users SET da_khao_sat = 1 WHERE id = ?", (row['id'],))
        conn.commit()
    conn.close()

    hom_nay = str(date.today())
    hom_qua = str(date.today() - timedelta(days=1))
    streak_hien_thi = row['streak'] if row['last_active_date'] in (hom_nay, hom_qua) else 0

    info = {
        "id": row['id'], "username": row['username'], "email": row['email'],
        "bio": row['bio'], "mon_chuyen": row['mon_chuyen'], "streak": streak_hien_thi,
        "can_khao_sat": can_khao_sat, "avatar": row['avatar'] or ""
    }
    return jsonify({"success": True, "message": "Đăng nhập thành công!", "user": info}), 200\
    
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

# 6. API cộng điểm sau khi nộp bài
# API nộp bài: server tự chấm, tự cộng điểm
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

        dung = cham(info['dap_an_dung'], tra_loi)
        if dung:
            diem_dat += diem
        # lời giải chỉ gửi về SAU khi đã nộp
        ket_qua[cau_id] = {"dung": dung, "diem": diem, "loi_giai": info.get('loi_giai', '')}

    # lưu điểm (chỉ khi đã đăng nhập và có điểm)
    da_luu = False
    streak = None
    diem_cong = 0   # điểm thật sự cộng vào tài khoản (đã nhân thưởng streak)
    he_so = 1.0
    if user_id and diem_dat > 0:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        co_user = cur.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        if co_user:
            # INSERT OR IGNORE: bài này làm rồi thì không thêm được nữa -> rowcount = 0
            bai_key = f"{subject}/{chapter}/{article}/{bai_id}"
            cur.execute("INSERT OR IGNORE INTO da_lam (user_id, bai_key) VALUES (?, ?)",
                        (user_id, bai_key))
            da_luu = (cur.rowcount == 1)
        conn.commit()
        conn.close()

        if co_user:
            update_streak(user_id)   # cập nhật chuỗi ngày TRƯỚC để biết streak hôm nay
            conn = sqlite3.connect(DB_PATH)
            streak = conn.execute("SELECT streak FROM users WHERE id = ?", (user_id,)).fetchone()[0]
            conn.close()

            if da_luu:   # lần đầu làm bài này mới được cộng điểm
                # cứ 3 ngày liên tiếp thưởng thêm 10%, tối đa 50%
                he_so = 1 + min(streak // 3, 5) * 0.1
                diem_cong = round(diem_dat * he_so)
                update_user_score(user_id, diem_cong)

    return jsonify({"success": True, "diem_dat": diem_dat, "diem_toi_da": diem_toi_da,"ket_qua": ket_qua, "da_luu": da_luu, "streak": streak,"diem_cong": diem_cong, "he_so": he_so}), 200

# 7. API bảng xếp hạng
@app.route('/api/ranking', methods=['GET'])
def ranking():
    return jsonify({"success": True, "data": get_ranking()}), 200

# 8. API lưu môn chuyên
@app.route('/api/users/<int:user_id>/mon-chuyen', methods=['PUT'])
def save_mon_chuyen(user_id):
    data = request.get_json()
    mon = data.get('mon_chuyen', '')

    if mon not in ('', 'toan', 'ly', 'hoa'):
        return jsonify({"success": False, "message": "Môn chuyên không hợp lệ!"}), 400

    update_mon_chuyen(user_id, mon)
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
    if u['score'] < DIEM_MO_KHOA_SUA:
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
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    answers = data.get('answers') or {}
    if not user_id:
        return jsonify({"success": False, "message": "Hãy đăng nhập để thi!"}), 401

    conn = sqlite3.connect(DB_PATH)
    cs = conn.execute("SELECT bat_dau, ket_thuc FROM contests WHERE id = ?", (cid,)).fetchone()
    if not cs:
        conn.close()
        return jsonify({"success": False, "message": "Không có cuộc thi này!"}), 404

    # Kiểm tra giờ ở SERVER (không tin trình duyệt, vì học sinh có thể sửa giờ máy)
    bay_gio = datetime.now().strftime("%Y-%m-%d %H:%M")
    if not (cs[0] <= bay_gio <= cs[1]):
        conn.close()
        return jsonify({"success": False, "message": "Cuộc thi không trong giờ làm bài!"}), 403

    # Đọc đáp án rồi chấm bằng hàm cham() có sẵn
    duong_dan = os.path.join(THU_MUC_DAP_AN, 'contest', f'{cid}.json')
    with open(duong_dan, encoding='utf-8') as f:
        dap_an = json.load(f)

    diem = 0
    for cau_id, info in dap_an.items():
        if cham(info['dap_an_dung'], answers.get(cau_id, '')):
            diem += info.get('diem', 10)

    # INSERT OR IGNORE: nộp lần 2 sẽ bị bỏ qua (rowcount = 0)
    cur = conn.execute("INSERT OR IGNORE INTO contest_ket_qua VALUES (?, ?, ?)",
                       (user_id, cid, diem))
    da_luu = (cur.rowcount == 1)
    conn.commit()
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
        SELECT u.username, u.avatar, k.diem FROM contest_ket_qua k
        JOIN users u ON u.id = k.user_id
        WHERE k.contest_id = ? ORDER BY k.diem DESC LIMIT 50
    ''', (cid,)).fetchall()
    conn.close()
    return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
# 11. API lấy danh sách avatar admin đã thêm
@app.route('/api/avatars', methods=['GET'])
def list_avatars():
    return jsonify({"success": True, "data": ds_avatar()}), 200

# 12. API chọn avatar (chỉ nhận tên file có trong thư mục avatar, hoặc '' để về mặc định)
@app.route('/api/users/<int:user_id>/avatar', methods=['PUT'])
def save_avatar(user_id):
    data = request.get_json(silent=True) or {}
    avatar = (data.get('avatar') or '').strip()

    if not get_user(user_id):
        return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404
    if avatar != '' and avatar not in ds_avatar():
        return jsonify({"success": False, "message": "Avatar không tồn tại!"}), 400

    update_avatar(user_id, avatar)
    return jsonify({"success": True, "avatar": avatar}), 200

if __name__ == '__main__':
    app.run(debug=True)