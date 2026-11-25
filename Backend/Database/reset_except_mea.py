# -*- coding: utf-8 -*-
"""Reset toàn bộ tài khoản trong SQLite edumate.db, CHỈ GIỮ LẠI tài khoản 'mea'."""
import os
import sqlite3
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "edumate.db")
AVATAR_DIR = os.path.abspath(os.path.join(BASE, "..", "uploads", "avatars"))


def main():
    if not os.path.isfile(DB_PATH):
        print(f"Không tìm thấy database: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        kept = conn.execute(
            "SELECT id, username, email FROM users WHERE LOWER(TRIM(username)) = 'mea'"
        ).fetchall()
        if not kept:
            print("LỖI: Không tìm thấy tài khoản nào có username = 'mea'. Đã hủy để tránh xóa nhầm!")
            sys.exit(1)

        kept_ids = [int(r["id"]) for r in kept]
        removed = conn.execute(
            f"SELECT id, username, avatar FROM users WHERE id NOT IN ({','.join('?' * len(kept_ids))})",
            kept_ids,
        ).fetchall()

        placeholders = ",".join("?" * len(kept_ids))
        for (t_name,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
            if t_name.startswith("sqlite_"):
                continue
            cols = [c[1] for c in conn.execute(f'PRAGMA table_info("{t_name}")').fetchall()]
            if "user_id" in cols:
                conn.execute(f'DELETE FROM "{t_name}" WHERE user_id NOT IN ({placeholders})', kept_ids)

        conn.execute("DELETE FROM password_resets")
        conn.execute(f"DELETE FROM users WHERE id NOT IN ({placeholders})", kept_ids)
        conn.commit()

        for r in removed:
            av = (r["avatar"] or "").strip()
            if av.startswith("up_"):
                p = os.path.join(AVATAR_DIR, av)
                if os.path.isfile(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

        print("Đã giữ lại:", [(r["id"], r["username"], r["email"]) for r in kept])
        print(f"Đã xóa {len(removed)} tài khoản khác khỏi edumate.db.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
