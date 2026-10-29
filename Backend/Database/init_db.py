import sqlite3
import os

# File này nằm ngay trong thư mục Database nên lấy luôn thư mục của nó
THU_MUC = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(THU_MUC, 'edumate.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Tạo bảng users (có thêm cột avatar: tên file ảnh trong Frontend/img/avatar/, '' = ảnh mặc định)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mk TEXT NOT NULL,
        bio TEXT,
        score INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_active_date TEXT,
        mon_chuyen TEXT DEFAULT '',
        da_khao_sat INTEGER DEFAULT 0,
        avatar TEXT DEFAULT ''
    )
    ''')

    # bảng nhớ bài nào user đã được cộng điểm, để mỗi bài chỉ cộng 1 lần
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS da_lam (
        user_id INTEGER,
        bai_key TEXT,
        PRIMARY KEY (user_id, bai_key)
    )
    ''')

    # Bảng ghi các cuộc thi (admin thêm vào)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ten TEXT NOT NULL,
        bat_dau TEXT NOT NULL,   -- vd: 2026-11-01 19:00
        ket_thuc TEXT NOT NULL   -- vd: 2026-11-01 20:00
    )
    ''')

    # Bảng ghi ai đã thi và được bao nhiêu điểm
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contest_ket_qua (
        user_id INTEGER,
        contest_id INTEGER,
        diem INTEGER,
        PRIMARY KEY (user_id, contest_id)
    )
    ''')

    # DB cũ thiếu cột nào thì thêm vào (không mất dữ liệu)
    cursor.execute("PRAGMA table_info(users)")
    cac_cot = [c[1] for c in cursor.fetchall()]
    if 'mon_chuyen' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN mon_chuyen TEXT DEFAULT ''")
    if 'da_khao_sat' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN da_khao_sat INTEGER DEFAULT 0")
        cursor.execute("UPDATE users SET da_khao_sat = 1")
    if 'avatar' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")

    conn.commit()
    conn.close()
    print("Tạo Database và bảng users thành công!")

if __name__ == '__main__':
    init_db()