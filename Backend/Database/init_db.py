import sqlite3
import os

# File này nằm ngay trong thư mục Database nên lấy luôn thư mục của nó
THU_MUC = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(THU_MUC, 'edumate.db')

def init_db():
    # Thư mục này chắc chắn tồn tại vì file đang nằm trong đó
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Tạo bảng users
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
        da_khao_sat INTEGER DEFAULT 0
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
    # PRIMARY KEY (user_id, contest_id) = mỗi người chỉ nộp 1 lần
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contest_ket_qua (
        user_id INTEGER,
        contest_id INTEGER,
        diem INTEGER,
        PRIMARY KEY (user_id, contest_id)
    )
    ''')

    # DB cũ chưa có cột mon_chuyen thì thêm vào (không mất dữ liệu)
    cursor.execute("PRAGMA table_info(users)")
    cac_cot = [c[1] for c in cursor.fetchall()]
    if 'mon_chuyen' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN mon_chuyen TEXT DEFAULT ''")

    # DB cũ chưa có cột da_khao_sat thì thêm vào; tài khoản cũ coi như đã khảo sát rồi
    if 'da_khao_sat' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN da_khao_sat INTEGER DEFAULT 0")
        cursor.execute("UPDATE users SET da_khao_sat = 1")

    conn.commit()
    conn.close()
    print("Tạo Database và bảng users thành công!")

if __name__ == '__main__':
    init_db()