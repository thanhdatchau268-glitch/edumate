# -*- coding: utf-8 -*-
r"""
md_to_lythuyet.py - Chuyển LÝ THUYẾT (.md) của NHIỀU MÔN, NHIỀU CHƯƠNG sang JSON cho web VnStarL.

Mỗi file .md = lý thuyết của 1 BÀI HỌC. Script chỉ ghi/ghi đè trường "ly_thuyet"
(và "mo_phong" nếu file .md có khai báo) trong:
    Frontend/file_de/<môn>/chuong-N/bai-NN.json
Phần "bai_tap" và mọi trường khác trong file đó được GIỮ NGUYÊN.
File .json chưa có thì tự tạo mới.

Đặt file này ở: Backend/script/md_to_lythuyet.py

CẤU TRÚC THƯ MỤC ĐẦU VÀO (ở thư mục gốc dự án):
    ly_thuyet/
        toan/
            chuong-1/
                bai-01.md
                bai-02.md
        ngu_van/
            chuong-2/
                bai-03.md
Tên thư mục môn / chương / file được đọc linh hoạt:
    môn   : "toan", "Toán", "ngu-van", "Ngữ văn" -> toan, ngu_van  (bỏ dấu, gạch dưới)
    chương: "chuong-1", "chuong_1", "Chương 1", "1" -> chuong-1
    bài   : "bai-01.md", "bai_1.md", "Bài 1 - Tên bài.md", "1.md" -> bai-01.json

CÁCH DÙNG (chạy ở Backend/script):
    py md_to_lythuyet.py                      # chuyển TẤT CẢ môn
    py md_to_lythuyet.py -s toan ngu_van      # chỉ một số môn
    py md_to_lythuyet.py --dry                # chạy thử, chỉ in ra, không ghi file
    py md_to_lythuyet.py bai.md -s toan -c 1  # 1 file lẻ (số bài lấy từ tên file, hoặc thêm -b 2)

CÁCH VIẾT FILE .md (AI hay người đều viết được, KHÔNG cần gấp đôi dấu \):
    # / ## -> tiêu đề lớn (<h3>)      ### trở xuống -> tiêu đề nhỏ (<h4>)
    **đậm**   *nghiêng*   `code`      > trích dẫn
    - gạch đầu dòng, 1. 2. 3. đánh số (thụt 2 dấu cách để lồng nhau)
    | bảng | dùng | dấu | gạch đứng |  (dòng 2 là |---|---|---|)
    Công thức: $...$ trong dòng, $$...$$ riêng dòng (được phép xuống dòng bên trong $$)
    Chỉ số dưới/trên ngoài công thức: H<sub>2</sub>O, x<sup>2</sup> (chỉ nhận b i u sub sup em strong code br)
    Dòng đầu tiên "# Bài 1: ..." sẽ tự bỏ (trang đã có tên bài).

    Muốn gắn mô phỏng, đặt khối này ở ĐẦU file (không bắt buộc):
        ---
        mo_phong: https://phet.colorado.edu/...
        ten: Tên mô phỏng
        nguon: PhET Interactive Simulations, CC-BY
        ---
    Không có khối này thì giữ nguyên "mo_phong" cũ trong JSON.

Chữ trong file bị hỏng do copy qua AI/Word (\t -> tab, \f -> ký tự lạ, "rac{" thay "\frac{"...)
cũng được vá lại giống md_to_json.py.
"""
import argparse
import codecs
import html
import json
import re
import sys
import unicodedata
import math
from pathlib import Path


try:
    ROOT = Path(__file__).resolve().parents[2]      # Backend/script/x.py -> thư mục gốc dự án
except IndexError:
    ROOT = Path.cwd()

try:                                                 # Windows: in tiếng Việt không bị lỗi mã
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


# ======================================================================
# 1. Đọc file + làm sạch (giống md_to_json.py)
# ======================================================================
def doc_file_md(path):
    data = Path(path).read_bytes()
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return data.decode("utf-16")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1258", errors="replace")


_DIEU_KHIEN = {"\x07": "a", "\x08": "b", "\x0b": "v", "\x0c": "f"}


