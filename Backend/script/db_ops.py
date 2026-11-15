import os
import sqlite3
from datetime import date, timedelta

# __file__ là vị trí file db_ops.py, từ đó đi lùi ra rồi vào thư mục Database
# nên chạy lệnh ở thư mục nào cũng tìm đúng file edumate.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Database', 'edumate.db')
# ====================== CẤU HÌNH BẢNG XẾP HẠNG ======================
# Thêm môn chuyên mới: thêm 1 dòng vào BANG_XEP_HANG (id -> (tên hiển thị, giá trị mon_chuyen))
BANG_XEP_HANG = {
    "khong-chuyen": ("Không chuyên", ""),
    "ly":           ("Chuyên Vật Lý", "ly"),
    "toan":         ("Chuyên Toán", "toan"),
    "su":           ("Chuyên Lịch Sử", "su"),
    "dia":          ("Chuyên Địa Lí", "dia"),
}
# Thêm kỳ xếp hạng mới (vd "tuan") thì thêm ở đây và xử lý trong get_ranking
KY_XEP_HANG = {"tong": "Tổng", "thang": "Tháng này"}

# Các giá trị mon_chuyen hợp lệ (giữ cả môn cũ để không lỗi hồ sơ cũ nếu có)
MON_CHUYEN_HOP_LE = {mon for _, mon in BANG_XEP_HANG.values()} | {"hoa", "sinh", "van", "anh"}

def thang_hien_tai():
    return date.today().strftime("%Y-%m")   # vd "2026-11"

def dam_bao_bang_thang():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS diem_thang (
            user_id INTEGER,
            thang TEXT,
            diem INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, thang)
        )''')
    cot_users = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
    if cot_users and 'huy_hieu' not in cot_users:
        conn.execute("ALTER TABLE users ADD COLUMN huy_hieu TEXT DEFAULT ''")
    conn.commit()
    conn.close()

def cong_diem_thang(conn, user_id, diem):
    """Cộng điểm vào bảng tháng (dùng chung connection, người gọi tự commit)."""
    if diem <= 0:
        return
    conn.execute(
        "INSERT INTO diem_thang (user_id, thang, diem) VALUES (?, ?, ?) "
        "ON CONFLICT(user_id, thang) DO UPDATE SET diem = COALESCE(diem_thang.diem, 0) + excluded.diem",
        (user_id, thang_hien_tai(), diem))

dam_bao_bang_thang()

# 1. Thêm tài khoản mới (Create)
def add_user(username, email, mk, bio=""):
    email = (email or '').strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        if cursor.execute("SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)", (email,)).fetchone():
            return None
        cursor.execute('''
            INSERT INTO users (username, email, mk, bio, score, streak, dd_tong, the_bao_ho, luot_quay)
            VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0)
        ''', (username, email, mk, bio))
        conn.commit()
        return cursor.lastrowid   # trả về id của user vừa tạo (thay vì True)
    except sqlite3.IntegrityError:
        return None               # email đã có người dùng: trả về None
    finally:
        conn.close()

# 2. Xem tất cả tài khoản (Read)
def get_all_users():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Giúp trả về dữ liệu dạng key-value dễ đọc
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, bio FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

# 3. Sửa thông tin tài khoản theo ID (Update)
def update_user(user_id, new_username, new_bio):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users 
        SET username = ?, bio = ? 
        WHERE id = ?
        ''', (new_username, new_bio, user_id))
    conn.commit()
    conn.close()
    print(f"Đã cập nhật thông tin cho user ID {user_id}!")

# 4. Xóa tài khoản theo ID (Delete)
def delete_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    print(f"Đã xóa user ID {user_id}!")

# 5. Sửa điểm người dùng theo ID
def update_user_score(user_id, points):
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        if not cursor.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
            return
        cursor.execute('UPDATE users SET score = COALESCE(score, 0) + ? WHERE id = ?', (points, user_id))
        cong_diem_thang(conn, user_id, points)   # cộng luôn vào bảng tháng
        conn.commit()
        print(f"Đã cộng thêm {points} điểm cho user ID {user_id}!")
    finally:
        conn.close()

# Streak để HIỂN THỊ: bỏ lỡ 1 ngày mà còn thẻ bảo hộ thì chuỗi vẫn được giữ
def streak_hien_thi(streak, last_date, bao_ho=0):
    streak = streak or 0
    bao_ho = bao_ho or 0
    if not last_date:
        return 0
    try:
        cach = (date.today() - date.fromisoformat(last_date)).days
    except ValueError:
        return 0
    if cach <= 1:
        return streak
    if cach == 2 and bao_ho > 0:
        return streak
    return 0

