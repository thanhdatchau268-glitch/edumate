# -*- coding: utf-8 -*-
"""
chot_ky.py - công cụ quản trị Bảng vàng khoa bảng (chạy ở Backend/script).

    py chot_ky.py chot                       # chốt mọi kỳ đã hết hạn (nên lên lịch chạy mỗi ngày, vd 00:10)
    py chot_ky.py ky                         # liệt kê các kỳ (mới nhất trước)
    py chot_ky.py gan-cuoc-thi 5 hoi         # đánh dấu cuộc thi id 5 là kỳ Hội (hoi | dinh | khao_hach | "" để bỏ)
    py chot_ky.py vi-pham                    # xem danh sách bất thường chờ duyệt
    py chot_ky.py vi-pham xac-nhan 3         # xác nhận vi phạm #3 (người đó bị loại khỏi kỳ chứa ngày vi phạm)
    py chot_ky.py vi-pham bo-qua 3           # bỏ qua (không vi phạm)
    py chot_ky.py phuc-khao                  # xem phúc khảo đang chờ
    py chot_ky.py phuc-khao xu-ly 2 "ghi chú"  # đánh dấu đã xử lý
    py chot_ky.py mo-lai 12 "lý do"          # mở lại kỳ #12 rồi chốt lại (có ghi nhật ký)
    py chot_ky.py cau-hinh huong             # xem cấu hình (trọng số, ngưỡng, tỷ lệ danh hiệu)
    py chot_ky.py cau-hinh huong file.json   # ghi cấu hình mới từ file JSON

Lên lịch trên Windows: Task Scheduler -> chạy "py chot_ky.py chot" với thư mục bắt đầu là Backend/script.
Dù quên lên lịch, server vẫn tự chốt khi có người mở trang Khoa bảng (chốt lười).
"""
import argparse
import json
import sqlite3

import khoa_bang as kb


def main():
    ap = argparse.ArgumentParser(description="Quản trị Khoa bảng")
    sp = ap.add_subparsers(dest="lenh", required=True)
    sp.add_parser("chot")
    sp.add_parser("ky")
    p = sp.add_parser("gan-cuoc-thi"); p.add_argument("id", type=int); p.add_argument("loai", choices=["hoi", "dinh", "khao_hach", ""])
    p = sp.add_parser("vi-pham"); p.add_argument("hanh_dong", nargs="?", choices=["xac-nhan", "bo-qua"]); p.add_argument("id", nargs="?", type=int)
    p = sp.add_parser("phuc-khao"); p.add_argument("hanh_dong", nargs="?", choices=["xu-ly"]); p.add_argument("id", nargs="?", type=int); p.add_argument("ghi_chu", nargs="?", default="")
    p = sp.add_parser("mo-lai"); p.add_argument("ky_id", type=int); p.add_argument("ly_do")
    p = sp.add_parser("cau-hinh"); p.add_argument("cap", choices=list(kb.CAP)); p.add_argument("file", nargs="?")
    a = ap.parse_args()

    c = kb._ket_noi()
    if a.lenh == "chot":
        ds = kb.chot_tat_ca(c)
        print(f"Đã chốt {len(ds)} kỳ: {ds}" if ds else "Không có kỳ nào cần chốt.")

    elif a.lenh == "ky":
        for k in c.execute("SELECT k.*, (SELECT COUNT(*) FROM kb_ket_qua WHERE ky_id = k.id) AS n FROM kb_ky k "
                           "WHERE k.bang = 'khong-chuyen' ORDER BY k.bat_dau DESC, k.cap LIMIT 40"):
            print(f"#{k['id']:<4} {kb.TEN_CAP[k['cap']]:<9} {k['ma']:<9} {k['bat_dau']}..{k['ket_thuc']}  {k['trang_thai']:<8} {k['n']} người")

    elif a.lenh == "gan-cuoc-thi":
        c.execute("UPDATE contests SET loai = ? WHERE id = ?", (a.loai, a.id)); c.commit()
        print(f"Cuộc thi #{a.id} -> loại '{a.loai}'" if c.total_changes else "Không thấy cuộc thi này.")

    elif a.lenh == "vi-pham":
        if a.hanh_dong:
            if not a.id: ap.error("cần id")
            c.execute("UPDATE kb_vi_pham SET trang_thai = ? WHERE id = ?", ("xac_nhan" if a.hanh_dong == "xac-nhan" else "bo_qua", a.id))
            c.commit(); print("Đã cập nhật. Nếu kỳ liên quan đã chốt, dùng 'mo-lai' để tính lại.")
        else:
            for r in c.execute("SELECT * FROM kb_vi_pham WHERE trang_thai = 'cho_duyet' ORDER BY id DESC LIMIT 50"):
                print(f"#{r['id']} user {r['user_id']} | {r['tao_luc']} | {r['ly_do']} | {r['bai_key']}")

    elif a.lenh == "phuc-khao":
        if a.hanh_dong:
            c.execute("UPDATE kb_phuc_khao SET trang_thai = 'da_xu_ly', ghi_chu_admin = ? WHERE id = ?", (a.ghi_chu, a.id)); c.commit()
            print("Đã đánh dấu đã xử lý.")
        else:
            for r in c.execute("SELECT * FROM kb_phuc_khao WHERE trang_thai = 'cho' ORDER BY id"):
                print(f"#{r['id']} kỳ {r['ky_id']} user {r['user_id']} | {r['tao_luc']}\n    {r['noi_dung']}")

    elif a.lenh == "mo-lai":
        kb.mo_lai_ky(c, a.ky_id, a.ly_do)
        print("Chốt lại:", "xong" if kb.chot_ky(c, a.ky_id) else "chưa chốt được (kỳ chưa hết hạn)")
        print("Nhớ mở lại và chốt lại các kỳ Hội/Đình dùng kết quả kỳ này (nếu có).")

    elif a.lenh == "cau-hinh":
        if a.file:
            with open(a.file, encoding="utf-8-sig") as f:
                gt = json.load(f)
            c.execute("INSERT OR REPLACE INTO kb_cau_hinh (khoa, gia_tri) VALUES (?, ?)", (a.cap, json.dumps(gt))); c.commit()
            print("Đã lưu. Kỳ đang mở dùng cấu hình mới ngay; kỳ đã khóa giữ nguyên kết quả.")
        else:
            print(json.dumps(kb.doc_cau_hinh(c, a.cap), ensure_ascii=False, indent=2))
    c.close()


if __name__ == "__main__":
    main()