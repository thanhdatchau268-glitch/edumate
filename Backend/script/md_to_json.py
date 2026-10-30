# -*- coding: utf-8 -*-
r"""
md_to_json.py - Chuyển file đề (.md) sang JSON cho web SaoLaEdu  (BẢN CHỊU ĐƯỢC NHIỀU DẠNG VIẾT)

Mỗi file .md = 1 đề (vd: đề 1.1, đề 1.2) và được tách thành 2 file JSON:
  - Frontend/file_de/<môn>/chuong-N/bai-NN.json   : đề (KHÔNG có đáp án, trình duyệt đọc được)
  - Backend/Dap_an/<môn>/chuong-N/bai-NN.json     : đáp án (chỉ server đọc)

Chạy nhiều đề của cùng 1 bài thì tự GỘP vào cùng file (đề trùng id sẽ bị ghi đè).

Đặt file này ở: Backend/script/md_to_json.py

Cách dùng (chạy ở bất kỳ thư mục nào):
    py md_to_json.py "bài_1.1_(1.0).md" "bài_1.2_(1.5).md" -s toan -c 1
    py md_to_json.py de/*.md -s toan -c 1
    py md_to_json.py de.md -s toan -c 1 --dry      # chỉ in ra màn hình, không ghi file

Những kiểu viết file .md bây giờ đều đọc được:
  * "* Độ khó:" / "*  Độ khó:" (nhiều dấu cách) / "- Độ khó:" / "**Độ khó:**" / "Độ khó:" (không dấu đầu dòng)
  * Đáp án trắc nghiệm viết mỗi đáp án 1 dòng HOẶC dính hết trên 1 dòng:  A. ... *B. ... C. ... D. ...
  * Dấu * đánh dấu đáp án đúng đứng sát chữ cái (*B.). Cũng nhận (✓) / (đúng) ở cuối đáp án,
    hoặc dòng riêng "* Đáp án đúng: B"
  * Đúng/sai viết mỗi ý 1 dòng HOẶC dính 1 dòng:  a) ... -> *Đúng* / Sai b) ... -> Đúng / *Sai*
  * Mũi tên "->", "→", "=>"; kết luận "*Đúng*", "**Đúng**", "[x] Đúng", "✓ Đúng"
  * Số câu "[Câu 1]", "Câu 1:", "### Câu 1", "**Câu 1.**"
  * Tiêu đề bài có hoặc không có dấu #, có hoặc không có "(ĐỀ 1.2)"
  * File lưu UTF-8 / UTF-8 BOM / UTF-16, chữ có dấu kiểu tổ hợp (Mac/Word)
  * LaTeX bị hỏng do copy qua AI/Word: \\ mất thành \ trong \begin{cases}, \neq thành "eq",
    \text thành "<tab>ext", \frac thành "rac", \times thành "imes"... đều được vá lại
"""
import argparse
import codecs
import glob
import html
import json
import re
import sys
import unicodedata
from pathlib import Path

# Backend/script/md_to_json.py -> đi lùi 2 cấp ra thư mục gốc dự án
ROOT = Path(__file__).resolve().parents[2]

# ---------- Điểm (tổng 1 đề = 100) ----------
DIEM_TRAC_NGHIEM = 2      # 25 câu x 2   = 50
DIEM_MOI_Y = 2.5          # 2 câu x 4 ý x 2.5 = 20 (mỗi ý đúng/sai tính như 1 câu nhỏ)
DIEM_TRA_LOI_NGAN = 6     # 5 câu x 6    = 30

# Câu đúng/sai có nhiều ý: True = chỉ ghi đề bài chung ở ý a, False = lặp đề bài ở mọi ý
CHI_GHI_DE_O_Y_A = True