def lam_sach(text):
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n")
    text = re.sub(r"\t(?=(?:ext\{|imes\b|an\b|heta\b|riangle\b|frac\b|dfrac\b|au\b|ilde\b|o\b))",
                  lambda m: "\\t", text)
    text = re.sub(r"[\x07\x08\x0b\x0c](?=[A-Za-z])", lambda m: "\\" + _DIEU_KHIEN[m.group(0)], text)
    text = re.sub(r"\r(?=(?:ightarrow|ight|ho\b))", lambda m: "\\r", text)
    text = text.replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\u200b\u200c\u200d\ufeff]", "", text)
    text = text.replace("\u00a0", " ").replace("：", ":")
    return text


# Công thức $...$ (1 dòng) hoặc $$...$$ (nhiều dòng cũng được)
RE_TOAN = re.compile(r"\$\$.+?\$\$|\$[^$\n]+\$", re.S)

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
_MOI_TRUONG_NHIEU_DONG = re.compile(
    r"\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|split|gathered)")


def sua_toan(ct):
    """Vá LaTeX hỏng bên TRONG 1 công thức."""
    for rx, v in _LATEX_MAT:
        ct = rx.sub(lambda _m, v=v: v, ct)
    if _MOI_TRUONG_NHIEU_DONG.search(ct):                 # "2x \ 3y" -> "2x \\ 3y"
        ct = re.sub(r"(?<=\s)\\(?=\s)", lambda _m: "\\\\", ct)
    return ct


def kiem_toan(ct):
    """Kiểm tra nhanh công thức (không thay được KaTeX, nhưng bắt được lỗi hay gặp)."""
    s = re.sub(r"\\[{}]", "", ct)                          # bỏ \{ và \} (ngoặc chữ)
    loi = []
    if s.count("{") != s.count("}"):
        loi.append("ngoặc nhọn { } không khớp")
    if len(re.findall(r"\\begin\{", ct)) != len(re.findall(r"\\end\{", ct)):
        loi.append("\\begin và \\end không khớp")
    return loi


# ======================================================================
# 2. Markdown -> HTML (không cần cài thêm thư viện)
# ======================================================================
RE_H = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t#]*$")
RE_HR = re.compile(r"^(?:-{3,}|\*{3,}|_{3,})$")
RE_LI = re.compile(r"^([ \t]*)([-*+]|\d+[.)])[ \t]+(.*)$")
_THE_CHO_PHEP = r"(?:b|i|u|sub|sup|em|strong|code)"

STYLE_BANG = "border-collapse:collapse;margin:8px 0;min-width:60%"
STYLE_TH = "border:1px solid #dfe5ee;padding:6px 10px;background:#f5f8ff;text-align:left"
STYLE_TD = "border:1px solid #dfe5ee;padding:6px 10px"


def _inline(s):
    """Định dạng trong dòng. Công thức đã được thay bằng token nên không bị đụng tới."""
    s = html.escape(s, quote=False)
    # cho phép vài thẻ HTML an toàn (H<sub>2</sub>O ...), mọi thẻ khác vẫn bị escape
    s = re.sub(rf"&lt;(/?{_THE_CHO_PHEP})&gt;", r"<\1>", s, flags=re.I)
    s = re.sub(r"&lt;br\s*/?&gt;", "<br>", s, flags=re.I)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![*\w])\*(?!\s)([^*]+?)(?<!\s)\*(?![*\w])", r"<i>\1</i>", s)
    return s


def _cells(row):
    row = row.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    return [c.strip() for c in row.split("|")]


def _la_dong_ke_bang(s):
    s = s.strip()
    return "-" in s and "|" in s and re.fullmatch(r"\|?[\s:\-|]+\|?", s) is not None


def _bang(lines, i):
    n = len(lines)
    dau = _cells(lines[i])
    i += 2
    h = f'<div style="overflow-x:auto"><table style="{STYLE_BANG}"><thead><tr>'
    h += "".join(f'<th style="{STYLE_TH}">{_inline(c)}</th>' for c in dau)
    h += "</tr></thead><tbody>"
    while i < n and lines[i].strip().startswith("|"):
        cs = _cells(lines[i])
        cs = (cs + [""] * len(dau))[:len(dau)]          # hàng thiếu / thừa ô thì bù / cắt cho đủ cột
        h += "<tr>" + "".join(f'<td style="{STYLE_TD}">{_inline(c)}</td>' for c in cs) + "</tr>"
        i += 1
    return h + "</tbody></table></div>", i


