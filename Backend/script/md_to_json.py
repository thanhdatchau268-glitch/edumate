# -*- coding: utf-8 -*-
"""
md_to_json.py - Chuyển file đề (.md) sang JSON cho web EduMate

Mỗi file .md = 1 đề (vd: đề 1.1, đề 1.2) và được tách thành 2 file JSON:
  - Frontend/file_de/<môn>/chuong-N/bai-NN.json   : đề (KHÔNG có đáp án, trình duyệt đọc được)
  - Backend/Dap_an/<môn>/chuong-N/bai-NN.json     : đáp án (chỉ server đọc)

Chạy nhiều đề của cùng 1 bài thì tự GỘP vào cùng file (đề trùng id sẽ bị ghi đè).

Đặt file này ở: Backend/script/md_to_json.py

Cách dùng (chạy ở bất kỳ thư mục nào):
    py md_to_json.py "bài_1.1_(1.0).md" "bài_1.2_(1.5).md" -s toan -c 1
    py md_to_json.py de/*.md -s toan -c 1
    py md_to_json.py de.md -s toan -c 1 --dry      # chỉ in ra màn hình, không ghi file
"""
import argparse
import glob
import html
import json
import re
import sys
from pathlib import Path

# Backend/script/md_to_json.py -> đi lùi 2 cấp ra thư mục gốc dự án
ROOT = Path(__file__).resolve().parents[2]

# ---------- Điểm (tổng 1 đề = 100) ----------
DIEM_TRAC_NGHIEM = 2      # 25 câu x 2   = 50
DIEM_MOI_Y = 2.5          # 2 câu x 4 ý x 2.5 = 20 (mỗi ý đúng/sai tính như 1 câu nhỏ)
DIEM_TRA_LOI_NGAN = 6     # 5 câu x 6    = 30

# Câu đúng/sai có 4 ý: True = chỉ ghi đề bài chung ở ý a, False = lặp đề bài ở cả 4 ý
CHI_GHI_DE_O_Y_A = True

# Các dòng "* Từ khóa:" trong file md (thứ tự quan trọng: "Đáp án chính xác" trước "Đáp án")
TIEN_TO = [
    ("* Độ khó:", "do_kho"),
    ("* Đề bài:", "de_bai"),
    ("* Đáp án chính xác:", "ngan"),
    ("* Đáp án:", "dap_an"),
    ("* Các ý lựa chọn:", "y"),
    ("* Gợi ý:", "goi_y"),        # tùy chọn: có thì đưa vào đề
    ("* Lời giải:", "loi_giai"),  # tùy chọn: có thì đưa vào đáp án
]


# ======================================================================
# Hàm nhỏ dùng chung
# ======================================================================
def so(s):
    """'1.0' -> 1, '1.5' -> 1.5"""
    f = float(s)
    return int(f) if f.is_integer() else f


def xu_ly_chu(s):
    """Escape HTML (an toàn khi web dùng innerHTML) rồi đổi **chữ đậm** thành <b>.
    Công thức $...$ giữ nguyên, trình duyệt sẽ giải mã lại < > & trước khi KaTeX đọc."""
    s = html.escape(s.strip(), quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)


def khoa_id(s):
    """Sắp xếp id kiểu '1.2' < '1.10'"""
    return tuple(int(x) if x.isdigit() else 0 for x in s.split("."))


def chuan_chuong(c):
    """'1' / 'chuong-1' -> 'chuong-1'"""
    c = str(c).lower().replace("chuong-", "").strip()
    if not c.isdigit():
        raise SystemExit("--chapter phải là số chương, ví dụ: 1 hoặc chuong-1")
    return f"chuong-{int(c)}"


# ======================================================================
# Đọc 1 câu hỏi
# ======================================================================
def tach_muc(body):
    """Chia nội dung 1 câu thành các mục: do_kho, de_bai, dap_an, y, ngan..."""
    dong = []
    for ln in body.splitlines():
        # gặp đường kẻ ==== hoặc tiêu đề #### (của phần kế tiếp) thì dừng
        if re.match(r"^\s*(={3,}|#{1,6}\s)", ln):
            break
        dong.append(ln.strip())

    muc, hien_tai = {}, None
    for s in dong:
        if not s:
            continue
        for tien_to, khoa in TIEN_TO:
            if s.startswith(tien_to):
                hien_tai = khoa
                muc[khoa] = [s[len(tien_to):].strip()]
                break
        else:  # dòng thường: nối vào mục đang đọc
            if hien_tai:
                muc[hien_tai].append(s)
    # bỏ dòng rỗng
    return {k: [x for x in v if x] for k, v in muc.items()}


