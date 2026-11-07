"""
CẮT ẢNH SAO LA: biến ảnh họa sĩ/AI đưa (nhiều khung xếp lưới, nền xanh lá) thành đúng khuôn của web:
    dải ngang 6 khung, mỗi khung 256x256, nền trong suốt  ->  1536x256 .webp

Cách dùng (chạy ở thư mục gốc dự án, ví dụ D:\\KHTT):
    python Backend/script/cat_anh_pet.py Frontend/img/pet/than/mac_dinh/idle.webp --ra Frontend/img/pet/than/mac_dinh --ten idle

    --ra   thư mục skin sẽ ghi kết quả
    --ten  tên hành động (idle, vui, ...). Với idle, script tự tạo thêm _xem_truoc.webp (128x128)
    --cot / --hang   số cột / số hàng của lưới trong ảnh gốc (mặc định 3 cột x 2 hàng = 6 khung)

Nếu ảnh gốc nằm ngay chỗ sẽ ghi (trùng tên), bản gốc được lưu sang thư mục pet_goc/ (đã bị .gitignore bỏ qua).

Script làm 4 việc:
  1. Xóa nền xanh: tự đoán màu nền từ viền ảnh, làm mờ viền mượt và khử ánh xanh còn sót ở mép.
  2. Chia lưới thành các khung.
  3. Cắt sát hình từng khung, thu về CÙNG MỘT tỉ lệ cho cả 6 khung (pet không bị to nhỏ giữa các khung).
  4. Đặt chân vào cùng một vị trí (đáy khung) và căn giữa theo trọng tâm, rồi ghép thành dải 6 khung.
"""
import argparse
import os
import shutil
import sys

import numpy as np
from PIL import Image

SO_KHUNG = 6
CO_KHUNG = 256          # mỗi khung 256x256
LE = 8                  # chừa lề quanh pet (px, tính trên khung 256)
NGUONG_ALPHA = 24       # alpha > 24/255 mới tính là "có hình" khi đo khung bao


def doan_mau_nen(rgb):
    """Màu nền = trung vị các điểm ảnh ở viền ngoài cùng của ảnh."""
    vien = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    return np.median(vien, axis=0)


def xoa_nen(img):
    """Trả về ảnh RGBA đã xóa nền (làm mờ mép mượt + khử ánh nền)."""
    rgba = np.asarray(img.convert("RGBA")).astype(np.float32)
    rgb = rgba[..., :3]
    nen = doan_mau_nen(rgb)
    # khoảng cách tới màu nền: gần = nền (alpha 0), xa = hình (alpha 255), ở giữa = viền mờ
    kc = np.sqrt(((rgb - nen) ** 2).sum(axis=2))
    THAP, CAO = 60.0, 140.0
    alpha = np.clip((kc - THAP) / (CAO - THAP), 0, 1)

    # khử ánh nền ở mép: kênh trội của màu nền không được vượt hai kênh còn lại
    k = int(np.argmax(nen))
    khac = [i for i in range(3) if i != k]
    tran = np.maximum(rgb[..., khac[0]], rgb[..., khac[1]])
    rgb[..., k] = np.minimum(rgb[..., k], tran)

    rgba[..., :3] = rgb
    rgba[..., 3] = np.minimum(rgba[..., 3], alpha * 255)
    return Image.fromarray(rgba.round().astype(np.uint8), "RGBA")


