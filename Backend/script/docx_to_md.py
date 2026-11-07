# -*- coding: utf-8 -*-
r"""
docx_to_md.py - Chuyển file Word (.docx) sang file .md đúng định dạng của md_to_lythuyet.py và md_to_json.py

Đặt file này ở: Backend/script/docx_to_md.py     (cần:  pip install python-docx)

HAI CHẾ ĐỘ
  1) ly-thuyet : mỗi file docx = lý thuyết 1 bài học
       -> ly_thuyet/<môn>/chuong-N/bai-NN.md          (rồi chạy md_to_lythuyet.py)
  2) de        : file docx bài tập (nhiều phần) -> TÁCH thành nhiều đề nhỏ, mỗi đề 1 file
       -> de/<môn>/chuong-N/bai_<bài>.<k>.md           (rồi chạy md_to_json_all.py)

CÁCH DÙNG (chạy ở Backend/script)
    py docx_to_md.py ly-thuyet "LÝ_THUYẾT_VĂN_9_-_BÀI_1.docx" "LÝ_THUYẾT_VĂN_9_-_BÀI_2.docx" -s ngu_van -c 1
    py docx_to_md.py de "BÀI_TẬP_VĂN_9_-_BÀI_2.docx" -s ngu_van -c 1
    thêm --dry để chỉ in ra màn hình, không ghi file

QUY ƯỚC ĐỌC FILE ĐỀ (docx)
  - Đáp án đúng của câu trắc nghiệm = chữ được TÔ MÀU (highlight).
  - Bảng Đúng/Sai: cột "Đúng" ghi Đ, cột "Sai" ghi S.
  - "Câu N:" (có dấu hai chấm, không có chữ) + "Đọc ngữ liệu sau" = một đề riêng có bài đọc (ngữ liệu).
  - Phần "GỢI Ý ÔN TẬP" ở cuối được gắn vào từng câu (trường Gợi ý).
Dạng câu mà web chưa có, script đổi như sau:
  - Nhiều phương án đúng (tô vàng >= 2 đáp án)  -> câu Đúng/Sai (mỗi phương án 1 ý)
  - Điền chỗ trống (1) ____ (đáp án tô vàng/...)  -> mỗi chỗ trống 1 câu trắc nghiệm (đáp án được xáo trộn)
  - Nối cột A - cột B -> câu trả lời ngắn, NHƯNG chỉ khi cột giữa của bảng có điền đáp án (vd 3, 1, 4, 2).
    Bảng nối chưa có đáp án thì bỏ qua và ghi vào file _can_xu_ly.txt để anh/chị tự xử lý.
Điểm mỗi đề được chia để tổng = 100 (câu Đúng/Sai nặng gấp đôi câu trắc nghiệm).
"""
import argparse
import glob
import random
import re
import sys
import unicodedata
from pathlib import Path

try:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph
except ImportError:
    sys.exit("Thiếu thư viện python-docx. Hãy chạy:  pip install python-docx")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    ROOT = Path(__file__).resolve().parents[2]      # Backend/script/x.py -> thư mục gốc dự án
except IndexError:
    ROOT = Path.cwd()

CHU_CAI = "abcdđeêghk"          # chữ cái đánh ý trong tiếng Việt (đ, ê cũng được dùng)
TEN_CD = {"vh": "Tri thức Văn học", "tv": "Tri thức Tiếng Việt"}


# ======================================================================
# 1. Đọc docx: duyệt khối, đọc chữ + định dạng
# ======================================================================
def khoi(doc):
    """Duyệt thân tài liệu theo đúng thứ tự: đoạn văn và bảng."""
    for el in doc.element.body.iterchildren():
        if el.tag.endswith("}p"):
            yield Paragraph(el, doc)
        elif el.tag.endswith("}tbl"):
            yield Table(el, doc)


def cac_run(p):
    for it in p.iter_inner_content():
        if hasattr(it, "runs"):          # liên kết (hyperlink)
            yield from it.runs
        else:
            yield it