def doc_trac_nghiem(num, m):
    lua_chon, dung = [], []
    for ln in m["dap_an"]:
        r = re.match(r"^(\*?)\s*([A-D])\.\s*(.+)$", ln)
        if not r:
            raise ValueError(f"dòng đáp án không đúng dạng 'A. ...': {ln!r}")
        if r.group(1):  # có dấu * ở đầu = đáp án đúng
            dung.append(len(lua_chon))
        lua_chon.append(xu_ly_chu(r.group(3)))
    if len(lua_chon) != 4:
        raise ValueError(f"cần 4 đáp án A-D, đang có {len(lua_chon)}")
    if len(dung) != 1:
        raise ValueError(f"cần đúng 1 đáp án đánh dấu *, đang có {len(dung)}")

    cau = {"id": str(num), "type": "trac-nghiem", "de_bai": xu_ly_chu(" ".join(m["de_bai"])),
           "dap_an": lua_chon, "diem": DIEM_TRAC_NGHIEM}
    return [(cau, dung[0])]  # dap_an_dung = vị trí đáp án (0 = A, 1 = B...)


def doc_dung_sai(num, m):
    de_chung = xu_ly_chu(" ".join(m["de_bai"]))
    ket_qua = []
    for ln in m["y"]:
        r = re.match(r"^([a-d])\)\s*(.*)\s->\s*(.*)$", ln)
        if not r:
            raise ValueError(f"dòng ý không đúng dạng 'a) ... -> *Đúng* / Sai': {ln!r}")
        chu, noi_dung, kq = r.group(1), xu_ly_chu(r.group(2)), r.group(3)
        if "*Đúng*" in kq:
            dap_an = True
        elif "*Sai*" in kq:
            dap_an = False
        else:
            raise ValueError(f"ý {chu}) không có dấu * ở Đúng hoặc Sai: {kq!r}")

        de = f"<b>{chu})</b> {noi_dung}"
        if chu == "a" or not CHI_GHI_DE_O_Y_A:
            de = f"{de_chung}<br>{de}"
        cau = {"id": f"{num}{chu}", "type": "dung-sai", "de_bai": de, "diem": DIEM_MOI_Y}
        ket_qua.append((cau, dap_an))
    if len(ket_qua) != 4:
        raise ValueError(f"cần 4 ý a-d, đang có {len(ket_qua)}")
    return ket_qua


def doc_tra_loi_ngan(num, m):
    dap_an = " ".join(m["ngan"]).strip()
    if not dap_an:
        raise ValueError("thiếu đáp án chính xác")
    cau = {"id": str(num), "type": "tra-loi-ngan", "de_bai": xu_ly_chu(" ".join(m["de_bai"])),
           "diem": DIEM_TRA_LOI_NGAN}
    return [(cau, dap_an)]


# ======================================================================
# Đọc cả 1 file đề
# ======================================================================
def doc_de(text, ten_file, id_cli=None):
    """Trả về (bai_tap_cho_frontend, dap_an_cho_backend, danh_sach_canh_bao)"""
    canh_bao, loi = [], []

    # --- tiêu đề + id đề (ưu tiên: --id > "(ĐỀ 1.2)" trong file > tên file) ---
    h = re.search(r"^#+\s*BÀI\s+(\d+)\s*:\s*(.+)$", text, re.M | re.I)
    tieu_de = h.group(2) if h else ""
    m_de = re.search(r"ĐỀ\s*(\d+\.\d+)", tieu_de, re.I)
    m_file = re.search(r"(\d+)[._](\d+)", Path(ten_file).stem)
    if id_cli:
        bai_id = id_cli
    elif m_de:
        bai_id = m_de.group(1)
    elif m_file:
        bai_id = f"{m_file.group(1)}.{m_file.group(2)}"
    elif h:
        bai_id = f"{h.group(1)}.1"
    else:
        raise ValueError("Không xác định được id đề. Hãy thêm --id, ví dụ --id 1.1")

    ten = re.sub(r"\(\s*ĐỀ[^)]*\)", "", tieu_de, flags=re.I).strip().lower().capitalize()

    # --- độ khó chung ---
    m = re.search(r"Độ khó chung:\s*(\d+(?:\.\d+)?)", text)
    if m:
        do_kho = so(m.group(1))
    else:
        mf = re.search(r"\((\d+(?:[._]\d+)?)\)", Path(ten_file).stem)
        do_kho = so(mf.group(1).replace("_", ".")) if mf else None

    # --- tách từng [Câu N] ---
    phan = re.split(r"^\[Câu\s+(\d+)\]\s*$", text, flags=re.M)
    cau_hoi, dap_an = [], {}
    do_kho_cau_dau = None

    for num, body in zip(phan[1::2], phan[2::2]):
        try:
            m = tach_muc(body)
            if "de_bai" not in m:
                raise ValueError("thiếu '* Đề bài:'")
            if do_kho_cau_dau is None and "do_kho" in m:
                do_kho_cau_dau = so(m["do_kho"][0])

            if "dap_an" in m:
                ds = doc_trac_nghiem(num, m)
            elif "y" in m:
                ds = doc_dung_sai(num, m)
            elif "ngan" in m:
                ds = doc_tra_loi_ngan(num, m)
            else:
                raise ValueError("không nhận ra dạng câu (thiếu Đáp án / Các ý lựa chọn / Đáp án chính xác)")

            for cau, dung in ds:
                if "goi_y" in m:
                    cau["goi_y"] = xu_ly_chu(" ".join(m["goi_y"]))
                cau_hoi.append(cau)
                dap_an[cau["id"]] = {
                    "dap_an_dung": dung,
                    "diem": cau["diem"],
                    "loi_giai": xu_ly_chu(" ".join(m["loi_giai"])) if "loi_giai" in m else "",
                }
        except ValueError as e:
            loi.append(f"Câu {num}: {e}")

    if not cau_hoi and not loi:
        loi.append("Không tìm thấy câu nào (file cần có các dòng '[Câu 1]', '[Câu 2]'...)")
    if loi:
        raise ValueError("\n  ".join(loi))

    tong = sum(c["diem"] for c in cau_hoi)
    if abs(tong - 100) > 1e-9:
        canh_bao.append(f"Tổng điểm đề là {tong}, không phải 100. Kiểm tra lại số câu / hằng số DIEM_*.")

    bai_tap = {"id": bai_id, "do_kho": do_kho if do_kho is not None else (do_kho_cau_dau or 1),
               "ten": ten, "cau_hoi": cau_hoi}
    return bai_tap, dap_an, canh_bao