# 6. Sửa streak người dùng theo ID và ngày dùng cuối cùng
def update_streak(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        today = str(date.today())
        cursor.execute(
            "SELECT COALESCE(streak, 0) AS streak, last_active_date, COALESCE(the_bao_ho, 0) AS the_bao_ho "
            "FROM users WHERE id = ?", (user_id,)
        )
        user = cursor.fetchone()

        if user:
            current_streak = user['streak'] or 0
            last_date = user['last_active_date']
            bao_ho = user['the_bao_ho'] or 0

            if last_date == today:
                return

            try:
                cach = (date.today() - date.fromisoformat(last_date)).days
            except (TypeError, ValueError):
                cach = None

            if cach == 1:
                current_streak += 1
            elif cach == 2 and bao_ho > 0:
                current_streak += 1      # dùng 1 thẻ bảo hộ để giữ chuỗi
                bao_ho -= 1
            else:
                current_streak = 1

            cursor.execute('''
                UPDATE users 
                SET streak = ?, last_active_date = ?, the_bao_ho = ?
                WHERE id = ?
            ''', (current_streak, today, bao_ho, user_id))
            conn.commit()
    finally:
        conn.close()

# 7. Lấy bảng xếp hạng: điểm cao nhất đứng trên cùng (kèm avatar, huy_hieu)
def get_ranking(bang="khong-chuyen", ky="tong", limit=20):
    mon = BANG_XEP_HANG[bang][1]
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if ky == "thang":
        sql = ("SELECT u.id, u.username, u.bio, u.avatar, COALESCE(u.huy_hieu, '') AS huy_hieu, "
               "COALESCE(u.streak, 0) AS streak, COALESCE(t.diem, 0) AS score "
               "FROM users u JOIN diem_thang t ON t.user_id = u.id AND t.thang = ? "
               "WHERE COALESCE(u.mon_chuyen, '') = ? AND t.diem > 0 "
               "ORDER BY t.diem DESC, u.id ASC LIMIT ?")
        args = (thang_hien_tai(), mon, limit)
    else:
        sql = ("SELECT u.id, u.username, u.bio, u.avatar, COALESCE(u.huy_hieu, '') AS huy_hieu, "
               "COALESCE(u.streak, 0) AS streak, COALESCE(u.score, 0) AS score "
               "FROM users u WHERE COALESCE(u.mon_chuyen, '') = ? "
               "ORDER BY COALESCE(u.score, 0) DESC, u.id ASC LIMIT ?")
        args = (mon, limit)
    rows = [dict(r) for r in conn.execute(sql, args).fetchall()]
    conn.close()
    return rows
def get_my_rank(user_id, bang="khong-chuyen", ky="tong"):
    """Trả về {hang, username, bio, avatar, huy_hieu, score} của user, hoặc None nếu không có trên bảng."""
    mon = BANG_XEP_HANG[bang][1]
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if ky == "thang":
        thang = thang_hien_tai()
        me = conn.execute(
            "SELECT u.id, u.username, u.bio, u.avatar, COALESCE(u.huy_hieu, '') AS huy_hieu, COALESCE(t.diem, 0) AS score "
            "FROM users u JOIN diem_thang t ON t.user_id = u.id AND t.thang = ? "
            "WHERE u.id = ? AND COALESCE(u.mon_chuyen, '') = ? AND t.diem > 0",
            (thang, user_id, mon)).fetchone()
        if not me:
            conn.close()
            return None
        truoc = conn.execute(
            "SELECT COUNT(*) FROM users u JOIN diem_thang t ON t.user_id = u.id AND t.thang = ? "
            "WHERE COALESCE(u.mon_chuyen, '') = ? AND t.diem > 0 "
            "AND (t.diem > ? OR (t.diem = ? AND u.id < ?))",
            (thang, mon, me['score'], me['score'], me['id'])).fetchone()[0]
    else:
        me = conn.execute(
            "SELECT id, username, bio, avatar, COALESCE(huy_hieu, '') AS huy_hieu, COALESCE(score, 0) AS score FROM users "
            "WHERE id = ? AND COALESCE(mon_chuyen, '') = ?", (user_id, mon)).fetchone()
        if not me:
            conn.close()
            return None
        truoc = conn.execute(
            "SELECT COUNT(*) FROM users WHERE COALESCE(mon_chuyen, '') = ? "
            "AND (COALESCE(score, 0) > ? OR (COALESCE(score, 0) = ? AND id < ?))",
            (mon, me['score'], me['score'], me['id'])).fetchone()[0]
    conn.close()
    kq = dict(me)
    kq['hang'] = truoc + 1
    return kq

# 8. Lưu môn chuyên của người dùng ('' = không thi chuyên)
def update_mon_chuyen(user_id, mon):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET mon_chuyen = ? WHERE id = ?", (mon, user_id))
    conn.commit()
    conn.close()

# 9. Lấy thông tin 1 người dùng (KHÔNG lấy mật khẩu)
def get_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, username, bio, score, streak, mon_chuyen, last_active_date, avatar, "
        "COALESCE(huy_hieu, '') AS huy_hieu, the_bao_ho "
        "FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None

    u = dict(row)
    u['score'] = u['score'] or 0
    u['mon_chuyen'] = u['mon_chuyen'] or ''
    u['avatar'] = u['avatar'] or ''
    u['huy_hieu'] = u['huy_hieu'] or ''
    u['hoc_hom_nay'] = (u['last_active_date'] == str(date.today()))   # hôm nay đã làm bài chưa (để nhắc chuỗi)
    u['the_bao_ho'] = u['the_bao_ho'] or 0                            # giữ lại để trang hồ sơ hiện số thẻ
    u['streak'] = streak_hien_thi(u['streak'] or 0, u['last_active_date'], u['the_bao_ho'])
    u.pop('last_active_date')   # không cần gửi ngày này ra ngoài
    return u
# 10. Lưu avatar của người dùng ('' = dùng ảnh mặc định)
def update_avatar(user_id, avatar):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE users SET avatar = ? WHERE id = ?", (avatar, user_id))
    conn.commit()
    conn.close()