# Các từ khóa đầu mục trong 1 câu (không phân biệt hoa/thường). Muốn nhận thêm cách gọi khác thì thêm vào đây.
TEN_KHOA = {
    "do_kho":   ["độ khó"],
    "de_bai":   ["đề bài", "nội dung câu hỏi", "câu hỏi", "đề"],
    "ngan":     ["đáp án chính xác", "đáp án đúng", "đáp số", "kết quả"],
    "dap_an":   ["các đáp án", "các lựa chọn", "lựa chọn", "phương án", "đáp án"],
    "y":        ["các ý lựa chọn", "ý lựa chọn", "các mệnh đề", "các ý", "mệnh đề"],
    "goi_y":    ["gợi ý"],
    "loi_giai": ["lời giải", "hướng dẫn giải", "giải thích", "hướng dẫn"],
    "diem":     ["điểm"],
}


# ======================================================================
# 1. Đọc file + làm sạch văn bản
# ======================================================================
def doc_file_md(path):
    """Đọc file .md, tự đoán encoding, giữ nguyên ký tự điều khiển để còn vá LaTeX."""
    data = Path(path).read_bytes()
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return data.decode("utf-16")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1258", errors="replace")


# Khi copy "\text", "\frac", "\alpha"... qua chỗ nào đó hiểu \t \f \a thành ký tự điều khiển
_DIEU_KHIEN = {"\x07": "a", "\x08": "b", "\x0b": "v", "\x0c": "f"}


def lam_sach(text):
    text = unicodedata.normalize("NFC", text)            # chữ Việt tổ hợp -> dựng sẵn
    text = text.replace("\r\n", "\n")
    # tab đứng trước đuôi lệnh LaTeX quen thuộc = "\t" bị biến thành tab
    text = re.sub(r"\t(?=(?:ext\{|imes\b|an\b|heta\b|riangle\b|frac\b|dfrac\b|au\b|ilde\b|o\b))",
                  lambda m: "\\t", text)
    text = re.sub(r"[\x07\x08\x0b\x0c](?=[A-Za-z])", lambda m: "\\" + _DIEU_KHIEN[m.group(0)], text)
    text = re.sub(r"\r(?=(?:ightarrow|ight|ho\b))", lambda m: "\\r", text)
    text = text.replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\u200b\u200c\u200d\ufeff]", "", text)
    text = text.replace("\u00a0", " ").replace("：", ":")
    return text


# Vùng công thức $...$ hoặc $$...$$
RE_TOAN = re.compile(r"\$\$.+?\$\$|\$[^$]+\$", re.S)

# Lệnh LaTeX bị mất dấu \ và chữ cái đầu (chỉ vá TRONG công thức)
_LATEX_MAT = [(re.compile(p), v) for p, v in [
    (r"(?<![\\A-Za-z])ext\{", "\\text{"),
    (r"(?<![\\A-Za-z])rac\{", "\\frac{"),
    (r"(?<![\\A-Za-z])imes(?![A-Za-z])", "\\times"),
    (r"(?<![\\A-Za-z])eq(?![A-Za-z])", "\\neq"),
    (r"(?<![\\A-Za-z])egin\{", "\\begin{"),
    (r"(?<![\\A-Za-z])ight(?=\s*[)\]|.}\\])", "\\right"),
    (r"(?<![\\A-Za-z])heta(?![A-Za-z])", "\\theta"),
    (r"(?<![\\A-Za-z])riangle(?![A-Za-z])", "\\triangle"),
    (r"(?<![\\A-Za-z])pprox(?![A-Za-z])", "\\approx"),
]]
_MOI_TRUONG_NHIEU_DONG = re.compile(r"\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|split|gathered)")


def _sua_toan(m):
    s = m.group(0)
    for rx, v in _LATEX_MAT:
        s = rx.sub(lambda _m, v=v: v, s)
    # "\\" bị mất 1 gạch trong cases/aligned:  "2x \ 3y"  ->  "2x \\ 3y"
    if _MOI_TRUONG_NHIEU_DONG.search(s):
        s = re.sub(r"(?<=\s)\\(?=\s)", lambda _m: "\\\\", s)
    return s


def sua_latex(s):
    return RE_TOAN.sub(_sua_toan, s)