def doan(p):
    """Đoạn văn -> [(chữ, đậm, nghiêng, tô_vàng)], đã gộp các run giống nhau."""
    out = []
    for r in cac_run(p):
        t = r.text.replace("\t", " ")
        if not t:
            continue
        k = (bool(r.bold), bool(r.italic), r.font.highlight_color is not None)
        if out and out[-1][1] == k:
            out[-1][0] += t
        else:
            out.append([t, k])
    return [(t, *k) for t, k in out]


def tach_dong(segs):
    """Cắt 1 đoạn thành nhiều dòng tại chỗ xuống dòng mềm (Shift+Enter)."""
    out = [[]]
    for t, b, i, h in segs:
        for k, pt in enumerate(t.split("\n")):
            if k:
                out.append([])
            if pt:
                out[-1].append((pt, b, i, h))
    return [d for d in out if van(d)]


def van(segs):
    return "".join(s[0] for s in segs).strip()


def co_vang(segs):
    return any(s[3] and s[0].strip() for s in segs)


def md_dong(segs):
    """[(chữ, đậm, nghiêng, vàng)] -> chữ Markdown (**đậm**, *nghiêng*)."""
    s = ""
    for t, b, i, _ in segs:
        t = t.replace("\n", " ")
        core = t.strip()
        if not core:
            s += t
            continue
        lead, trail = t[:len(t) - len(t.lstrip())], t[len(t.rstrip()):]
        mk = "**" if b else "*" if i else ""
        s += lead + mk + core + mk + trail
    return re.sub(r" {2,}", " ", s).strip()


def hang_o(row):
    """Các ô của 1 hàng, bỏ ô lặp do gộp ô."""
    cells = []
    for c in row.cells:
        if not any(c._tc is x._tc for x in cells):
            cells.append(c)
    return cells


def kieu_list(p):
    """(cấp, 'ul'|'ol') nếu đoạn là mục danh sách, ngược lại None."""
    pPr = p._p.pPr
    if pPr is None or pPr.numPr is None:
        return None
    n = pPr.numPr
    lvl = int(n.ilvl.val) if n.ilvl is not None else 0
    numid = n.numId.val if n.numId is not None else None
    if not numid:
        return None
    kieu, fmt = "ul", "bullet"
    try:
        el = p.part.numbering_part.element
        absid = el.xpath(f'w:num[@w:numId="{numid}"]/w:abstractNumId/@w:val')[0]
        fm = el.xpath(f'w:abstractNum[@w:abstractNumId="{absid}"]/w:lvl[@w:ilvl="{lvl}"]/w:numFmt/@w:val')
        if fm:
            fmt = fm[0]
        if fm and fm[0] not in ("bullet", "none"):
            kieu = "ol"
    except Exception:
        pass
    kieu_list.fmt = fmt          # kiểu đánh số của đoạn vừa hỏi (lowerLetter, upperLetter, decimal...)
    return lvl, kieu


def so_bai_tu_ten(ten_file):
    s = unicodedata.normalize("NFC", Path(ten_file).stem)
    m = re.search(r"B[ÀA]I[\s_\-.]*(\d+)", s, re.I)
    return int(m.group(1)) if m else None


# ======================================================================
# 2. LÝ THUYẾT: docx -> md
# ======================================================================
RE_TIEU_DE = re.compile(r"^ÔN TẬP KIẾN THỨC BÀI\s*(\d+)", re.I)
RE_LA_MA = re.compile(r"^[IVX]+\s*/")
RE_MUC = re.compile(r"^\d+\.\d+\s*/")


