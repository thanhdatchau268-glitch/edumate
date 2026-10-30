# -*- coding: utf-8 -*-
"""
md_to_json_all.py - Chuyển HÀNG LOẠT đề .md của nhiều môn, nhiều chương cùng lúc.

Đọc thư mục de/<môn>/<chương>/*.md rồi gọi lại các hàm trong md_to_json.py.
Môn và chương lấy từ TÊN THƯ MỤC nên không cần gõ -s, -c.

Cách dùng (chạy ở Backend/script):
    py md_to_json_all.py                  # chuyển tất cả môn
    py md_to_json_all.py -s toan ngu_van  # chỉ chuyển một số môn
    py md_to_json_all.py --dry            # chạy thử, không ghi file
"""
import argparse
import sys
from pathlib import Path

from md_to_json import ROOT, chuan_chuong, doc_de, luu


def main():
    ap = argparse.ArgumentParser(description="Chuyển hàng loạt đề .md sang JSON")
    ap.add_argument("-s", "--subject", nargs="*", help="chỉ chuyển các môn này (mặc định: tất cả)")
    ap.add_argument("--de", default=str(ROOT / "de"), help="thư mục chứa đề (mặc định: <gốc>/de)")
    ap.add_argument("--dry", action="store_true", help="chạy thử, không ghi file")
    a = ap.parse_args()

    thu_muc_de = Path(a.de)
    if not thu_muc_de.is_dir():
        sys.exit(f"Không thấy thư mục đề: {thu_muc_de}")

    # danh sách môn: lấy theo thư mục con của de/, lọc theo -s nếu có
    cac_mon = sorted(p for p in thu_muc_de.iterdir() if p.is_dir())
    if a.subject:
        loc = {s.replace("-", "_") for s in a.subject}
        cac_mon = [p for p in cac_mon if p.name in loc]

    ok = loi = 0
    for mon_dir in cac_mon:
        mon = mon_dir.name
        for chuong_dir in sorted(p for p in mon_dir.iterdir() if p.is_dir()):
            try:
                chuong = chuan_chuong(chuong_dir.name)   # "chuong-1" hoặc "1" đều được
            except SystemExit:
                print(f"! Bỏ qua thư mục lạ: {chuong_dir}")
                continue

            for f in sorted(chuong_dir.glob("*.md")):
                nhan = f"{mon}/{chuong}/{f.name}"
                try:
                    bai_tap, dap_an, canh_bao = doc_de(f.read_text("utf-8-sig"), f.name)
                    if not a.dry:
                        luu(ROOT, mon, chuong, bai_tap, dap_an)
                    print(f"OK  {nhan} -> đề {bai_tap['id']} ({len(bai_tap['cau_hoi'])} mục)")
                    for w in canh_bao:
                        print(f"    ! {w}")
                    ok += 1
                except (OSError, ValueError) as e:
                    print(f"LỖI {nhan}\n    {e}")
                    loi += 1

    print(f"\nXong: {ok} đề thành công, {loi} đề lỗi" + (" (chạy thử, chưa ghi file)" if a.dry else ""))
    sys.exit(1 if loi else 0)


if __name__ == "__main__":
    main()