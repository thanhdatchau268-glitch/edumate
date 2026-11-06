# -*- coding: utf-8 -*-
r"""
pet_cat_anh.py - Biến ảnh gốc (lưới 3 cột x 2 hàng = 6 khung, nền phẳng hồng/xanh/màu bất kỳ)
thành sprite sheet WebP trong suốt cho pet VnStarL.

Đặt ở: Backend/script/pet_cat_anh.py   (chạy ở Backend/script)

    py pet_cat_anh.py ../../pet_goc/an-banh.jpg ../../pet_goc/doc-sach.jpg
    py pet_cat_anh.py ../../pet_goc/*.jpg --skin mac_dinh --khung 256
    py pet_cat_anh.py anh.jpg --dry          # chỉ in thông tin + ghi ảnh xem thử, không ghi vào Frontend

Tên file ảnh gốc = tên hành động:  an-banh.jpg -> an_banh ;  doc-sach.jpg -> doc_sach
Kết quả:
    Frontend/img/pet/than/<skin>/<hanh_dong>.webp   (dải ngang 6 khung, mỗi khung KHUNG x KHUNG, nền trong suốt)
    Frontend/img/pet/manifest.json                  (tự cập nhật mục của hành động đó)

Nền: tự đoán từ màu viền ảnh nên nền hồng, xanh lá hay màu phẳng khác đều được.
Các khung của MỌI hành động dùng cùng tỉ lệ thu phóng nên pet không bị to nhỏ lệch nhau giữa các hành động.
Biểu tượng nhỏ ở góc ảnh (dấu sao AI) bị loại vì chỉ giữ mảng lớn nhất trong mỗi ô.
"""
import argparse
import glob
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[2]
COT, HANG = 3, 2          # lưới ảnh gốc: 3 cột x 2 hàng = 6 khung
NGUONG_TRONG, NGUONG_DAC = 40.0, 85.0   # khoảng cách màu so với nền: dưới = trong suốt, trên = đặc