class LyThuyet:
    def __init__(self, bai):
        self.out, self.bai = [], bai
        self.cho_tieu_de = False
        self.kind = None            # loại dòng cuối: 'list' | 'quote' | 'p' | None
        self.dem = {}               # đếm số thứ tự danh sách đánh số theo cấp
        self.canh_bao = []

    def trang(self):
        if self.out and self.out[-1] != "":
            self.out.append("")

    def them_doan(self, p, dau_o=False):
        segs = doan(p)
        plain = van(segs).replace("\n", " ")
        if "$" in plain:
            self.canh_bao.append(f"Có dấu $ trong «{plain[:40]}», có thể bị hiểu là công thức.")
        if not plain:
            self.kind = None
            return
        m = RE_TIEU_DE.match(plain)
        if m:
            self.bai, self.cho_tieu_de = int(m.group(1)), True
            return
        if self.cho_tieu_de:                               # dòng ngay sau "ÔN TẬP KIẾN THỨC BÀI N" = tên bài
            self.trang()
            self.out += [f"# Bài {self.bai}: {plain}", ""]
            self.cho_tieu_de, self.kind = False, None
            return
        if RE_LA_MA.match(plain):
            self.trang(); self.out += [f"## {plain}", ""]; self.kind = None; return
        if RE_MUC.match(plain):
            self.trang(); self.out += [f"### {plain}", ""]; self.kind = None; return
        if dau_o and not kieu_list(p):                     # dòng tiêu đề trong khung 1 ô (Yêu cầu cần đạt)
            self.trang(); self.out += [f"### {plain}", ""]; self.kind = None; return

        kl = kieu_list(p)
        if kl:
            lv, kieu = kl
            if self.kind != "list":
                self.trang()
                self.dem = {}
            for k in [k for k in self.dem if k > lv]:
                del self.dem[k]
            self.dem[lv] = self.dem.get(lv, 0) + 1
            dau = "-" if kieu == "ul" else f"{self.dem[lv]}."
            self.out.append("  " * lv + f"{dau} {md_dong(segs)}")
            self.kind = "list"
            return

        ind = p.paragraph_format.left_indent
        if ind and ind > 0 and all(s[2] for s in segs if s[0].strip()):     # đoạn thụt lề toàn chữ nghiêng = trích dẫn / thơ
            if self.kind != "quote":
                self.trang()
            else:
                self.out.append(">")
            self.out.append("> " + md_dong(segs))
            self.kind = "quote"
            return

        self.trang()
        self.out += [md_dong(segs), ""]
        self.kind = "p"

    def them_bang(self, t):
        rows = [hang_o(r) for r in t.rows]
        if not rows:
            return
        self.trang()
        if all(len(r) == 1 for r in rows):                 # khung 1 cột (vd "Yêu cầu cần đạt"): giữ nội dung như đoạn thường
            dau = True
            for r in rows:
                for p in r[0].paragraphs:
                    co_chu = bool(van(doan(p)))
                    self.them_doan(p, dau_o=dau and co_chu)
                    dau = dau and not co_chu
            self.trang(); self.kind = None
            return
        ncot = len(rows[0])

        def o(c):
            ds = [md_dong(doan(p)) for p in c.paragraphs]
            return " <br> ".join(x for x in ds if x).replace("|", "/")

        for i, r in enumerate(rows):
            cs = [o(c) for c in r][:ncot]
            cs += [""] * (ncot - len(cs))
            self.out.append("| " + " | ".join(cs) + " |")
            if i == 0:
                self.out.append("|" + "|".join(["---"] * ncot) + "|")
        self.out.append("")
        self.kind = None


def chuyen_ly_thuyet(doc, bai):
    lt = LyThuyet(bai)
    for b in khoi(doc):
        if isinstance(b, Table):
            lt.them_bang(b)
        else:
            lt.them_doan(b)
    text = "\n".join(lt.out).strip() + "\n"
    return text, lt.bai, lt.canh_bao


# ======================================================================
# 3. ĐỀ: docx -> nhiều file md
# ======================================================================
RE_CD = re.compile(r"^(?:[IVX]+\s*[./]\s*)?TRI THỨC\s+(VĂN HỌC|TIẾNG VIỆT)\s*$", re.I)
RE_PHAN = re.compile(r"^Phần\s+(I{1,3}|IV|V)(?=[\s.:\-–])\s*[.:\-–]*\s*(.*)$", re.I)
RE_GOI_Y = re.compile(r"^GỢI Ý", re.I)
RE_NHOM = re.compile(r"^Câu\s+(\d+)\s*:\s*$")
RE_CAU = re.compile(r"^Câu\s+(\d+)\s*[.:]\s*(.*)$")
RE_DOC = re.compile(r"^Đọc\s+(văn bản|ngữ liệu)", re.I)
RE_HET_DOC = re.compile(r"^(Trả lời|Thực hiện)", re.I)
RE_PHU = re.compile(r"^([a-zđêgh])\)\s*(.*)$")
RE_LC = re.compile(r"^([A-F])\s*[.)]\s*(.*)$")
RE_TRONG = re.compile(r"\(\s*(\d+)\s*\)\s*[_…]{2,}\s*\(([^()]*)\)")