def _danh_sach(lines, i):
    n = len(lines)
    items = []                                           # [thụt đầu dòng, ul/ol, chữ]
    while i < n:
        m = RE_LI.match(lines[i])
        if m:
            items.append([len(m.group(1).replace("\t", "    ")),
                          "ol" if m.group(2)[0].isdigit() else "ul", m.group(3)])
            i += 1
        elif not lines[i].strip():                       # dòng trống: nếu sau đó vẫn là mục danh sách thì đi tiếp
            j = i
            while j < n and not lines[j].strip():
                j += 1
            if j < n and RE_LI.match(lines[j]):
                i = j
            else:
                break
        elif items and lines[i][:1] in (" ", "\t"):      # dòng nối tiếp của mục trước
            items[-1][2] += " " + lines[i].strip()
            i += 1
        else:
            break

    parts, stack = [], []
    for indent, tag, txt in items:
        txt = _inline(txt)
        if not stack or indent > stack[-1][0]:
            parts.append(f"<{tag}><li>{txt}")
            stack.append((indent, tag))
        else:
            while len(stack) > 1 and indent < stack[-1][0]:
                parts.append(f"</li></{stack.pop()[1]}>")
            if tag != stack[-1][1]:                      # đổi kiểu danh sách (- sang 1.) thì tách danh sách mới
                parts.append(f"</li></{stack.pop()[1]}>")
                parts.append(f"<{tag}><li>{txt}")
                stack.append((indent, tag))
            else:
                parts.append(f"</li><li>{txt}")
    while stack:
        parts.append(f"</li></{stack.pop()[1]}>")
    return "".join(parts), i

# ======================================================================
# 2b. Khối ```hinh -> SVG (hình học vẽ bằng lệnh đơn giản)
# ======================================================================
RE_HINH = re.compile(r"^```[ \t]*hinh[ \t]*\n(.*?)\n?```[ \t]*$", re.M | re.S)
MAU_NET, MAU_TO, MAU_CHU = "#1b2a41", "#e8eefc", "#1b2a41"


def _lenh(s):
    return re.sub(r"[\s_\-]+", "", bo_dau(s).lower())


def _so(x):
    return float(x.replace(",", "."))