def so(s):
    """'1.0' -> 1, '1,5' -> 1.5"""
    f = float(str(s).replace(",", "."))
    return int(f) if f.is_integer() else f


def xu_ly_chu(s):
    """Vá LaTeX, escape HTML (an toàn khi web dùng innerHTML) rồi đổi **chữ đậm** thành <b>.
    Công thức $...$ giữ nguyên, trình duyệt sẽ giải mã lại < > & trước khi KaTeX đọc."""
    s = sua_latex(s.strip())
    s = html.escape(s, quote=False)
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


def _che(s):
    """Thay công thức bằng \\x00 (cùng độ dài) để khi dò A. B. a) -> không dính vào trong công thức."""
    return RE_TOAN.sub(lambda m: "\x00" * len(m.group(0)), s)


# ======================================================================
# 2. Tách file thành các câu, tách mỗi câu thành các mục
# ======================================================================
RE_CAU_NGOAC = re.compile(r"\[\s*Câu\s*(\d+)\s*\]", re.I)
RE_CAU_DAU_DONG = re.compile(
    r"^[ \t]*(?:#{1,6}[ \t]*)?\**[ \t]*Câu[ \t]+(\d+)[ \t]*[.:)]?\**[ \t]*", re.M | re.I)

# Gặp các dòng này = hết phần của câu hiện tại (đường kẻ, tiêu đề #, "PHẦN I/II/III")
RE_CAT = re.compile(
    r"^[ \t]*(?:={3,}|-{3,}|\*{3,}|_{3,})[ \t]*$|^[ \t]*#{1,6}[ \t]|^[ \t]*\**[ \t]*PHẦN[ \t]+[IVX\d]+",
    re.M)

_TEN2KHOA = {t: k for k, ds in TEN_KHOA.items() for t in ds}
_TEN_RE = "|".join(re.escape(t).replace(r"\ ", r"[ \t]+") for t in sorted(_TEN2KHOA, key=len, reverse=True))
# Từ khóa nằm ở đầu dòng (có hoặc không dấu * - •), hoặc giữa dòng nhưng có dấu * - • đứng trước.
RE_KHOA = re.compile(
    r"(?:^[ \t]*[*\-•+]?[ \t]*|(?<=\s)[*\-•][ \t]*)\**[ \t]*(" + _TEN_RE + r")[ \t]*\**[ \t]*:[ \t]*"
    r"(?:\*{1,2}(?=\s))?[ \t]*", re.M | re.I)


def tach_cau(text):
    """Trả về ([(số câu, nội dung)], vị trí câu đầu tiên)"""
    ms = list(RE_CAU_NGOAC.finditer(text)) or list(RE_CAU_DAU_DONG.finditer(text))
    out = []
    for i, m in enumerate(ms):
        het = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        out.append((m.group(1), text[m.end():het]))
    return out, (ms[0].start() if ms else len(text))


def tach_muc(body):
    """Chia nội dung 1 câu thành các mục: do_kho, de_bai, dap_an, y, ngan... (mỗi mục là 1 chuỗi)"""
    cat = RE_CAT.search(body)
    if cat:
        body = body[:cat.start()]
    ms = list(RE_KHOA.finditer(body))
    muc = {}

    def them(khoa, v):
        v = " ".join(l.strip() for l in v.splitlines() if l.strip())
        if v:
            muc[khoa] = (muc[khoa] + " " + v) if khoa in muc else v

    them("_dau", body[:ms[0].start()] if ms else body)
    for i, m in enumerate(ms):
        khoa = _TEN2KHOA[re.sub(r"\s+", " ", m.group(1).lower())]
        them(khoa, body[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(body)])
    return muc