def ma_cd(s):
    return "vh" if "VĂN HỌC" in s.upper() else "tv"


class PhanTich:
    """Đọc tuần tự các dòng của docx, gom thành: danh sách đề + gợi ý."""

    def __init__(self):
        self.des, self.hint = [], {}
        self.cd = self.phan = None
        self.ten_phan = ""
        self.de = self.cau = None
        self.in_doc = False
        self.hint_mode = False
        self.h = {"cd": None, "phan": None, "nhom": None, "ro": False}
        self.canh_bao = []

    # ---- quản lý đề / câu ----
    def moi_de(self, nhom=None):
        self.de = {"cd": self.cd, "phan": self.phan, "ten_phan": self.ten_phan, "nhom": nhom, "tp": [], "cau": []}

    def dong_cau(self):
        if self.cau is not None and self.de is not None:
            self.de["cau"].append(self.cau)
        self.cau = None

    def dong_de(self):
        self.dong_cau()
        if self.de is not None and self.de["cau"]:
            self.des.append(self.de)
        self.de, self.in_doc = None, False

    def moi_cau(self, so, phu=None, dong=None):
        self.dong_cau()
        if self.de is None:
            self.moi_de()
        self.cau = {"so": so, "phu": phu, "stem": [], "opts": [], "bang": None}
        if dong:
            self.cau["stem"].append(dong)

    # ---- bảng ----
    def bang(self, t):
        if self.in_doc and self.de is not None:                      # bảng trong ngữ liệu = bài thơ chia cột
            for r in t.rows:
                for c in hang_o(r):
                    for p in c.paragraphs:
                        for d in tach_dong(doan(p)):
                            self.de["tp"].append(van(d))
                    self.de["tp"].append("")
        elif self.cau is not None:
            self.cau["bang"] = t

    # ---- gợi ý (cuối file) ----
    def goi_y(self, plain):
        h = self.h
        if len(plain) < 80 and RE_CD.match(plain):
            h["cd"], h["ro"] = ma_cd(plain), True
            return
        m = RE_PHAN.match(plain)
        if m:
            phan = m.group(1).upper()
            if h["cd"] is None:
                h["cd"] = "vh"
            elif phan == "I" and h["phan"] == "II" and not h["ro"]:     # không có tiêu đề chủ đề thì đoán: hết phần II là sang chủ đề kế
                h["cd"] = "tv" if h["cd"] == "vh" else "vh"
            h["phan"], h["nhom"], h["ro"] = phan, None, False
            return
        m = re.match(r"^Câu\s+(\d+)\s*[.:]\s*Văn bản\b", plain, re.I)
        if m:
            h["nhom"] = m.group(1)
            return
        m = RE_CAU.match(plain)
        if m:
            h["nhom"] = None
            self.hint[(h["cd"], h["phan"], None, m.group(1))] = m.group(2).strip()
            return
        m = RE_PHU.match(plain)
        if m and h["nhom"]:
            self.hint[(h["cd"], h["phan"], h["nhom"], m.group(1))] = m.group(2).strip()

    # ---- một dòng chữ ----
    def dong(self, segs, auto=False):
        plain = van(segs)
        if RE_GOI_Y.match(plain):
            self.dong_de()
            self.hint_mode = True
            return
        if self.hint_mode:
            self.goi_y(plain)
            return
        if len(plain) < 60 and RE_CD.match(plain):
            self.dong_de()
            c = ma_cd(plain)
            self.cd, self.phan = c, None
            return
        m = RE_PHAN.match(plain)
        if m:
            self.dong_de()
            phan = m.group(1).upper()
            if self.phan == "II" and phan == "I" and self.cd:        # phòng khi thiếu tiêu đề chủ đề
                pass
            self.phan, self.ten_phan = phan, m.group(2).strip()
            self.moi_de()
            return
        if RE_NHOM.match(plain):
            self.dong_de()
            self.moi_de(nhom=RE_NHOM.match(plain).group(1))
            return
        if self.in_doc:
            if RE_HET_DOC.match(plain):
                self.in_doc = False
            else:
                self.de["tp"].append(plain)
                self.de["tp"].append("")
            return
        if RE_DOC.match(plain) and self.de is not None and self.cau is None:
            self.in_doc = True
            return
        m = RE_CAU.match(plain)
        if m:
            self.moi_cau(m.group(1), dong=[(m.group(2), False, False, False)] if m.group(2) else None)
            return
        if auto == "lowerLetter" and self.de is not None and self.de["nhom"] is not None:
            truoc = self.cau["phu"] if self.cau and self.cau["phu"] in CHU_CAI else None
            phu = CHU_CAI[CHU_CAI.index(truoc) + 1] if truoc and truoc != CHU_CAI[-1] else "a"
            self.moi_cau(self.de["nhom"], phu=phu, dong=segs)
            return
        m = RE_PHU.match(plain)
        if m and self.de is not None and self.de["nhom"] is not None:
            self.moi_cau(self.de["nhom"], phu=m.group(1), dong=[(m.group(2), False, False, False)] if m.group(2) else None)
            return
        if self.cau is None:
            return
        m = RE_LC.match(plain)
        if m:
            self.cau["opts"].append([m.group(2).strip(), co_vang(segs)])
        elif auto:                                                   # đáp án A. B. C. do Word tự đánh số (không có chữ A. trong văn bản)
            self.cau["opts"].append([plain, co_vang(segs)])
        elif self.cau["opts"]:
            self.cau["opts"][-1][0] += " " + plain                   # đáp án xuống dòng
        else:
            self.cau["stem"].append(segs)


