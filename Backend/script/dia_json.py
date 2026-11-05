# -*- coding: utf-8 -*-
r"""
dia_json.py - Chuyển đề TỰ LUẬN (JSON do NotebookLM soạn) sang file đề + đáp án cho VnStarL
Đặt ở: Backend/script/dia_json.py (cạnh md_to_json.py, dùng lại hàm luu() của file đó)

  - Frontend/file_de/<môn>/chuong-N/bai-NN.json : đề (KHÔNG có từ khóa, không có đáp án mẫu)
  - Backend/Dap_an/<môn>/chuong-N/bai-NN.json   : từ khóa + đáp án mẫu (chỉ server đọc)

Cả đề là 1 "bài tập" (id vd 1.1), mỗi câu tự luận là 1 câu hỏi type "tu-luan".
Điểm tự động quy về thang 100 (file 20 điểm -> nhân 5), khớp với các đề khác của web.

Cách dùng (chạy ở Backend/script):
    py dia_json.py de_thi_dia_li_chuyen_2026_2027.json -s chuyen_dia -c 1 --id 1.1
    py dia_json.py de.json -s chuyen_dia -c 1 --id 1.1 --dry     # chỉ kiểm tra, không ghi file
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

from cham_tu_luan import cham_tu_luan
from md_to_json import ROOT, chuan_chuong, luu

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def _lam_tron(x):
    return int(x) if float(x).is_integer() else round(float(x), 2)


def _de_sang_html(de_bai):
    """Bỏ dòng "Câu N (x điểm):" (giao diện đã có), escape HTML, xuống dòng -> <br>, in đậm a) b)."""
    dong = de_bai.strip().split("\n")
    if dong and re.match(r"^\s*Câu\s*\d+", dong[0]):
        dong = dong[1:]
    out = []
    for d in dong:
        d = html.escape(d.strip(), quote=False)
        out.append(re.sub(r"^([a-d]\))", r"<b>\1</b>", d))
    return "<br>".join(out)

def _truong_them(y, cid, canh_bao):
    """Các trường tùy chọn cho chấm so nghĩa."""
    out = {}
    if y.get("chi_tu_khoa"):
        out["chi_tu_khoa"] = True
    lt = [str(t).strip() for t in (y.get("loai_tru") or []) if str(t).strip()]
    if lt:
        out["loai_tru"] = lt
    if y.get("nguong") is not None:
        n = float(y["nguong"])
        if not 0.5 <= n <= 0.95:
            raise ValueError(f"ý {y.get('id')}: nguong phải từ 0.5 đến 0.95")
        out["nguong"] = n
    nd = str(y.get("noi_dung", ""))
    if not out.get("chi_tu_khoa"):
        if len(nd.split()) < 5:
            canh_bao.append(f"Câu {cid}, ý {y.get('id')}: noi_dung quá ngắn, so nghĩa sẽ kém chính xác.")
        if any(ch.isdigit() for ch in nd):
            canh_bao.append(f"Câu {cid}, ý {y.get('id')}: noi_dung có số liệu nên ý này chỉ chấm bằng từ khóa.")
    return out

def chuyen_de(d, bai_id, ten=None, do_kho=3):
    """Trả về (bai_tap cho frontend, dap_an cho backend, danh sách cảnh báo). Lỗi nghiêm trọng -> ValueError."""
    canh_bao, loi = [], []
    thang = float(d.get("thang_diem") or d.get("tong_diem") or 0)   # NotebookLM lúc ghi thang_diem, lúc ghi tong_diem
    if thang <= 0:
        raise ValueError("Thiếu 'thang_diem' (hoặc 'tong_diem').")
    k = 100.0 / thang                                    # hệ số quy về thang 100

    cau_hoi, dap_an, tong, tong_mau = [], {}, 0.0, 0.0
    for c in (d.get("cau_hoi") or d.get("cac_cau") or []):   # tên danh sách câu cũng có 2 kiểu
        cid = str(c.get("id"))
        try:
            ys = c.get("y") or []
            if not ys:
                raise ValueError("không có ý nào")
            tong_y = sum(float(y["diem"]) for y in ys)
            if abs(tong_y - float(c["diem"])) > 0.01:
                raise ValueError(f"tổng điểm các ý ({tong_y}) khác điểm câu ({c['diem']})")
            y_moi = []
            for y in ys:
                nhom = [[str(t).strip() for t in n if str(t).strip()] for n in y.get("nhom_tu_khoa", [])]
                nhom = [n for n in nhom if n]
                if not nhom:
                    raise ValueError(f"ý {y.get('id')} chưa có từ khóa")
                can = int(y.get("can_dat", 1))
                if can < 1:
                    raise ValueError(f"ý {y.get('id')}: can_dat phải từ 1 trở lên")
                if can > len(nhom) and (len(nhom) > 1 or can > len(nhom[0])):
                    raise ValueError(f"ý {y.get('id')}: can_dat={can} lớn hơn số nhóm / số từ khóa hiện có")
                if can > len(nhom):   # 1 nhóm nhiều từ + can_dat>1 = "phải nêu đủ ngần này từ khóa khác nhau trong nhóm"
                    canh_bao.append(f"Câu {cid}, ý {y.get('id')}: 1 nhóm, cần {can} từ khóa khác nhau trong nhóm (chấm theo số từ khóa trúng).")
                if can == 1 and len(nhom) > 1:
                    canh_bao.append(f"Câu {cid}, ý {y.get('id')}: chỉ cần 1/{len(nhom)} nhóm là đạt, dễ bị ăn gian.")
                if any(len(n) > 1 and len(set(n)) != len(n) for n in nhom):
                    canh_bao.append(f"Câu {cid}, ý {y.get('id')}: có từ khóa lặp trong 1 nhóm.")
                y_moi.append({"id": str(y["id"]), "diem": _lam_tron(round(float(y["diem"]) * k, 2)),
                "noi_dung": str(y.get("noi_dung", "")).strip(), "nhom_tu_khoa": nhom, "can_dat": can,
                **_truong_them(y, cid, canh_bao)})
            diem_cau = _lam_tron(round(float(c["diem"]) * k, 2))
            tong += diem_cau
            # Tự kiểm tra: chấm thử chính đáp án mẫu. Ý nào đáp án mẫu cũng không đạt = từ khóa sai, học sinh khó đạt
            diem_mau, kq_mau = cham_tu_luan({"y": y_moi}, c.get("dap_an_mau", ""))
            tong_mau += diem_mau
            hong = [r["id"] for r in kq_mau if not r["dat"]]
            if hong:
                canh_bao.append(f"Câu {cid}: đáp án mẫu chỉ tự chấm được {diem_mau}/{diem_cau}. Ý từ khóa chưa khớp: {', '.join(hong)}")
                cau_hoi.append({"id": cid, "type": "tu-luan", "de_bai": _de_sang_html(c["de_bai"]), "diem": diem_cau})
                dap_an[cid] = {"loai": "tu-luan", "dap_an_dung": "", "diem": diem_cau, "y": y_moi,
                           "loi_giai": html.escape(str(c.get("dap_an_mau", "")).strip(), quote=False).replace("\n", "<br>")}
        except (KeyError, ValueError, TypeError) as e:
            loi.append(f"Câu {cid}: {e}")
    if not cau_hoi and not loi:
        loi.append("Không có câu hỏi nào.")
    if loi:
        raise ValueError("\n  ".join(loi))
    if abs(tong - 100) > 0.01:
        canh_bao.append(f"Tổng điểm đề là {tong}, không phải 100.")
    canh_bao.append(f"TỰ KIỂM TRA: chấm thử đáp án mẫu được {_lam_tron(round(tong_mau, 2))}/{_lam_tron(round(tong, 2))} điểm "
                    f"(nên đạt gần 100 thì từ khóa mới công bằng).")
    ten = ten or f"Đề thi chuyên {d.get('nam_hoc', '')}".strip()
    return {"id": bai_id, "do_kho": do_kho, "ten": ten, "cau_hoi": cau_hoi}, dap_an, canh_bao


def main():
    ap = argparse.ArgumentParser(description="Chuyển đề tự luận JSON sang VnStarL")
    ap.add_argument("file", help="file JSON do NotebookLM soạn")
    ap.add_argument("-s", "--subject", default="chuyen_dia", help="thư mục môn (mặc định chuyen_dia)")
    ap.add_argument("-c", "--chapter", required=True, help="số chương, vd 1")
    ap.add_argument("--id", required=True, help="id đề, vd 1.1 (số trước dấu chấm = số bài học, bai-01.json)")
    ap.add_argument("--ten", help="tên đề hiển thị")
    ap.add_argument("--do-kho", type=float, default=3, help="độ khó (<=1 Dễ, <2 Vừa, còn lại Khó), mặc định 3")
    ap.add_argument("--dry", action="store_true", help="chỉ kiểm tra, không ghi file")
    a = ap.parse_args()

    try:
        d = json.loads(Path(a.file).read_text("utf-8-sig"))
        bai_tap, dap_an, canh_bao = chuyen_de(d, a.id, a.ten, a.do_kho)
    except (OSError, ValueError) as e:
        sys.exit(f"LỖI: {e}")

    tong = sum(c["diem"] for c in bai_tap["cau_hoi"])
    n_y = sum(len(v["y"]) for v in dap_an.values())
    print(f"Đề {a.id} | {len(bai_tap['cau_hoi'])} câu | {n_y} ý | tổng {tong} điểm")
    for w in canh_bao:
        print("  !", w)
    if a.dry:
        print("(chạy thử, chưa ghi file)")
        return
    p_fe, p_be = luu(ROOT, a.subject.replace("-", "_"), chuan_chuong(a.chapter), bai_tap, dap_an)
    print(f"  -> {p_fe}\n  -> {p_be}")


if __name__ == "__main__":
    main()