# ======================================================================
# Ghi file (gộp với file có sẵn)
# ======================================================================
def doc_json(path):
    if not path.exists() or not path.read_text("utf-8-sig").strip():
        return {}
    try:
        return json.loads(path.read_text("utf-8-sig"))
    except ValueError:
        print(f"  ! {path} đang bị lỗi JSON, sẽ tạo lại từ đầu.")
        return {}


def ghi_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def luu(root, mon, chuong, bai_tap, dap_an):
    """Gộp đề vào Frontend/file_de/... và đáp án vào Backend/Dap_an/..."""
    bai_id = bai_tap["id"]
    ten_bai = f"bai-{int(bai_id.split('.')[0]):02d}.json"

    # --- Frontend: giữ ly_thuyet / mo_phong cũ, chỉ thay bài_tap cùng id ---
    p_fe = root / "Frontend" / "file_de" / mon / chuong / ten_bai
    fe = doc_json(p_fe)
    fe.setdefault("ly_thuyet", "<p>Chưa có lý thuyết.</p>")
    ds = [b for b in fe.get("bai_tap", []) if str(b.get("id")) != bai_id]
    ds.append(bai_tap)
    fe["bai_tap"] = sorted(ds, key=lambda b: khoa_id(str(b["id"])))
    ghi_json(p_fe, fe)

    # --- Backend: { "<id đề>": { "<id câu>": {dap_an_dung, diem, loi_giai} } } ---
    p_be = root / "Backend" / "Dap_an" / mon / chuong / ten_bai
    be = doc_json(p_be)
    be[bai_id] = dap_an
    ghi_json(p_be, dict(sorted(be.items(), key=lambda kv: khoa_id(kv[0]))))
    return p_fe, p_be


# ======================================================================
def main():
    ap = argparse.ArgumentParser(description="Chuyển file đề .md sang JSON cho EduMate")
    ap.add_argument("files", nargs="+", help="file .md (nhận cả dấu * kiểu de/*.md)")
    ap.add_argument("-s", "--subject", default="toan", help="thư mục môn: toan, chuyen_toan, vat_ly... (mặc định toan)")
    ap.add_argument("-c", "--chapter", required=True, help="số chương, vd: 1 hoặc chuong-1")
    ap.add_argument("--id", help="ép id đề, vd 1.1 (chỉ dùng khi chuyển 1 file)")
    ap.add_argument("--root", default=str(ROOT), help="thư mục gốc dự án (mặc định tự tìm)")
    ap.add_argument("--dry", action="store_true", help="chỉ in JSON ra màn hình, không ghi file")
    a = ap.parse_args()

    # PowerShell không tự bung dấu *, nên tự bung ở đây
    ds_file = []
    for p in a.files:
        ds_file += [p] if Path(p).exists() else (sorted(glob.glob(p)) or [p])
    if a.id and len(ds_file) > 1:
        sys.exit("--id chỉ dùng được khi chuyển đúng 1 file.")

    mon = a.subject.replace("-", "_")
    chuong = chuan_chuong(a.chapter)
    root = Path(a.root)
    co_loi = False

    for f in ds_file:
        print(f"\n== {f}")
        try:
            text = Path(f).read_text("utf-8-sig")
            bai_tap, dap_an, canh_bao = doc_de(text, f, a.id)
        except (OSError, ValueError) as e:
            print(f"  LỖI: {e}")
            co_loi = True
            continue

        tong = sum(c["diem"] for c in bai_tap["cau_hoi"])
        print(f"  Đề {bai_tap['id']} | độ khó {bai_tap['do_kho']} | {len(bai_tap['cau_hoi'])} mục | tổng {tong} điểm")
        for w in canh_bao:
            print(f"  ! {w}")

        if a.dry:
            print(json.dumps({"bai_tap": bai_tap, "dap_an": dap_an}, ensure_ascii=False, indent=2))
        else:
            p_fe, p_be = luu(root, mon, chuong, bai_tap, dap_an)
            print(f"  -> {p_fe}\n  -> {p_be}")

    sys.exit(1 if co_loi else 0)


if __name__ == "__main__":
    main()