def doc_de(doc):
    pt = PhanTich()
    for b in khoi(doc):
        if isinstance(b, Table):
            pt.bang(b)
        else:
            auto = kieu_list(b) and kieu_list.fmt
            for d in tach_dong(doan(b)):
                pt.dong(d, auto or False)
    pt.dong_de()
    return pt


# ---------- tách bài đọc (ngữ liệu) ----------
def lam_tac_pham(tp):
    """tp = các dòng của ngữ liệu -> {ten, tac_gia, noi_dung(list dòng)} hoặc None."""
    nz = [i for i, l in enumerate(tp) if l]
    if len(nz) < 2:
        return None
    dong = [tp[i] for i in nz]
    ten = dong[0]
    bd = 1
    if re.fullmatch(r"\(\s*Trích\s*\)", dong[1], re.I):
        ten += " (Trích)"
        bd = 2
    j = len(dong) - 1
    while j >= bd and not dong[j].startswith("("):
        j -= 1
    tac_gia, kt = "", len(tp)
    if j >= bd and dong[-1].endswith(")"):
        tac_gia = " ".join(dong[j:]).strip().strip("()").strip()
        kt = nz[j]
    # lấy phần thân theo vị trí gốc để giữ dòng trống giữa các khổ / đoạn
    than = tp[nz[bd]:kt] if bd < len(nz) else []
    while than and not than[-1]:
        than.pop()
    return {"ten": ten, "tac_gia": tac_gia, "noi_dung": than}


# ---------- đổi từng câu sang câu của web ----------
def ghep_de(dongs):
    """Ghép các dòng của đề bài. Các dòng nằm trong dấu ngoặc kép (trích thơ) nối bằng ' / '."""
    s, mo = "", False
    for d in dongs:
        t = van(d)
        if not t:
            continue
        s += (" / " if mo else " ") + t if s else t
        if (t.count('"') + t.count("“") + t.count("”")) % 2:
            mo = not mo
    return s.strip()


def sach_so(s):
    return re.sub(r"^\s*(?:[a-zđêgh]|\d+)\s*[.)]\s*", "", s.strip())


def bo_ky_hieu(s):
    return re.sub(r"\s+", " ", s.replace("\n", " ")).strip()


