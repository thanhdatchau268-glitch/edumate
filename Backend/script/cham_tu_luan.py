# -*- coding: utf-8 -*-
"""
cham_tu_luan.py - Chấm câu TỰ LUẬN bằng từ khóa (đặt cạnh app.py: Backend/script/cham_tu_luan.py)

Mỗi câu tự luận có nhiều Ý. Mỗi ý có:
  - nhom_tu_khoa : danh sách các NHÓM; mỗi nhóm là các cách nói đồng nghĩa (khớp 1 trong nhóm là nhóm đó "trúng")
  - can_dat      : số nhóm tối thiểu phải trúng thì ý mới có điểm
Điểm câu = tổng điểm các ý đạt.

Cách so khớp: bỏ dấu, chữ thường, bỏ dấu câu, "33,1" = "33.1" -> học sinh gõ thiếu dấu vẫn khớp.
Chống "nhồi" từ khóa: bài viết quá ngắn thì số ý được tính bị giới hạn (TU_MOI_Y từ cho mỗi ý).
"""
import re
import unicodedata

TOI_DA_KY_TU = 6000   # chỉ đọc tối đa ngần này ký tự bài làm
TU_MOI_Y = 6          # cần ít nhất ngần này từ cho mỗi ý được tính điểm


def chuan_hoa(s):
    """'Đồng bằng sông Hồng, 33,1%!' -> ' dong bang song hong 33.1% ' (có khoảng trắng 2 đầu để so khớp theo từ)."""
    s = unicodedata.normalize("NFKD", str(s).lower().replace("đ", "d"))   # NFKD: km² thành km2
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")   # bỏ dấu
    s = re.sub(r"(?<=\d),(?=\d)", ".", s)                          # 33,1 -> 33.1
    s = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", s)                      # dấu chấm câu -> khoảng trắng (giữ số thập phân)
    s = re.sub(r"[^a-z0-9.%/]+", " ", s)                           # còn lại chỉ giữ chữ, số, . % /
    return " " + re.sub(r"\s+", " ", s).strip() + " "


def cham_tu_luan(info, tra_loi):
    """info = đáp án của 1 câu tự luận (có khóa "y"). Trả về (điểm đạt, [kết quả từng ý])."""
    text = chuan_hoa(str(tra_loi)[:TOI_DA_KY_TU])
    so_tu = len(text.split())

    ket_qua = []
    for y in info.get("y", []):
        nhoms = y.get("nhom_tu_khoa", [])
        ds_k = [[k for k in n if isinstance(k, str) and k.strip()] for n in nhoms]
        if len(ds_k) == 1 and y.get("can_dat", 1) > 1:
            # 1 nhóm duy nhất mà cần nhiều từ: đếm số từ khóa KHÁC NHAU trúng trong nhóm
            nhom_trung = sum(1 for k in ds_k[0] if chuan_hoa(k) in text)
        else:
            nhom_trung = sum(1 for n in ds_k if any(chuan_hoa(k) in text for k in n))
        ket_qua.append({"id": y.get("id"), "diem": y.get("diem", 0), "noi_dung": y.get("noi_dung", ""),
                        "dat": nhom_trung >= y.get("can_dat", 1)})

    # Bài quá ngắn thì không thể đúng hết các ý: giữ lại các ý đạt đầu tiên, phần dư không tính
    toi_da = so_tu // TU_MOI_Y
    dem = 0
    for r in ket_qua:
        if r["dat"]:
            dem += 1
            if dem > toi_da:
                r["dat"], r["qua_ngan"] = False, True

    return round(sum(r["diem"] for r in ket_qua if r["dat"]), 2), ket_qua