# ======================================================================
# 3. Đọc từng dạng câu
# ======================================================================
def tach_lua_chon(s):
    """'A. ... *B. ... C. ... D. ...' (1 dòng hay nhiều dòng đều được) -> [(chữ, đúng?)] hoặc None"""
    mask = _che(s)
    vt, pos = [], 0
    for ch in "ABCDEF":
        m = re.compile(rf"(?<![\w\\])(\*{{0,2}})\(?{ch}[.)](?=[\s\x00*]|$)").search(mask, pos)
        if not m:
            break
        vt.append(m)
        pos = m.end()
    if len(vt) < 2:
        return None
    kq = []
    for i, m in enumerate(vt):
        t = s[m.end(): vt[i + 1].start() if i + 1 < len(vt) else len(s)].strip()
        dung = len(m.group(1)) == 1                       # *B.  (đúng 1 dấu sao sát chữ cái)
        if len(m.group(1)) == 2:                          # **B. ...**  chỉ là in đậm
            t = re.sub(r"\*\*\s*$", "", t)
        t2 = re.sub(r"\s*(?:✓|✔|✅|☑|\(\s*đúng\s*\))\s*$", "", t, flags=re.I)
        if t2 != t:
            dung, t = True, t2
        t = re.sub(r"(?:^|\s)[*\-•]+\s*$", "", t)         # dấu đầu dòng của đáp án kế tiếp bị dính
        if t.endswith("*") and not t.startswith("*") and t.count("*") % 2:
            t = t[:-1]
        kq.append((t.strip(), dung))
    return kq


def tach_y(s):
    """'a) ... -> ... b) ... -> ...' -> [(chữ, nội dung)] hoặc None"""
    mask = _che(s)
    vt, pos = [], 0
    for ch in "abcdefgh":
        m = re.compile(rf"(?<![\w\\])\(?{ch}\)(?=[\s\x00*]|$)").search(mask, pos)
        if not m:
            break
        vt.append((ch, m))
        pos = m.end()
    if len(vt) < 2:
        return None
    return [(ch, s[m.end(): vt[i + 1][1].start() if i + 1 < len(vt) else len(s)].strip())
            for i, (ch, m) in enumerate(vt)]


def tach_ket_luan(t):
    """Tách 1 ý đúng/sai thành (nội dung ý, phần kết luận)"""
    mask = _che(t)
    muc = list(re.finditer(r"->|→|=>|⇒|⟶", mask))
    if muc:
        m = muc[-1]
        return t[:m.start()].strip(), t[m.end():].strip()
    m = re.search(r"[\s(\[:\-–]*\*+\s*(?:Đúng|Sai|True|False)\s*\*+", mask, re.I)
    if not m:
        m = re.search(r"[\s:\-–(\[]+(?:Đúng|Sai)\s*[)\]]?\s*$", mask, re.I)
    if m:
        return t[:m.start()].strip(), t[m.start():].strip()
    return t.strip(), ""


def doc_kq_ds(kq):
    """'*Đúng* / Sai' -> True ; 'Đúng / *Sai*' -> False ; không rõ -> None"""
    k = kq.strip()
    d = re.findall(r"(?:\[\s*[xX✓✔]\s*\]|[✓✔☑✅])\s*(Đúng|Sai|True|False)", k, re.I)
    if len(d) != 1:
        d = re.findall(r"\*+\s*(Đúng|Sai|True|False)\s*\*+", k, re.I)
    if len(d) != 1:
        t = re.findall(r"\b(Đúng|Sai|True|False)\b", k, re.I)      # chỉ ghi 1 chữ, vd "Đúng"
        if len(t) == 1:
            d = t
    if len(d) != 1:
        return None
    return d[0].lower() in ("đúng", "true")


def lam_sach_dap_an_ngan(s):
    s = s.strip().strip("`").strip()
    s = re.sub(r"^\*+|\*+$", "", s).strip()
    m = re.fullmatch(r"\$(.+)\$", s)
    if m:
        s = m.group(1).strip()
    return re.sub(r"(?<=\d)[.;]$", "", s)