def chuyen_cau(cau, de, goi_y, bai, k0, bo_qua, canh_bao):
    """Trả về list các câu: {loai, de, opts|ys|dap_an, goi_y, w}. Không chuyển được -> ghi vào bo_qua."""
    nhan = f"Câu {cau['so']}" + (f"{cau['phu']})" if cau["phu"] else "")
    stem = ghep_de(cau["stem"])
    ket = []

    if cau["bang"] is not None:
        rows = [hang_o(r) for r in cau["bang"].rows]
        dau = [c.text.strip().upper() for c in rows[0]]
        if any("CỘT A" in h for h in dau):                                  # ---- NỐI ----
            trai = [sach_so(r[0].text) for r in rows[1:]]
            phai = [sach_so(r[-1].text) for r in rows[1:]]
            giua = [re.sub(r"\D", "", r[1].text) if len(r) > 2 else "" for r in rows[1:]]
            mo_ta = (f"{stem} Cột A: " + "; ".join(f"{CHU_CAI[i]}) {t}" for i, t in enumerate(trai))
                     + ". Cột B: " + "; ".join(f"{i + 1}. {t}" for i, t in enumerate(phai))
                     + f". Nhập {len(trai)} số liền nhau, theo thứ tự a, b, c...")
            if all(giua):
                ket.append({"loai": "tln", "de": bo_ky_hieu(mo_ta), "dap_an": "".join(giua), "w": 2})
            else:
                bo_qua.append(f"[{nhan}] NỐI chưa có đáp án (cột giữa của bảng đang trống): {bo_ky_hieu(mo_ta)}")
        else:                                                                  # ---- ĐÚNG / SAI ----
            ys, loi = [], False
            for r in rows[1:]:
                if len(r) < 3:
                    continue
                d, s = r[1].text.strip(), r[2].text.strip()
                if bool(d) == bool(s):
                    loi = True
                    break
                ys.append((bo_ky_hieu(sach_so(r[0].text)), bool(d)))
            if loi or len(ys) < 2 or len(ys) > len(CHU_CAI[:8]):
                bo_qua.append(f"[{nhan}] bảng Đúng/Sai không đọc được (mỗi hàng phải có đúng 1 ô Đ hoặc S).")
            else:
                ket.append({"loai": "ds", "de": stem, "ys": ys, "w": 2})
    elif any(RE_TRONG.search(van(d)) for d in cau["stem"]):                    # ---- ĐIỀN CHỖ TRỐNG ----
        huong = ghep_de([d for d in cau["stem"] if not RE_TRONG.search(van(d))])
        for d in cau["stem"]:
            s = "".join(x[0] for x in d)
            if not RE_TRONG.search(s):
                continue
            co = []
            for x in d:
                co += [x[3] and not ch.isspace() for ch in x[0]]
            moi = RE_TRONG.sub(lambda mm: f"({mm.group(1)}) ______", s).strip()
            for m in RE_TRONG.finditer(s):
                phuong_an = []
                for mm in re.finditer(r"[^/]+", m.group(2)):
                    a, b = m.start(2) + mm.start(), m.start(2) + mm.end()
                    if mm.group().strip():
                        phuong_an.append([mm.group().strip(), any(co[a:b])])
                if sum(1 for _, dung in phuong_an if dung) != 1:
                    bo_qua.append(f"[{nhan}] chỗ trống ({m.group(1)}) cần đúng 1 phương án tô vàng.")
                    continue
                random.Random(f"{bai}|{k0}|{cau['so']}|{m.group(1)}").shuffle(phuong_an)   # đáp án đúng luôn đứng đầu nên phải xáo
                de_bai = f"{huong} {moi} Chọn đáp án điền vào chỗ trống ({m.group(1)})."
                ket.append({"loai": "tn", "de": bo_ky_hieu(de_bai), "opts": [(t, d_) for t, d_ in phuong_an], "w": 1})
    elif cau["opts"]:                                                          # ---- TRẮC NGHIỆM / NHIỀU ĐÁP ÁN ----
        opts = [(bo_ky_hieu(t), d) for t, d in cau["opts"]]
        n_dung = sum(1 for _, d in opts if d)
        if len(opts) < 2:
            bo_qua.append(f"[{nhan}] chỉ có {len(opts)} đáp án.")
        elif n_dung == 0:
            bo_qua.append(f"[{nhan}] chưa tô màu đáp án đúng.")
        elif n_dung == 1 and len(opts) <= 6:
            ket.append({"loai": "tn", "de": stem, "opts": opts, "w": 1})
        elif n_dung >= 2 and len(opts) <= 8:
            ket.append({"loai": "ds", "de": stem + " Xác định từng phương án đúng hay sai.", "ys": opts, "w": 2})
        else:
            bo_qua.append(f"[{nhan}] quá nhiều đáp án.")
    else:
        if stem:
            bo_qua.append(f"[{nhan}] không nhận ra dạng câu: {stem[:70]}")
    for c in ket:
        c["goi_y"] = goi_y
        c["nhan"] = nhan
    return ket