def ve_hinh(src, cb):
    """Đọc các lệnh vẽ (toạ độ toán học, trục y hướng LÊN) và trả về HTML chứa 1 thẻ <svg>.
    Lệnh: diem, doan, netdut, tamgiac, vuong, goc, tron, chu  (xem hướng dẫn trong prompt NotebookLM)."""
    P, lenh = {}, []
    # --- Lượt 1: đọc điểm trước để lệnh nào đứng trước cũng dùng được ---
    for n, dong in enumerate(src.split("\n"), 1):
        dong = dong.strip()
        if not dong or dong.startswith("#"):
            continue
        parts = dong.split(None, 3) if _lenh(dong.split()[0]) == "chu" else dong.split()
        cmd = _lenh(parts[0])
        try:
            if cmd == "diem":
                P[parts[1]] = (_so(parts[2]), _so(parts[3]))
            else:
                lenh.append((n, cmd, parts, dong))
        except (IndexError, ValueError):
            cb.append(f"Hình, dòng {n}: «{dong}» sai cú pháp, đã bỏ qua.")

    # --- Lượt 2: gom hình ---
    polys, lines, circles, angles, rights, texts = [], [], [], [], [], []
    for n, cmd, parts, dong in lenh:
        try:
            if cmd in ("tamgiac", "dagiac"):
                if len(parts) < 4:
                    raise IndexError
                polys.append([P[x] for x in parts[1:]])
            elif cmd in ("doan", "netdut"):
                lines.append((P[parts[1]], P[parts[2]], cmd == "netdut"))
            elif cmd == "vuong":          # vuong <đỉnh> <điểm trên cạnh 1> <điểm trên cạnh 2>
                rights.append((P[parts[1]], P[parts[2]], P[parts[3]]))
            elif cmd == "goc":            # goc <đỉnh> <điểm 1> <điểm 2>  (cung tròn đánh dấu góc)
                angles.append((P[parts[1]], P[parts[2]], P[parts[3]]))
            elif cmd == "tron":           # tron <tâm> <bán kính>
                circles.append((P[parts[1]], _so(parts[2])))
            elif cmd == "chu":            # chu <x> <y> <nội dung>
                texts.append((_so(parts[1]), _so(parts[2]), parts[3].strip()))
            else:
                cb.append(f"Hình, dòng {n}: lệnh lạ «{parts[0]}», đã bỏ qua.")
        except KeyError as e:
            cb.append(f"Hình, dòng {n}: chưa khai báo điểm {e}. Hãy thêm 'diem {e} x y'.")
        except (IndexError, ValueError):
            cb.append(f"Hình, dòng {n}: «{dong}» sai cú pháp, đã bỏ qua.")

    # --- Khung hình: tính theo đơn vị toán học để chọn tỉ lệ, rồi đổi sang pixel ---
    xs = [p[0] for p in P.values()] + [t[0] for t in texts]
    ys = [p[1] for p in P.values()] + [t[1] for t in texts]
    for (cx, cy), r in circles:
        xs += [cx - r, cx + r]
        ys += [cy - r, cy + r]
    if not xs:
        cb.append("Khối ```hinh không có điểm hoặc hình nào, đã bỏ qua.")
        return ""
    s = max(30.0, min(70.0, 380.0 / max(max(xs) - min(xs), max(ys) - min(ys), 1)))
    X = lambda x: x * s
    Y = lambda y: -y * s

    # chữ rộng khoảng 8 px / ký tự: tính thêm để không bị cắt mép
    bx = [X(x) for x in xs] + [X(t[0]) + d * len(t[2]) * 4.2 for t in texts for d in (-1, 1)]
    by = [Y(y) for y in ys]
    pad = 18
    x0, y0 = min(bx) - pad, min(by) - pad
    w, h = max(bx) - min(bx) + 2 * pad, max(by) - min(by) + 2 * pad

    o = []
    for pl in polys:
        pts = " ".join(f"{X(a):.1f},{Y(b):.1f}" for a, b in pl)
        o.append(f'<polygon points="{pts}" fill="{MAU_TO}" stroke="{MAU_NET}" stroke-width="2" stroke-linejoin="round"/>')
    for a, b, dut in lines:
        o.append(f'<line x1="{X(a[0]):.1f}" y1="{Y(a[1]):.1f}" x2="{X(b[0]):.1f}" y2="{Y(b[1]):.1f}" '
                 f'stroke="{MAU_NET}" stroke-width="2"{" stroke-dasharray=\"6 5\"" if dut else ""}/>')
    for (cx, cy), r in circles:
        o.append(f'<circle cx="{X(cx):.1f}" cy="{Y(cy):.1f}" r="{r * s:.1f}" fill="none" stroke="{MAU_NET}" stroke-width="2"/>')

    def huong(v, p):                      # góc (màn hình) của tia v->p
        return math.atan2(Y(p[1]) - Y(v[1]), X(p[0]) - X(v[0]))

    for v, p, q in angles:
        a1, a2, r = huong(v, p), huong(v, q), 0.55 * s
        d = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi          # đi đường ngắn
        o.append(f'<path d="M{X(v[0]) + r * math.cos(a1):.1f},{Y(v[1]) + r * math.sin(a1):.1f} '
                 f'A{r:.1f},{r:.1f} 0 0 {1 if d > 0 else 0} {X(v[0]) + r * math.cos(a2):.1f},{Y(v[1]) + r * math.sin(a2):.1f}" '
                 f'fill="none" stroke="#c27410" stroke-width="2"/>')
    for v, p, q in rights:
        a1, a2, k = huong(v, p), huong(v, q), 0.28 * s
        vx, vy = X(v[0]), Y(v[1])
        ux, uy, wx, wy = k * math.cos(a1), k * math.sin(a1), k * math.cos(a2), k * math.sin(a2)
        o.append(f'<path d="M{vx + ux:.1f},{vy + uy:.1f} L{vx + ux + wx:.1f},{vy + uy + wy:.1f} L{vx + wx:.1f},{vy + wy:.1f}" '
                 f'fill="none" stroke="{MAU_NET}" stroke-width="1.6"/>')
    for a, b in P.values():
        o.append(f'<circle cx="{X(a):.1f}" cy="{Y(b):.1f}" r="3" fill="{MAU_NET}"/>')
    for x, y, t in texts:
        nghieng = ' font-style="italic" font-weight="700"' if len(t) == 1 and t.isalpha() else ""
        o.append(f'<text x="{X(x):.1f}" y="{Y(y):.1f}" text-anchor="middle" dominant-baseline="central" '
                 f'font-size="15" fill="{MAU_CHU}" stroke="#fff" stroke-width="3" paint-order="stroke" '
                 f'stroke-linejoin="round"{nghieng}>{html.escape(t, quote=False)}</text>')

    return (f'<div style="text-align:center;margin:12px 0"><svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" width="{w:.0f}" style="max-width:100%;height:auto" '
            f'role="img" aria-label="Hình minh hoạ" font-family="Segoe UI, Roboto, Arial, sans-serif">'
            + "".join(o) + "</svg></div>")
