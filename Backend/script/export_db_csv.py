# -*- coding: utf-8 -*-
"""
export_db_csv.py - Xuất toàn bộ bảng trong Backend/Database/edumate.db ra CSV (UTF-8 BOM)
để đưa lên Google Sheets.

Chạy từ thư mục bất kỳ:
    py Backend/script/export_db_csv.py
"""
import csv
import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "Backend" / "Database" / "edumate.db"
OUT_DIR = ROOT / "Backend" / "Database" / "csv_export"

# Bảng tạm / nội bộ không nên đưa lên Sheet
BO_QUA = {"sqlite_sequence", "password_resets"}


def main():
    if not DB_PATH.is_file():
        raise SystemExit(f"Không tìm thấy database: {DB_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    tables = [
        r[0]
        for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        if r[0] not in BO_QUA
    ]

    print(f"Đang xuất {len(tables)} bảng từ {DB_PATH} -> {OUT_DIR}\n")
    for table in tables:
        rows = cur.execute(f'SELECT * FROM "{table}"').fetchall()
        headers = [d[0] for d in cur.description]
        out_file = OUT_DIR / f"{table}.csv"
        with open(out_file, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        print(f"  - {table}.csv : {len(rows)} dòng ({len(headers)} cột)")

    conn.close()
    print("\nXong! Tất cả CSV đã nằm trong:", OUT_DIR)


if __name__ == "__main__":
    main()