def md_cau(n, c):
    L = [f"[Câu {n}]", f"* Điểm: {c['diem']:g}", f"* Đề bài: {c['de']}"]
    if c["loai"] == "tn":
        L.append("* Các đáp án:")
        for k, (t, d) in enumerate(c["opts"]):
            L.append(("*" if d else "") + "ABCDEF"[k] + ". " + t)
    elif c["loai"] == "ds":
        L.append("* Các ý lựa chọn:")
        for k, (t, d) in enumerate(c["ys"]):
            L.append(f"{'abcdefgh'[k]}) {t} -> {'*Đúng*' if d else '*Sai*'}")
    else:
        L.append(f"* Đáp án chính xác: {c['dap_an']}")
    if c.get("goi_y"):
        L.append(f"* Gợi ý: {c['goi_y']}")
    return "\n".join(L)


def md_de(de, bai, k, items, do_kho):
    ten_phan = de["ten_phan"].lower().capitalize() if de["ten_phan"] else ""
    tp = lam_tac_pham(de["tp"]) if de["tp"] else None
    ten = TEN_CD.get(de["cd"], "")
    ten += (": " if ten and ten_phan else "") + ten_phan
    if tp:
        ten += f" - {tp['ten'].title()}" if ten else tp["ten"].title()
    L = [f"# BÀI {bai}: {ten or 'Đề ôn tập'} (ĐỀ {bai}.{k})", f"* Độ khó chung: {do_kho:g}", ""]
    if tp:
        L += ["<!-- tac_pham", f"ten: {tp['ten']}", f"tac_gia: {tp['tac_gia']}", "noi_dung:"] + tp["noi_dung"] + ["-->", ""]
    L.append("\n\n".join(md_cau(i + 1, c) for i, c in enumerate(items)))
    return "\n".join(L) + "\n"


def tinh_diem(items):
    tong = sum(c["w"] for c in items)
    don_vi = 100.0 / tong
    for c in items:
        c["diem"] = round(c["w"] * don_vi, 2)
    items[-1]["diem"] = round(items[-1]["diem"] + 100 - sum(c["diem"] for c in items), 2)


def chuyen_de(doc, bai, do_kho):
    """Trả về ([(đuôi tên file, nội dung md)], danh sách bỏ qua, cảnh báo)."""
    pt = doc_de(doc)
    files, bo_qua, canh_bao = [], [], list(pt.canh_bao)
    if not pt.des:
        canh_bao.append("Không tìm thấy câu hỏi nào (file cần có các dòng 'Câu 1.', 'Câu 2.'...).")
    for k, de in enumerate(pt.des, 1):
        items = []
        for cau in de["cau"]:
            khoa = (de["cd"], de["phan"], de["nhom"], cau["phu"] or cau["so"])
            items += chuyen_cau(cau, de, pt.hint.get(khoa, ""), bai, k, bo_qua, canh_bao)
        if not items:
            canh_bao.append(f"Đề thứ {k} không có câu nào chuyển được, bỏ qua.")
            continue
        tinh_diem(items)
        files.append((k, md_de(de, bai, k, items, do_kho), len(items), de))
    return files, bo_qua, canh_bao