def trac_nghiem(num, de, lc, ngan, diem):
    dung = [i for i, (_, d) in enumerate(lc) if d]
    if not dung and ngan:                                         # "* Đáp án đúng: B"
        m = re.search(r"(?<![A-Za-z])([A-F])(?![A-Za-z])", ngan.upper())
        if m and "ABCDEF".index(m.group(1)) < len(lc):
            dung = ["ABCDEF".index(m.group(1))]
    if len(dung) != 1:
        raise ValueError(f"cần đúng 1 đáp án đánh dấu * (hoặc có dòng 'Đáp án đúng: B'), đang có {len(dung)}")
    if any(not t for t, _ in lc):
        raise ValueError("có đáp án để trống")
    cau = {"id": str(num), "type": "trac-nghiem", "de_bai": xu_ly_chu(de),
           "dap_an": [xu_ly_chu(t) for t, _ in lc],
           "diem": DIEM_TRAC_NGHIEM if diem is None else diem}
    return [(cau, dung[0])]  # dap_an_dung = vị trí đáp án (0 = A, 1 = B...)


def dung_sai(num, de, s, diem, cb):
    items = tach_y(s)
    if not items:
        raise ValueError("không tách được các ý a), b), c)...")
    if len(items) != 4:
        cb.append(f"Câu {num}: có {len(items)} ý a), b)... (thường là 4).")
    d_moi = DIEM_MOI_Y if diem is None else round(diem / len(items), 2)
    de_chung = xu_ly_chu(de)
    out = []
    for chu, nd in items:
        stmt, vd = tach_ket_luan(nd)
        v = doc_kq_ds(vd)
        if v is None:
            raise ValueError(f"ý {chu}) không xác định được Đúng/Sai (cần dạng '-> *Đúng* / Sai'): {vd[:40]!r}")
        de_y = f"<b>{chu})</b> {xu_ly_chu(stmt)}"
        if chu == "a" or not CHI_GHI_DE_O_Y_A:
            de_y = f"{de_chung}<br>{de_y}"
        out.append(({"id": f"{num}{chu}", "type": "dung-sai", "de_bai": de_y, "diem": d_moi}, v))
    return out


def tra_loi_ngan(num, de, ngan, diem):
    dap_an = lam_sach_dap_an_ngan(ngan)
    if not dap_an:
        raise ValueError("thiếu đáp án chính xác")
    cau = {"id": str(num), "type": "tra-loi-ngan", "de_bai": xu_ly_chu(de),
           "diem": DIEM_TRA_LOI_NGAN if diem is None else diem}
    return [(cau, dap_an)]


def doc_mot_cau(num, body, cb):
    """Trả về (danh sách (câu, đáp án), độ khó, gợi ý, lời giải)"""
    m = tach_muc(body)
    if "de_bai" not in m and m.get("_dau"):                       # có chữ nhưng quên ghi "Đề bài:"
        m["de_bai"] = m["_dau"]
    if "de_bai" not in m:
        raise ValueError("thiếu '* Đề bài:'")
    de, dap, ngan = m["de_bai"], m.get("dap_an", ""), m.get("ngan", "")

    diem = None
    if "diem" in m:
        mm = re.search(r"\d+(?:[.,]\d+)?", m["diem"])
        diem = so(mm.group(0)) if mm else None
    do_kho = None
    if "do_kho" in m:
        mm = re.search(r"\d+(?:[.,]\d+)?", m["do_kho"])
        do_kho = so(mm.group(0)) if mm else None

    if "y" in m:
        ds = dung_sai(num, de, m["y"], diem, cb)
    else:
        lc = tach_lua_chon(dap) if dap else None
        y = None if lc else (tach_y(dap) if dap else None)
        if lc:
            ds = trac_nghiem(num, de, lc, ngan, diem)
        elif y:
            ds = dung_sai(num, de, dap, diem, cb)
        elif ngan or dap:
            ds = tra_loi_ngan(num, de, ngan or dap, diem)
        else:
            raise ValueError("không nhận ra dạng câu (thiếu Đáp án / Các ý lựa chọn / Đáp án chính xác)")
    return ds, do_kho, m.get("goi_y"), m.get("loi_giai")