def ten_hanh_dong(p):
    s = unicodedata.normalize("NFD", Path(p).stem.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def mau_nen(a):
    """Màu nền = trung vị các pixel viền ảnh (bỏ qua góc có logo nhờ trung vị)."""
    vien = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    return np.median(vien, axis=0)


def xoa_nen(im):
    """Xóa nền phẳng: alpha mềm theo khoảng cách màu, lấp lỗ bên trong pet (tròng trắng, trang sách không bị thủng),
    rồi tách màu nền ra khỏi pixel viền (unmix) để không còn quầng xanh/hồng."""
    a = np.asarray(im.convert("RGB")).astype("float32")
    nen = mau_nen(a)
    d = np.sqrt(((a - nen) ** 2).sum(axis=2))
    mem = np.clip((d - NGUONG_TRONG) / (NGUONG_DAC - NGUONG_TRONG), 0, 1)
    dac = ndimage.binary_closing(d > NGUONG_DAC, iterations=2)
    lo = ndimage.binary_fill_holes(dac) & ~dac                           # các lỗ nằm trong silhouette
    lab_lo, n_lo = ndimage.label(lo)
    if n_lo:                                                             # lỗ có màu giống nền (khe giữa đuôi và thân) vẫn để trong suốt
        tb = ndimage.mean(d, lab_lo, range(1, n_lo + 1))
        dac = dac | (lo & np.isin(lab_lo, [i + 1 for i in range(n_lo) if tb[i] >= 60]))
    trong = ndimage.binary_erosion(dac, iterations=3)                    # vùng chắc chắn nằm bên trong pet
    alpha = np.where(trong, 1.0, np.where(dac, np.maximum(mem, 0.0), mem))
    vien = (alpha > 0) & ~trong                                          # dải viền quanh pet
    rgb = a.copy()
    k = int(np.argmax(nen))                                              # kênh màu nền trội nhất (xanh lá -> G, hồng -> R)
    khac = [i for i in range(3) if i != k]
    tran = np.maximum(a[..., khac[0]], a[..., khac[1]])
    rgb[..., k] = np.where(vien, np.minimum(a[..., k], tran), a[..., k])   # kéo kênh ám màu nền xuống: hết quầng
    alpha = np.where(vien, np.clip((alpha - 0.35) / 0.65, 0, 1), alpha)    # co viền mềm vào một chút
    return rgb.clip(0, 255).astype("uint8"), alpha, nen


def cat_o(alpha, rgb):
    """Tìm 6 pet bằng nhãn mảng liền kề trên CẢ ảnh (tai/đuôi lấn sang ô bên cạnh vẫn nguyên vẹn),
    mỗi mảng lớn thuộc ô có tâm gần nhất. Vật thể nhỏ cách xa (logo ở góc) bị bỏ."""
    h, w = alpha.shape
    nho = alpha > 0.5
    lab, n = ndimage.label(ndimage.binary_dilation(nho, iterations=7))
    dien_tich = ndimage.sum(nho, lab, range(1, n + 1))
    tam = ndimage.center_of_mass(nho, lab, range(1, n + 1))
    lon = [i for i in range(n) if dien_tich[i] > 0.02 * h * w / (COT * HANG)]     # mảng đủ lớn mới là pet
    o_cua = {}
    for i in lon:
        cy, cx = tam[i]
        o = min(int(cy * HANG / h), HANG - 1) * COT + min(int(cx * COT / w), COT - 1)
        if o not in o_cua or dien_tich[i] > dien_tich[o_cua[o]]:
            o_cua[o] = i
    if len(o_cua) != COT * HANG:
        raise ValueError(f"Chỉ tìm thấy {len(o_cua)}/{COT * HANG} khung. Ảnh phải là lưới 3 cột x 2 hàng, nền phẳng.")
    kq = []
    for o in range(COT * HANG):
        vung = ndimage.binary_dilation(lab == o_cua[o] + 1, iterations=4)
        al = np.where(vung, alpha, 0)
        ys, xs = np.where(al > 0.05)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.dstack([rgb, (al * 255).astype("uint8")])[y0:y1, x0:x1]
        ox, oy = (o % COT) * w // COT, (o // COT) * h // HANG             # toạ độ hộp bao tính theo góc ô
        kq.append((rgba, (x0 - ox, y0 - oy, x1 - ox, y1 - oy)))
    return kq


def main():
    ap = argparse.ArgumentParser(description="Cắt ảnh pet 3x2 thành sprite WebP trong suốt")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--skin", default=None, help="id skin; bỏ trống thì lấy tên thư mục chứa ảnh (pet_goc/<skin>/x.jpg), ảnh nằm thẳng trong pet_goc thì là mac_dinh")
    ap.add_argument("--khung", type=int, default=256, help="cạnh mỗi khung (px), mặc định 256")
    ap.add_argument("--chat-luong", type=int, default=82)
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    ds = []
    for p in a.files:
        ds += sorted(glob.glob(p)) or [p]

    def skin_cua(f):
        if a.skin:
            return a.skin
        cha = Path(f).resolve().parent.name
        return "mac_dinh" if cha in ("pet_goc", "") else ten_hanh_dong(cha)
    # --- lượt 1: xóa nền, cắt ô, đo kích thước lớn nhất của mọi khung ---
    viec = []
    for f in ds:
        try:
            rgb, alpha, nen = xoa_nen(Image.open(f))
            o = cat_o(alpha, rgb)
        except (OSError, ValueError) as e:
            print(f"LỖI {f}: {e}")
            continue
        viec.append((ten_hanh_dong(f), o, nen, skin_cua(f)))
        print(f"{f}: nền {tuple(int(x) for x in nen)}, 6 khung")
    if not viec:
        sys.exit(1)
    gw = max(b[2] - b[0] for _, o, _, _ in viec for _, b in o)
    gh = max(b[3] - b[1] for _, o, _, _ in viec for _, b in o)
    k = min(1.0, (a.khung - 12) / max(gw, gh))     # CÙNG một tỉ lệ cho mọi hành động
    print(f"Khung lớn nhất {gw}x{gh}px -> tỉ lệ {k:.3f}")

    goc_than = Path(a.root) / "Frontend" / "img" / "pet" / "than"
    man_p = Path(a.root) / "Frontend" / "img" / "pet" / "manifest.json"
    man = json.loads(man_p.read_text("utf-8")) if man_p.exists() else {"khung": a.khung, "hanh_dong": {}}
    man["khung"] = a.khung

    for ten, o, _, skin in viec:
        out_dir = goc_than / skin
        # mỏ neo: giữa theo chiều ngang và đáy của hộp bao chung 6 khung (giữ chuyển động tương đối giữa các khung)
        ux0, ux1 = min(b[0] for _, b in o), max(b[2] for _, b in o)
        uy1 = max(b[3] for _, b in o)
        cx = (ux0 + ux1) / 2
        dai = Image.new("RGBA", (a.khung * len(o), a.khung), (0, 0, 0, 0))
        for i, (rgba, bb) in enumerate(o):
            im = Image.fromarray(rgba, "RGBA")
            nw, nh = max(1, round(im.width * k)), max(1, round(im.height * k))
            im = im.resize((nw, nh), Image.LANCZOS)
            kh = Image.new("RGBA", (a.khung, a.khung), (0, 0, 0, 0))   # khung riêng, phần thừa tự bị cắt
            kh.paste(im, (round(a.khung / 2 + (bb[0] - cx) * k), round(a.khung - 6 - (uy1 - bb[1]) * k)), im)
            dai.paste(kh, (i * a.khung, 0))
        if not a.dry:
            out_dir.mkdir(parents=True, exist_ok=True)
            dai.save(out_dir / f"{ten}.webp", "WEBP", quality=a.chat_luong, method=6)
            man["hanh_dong"].setdefault(ten, {"frames": len(o), "fps": 6, "lap": True, "nhom": "chinh"})
            ds_sk = man.setdefault("skin", {}).setdefault(skin, {"hanh_dong": []})["hanh_dong"]   # skin này có những hành động nào (để biết khi nào phải dùng idle dự phòng)
            if ten not in ds_sk:
                ds_sk.append(ten)
            if ten == "idle":                                                                      # ảnh nhỏ cho cửa hàng / chọn đồ, không phải tải cả sprite
                dai.crop((0, 0, a.khung, a.khung)).resize((128, 128), Image.LANCZOS).save(out_dir / "_xem_truoc.webp", "WEBP", quality=80)
            kb = (out_dir / f"{ten}.webp").stat().st_size / 1024
            print(f"  -> {out_dir / (ten + '.webp')}  ({kb:.1f} KB)")
        # ảnh xem thử trên nền ca-rô để kiểm tra viền
        xem = Image.new("RGBA", dai.size, (255, 255, 255, 255))
        for yy in range(0, dai.height, 16):
            for xx in range(0, dai.width, 16):
                if (xx // 16 + yy // 16) % 2:
                    xem.paste((220, 220, 220, 255), (xx, yy, xx + 16, yy + 16))
        xem.alpha_composite(dai)
        xem.convert("RGB").save(Path(a.root) / f"xem_thu_{ten}.png")

    if not a.dry:
        man_p.parent.mkdir(parents=True, exist_ok=True)
        man_p.write_text(json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Đã cập nhật", man_p)


if __name__ == "__main__":
    main()