# ======================================================================
def main():
    ap = argparse.ArgumentParser(description="Chuyển file Word sang .md cho VnStarL")
    sp = ap.add_subparsers(dest="lenh", required=True)
    for ten in ("ly-thuyet", "de"):
        p = sp.add_parser(ten)
        p.add_argument("files", nargs="+", help="file .docx (nhận cả dấu *)")
        p.add_argument("-s", "--subject", default="ngu_van", help="thư mục môn (mặc định ngu_van)")
        p.add_argument("-c", "--chapter", required=True, help="số chương, vd 1")
        p.add_argument("-b", "--bai", type=int, help="số bài học (mặc định tự đọc trong file / tên file)")
        p.add_argument("--dry", action="store_true", help="chỉ in ra, không ghi file")
        p.add_argument("--root", default=str(ROOT))
        if ten == "de":
            p.add_argument("--do-kho", type=float, default=1, help="độ khó chung của các đề (mặc định 1)")
    a = ap.parse_args()

    m = re.search(r"\d+", a.chapter)
    if not m:
        sys.exit("-c phải là số chương, ví dụ 1")
    chuong = f"chuong-{int(m.group())}"
    mon = a.subject.replace("-", "_")
    ds_file = []
    for f in a.files:
        ds_file += [f] if Path(f).exists() else (sorted(glob.glob(f)) or [f])

    co_loi = False
    for f in ds_file:
        print(f"\n== {f}")
        try:
            doc = Document(f)
        except Exception as e:
            print(f"  LỖI không mở được file: {e}")
            co_loi = True
            continue

        if a.lenh == "ly-thuyet":
            text, bai, cb = chuyen_ly_thuyet(doc, a.bai or so_bai_tu_ten(f))
            if not bai:
                print("  LỖI không biết số bài. Thêm -b <số bài>.")
                co_loi = True
                continue
            dich = Path(a.root) / "ly_thuyet" / mon / chuong / f"bai-{bai:02d}.md"
            print(f"  Bài {bai}: {len(text)} ký tự")
            for w in cb:
                print(f"  ! {w}")
            if a.dry:
                print(text[:1500] + ("\n..." if len(text) > 1500 else ""))
            else:
                dich.parent.mkdir(parents=True, exist_ok=True)
                dich.write_text(text, encoding="utf-8")
                print(f"  -> {dich}")
            continue

        # ---- chế độ de ----
        bai = a.bai or so_bai_tu_ten(f)
        if not bai:
            for t in doc.tables[:1]:
                mm = re.search(r"B[ÀA]I\s*(\d+)", "".join(c.text for r in t.rows for c in r.cells), re.I)
                bai = int(mm.group(1)) if mm else None
        if not bai:
            print("  LỖI không biết số bài. Thêm -b <số bài>.")
            co_loi = True
            continue
        files, bo_qua, cb = chuyen_de(doc, bai, a.do_kho)
        thu_muc = Path(a.root) / "de" / mon / chuong
        for k, text, n, de in files:
            tong = sum(1 for _ in re.finditer(r"^\[Câu \d+\]", text, re.M))
            dich = thu_muc / f"bai_{bai}.{k}.md"
            print(f"  Đề {bai}.{k}: {n} câu ({TEN_CD.get(de['cd'], '')} / phần {de['phan']}"
                  f"{' / ngữ liệu ' + str(de['nhom']) if de['nhom'] else ''})")
            if a.dry:
                print(text)
            else:
                thu_muc.mkdir(parents=True, exist_ok=True)
                dich.write_text(text, encoding="utf-8")
                print(f"     -> {dich}")
        for w in cb:
            print(f"  ! {w}")
        if bo_qua:
            print(f"\n  CÓ {len(bo_qua)} CÂU CHƯA CHUYỂN ĐƯỢC:")
            for w in bo_qua:
                print(f"   - {w[:150]}")
            if not a.dry:
                thu_muc.mkdir(parents=True, exist_ok=True)
                (thu_muc / "_can_xu_ly.txt").write_text("\n\n".join(bo_qua) + "\n", encoding="utf-8")
                print(f"  (chi tiết đầy đủ: {thu_muc / '_can_xu_ly.txt'})")

    print("\nBước tiếp theo:  py md_to_lythuyet.py   (lý thuyết)   hoặc   py md_to_json_all.py   (đề)")
    sys.exit(1 if co_loi else 0)


if __name__ == "__main__":
    main()