def tim_vach(do, vung_lo, vung_hi):
    """Trong đoạn [vung_lo, vung_hi) của mảng 'lượng hình theo từng hàng/cột', chọn chỗ TRỐNG NHẤT
    (nếu nhiều chỗ bằng nhau thì lấy giữa) làm đường cắt."""
    doan = do[vung_lo:vung_hi]
    thap = np.flatnonzero(doan == doan.min())
    return vung_lo + int(thap[len(thap) // 2])


def chia_luoi(img, cot, hang):
    """Chia lưới theo KHE TRỐNG thật giữa các pet (không cắt đều), vì pet hay lấn qua đường chia đều."""
    a = np.asarray(img)[..., 3] > NGUONG_ALPHA
    h, w = a.shape

    def vach(do, n, tong):
        mep = [0]
        for k in range(1, n):
            giua, nua = tong * k // n, tong // n // 3      # tìm trong khoảng +-1/3 ô quanh vị trí chia đều
            mep.append(tim_vach(do, max(mep[-1] + 1, giua - nua), min(tong - 1, giua + nua)))
        return mep + [tong]

    hang_vach = vach(a.sum(axis=1), hang, h)
    khung = []
    for r in range(hang):
        y0, y1 = hang_vach[r], hang_vach[r + 1]
        cot_vach = vach(a[y0:y1].sum(axis=0), cot, w)
        for c in range(cot):
            khung.append(img.crop((cot_vach[c], y0, cot_vach[c + 1], y1)))
    return khung


def giu_pet_chinh(f):
    """Bỏ mảnh vụn / dấu logo AI nằm xa pet (cần scipy; không có scipy thì bỏ qua bước này)."""
    try:
        from scipy import ndimage
    except ImportError:
        return f
    arr = np.asarray(f).copy()
    co = arr[..., 3] > NGUONG_ALPHA
    if not co.any():
        return f
    nhan, n = ndimage.label(ndimage.binary_dilation(co, iterations=10))   # nở ra 10px để cánh/hiệu ứng sát pet dính vào pet
    lon = np.argmax(ndimage.sum(co, nhan, range(1, n + 1))) + 1
    arr[nhan != lon, 3] = 0
    return Image.fromarray(arr, "RGBA")


def khung_bao(f):
    a = np.asarray(f)[..., 3]
    ys, xs = np.where(a > NGUONG_ALPHA)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def trong_tam_x(f, bb):
    """Hoành độ trọng tâm (theo alpha) trong vùng khung bao: bền hơn tâm hình hộp khi có cánh/đuôi/hiệu ứng thò ra."""
    a = np.asarray(f)[..., 3].astype(np.float64)
    a = a[bb[1]:bb[3], bb[0]:bb[2]]
    tong = a.sum()
    if tong == 0:
        return (bb[2] - bb[0]) / 2
    return float((a.sum(axis=0) * np.arange(a.shape[1])).sum() / tong)


def ghep(khung):
    bbs = [khung_bao(f) for f in khung]
    if any(b is None for b in bbs):
        sys.exit("Có khung trống (không thấy hình). Kiểm tra lại --cot / --hang hoặc màu nền.")

    # 1 tỉ lệ chung: khung to nhất vừa khít khung 256 trừ lề
    cao_max = max(b[3] - b[1] for b in bbs)
    rong_max = max(b[2] - b[0] for b in bbs)
    ti_le = min((CO_KHUNG - 2 * LE) / cao_max, (CO_KHUNG - 2 * LE) / rong_max)

    dai = Image.new("RGBA", (CO_KHUNG * SO_KHUNG, CO_KHUNG), (0, 0, 0, 0))
    for i, (f, bb) in enumerate(zip(khung, bbs)):
        cat = f.crop(bb)
        moi = (max(1, round(cat.width * ti_le)), max(1, round(cat.height * ti_le)))
        cat = cat.resize(moi, Image.LANCZOS)
        tx = trong_tam_x(f, bb) * ti_le
        x = round(CO_KHUNG / 2 - tx)                      # trọng tâm nằm giữa khung
        x = max(0, min(CO_KHUNG - cat.width, x))          # không tràn sang khung bên cạnh
        y = CO_KHUNG - LE - cat.height                    # chân (đáy hình) cùng 1 hàng ở mọi khung
        dai.alpha_composite(cat, (i * CO_KHUNG + x, y))
    return dai


def main():
    ap = argparse.ArgumentParser(description="Cắt ảnh lưới nền xanh thành dải 6 khung 256x256 trong suốt")
    ap.add_argument("anh", help="ảnh gốc (webp/png/jpg)")
    ap.add_argument("--ra", required=True, help="thư mục skin, ví dụ Frontend/img/pet/than/mac_dinh")
    ap.add_argument("--ten", default="idle", help="tên hành động (mặc định idle)")
    ap.add_argument("--cot", type=int, default=3)
    ap.add_argument("--hang", type=int, default=2)
    a = ap.parse_args()

    if a.cot * a.hang != SO_KHUNG:
        sys.exit(f"--cot x --hang phải bằng {SO_KHUNG} khung (hiện là {a.cot * a.hang}).")
    if not os.path.isfile(a.anh):
        sys.exit(f"Không thấy file: {a.anh}")

    dich = os.path.join(a.ra, a.ten + ".webp")
    goc = Image.open(a.anh)
    goc.load()

    # ảnh gốc đã đúng khuôn rồi thì đừng cắt lần nữa
    if goc.size == (CO_KHUNG * SO_KHUNG, CO_KHUNG) and "A" in goc.getbands() \
            and np.asarray(goc.convert("RGBA"))[..., 3].min() == 0:
        sys.exit("Ảnh này đã là dải 6 khung 1536x256 trong suốt, không cần cắt nữa.")

    # ghi đè lên chính file gốc thì sao lưu bản gốc trước
    if os.path.abspath(a.anh) == os.path.abspath(dich):
        os.makedirs("pet_goc", exist_ok=True)
        sao_luu = os.path.join("pet_goc", f"{os.path.basename(os.path.normpath(a.ra))}_{a.ten}_goc.webp")
        shutil.copyfile(a.anh, sao_luu)
        print("Đã sao lưu bản gốc ->", sao_luu)

    khung = [giu_pet_chinh(f) for f in chia_luoi(xoa_nen(goc), a.cot, a.hang)]
    dai = ghep(khung)

    os.makedirs(a.ra, exist_ok=True)
    dai.save(dich, "WEBP", lossless=True, method=6)
    print("Đã ghi", dich, dai.size)
    if a.ten == "idle":
        xt = os.path.join(a.ra, "_xem_truoc.webp")
        dai.crop((0, 0, CO_KHUNG, CO_KHUNG)).resize((128, 128), Image.LANCZOS).save(xt, "WEBP", lossless=True)
        print("Đã ghi", xt, "(128x128)")


if __name__ == "__main__":
    main()
