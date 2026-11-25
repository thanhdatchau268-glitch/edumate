import sqlite3
import os

# File này nằm ngay trong thư mục Database nên lấy luôn thư mục của nó
THU_MUC = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(THU_MUC, 'edumate.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Bảng users (avatar: tên file ảnh trong Frontend/img/avatar/, '' = ảnh mặc định)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mk TEXT NOT NULL,
        bio TEXT,
        score INTEGER NOT NULL DEFAULT 0,
        educoin INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT,
        mon_chuyen TEXT DEFAULT '',
        da_khao_sat INTEGER DEFAULT 0,
        avatar TEXT DEFAULT '',
        dd_tong INTEGER NOT NULL DEFAULT 0,
        dd_last TEXT DEFAULT '',
        the_bao_ho INTEGER NOT NULL DEFAULT 0,
        luot_quay INTEGER NOT NULL DEFAULT 0,
        muc_tieu_tuan INTEGER NOT NULL DEFAULT 20,
        x15_den TEXT DEFAULT '',
        huy_hieu TEXT DEFAULT ''
    )
    ''')

    # Huy hiệu đã mở khóa của từng người dùng
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_huy_hieu (
        user_id INTEGER,
        badge_id TEXT,
        unlocked_at TEXT,
        diem_thuong INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, badge_id)
    )
    ''')

    # Nhớ bài nào user đã được cộng điểm, để mỗi bài chỉ cộng 1 lần
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS da_lam (
        user_id INTEGER,
        bai_key TEXT,
        best_pct INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, bai_key)
    )
    ''')

    # Các cuộc thi (admin thêm vào)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ten TEXT NOT NULL,
        bat_dau TEXT NOT NULL,   -- vd: 2026-11-01 19:00
        ket_thuc TEXT NOT NULL,  -- vd: 2026-11-01 20:00
        noi_dung TEXT DEFAULT ''
    )
    ''')

    # Ai đã thi và được bao nhiêu điểm
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contest_ket_qua (
        user_id INTEGER,
        contest_id INTEGER,
        diem INTEGER,
        PRIMARY KEY (user_id, contest_id)
    )
    ''')

    # Sao La: skin đang mặc + giới tính giọng nói, và các skin người dùng sở hữu
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS pet (
        user_id INTEGER PRIMARY KEY,
        skin_dang_mac TEXT DEFAULT 'mac_dinh',
        gioi_tinh TEXT DEFAULT 'nu'
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS pet_do (
        user_id INTEGER,
        skin_id TEXT,
        ngay_nhan TEXT DEFAULT '',
        PRIMARY KEY (user_id, skin_id)
    )
    ''')

    # Bảng lưu OTP và token khôi phục mật khẩu qua Gmail
    cursor.execute('''
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

    # DB cũ thiếu cột nào thì thêm vào (không mất dữ liệu)
    cac_cot = [c[1] for c in cursor.execute("PRAGMA table_info(users)")]
    if 'mon_chuyen' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN mon_chuyen TEXT DEFAULT ''")
    if 'da_khao_sat' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN da_khao_sat INTEGER DEFAULT 0")
        cursor.execute("UPDATE users SET da_khao_sat = 1")
    if 'avatar' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    if 'huy_hieu' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN huy_hieu TEXT DEFAULT ''")
    else:
        cursor.execute("UPDATE users SET huy_hieu = COALESCE(huy_hieu, '') WHERE huy_hieu IS NULL")
    # Đảm bảo các cột số của tài khoản cũ/mới không bị NULL
    cursor.execute("UPDATE users SET score = COALESCE(score, 0), streak = COALESCE(streak, 0) WHERE score IS NULL OR streak IS NULL")
    if 'dd_tong' in cac_cot:
        cursor.execute("UPDATE users SET dd_tong = COALESCE(dd_tong, 0) WHERE dd_tong IS NULL")
    if 'the_bao_ho' in cac_cot:
        cursor.execute("UPDATE users SET the_bao_ho = COALESCE(the_bao_ho, 0) WHERE the_bao_ho IS NULL")
    if 'luot_quay' in cac_cot:
        cursor.execute("UPDATE users SET luot_quay = COALESCE(luot_quay, 0) WHERE luot_quay IS NULL")
    if 'muc_tieu_tuan' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN muc_tieu_tuan INTEGER NOT NULL DEFAULT 20")
    else:
        cursor.execute("UPDATE users SET muc_tieu_tuan = COALESCE(muc_tieu_tuan, 20) WHERE muc_tieu_tuan IS NULL")
    if 'educoin' not in cac_cot:
        cursor.execute("ALTER TABLE users ADD COLUMN educoin INTEGER NOT NULL DEFAULT 0")
    cursor.execute("UPDATE users SET educoin = COALESCE(educoin, 0) WHERE educoin IS NULL")

    cot_contest = [c[1] for c in cursor.execute("PRAGMA table_info(contests)")]
    if 'noi_dung' not in cot_contest:
        cursor.execute("ALTER TABLE contests ADD COLUMN noi_dung TEXT DEFAULT ''")
    if 'loai' not in cot_contest:
        cursor.execute("ALTER TABLE contests ADD COLUMN loai TEXT DEFAULT ''")

    # Đảm bảo 3 kỳ thi mẫu cho Khoa Bảng luôn sẵn sàng (chỉ mở đúng ngày thi)
    contests_data = [
        (1, 'Thi Hương - Kỳ thi Tuần', '2026-11-15 19:00', '2026-11-15 19:30', 'Kỳ thi Hương hàng tuần. Thời gian làm bài: 30 phút. Đề thi mở đúng 19:00 ngày 15/11/2026.', 'huong'),
        (2, 'Thi Hội - Kỳ thi Tháng', '2026-11-20 19:30', '2026-11-20 20:15', 'Kỳ thi Hội hàng tháng. Thời gian làm bài: 45 phút. Đề thi mở đúng 19:30 ngày 20/11/2026.', 'hoi'),
        (3, 'Thi Đình - Kỳ thi Quý', '2026-12-27 19:30', '2026-12-27 20:30', 'Kỳ thi Đình vinh danh cao nhất. Thời gian làm bài: 60 phút. Đề thi mở đúng 19:30 ngày 27/12/2026.', 'dinh')
    ]
    cursor.executemany("INSERT OR IGNORE INTO contests (id, ten, bat_dau, ket_thuc, noi_dung, loai) VALUES (?, ?, ?, ?, ?, ?)", contests_data)

    conn.commit()
    conn.close()
    print("Tạo Database thành công!")

if __name__ == '__main__':
    init_db()