def md_sang_html(text, cb):
    """text đã qua lam_sach. cb = danh sách cảnh báo (hàm tự thêm vào)."""
    # --- Bước 1: cất công thức đi để Markdown không phá (| _ * < > & trong công thức) ---
    kho = []

    def cat(m):
        kho.append(m.group(0))
        return f"\x00{len(kho) - 1}\x00"
        # --- Cất các khối ```hinh (vẽ thành SVG), để Markdown không phá ---
    hinh_ds = []

    def cat_hinh(m):
        hinh_ds.append(ve_hinh(m.group(1), cb))
        return f"\n\x01{len(hinh_ds) - 1}\x01\n"

    text = RE_HINH.sub(cat_hinh, text)
    text = RE_TOAN.sub(cat, text)

    # --- Kiểm tra phần chữ còn lại ---
    if "$" in text:
        i = text.index("$")
        cb.append("Còn dấu $ lẻ, công thức có thể chưa đóng: «"
                  + text[max(0, i - 20): i + 25].replace("\n", " ") + "»")
    if re.search(r"!\[[^\]]*\]\(", text):
        cb.append("Có ảnh Markdown ![...](...): web chưa hỗ trợ ảnh trong lý thuyết, ảnh sẽ hiện thành chữ.")
    la = {t.lower() for t in re.findall(r"</?([a-zA-Z][a-zA-Z0-9]*)[^>]*>", text)}
    la -= {"b", "i", "u", "sub", "sup", "em", "strong", "code", "br"}
    if la:
        cb.append("Có thẻ HTML không được hỗ trợ (" + ", ".join(sorted(la)) + "), đã chuyển thành chữ thường.")

    lines = text.split("\n")
    n = len(lines)
    i = 0
    out, para = [], []

    def dong_doan():
        if not para:
            return
        s = ""
        for l in para:
            s += _inline(l.strip()) + ("<br>" if l.endswith("  ") else " ")
        s = s.rstrip()
        if s.endswith("<br>"):
            s = s[:-4]
        out.append("<p>" + s + "</p>")
        para.clear()

    dau_tien = True
    while i < n:
        l = lines[i]
        s = l.strip()
        if not s:
            dong_doan()
            i += 1
            continue
        if re.fullmatch(r"\x01\d+\x01", s):          # chỗ đặt hình
            dong_doan()
            out.append(hinh_ds[int(s[1:-1])])
            i += 1
            continue
        m = RE_H.match(s)
        if m:
            dong_doan()
            cap, tieu_de = len(m.group(1)), m.group(2)
            if dau_tien and cap == 1 and re.match(r"(?:bài|lý thuyết|chương)\b", tieu_de, re.I):
                i += 1                                   # tiêu đề tên bài: trang đã có sẵn
                continue
            tag = "h3" if cap <= 2 else "h4"
            out.append(f"<{tag}>{_inline(tieu_de)}</{tag}>")
            dau_tien = False
            i += 1
            continue
        dau_tien = False

        if RE_HR.match(s):
            dong_doan()
            i += 1
            continue

        if s.startswith(">"):
            dong_doan()
            gom = []
            while i < n and lines[i].strip().startswith(">"):
                gom.append(lines[i].strip().lstrip(">").strip())
                i += 1
            khoi = [[]]
            for g in gom:
                if g:
                    khoi[-1].append(g)
                else:
                    khoi.append([])
            out.append("<blockquote>" + "".join(f"<p>{_inline(' '.join(k))}</p>" for k in khoi if k)
                       + "</blockquote>")
            continue

        if RE_LI.match(l):
            dong_doan()
            h, i = _danh_sach(lines, i)
            out.append(h)
            continue

        if s.startswith("|") and i + 1 < n and _la_dong_ke_bang(lines[i + 1]):
            dong_doan()
            h, i = _bang(lines, i)
            out.append(h)
            continue

        para.append(l)
        i += 1
    dong_doan()

    # --- Bước cuối: trả công thức về chỗ cũ (vá LaTeX hỏng, escape để innerHTML an toàn) ---
    def tra(m):
        ct = sua_toan(kho[int(m.group(1))])
        for loi in kiem_toan(ct):
            cb.append(f"Công thức «{ct[:40]}»: {loi}.")
        ct = re.sub(r"\s*\n\s*", " ", ct)
        return html.escape(ct, quote=False)

    return re.sub(r"\x00(\d+)\x00", tra, "".join(out)), len(kho)


