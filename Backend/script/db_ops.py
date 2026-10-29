import os
import sqlite3
from datetime import date, timedelta

# __file__ là vị trí file db_ops.py, từ đó đi lùi ra rồi vào thư mục Database
# nên chạy lệnh ở thư mục nào cũng tìm đúng file edumate.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Database', 'edumate.db')

# 1. Thêm tài khoản mới (Create)
def add_user(username, email, mk, bio=""):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (username, email, mk, bio)
            VALUES (?, ?, ?, ?)
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
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users 
        SET score = score + ? 
        WHERE id = ?
    ''', (points, user_id))
    conn.commit()
    conn.close()
    print(f"Đã cộng thêm {points} điểm cho user ID {user_id}!")

# 6. Sửa streak người dùng theo ID và ngày dùng cuối cùng
def update_streak(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    today = str(date.today())
    cursor.execute("SELECT streak, last_active_date FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if user:
        current_streak = user['streak']
        last_date = user['last_active_date']

        if last_date == today:
            conn.close()
            return  # hôm nay đã tính rồi

        yesterday = str(date.today() - timedelta(days=1))

        if last_date == yesterday:
            current_streak += 1  # tăng
        else:
            current_streak = 1   # reset

        cursor.execute('''
            UPDATE users 
            SET streak = ?, last_active_date = ? 
            WHERE id = ?
        ''', (current_streak, today, user_id))
        conn.commit()

    conn.close()

# 7. Lấy bảng xếp hạng: điểm cao nhất đứng trên cùng (kèm avatar)
def get_ranking(limit=50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, bio, score, avatar FROM users ORDER BY score DESC LIMIT ?",
        (limit,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

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
        "SELECT id, username, bio, score, streak, mon_chuyen, last_active_date, avatar "
        "FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None

    u = dict(row)
    hom_nay = str(date.today())
    hom_qua = str(date.today() - timedelta(days=1))
    # bỏ lỡ từ 2 ngày trở lên thì chuỗi đứt, hiện 0 (giống lúc đăng nhập)
    if u['last_active_date'] not in (hom_nay, hom_qua):
        u['streak'] = 0
    u.pop('last_active_date')   # không cần gửi ngày này ra ngoài
    return u
# 10. Lưu avatar của người dùng ('' = dùng ảnh mặc định)
def update_avatar(user_id, avatar):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE users SET avatar = ? WHERE id = ?", (avatar, user_id))
    conn.commit()
    conn.close()