# ======================================================================
# 4. Đọc cả 1 file đề
# ======================================================================
def doc_de(text, ten_file, id_cli=None):
    """Trả về (bai_tap_cho_frontend, dap_an_cho_backend, danh_sach_canh_bao)"""
    canh_bao, loi = [], []
    text = lam_sach(text)
    cac_cau, vt_dau = tach_cau(text)
    dau = text[:vt_dau]          # phần tiêu đề, trước câu đầu tiên

    # --- tiêu đề + id đề (ưu tiên: --id > "(ĐỀ 1.2)" trong file > tên file) ---
    h = re.search(r"^[ \t]*(?:#+[ \t]*)?\**[ \t]*BÀI[ \t]+(\d+)[ \t]*[:.\-–—][ \t]*(.+?)\**[ \t]*$",
                  dau, re.M | re.I)
    tieu_de = h.group(2) if h else ""
    m_de = re.search(r"ĐỀ[ \t]*(\d+[.,]\d+)", dau, re.I)
    m_file = re.search(r"(\d+)[._](\d+)", Path(ten_file).stem)
    if id_cli:
        bai_id = id_cli
    elif m_de:
        bai_id = m_de.group(1).replace(",", ".")
    elif m_file:
        bai_id = f"{m_file.group(1)}.{m_file.group(2)}"
    elif h:
        bai_id = f"{h.group(1)}.1"
    else:
        raise ValueError("Không xác định được id đề. Hãy thêm --id, ví dụ --id 1.1")

    ten = re.sub(r"\(\s*ĐỀ[^)]*\)", "", tieu_de, flags=re.I).strip().lower().capitalize()

    # --- độ khó chung ---
    m = re.search(r"Độ khó chung[\s*]*:[\s*]*(\d+(?:[.,]\d+)?)", dau, re.I)
    if m:
        do_kho = so(m.group(1))
    else:
        mf = re.search(r"\((\d+(?:[._,]\d+)?)\)", Path(ten_file).stem)
        do_kho = so(mf.group(1).replace("_", ".")) if mf else None

    cau_hoi, dap_an = [], {}
    do_kho_cau_dau = None

    for num, body in cac_cau:
        try:
            ds, dk, goi_y, loi_giai = doc_mot_cau(num, body, canh_bao)
            if do_kho_cau_dau is None and dk is not None:
                do_kho_cau_dau = dk
            for cau, dung in ds:
                if cau["id"] in dap_an:
                    canh_bao.append(f"Câu {cau['id']} bị trùng số, câu sau ghi đè câu trước.")
                if goi_y:
                    cau["goi_y"] = xu_ly_chu(goi_y)
                cau_hoi.append(cau)
                dap_an[cau["id"]] = {
                    "dap_an_dung": dung,
                    "diem": cau["diem"],
                    "loi_giai": xu_ly_chu(loi_giai) if loi_giai else "",
                }
        except Exception as e:  # lỗi 1 câu không làm sập cả file: gom lại báo hết một lượt
            loi.append(f"Câu {num}: {e}" if isinstance(e, ValueError) else f"Câu {num}: lỗi lạ ({type(e).__name__}: {e})")

    if not cau_hoi and not loi:
        loi.append("Không tìm thấy câu nào (file cần có các dòng '[Câu 1]', '[Câu 2]'... hoặc 'Câu 1:')")
    if loi:
        raise ValueError("\n  ".join(loi))

    tong = sum(c["diem"] for c in cau_hoi)
    if abs(tong - 100) > 1e-9:
        canh_bao.append(f"Tổng điểm đề là {tong}, không phải 100. Kiểm tra lại số câu / hằng số DIEM_*.")

    bai_tap = {"id": bai_id, "do_kho": do_kho if do_kho is not None else (do_kho_cau_dau or 1),
               "ten": ten, "cau_hoi": cau_hoi}
    return bai_tap, dap_an, canh_bao


# ======================================================================
# 5. Ghi file (gộp với file có sẵn)
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
    ap = argparse.ArgumentParser(description="Chuyển file đề .md sang JSON cho SaoLaEdu")
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
            bai_tap, dap_an, canh_bao = doc_de(doc_file_md(f), f, a.id)
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