# ======================================================================
# 3. Đọc khối khai báo mô phỏng ở đầu file
# ======================================================================
def bo_dau(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D")


def tach_dau_tep(text):
    """Trả về (meta, phần còn lại). Chỉ coi là khai báo khi MỌI dòng trong khối đều dạng 'khóa: giá trị'."""
    m = re.match(r"\A\s*---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\Z)", text, re.S)
    if not m:
        return {}, text
    dong = [l for l in m.group(1).split("\n") if l.strip()]
    if not dong or not all(":" in l for l in dong):
        return {}, text
    meta = {}
    for l in dong:
        k, _, v = l.partition(":")
        k = re.sub(r"[\s\-]+", "_", bo_dau(k).strip().lower())
        meta[k] = v.strip()
    return meta, text[m.end():]


def lam_mo_phong(meta, cb):
    url = ""
    for k in ("mo_phong", "mophong", "url"):
        if meta.get(k):
            url = meta[k]
            break
    if not url:
        return None
    if not re.match(r"https://", url, re.I):
        cb.append(f"mo_phong phải là link https:// (đang là «{url[:40]}»), bỏ qua mô phỏng.")
        return None
    ten = meta.get("ten_mo_phong") or meta.get("ten") or "Mô phỏng"
    return {"url": url, "ten": ten, "nguon": meta.get("nguon", "")}


def doc_ly_thuyet(text):
    """Trả về (html, mo_phong hoặc None, số công thức, cảnh báo)."""
    cb = []
    text = lam_sach(text)
    meta, text = tach_dau_tep(text)
    mo_phong = lam_mo_phong(meta, cb)
    if not text.strip():
        raise ValueError("File trống (không có nội dung lý thuyết).")
    ht, so_ct = md_sang_html(text, cb)
    if len(re.sub(r"<[^>]+>", "", ht).strip()) < 30:
        cb.append("Nội dung lý thuyết rất ngắn, kiểm tra lại file.")
    if "<h3" not in ht and "<h4" not in ht:
        cb.append("Chưa có tiêu đề (# / ##) nào, nên chia mục cho dễ đọc.")
    return ht, mo_phong, so_ct, cb


# ======================================================================
# 4. Ghi file (giữ nguyên bai_tap và các trường khác)
# ======================================================================
def doc_json(path):
    if not path.exists() or not path.read_text("utf-8-sig").strip():
        return {}
    try:
        return json.loads(path.read_text("utf-8-sig"))
    except ValueError:
        raise ValueError(f"{path} đang bị lỗi JSON, không dám ghi đè. Hãy sửa file đó trước.")


def ghi_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def luu(root, mon, chuong, bai, ly_thuyet, mo_phong):
    p = root / "Frontend" / "file_de" / mon / chuong / f"bai-{bai:02d}.json"
    fe = doc_json(p)
    moi = not fe
    fe["ly_thuyet"] = ly_thuyet
    if mo_phong is not None:
        fe["mo_phong"] = mo_phong
    ghi_json(p, fe)
    return p, moi, ("bai_tap" in fe or "cau_hoi" in fe)


# ======================================================================
# 5. Đọc tên thư mục / file
# ======================================================================
def chuan_mon(ten):
    return re.sub(r"[^a-z0-9]+", "_", bo_dau(ten).lower()).strip("_")


def so_chuong(ten):
    m = re.search(r"\d+", ten)
    return f"chuong-{int(m.group())}" if m else None


def so_bai(stem):
    stem = unicodedata.normalize("NFC", stem)
    m = re.search(r"b[àa]i[\s_\-.]*(\d+)", stem, re.I) or re.search(r"\d+", stem)
    return int(m.group(m.lastindex or 0)) if m else None


# ======================================================================
def main():
    ap = argparse.ArgumentParser(description="Chuyển hàng loạt lý thuyết .md sang JSON cho VnStarL")
    ap.add_argument("files", nargs="*", help="(tuỳ chọn) file .md lẻ; cần kèm -s và -c")
    ap.add_argument("-s", "--subject", nargs="*", help="chỉ chuyển các môn này (mặc định: tất cả)")
    ap.add_argument("-c", "--chapter", help="số chương (chỉ dùng khi chuyển file lẻ)")
    ap.add_argument("-b", "--bai", type=int, help="số bài học (chỉ dùng khi chuyển 1 file lẻ)")
    ap.add_argument("--thu-muc", default=None, help="thư mục chứa lý thuyết (mặc định: <gốc>/ly_thuyet)")
    ap.add_argument("--root", default=str(ROOT), help="thư mục gốc dự án (mặc định tự tìm)")
    ap.add_argument("--dry", action="store_true", help="chạy thử, không ghi file")
    a = ap.parse_args()

    root = Path(a.root)
    viec = []                                            # (đường dẫn, môn, chương, bài)

    if a.files:                                          # ---- file lẻ ----
        if not a.subject or len(a.subject) != 1 or not a.chapter:
            sys.exit("Chuyển file lẻ cần đủ: -s <môn> -c <chương>. Ví dụ: py md_to_lythuyet.py bai.md -s toan -c 1")
        if a.bai and len(a.files) > 1:
            sys.exit("-b chỉ dùng được khi chuyển đúng 1 file.")
        chuong = so_chuong(a.chapter)
        if not chuong:
            sys.exit("-c phải là số chương, ví dụ: 1 hoặc chuong-1")
        for f in a.files:
            bai = a.bai or so_bai(Path(f).stem)
            if not bai:
                sys.exit(f"Không đọc được số bài từ tên file «{f}». Thêm -b <số bài>.")
            viec.append((Path(f), chuan_mon(a.subject[0]), chuong, bai))
    else:                                                # ---- cả thư mục ----
        goc = Path(a.thu_muc) if a.thu_muc else root / "ly_thuyet"
        if not goc.is_dir():
            sys.exit(f"Không thấy thư mục lý thuyết: {goc}\n"
                     f"Hãy tạo theo dạng ly_thuyet/<môn>/<chương>/bai-01.md")
        loc = {chuan_mon(s) for s in a.subject} if a.subject else None
        for f in sorted(goc.rglob("*.md")):
            if f.name.lower() == "readme.md" or f.name.startswith("_"):
                continue
            rel = f.relative_to(goc).parts
            if len(rel) != 3:
                print(f"! Bỏ qua {f}: cần nằm ở dạng <môn>/<chương>/<file>.md")
                continue
            mon = chuan_mon(rel[0])
            if loc is not None and mon not in loc:
                continue
            chuong, bai = so_chuong(rel[1]), so_bai(f.stem)
            if not chuong:
                print(f"! Bỏ qua {f}: tên thư mục chương «{rel[1]}» không có số.")
                continue
            if not bai:
                print(f"! Bỏ qua {f}: tên file không có số bài (ví dụ bai-01.md).")
                continue
            viec.append((f, mon, chuong, bai))

    if not viec:
        sys.exit("Không có file .md nào để chuyển.")

    ok = loi = 0
    da_ghi = {}
    for f, mon, chuong, bai in viec:
        nhan = f"{mon}/{chuong}/bai-{bai:02d}"
        try:
            ht, mo_phong, so_ct, cb = doc_ly_thuyet(doc_file_md(f))
            if nhan in da_ghi:
                cb.append(f"Trùng với {da_ghi[nhan]}: file này ghi đè file kia.")
            da_ghi[nhan] = f.name
            if a.dry:
                print(f"OK  {nhan}  <- {f.name}  ({len(ht)} ký tự HTML, {so_ct} công thức) [chạy thử]")
                print("    " + ht[:600] + (" ..." if len(ht) > 600 else ""))
            else:
                p, moi, co_de = luu(root, mon, chuong, bai, ht, mo_phong)
                print(f"OK  {nhan}  <- {f.name}  ({len(ht)} ký tự HTML, {so_ct} công thức)"
                      + ("  [tạo file mới]" if moi else ""))
                if not co_de:
                    cb.append("File JSON này chưa có đề (bai_tap). Chuyển đề bằng md_to_json.py sau.")
            for w in cb:
                print(f"    ! {w}")
            ok += 1
        except (OSError, ValueError) as e:
            print(f"LỖI {nhan}  <- {f}\n    {e}")
            loi += 1

    print(f"\nXong: {ok} bài thành công, {loi} bài lỗi" + (" (chạy thử, chưa ghi file)" if a.dry else ""))
    sys.exit(1 if loi else 0)


if __name__ == "__main__":
    main()